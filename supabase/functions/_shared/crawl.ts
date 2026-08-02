// crawl-spot-sources Edge Function の純粋関数群。
// I/O（fetch / Supabase / Claude API）は index.ts 側に置き、ここは Deno test 可能な関数だけにする。

export interface LimitedGoshuinItem {
  name: string;
  period: string | null;
  period_start?: string | null;
  period_end?: string | null;
  description?: string | null;
  source_url: string;
  fetched_at: string;
}

/** Authorization ヘッダが service_role キーの Bearer であるときだけ true */
export function isServiceRoleAuthorized(
  authHeader: string | null,
  serviceRoleKey: string
): boolean {
  if (!serviceRoleKey) return false;
  return authHeader === `Bearer ${serviceRoleKey}`;
}

const PRIVATE_HOST_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^0\.0\.0\.0$/,
  /^169\.254\./,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
];

/** https のみ許可し、プライベート IP レンジ・localhost を拒否する（SSRF ガード） */
export function isAllowedSourceUrl(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'https:') return false;
  return !PRIVATE_HOST_PATTERNS.some(pattern => pattern.test(parsed.hostname));
}

const CRAWLABLE_CONTENT_TYPES = [
  'text/html',
  'application/xhtml+xml',
  'text/xml',
  'application/xml',
  'application/rss+xml',
  'application/atom+xml',
];

/** HTML / XML / RSS / Atom 系の Content-Type のみ解析対象にする */
export function isCrawlableContentType(contentType: string | null): boolean {
  if (!contentType) return false;
  const normalized = contentType.toLowerCase();
  return CRAWLABLE_CONTENT_TYPES.some(type => normalized.startsWith(type));
}

/** HTML を決定的にプレーンテキスト化する（順序は契約書で固定） */
export function htmlToText(html: string, maxChars: number): string {
  let text = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
  text = text.replace(/<!--[\s\S]*?-->/g, '');
  text = text.replace(/<br\s*\/?>|<\/p>|<\/div>|<\/li>|<\/tr>|<\/h[1-6]>/gi, '\n');
  text = text.replace(/<[^>]*>/g, '');
  text = text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
  const lines = text
    .split('\n')
    .map(line => line.replace(/[ \t]+/g, ' ').trim())
    .filter(line => line.length > 0);
  return lines.join('\n').slice(0, maxChars);
}

/** SHA-256 を小文字16進64桁で返す */
export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest))
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
}

/** Claude 応答からコードフェンスを剥がして JSON を取り出す。失敗時は空 items */
export function parseClaudeJson(text: string): { items: unknown[] } {
  try {
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, text];
    const parsed = JSON.parse((jsonMatch[1] ?? text).trim());
    if (parsed && Array.isArray(parsed.items)) {
      return { items: parsed.items };
    }
    return { items: [] };
  } catch {
    return { items: [] };
  }
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function normalizeDate(value: unknown): string | null {
  return typeof value === 'string' && DATE_PATTERN.test(value) ? value : null;
}

function normalizeText(value: unknown, maxChars: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxChars) : null;
}

/**
 * Claude の出力を LimitedGoshuinItem に正規化する。
 * source_url / fetched_at は Claude の出力を無視して必ず引数値で上書きする（出典の捏造防止）。
 */
export function normalizeItems(
  raw: unknown[],
  sourceUrl: string,
  fetchedAt: string,
  maxItems: number
): LimitedGoshuinItem[] {
  const items: LimitedGoshuinItem[] = [];
  for (const entry of raw) {
    if (items.length >= maxItems) break;
    if (typeof entry !== 'object' || entry === null) continue;
    const record = entry as Record<string, unknown>;
    const name = normalizeText(record.name, 100);
    if (!name) continue;
    items.push({
      name,
      period: normalizeText(record.period, 100),
      period_start: normalizeDate(record.period_start),
      period_end: normalizeDate(record.period_end),
      description: normalizeText(record.description, 300),
      source_url: sourceUrl,
      fetched_at: fetchedAt,
    });
  }
  return items;
}

/**
 * 既存 items から同一 source_url 由来の要素を除去し、末尾に incoming を連結する。
 * 1スポット複数ソースのとき、他ソース由来の項目を消さないための merge。入力は破壊しない。
 */
export function mergeLimitedGoshuinItems(
  existing: LimitedGoshuinItem[],
  sourceUrl: string,
  incoming: LimitedGoshuinItem[]
): LimitedGoshuinItem[] {
  return [...existing.filter(entry => entry.source_url !== sourceUrl), ...incoming];
}

/** 実行全体のソフト締切判定 */
export function isPastDeadline(startedAtMs: number, nowMs: number, budgetMs: number): boolean {
  return nowMs - startedAtMs >= budgetMs;
}
