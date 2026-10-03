import { dragShift, dragTarget } from '@utils/dragReorder';

/* 予定の順番の並べ替え（Issue #258）。行の高さは区間の行を含むのでばらばら */
const L = [
  { y: 0, height: 100 },
  { y: 100, height: 100 },
  { y: 200, height: 100 },
  { y: 300, height: 60 }, // 最後は区間が無いので低い
];

describe('dragTarget（持っている行が入る位置）', () => {
  it('動かしていなければ元の位置', () => {
    expect(dragTarget(L, 1, 0)).toBe(1);
    expect(dragTarget(L, 1, 30)).toBe(1);
  });
  it('下の行の真ん中を越えたら、その行の後ろに入る', () => {
    // 1番目（中心150）を 120 下げると中心 270 → 2番目の中心 250 を越える
    expect(dragTarget(L, 1, 120)).toBe(2);
    expect(dragTarget(L, 1, 400)).toBe(3);
  });
  it('上の行の真ん中を越えたら、その行の前に入る', () => {
    expect(dragTarget(L, 2, -120)).toBe(1);
    expect(dragTarget(L, 2, -400)).toBe(0);
  });
});

describe('dragShift（ほかの行がよける量）', () => {
  it('下へ動かすと、あいだの行が持っている行の高さだけ上へよける', () => {
    expect(dragShift(2, 1, 3, 100)).toBe(-100);
    expect(dragShift(3, 1, 3, 100)).toBe(-100);
    expect(dragShift(0, 1, 3, 100)).toBe(0);
  });
  it('上へ動かすと、あいだの行が下へよける', () => {
    expect(dragShift(0, 2, 0, 100)).toBe(100);
    expect(dragShift(1, 2, 0, 100)).toBe(100);
    expect(dragShift(3, 2, 0, 100)).toBe(0);
  });
  it('持っている行自身と、動かしていないときは 0', () => {
    expect(dragShift(1, 1, 3, 100)).toBe(0);
    expect(dragShift(2, 1, 1, 100)).toBe(0);
  });
});
