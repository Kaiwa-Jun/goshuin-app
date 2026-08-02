import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  isServiceRoleAuthorized,
  isAllowedSourceUrl,
  isCrawlableContentType,
  htmlToText,
  sha256Hex,
  parseClaudeJson,
  normalizeItems,
  mergeLimitedGoshuinItems,
  isPastDeadline,
  type LimitedGoshuinItem,
} from '../_shared/crawl.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MAX_SOURCES_PER_RUN = 20; // 1回の実行で処理する source の上限
const MAX_ITEMS_PER_SOURCE = 10; // 1ソースから採用する限定御朱印の上限
const FETCH_TIMEOUT_MS = 10_000; // 外部 fetch のタイムアウト
const MAX_REDIRECTS = 5; // リダイレクトの最大追跡数（各ホップを SSRF ガードで検証する）
const MAX_CONTENT_BYTES = 2_000_000; // レスポンス本文の上限（2MB）
const MAX_TEXT_CHARS = 20_000; // Claude に渡すテキストの上限
const RUN_BUDGET_MS = 100_000; // 実行全体のソフト締切（Edge Function のウォールクロック対策）
const CLAUDE_MODEL = 'claude-haiku-4-5-20251001';
const CLAUDE_MAX_TOKENS = 2048;
const USER_AGENT = 'GoshuinSampoBot/1.0 (+https://kaiwa-jun.github.io/goshuin-app/)';

const SYSTEM_PROMPT = `あなたは寺社の公式サイトから「限定御朱印」の情報だけを抽出するアシスタントです。
本文に明示的に書かれている情報のみを抽出し、推測・創作・補完は一切行わないでください。
書かれていない項目は null にしてください。年号の変換や期間の推定も行わないでください。

抽出対象は「期間限定・月替わり・行事限定などの特別な御朱印」だけです。
通常の御朱印・御朱印帳の頒布・授与所の案内・イベント全般は対象外です。

以下の JSON のみを返してください。説明文・前置き・コードブロック外の文字は不要です。
{
  "items": [
    {
      "name": "御朱印の名称（本文の表記そのまま・必須）",
      "period": "頒布期間の表記そのまま。書かれていなければ null",
      "period_start": "期間開始が西暦日付として明記されている場合のみ YYYY-MM-DD。それ以外は null",
      "period_end": "期間終了が西暦日付として明記されている場合のみ YYYY-MM-DD。それ以外は null",
      "description": "初穂料・書き置きの別など補足。無ければ null"
    }
  ]
}
該当する限定御朱印が本文に無い場合は {"items": []} を返してください。`;

interface SourceRow {
  id: string;
  spot_id: string;
  url: string;
  source_type: string;
  content_hash: string | null;
}

interface RunSummary {
  processed: number;
  changed: number;
  extracted: number;
  unchanged: number;
  failed: number;
  skipped_blocked: number;
  skipped_content_type: number;
  deadline_reached: boolean;
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY')!;

