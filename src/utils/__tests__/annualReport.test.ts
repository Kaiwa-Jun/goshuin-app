import {
  buildAnnualReport,
  formatMonthDay,
  pickEvenly,
  prefectureNamesLine,
  shortPrefectureName,
  type AnnualPilgrimage,
  type AnnualVisit,
} from '@utils/annualReport';
import type { SpotType } from '@/types/supabase';

/* ── 集計の基本のデータ F（契約書「テスト方針」） ── */

const visit = (
  id: string,
  visitedAt: string,
  createdAt: string,
  spotId: string,
  spotName: string,
  spotType: SpotType,
  prefecture: string | null
): AnnualVisit => ({
  id,
  spotId,
  visitedAt,
  createdAt,
  imagePath: `u/${id}.jpg`,
  spotName,
  spotType,
  prefecture,
});

const F: AnnualVisit[] = [
  visit('a1', '2025-06-01', '2025-06-01T01:00:00Z', 's1', '大崎八幡宮', 'shrine', '宮城県'),
  visit('a2', '2026-01-03', '2026-01-03T01:00:00Z', 's1', '大崎八幡宮', 'shrine', '宮城県'),
  visit('a3', '2026-01-03', '2026-01-03T01:05:00Z', 's1', '大崎八幡宮', 'shrine', '宮城県'),
  visit('a4', '2026-03-10', '2026-03-10T01:00:00Z', 's2', '立石寺', 'temple', '山形県'),
  visit('a5', '2026-05-02', '2026-05-02T01:00:00Z', 's3', '伏見稲荷大社', 'shrine', '京都府'),
  visit('a6', '2026-05-02', '2026-05-02T02:00:00Z', 's4', '清水寺', 'temple', '京都府'),
  visit('a7', '2026-05-03', '2026-05-03T01:00:00Z', 's5', '東大寺', 'temple', '奈良県'),
  visit('a8', '2026-07-07', '2026-07-07T01:00:00Z', 's6', '名もなき社', 'shrine', null),
  visit('a9', '2026-08-15', '2026-08-15T01:00:00Z', 's1', '大崎八幡宮', 'shrine', '宮城県'),
  visit('a10', '2027-01-02', '2027-01-02T01:00:00Z', 's1', '大崎八幡宮', 'shrine', '宮城県'),
];

const P: AnnualPilgrimage[] = [
  { id: 'p1', name: '奈良と京都の三社', spotIds: ['s3', 's4', 's5'] },
  { id: 'p2', name: '未完の巡り', spotIds: ['s1', 's7'] },
  { id: 'p3', name: '大崎の一社', spotIds: ['s1'] },
  { id: 'p4', name: '札所なし', spotIds: [] },
];

const build = (year: number, visits: AnnualVisit[] = F, currentYear = year) =>
  buildAnnualReport({ year, currentYear, visits, pilgrimages: P });

/** 記録の少ない手作りのデータ用。createdAt は visitedAt から作る */
const quick = (
  id: string,
  visitedAt: string,
  spotId: string,
  prefecture: string | null = '宮城県'
) => visit(id, visitedAt, `${visitedAt}T01:00:00Z`, spotId, `寺社${spotId}`, 'shrine', prefecture);

