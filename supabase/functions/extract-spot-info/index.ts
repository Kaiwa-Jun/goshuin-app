import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ExtractedInfo {
  parking?: { available: boolean; capacity?: number; location?: string };
  affiliated_shrines?: { name: string; details?: string }[];
  reception_hours?: { open?: string; close?: string; notes?: string };
  access_notes?: { type: string; text: string }[];
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { stamp_id } = await req.json();
    console.log('[extract] stamp_id:', stamp_id);
    if (!stamp_id) {
      return new Response(JSON.stringify({ error: 'stamp_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY')!;
    console.log(
      '[extract] env check - url:',
      !!supabaseUrl,
      'serviceKey:',
      !!supabaseServiceKey,
      'apiKey:',
      !!anthropicApiKey
    );

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Get stamp record
    const { data: stamp, error: stampError } = await supabase
      .from('stamps')
      .select('id, memo, spot_id, visited_at')
      .eq('id', stamp_id)
      .single();

    console.log(
      '[extract] stamp fetch - data:',
      JSON.stringify(stamp),
      'error:',
      JSON.stringify(stampError)
    );

    if (stampError || !stamp) {
      return new Response(JSON.stringify({ error: 'Stamp not found', details: stampError }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Skip if memo is empty
    if (!stamp.memo || stamp.memo.trim() === '') {
      console.log('[extract] memo is empty, skipping');
      return new Response(JSON.stringify({ message: 'No memo to extract' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[extract] memo:', stamp.memo);

    // 3. Call Claude API
    const extractedInfo = await callClaudeApi(anthropicApiKey, stamp.memo);
    console.log('[extract] Claude result:', JSON.stringify(extractedInfo));

    // 4. Update stamp with extracted info
    if (extractedInfo && Object.keys(extractedInfo).length > 0) {
      const { error: updateError } = await supabase
        .from('stamps')
        .update({ extracted_info: extractedInfo })
        .eq('id', stamp_id);
      console.log('[extract] stamp update error:', JSON.stringify(updateError));
    } else {
      console.log('[extract] no extracted info to save');
    }

    // 5. Aggregate info for the spot
    console.log('[extract] aggregating for spot:', stamp.spot_id);
    await aggregateSpotInfo(supabase, stamp.spot_id);

    return new Response(JSON.stringify({ success: true, extracted: extractedInfo }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[extract] Extraction error:', error);
    const message = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: 'Internal server error', debug: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function callClaudeApi(apiKey: string, memo: string): Promise<ExtractedInfo> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: memo,
        },
      ],
      system: `あなたは御朱印・神社仏閣の口コミから構造化情報を抽出するアシスタントです。
ユーザーの投稿コメントから以下の情報を抽出してJSON形式で返してください。
該当する情報がない場合は、そのフィールドを省略してください。
推測や創作は行わず、コメントに明示的に書かれている情報のみ抽出してください。

抽出対象:
1. parking: 駐車場情報 (available: boolean, capacity?: number, location?: string)
2. affiliated_shrines: 兼務社情報 (name: string, details?: string)[]
3. reception_hours: 受付時間 (open?: string HH:MM, close?: string HH:MM, notes?: string)
4. access_notes: アクセス情報の配列 ({ type: "walking" | "car" | "bus" | "train" | "note", text: string })[]
   - type は情報の種類: walking=徒歩, car=車, bus=バス, train=電車, note=その他
   - 1つのコメントから複数のアクセス情報を抽出可能

JSONのみを返してください。説明文は不要です。該当情報がない場合は空のオブジェクト {} を返してください。`,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Claude API error:', response.status, errorText);
    // Temporarily include error in response for debugging
    throw new Error(`Claude API ${response.status}: ${errorText}`);
  }

  const result = await response.json();
  console.log('[extract] Claude raw response:', JSON.stringify(result));
  const text = result.content?.[0]?.text ?? '{}';
  console.log('[extract] Claude text:', text);

  try {
    // Extract JSON from potential markdown code blocks
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, text];
    return JSON.parse(jsonMatch[1].trim());
  } catch {
    console.error('Failed to parse Claude response:', text);
    return {};
  }
}

async function aggregateSpotInfo(
  supabase: ReturnType<typeof createClient>,
  spotId: string
): Promise<void> {
  // Get all stamps with extracted_info for this spot
  const { data: stamps, error } = await supabase
    .from('stamps')
    .select('id, extracted_info, visited_at')
    .eq('spot_id', spotId)
    .not('extracted_info', 'is', null)
    .order('visited_at', { ascending: false });

  if (error || !stamps || stamps.length === 0) return;

  const infoTypes = ['parking', 'affiliated_shrines', 'reception_hours', 'access_notes'] as const;

  for (const infoType of infoTypes) {
    const relevantStamps = stamps.filter(
      (s: { extracted_info: Record<string, unknown> }) => s.extracted_info?.[infoType] != null
    );

    if (relevantStamps.length === 0) continue;

    let aggregatedData: unknown;
    const sourceStampIds = relevantStamps.map((s: { id: string }) => s.id);
    const latestDate = relevantStamps[0].visited_at;

    switch (infoType) {
      case 'parking': {
        // Majority vote from latest 3
        const recent = relevantStamps.slice(0, 3);
        const availableCount = recent.filter(
          (s: { extracted_info: Record<string, { available: boolean }> }) =>
            s.extracted_info.parking?.available === true
        ).length;
        const latestParking = relevantStamps[0].extracted_info.parking;
        aggregatedData = {
          ...latestParking,
          available: availableCount > recent.length / 2,
        };
        break;
      }
      case 'affiliated_shrines': {
        // Union by name
        const allShrines: { name: string; details?: string }[] = [];
        const seenNames = new Set<string>();
        for (const s of relevantStamps) {
          for (const shrine of s.extracted_info.affiliated_shrines ?? []) {
            if (!seenNames.has(shrine.name)) {
              seenNames.add(shrine.name);
              allShrines.push(shrine);
            }
          }
        }
        aggregatedData = allShrines;
        break;
      }
      case 'reception_hours': {
        // Latest wins
        aggregatedData = relevantStamps[0].extracted_info[infoType];
        break;
      }
      case 'access_notes': {
        // Union by text (deduplicate)
        const allNotes: { type: string; text: string }[] = [];
        const seenTexts = new Set<string>();
        for (const s of relevantStamps) {
          const notes = s.extracted_info.access_notes ?? [];
          for (const note of notes) {
            if (!seenTexts.has(note.text)) {
              seenTexts.add(note.text);
              allNotes.push(note);
            }
          }
        }
        aggregatedData = allNotes;
        break;
      }
    }

    // Calculate confidence score
    const baseScore = relevantStamps.length >= 3 ? 0.8 : relevantStamps.length >= 2 ? 0.6 : 0.3;
    const latestTimestamp = new Date(latestDate);
    const daysSinceLatest = (Date.now() - latestTimestamp.getTime()) / (1000 * 60 * 60 * 24);
    const recencyBonus = daysSinceLatest <= 30 ? 0.2 : 0;
    const confidenceScore = Math.min(1.0, baseScore + recencyBonus);

    // UPSERT
    await supabase.from('spot_aggregated_info').upsert(
      {
        spot_id: spotId,
        info_type: infoType,
        info_data: typeof aggregatedData === 'string' ? { value: aggregatedData } : aggregatedData,
        source_stamp_ids: sourceStampIds,
        confidence_score: confidenceScore,
        last_reported_at: latestDate,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'spot_id,info_type' }
    );
  }
}
