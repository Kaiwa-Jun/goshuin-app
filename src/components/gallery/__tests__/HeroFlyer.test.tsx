import React from 'react';
import { AccessibilityInfo, Animated } from 'react-native';
import { render, fireEvent, waitFor } from '@testing-library/react-native';

import { HeroFlyer } from '@components/gallery/HeroFlyer';

/** 一覧のタイル（正方形）と、その下の名前・日付の行 */
const SOURCE = { x: 16, y: 300, width: 118, height: 118 };
const SOURCE_TEXT = { x: 16, y: 422, width: 118, height: 32 };
/** 飛ぶ枠。タブバーのぶん画面より低い */
const CONTAINER = { x: 0, y: 0, width: 393, height: 769 };

function renderFlyer(props: Partial<React.ComponentProps<typeof HeroFlyer>> = {}) {
  const onDone = jest.fn();
  const onStart = jest.fn();
  const view = render(
    <HeroFlyer
      imageUrl="https://example.com/a.jpg"
      imageAspect={3 / 4}
      sourceRect={SOURCE}
      sourceTextRect={SOURCE_TEXT}
      spotName="小網神社"
      visitedAt="2026/01/02"
      memo={null}
      direction="in"
      onStart={onStart}
      onDone={onDone}
      {...props}
    />
  );
  return { ...view, onDone, onStart };
}

/** 枠の大きさが決まるまで何も描けない。実機では onLayout で決まる */
function layout(getByTestId: ReturnType<typeof render>['getByTestId']) {
  fireEvent(getByTestId('hero-flyer'), 'layout', { nativeEvent: { layout: CONTAINER } });
}

describe('HeroFlyer', () => {
  let timing: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
    jest
      .spyOn(AccessibilityInfo, 'addEventListener')
      .mockReturnValue({ remove: jest.fn() } as never);
    // 本物を回すと実時間ぶん待つことになる。掛かったかどうかだけ見る
    timing = jest.spyOn(Animated, 'timing').mockReturnValue({
      start: (cb?: (r: { finished: boolean }) => void) => cb?.({ finished: true }),
      stop: jest.fn(),
      reset: jest.fn(),
    } as unknown as Animated.CompositeAnimation);
  });

  afterEach(() => {
    timing.mockRestore();
  });

  it('枠が決まったら画像と文字を出す', () => {
    const { getByTestId, getAllByText } = renderFlyer();
    layout(getByTestId);

    expect(getByTestId('hero-image')).toBeTruthy();
    // 一覧の見た目と詳細の見た目の2枚を重ねて入れ替える
    expect(getAllByText('小網神社')).toHaveLength(2);
    expect(getAllByText('2026/01/02')).toHaveLength(2);
  });

  // 「飛ぶと決めた時」ではなく「動き出した時」。この差が無いと、写真を待つ間に
  // 一覧のタイルを隠すことになって穴があくか、隠さずに二重に見えるかのどちらかになる
  it('枠が決まるまでは動き出さない', () => {
    const { onStart } = renderFlyer();

    expect(onStart).not.toHaveBeenCalled();
  });

  it('動き出したら知らせる', async () => {
    const { getByTestId, onStart } = renderFlyer();
    layout(getByTestId);

    await waitFor(() => {
      expect(onStart).toHaveBeenCalled();
    });
  });

  it('着いたら知らせる', async () => {
    const { getByTestId, onDone } = renderFlyer();
    layout(getByTestId);

    await waitFor(() => {
      expect(onDone).toHaveBeenCalled();
    });
  });

  // 一覧がまだ写真を読めていないと縦横比が取れない。以前はそこで飛ぶのを
  // やめていたが、押したのに何も起きないのが一番情報が少ない。
  // よくある形を仮に置いて必ず飛ばす（Issue #192）
  it('縦横比が分からなくても、よくある形で飛ぶ', async () => {
    const { getByTestId, onDone } = renderFlyer({ imageAspect: null });
    layout(getByTestId);

    expect(getByTestId('hero-image')).toBeTruthy();
    await waitFor(() => {
      expect(onDone).toHaveBeenCalled();
    });
  });

  describe('視差効果を減らす設定', () => {
    beforeEach(() => {
      jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    });

    // 動きは消すが、詳細は開く
    it('飛ばさずに着いた扱いにする', async () => {
      const { getByTestId, onDone } = renderFlyer();
      await waitFor(() => expect(AccessibilityInfo.isReduceMotionEnabled).toHaveBeenCalled());
      layout(getByTestId);

      await waitFor(() => {
        expect(onDone).toHaveBeenCalled();
      });
      expect(timing).not.toHaveBeenCalled();
    });
  });
});
