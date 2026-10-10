// Deno テスト（受付時間の seed の読み方と formatHours。契約書 docs/issues/issue-324-homepage.md AC-5〜7）
import { assert, assertEquals } from 'jsr:@std/assert@1';

import type { SeedRow } from '../supabase/scripts/spot-wikidata/match.ts';
import { realInputs, errorOf } from './fixtures/load.ts';
import { formatHours, hostOf, parseReceptionHours, yearMonthOf } from './hours.ts';

Deno.test(
  'AC-5: 本物の受付時間の seed は 12 行（ファイルの順）。explicit 8・proxy 4・金蛇水神社なし',
  async () => {
    const { rows, hoursText } = await realInputs();
    const hours = parseReceptionHours(hoursText, rows);
    assertEquals(hours.length, 12);
    const explicit = hours.filter(h => h.kind === 'explicit');
    assertEquals(
      explicit.map(h => [h.name, h.prefecture, h.open, h.close, h.notes, h.url]),
      [
        [
          '平等院',
          '京都府',
          '09:10',
          '17:00',
          '受付終了16:45・2026年8月時点／公式サイト',
          'https://www.byodoin.or.jp/guide/goshuin/',
        ],
        [
          '宮城縣護國神社',
          '宮城県',
          '09:00',
          '16:00',
          '2026年8月時点／公式サイト',
          'https://gokokujinja.org/kitou/goshuin.html',
        ],
        [
          '竹駒神社',
          '宮城県',
          '09:00',
          '16:00',
          '社務所祈祷受付にて頒布・2026年8月時点／公式サイト',
          'https://takekomajinja.jp/s/jyuyo.html',
        ],
        [
          '浅草寺',
          '東京都',
          '08:00',
          '16:30',
          '2026年8月時点／公式サイト',
          'https://www.senso-ji.jp/visit/jumotsu3.html',
        ],
        [
          '日枝神社',
          '東京都',
          '08:00',
          '16:00',
          '2026年8月時点／公式サイト',
          'https://www.hiejinja.net/',
        ],
        [
          '東京大神宮',
          '東京都',
          '09:00',
          '17:00',
          '2026年8月時点／公式サイト',
          'https://www.tokyodaijingu.or.jp/',
        ],
        [
          '明治神宮',
          '東京都',
          '09:00',
          null,
          '長殿にて9:00〜閉門まで（閉門時刻は月により変動）・2026年8月時点／公式サイト',
          'https://www.meijijingu.or.jp/sanpai/2.php',
        ],
        [
          '瑞巌寺',
          '宮城県',
          '08:30',
          null,
          '最終受付 4-9月16:30／10・3月16:00／11・2月15:30／12-1月15:00・2026年8月時点／公式サイト',
          'https://www.zuiganji.or.jp/guide/',
        ],
      ]
    );
    assertEquals(
      hours.filter(h => h.kind === 'proxy').map(h => `${h.name}（${h.prefecture}）`),
      ['湯島天満宮（東京都）', '八坂神社（京都府）', '北野天満宮（京都府）', '浅草神社（東京都）']
    );
    assert(!hours.some(h => h.name === '金蛇水神社'));
    assert(hours.every(h => h.lastReportedAt === '2026-08-11T00:00:00Z'));
    // 寺社は seed の行（idx）に決まる
    for (const h of hours) {
      const r = rows.find(x => x.idx === h.idx)!;
      assertEquals([r.name, r.prefecture], [h.name, h.prefecture]);
    }
  }
);

// --- AC-6: フィクスチャ ---

function row(idx: number, name: string, prefecture: string): SeedRow {
  return {
    idx,
    name,
    prefecture,
    type: 'shrine',
    address: `${prefecture}どこか1-1`,
    rank: 5,
    file: 'x.sql',
    line: idx,
    lat: 35,
    lng: 139,
  };
}

const ROWS = [
  row(1, '甲神社', '東京都'),
  row(2, '乙神社', '京都府'),
  row(3, '乙神社', '東京都'),
  row(4, '丙寺', '京都府'),
  row(5, '丙寺', '京都府'),
];

const value = (uuid: string, json: string) =>
  `  ('${uuid}', 'reception_hours',\n   '${json}'::jsonb,\n   '{}', 0.7, '2026-08-11T00:00:00Z'),\n`;
const U1 = '00000000-0000-0000-0000-000000000001';
const U2 = '00000000-0000-0000-0000-000000000002';

