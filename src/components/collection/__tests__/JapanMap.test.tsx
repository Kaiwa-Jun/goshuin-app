import { act, fireEvent, render } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';

import {
  JapanMap,
  MAP_ZOOM_MS,
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

  /*
   * 全体表示のままでは香川や大阪は指より小さい。1回目は寄るだけにして、
   * 2回目で選ぶ。1回目が大雑把でよくなるのが狙い
   */
  describe('タップで寄ってから選ぶ', () => {
    it('1回目のタップでは選ばない', () => {
      const onPressPrefecture = jest.fn();
      const { getByTestId } = setup({ onPressPrefecture });

      fireEvent.press(getByTestId('prefecture-和歌山県'));

      expect(onPressPrefecture).not.toHaveBeenCalled();
      expect(getByTestId('japan-map-reset')).toBeTruthy();
    });

    it('寄ったあとのタップで選ぶ', () => {
      const onPressPrefecture = jest.fn();
      const { getByTestId } = setup({ onPressPrefecture });
      fireEvent.press(getByTestId('prefecture-和歌山県'));

      fireEvent.press(getByTestId('prefecture-奈良県'));

      expect(onPressPrefecture).toHaveBeenCalledWith('奈良県');
    });

    it('「全体に戻す」で、また寄るところからやり直せる', async () => {
      jest.useFakeTimers();
      const onPressPrefecture = jest.fn();
      const { getByTestId, queryByTestId } = setup({ onPressPrefecture });
      fireEvent.press(getByTestId('prefecture-和歌山県'));

      fireEvent.press(getByTestId('japan-map-reset'));
      await act(async () => {
        jest.advanceTimersByTime(MAP_ZOOM_MS + 10);
      });

      expect(queryByTestId('japan-map-reset')).toBeNull();
      fireEvent.press(getByTestId('prefecture-北海道'));
      expect(onPressPrefecture).not.toHaveBeenCalled();
      jest.useRealTimers();
    });

    it('全体表示のときは、読み上げでも「寄る」と分かる', () => {
      const { getByTestId } = setup();

      expect(getByTestId('prefecture-香川県').props.accessibilityLabel).toContain('まわりに寄る');
    });
  });

  it('読み上げで、色に頼らず枚数が分かる', () => {
    const { getByTestId } = setup({ stampCountByPrefecture: new Map([['東京都', 12]]) });

    expect(getByTestId('prefecture-東京都').props.accessibilityLabel).toContain('東京都、12枚');
    expect(getByTestId('prefecture-高知県').props.accessibilityLabel).toContain('高知県、まだ');
  });

  // 47県が1要素にまとめられると、県ごとの読み上げが消える
  it('地図のコンテナを1つの要素にまとめない', () => {
    const { getByTestId } = setup();

    expect(getByTestId('japan-map').props.accessible).toBe(false);
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
