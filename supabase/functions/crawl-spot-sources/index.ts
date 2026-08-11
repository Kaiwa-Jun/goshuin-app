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
  mergeItemsBySourceKey,
  isPastDeadline,
  type LimitedGoshuinItem,
} from '../_shared/crawl.ts';
import {
  parseInstagramUsername,
  buildBusinessDiscoveryUrl,
  classifyGraphApiError,
  parseBusinessDiscoveryPosts,
  filterRecentPosts,
  toJstDate,
  buildInstagramContentKey,
  buildInstagramUserMessage,
  normalizeInstagramItems,
} from '../_shared/instagram.ts';

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

// --- Instagram Business Discovery パス（Issue #111） ---
const META_GRAPH_VERSION = 'v26.0'; // _shared/instagram.ts の buildBusinessDiscoveryUrl が生成する版と一致させること
const MAX_INSTAGRAM_SOURCES_PER_RUN = 25; // 1回の実行で叩く Graph API 呼び出しの上限（1 source = 1 call・ページングなし・リトライなし）
const INSTAGRAM_MEDIA_LIMIT = 25; // 1アカウントあたり取得する投稿数
const INSTAGRAM_LOOKBACK_DAYS = 60; // timestamp による機械的な鮮度カットオフ
const MAX_CAPTION_CHARS = 1_500; // 1投稿の caption を Claude に渡す上限
const MAX_INSTAGRAM_PROMPT_CHARS = 30_000; // 投稿一覧全体の上限

const SYSTEM_PROMPT = `あなたは寺社の公式サイトから「限定御朱印」の情報だけを抽出するアシスタントです。
本文に明示的に書かれている情報のみを抽出し、推測・創作・補完は一切行わないでください。
書かれていない項目は null にしてください。年号の変換や期間の推定も行わないでください。

抽出対象は「期間限定・月替わり・行事限定などの特別な御朱印」だけです。
「御朱印」「朱印」「御集印」として明記されているものだけを対象とし、
通常の御朱印・御朱印帳の頒布・授与所の案内・イベント全般は対象外です。
お守り・お札・破魔矢・御神矢・土鈴・熊手・縁起物などの授与品は、
期間限定であっても御朱印ではないため絶対に含めないでください。

ユーザーメッセージには【今日の日付】が含まれます。次のものは items に含めないでください:
- 頒布期間の終了日が明記されていて、それが今日より前のもの
- 名称・期間・本文の表記から頒布時期が今日から見て明らかに過ぎているもの
  （例: 8月時点での「新年限定」「正月限定」、昨年以前の年号が明記された告知）
次のものは必ず含めてください（除外しないでください）:
- 現在頒布中のもの、頒布開始が今後のもの
- 「◯月から」「◯月〜」のように開始のみ記載され終了の記載が無いもの
  （開始が過去の月でも、終了していない限り頒布中とみなす）
- 通年・月替わり・季節替わりで続いているもの、期間の記載が無く現在の頒布と読めるもの

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

// Instagram パス専用（Issue #111）。web パスの回帰リスクをゼロにするため
// 既存 SYSTEM_PROMPT には触れず、別定数として持つ。
const INSTAGRAM_SYSTEM_PROMPT = `あなたは寺社の公式 Instagram アカウントの投稿から「限定御朱印」の情報だけを抽出するアシスタントです。
投稿本文に明示的に書かれている情報のみを抽出し、推測・創作・補完は一切行わないでください。
書かれていない項目は null にしてください。年号の変換や期間の推定も行わないでください。

抽出対象は「期間限定・月替わり・行事限定などの特別な御朱印」だけです。
「御朱印」「朱印」「御集印」として明記されているものだけを対象とし、
通常の御朱印・御朱印帳の頒布・授与所の案内・イベント全般は対象外です。
お守り・お札・破魔矢・御神矢・土鈴・熊手・縁起物などの授与品は、
期間限定であっても御朱印ではないため絶対に含めないでください。

