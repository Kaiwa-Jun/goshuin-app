// Deno ユニットテスト（Jest からは *_test.ts 命名により不可視）
// 実行: deno test supabase/functions/_shared/instagram_test.ts
import { assertEquals, assertNotEquals, assertStringIncludes } from 'jsr:@std/assert@1';
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
  type InstagramPost,
} from './instagram.ts';

const post = (permalink: string, timestamp: string, caption: string): InstagramPost => ({
  permalink,
  timestamp,
  caption,
});

const FETCHED_AT = '2026-08-03T17:00:00.000Z';

// --- parseInstagramUsername (H-2〜H-8) ---

Deno.test('parseInstagramUsername: 末尾スラッシュあり・なしの両方を解決する (H-2)', () => {
  assertEquals(parseInstagramUsername('https://www.instagram.com/kandamyoujin/'), 'kandamyoujin');
  assertEquals(
    parseInstagramUsername('https://www.instagram.com/fushimiinaritaisha_official'),
    'fushimiinaritaisha_official'
  );
});

Deno.test('parseInstagramUsername: ピリオドを含む username を解決する (H-3)', () => {
  assertEquals(
    parseInstagramUsername('https://www.instagram.com/takekoma.inari/'),
    'takekoma.inari'
  );
});

Deno.test('parseInstagramUsername: 大文字は小文字化される (H-4)', () => {
  assertEquals(parseInstagramUsername('https://www.instagram.com/KandaMyoujin/'), 'kandamyoujin');
});

Deno.test('parseInstagramUsername: 先頭の @ を除去する (H-4)', () => {
  assertEquals(parseInstagramUsername('https://www.instagram.com/@kandamyoujin/'), 'kandamyoujin');
});

Deno.test('parseInstagramUsername: クエリ・フラグメントを無視する (H-5)', () => {
  assertEquals(
    parseInstagramUsername('https://www.instagram.com/kandamyoujin/?hl=ja'),
    'kandamyoujin'
  );
  assertEquals(
    parseInstagramUsername('https://www.instagram.com/kandamyoujin/#top'),
    'kandamyoujin'
  );
});

Deno.test('parseInstagramUsername: www なし・m. サブドメインも解決する (H-6)', () => {
  assertEquals(parseInstagramUsername('https://instagram.com/kandamyoujin'), 'kandamyoujin');
  assertEquals(parseInstagramUsername('https://m.instagram.com/kandamyoujin/'), 'kandamyoujin');
});

Deno.test('parseInstagramUsername: 投稿 URL は null (H-7)', () => {
  assertEquals(parseInstagramUsername('https://www.instagram.com/p/DL1234abcd/'), null);
});

Deno.test('parseInstagramUsername: 予約語パスは null (H-7)', () => {
  assertEquals(parseInstagramUsername('https://www.instagram.com/explore/'), null);
});

Deno.test('parseInstagramUsername: パスセグメント 0 個は null (H-7)', () => {
  assertEquals(parseInstagramUsername('https://www.instagram.com/'), null);
});

Deno.test('parseInstagramUsername: instagram.com 以外のホストは null (H-8)', () => {
  assertEquals(parseInstagramUsername('https://x.com/kanda_myoujin'), null);
  assertEquals(parseInstagramUsername('https://instagram.com.evil.jp/kandamyoujin'), null);
});

Deno.test('parseInstagramUsername: http とパース不能文字列は null (H-8)', () => {
  assertEquals(parseInstagramUsername('http://www.instagram.com/kandamyoujin/'), null);
  assertEquals(parseInstagramUsername('not-a-url'), null);
});

// --- buildBusinessDiscoveryUrl (H-9, H-10) ---

Deno.test('buildBusinessDiscoveryUrl: v26.0 の business_discovery URL を組み立てる (H-9)', () => {
  const url = buildBusinessDiscoveryUrl('17841439672371375', 'kandamyoujin', 25);
  assertEquals(url.startsWith('https://graph.facebook.com/v26.0/17841439672371375?'), true);
  const decoded = decodeURIComponent(url);
  assertStringIncludes(decoded, 'business_discovery.username(kandamyoujin)');
  assertStringIncludes(decoded, 'media.limit(25)');
  assertStringIncludes(decoded, 'caption');
  assertStringIncludes(decoded, 'permalink');
  assertStringIncludes(decoded, 'timestamp');
});

Deno.test('buildBusinessDiscoveryUrl: access_token を含まない (H-10)', () => {
  const url = buildBusinessDiscoveryUrl('17841439672371375', 'kandamyoujin', 25);
  assertEquals(url.includes('access_token'), false);
});

// --- classifyGraphApiError (H-11〜H-14) ---

