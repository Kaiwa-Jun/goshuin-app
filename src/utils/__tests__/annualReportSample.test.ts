import { buildAnnualReport } from '@utils/annualReport';
import { ANNUAL_REPORT_SAMPLES, ANNUAL_SAMPLE_YEAR } from '@utils/annualReportSample';

/*
 * 見本のデータ（Issue #274 D-20）。動きの試作の DATA.full / DATA.few の数字が
 * buildAnnualReport からそのまま出るように組んである
 */
const build = (kind: 'full' | 'few') =>
  buildAnnualReport({ year: 2026, currentYear: 2026, ...ANNUAL_REPORT_SAMPLES[kind] });

describe('見本 full（31枚）', () => {
  const report = build('full');

  it('見本の年は 2026', () => {
    expect(ANNUAL_SAMPLE_YEAR).toBe(2026);
  });

  it('AC-22: 8シーンすべて', () => {
    expect(report?.scenes).toEqual([
      'cover',
      'count',
      'months',
      'map',
      'photos',
      'memory',
      'badges',
      'end',
    ]);
  });

  it('AC-22: 数と月', () => {
    expect(report?.count).toEqual({ spots: 24, stamps: 31, shrines: 17, temples: 7 });
    expect(report?.months).toEqual([2, 0, 1, 3, 7, 2, 0, 4, 3, 5, 2, 2]);
  });

  it('AC-22: 県と濃さ', () => {
    expect(report?.prefectures.map(p => p.name)).toEqual([
      '宮城県',
      '山形県',
      '東京都',
      '神奈川県',
      '京都府',
      '奈良県',
    ]);
    expect(report?.prefectures.map(p => p.tier)).toEqual([
      'tier3',
      'tier1',
      'tier2',
      'tier1',
      'tier2',
      'tier1',
    ]);
  });

  it('AC-22: 表紙と印象', () => {
    expect(report?.cover).toMatchObject({ visitedAt: '2026-01-03', spotName: '大崎八幡宮' });
    expect(report?.memory.top).toMatchObject({
      spotName: '大崎八幡宮',
      prefecture: '宮城県',
      days: 4,
    });
    expect(report?.memory.newPrefecture).toEqual({
      name: '京都府',
      visitedAt: '2026-05-02',
      spotName: '伏見稲荷大社',
    });
  });

  it('AC-22: 印と満願', () => {
    expect(report?.badges.map(b => b.id)).toEqual(['visit-10', 'mangan', 'same-day-3']);
    expect(report?.pilgrimages).toEqual([
      expect.objectContaining({ name: '仙台六芒星巡り', spots: 6, completedAt: '2026-10-18' }),
    ]);
    expect(report?.pilgrimages).toHaveLength(1);
  });

  it('AC-22: 写真は31枚から16枚。すべて写真の枠（imagePath が null）', () => {
    expect(report?.photos.total).toBe(31);
    expect(report?.photos.shown).toHaveLength(16);
    expect(report?.cover.imagePath).toBeNull();
    expect(report?.memory.top?.imagePath).toBeNull();
    expect(report?.photos.shown.every(p => p.imagePath === null)).toBe(true);
    expect(ANNUAL_REPORT_SAMPLES.full.visits.every(v => v.imagePath === null)).toBe(true);
  });
});

describe('見本 few（2枚）', () => {
  const report = build('few');

  it('AC-23: データが足りないシーンを飛ばす', () => {
    expect(report?.scenes).toEqual(['cover', 'count', 'map', 'badges', 'end']);
  });

  it('AC-23: 数・月・県・表紙', () => {
    expect(report?.count).toEqual({ spots: 2, stamps: 2, shrines: 1, temples: 1 });
    expect(report?.months).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 0]);
    expect(report?.prefectures).toEqual([{ name: '宮城県', stamps: 2, tier: 'tier1' }]);
    expect(report?.cover).toMatchObject({ visitedAt: '2026-11-03', spotName: '大崎八幡宮' });
  });

  it('AC-23: 印象は無く、印は初めての御朱印だけ・満願は無い', () => {
    expect(report?.memory).toEqual({ top: null, newPrefecture: null });
    expect(report?.badges.map(b => b.id)).toEqual(['first-stamp']);
    expect(report?.pilgrimages).toEqual([]);
  });
});
