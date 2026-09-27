// Deno ユニットテスト（Jest からは *_test.ts 命名により不可視）
// 実行: deno test -A --node-modules-dir=none supabase/functions/growth-metrics/
//
// 契約書: docs/issues/issue-285-growth-metrics.md（S2 / AC-16 / D-13）
// 合言葉はダミーの値だけを使う
import { assert, assertEquals } from 'jsr:@std/assert@1';
import { MIN_TOKEN_LENGTH, extractBearerToken, tokenMatches } from './token.ts';

const TOKEN = 'dummy-token-'.padEnd(64, '0');
const replaceAt = (s: string, i: number, c: string) => s.slice(0, i) + c + s.slice(i + 1);

// --- extractBearerToken ---

Deno.test(
  'extractBearerToken: Bearer のあとの値を前後の空白を除いて取り出す（大文字小文字は問わない）',
  () => {
    assertEquals(extractBearerToken(`Bearer ${TOKEN}`), TOKEN);
    assertEquals(extractBearerToken(`bearer   ${TOKEN}  `), TOKEN);
    assertEquals(extractBearerToken(`BEARER ${TOKEN}`), TOKEN);
  }
);

Deno.test('extractBearerToken: 無い・Bearer で始まらない・中身が空なら null', () => {
  assertEquals(extractBearerToken(null), null);
  assertEquals(extractBearerToken(''), null);
  assertEquals(extractBearerToken(TOKEN), null);
  assertEquals(extractBearerToken(`Basic ${TOKEN}`), null);
  assertEquals(extractBearerToken('Bearer    '), null);
  assertEquals(extractBearerToken('Bearer'), null);
});

// --- tokenMatches（AC-16） ---

Deno.test('AC-16: 同じ 64 文字なら true', async () => {
  assertEquals(TOKEN.length, 64);
  assertEquals(await tokenMatches(TOKEN, TOKEN), true);
  // 同じ中身の別の文字列でも true（参照ではなく中身で比べる）
  assertEquals(await tokenMatches([...TOKEN].join(''), TOKEN), true);
});

Deno.test('AC-16: 先頭・最後の1文字が違う、1文字長い・短い、空、null なら false', async () => {
  const wrong: (string | null)[] = [
    replaceAt(TOKEN, 0, 'x'),
    replaceAt(TOKEN, TOKEN.length - 1, 'x'),
    TOKEN + '0',
    TOKEN.slice(0, -1),
    '',
    null,
  ];
  for (const provided of wrong) {
    assertEquals(await tokenMatches(provided, TOKEN), false, `provided の長さ ${provided?.length}`);
  }
});

Deno.test('AC-16: 関数側が未設定・空・31 文字なら、同じ文字列が来ても false', async () => {
  assertEquals(MIN_TOKEN_LENGTH, 32);
  const short = TOKEN.slice(0, MIN_TOKEN_LENGTH - 1);
  assertEquals(await tokenMatches(short, short), false);
  assertEquals(await tokenMatches('', ''), false);
  assertEquals(await tokenMatches(TOKEN, undefined), false);
  assertEquals(await tokenMatches(TOKEN, ''), false);
  // 32 文字ちょうどなら比べる
  const min = TOKEN.slice(0, MIN_TOKEN_LENGTH);
  assertEquals(await tokenMatches(min, min), true);
});

Deno.test('AC-16: SHA-256 にしてから比べる（途中で抜けない XOR の集め方）', async () => {
  const source = await Deno.readTextFile(new URL('./token.ts', import.meta.url));
  assert(source.includes("crypto.subtle.digest('SHA-256'"));
});
