import { monthsOf, tsukimairiOf, MANGAN_MONTHS, MIN_MONTHS_TO_SHOW } from '@utils/tsukimairi';

describe('monthsOf', () => {
  /*
   * visited_at は DATE 型。new Date() を挟むと Issue #204 と同じ1日ずれを踏む。
   * 月境で数える機能なので、ずれると連続が理由もなく切れる
   */
  it('YYYY-MM を文字列のまま切り出す', () => {
    expect(monthsOf(['2026-09-20', '2026-09-01', '2026-08-31'])).toEqual(['2026-08', '2026-09']);
  });

  it('同じ月に何枚あっても1ヶ月', () => {
    expect(monthsOf(['2026-09-01', '2026-09-15', '2026-09-30'])).toEqual(['2026-09']);
  });
});

describe('tsukimairiOf', () => {
  const months = (...ym: string[]) => ym.map(m => `${m}-15`);

  it('連続した月を数える', () => {
    const r = tsukimairiOf(months('2026-03', '2026-04', '2026-05'), '2026-05-20');

    expect(r.current).toBe(3);
    expect(r.startMonth).toBe('2026-03');
  });

  it('月が飛んだら、そこで切れる', () => {
    const r = tsukimairiOf(months('2026-01', '2026-02', '2026-04', '2026-05'), '2026-05-20');

    expect(r.current).toBe(2);
    expect(r.longest).toBe(2);
  });

  describe('今月は猶予（前の月に来ていなければ途切れ）', () => {
    /*
     * 月が変わった瞬間に消えると「まだ月半ばなのに」になる。
     * 猶予を2ヶ月にすると、実際には途切れているのに残り続ける
     */
    it('今月まだ来ていなくても、先月来ていれば続いている', () => {
      const r = tsukimairiOf(months('2026-08', '2026-09'), '2026-10-15');

      expect(r.current).toBe(2);
      expect(r.isBroken).toBe(false);
    });

    it('先月に来ていなければ途切れ', () => {
      const r = tsukimairiOf(months('2026-08', '2026-09'), '2026-11-01');

      expect(r.current).toBe(0);
      expect(r.isBroken).toBe(true);
      expect(r.longest).toBe(2);
    });

    it('今月来ていれば当然続いている', () => {
      const r = tsukimairiOf(months('2026-09', '2026-10'), '2026-10-15');

      expect(r.current).toBe(2);
    });
  });

  describe('満願', () => {
    const twelve = Array.from({ length: 12 }, (_, i) => `2026-${String(i + 1).padStart(2, '0')}`);

    it('12ヶ月で満願', () => {
      const r = tsukimairiOf(months(...twelve), '2026-12-20');

      expect(r.current).toBe(MANGAN_MONTHS);
      expect(r.isMangan).toBe(true);
      expect(r.remaining).toBe(0);
    });

    it('満願のあとも数え続ける', () => {
      const r = tsukimairiOf(months(...twelve, '2027-01', '2027-02'), '2027-02-20');

      expect(r.current).toBe(14);
      expect(r.isMangan).toBe(true);
      // 2周目の途中。12で割った余りが今の巡りの月数
      expect(r.lapCount).toBe(2);
      expect(r.monthsInLap).toBe(2);
    });
  });

  it('満願まであと何ヶ月かを返す', () => {
    const r = tsukimairiOf(months('2026-03', '2026-04', '2026-05'), '2026-05-20');

    expect(r.remaining).toBe(9);
  });

  // 1回来ただけの人に「月参り」を名乗らせない
  it('1ヶ月ではカードを出さない', () => {
    expect(tsukimairiOf(months('2026-09'), '2026-09-20').shouldShowCard).toBe(false);
    expect(tsukimairiOf(months('2026-08', '2026-09'), '2026-09-20').shouldShowCard).toBe(true);
    expect(MIN_MONTHS_TO_SHOW).toBe(2);
  });

  it('途切れていればカードを出さない（最長は残す）', () => {
    const r = tsukimairiOf(months('2026-01', '2026-02', '2026-03'), '2026-06-01');

    expect(r.shouldShowCard).toBe(false);
    expect(r.longest).toBe(3);
  });

  it('1枚も無ければ、何も出さない', () => {
    const r = tsukimairiOf([], '2026-09-20');

    expect(r).toMatchObject({ current: 0, longest: 0, shouldShowCard: false, isBroken: false });
  });
});
