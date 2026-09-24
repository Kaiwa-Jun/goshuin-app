// Deno ユニットテスト。実行: deno test supabase/functions/_shared/
// 契約書: docs/issues/issue-248-spot-add-research.md（S1）
import { assertEquals } from 'jsr:@std/assert@1';
import cases from './spot_name_cases.json' with { type: 'json' };
import { inPrefectureBounds, PREFECTURE_BOUNDS } from './prefectures.ts';
import { cleanSpotName } from './spotResearch.ts';
import {
  countIndependentDomains,
  hasSimilarActiveNearby,
  isSimilarName,
  judgePublish,
  typeConflicts,
} from './spotRules.ts';

Deno.test('似た名前の表（Jest と共用）', () => {
  for (const c of cases) assertEquals(isSimilarName(c.a, c.b), c.similar, `${c.a} / ${c.b}`);
});

Deno.test('P-1: 独立したドメインを数える', () => {
  assertEquals(countIndependentDomains(['https://www.example.jp/a', 'https://example.jp/b']), 1);
  assertEquals(countIndependentDomains(['https://a.sakura.ne.jp', 'https://b.sakura.ne.jp']), 1);
  assertEquals(countIndependentDomains(['https://jinja.or.jp', 'https://city.osaki.miyagi.jp']), 2);
  assertEquals(countIndependentDomains(['http://a.example.com', 'https://localhost/x']), 0);
  // 末尾のドット・大文字で同じ運営を2つに数えさせない。IP は数えない
  assertEquals(countIndependentDomains(['https://example.jp/a', 'https://EXAMPLE.jp./b']), 1);
  assertEquals(countIndependentDomains(['https://8.8.8.8/a', 'https://1.1.1.1/b']), 0);
});

Deno.test('P-2: 都道府県の範囲（validate_spots.sql と同じ値）', () => {
  assertEquals(PREFECTURE_BOUNDS['宮城県'], [37.7, 39.0, 140.2, 141.7]);
  assertEquals(PREFECTURE_BOUNDS['東京都'], [20.4, 35.9, 136.0, 154.0]);
  assertEquals(PREFECTURE_BOUNDS['北海道'], [41.3, 45.6, 139.3, 145.8]);
  assertEquals(PREFECTURE_BOUNDS['沖縄県'], [24.0, 27.9, 122.9, 131.3]);
  assertEquals(Object.keys(PREFECTURE_BOUNDS).length, 47);
  assertEquals(inPrefectureBounds('宮城県', 38.4811, 141.0957), true);
  assertEquals(inPrefectureBounds('宮城県', 35.68, 139.76), false);
  assertEquals(inPrefectureBounds('存在しない県', 38.4, 141.0), false);
});

// 緯度 1 度 ≒ 111.195km（haversine, R=6371km）
const M = 1 / 111195;

Deno.test('P-3: 300m 以内の似た名前の active', () => {
  const at = (m: number, name = '鹿島神社') => [{ name, lat: 38 + m * M, lng: 141 }];
  assertEquals(hasSimilarActiveNearby('鹿島台神社', 38, 141, at(299)), true);
  assertEquals(hasSimilarActiveNearby('鹿島台神社', 38, 141, at(301)), false);
  assertEquals(hasSimilarActiveNearby('鹿島台神社', 38, 141, at(10, '瑞鳳殿')), false);
});

Deno.test('見えない文字を混ぜても、同じ名前として扱う', () => {
  assertEquals(isSimilarName('鹿島\u200B台神社', '鹿島台神社'), true);
  assertEquals(
    hasSimilarActiveNearby('瑞\u200D鳳殿', 38, 141, [{ name: '瑞鳳殿', lat: 38, lng: 141 }]),
    true
  );
  assertEquals(typeConflicts('東福\u200B寺', 'shrine'), true);
  // 異体字セレクタ（IVS）・ハングルの空白
  assertEquals(isSimilarName('瑞鳳殿\uDB40\uDD00', '瑞鳳殿'), true);
  assertEquals(isSimilarName('瑞\u3164鳳殿', '瑞鳳殿'), true);
});

Deno.test('P-4 は括弧の中も見る', () => {
  assertEquals(typeConflicts('東福（寺）', 'shrine'), true);
  assertEquals(typeConflicts('鹿島台（神社）', 'temple'), true);
});

Deno.test('cleanSpotName は見えない文字を落とし、1〜50 文字だけ通す', () => {
  assertEquals(cleanSpotName(' 鹿島\u200B台神社 '), '鹿島台神社');
  assertEquals(cleanSpotName('\u200B\u3164'), null);
  assertEquals(cleanSpotName('あ'.repeat(51)), null);
  assertEquals(cleanSpotName(3), null);
});

Deno.test('P-4: 名前と種別の矛盾', () => {
  assertEquals(typeConflicts('東福寺', 'shrine'), true);
  assertEquals(typeConflicts('鹿島台神社', 'temple'), true);
  assertEquals(typeConflicts('鹿島神宮', 'temple'), true);
  assertEquals(typeConflicts('宮城野八幡寺', 'temple'), false);
  assertEquals(typeConflicts('鹿島台神社', 'shrine'), false);
});

const ok = {
  name: '鹿島台神社',
  type: 'shrine' as const,
  prefecture: '宮城県',
  lat: 38.4803,
  lng: 141.0894,
  sourceUrls: ['https://jinja.or.jp/a', 'https://city.osaki.miyagi.jp/b'],
  nearbyActives: [],
};

Deno.test('judgePublish: すべて合格なら active', () => {
  assertEquals(judgePublish(ok), { status: 'active', failed: [] });
});

Deno.test('judgePublish: 1つ欠けると pending で、その番号', () => {
  assertEquals(judgePublish({ ...ok, sourceUrls: ['https://jinja.or.jp/a'] }).failed, ['P-1']);
  assertEquals(judgePublish({ ...ok, lat: 35.68, lng: 139.76 }).failed, ['P-2']);
  assertEquals(
    judgePublish({ ...ok, nearbyActives: [{ name: '鹿島神社', lat: 38.4804, lng: 141.0894 }] })
      .failed,
    ['P-3']
  );
  assertEquals(judgePublish({ ...ok, type: 'temple' }), { status: 'pending', failed: ['P-4'] });
});

Deno.test('judgePublish: 手入力は常に pending', () => {
  assertEquals(judgePublish({ ...ok, manual: true }), { status: 'pending', failed: ['manual'] });
});
