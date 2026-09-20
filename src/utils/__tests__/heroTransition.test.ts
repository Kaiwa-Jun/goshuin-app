import { heroFlight, anchorDelta } from '@utils/heroTransition';

/** 実測値。詳細の画像は全幅 393pt、御朱印の写真は 3:4 だった（Issue #192） */
const TARGET = { x: 0, y: 122, width: 393, height: 524 };
const ASPECT = 393 / 524;

/** 一覧のタイルは正方形 */
const tileAt = (x: number, y: number) => ({ x, y, width: 124, height: 124 });

describe('heroFlight', () => {
  it('外枠は目的地から見た元の大きさまで縮む', () => {
    const f = heroFlight(tileAt(16, 300), TARGET, ASPECT)!;

    expect(f.boxScaleX).toBeCloseTo(124 / 393, 5);
    expect(f.boxScaleY).toBeCloseTo(124 / 524, 5);
  });

  // 外枠を縦に強く縮めるぶん、中身が潰れる。その逆を中で掛けて
  // 「正方形に切り抜かれた状態」を作る。これが無いと画像が縦に潰れて出る
  it('中身は外枠の潰れを打ち消して、切り抜かれた見た目になる', () => {
    const f = heroFlight(tileAt(16, 300), TARGET, ASPECT)!;

    // 3:4 の写真を正方形で cover すると、高さは幅の 4/3 になる
    expect(f.contentScaleY).toBeCloseTo(4 / 3, 5);

    // 画面上の中身の大きさ = 呼び名の大きさ × 中の倍率 × 外枠の倍率
    expect(TARGET.height * f.contentScaleY * f.boxScaleY).toBeCloseTo(124 * (4 / 3), 3);
    expect(TARGET.width * f.boxScaleX).toBeCloseTo(124, 3);
  });

  it('元も目的地も同じ形なら、中身の補正は要らない', () => {
    const square = { x: 0, y: 0, width: 300, height: 300 };
    const f = heroFlight(tileAt(16, 300), square, 1)!;

    expect(f.contentScaleY).toBeCloseTo(1, 5);
  });

  // 押した御朱印が左列でも右列でも、スクロールして上下どこにあっても繋がること
  it('どの位置から飛んでも、動く距離だけが変わって拡大率は変わらない', () => {
    const left = heroFlight(tileAt(16, 300), TARGET, ASPECT)!;
    const right = heroFlight(tileAt(253, 700), TARGET, ASPECT)!;

    expect(right.boxScaleX).toBeCloseTo(left.boxScaleX, 5);
    expect(right.boxScaleY).toBeCloseTo(left.boxScaleY, 5);
    expect(right.contentScaleY).toBeCloseTo(left.contentScaleY, 5);
    expect(right.translateX).not.toBeCloseTo(left.translateX, 1);
    expect(right.translateY).not.toBeCloseTo(left.translateY, 1);
  });

  it('中心どうしが重なるように動かす', () => {
    const f = heroFlight(tileAt(16, 300), TARGET, ASPECT)!;

    // タイルの中心 (78, 362) と 目的地の中心 (196.5, 384)
    expect(f.translateX).toBeCloseTo(16 + 62 - 196.5, 3);
    expect(f.translateY).toBeCloseTo(300 + 62 - (122 + 262), 3);
  });

  // 画像の大きさがまだ取れていないと目的地が決まらない。
  // 0 で割って NaN を transform に渡すと画面が消える
  it('大きさが取れていなければ諦める', () => {
    expect(heroFlight(tileAt(16, 300), { x: 0, y: 0, width: 0, height: 0 }, ASPECT)).toBeNull();
    expect(heroFlight({ x: 0, y: 0, width: 0, height: 0 }, TARGET, ASPECT)).toBeNull();
    expect(heroFlight(tileAt(16, 300), TARGET, 0)).toBeNull();
  });
});

describe('anchorDelta', () => {
  // 文字は左端と下端をそろえる。上端でそろえると、一覧と詳細で行の高さが
  // 違うぶん、着いた後に跳ねる
  it('基準点どうしの差を返す', () => {
    const d = anchorDelta({ x: 16, y: 462 }, { x: 16, y: 721 });

    expect(d.translateX).toBe(0);
    expect(d.translateY).toBe(-259);
  });
});
