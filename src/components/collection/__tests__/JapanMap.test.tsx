import { act, fireEvent, render } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';

import {
  JapanMap,
  REVEAL_STEP_MS,
  prefectureTier,
  revealOrder,
} from '@components/collection/JapanMap';
import { JAPAN_PREFECTURE_NAMES } from '@/constants/japanMap';
import { colors } from '@theme/colors';

type MapProps = React.ComponentProps<typeof JapanMap>;

const setup = (props: Partial<MapProps> = {}) =>
  render(
    <JapanMap
      stampCountByPrefecture={new Map()}
      onPressPrefecture={jest.fn()}
      width={300}
      {...props}
    />
  );

/*
 * react-native-svg は fill を ARGB の数値に正規化する（'#E3E4E8' → 4293125352）。
 * 描画されている実体はこちらなので、期待値の方を同じ形に変換して比べる
 */
const asPayload = (hex: string) => 0xff000000 + parseInt(hex.slice(1), 16);
const fillOf = (el: { props: { fill: { payload: number } } }) => el.props.fill?.payload;
const fill = (hex: string) => asPayload(hex);

describe('prefectureTier', () => {
  it.each([
    [0, 'empty'],
    [1, 'tier1'],
    [2, 'tier1'],
    [3, 'tier2'],
    [5, 'tier2'],
    [6, 'tier3'],
    [40, 'tier3'],
  ])('%i枚なら %s', (count, expected) => {
    expect(prefectureTier(count)).toBe(expected);
  });

  it('境目が 1 / 3 / 6 枚にある', () => {
    expect(prefectureTier(2)).not.toBe(prefectureTier(3));
    expect(prefectureTier(5)).not.toBe(prefectureTier(6));
  });
});

describe('revealOrder', () => {
  // 旅が進むように南から塗る。viewBox は上が北なので y の大きい順
  it('南から北へ並べる', () => {
    expect(revealOrder(['北海道', '沖縄県', '東京都'])).toEqual(['沖縄県', '東京都', '北海道']);
  });
});

describe('JapanMap', () => {
  it('47県ぶんの形を描く', () => {
    const { getAllByTestId } = setup();

    const paths = getAllByTestId(/^prefecture-/);
    expect(paths).toHaveLength(47);
    expect(new Set(paths.map(p => p.props.testID.replace('prefecture-', '')))).toEqual(
      new Set(JAPAN_PREFECTURE_NAMES)
    );
  });

  it('枚数で濃さが変わる', () => {
    const { getByTestId } = setup({
      stampCountByPrefecture: new Map([
        ['東京都', 0],
        ['宮城県', 2],
        ['京都府', 4],
        ['大阪府', 9],
      ]),
    });

    expect(fillOf(getByTestId('prefecture-東京都'))).toBe(fill(colors.prefectureFill.empty));
    expect(fillOf(getByTestId('prefecture-宮城県'))).toBe(fill(colors.prefectureFill.tier1));
    expect(fillOf(getByTestId('prefecture-京都府'))).toBe(fill(colors.prefectureFill.tier2));
    expect(fillOf(getByTestId('prefecture-大阪府'))).toBe(fill(colors.prefectureFill.tier3));
  });

  it('タップするとその県名が渡る', () => {
    const onPressPrefecture = jest.fn();
    const { getByTestId } = setup({ onPressPrefecture });

    fireEvent.press(getByTestId('prefecture-和歌山県'));

    expect(onPressPrefecture).toHaveBeenCalledWith('和歌山県');
  });

  /*
   * 地図アプリと同じ操作にする。二本指で広げて寄り、一本指で動かす。
   * 計算そのものは utils/japanMapZoom のテストで見ている
   */
  describe('指で広げて寄る', () => {
    const touch = (x: number, y: number) => ({ pageX: x, pageY: y, locationX: x, locationY: y });
    const shouldSetOf = (el: unknown) =>
      (el as { props: Record<string, unknown> }).props.onMoveShouldSetResponder as (
        e: unknown,
        g: unknown
      ) => boolean;

    /*
     * ⚠️ ピンチそのもの（広げたら寄る）はここでは見ていない。PanResponder の
     * ハンドラを直接呼ぶには内部の touchHistory を作り込む必要があり、
     * 実装ではなく PanResponder の形に依存したテストになるため。
     * 倍率と移動量の計算は utils/__tests__/japanMapZoom.test.ts で、
     * 指を横取りしない条件はここで見ている。動きの確認は実機で。
     */

    // 全体表示では引き取らない。引き取ると画面の縦スクロールが効かなくなる
    it('全体表示の一本指では、指の動きを横取りしない', () => {
      const { getByTestId } = setup();
      const shouldSet = shouldSetOf(getByTestId('japan-map'));

      expect(shouldSet({ nativeEvent: { touches: [touch(0, 0)] } }, { dx: 0, dy: 40 })).toBe(false);
    });

    it('二本指なら、全体表示でも引き取る', () => {
      const { getByTestId } = setup();
      const shouldSet = shouldSetOf(getByTestId('japan-map'));

      expect(
        shouldSet({ nativeEvent: { touches: [touch(0, 0), touch(50, 0)] } }, { dx: 0, dy: 0 })
      ).toBe(true);
    });
  });

  describe('塗り広がり', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    it('animate のとき、南から順に塗られる', async () => {
      jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false as never);
      const { getByTestId } = setup({
        animate: true,
        stampCountByPrefecture: new Map([
          ['北海道', 3],
          ['沖縄県', 3],
        ]),
      });
      await act(async () => {});

      // まだどちらも塗られていない
      expect(fillOf(getByTestId('prefecture-沖縄県'))).toBe(fill(colors.prefectureFill.empty));

      await act(async () => {
        jest.advanceTimersByTime(REVEAL_STEP_MS);
      });
      expect(fillOf(getByTestId('prefecture-沖縄県'))).toBe(fill(colors.prefectureFill.tier2));
      expect(fillOf(getByTestId('prefecture-北海道'))).toBe(fill(colors.prefectureFill.empty));

      await act(async () => {
        jest.advanceTimersByTime(REVEAL_STEP_MS);
      });
      expect(fillOf(getByTestId('prefecture-北海道'))).toBe(fill(colors.prefectureFill.tier2));
    });

    it('動きを減らす設定なら、最後の状態をすぐ出す', async () => {
      jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true as never);
      const { getByTestId } = setup({
        animate: true,
        stampCountByPrefecture: new Map([['沖縄県', 3]]),
      });

      await act(async () => {});

      expect(fillOf(getByTestId('prefecture-沖縄県'))).toBe(fill(colors.prefectureFill.tier2));
    });
  });
});

