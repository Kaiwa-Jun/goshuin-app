import { JAPAN_MAP_HEIGHT, JAPAN_MAP_WIDTH, JAPAN_PREFECTURE_BOXES } from '@/constants/japanMap';
import {
  MAX_SCALE,
  MIN_SCALE,
  clampPan,
  panForPinch,
  pinchScale,
  touchDistance,
  zoomToPrefecture,
} from '@utils/japanMapZoom';

const WIDTH = 300;
const HEIGHT = (WIDTH * JAPAN_MAP_HEIGHT) / JAPAN_MAP_WIDTH;

describe('zoomToPrefecture', () => {
  it('小さい県ほど強く寄る', () => {
    expect(zoomToPrefecture('香川県', WIDTH).scale).toBeGreaterThan(
      zoomToPrefecture('岩手県', WIDTH).scale
    );
  });

  // 北海道のような大きい県でも、寄ったことが分かるだけは拡大する
  it('大きい県でも縮小しない', () => {
    for (const name of ['北海道', '岩手県', '福島県', '長野県']) {
      expect(zoomToPrefecture(name, WIDTH).scale).toBeGreaterThanOrEqual(MIN_SCALE);
    }
  });

  /*
   * 北海道や沖縄は地図の隅にある。素直に中心へ寄せると枠の外の空白が入る。
   * 移動量を頭打ちにして、拡大した地図が枠を必ず覆うようにする
   */
  it('端の県でも、枠の外の空白が見えない', () => {
    for (const name of ['北海道', '沖縄県', '青森県', '鹿児島県']) {
      const { scale, translateX, translateY } = zoomToPrefecture(name, WIDTH);
      const limitX = ((scale - 1) * WIDTH) / 2;
      const limitY = ((scale - 1) * HEIGHT) / 2;

      expect(Math.abs(translateX)).toBeLessThanOrEqual(limitX + 0.001);
      expect(Math.abs(translateY)).toBeLessThanOrEqual(limitY + 0.001);
    }
  });

  it('端でない県は、枠の真ん中に来る', () => {
    const name = '岐阜県';
    const box = JAPAN_PREFECTURE_BOXES[name];
    const { scale, translateX, translateY } = zoomToPrefecture(name, WIDTH);
    const k = WIDTH / JAPAN_MAP_WIDTH;

    // 拡大後の県の中心が、枠の中心に一致する
    const cx = scale * ((box.x + box.width / 2) * k - WIDTH / 2) + translateX + WIDTH / 2;
    const cy = scale * ((box.y + box.height / 2) * k - HEIGHT / 2) + translateY + HEIGHT / 2;

    expect(cx).toBeCloseTo(WIDTH / 2, 3);
    expect(cy).toBeCloseTo(HEIGHT / 2, 3);
  });
});

describe('指で動かすときの決まり', () => {
  it('全体より小さくは縮まない', () => {
    expect(pinchScale(1, 100, 10)).toBe(1);
    expect(pinchScale(2, 100, 1)).toBe(1);
  });

  it('寄りすぎない（形が粗くなるだけなので頭打ちにする）', () => {
    expect(pinchScale(4, 100, 10000)).toBe(MAX_SCALE);
  });

  it('指を広げた分だけ寄る', () => {
    expect(pinchScale(1, 100, 200)).toBe(2);
    expect(pinchScale(2, 100, 150)).toBe(3);
  });

  // 押さえないと、動かしたときに地図の外の地が見えて「落ちた」ように見える
  it('動かしても、枠の外の地が見えない', () => {
    const { x, y } = clampPan(2, { x: 9999, y: -9999 }, 300, 340);

    expect(x).toBe(150);
    expect(y).toBe(-170);
  });

  it('全体表示では動かせない', () => {
    expect(clampPan(1, { x: 50, y: 50 }, 300, 340)).toEqual({ x: 0, y: 0 });
  });

  /*
   * つまんだ場所を軸に寄る。枠の中心を軸に拡大されるので、つまんだ点が
   * 動かないように移動量を補正している
   */
  it('つまんだ場所が動かない', () => {
    const width = 300;
    const height = 340;
    const focus = { x: 40, y: 300 };
    const before = { x: 0, y: 0 };

    const after = panForPinch(before, focus, 1, 2, width, height);

    /*
     * 画面に出る位置は `中心 + 倍率 × (点 - 中心) + 移動量`。
     * つまむ前に focus に見えていた点が、拡大後も focus に残ることを確かめる
     */
    const shown = (point: number, center: number, scale: number, pan: number) =>
      center + scale * (point - center) + pan;
    const contentAt = (f: number, c: number) => c + (f - c - 0) / 1;

    expect(shown(contentAt(focus.x, width / 2), width / 2, 2, after.x)).toBeCloseTo(focus.x, 5);
    expect(shown(contentAt(focus.y, height / 2), height / 2, 2, after.y)).toBeCloseTo(focus.y, 5);
  });

  it('二本指が揃っていなければ距離は0', () => {
    expect(touchDistance([{ pageX: 0, pageY: 0 }])).toBe(0);
    expect(
      touchDistance([
        { pageX: 0, pageY: 0 },
        { pageX: 3, pageY: 4 },
      ])
    ).toBe(5);
  });
});
