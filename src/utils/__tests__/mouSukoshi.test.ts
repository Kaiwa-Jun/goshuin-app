import { mouSukoshi, type AreaSpot, type MouSukoshiInput } from '@utils/mouSukoshi';
import type { PilgrimageProgress } from '@services/pilgrimages';
import type { TsukimairiEntry } from '@utils/tsukimairiList';
import type { BadgeProgress } from '@/types/badge';

/*
 * あゆみの「もう少し」（Issue #245）。暮らしの中で踏み出せる一歩だけを、最大3行。
 * 地方の制覇は旅行レベルの労力なので、ここには出さない
 */
const course = (
  id: string,
  total: number,
  visited: number,
  unvisited: string[] = []
): PilgrimageProgress => ({
  id,
  name: `コース${id}`,
  description: null,
  category: null,
  totalSpots: total,
  visitedCount: visited,
  unvisitedSpotIds: unvisited,
});

const tsuki = (
  spotId: string,
  current: number,
  extra: Partial<TsukimairiEntry> = {}
): TsukimairiEntry => ({
  spotId,
  spotName: `寺社${spotId}`,
  current,
  longest: current,
  startMonth: '2026-01',
  remaining: Math.max(0, 12 - current),
  isMangan: current >= 12,
  lapCount: 1,
  monthsInLap: current,
  isBroken: false,
  shouldShowCard: true,
  ...extra,
});

const progress = (p: Partial<BadgeProgress> = {}): BadgeProgress => ({
  visitCount: 12,
  longestTsukimairi: 0,
  seasonCount: 2,
  maxSameDayVisits: 1,
  ...p,
});

const spot = (id: string, km: number): AreaSpot => ({
  id,
  name: `寺社${id}`,
  address: null,
  type: 'shrine',
  distanceKm: km,
});

const base = (p: Partial<MouSukoshiInput> = {}): MouSukoshiInput => ({
  pilgrimages: [],
  tsukimairi: [],
  visitedThisMonth: new Set(),
  badgeProgress: progress(),
  area: null,
  ...p,
});

describe('mouSukoshi', () => {
  it('何も当てはまらなければ 0 件', () => {
    expect(mouSukoshi(base())).toEqual([]);
  });

  describe('巡礼', () => {
    it('残り1〜2社のコースだけ', () => {
      const rows = mouSukoshi(
        base({
          pilgrimages: [
            course('a', 6, 5),
            course('b', 5, 3),
            course('c', 5, 5),
            course('d', 7, 1),
            course('e', 0, 0),
          ],
        })
      );
      expect(rows.map(r => r.kind === 'pilgrimage' && r.pilgrimage.id)).toEqual(['a', 'b']);
      expect(rows[0]).toMatchObject({ kind: 'pilgrimage', remaining: 1 });
    });
  });

  describe('月参り', () => {
    it('満願まで1〜3ヶ月で、今月まだのものだけ', () => {
      const rows = mouSukoshi(
        base({
          tsukimairi: [
            tsuki('near', 9),
            tsuki('far', 5),
            tsuki('done', 12),
            tsuki('thisMonth', 10),
            tsuki('broken', 11, { isBroken: true }),
          ],
          visitedThisMonth: new Set(['thisMonth']),
        })
      );
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ kind: 'tsukimairi', remaining: 3 });
    });
  });

  describe('印', () => {
    it('次の印まで2割以内なら出す（10箇所の印に 8 → 残り2）', () => {
      const rows = mouSukoshi(base({ badgeProgress: progress({ visitCount: 8, seasonCount: 4 }) }));
      expect(rows).toEqual([expect.objectContaining({ kind: 'seal', remaining: 2, unit: '箇所' })]);
    });

    it('2割より遠ければ出さない（10箇所の印に 6 → 残り4）', () => {
      expect(
        mouSukoshi(base({ badgeProgress: progress({ visitCount: 6, seasonCount: 4 }) }))
      ).toEqual([]);
    });

    it('四季の印は、あと1つのときだけ', () => {
      const rows = mouSukoshi(
        base({ badgeProgress: progress({ visitCount: 12, seasonCount: 3 }) })
      );
      expect(rows).toEqual([expect.objectContaining({ kind: 'seal', remaining: 1 })]);
    });

    it('月参りの印（満願）は、月参りの行と重なるので印としては出さない', () => {
      // 訪問数・四季・同日はすべて遠く、いちばん近いのが月参りの印
      const rows = mouSukoshi(
        base({
          badgeProgress: progress({
            visitCount: 31,
            seasonCount: 4,
            longestTsukimairi: 11,
            maxSameDayVisits: 3,
          }),
        })
      );
      expect(rows.some(r => r.kind === 'seal')).toBe(false);
    });
  });

  describe('よく行くエリア', () => {
    it('まだの寺社があれば最後に出す。巡礼の残りの寺社は数えない', () => {
      const rows = mouSukoshi(
        base({
          pilgrimages: [course('a', 6, 5, ['kameoka'])],
          area: {
            label: '仙台',
            months: 7,
            spots: [spot('kameoka', 1.5), spot('rinnoji', 1.8), spot('zuihoden', 2.0)],
          },
        })
      );
      expect(rows.map(r => r.kind)).toEqual(['pilgrimage', 'area']);
      const area = rows[1];
      if (area.kind !== 'area') throw new Error();
      expect(area.spots.map(s => s.id)).toEqual(['rinnoji', 'zuihoden']);
      expect(area.alsoInCourse.map(s => s.id)).toEqual(['kameoka']);
      // シートで「〇〇の、残りの1社」と添えるためにコース名を持つ
      expect(area.alsoInCourse[0].courseName).toBe('コースa');
    });

    it('巡礼の残りを除いてから、近い順に最大5件', () => {
      const rows = mouSukoshi(
        base({
          pilgrimages: [course('a', 6, 5, ['s1'])],
          area: {
            label: '仙台',
            months: 7,
            spots: [1, 2, 3, 4, 5, 6, 7].map(n => spot(`s${n}`, n)),
          },
        })
      );
      const area = rows.find(r => r.kind === 'area');
      if (area?.kind !== 'area') throw new Error();
      expect(area.spots.map(s => s.id)).toEqual(['s2', 's3', 's4', 's5', 's6']);
    });

    it('まだの寺社が巡礼の残りだけなら、エリアの行は出ない', () => {
      const rows = mouSukoshi(
        base({
          pilgrimages: [course('a', 6, 5, ['kameoka'])],
          area: { label: '仙台', months: 7, spots: [spot('kameoka', 1.5)] },
        })
      );
      expect(rows.map(r => r.kind)).toEqual(['pilgrimage']);
    });
  });

  describe('並べ方', () => {
    it('「あと」の小さい順、同じなら 巡礼 → 月参り → 印、エリアは最後、最大3行', () => {
      const rows = mouSukoshi(
        base({
          pilgrimages: [course('a', 6, 4)], // あと2
          tsukimairi: [tsuki('t', 11)], // あと1
          badgeProgress: progress({ visitCount: 8, seasonCount: 4 }), // あと2
          area: { label: '仙台', months: 7, spots: [spot('x', 1)] },
        })
      );
      expect(rows.map(r => r.kind)).toEqual(['tsukimairi', 'pilgrimage', 'seal']);
    });
  });
});
