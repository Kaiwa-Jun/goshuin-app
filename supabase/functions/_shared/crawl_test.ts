// Deno ユニットテスト（Jest からは *_test.ts 命名により不可視）
// 実行: deno test supabase/functions/_shared/crawl_test.ts
import { assertEquals, assertNotEquals } from 'jsr:@std/assert@1';
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
} from './crawl.ts';

// --- isServiceRoleAuthorized (H-2) ---

Deno.test('isServiceRoleAuthorized: 正しい Bearer キーで true', () => {
  assertEquals(isServiceRoleAuthorized('Bearer KEY', 'KEY'), true);
});

Deno.test('isServiceRoleAuthorized: 異なるキーで false', () => {
  assertEquals(isServiceRoleAuthorized('Bearer OTHER', 'KEY'), false);
});

Deno.test('isServiceRoleAuthorized: ヘッダ無しで false', () => {
  assertEquals(isServiceRoleAuthorized(null, 'KEY'), false);
});

Deno.test('isServiceRoleAuthorized: サービスキーが空文字なら常に false', () => {
  assertEquals(isServiceRoleAuthorized('Bearer ', ''), false);
});

// --- isAllowedSourceUrl (H-3) ---

Deno.test('isAllowedSourceUrl: https は true', () => {
  assertEquals(isAllowedSourceUrl('https://example.jp/a'), true);
});

Deno.test('isAllowedSourceUrl: http は false', () => {
  assertEquals(isAllowedSourceUrl('http://example.jp/a'), false);
});

Deno.test('isAllowedSourceUrl: file スキームは false', () => {
  assertEquals(isAllowedSourceUrl('file:///etc/passwd'), false);
});

Deno.test('isAllowedSourceUrl: localhost は false', () => {
  assertEquals(isAllowedSourceUrl('https://localhost/a'), false);
});

Deno.test('isAllowedSourceUrl: 127.0.0.1 は false', () => {
  assertEquals(isAllowedSourceUrl('https://127.0.0.1/a'), false);
});

Deno.test('isAllowedSourceUrl: プライベート IP は false', () => {
  assertEquals(isAllowedSourceUrl('https://192.168.1.1/a'), false);
  assertEquals(isAllowedSourceUrl('https://10.0.0.1/a'), false);
  assertEquals(isAllowedSourceUrl('https://172.16.0.1/a'), false);
  assertEquals(isAllowedSourceUrl('https://172.31.9.9/a'), false);
  assertEquals(isAllowedSourceUrl('https://169.254.1.1/a'), false);
  assertEquals(isAllowedSourceUrl('https://0.0.0.0/a'), false);
});

Deno.test('isAllowedSourceUrl: 172.32.* はプライベートでないので true', () => {
  assertEquals(isAllowedSourceUrl('https://172.32.0.1/a'), true);
});

Deno.test('isAllowedSourceUrl: パース不能な文字列は false', () => {
  assertEquals(isAllowedSourceUrl('not-a-url'), false);
});

// --- isCrawlableContentType (H-4) ---

Deno.test('isCrawlableContentType: text/html + charset は true', () => {
  assertEquals(isCrawlableContentType('text/html; charset=UTF-8'), true);
});

Deno.test('isCrawlableContentType: 大文字混在でも true', () => {
  assertEquals(isCrawlableContentType('Text/HTML'), true);
});

Deno.test('isCrawlableContentType: RSS/Atom/XML 系は true', () => {
  assertEquals(isCrawlableContentType('application/rss+xml'), true);
  assertEquals(isCrawlableContentType('application/atom+xml'), true);
  assertEquals(isCrawlableContentType('application/xml'), true);
  assertEquals(isCrawlableContentType('text/xml'), true);
  assertEquals(isCrawlableContentType('application/xhtml+xml'), true);
});

Deno.test('isCrawlableContentType: PDF は false', () => {
  assertEquals(isCrawlableContentType('application/pdf'), false);
});

Deno.test('isCrawlableContentType: null は false', () => {
  assertEquals(isCrawlableContentType(null), false);
});

