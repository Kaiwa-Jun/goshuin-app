// Instagram Business Discovery パス（Issue #111）の純粋関数群。
// I/O（fetch / Supabase / Claude API / Deno.env）は index.ts 側に置き、
// ここは Deno test 可能な関数だけにする。

import { normalizeGoshuinItem, type LimitedGoshuinItem } from './crawl.ts';

export interface InstagramPost {
  permalink: string; // 例 https://www.instagram.com/p/DL1234abcd/
  timestamp: string; // 例 2026-07-07T09:12:33+0000（Graph API の生値）
  caption: string; // 欠落時は ''
}

const INSTAGRAM_HOSTS = ['instagram.com', 'www.instagram.com', 'm.instagram.com'];

// username として解決してはいけない instagram.com のパスセグメント
const RESERVED_PATH_SEGMENTS = new Set([
  'p',
  'reel',
  'reels',
  'tv',
  'stories',
  'explore',
  'accounts',
  'direct',
  'about',
  'developer',
  'legal',
  'privacy',
  'help',
  'challenge',
  'session',
  'oauth',
  'web',
  'graphql',
  'api',
  's',
]);

const USERNAME_PATTERN = /^[a-z0-9._]{1,30}$/;

function isInstagramHost(hostname: string): boolean {
  return INSTAGRAM_HOSTS.includes(hostname.toLowerCase());
}

/**
 * Instagram のプロフィール URL から username を導出する。
 * プロフィール URL 以外（投稿・予約語パス・instagram.com 以外のホスト・非 https）は null。
 */
export function parseInstagramUsername(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'https:') return null;
  if (!isInstagramHost(parsed.hostname)) return null;
  const segments = parsed.pathname.split('/').filter(segment => segment.length > 0);
  if (segments.length !== 1) return null;
  const candidate = segments[0].replace(/^@/, '').toLowerCase();
  if (RESERVED_PATH_SEGMENTS.has(candidate)) return null;
  return USERNAME_PATTERN.test(candidate) ? candidate : null;
}

/**
 * Business Discovery の GET URL を組み立てる。
 * 戻り値に access_token を含めない（「ログに出せる URL」と「実際に投げる URL」を分離し、
 * トークン漏洩を構造的に防ぐ。token は index.ts が fetch 直前に付与する）。
 */
export function buildBusinessDiscoveryUrl(
  igUserId: string,
  username: string,
  mediaLimit: number
): string {
  const fields = `business_discovery.username(${username}){username,media.limit(${mediaLimit}){caption,permalink,timestamp}}`;
  return `https://graph.facebook.com/v26.0/${encodeURIComponent(igUserId)}?${new URLSearchParams({ fields }).toString()}`;
}

/**
 * Graph API のエラーレスポンスを 4 分類する。
 * not_business = その source のみスキップ / token_invalid・rate_limited = パス全体を中断 / other = failed 計上
 */
export function classifyGraphApiError(
  status: number,
  json: unknown
): 'not_business' | 'token_invalid' | 'rate_limited' | 'other' {
  if (status === 429) return 'rate_limited';
  if (typeof json === 'object' && json !== null) {
    const error = (json as Record<string, unknown>).error;
    if (typeof error === 'object' && error !== null) {
      const code = (error as Record<string, unknown>).code;
      if (typeof code === 'number') {
        if (code === 110) return 'not_business';
        if (code === 190 || code === 102) return 'token_invalid';
        if (code === 4 || code === 17 || code === 32 || code === 613) return 'rate_limited';
      }
    }
  }
  return 'other';
}

/**
 * Business Discovery レスポンスから投稿を取り出す。
 * permalink が instagram.com の https URL でない要素・timestamp がパース不能な要素は破棄する。
 * API のレスポンス順（新しい順）を保持して返す。
 */
