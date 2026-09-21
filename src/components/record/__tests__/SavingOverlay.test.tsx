import React from 'react';
import { AccessibilityInfo, Animated, StyleSheet } from 'react-native';
import { render, waitFor } from '@testing-library/react-native';

import { SavingOverlay } from '@components/record/SavingOverlay';
import { colors } from '@theme/colors';

/** ループは本物を回すと後始末が読みづらいので、呼ばれたかどうかだけ見る */
function stubbedAnimation() {
  return {
    start: jest.fn(),
    stop: jest.fn(),
    reset: jest.fn(),
  } as unknown as Animated.CompositeAnimation;
}

describe('SavingOverlay', () => {
  let loop: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
    jest
      .spyOn(AccessibilityInfo, 'addEventListener')
      .mockReturnValue({ remove: jest.fn() } as never);
    loop = jest.spyOn(Animated, 'loop').mockReturnValue(stubbedAnimation());
  });

  afterEach(() => {
    loop.mockRestore();
  });

  it('保存していないときは何も出さない', () => {
    const { queryByTestId } = render(<SavingOverlay visible={false} total={3} saved={0} />);

    expect(queryByTestId('saving-overlay')).toBeNull();
  });

  it('保存中は覆いと「保存中」を出す', () => {
    const { getByTestId, getByText } = render(<SavingOverlay visible total={3} saved={0} />);

    expect(getByTestId('saving-overlay')).toBeTruthy();
    // 1文字ずつ動かすため文字は分かれている。読めることだけ見る
    expect(getByText('保')).toBeTruthy();
    expect(getByText('存')).toBeTruthy();
    expect(getByText('中')).toBeTruthy();
  });

  // 点の数が枚数そのもの。波が「生きている」だけでなく進捗を兼ねる（Issue #190）
  it('点は写真の枚数だけ並ぶ', () => {
    const { getByTestId, queryByTestId } = render(<SavingOverlay visible total={5} saved={0} />);

    expect(getByTestId('saving-dot-0')).toBeTruthy();
    expect(getByTestId('saving-dot-4')).toBeTruthy();
    expect(queryByTestId('saving-dot-5')).toBeNull();
  });

  it('保存できた分だけ点が染まる', () => {
    const { getByTestId } = render(<SavingOverlay visible total={5} saved={2} />);

    const filled = StyleSheet.flatten(getByTestId('saving-dot-1').props.style);
    const empty = StyleSheet.flatten(getByTestId('saving-dot-2').props.style);

    expect(filled.backgroundColor).toBe(colors.primary[500]);
    expect(empty.backgroundColor).not.toBe(colors.primary[500]);
  });

  it('枚数を数字でも出す（波を見落としても読める）', () => {
    const { getByTestId } = render(<SavingOverlay visible total={5} saved={2} />);

    expect(getByTestId('saving-count').props.children).toBe('2 / 5枚');
  });

  // 1枚のときも同じ見た目で通す。特別扱いを作らない
  it('1枚でも点は1つ出る', () => {
    const { getByTestId, queryByTestId } = render(<SavingOverlay visible total={1} saved={0} />);

    expect(getByTestId('saving-dot-0')).toBeTruthy();
    expect(queryByTestId('saving-dot-1')).toBeNull();
  });

  describe('視差効果を減らす設定', () => {
    beforeEach(() => {
      jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    });

    // 動きは消すが、進捗という機能は落とさない
    it('波は打たないが、点と枚数は出る', async () => {
      // 実際の順番に合わせる。覆いは画面が出てしばらく経ってから現れるので、
      // 出るころには設定を読み終えている
      const { rerender, findByTestId, getByTestId } = render(
        <SavingOverlay visible={false} total={3} saved={0} />
      );
      await waitFor(() => expect(AccessibilityInfo.isReduceMotionEnabled).toHaveBeenCalled());

      rerender(<SavingOverlay visible total={3} saved={1} />);
      await findByTestId('saving-overlay');

      expect(loop).not.toHaveBeenCalled();
      expect(StyleSheet.flatten(getByTestId('saving-dot-0').props.style).backgroundColor).toBe(
        colors.primary[500]
      );
      expect(getByTestId('saving-count').props.children).toBe('1 / 3枚');
    });
  });
});
