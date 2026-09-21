import { scrollTargetToReveal, scrollTargetToShow } from '@utils/revealInScrollView';

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

describe('scrollTargetToShow', () => {
  // バリデーションエラーの欄まで連れていく用。reveal と違って上にも戻す
  const base = { blockY: 400, blockHeight: 120, viewportHeight: 600, currentOffset: 0 };

  it('すでに全部見えていれば動かさない', () => {
    expect(scrollTargetToShow(base)).toBeNull();
  });

  it('画面より上にある欄には戻る', () => {
    // 記録ボタンは画面下に固定されているので、下までスクロールしたまま
    // 押すと、一番上のスポット欄のエラーが見えない
    expect(scrollTargetToShow({ ...base, blockY: 0, blockHeight: 120, currentOffset: 500 })).toBe(
      0
    );
  });

  it('上に戻るときは上端に余白を残す', () => {
    expect(scrollTargetToShow({ ...base, blockY: 300, currentOffset: 500, margin: 16 })).toBe(284);
  });

  it('画面より下にある欄には進む', () => {
    // 下端 520 + 余白 16 が画面(600)に入る位置まで
    expect(scrollTargetToShow({ ...base, currentOffset: 0, viewportHeight: 300, margin: 16 })).toBe(
      236
    );
  });

  it('先頭の欄なら 0 より上には行かない', () => {
    expect(
      scrollTargetToShow({ ...base, blockY: 0, blockHeight: 100, currentOffset: 300, margin: 16 })
    ).toBe(0);
  });

  it('高さがまだ取れていなければ判断しない', () => {
    expect(scrollTargetToShow({ ...base, blockHeight: 0 })).toBeNull();
    expect(scrollTargetToShow({ ...base, viewportHeight: 0 })).toBeNull();
  });
});

describe('scrollTargetToShow: 動かす必要がないとき', () => {
  // 先頭の欄は margin のぶん目標が負になり、0 に丸めると今の位置と同じになる。
  // そこで scrollTo を呼ぶと、何も動かないアニメーションが走るだけ
  it('丸めた結果が今の位置と同じなら動かさない', () => {
    expect(
      scrollTargetToShow({
        blockY: 0,
        blockHeight: 120,
        viewportHeight: 600,
        currentOffset: 0,
        margin: 16,
      })
    ).toBeNull();
  });
});
