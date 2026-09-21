import { JAPAN_MAP_HEIGHT, JAPAN_MAP_WIDTH, JAPAN_PREFECTURE_BOXES } from '@/constants/japanMap';
import { MIN_SCALE, zoomToPrefecture } from '@utils/japanMapZoom';

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
