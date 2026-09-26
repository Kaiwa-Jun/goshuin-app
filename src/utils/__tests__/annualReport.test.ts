import {
  SCENE_MS,
  annualReportEntries,
  autoPlayStorageKey,
  buildAnnualReport,
  decideAutoPlay,
  fitPrefectures,
  formatMonthDay,
  mapStepMs,
  pickEvenly,
  prefectureNamesLine,
  sceneCopy,
  sealStepMs,
  shortPrefectureName,
  toViewTransform,
  type AnnualPilgrimage,
  type AnnualVisit,
} from '@utils/annualReport';
import { JAPAN_PREFECTURE_NAMES } from '@/constants/japanMap';
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

describe('buildAnnualReport（後半: 印象・印・満願・シーン）', () => {
  it('AC-6: いちばん多く参った寺社は、日付の種類の数で数える（同じ日は1回）', () => {
    expect(build(2026)?.memory.top).toEqual({
      spotName: '大崎八幡宮',
      prefecture: '宮城県',
      days: 2,
      imagePath: 'u/a9.jpg',
    });
  });

  it('AC-6: 同じ寺社で同じ日に3枚だけなら、いちばん多く参った は無い', () => {
    const report = buildAnnualReport({
      year: 2026,
      currentYear: 2026,
      visits: [
        quick('x1', '2026-04-01', 's1'),
        quick('x2', '2026-04-01', 's1'),
        quick('x3', '2026-04-01', 's1'),
      ],
      pilgrimages: [],
    });
    expect(report?.memory.top).toBeNull();
  });

  it('AC-6: 同じ回数なら先に参った方', () => {
    const report = buildAnnualReport({
      year: 2026,
      currentYear: 2026,
      visits: [
        quick('x1', '2026-03-01', 's1'),
        quick('x2', '2026-03-02', 's1'),
        quick('x3', '2026-02-01', 's2'),
        quick('x4', '2026-02-02', 's2'),
      ],
      pilgrimages: [],
    });
    expect(report?.memory.top?.spotName).toBe('寺社s2');
  });

  it('AC-7: はじめて足を運んだ県は、前の年までの記録に無い県のうち最初の1県', () => {
    expect(build(2026)?.memory.newPrefecture).toEqual({
      name: '山形県',
      visitedAt: '2026-03-10',
      spotName: '立石寺',
    });
  });

  it('AC-7: 前の年の記録が1件も無い年（使い始めた年）は出さない', () => {
    expect(build(2025)?.memory.newPrefecture).toBeNull();
  });

  it('AC-7: すべて前にある県なら出さない', () => {
    expect(build(2027)?.memory.newPrefecture).toBeNull();
  });

  it('AC-7: はじめての県が同じ日に2つ始まるなら createdAt の早い方', () => {
    const report = buildAnnualReport({
      year: 2026,
      currentYear: 2026,
      visits: [
        quick('x0', '2025-10-01', 's0', '宮城県'),
        visit('x1', '2026-06-01', '2026-06-01T05:00:00Z', 's1', '後の社', 'shrine', '福島県'),
        visit('x2', '2026-06-01', '2026-06-01T02:00:00Z', 's2', '先の寺', 'temple', '岩手県'),
      ],
      pilgrimages: [],
    });
    expect(report?.memory.newPrefecture).toEqual({
      name: '岩手県',
      visitedAt: '2026-06-01',
      spotName: '先の寺',
    });
  });

  it('AC-8: F の印。2026 は 5箇所', () => {
    expect(build(2026)?.badges).toEqual([{ id: 'visit-5', name: '5箇所達成', mark: 'go' }]);
    expect(build(2025)?.badges.map(b => b.id)).toEqual(['first-stamp']);
    expect(build(2027)?.badges.map(b => b.id)).toEqual([]);
  });

  it('AC-8: 翌年の記録で前の年の印が変わらない', () => {
    const visits = [
      quick('x1', '2026-02-01', 's1'),
      quick('x2', '2026-02-02', 's2'),
      quick('x3', '2026-02-03', 's3'),
      quick('x4', '2026-02-04', 's4'),
      quick('x5', '2027-01-02', 's5'),
    ];
    const at = (year: number) =>
      buildAnnualReport({ year, currentYear: year, visits, pilgrimages: [] })?.badges.map(
        b => b.id
      );
    expect(at(2026)).toEqual(['first-stamp']);
    expect(at(2027)).toEqual(['visit-5']);
  });

  it('AC-9: 月参りが年をまたいで満願になった年に、満願の印', () => {
    const visits = Array.from({ length: 12 }, (_, i) => {
      const month = ((i + 1) % 12) + 1;
      const year = i < 11 ? 2025 : 2026;
      return quick(`x${i}`, `${year}-${String(month).padStart(2, '0')}-10`, 's1');
    });
    const at = (year: number) =>
      buildAnnualReport({ year, currentYear: year, visits, pilgrimages: [] })?.badges.map(
        b => b.id
      );
    expect(at(2025)).toEqual(['first-stamp', 'four-seasons']);
    expect(at(2026)).toEqual(['mangan']);
  });

  it('AC-9: 並びは BADGE_DEFINITIONS の順', () => {
    const report = buildAnnualReport({
      year: 2026,
      currentYear: 2026,
      visits: [
        quick('x1', '2026-04-01', 's1'),
        quick('x2', '2026-04-01', 's2'),
        quick('x3', '2026-04-01', 's3'),
      ],
      pilgrimages: [],
    });
    expect(report?.badges.map(b => b.id)).toEqual(['first-stamp', 'same-day-3']);
  });

  it('AC-10: 満願した巡礼。満願の日は札所ごとの最初の記録のうちいちばん遅い日', () => {
    expect(build(2026)?.pilgrimages).toEqual([
      { id: 'p1', name: '奈良と京都の三社', spots: 3, completedAt: '2026-05-03' },
    ]);
    expect(build(2025)?.pilgrimages).toEqual([
      { id: 'p3', name: '大崎の一社', spots: 1, completedAt: '2025-06-01' },
    ]);
    expect(build(2027)?.pilgrimages).toEqual([]);
  });

  it('AC-10: 同じ年に2つ満願したら満願の日の新しい順', () => {
    const report = buildAnnualReport({
      year: 2026,
      currentYear: 2026,
      visits: [quick('x1', '2026-03-01', 's1'), quick('x2', '2026-07-01', 's2')],
      pilgrimages: [
        { id: 'q1', name: '三月の巡り', spotIds: ['s1'] },
        { id: 'q2', name: '七月の巡り', spotIds: ['s2', 's1'] },
      ],
    });
    expect(report?.pilgrimages.map(p => p.id)).toEqual(['q2', 'q1']);
  });

  it('AC-11: F のシーン', () => {
    expect(build(2026)?.scenes).toEqual([
      'cover',
      'count',
      'months',
      'map',
      'photos',
      'memory',
      'badges',
      'end',
    ]);
    expect(build(2025)?.scenes).toEqual(['cover', 'count', 'map', 'badges', 'end']);
    expect(build(2027)?.scenes).toEqual(['cover', 'count', 'map', 'end']);
    expect(build(2024)).toBeNull();
  });

  describe('AC-12: 飛ばす規則', () => {
    const scenesOf = (visits: AnnualVisit[], pilgrimages: AnnualPilgrimage[] = []) =>
      buildAnnualReport({ year: 2026, currentYear: 2026, visits, pilgrimages })?.scenes ?? [];

    it('記録のある月が1つなら月ごとは無く、2つならある', () => {
      expect(
        scenesOf([quick('x1', '2026-04-01', 's1'), quick('x2', '2026-04-02', 's2')])
      ).not.toContain('months');
      expect(
        scenesOf([quick('x1', '2026-04-01', 's1'), quick('x2', '2026-05-02', 's2')])
      ).toContain('months');
    });

    it('枚数2なら写真は無く、3ならある', () => {
      const two = [quick('x1', '2026-04-01', 's1'), quick('x2', '2026-04-02', 's2')];
      expect(scenesOf(two)).not.toContain('photos');
      expect(scenesOf([...two, quick('x3', '2026-04-03', 's3')])).toContain('photos');
    });

    it('すべての記録の県が null なら地図は無い', () => {
      expect(scenesOf([quick('x1', '2026-04-01', 's1', null)])).not.toContain('map');
    });

    it('印が0・満願1つなら達成はあり、どちらも0なら無い', () => {
      const visits = [
        quick('x0', '2025-04-01', 's1'),
        quick('x1', '2025-04-02', 's2'),
        quick('x2', '2026-04-01', 's1'),
      ];
      const report = buildAnnualReport({
        year: 2026,
        currentYear: 2026,
        visits: [...visits, quick('x3', '2026-05-01', 's3')],
        pilgrimages: [{ id: 'q', name: '巡り', spotIds: ['s1', 's3'] }],
      });
      // s3 で2026に初めての寺社が増えるが、3箇所では新しい印は無い
      expect(report?.badges).toEqual([]);
      expect(report?.pilgrimages).toHaveLength(1);
      expect(report?.scenes).toContain('badges');

      const none = buildAnnualReport({
        year: 2026,
        currentYear: 2026,
        visits,
        pilgrimages: [],
      });
      expect(none?.badges).toEqual([]);
      expect(none?.scenes).not.toContain('badges');
    });

    it('いちばん多く参った も はじめての県 も無ければ印象は無い', () => {
      expect(scenesOf([quick('x1', '2026-04-01', 's1')])).not.toContain('memory');
    });
  });
});