Deno.test('classifyGraphApiError: code 110 は not_business (H-11)', () => {
  assertEquals(classifyGraphApiError(400, { error: { code: 110 } }), 'not_business');
});

Deno.test('classifyGraphApiError: code 190 / 102 は token_invalid (H-12)', () => {
  assertEquals(classifyGraphApiError(400, { error: { code: 190 } }), 'token_invalid');
  assertEquals(classifyGraphApiError(400, { error: { code: 102 } }), 'token_invalid');
});

Deno.test('classifyGraphApiError: code 4/17/32/613 と HTTP 429 は rate_limited (H-13)', () => {
  assertEquals(classifyGraphApiError(400, { error: { code: 4 } }), 'rate_limited');
  assertEquals(classifyGraphApiError(400, { error: { code: 17 } }), 'rate_limited');
  assertEquals(classifyGraphApiError(400, { error: { code: 32 } }), 'rate_limited');
  assertEquals(classifyGraphApiError(400, { error: { code: 613 } }), 'rate_limited');
  assertEquals(classifyGraphApiError(429, {}), 'rate_limited');
});

Deno.test('classifyGraphApiError: 未知の code・パース不能は other (H-14)', () => {
  assertEquals(classifyGraphApiError(500, {}), 'other');
  assertEquals(classifyGraphApiError(400, { error: { code: 100 } }), 'other');
  assertEquals(classifyGraphApiError(400, null), 'other');
});

// --- parseBusinessDiscoveryPosts (H-15〜H-18) ---

const validEntry = (n: number) => ({
  permalink: `https://www.instagram.com/p/POST${n}/`,
  timestamp: `2026-07-0${n}T09:00:00+0000`,
  caption: `投稿${n}`,
  id: `1800${n}`,
});

Deno.test('parseBusinessDiscoveryPosts: レスポンス順どおりに返す (H-15)', () => {
  const json = {
    business_discovery: { media: { data: [validEntry(3), validEntry(1), validEntry(2)] } },
  };
  assertEquals(
    parseBusinessDiscoveryPosts(json).map(p => p.caption),
    ['投稿3', '投稿1', '投稿2']
  );
});

Deno.test(
  'parseBusinessDiscoveryPosts: 不正な permalink / timestamp の要素を破棄する (H-16)',
  () => {
    const json = {
      business_discovery: {
        media: {
          data: [
            { ...validEntry(1), permalink: 'https://evil.example/p/x/' },
            { ...validEntry(2), permalink: 12345 },
            { permalink: 'https://www.instagram.com/p/NOTS/', caption: 'timestamp欠落' },
            { ...validEntry(3), timestamp: 'not-a-date' },
            validEntry(4),
          ],
        },
      },
    };
    assertEquals(
      parseBusinessDiscoveryPosts(json).map(p => p.caption),
      ['投稿4']
    );
  }
);

Deno.test('parseBusinessDiscoveryPosts: caption 欠落は空文字で残す (H-17)', () => {
  const entry = {
    permalink: 'https://www.instagram.com/p/NOCAP/',
    timestamp: '2026-07-01T09:00:00+0000',
  };
  const json = { business_discovery: { media: { data: [entry] } } };
  const posts = parseBusinessDiscoveryPosts(json);
  assertEquals(posts.length, 1);
  assertEquals(posts[0].caption, '');
});

Deno.test('parseBusinessDiscoveryPosts: 構造欠落・null は空配列 (H-18)', () => {
  assertEquals(parseBusinessDiscoveryPosts({}), []);
  assertEquals(parseBusinessDiscoveryPosts({ business_discovery: {} }), []);
  assertEquals(parseBusinessDiscoveryPosts({ business_discovery: { media: { data: 'x' } } }), []);
  assertEquals(parseBusinessDiscoveryPosts(null), []);
});

// --- filterRecentPosts (H-19, H-20) ---

const NOW_MS = Date.parse('2026-08-03T00:00:00Z');

Deno.test('filterRecentPosts: 60日窓の内側を残し外側を除外する (H-19)', () => {
  const posts = [
    post('https://www.instagram.com/p/IN/', '2026-07-07T09:00:00+0000', '窓内'),
    post('https://www.instagram.com/p/OUT/', '2026-05-01T09:00:00+0000', '窓外'),
  ];
  assertEquals(
    filterRecentPosts(posts, NOW_MS, 60).map(p => p.caption),
    ['窓内']
  );
});

Deno.test('filterRecentPosts: パース不能な timestamp の投稿を破棄する', () => {
  const posts = [post('https://www.instagram.com/p/BAD/', 'not-a-date', '不正')];
  assertEquals(filterRecentPosts(posts, NOW_MS, 60), []);
});