describe('buildAnnualReport（前半: 数・月・県・表紙・写真）', () => {
  it('AC-2: F の 2026 の数', () => {
    expect(build(2026)?.count).toEqual({ spots: 6, stamps: 8, shrines: 3, temples: 3 });
  });

  it('AC-2: 月ごとの枚数は長さ12で、1月が [0]', () => {
    expect(build(2026)?.months).toEqual([2, 0, 1, 0, 3, 0, 1, 1, 0, 0, 0, 0]);
  });

  it('AC-2: いちばん多い月', () => {
    expect(build(2026)?.topMonth).toEqual({ month: 5, stamps: 3 });
  });

  it('AC-2: 今の年なら isCurrentYear が true、過ぎた年なら false', () => {
    expect(build(2026)?.isCurrentYear).toBe(true);
    expect(build(2026, F, 2027)?.isCurrentYear).toBe(false);
  });

  it('AC-3: 県は Y の中で最初に参った順。濃さはその年の枚数。県の無い記録は数えない', () => {
    expect(build(2026)?.prefectures).toEqual([
      { name: '宮城県', stamps: 3, tier: 'tier2' },
      { name: '山形県', stamps: 1, tier: 'tier1' },
      { name: '京都府', stamps: 2, tier: 'tier1' },
      { name: '奈良県', stamps: 1, tier: 'tier1' },
    ]);
  });

  it('AC-3: 表紙は Y の最初の記録（同じ日なら先に作った方）', () => {
    expect(build(2026)?.cover).toEqual({
      visitedAt: '2026-01-03',
      spotName: '大崎八幡宮',
      imagePath: 'u/a2.jpg',
    });
  });

  it('AC-4: 写真は Y の全記録を同じ並びで。16枚以下なら全部', () => {
    const photos = build(2026)?.photos;
    expect(photos?.total).toBe(8);
    expect(photos?.shown.map(p => p.id)).toEqual(['a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'a8', 'a9']);
    expect(photos?.shown[0]).toEqual({ id: 'a2', imagePath: 'u/a2.jpg' });
  });

  it('AC-4: 17枚以上なら一年から散らして16枚', () => {
    const many = Array.from({ length: 31 }, (_, i) =>
      quick(`m${String(i).padStart(2, '0')}`, `2026-01-${String(i + 1).padStart(2, '0')}`, 's1')
    );
    const shown = buildAnnualReport({
      year: 2026,
      currentYear: 2026,
      visits: many,
      pilgrimages: [],
    })?.photos.shown.map(p => p.id);
    expect(shown).toEqual(pickEvenly(31, 16).map(i => many[i].id));
  });

  it('AC-5: 同じ枚数の月なら早い月', () => {
    const report = buildAnnualReport({
      year: 2026,
      currentYear: 2026,
      visits: [
        quick('x1', '2026-01-05', 's1'),
        quick('x2', '2026-01-06', 's2'),
        quick('x3', '2026-03-05', 's3'),
        quick('x4', '2026-03-06', 's4'),
      ],
      pilgrimages: [],
    });
    expect(report?.topMonth).toEqual({ month: 1, stamps: 2 });
  });

  it('Y の記録が0件なら null', () => {
    expect(build(2024)).toBeNull();
  });
});

describe('pickEvenly', () => {
  it('AC-4: 31枚から16枚を散らす', () => {
    expect(pickEvenly(31, 16)).toEqual([0, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23, 25, 27, 29]);
  });

  it('AC-4: ちょうど16枚なら全部', () => {
    expect(pickEvenly(16, 16)).toEqual(Array.from({ length: 16 }, (_, i) => i));
  });

  it('AC-4: 少なければ全部', () => {
    expect(pickEvenly(5, 16)).toEqual([0, 1, 2, 3, 4]);
  });
});

describe('名前の補助', () => {
  it.each([
    ['東京都', '東京'],
    ['京都府', '京都'],
    ['大阪府', '大阪'],
    ['神奈川県', '神奈川'],
    ['北海道', '北海道'],
  ])('AC-15: %s → %s', (name, short) => {
    expect(shortPrefectureName(name)).toBe(short);
  });

  it('AC-15: 県の名前を「 ・ 」でつなぐ', () => {
    expect(
      prefectureNamesLine(['宮城県', '山形県', '東京都', '神奈川県', '京都府', '奈良県'])
    ).toBe('宮城 ・ 山形 ・ 東京 ・ 神奈川 ・ 京都 ・ 奈良');
  });

  it('AC-15: 12県より多いときは 12県のあとに「ほか{n}県」', () => {
    const names = [
      '青森県',
      '岩手県',
      '宮城県',
      '秋田県',
      '山形県',
      '福島県',
      '茨城県',
      '栃木県',
      '群馬県',
      '埼玉県',
      '千葉県',
      '東京都',
      '神奈川県',
      '新潟県',
    ];
    expect(prefectureNamesLine(names)).toBe(
      '青森 ・ 岩手 ・ 宮城 ・ 秋田 ・ 山形 ・ 福島 ・ 茨城 ・ 栃木 ・ 群馬 ・ 埼玉 ・ 千葉 ・ 東京 ほか2県'
    );
  });

  it('AC-15: 日付は「5月2日」の形', () => {
    expect(formatMonthDay('2026-05-02')).toBe('5月2日');
    expect(formatMonthDay('2026-12-31')).toBe('12月31日');
  });
});
