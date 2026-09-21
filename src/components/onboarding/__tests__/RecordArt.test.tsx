import { act, render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { RecordArt } from '@components/onboarding/RecordArt';

/** Animated の値は、描かれた style の中にノードとして入っている */
const opacityOf = (el: { props: { style: unknown } }) => {
  const flat = StyleSheet.flatten(el.props.style) as { opacity?: unknown };
  const o = flat.opacity as { __getValue?: () => number } | number | undefined;
  return typeof o === 'number' ? o : (o?.__getValue?.() ?? 0);
};

describe('RecordArt', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  /*
   * 御朱印が一度も出ないまま地図に飛ぶ不具合があった。
   * 同じ値を2本の timing で取り合っていたのが原因で、**テストは緑のまま**
   * だった（出るかどうかを誰も見ていなかった）
   */
  it('地図より先に、御朱印が見えるところまで出る', () => {
    const { getByTestId } = render(<RecordArt width={340} active />);

    act(() => {
      jest.advanceTimersByTime(900);
    });

    expect(opacityOf(getByTestId('onboarding-goshuin'))).toBeGreaterThan(0.8);
    // このときまだ地図は出ていない
    expect(opacityOf(getByTestId('onboarding-minimap'))).toBeLessThan(0.1);
  });

  it('御朱印が引っ込んでから、地図とピンが出る', () => {
    const { getByTestId } = render(<RecordArt width={340} active />);

    act(() => {
      jest.advanceTimersByTime(3200);
    });

    expect(opacityOf(getByTestId('onboarding-goshuin'))).toBeLessThan(0.1);
    expect(opacityOf(getByTestId('onboarding-minimap'))).toBeGreaterThan(0.9);
    expect(opacityOf(getByTestId('onboarding-pin'))).toBeGreaterThan(0.9);
  });

  // 見えていない画は動かさない。戻ってきたときに最初から出し直す
  it('その画にいないときは、何も出さない', () => {
    const { getByTestId } = render(<RecordArt width={340} active={false} />);

    act(() => {
      jest.advanceTimersByTime(3200);
    });

    expect(opacityOf(getByTestId('onboarding-goshuin'))).toBe(0);
    expect(opacityOf(getByTestId('onboarding-minimap'))).toBe(0);
  });
});