/*
 * iOS の ScrollView はネイティブのジェスチャなので、JS 側で指を引き取っても
 * 一緒に動く。指が乗っている間だけ親のスクロールを止める
 */
describe('親のスクロールを止める', () => {
  const touchEvent = (count: number) => ({
    nativeEvent: { touches: Array.from({ length: count }, () => ({ pageX: 0, pageY: 0 })) },
  });
  const touchStartOf = (el: unknown) =>
    (el as { props: Record<string, unknown> }).props.onTouchStart as (e: unknown) => void;
  const touchEndOf = (el: unknown) =>
    (el as { props: Record<string, unknown> }).props.onTouchEnd as (e: unknown) => void;

  it('二本指が触れたら止めて、離れたら戻す', () => {
    const onInteraction = jest.fn();
    const { getByTestId } = setup({ onInteraction });
    const map = getByTestId('japan-map');

    touchStartOf(map)(touchEvent(2));
    expect(onInteraction).toHaveBeenLastCalledWith(true);

    touchEndOf(map)(touchEvent(0));
    expect(onInteraction).toHaveBeenLastCalledWith(false);
  });

  // 全体表示の一本指は縦スクロールに使う。止めてはいけない
  it('全体表示の一本指では止めない', () => {
    const onInteraction = jest.fn();
    const { getByTestId } = setup({ onInteraction });

    touchStartOf(getByTestId('japan-map'))(touchEvent(1));

    expect(onInteraction).not.toHaveBeenCalled();
  });

  it('同じ状態を何度も伝えない', () => {
    const onInteraction = jest.fn();
    const { getByTestId } = setup({ onInteraction });
    const map = getByTestId('japan-map');

    touchStartOf(map)(touchEvent(2));
    touchStartOf(map)(touchEvent(2));

    expect(onInteraction).toHaveBeenCalledTimes(1);
  });

  // 止めたまま画面から外れると、二度と縦に動かせなくなる
  it('操作の途中で画面から外れても、スクロールを戻す', () => {
    const onInteraction = jest.fn();
    const { getByTestId, unmount } = setup({ onInteraction });
    touchStartOf(getByTestId('japan-map'))(touchEvent(2));

    unmount();

    expect(onInteraction).toHaveBeenLastCalledWith(false);
  });
});
