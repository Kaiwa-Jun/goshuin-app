import { buildMapParams } from '@utils/completeMapParams';

const stats = [
  { prefecture: '東京都', visitedCount: 3, stampCount: 15, totalCount: 20 },
  { prefecture: '宮城県', visitedCount: 5, stampCount: 9, totalCount: 10 },
];

describe('buildMapParams', () => {
  /*
   * 足す前を渡すと、寄った先の県が塗られないまま「はじめて」と出る。
   * いま記録したぶんを足した状態を渡す
   */
  it('いま記録したぶんを足した枚数を渡す', () => {
    expect(buildMapParams(stats, '東京都', 2)).toMatchObject({
      prefecture: '東京都',
      stampCountByPrefecture: { 東京都: 17, 宮城県: 9 },
      totalStampCount: 26,
    });
  });

  it('その県が初めてなら isFirstInPrefecture が立つ', () => {
    expect(buildMapParams(stats, '高知県', 1)).toMatchObject({
      isFirstInPrefecture: true,
      stampCountByPrefecture: { 東京都: 15, 宮城県: 9, 高知県: 1 },
    });
    expect(buildMapParams(stats, '東京都', 1).isFirstInPrefecture).toBe(false);
  });

  // 取得に失敗しても記録は止めない。地図だけ出さない（Issue #133 と同じ扱い）
  it('集計が取れていなければ、何も渡さない', () => {
    expect(buildMapParams(null, '東京都', 1)).toEqual({});
    expect(buildMapParams(stats, undefined, 1)).toEqual({});
  });
});
