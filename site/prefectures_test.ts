// Deno テスト（都道府県の表。契約書 docs/issues/issue-324-homepage.md AC-4）
import { assert, assertEquals } from 'jsr:@std/assert@1';

import { realInputs } from './fixtures/load.ts';
import { PREFECTURES, prefectureByName, REGIONS } from './prefectures.ts';

const JIS = [
  ['北海道', 'hokkaido'],
  ['青森県', 'aomori'],
  ['岩手県', 'iwate'],
  ['宮城県', 'miyagi'],
  ['秋田県', 'akita'],
  ['山形県', 'yamagata'],
  ['福島県', 'fukushima'],
  ['茨城県', 'ibaraki'],
  ['栃木県', 'tochigi'],
  ['群馬県', 'gunma'],
  ['埼玉県', 'saitama'],
  ['千葉県', 'chiba'],
  ['東京都', 'tokyo'],
  ['神奈川県', 'kanagawa'],
  ['新潟県', 'niigata'],
  ['富山県', 'toyama'],
  ['石川県', 'ishikawa'],
  ['福井県', 'fukui'],
  ['山梨県', 'yamanashi'],
  ['長野県', 'nagano'],
  ['岐阜県', 'gifu'],
  ['静岡県', 'shizuoka'],
  ['愛知県', 'aichi'],
  ['三重県', 'mie'],
  ['滋賀県', 'shiga'],
  ['京都府', 'kyoto'],
  ['大阪府', 'osaka'],
  ['兵庫県', 'hyogo'],
  ['奈良県', 'nara'],
  ['和歌山県', 'wakayama'],
  ['鳥取県', 'tottori'],
  ['島根県', 'shimane'],
  ['岡山県', 'okayama'],
  ['広島県', 'hiroshima'],
  ['山口県', 'yamaguchi'],
  ['徳島県', 'tokushima'],
  ['香川県', 'kagawa'],
  ['愛媛県', 'ehime'],
  ['高知県', 'kochi'],
  ['福岡県', 'fukuoka'],
  ['佐賀県', 'saga'],
  ['長崎県', 'nagasaki'],
  ['熊本県', 'kumamoto'],
  ['大分県', 'oita'],
  ['宮崎県', 'miyazaki'],
  ['鹿児島県', 'kagoshima'],
  ['沖縄県', 'okinawa'],
];

Deno.test('AC-4: 都道府県の表は 47 行・JIS の順・契約書のローマ字と同じ', () => {
  assertEquals(
    PREFECTURES.map(p => [p.name, p.slug]),
    JIS
  );
  assertEquals(new Set(PREFECTURES.map(p => p.slug)).size, 47);
});

Deno.test('AC-4: 地方の区切りは 8 つで、表の順にまとまる', () => {
  assertEquals(REGIONS, ['北海道', '東北', '関東', '中部', '近畿', '中国', '四国', '九州・沖縄']);
  const order = PREFECTURES.map(p => REGIONS.indexOf(p.region));
  assert(order.every(i => i >= 0));
  assert(order.every((i, k) => k === 0 || order[k - 1] <= i));
  assertEquals(
    REGIONS.map(r => PREFECTURES.filter(p => p.region === r).length),
    [1, 6, 7, 9, 7, 5, 4, 8]
  );
});

Deno.test('AC-4: seed の都道府県は全部この表にある', async () => {
  const { rows } = await realInputs();
  for (const r of rows) assert(prefectureByName(r.prefecture), `${r.name}（${r.prefecture}）`);
  assertEquals(new Set(rows.map(r => r.prefecture)).size, 47);
});