    // Claude API のコストが発生する関数なので anon JWT では実行させない
    if (!isServiceRoleAuthorized(req.headers.get('Authorization'), serviceRoleKey)) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let body: { limit?: number; spot_id?: string; dry_run?: boolean } = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }
    const limit = Math.min(
      Math.max(Number(body.limit) || MAX_SOURCES_PER_RUN, 1),
      MAX_SOURCES_PER_RUN
    );

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    let query = supabase
      .from('spot_info_sources')
      .select('id, spot_id, url, source_type, content_hash')
      .eq('enabled', true)
      .neq('source_type', 'sns_link')
      .order('last_crawled_at', { ascending: true, nullsFirst: true })
      .limit(limit);
    if (body.spot_id) {
      query = query.eq('spot_id', body.spot_id);
    }

    const { data: sources, error: sourcesError } = await query;
    if (sourcesError) {
      throw new Error(`Failed to list sources: ${sourcesError.message}`);
    }

    const summary: RunSummary = {
      processed: 0,
      changed: 0,
      extracted: 0,
      unchanged: 0,
      failed: 0,
      skipped_blocked: 0,
      skipped_content_type: 0,
      deadline_reached: false,
    };
    const startedAt = Date.now();

    // 先方サイトへの負荷を抑えるため並列化せず1件ずつ逐次処理する
    for (const source of (sources ?? []) as SourceRow[]) {
      if (isPastDeadline(startedAt, Date.now(), RUN_BUDGET_MS)) {
        summary.deadline_reached = true;
        break;
      }
      summary.processed++;
      try {
        await processSource(supabase, anthropicApiKey, source, summary, body.dry_run === true);
      } catch (error) {
        console.error('[crawl] source failed:', source.url, error);
        summary.failed++;
      }
    }

    console.log('[crawl] summary:', JSON.stringify(summary));
    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[crawl] fatal error:', error);
    const message = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: 'Internal server error', debug: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function processSource(
  supabase: SupabaseClient,
  anthropicApiKey: string,
  source: SourceRow,
  summary: RunSummary,
  dryRun: boolean
): Promise<void> {
  const fetchedAt = new Date().toISOString();

  if (!isAllowedSourceUrl(source.url)) {
    console.warn('[crawl] blocked url:', source.url);
    summary.skipped_blocked++;
    return; // last_crawled_at は更新しない（登録ミスを気付きやすくする）
  }

  const res = await fetchWithTimeout(source.url);
  if (!res.ok) {
    console.warn('[crawl] fetch not ok:', source.url, res.status);
    summary.failed++;
    await touchSource(supabase, source.id, { last_crawled_at: fetchedAt });
    return;
  }

  if (!isCrawlableContentType(res.headers.get('content-type'))) {
    console.warn('[crawl] skipped content-type:', source.url, res.headers.get('content-type'));
    summary.skipped_content_type++;
    res.body?.cancel();
    await touchSource(supabase, source.id, { last_crawled_at: fetchedAt });
    return;
  }

  const html = await readBodyWithLimit(res, MAX_CONTENT_BYTES);
  const text = htmlToText(html, MAX_TEXT_CHARS);
  const hash = await sha256Hex(text);

  if (hash === source.content_hash) {
    summary.unchanged++;
    await touchSource(supabase, source.id, { last_crawled_at: fetchedAt });
    return;
  }

  summary.changed++;
  if (dryRun) {
    // dry_run では Claude を呼ばず、hash も更新しない（次回の本実行で抽出させる）
    await touchSource(supabase, source.id, { last_crawled_at: fetchedAt });
    return;
  }

  // Claude 呼び出しが失敗したら throw → failed 計上。content_hash は未更新のため次回再抽出される
  const claudeText = await callClaudeApi(anthropicApiKey, source.url, text);
  const parsed = parseClaudeJson(claudeText);
  const newItems = normalizeItems(parsed.items, source.url, fetchedAt, MAX_ITEMS_PER_SOURCE);
  summary.extracted++;

  const { data: existingRow } = await supabase
    .from('spot_aggregated_info')
    .select('info_data')
    .eq('spot_id', source.spot_id)
    .eq('info_type', 'limited_goshuin')
    .maybeSingle();

  const existingItems = extractExistingItems(existingRow?.info_data);
  const merged = mergeLimitedGoshuinItems(existingItems, source.url, newItems);

  if (merged.length === 0) {
    // 古い限定御朱印を残さない
    await supabase
      .from('spot_aggregated_info')
      .delete()
      .eq('spot_id', source.spot_id)
      .eq('info_type', 'limited_goshuin');
  } else {
    const { error: upsertError } = await supabase.from('spot_aggregated_info').upsert(
      {
        spot_id: source.spot_id,
        info_type: 'limited_goshuin',
        info_data: { items: merged, fetched_at: fetchedAt },
        source_stamp_ids: [],
        confidence_score: 0.9,
        last_reported_at: fetchedAt,
        updated_at: fetchedAt,
      },
      { onConflict: 'spot_id,info_type' }
    );
    if (upsertError) {
      throw new Error(`Upsert failed: ${upsertError.message}`);
    }
  }

  await touchSource(supabase, source.id, {
    content_hash: hash,
    last_crawled_at: fetchedAt,
    last_changed_at: fetchedAt,
    updated_at: fetchedAt,
  });
}

/**
 * リダイレクトを自動追跡せず1ホップずつ検証しながら fetch する。
 * redirect: 'follow' だと初回 URL しか SSRF ガードを通らず、
 * リダイレクト先にプライベート IP を指されると迂回できてしまう。
 */
async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    let currentUrl = url;
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      if (!isAllowedSourceUrl(currentUrl)) {
        throw new Error(`Blocked redirect target: ${currentUrl}`);
      }
      const res = await fetch(currentUrl, {
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'text/html,application/xhtml+xml,application/xml',
        },
        redirect: 'manual',
        signal: controller.signal,
      });
      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get('location');
        res.body?.cancel();
        if (!location) {
          return res;
        }
        currentUrl = new URL(location, currentUrl).toString();
        continue;
      }
      return res;
    }
    throw new Error(`Too many redirects: ${url}`);
  } finally {
    clearTimeout(timer);
  }
}

/** res.text() で丸読みせず、MAX_CONTENT_BYTES を超えた時点で打ち切る */
async function readBodyWithLimit(res: Response, maxBytes: number): Promise<string> {
  if (!res.body) return '';
  const reader = res.body.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: false });
  let total = 0;
  let text = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      break;
    }
    text += decoder.decode(value, { stream: true });
  }
  text += decoder.decode();
  return text;
}

function extractExistingItems(infoData: unknown): LimitedGoshuinItem[] {
  if (typeof infoData !== 'object' || infoData === null) return [];
  const items = (infoData as { items?: unknown }).items;
  return Array.isArray(items) ? (items as LimitedGoshuinItem[]) : [];
}

async function touchSource(
  supabase: SupabaseClient,
  sourceId: string,
  patch: Record<string, string>
): Promise<void> {
  await supabase
    .from('spot_info_sources')
    .update({ updated_at: new Date().toISOString(), ...patch })
    .eq('id', sourceId);
}

async function callClaudeApi(apiKey: string, url: string, text: string): Promise<string> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: CLAUDE_MAX_TOKENS,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `【ページURL】${url}\n\n【本文】\n${text}`,
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[crawl] Claude API error:', response.status, errorText);
    throw new Error(`Claude API ${response.status}`);
  }

  const result = await response.json();
  return result.content?.[0]?.text ?? '{"items": []}';
}