describe('地図の寄り', () => {
  it('AC-13: 宮城県だけなら 4倍まで寄る', () => {
    const fit = fitPrefectures(['宮城県']);
    expect(fit.scale).toBe(4);
    expect(fit.tx).toBeCloseTo(-2373, 1);
    expect(fit.ty).toBeCloseTo(-1666.6, 1);
  });

  it('AC-13: 全国と、県が0のときは寄らない', () => {
    expect(fitPrefectures([...JAPAN_PREFECTURE_NAMES])).toEqual({ scale: 1, tx: 0, ty: 0 });
    expect(fitPrefectures([])).toEqual({ scale: 1, tx: 0, ty: 0 });
  });

  it('AC-13: 画面の transform（中心が基準）に直す', () => {
    const view = toViewTransform({ scale: 4, tx: -2373, ty: -1666.6 }, 300);
    expect(view.scale).toBe(4);
    expect(view.translateX).toBeCloseTo(-261.9, 1);
    expect(view.translateY).toBeCloseTo(9.42, 1);
  });
});

describe('間隔', () => {
  it('AC-14: 県の塗りの間隔', () => {
    expect(mapStepMs(1)).toBe(380);
    expect(mapStepMs(6)).toBe(380);
    expect(mapStepMs(7)).toBe(325);
    expect(mapStepMs(12)).toBe(190);
    expect(mapStepMs(47)).toBe(48);
  });

  it('AC-14: 印の間隔', () => {
    expect(sealStepMs(3)).toBe(650);
    expect(sealStepMs(6)).toBe(650);
    expect(sealStepMs(7)).toBe(585);
    expect(sealStepMs(9)).toBe(455);
  });

  it('AC-14: シーンの長さは試作の値', () => {
    expect(SCENE_MS).toEqual({
      cover: 4800,
      count: 5200,
      months: 5200,
      map: 6400,
      photos: 5400,
      memory: 5200,
      badges: 5600,
      end: 0,
    });
  });
});