export function parseBusinessDiscoveryPosts(json: unknown): InstagramPost[] {
  if (typeof json !== 'object' || json === null) return [];
  const discovery = (json as Record<string, unknown>).business_discovery;
  if (typeof discovery !== 'object' || discovery === null) return [];
  const media = (discovery as Record<string, unknown>).media;
  if (typeof media !== 'object' || media === null) return [];
  const data = (media as Record<string, unknown>).data;
  if (!Array.isArray(data)) return [];

  const posts: InstagramPost[] = [];
  for (const entry of data) {
    if (typeof entry !== 'object' || entry === null) continue;
    const record = entry as Record<string, unknown>;
    const permalink = record.permalink;
    if (typeof permalink !== 'string') continue;
    let parsed: URL;
    try {
      parsed = new URL(permalink);
    } catch {
      continue;
    }
    if (parsed.protocol !== 'https:' || !isInstagramHost(parsed.hostname)) continue;
    const timestamp = record.timestamp;
    if (typeof timestamp !== 'string' || Number.isNaN(Date.parse(timestamp))) continue;
    const caption = typeof record.caption === 'string' ? record.caption : '';
    posts.push({ permalink, timestamp, caption });
  }
  return posts;
}

/** timestamp が lookbackDays 日以内の投稿だけを順序を保って返す。入力は破壊しない */
export function filterRecentPosts(
  posts: InstagramPost[],
  nowMs: number,
  lookbackDays: number
): InstagramPost[] {
  const cutoff = nowMs - lookbackDays * 86_400_000;
  return posts.filter(post => {
    const parsed = Date.parse(post.timestamp);
    return !Number.isNaN(parsed) && parsed >= cutoff;
  });
}

/** ISO 日時を JST（UTC+9 固定）の YYYY-MM-DD にする。パース不能は '' */
export function toJstDate(iso: string): string {
  const parsed = Date.parse(iso);
  if (Number.isNaN(parsed)) return '';
  return new Date(parsed + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/**
 * 差分検知用の決定的な文字列。caption を含めるのは Instagram では投稿本文が
 * 後から編集される（timestamp は変わらない）ため。ソートはコピーに対して行い、
 * 入力配列（= post_index の基準になる順序）は破壊しない。
 */
export function buildInstagramContentKey(posts: InstagramPost[]): string {
  return posts
    .map(post => `${post.permalink}\t${post.timestamp}\t${post.caption}`)
    .sort()
    .join('\n');
}

/**
 * Claude へ渡すユーザーメッセージを固定書式で組み立てる。
 * 総文字数が maxTotalChars を超える投稿以降は含めない（末尾から落とし、
 * 先頭側の post_index がずれないようにする）。【投稿数】には切り詰め前の
 * posts.length を書き、post_index の値域を Claude に伝える。
 */
export function buildInstagramUserMessage(
  todayJst: string,
  username: string,
  posts: InstagramPost[],
  maxCaptionChars: number,
  maxTotalChars: number
): string {
  let message = `【今日の日付】${todayJst}\n【アカウント】@${username}\n【投稿数】${posts.length}\n`;
  for (let index = 0; index < posts.length; index++) {
    const caption = posts[index].caption.slice(0, maxCaptionChars);
    const body = caption.length > 0 ? caption : '（本文なし）';
    const block = `\n--- 投稿 ${index} ---\n【投稿日】${toJstDate(posts[index].timestamp)}\n【本文】\n${body}\n`;
    if (message.length + block.length > maxTotalChars) break;
    message += block;
  }
  return message;
}

/**
 * Claude の出力を Instagram 由来の LimitedGoshuinItem に正規化する。
 * 出典は post_index の整数だけを信用し、permalink はコード側が posts[idx] から代入する
 * （URL 文字列を Claude に返させないので出典の捏造が原理的に起きない）。
 * post_index が範囲外・非整数・欠落の item は破棄する。
 */
export function normalizeInstagramItems(
  raw: unknown[],
  posts: InstagramPost[],
  sourceKey: string,
  fetchedAt: string,
  maxItems: number
): LimitedGoshuinItem[] {
  const items: LimitedGoshuinItem[] = [];
  for (const entry of raw) {
    if (items.length >= maxItems) break;
    if (typeof entry !== 'object' || entry === null) continue;
    const index = (entry as Record<string, unknown>).post_index;
    if (
      typeof index !== 'number' ||
      !Number.isInteger(index) ||
      index < 0 ||
      index >= posts.length
    ) {
      continue;
    }
    const item = normalizeGoshuinItem(entry, posts[index].permalink, fetchedAt);
    if (!item) continue;
    items.push({ ...item, source_key: sourceKey });
  }
  return items;
}