const GOOD =
  '  -- explicit: 明記\n' +
  '  -- 甲神社（東京）https://a.example.jp/x 「朱印所」\n' +
  '  -- ⚠️ 補いのコメント（名前ではない）\n' +
  value(U1, '{"open":"09:00","notes":"n1"}') +
  '  -- proxy: 社務所\n' +
  '  -- ⚠️ 乙神社（京都）https://b.example.jp/ は【除外】\n' +
  "  -- ('00000000-0000-0000-0000-000000000009', 'reception_hours',\n" +
  `  --  '{"open":"08:00","close":"16:00","notes":"x"}'::jsonb,\n` +
  `  --  '{}', 0.5, '2026-08-11T00:00:00Z'),\n` +
  '  -- 乙神社（東京）https://c.example.jp/\n' +
  value(U2, '{"open":"08:00","close":"16:30","notes":"n2"}');

Deno.test('AC-6: 名前のコメントのあとの値の行を読み、コメントアウトした値の行は読まない', () => {
  const hours = parseReceptionHours(GOOD, ROWS);
  assertEquals(
    hours.map(h => [h.idx, h.kind, h.name, h.prefecture, h.open, h.close, h.notes, h.url]),
    [
      [1, 'explicit', '甲神社', '東京都', '09:00', null, 'n1', 'https://a.example.jp/x'],
      [3, 'proxy', '乙神社', '東京都', '08:00', '16:30', 'n2', 'https://c.example.jp/'],
    ]
  );
});

Deno.test('AC-6: 名前のコメントが無い値の行で止まる', () => {
  const text = '  -- explicit: 明記\n' + value(U1, '{"open":"09:00","notes":"n"}');
  const e = errorOf(() => parseReceptionHours(text, ROWS));
  assert(e.includes(U1), e);
  // 前の値の行で使った名前は次の値の行に持ち越さない
  const twice =
    '  -- explicit: 明記\n  -- 甲神社（東京）https://a.example.jp/\n' +
    value(U1, '{"open":"09:00","notes":"n"}') +
    value(U2, '{"open":"09:00","notes":"n"}');
  assert(errorOf(() => parseReceptionHours(twice, ROWS)).includes(U2));
});

Deno.test('AC-6: 名前に合う seed の寺社が 0 か 2 以上なら名前を出して止まる', () => {
  const none =
    '  -- explicit: 明記\n  -- 丁神社（東京）https://a.example.jp/\n' +
    value(U1, '{"open":"09:00","notes":"n"}');
  assert(errorOf(() => parseReceptionHours(none, ROWS)).includes('丁神社（東京）'));
  const two =
    '  -- explicit: 明記\n  -- 丙寺（京都）https://a.example.jp/\n' +
    value(U1, '{"open":"09:00","notes":"n"}');
  assert(errorOf(() => parseReceptionHours(two, ROWS)).includes('丙寺（京都）'));
});

Deno.test('AC-6: explicit / proxy の見出しの外の値の行で止まる', () => {
  const text =
    '  -- 甲神社（東京）https://a.example.jp/\n' + value(U1, '{"open":"09:00","notes":"n"}');
  assert(errorOf(() => parseReceptionHours(text, ROWS)).includes('甲神社'));
});

Deno.test('AC-6: 名前に括弧のある寺社も、最後の（県の略）で分ける', () => {
  const rows = [row(1, '賀茂御祖神社（下鴨神社）', '京都府')];
  const text =
    '  -- explicit: 明記\n  -- 賀茂御祖神社（下鴨神社）（京都）https://a.example.jp/\n' +
    value(U1, '{"open":"09:00","notes":"n"}');
  assertEquals(parseReceptionHours(text, rows)[0].name, '賀茂御祖神社（下鴨神社）');
});

Deno.test('AC-7: formatHours は時の先頭の 0 を落とし、close が無ければ「〜」で終える', () => {
  assertEquals(formatHours('09:10', '17:00'), '9:10〜17:00');
  assertEquals(formatHours('08:00', '16:30'), '8:00〜16:30');
  assertEquals(formatHours('09:00', null), '9:00〜');
  assertEquals(formatHours('10:00', '19:30'), '10:00〜19:30');
});

Deno.test('出典のホスト名と年月', () => {
  assertEquals(hostOf('https://www.meijijingu.or.jp/sanpai/2.php'), 'www.meijijingu.or.jp');
  assertEquals(yearMonthOf('2026-08-11T00:00:00Z'), '2026年8月');
  assertEquals(yearMonthOf('2026-12-01T00:00:00Z'), '2026年12月');
});