Deno.test('filterRecentPosts: 入力配列を破壊せず順序を保つ (H-20)', () => {
  const posts = [
    post('https://www.instagram.com/p/A/', '2026-08-01T09:00:00+0000', '新'),
    post('https://www.instagram.com/p/OLD/', '2026-01-01T09:00:00+0000', '窓外'),
    post('https://www.instagram.com/p/B/', '2026-07-20T09:00:00+0000', '旧'),
  ];
  const filtered = filterRecentPosts(posts, NOW_MS, 60);
  assertEquals(
    filtered.map(p => p.caption),
    ['新', '旧']
  );
  assertEquals(posts.length, 3);
});

// --- toJstDate (H-21) ---

Deno.test('toJstDate: UTC 15:30 は JST 翌日 (H-21)', () => {
  assertEquals(toJstDate('2026-07-07T15:30:00+0000'), '2026-07-08');
});

Deno.test('toJstDate: UTC 09:00 は JST 同日 (H-21)', () => {
  assertEquals(toJstDate('2026-07-07T09:00:00+0000'), '2026-07-07');
});

Deno.test('toJstDate: パース不能は空文字 (H-21)', () => {
  assertEquals(toJstDate('bad'), '');
});

// --- buildInstagramContentKey (H-22, H-23) ---

Deno.test('buildInstagramContentKey: 順序が違っても同一文字列 (H-22)', () => {
  const a = [
    post('https://www.instagram.com/p/A/', '2026-07-01T00:00:00+0000', 'あ'),
    post('https://www.instagram.com/p/B/', '2026-07-02T00:00:00+0000', 'い'),
  ];
  const b = [a[1], a[0]];
  assertEquals(buildInstagramContentKey(a), buildInstagramContentKey(b));
});

Deno.test('buildInstagramContentKey: caption 1文字違いで異なる文字列 (H-23)', () => {
  const a = [post('https://www.instagram.com/p/A/', '2026-07-01T00:00:00+0000', 'あ')];
  const b = [post('https://www.instagram.com/p/A/', '2026-07-01T00:00:00+0000', 'ぃ')];
  assertNotEquals(buildInstagramContentKey(a), buildInstagramContentKey(b));
});

Deno.test('buildInstagramContentKey: 空配列は空文字 (H-23)', () => {
  assertEquals(buildInstagramContentKey([]), '');
});

Deno.test('buildInstagramContentKey: 入力配列の順序を破壊しない', () => {
  const posts = [
    post('https://www.instagram.com/p/B/', '2026-07-02T00:00:00+0000', 'い'),
    post('https://www.instagram.com/p/A/', '2026-07-01T00:00:00+0000', 'あ'),
  ];
  buildInstagramContentKey(posts);
  assertEquals(
    posts.map(p => p.caption),
    ['い', 'あ']
  );
});

// --- buildInstagramUserMessage (H-24〜H-27) ---

const MESSAGE_POSTS = [
  post('https://www.instagram.com/p/A/', '2026-07-08T00:00:00+0000', '七夕限定御朱印のお知らせ'),
  post('https://www.instagram.com/p/B/', '2026-07-01T00:00:00+0000', ''),
];

Deno.test('buildInstagramUserMessage: ヘッダと投稿ブロックの固定書式 (H-24)', () => {
  const message = buildInstagramUserMessage(
    '2026-08-03',
    'kandamyoujin',
    MESSAGE_POSTS,
    1500,
    30000
  );
  assertStringIncludes(message, '【今日の日付】2026-08-03');
  assertStringIncludes(message, '【アカウント】@kandamyoujin');
  assertStringIncludes(message, '【投稿数】2');
  assertStringIncludes(message, '--- 投稿 0 ---');
  assertStringIncludes(message, '--- 投稿 1 ---');
  assertStringIncludes(message, '【投稿日】2026-07-08');
});

Deno.test('buildInstagramUserMessage: 空 caption は（本文なし）になる (H-25)', () => {
  const message = buildInstagramUserMessage(
    '2026-08-03',
    'kandamyoujin',
    MESSAGE_POSTS,
    1500,
    30000
  );
  assertStringIncludes(message, '（本文なし）');
});

Deno.test('buildInstagramUserMessage: caption を maxCaptionChars で切り詰める (H-26)', () => {
  const posts = [
    post('https://www.instagram.com/p/A/', '2026-07-08T00:00:00+0000', 'あいうえおかきく'),
  ];
  const message = buildInstagramUserMessage('2026-08-03', 'x', posts, 5, 30000);
  assertStringIncludes(message, 'あいうえお');
  assertEquals(message.includes('あいうえおか'), false);
});