ユーザーメッセージには【今日の日付】と、投稿ごとの【投稿日】が含まれます。
次のものは items に含めないでください:
- 頒布期間の終了日が明記されていて、それが今日より前のもの
- 名称・期間・本文の表記から頒布時期が今日から見て明らかに過ぎているもの
  （例: 8月時点での「新年限定」「正月限定」、昨年以前の年号が明記された告知）
次のものは必ず含めてください（除外しないでください）:
- 現在頒布中のもの、頒布開始が今後のもの
- 「◯月から」「◯月〜」のように開始のみ記載され終了の記載が無いもの
  （開始が過去の月でも、終了していない限り頒布中とみなす）
- 通年・月替わり・季節替わりで続いているもの、期間の記載が無く現在の頒布と読めるもの

【投稿日】は「いつ告知されたか」の手がかりとしてのみ使ってください。
投稿日を period / period_start / period_end に書かないでください（本文に無い期間を作らないため）。

各 item には、その情報が書かれていた投稿の番号を post_index（0 起点の整数）で必ず入れてください。
同じ御朱印が複数の投稿に出てくる場合は、最も新しい（番号が小さい）投稿の番号を1つだけ使い、
item を重複させないでください。

以下の JSON のみを返してください。説明文・前置き・コードブロック外の文字は不要です。
{
  "items": [
    {
      "post_index": 0,
      "name": "御朱印の名称（本文の表記そのまま・必須）",
      "period": "頒布期間の表記そのまま。書かれていなければ null",
      "period_start": "期間開始が西暦日付として明記されている場合のみ YYYY-MM-DD。それ以外は null",
      "period_end": "期間終了が西暦日付として明記されている場合のみ YYYY-MM-DD。それ以外は null",
      "description": "初穂料・書き置きの別など補足。無ければ null"
    }
  ]
}
該当する限定御朱印が投稿に無い場合は {"items": []} を返してください。`;

interface SourceRow {
  id: string;
  spot_id: string;
  url: string;
  source_type: string;
  content_hash: string | null;
}

interface InstagramRunSummary {
  processed: number;
  changed: number;
  extracted: number;
  unchanged: number;
  failed: number;
  skipped_invalid_url: number;
  skipped_not_business: number;
  skipped_no_credentials: boolean;
  rate_limited: boolean;
  token_invalid: boolean;
  deadline_reached: boolean;
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
  instagram: InstagramRunSummary;
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

    let body: { limit?: number; spot_id?: string; dry_run?: boolean; mode?: string } = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }
    // 'web' | 'instagram' | 'all' 以外の値は 'all' として扱う
    const mode: 'web' | 'instagram' | 'all' =
      body.mode === 'web' || body.mode === 'instagram' ? body.mode : 'all';
    const limit = Math.min(
      Math.max(Number(body.limit) || MAX_SOURCES_PER_RUN, 1),
      MAX_SOURCES_PER_RUN
    );

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const summary: RunSummary = {
      processed: 0,
      changed: 0,
      extracted: 0,
      unchanged: 0,
      failed: 0,
      skipped_blocked: 0,
      skipped_content_type: 0,
      deadline_reached: false,
      instagram: {
        processed: 0,
        changed: 0,
        extracted: 0,
        unchanged: 0,
        failed: 0,
        skipped_invalid_url: 0,
        skipped_not_business: 0,
        skipped_no_credentials: false,
        rate_limited: false,
        token_invalid: false,
        deadline_reached: false,
      },
    };
    const startedAt = Date.now();

    // Instagram パスを先に実行する。呼び出し回数が上限 25 で頭打ちの短時間処理であり、
    // web パスを先にすると RUN_BUDGET_MS を使い切って Instagram が恒久的に飢えるため。
    if (mode !== 'web') {
      await runInstagramPass(supabase, anthropicApiKey, body, startedAt, summary.instagram);
    }

    if (mode !== 'instagram') {
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
 * Instagram パス（Issue #111）。spot_info_sources の sns_link のうち instagram.com の
 * プロフィール URL を Business Discovery API で巡回し、投稿 permalink を出典・
 * timestamp を鮮度判定に使って spot_aggregated_info にマージする。
 */
async function runInstagramPass(
  supabase: SupabaseClient,
  anthropicApiKey: string,
  body: { limit?: number; spot_id?: string; dry_run?: boolean },
  startedAt: number,
  summary: InstagramRunSummary
): Promise<void> {
  const accessToken = Deno.env.get('META_ACCESS_TOKEN') ?? '';
  const igUserId = Deno.env.get('META_IG_USER_ID') ?? '';
  if (!accessToken || !igUserId) {
    // secrets が消えても web パスを壊さない（関数全体を 500 にしない）
    console.warn('[crawl][ig] credentials missing, skipping instagram pass');
    summary.skipped_no_credentials = true;
    return;
  }

  const igLimit = Math.min(
    Math.max(Number(body.limit) || MAX_INSTAGRAM_SOURCES_PER_RUN, 1),
    MAX_INSTAGRAM_SOURCES_PER_RUN
  );

  let query = supabase
    .from('spot_info_sources')
    .select('id, spot_id, url, source_type, content_hash')
    .eq('enabled', true)
    .eq('source_type', 'sns_link')
    .ilike('url', '%instagram.com%')
    .order('last_crawled_at', { ascending: true, nullsFirst: true })
    .limit(igLimit);
  if (body.spot_id) {
    query = query.eq('spot_id', body.spot_id);
  }

  const { data: sources, error: sourcesError } = await query;
  if (sourcesError) {
    throw new Error(`Failed to list instagram sources: ${sourcesError.message}`);
  }

  // Graph API のレート制限に配慮して並列化せず1件ずつ逐次処理する
  for (const source of (sources ?? []) as SourceRow[]) {
    if (isPastDeadline(startedAt, Date.now(), RUN_BUDGET_MS)) {
      summary.deadline_reached = true;
      break;
    }
    // token 失効・レート制限は続けても全滅するのでパス全体を即中断する
    if (summary.token_invalid || summary.rate_limited) {
      break;
    }
    try {
      await processInstagramSource(
        supabase,
        anthropicApiKey,
        accessToken,
        igUserId,
        source,
        summary,
        body.dry_run === true
      );
    } catch (error) {
      console.warn('[crawl][ig] source failed:', source.url, error);
      summary.failed++;
    }
  }
}

async function processInstagramSource(
  supabase: SupabaseClient,
  anthropicApiKey: string,
  accessToken: string,
  igUserId: string,
  source: SourceRow,
  summary: InstagramRunSummary,
  dryRun: boolean
): Promise<void> {
  const username = parseInstagramUsername(source.url);
  if (!username) {
    // last_crawled_at は更新しない（登録ミスに気付きやすくする）
    console.warn('[crawl][ig] not an instagram profile url:', source.url);
    summary.skipped_invalid_url++;
    return;
  }

  summary.processed++;
  const fetchedAt = new Date().toISOString();

  const requestUrl = buildBusinessDiscoveryUrl(igUserId, username, INSTAGRAM_MEDIA_LIMIT);
  if (!requestUrl.startsWith(`https://graph.facebook.com/${META_GRAPH_VERSION}/`)) {
    // 定数と _shared/instagram.ts の生成 URL の版が乖離したら即失敗させる
    throw new Error(`Graph API version mismatch: expected ${META_GRAPH_VERSION}`);
  }
  const response = await fetchGraphApi(requestUrl, accessToken);
  let json: unknown = null;
  try {
    json = await response.json();
  } catch {
    json = null;
  }

  if (!response.ok) {
    const kind = classifyGraphApiError(response.status, json);
    if (kind === 'not_business') {
      // 個人アカウントは十分ありうる。アプリでは従来どおり「公式SNS」リンク表示のまま
      console.warn('[crawl][ig] not a business account:', username);
      summary.skipped_not_business++;
      await touchSource(supabase, source.id, { last_crawled_at: fetchedAt });
      return;
    }
    if (kind === 'token_invalid') {
      console.error('[crawl][ig] META_ACCESS_TOKEN invalid or expired (code 190)');
      summary.token_invalid = true;
      summary.failed++;
      return; // last_crawled_at を更新せず次回リトライさせる
    }
    if (kind === 'rate_limited') {
      console.warn('[crawl][ig] rate limited, aborting instagram pass');
      summary.rate_limited = true;
      return; // last_crawled_at を更新せず次回リトライさせる
    }
    console.warn('[crawl][ig] graph api error:', username, response.status);
    summary.failed++;
    await touchSource(supabase, source.id, { last_crawled_at: fetchedAt });
    return;
  }

  const posts = filterRecentPosts(
    parseBusinessDiscoveryPosts(json),
    Date.now(),
    INSTAGRAM_LOOKBACK_DAYS
  );
  const hash = await sha256Hex(buildInstagramContentKey(posts));

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

  const sourceKey = `instagram:${username}`;

  // 窓内 0 件なら Claude を呼ばず incoming = [] でマージし、窓から外れた
  // 投稿由来のアイテムを消す（60 日の窓は意図的に「消える」設計）
  let newItems: LimitedGoshuinItem[] = [];
  if (posts.length > 0) {
    const todayJst = toJstDate(new Date().toISOString());
    const message = buildInstagramUserMessage(
      todayJst,
      username,
      posts,
      MAX_CAPTION_CHARS,
      MAX_INSTAGRAM_PROMPT_CHARS
    );
    // Claude 呼び出しが失敗したら throw → failed 計上。content_hash は未更新のため次回再抽出される
    const claudeText = await callInstagramClaudeApi(anthropicApiKey, message);
    newItems = normalizeInstagramItems(
      parseClaudeJson(claudeText).items,
      posts,
      sourceKey,
      fetchedAt,
      MAX_ITEMS_PER_SOURCE
    );
    summary.extracted++;
  }

  const { data: existingRow } = await supabase
    .from('spot_aggregated_info')
    .select('info_data')
    .eq('spot_id', source.spot_id)
    .eq('info_type', 'limited_goshuin')
    .maybeSingle();

  const existingItems = extractExistingItems(existingRow?.info_data);
  // permalink はソース URL と一致しないため source_url キーの merge は使えない（source_key キーで置換する）
  const merged = mergeItemsBySourceKey(existingItems, sourceKey, newItems);

  if (merged.length === 0) {
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
 * Graph API を叩く。access_token はここで初めて URL に付与する
 * （buildBusinessDiscoveryUrl の戻り値はログに出せる URL のままにする）。
 */
async function fetchGraphApi(urlWithoutToken: string, accessToken: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(`${urlWithoutToken}&access_token=${encodeURIComponent(accessToken)}`, {
      redirect: 'error',
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

/** Instagram パス用の Claude 呼び出し。model / max_tokens / anthropic-version は web パスと共通 */
async function callInstagramClaudeApi(apiKey: string, userMessage: string): Promise<string> {
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
      system: INSTAGRAM_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[crawl][ig] Claude API error:', response.status, errorText);
    throw new Error(`Claude API ${response.status}`);
  }

  const result = await response.json();
  return result.content?.[0]?.text ?? '{"items": []}';
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
  // JST（UTC+9 固定）の今日の日付。過去の告知を除外する判定基準としてプロンプトに渡す
  const todayJst = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
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
          content: `【今日の日付】${todayJst}\n【ページURL】${url}\n\n【本文】\n${text}`,
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