describe('sceneCopy', () => {
  it('AC-16: 今の年は「今年」', () => {
    expect(sceneCopy(2026, true)).toEqual({
      countKick: '今年めぐった寺社',
      photosKick: '今年の御朱印',
      badgesKick: '今年いただいた印',
      manganKick: '今年の満願',
    });
  });

  it('AC-16: 過ぎた年は「{年}年」', () => {
    expect(sceneCopy(2026, false)).toEqual({
      countKick: '2026年にめぐった寺社',
      photosKick: '2026年の御朱印',
      badgesKick: '2026年にいただいた印',
      manganKick: '2026年の満願',
    });
  });
});

describe('annualReportEntries', () => {
  const rows = F.map(v => ({ visited_at: v.visitedAt, spot_id: v.spotId }));

  it('AC-17: 12月は今の年がカード', () => {
    expect(annualReportEntries(rows, { year: 2026, month: 12 })).toEqual({
      card: { year: 2026, spots: 6, stamps: 8 },
      shelf: [],
    });
  });

  it('AC-17: 12月より前はどちらも無い（2025 は最初の年より前）', () => {
    expect(annualReportEntries(rows, { year: 2026, month: 9 })).toEqual({ card: null, shelf: [] });
  });

  it('AC-17: 1月からは過ぎた年が欄に並ぶ', () => {
    expect(annualReportEntries(rows, { year: 2027, month: 1 })).toEqual({
      card: null,
      shelf: [{ year: 2026, spots: 6, stamps: 8 }],
    });
  });

  it('AC-17: 次の12月はその年がカード、過ぎた年は欄', () => {
    expect(annualReportEntries(rows, { year: 2027, month: 12 })).toEqual({
      card: { year: 2027, spots: 1, stamps: 1 },
      shelf: [{ year: 2026, spots: 6, stamps: 8 }],
    });
  });

  it('AC-17: 今の年の記録が無ければ12月でもカードは無い', () => {
    const without2026 = rows.filter(r => !r.visited_at.startsWith('2026'));
    expect(annualReportEntries(without2026, { year: 2026, month: 12 }).card).toBeNull();
  });

  it('欄は新しい年から', () => {
    const more = [...rows, { visited_at: '2028-03-01', spot_id: 's1' }];
    expect(annualReportEntries(more, { year: 2029, month: 2 }).shelf.map(s => s.year)).toEqual([
      2028, 2027, 2026,
    ]);
  });
});