Deno.test('buildInstagramUserMessage: maxTotalChars 超過は末尾の投稿から落ちる (H-27)', () => {
  const posts = [
    post('https://www.instagram.com/p/A/', '2026-07-08T00:00:00+0000', '先頭の投稿'),
    post('https://www.instagram.com/p/B/', '2026-07-01T00:00:00+0000', '末尾の投稿'),
  ];
  const full = buildInstagramUserMessage('2026-08-03', 'x', posts, 1500, 30000);
  const truncated = buildInstagramUserMessage('2026-08-03', 'x', posts, 1500, full.length - 1);
  assertStringIncludes(truncated, '--- 投稿 0 ---');
  assertEquals(truncated.includes('--- 投稿 1 ---'), false);
});

Deno.test('buildInstagramUserMessage: 【投稿数】は切り詰め前の posts.length を書く (H-27)', () => {
  const posts = [
    post('https://www.instagram.com/p/A/', '2026-07-08T00:00:00+0000', '先頭の投稿'),
    post('https://www.instagram.com/p/B/', '2026-07-01T00:00:00+0000', '末尾の投稿'),
  ];
  const full = buildInstagramUserMessage('2026-08-03', 'x', posts, 1500, 30000);
  const truncated = buildInstagramUserMessage('2026-08-03', 'x', posts, 1500, full.length - 1);
  assertStringIncludes(truncated, '【投稿数】2');
});

// --- normalizeInstagramItems (H-28〜H-32) ---

const NORMALIZE_POSTS = [
  post('https://www.instagram.com/p/ZERO/', '2026-07-08T00:00:00+0000', '七夕限定御朱印'),
  post('https://www.instagram.com/p/ONE/', '2026-07-01T00:00:00+0000', '夏詣'),
];

Deno.test('normalizeInstagramItems: post_index から permalink を出典にする (H-28)', () => {
  const raw = [{ post_index: 0, name: '七夕限定御朱印', period: '7月1日〜7月7日' }];
  const items = normalizeInstagramItems(
    raw,
    NORMALIZE_POSTS,
    'instagram:kandamyoujin',
    FETCHED_AT,
    10
  );
  assertEquals(items.length, 1);
  assertEquals(items[0].source_url, 'https://www.instagram.com/p/ZERO/');
  assertEquals(items[0].fetched_at, FETCHED_AT);
  assertEquals(items[0].source_key, 'instagram:kandamyoujin');
});

Deno.test('normalizeInstagramItems: Claude の source_url / source_key を採用しない (H-29)', () => {
  const raw = [
    {
      post_index: 1,
      name: '夏詣限定御朱印',
      source_url: 'https://evil.example/fake',
      source_key: 'instagram:evil',
      fetched_at: '1999-01-01T00:00:00Z',
    },
  ];
  const items = normalizeInstagramItems(
    raw,
    NORMALIZE_POSTS,
    'instagram:kandamyoujin',
    FETCHED_AT,
    10
  );
  assertEquals(items[0].source_url, 'https://www.instagram.com/p/ONE/');
  assertEquals(items[0].source_key, 'instagram:kandamyoujin');
  assertEquals(items[0].fetched_at, FETCHED_AT);
});

Deno.test(
  'normalizeInstagramItems: post_index が範囲外・非整数・欠落の item を破棄する (H-30)',
  () => {
    const raw = [
      { post_index: 2, name: '範囲外の限定御朱印' },
      { post_index: -1, name: '負の限定御朱印' },
      { post_index: '0', name: '文字列indexの限定御朱印' },
      { post_index: 1.5, name: '非整数の限定御朱印' },
      { name: 'index欠落の限定御朱印' },
    ];
    assertEquals(normalizeInstagramItems(raw, NORMALIZE_POSTS, 'instagram:x', FETCHED_AT, 10), []);
  }
);

Deno.test('normalizeInstagramItems: isLikelyGoshuin ガードで授与品を破棄する (H-31)', () => {
  const raw = [{ post_index: 0, name: '七夕守', description: '8月7日まで授与' }];
  assertEquals(normalizeInstagramItems(raw, NORMALIZE_POSTS, 'instagram:x', FETCHED_AT, 10), []);
});

Deno.test('normalizeInstagramItems: maxItems で件数を切る (H-32)', () => {
  const raw = [
    { post_index: 0, name: '限定御朱印a' },
    { post_index: 0, name: '限定御朱印b' },
    { post_index: 1, name: '限定御朱印c' },
  ];
  assertEquals(
    normalizeInstagramItems(raw, NORMALIZE_POSTS, 'instagram:x', FETCHED_AT, 2).length,
    2
  );
});
