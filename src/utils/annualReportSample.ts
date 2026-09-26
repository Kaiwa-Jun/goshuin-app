import type { AnnualPilgrimage, AnnualVisit } from '@utils/annualReport';
import type { SpotType } from '@/types/supabase';

/**
 * 年報の見本（Issue #274 D-20）。開発用と Expo Web の確認のためのもの。
 *
 * 動きの試作 v1 の `DATA.full`（31枚）/ `DATA.few`（2枚）の数字が、
 * `buildAnnualReport` からそのまま出るように記録を組んである。
 * 写真は `imagePath: null`（写真の枠）。本番の画面の分岐には使わない
 * （`sample` の params があるときだけ）
 */
export const ANNUAL_SAMPLE_YEAR = 2026;

type SampleSpot = { id: string; name: string; type: SpotType; prefecture: string };

const spot = (id: string, name: string, type: SpotType, prefecture: string): SampleSpot => ({
  id,
  name,
  type,
  prefecture,
});

const S = {
  osaki: spot('sample-osaki', '大崎八幡宮', 'shrine', '宮城県'),
  shiogama: spot('sample-shiogama', '鹽竈神社', 'shrine', '宮城県'),
  atago: spot('sample-atago', '愛宕神社', 'shrine', '宮城県'),
  tsutsujigaoka: spot('sample-tsutsujigaoka', '榴岡天満宮', 'shrine', '宮城県'),
  zuiganji: spot('sample-zuiganji', '瑞巌寺', 'temple', '宮城県'),
  akiu: spot('sample-akiu', '秋保神社', 'shrine', '宮城県'),
  rinnoji: spot('sample-rinnoji', '輪王寺', 'temple', '宮城県'),
  takekoma: spot('sample-takekoma', '竹駒神社', 'shrine', '宮城県'),
  toshogu: spot('sample-toshogu', '仙台東照宮', 'shrine', '宮城県'),
  kanahebisui: spot('sample-kanahebisui', '金蛇水神社', 'shrine', '宮城県'),
  kamo: spot('sample-kamo', '賀茂神社', 'shrine', '宮城県'),
  futahashira: spot('sample-futahashira', '二柱神社', 'shrine', '宮城県'),
  risshakuji: spot('sample-risshakuji', '立石寺', 'temple', '山形県'),
  meiji: spot('sample-meiji', '明治神宮', 'shrine', '東京都'),
  sensoji: spot('sample-sensoji', '浅草寺', 'temple', '東京都'),
  kanda: spot('sample-kanda', '神田明神', 'shrine', '東京都'),
  tsurugaoka: spot('sample-tsurugaoka', '鶴岡八幡宮', 'shrine', '神奈川県'),
  kenchoji: spot('sample-kenchoji', '建長寺', 'temple', '神奈川県'),
  fushimi: spot('sample-fushimi', '伏見稲荷大社', 'shrine', '京都府'),
  kiyomizu: spot('sample-kiyomizu', '清水寺', 'temple', '京都府'),
  yasaka: spot('sample-yasaka', '八坂神社', 'shrine', '京都府'),
  shimogamo: spot('sample-shimogamo', '下鴨神社', 'shrine', '京都府'),
  todaiji: spot('sample-todaiji', '東大寺', 'temple', '奈良県'),
  kasuga: spot('sample-kasuga', '春日大社', 'shrine', '奈良県'),
} as const;

/** [参拝日, 寺社, 作った時刻（同じ日の並びを決める）] */
type Row = [visitedAt: string, spot: SampleSpot, hour?: number];

const toVisits = (prefix: string, rows: Row[]): AnnualVisit[] =>
  rows.map(([visitedAt, s, hour = 1], i) => ({
    id: `${prefix}-${String(i + 1).padStart(2, '0')}`,
    spotId: s.id,
    visitedAt,
    createdAt: `${visitedAt}T${String(hour).padStart(2, '0')}:00:00Z`,
    imagePath: null,
    spotName: s.name,
    spotType: s.type,
    prefecture: s.prefecture,
  }));

/**
 * 2025年: 大崎八幡宮に2月〜12月の毎月（翌1月で月参りの満願）と、
 * 宮城・山形・東京・神奈川の寺社。5箇所・四季・初めての は 2025年に取れている
 */
const FULL_2025: Row[] = [
  ...Array.from(
    { length: 11 },
    (_, i): Row => [`2025-${String(i + 2).padStart(2, '0')}-01`, S.osaki]
  ),
  ['2025-05-05', S.shiogama],
  ['2025-07-20', S.risshakuji],
  ['2025-09-14', S.meiji],
  ['2025-11-23', S.tsurugaoka],
];

/**
 * 2026年: 31枚・24社（神社17・お寺7）。月ごと [2,0,1,3,7,2,0,4,3,5,2,2]。
 * 5/2 に京都で3社（1日に3箇所）。10/18 に仙台六芒星の6社がそろう
 */
const FULL_2026: Row[] = [
  ['2026-01-03', S.osaki],
  ['2026-01-04', S.shiogama],
  ['2026-03-20', S.risshakuji],
  ['2026-04-05', S.meiji],
  ['2026-04-06', S.sensoji],
  ['2026-04-12', S.tsurugaoka],
  ['2026-05-02', S.fushimi, 1],
  ['2026-05-02', S.kiyomizu, 3],
  ['2026-05-02', S.yasaka, 5],
  ['2026-05-03', S.todaiji, 1],
  ['2026-05-03', S.kasuga, 3],
  ['2026-05-04', S.shimogamo],
  ['2026-05-15', S.osaki],
  ['2026-06-10', S.kanda],
  ['2026-06-14', S.kenchoji],
  ['2026-08-15', S.osaki],
  ['2026-08-16', S.atago, 1],
  ['2026-08-16', S.tsutsujigaoka, 3],
  ['2026-08-20', S.zuiganji],
  ['2026-09-12', S.akiu],
  ['2026-09-13', S.rinnoji],
  ['2026-09-20', S.takekoma],
  ['2026-10-05', S.toshogu],
  ['2026-10-11', S.osaki],
  ['2026-10-12', S.kanahebisui, 1],
  ['2026-10-12', S.kamo, 3],
  ['2026-10-18', S.futahashira],
  ['2026-11-03', S.shiogama],
  ['2026-11-23', S.takekoma],
  ['2026-12-06', S.akiu],
  ['2026-12-20', S.atago],
];

const ROKUBOSEI: AnnualPilgrimage = {
  id: 'sample-rokubosei',
  name: '仙台六芒星巡り',
  spotIds: [S.osaki, S.atago, S.tsutsujigaoka, S.akiu, S.toshogu, S.futahashira].map(s => s.id),
};

export const ANNUAL_REPORT_SAMPLES: Record<
  'full' | 'few',
  { visits: AnnualVisit[]; pilgrimages: AnnualPilgrimage[] }
> = {
  full: {
    visits: toVisits('sample-full', [...FULL_2025, ...FULL_2026]),
    pilgrimages: [ROKUBOSEI],
  },
  /** 記録が2枚だけの人。使い始めた年なので「はじめて足を運んだ県」も無い */
  few: {
    visits: toVisits('sample-few', [
      ['2026-11-03', S.osaki, 1],
      ['2026-11-03', S.rinnoji, 3],
    ]),
    pilgrimages: [ROKUBOSEI],
  },
};
