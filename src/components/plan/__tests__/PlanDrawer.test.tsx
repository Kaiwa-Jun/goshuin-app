import { drawerSnaps, shouldDrawerTake } from '@components/plan/PlanDrawer';

/* ドロワーの中の一覧とドロワー自体の指の受け渡し（Issue #258） */
const base = { scrollY: 0, contentH: 1000, viewH: 400, height: 300, low: 300, high: 700 };

describe('shouldDrawerTake', () => {
  it('一覧がいちばん上で指を下へ → ドロワーを下げる（下げる余地があるとき）', () => {
    expect(shouldDrawerTake({ ...base, height: 700, dy: 20 })).toBe(true);
    // もう低い段なら下げない（一覧に任せる）
    expect(shouldDrawerTake({ ...base, height: 300, dy: 20 })).toBe(false);
  });
  it('一覧が途中なら、指を下へ動かしても一覧をスクロールする', () => {
    expect(shouldDrawerTake({ ...base, height: 700, scrollY: 120, dy: 20 })).toBe(false);
  });
  it('一覧がいちばん下で指を上へ → ドロワーを広げる（広げる余地があるとき）', () => {
    expect(shouldDrawerTake({ ...base, scrollY: 600, dy: -20 })).toBe(true);
    expect(shouldDrawerTake({ ...base, scrollY: 600, height: 700, dy: -20 })).toBe(false);
  });
  it('一覧の下にまだ続きがあれば、指を上へ動かしても一覧をスクロールする', () => {
    expect(shouldDrawerTake({ ...base, scrollY: 100, dy: -20 })).toBe(false);
  });
  it('一覧が短くてスクロールしないなら、どちらの向きもドロワーが動く', () => {
    const short = { ...base, contentH: 200 };
    expect(shouldDrawerTake({ ...short, dy: -20 })).toBe(true);
    expect(shouldDrawerTake({ ...short, height: 700, dy: 20 })).toBe(true);
  });
  it('ほとんど動いていない・横に動いたときは取らない（タップと並べ替えの長押しを邪魔しない）', () => {
    expect(shouldDrawerTake({ ...base, height: 700, dy: 3 })).toBe(false);
    expect(shouldDrawerTake({ ...base, height: 700, dy: 20, dx: 40 })).toBe(false);
  });
});

describe('drawerSnaps（ドロワーの2段）', () => {
  it('低い段は画面の 36%、広げた段は画面の 80% と maxHeight の低い方', () => {
    expect(drawerSnaps(1000)).toEqual({ low: 360, high: 800 });
    expect(drawerSnaps(1000, 500)).toEqual({ low: 360, high: 500 });
    // maxHeight が低い段より低くても、低い段は割らない
    expect(drawerSnaps(1000, 200)).toEqual({ low: 360, high: 360 });
  });
});