// --- htmlToText (H-5, H-6, H-7) ---

Deno.test('htmlToText: script/style を除去し閉じタグを改行にする', () => {
  assertEquals(
    htmlToText('<style>a{}</style><script>x()</script><p>あ</p><p>い</p>', 100),
    'あ\nい'
  );
});

Deno.test('htmlToText: 実体参照の復元と空白の畳み込み', () => {
  assertEquals(htmlToText('<p>a &amp; b&nbsp;c</p>', 100), 'a & b c');
});

Deno.test('htmlToText: maxChars で切り詰める', () => {
  assertEquals(htmlToText('<p>abcdef</p>', 3).length, 3);
});

Deno.test('htmlToText: HTML コメントを除去する', () => {
  assertEquals(htmlToText('<p>前<!-- 消える -->後</p>', 100), '前後');
});

Deno.test('htmlToText: 空行を除去して連結する', () => {
  assertEquals(htmlToText('<div>1</div><div>  </div><div>2</div>', 100), '1\n2');
});

// --- sha256Hex (H-8) ---

Deno.test('sha256Hex: 同一入力は同一ハッシュ・64桁小文字16進', async () => {
  const a = await sha256Hex('hello');
  const b = await sha256Hex('hello');
  assertEquals(a, b);
  assertEquals(/^[0-9a-f]{64}$/.test(a), true);
});

Deno.test('sha256Hex: 1文字違えば異なるハッシュ', async () => {
  assertNotEquals(await sha256Hex('hello'), await sha256Hex('hellp'));
});

// --- parseClaudeJson (H-9) ---

Deno.test('parseClaudeJson: コードフェンス付き JSON をパースできる', () => {
  const text = '```json\n{"items": [{"name": "夏詣"}]}\n```';
  assertEquals(parseClaudeJson(text), { items: [{ name: '夏詣' }] });
});

Deno.test('parseClaudeJson: 素の JSON をパースできる', () => {
  assertEquals(parseClaudeJson('{"items": []}'), { items: [] });
});

Deno.test('parseClaudeJson: 壊れた JSON は空 items', () => {
  assertEquals(parseClaudeJson('{oops'), { items: [] });
});

Deno.test('parseClaudeJson: items が非配列なら空 items', () => {
  assertEquals(parseClaudeJson('{"items": "x"}'), { items: [] });
});

// --- normalizeItems (H-10) ---

const FETCHED_AT = '2026-08-03T17:00:00.000Z';
const SOURCE_URL = 'https://example.jp/goshuin';

Deno.test('normalizeItems: name 欠落・空の要素を破棄する', () => {
  const raw = [{ name: '' }, { period: '7月' }, { name: '  夏詣御朱印  ' }];
  const items = normalizeItems(raw, SOURCE_URL, FETCHED_AT, 10);
  assertEquals(items.length, 1);
  assertEquals(items[0].name, '夏詣御朱印');
});

Deno.test(
  'normalizeItems: source_url と fetched_at を引数値で上書きする（Claude の値を採用しない）',
  () => {
    const raw = [
      { name: '夏詣御朱印', source_url: 'https://evil.example/fake', fetched_at: '1999-01-01' },
    ];
    const items = normalizeItems(raw, SOURCE_URL, FETCHED_AT, 10);
    assertEquals(items[0].source_url, SOURCE_URL);
    assertEquals(items[0].fetched_at, FETCHED_AT);
  }
);

Deno.test('normalizeItems: 不正形式の period_end は null', () => {
  const raw = [{ name: '夏詣御朱印', period_end: '2026/08/31' }];
  assertEquals(normalizeItems(raw, SOURCE_URL, FETCHED_AT, 10)[0].period_end, null);
});

Deno.test('normalizeItems: 正しい形式の period_start/period_end は保持', () => {
  const raw = [{ name: '夏詣御朱印', period_start: '2026-07-01', period_end: '2026-08-31' }];
  const item = normalizeItems(raw, SOURCE_URL, FETCHED_AT, 10)[0];
  assertEquals(item.period_start, '2026-07-01');
  assertEquals(item.period_end, '2026-08-31');
});

