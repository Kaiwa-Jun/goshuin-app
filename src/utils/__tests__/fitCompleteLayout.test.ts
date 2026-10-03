import { COMPLETE_LAYOUT, fitCompleteLayout, type CompleteLayout } from '@utils/fitCompleteLayout';

/*
 * 完了画面のカードに中身が入りきらないとき、地図 → 余白 → 写真 の順に縮める
 * （1.2.0 の実機で、初回投稿の写真がカードの上にはみ出した）。
 * 数字は Expo Web で実測した初回投稿（全部の要素が出る）の値
 */
const L = COMPLETE_LAYOUT;
const mapH = (w: number) => w * L.mapAspect;
const stampH = (w: number) => w * L.stampAspect;
const full: CompleteLayout = {
  mapWidth: L.mapMaxWidth,
  stampWidth: L.stampMaxWidth,
  gap: L.gapMax,
};
/** 地図・写真・余白を除いた中身の高さ（SE 実測: 43 + 36 + 46 + 70） */
const OTHERS = 195;
const GAPS = 5;
const contentOf = (l: { mapWidth: number; stampWidth: number; gap: number }) =>
  OTHERS + mapH(l.mapWidth) + stampH(l.stampWidth) + GAPS * l.gap;

const fit = (available: number, current = full) =>
  fitCompleteLayout({ available, content: contentOf(current), gapCount: GAPS, current });

describe('fitCompleteLayout', () => {
  it('収まっていれば、どれも縮めない', () => {
    expect(fit(900)).toEqual(full);
  });

  it('まず地図だけを縮める（iPhone 16 相当: 688 - 48）', () => {
    const l = fit(640);
    expect(l.stampWidth).toBe(L.stampMaxWidth);
    expect(l.gap).toBe(L.gapMax);
    expect(l.mapWidth).toBeLessThan(L.mapMaxWidth);
    expect(contentOf(l)).toBeLessThanOrEqual(640);
  });

  it('地図が下限でも足りなければ、余白を詰め、それでも足りなければ写真を縮める（SE 相当: 503 - 48）', () => {
    const l = fit(455);
    expect(l.mapWidth).toBe(L.mapMinWidth);
    expect(l.gap).toBe(L.gapMin);
    expect(l.stampWidth).toBeLessThan(L.stampMaxWidth);
    expect(l.stampWidth).toBeGreaterThanOrEqual(L.stampMinWidth);
    expect(contentOf(l)).toBeLessThanOrEqual(455);
  });

  it('縮めたあとに測り直しても同じ（行ったり来たりしない）', () => {
    const first = fit(455);
    expect(fit(455, first)).toEqual(first);
  });

  it('空きが増えたら元に戻す', () => {
    const small = fit(455);
    expect(fit(900, small)).toEqual(full);
  });

  it('どれも下限より小さくはしない', () => {
    expect(fit(100)).toEqual({
      mapWidth: L.mapMinWidth,
      stampWidth: L.stampMinWidth,
      gap: L.gapMin,
    });
  });

  it('まだ測れていない（0）ときは、縮めない', () => {
    expect(fitCompleteLayout({ available: 0, content: 0, gapCount: GAPS, current: full })).toEqual(
      full
    );
  });
});
