import { scrollTargetToReveal } from '@utils/revealInScrollView';

const base = { blockY: 460, blockHeight: 260, viewportHeight: 600, currentOffset: 0 };

describe('scrollTargetToReveal', () => {
  it('下端が入る分だけ動かす。要素を最上部に持ち上げない', () => {
    // 下端 720 / 画面 600 → 120 動かせば足りる。blockY(460) までは動かさない
    expect(scrollTargetToReveal(base)).toBe(120);
  });

  it('下端に余白を残せる', () => {
    expect(scrollTargetToReveal({ ...base, margin: 16 })).toBe(136);
  });

  it('すでに見えていれば動かさない', () => {
    expect(scrollTargetToReveal({ ...base, currentOffset: 200 })).toBeNull();
    expect(scrollTargetToReveal({ ...base, currentOffset: 120 })).toBeNull();
  });

  it('上に戻す方向には動かさない', () => {
    // 画面より小さい位置にある要素。負の目標にはしない
    expect(scrollTargetToReveal({ ...base, blockY: 0, blockHeight: 100 })).toBeNull();
  });

  it('高さがまだ取れていなければ判断しない', () => {
    expect(scrollTargetToReveal({ ...base, blockHeight: 0 })).toBeNull();
    expect(scrollTargetToReveal({ ...base, viewportHeight: 0 })).toBeNull();
  });

  it('画面より高い要素は、下端を優先して見せる', () => {
    // ピッカー + ボタンが画面より高いケース。上が切れても操作部が見える方がよい
    const target = scrollTargetToReveal({ ...base, blockY: 100, blockHeight: 800 });
    expect(target).toBe(300);
  });
});
