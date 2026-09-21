import { tsukimairiList } from '@utils/tsukimairiList';

const row = (spot_id: string, spotName: string, visited_at: string) => ({
  spot_id,
  spotName,
  visited_at,
  spotType: 'shrine',
});

describe('tsukimairiList', () => {
  it('続いている寺社だけを、満願に近い順で返す', () => {
    const list = tsukimairiList(
      [
        // 湯島: 3ヶ月続いている
        row('a', '湯島天満宮', '2026-07-10'),
        row('a', '湯島天満宮', '2026-08-10'),
        row('a', '湯島天満宮', '2026-09-10'),
        // 大崎: 2ヶ月続いている
        row('b', '大崎八幡宮', '2026-08-01'),
        row('b', '大崎八幡宮', '2026-09-01'),
        // 浅草寺: 1ヶ月だけ
        row('c', '浅草寺', '2026-09-05'),
      ],
      '2026-09-20'
    );

    expect(list.map(e => e.spotName)).toEqual(['湯島天満宮', '大崎八幡宮']);
    expect(list[0].current).toBe(3);
  });

  /*
   * 途切れたものを並べると、半年前に途切れた寺社まで残って重くなる。
   * 記録はその寺社の詳細に1行で残る
   */
  it('途切れた寺社は出さない', () => {
    const list = tsukimairiList(
      [row('a', '湯島天満宮', '2026-01-10'), row('a', '湯島天満宮', '2026-02-10')],
      '2026-06-01'
    );

    expect(list).toEqual([]);
  });

  it('1枚も無ければ空', () => {
    expect(tsukimairiList([], '2026-09-20')).toEqual([]);
  });
});