Deno.test('normalizeItems: maxItems で件数を切る', () => {
  const raw = [{ name: '朱印a' }, { name: '朱印b' }, { name: '朱印c' }];
  assertEquals(normalizeItems(raw, SOURCE_URL, FETCHED_AT, 2).length, 2);
});

Deno.test('normalizeItems: 授与品（朱印/集印の言及なし）を破棄する', () => {
  const raw = [
    { name: '御神矢（小）', description: '初穂料：1500円' },
    { name: '干支土鈴', description: '初穂料：1500円' },
    { name: '夏詣限定御朱印', description: '書き置きのみ' },
  ];
  const items = normalizeItems(raw, SOURCE_URL, FETCHED_AT, 10);
  assertEquals(
    items.map(i => i.name),
    ['夏詣限定御朱印']
  );
});

Deno.test('normalizeItems: 御朱印帳・挟み紙は name に朱印を含んでも破棄する', () => {
  const raw = [
    { name: '春限定御朱印帳', description: '初穂料：3500円' },
    { name: '4月限定挟み紙', description: null },
  ];
  assertEquals(normalizeItems(raw, SOURCE_URL, FETCHED_AT, 10), []);
});

Deno.test('normalizeItems: name に朱印が無くても description の言及で残す', () => {
  const raw = [{ name: '夏詣二〇二六', description: '期間中、限定御朱印を頒布します' }];
  assertEquals(normalizeItems(raw, SOURCE_URL, FETCHED_AT, 10).length, 1);
});

Deno.test('normalizeItems: period が非文字列なら null、文字列なら trim', () => {
  const raw = [
    { name: '朱印a', period: 123 },
    { name: '朱印b', period: ' 7月中 ' },
  ];
  const items = normalizeItems(raw, SOURCE_URL, FETCHED_AT, 10);
  assertEquals(items[0].period, null);
  assertEquals(items[1].period, '7月中');
});

// --- mergeLimitedGoshuinItems (H-11) ---

const item = (name: string, source_url: string): LimitedGoshuinItem => ({
  name,
  period: null,
  period_start: null,
  period_end: null,
  description: null,
  source_url,
  fetched_at: FETCHED_AT,
});

Deno.test(
  'mergeLimitedGoshuinItems: 同一 source_url の既存要素だけ置き換え、他ソースは保持',
  () => {
    const existing = [item('旧A', 'https://a.jp'), item('B', 'https://b.jp')];
    const merged = mergeLimitedGoshuinItems(existing, 'https://a.jp', [
      item('新A', 'https://a.jp'),
    ]);
    assertEquals(
      merged.map(i => i.name),
      ['B', '新A']
    );
  }
);

Deno.test('mergeLimitedGoshuinItems: 入力配列を破壊しない', () => {
  const existing = [item('旧A', 'https://a.jp')];
  const incoming = [item('新A', 'https://a.jp')];
  mergeLimitedGoshuinItems(existing, 'https://a.jp', incoming);
  assertEquals(existing.length, 1);
  assertEquals(existing[0].name, '旧A');
  assertEquals(incoming.length, 1);
});

Deno.test('mergeLimitedGoshuinItems: incoming が空なら該当ソースの要素が消える', () => {
  const existing = [item('旧A', 'https://a.jp'), item('B', 'https://b.jp')];
  const merged = mergeLimitedGoshuinItems(existing, 'https://a.jp', []);
  assertEquals(
    merged.map(i => i.name),
    ['B']
  );
});

// --- isPastDeadline (H-12) ---

Deno.test('isPastDeadline: 予算ちょうどで true', () => {
  assertEquals(isPastDeadline(0, 100_000, 100_000), true);
});

Deno.test('isPastDeadline: 予算未満で false', () => {
  assertEquals(isPastDeadline(0, 99_999, 100_000), false);
});