describe('decideAutoPlay', () => {
  const base = { now: { year: 2026, month: 12 }, userId: 'u1', shown: false, stampsInYear: 3 };

  it('AC-18: 12月・ログイン済み・まだ・記録あり なら出す', () => {
    expect(decideAutoPlay(base)).toEqual({ play: true, year: 2026 });
  });

  it.each([
    [{ userId: null }, 'guest'],
    [{ now: { year: 2026, month: 11 } }, 'not-december'],
    [{ shown: true }, 'already-shown'],
    [{ stampsInYear: null }, 'error'],
    [{ stampsInYear: 0 }, 'no-records'],
  ] as const)('AC-18: %o なら %s', (patch, reason) => {
    expect(decideAutoPlay({ ...base, ...patch })).toEqual({ play: false, reason });
  });

  it('判定の順は guest → not-december → already-shown → error → no-records', () => {
    expect(
      decideAutoPlay({ now: { year: 2026, month: 11 }, userId: null, shown: true, stampsInYear: 0 })
    ).toEqual({ play: false, reason: 'guest' });
    expect(
      decideAutoPlay({ now: { year: 2026, month: 11 }, userId: 'u1', shown: true, stampsInYear: 0 })
    ).toEqual({ play: false, reason: 'not-december' });
    expect(decideAutoPlay({ ...base, shown: true, stampsInYear: null })).toEqual({
      play: false,
      reason: 'already-shown',
    });
  });

  it('AC-18: 印のキー', () => {
    expect(autoPlayStorageKey(2026, 'u1')).toBe('annual_report_autoplayed:2026:u1');
  });
});
