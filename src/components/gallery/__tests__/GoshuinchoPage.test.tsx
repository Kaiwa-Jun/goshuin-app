import React from 'react';
import { render, fireEvent, act, within } from '@testing-library/react-native';
import { Animated, Easing, StyleSheet } from 'react-native';
import { GoshuinchoPage, PEEK_OPACITY } from '@components/gallery/GoshuinchoPage';
import {
  isLoadingClockRunning,
  loadingClock,
  resetLoadingClockForTests,
} from '@components/gallery/loadingClock';
import { colors } from '@theme/colors';
import { borderRadius } from '@theme/spacing';
import { typography } from '@theme/typography';

const flatten = (node: { props: { style?: unknown } }) =>
  StyleSheet.flatten(node.props.style) as Record<string, unknown>;

const stampProps = {
  variant: 'stamp' as const,
  width: 265,
  isCurrent: true,
  onPress: jest.fn(),
  stampId: 'stamp-1',
  imageUrl: 'https://example.com/stamp-1.jpg',
  spotName: '浅草寺',
  visitedAt: '2026-05-03',
};

const blankProps = {
  variant: 'blank' as const,
  width: 265,
  isCurrent: true,
  onPress: jest.fn(),
};

describe('GoshuinchoPage', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('御朱印ページ', () => {
    it('御朱印の画像を表示する', () => {
      const { getByTestId } = render(<GoshuinchoPage {...stampProps} />);
      expect(getByTestId('flip-page-image-stamp-1')).toBeTruthy();
    });

    it('フッターにスポット名を表示する', () => {
      const { getByTestId } = render(<GoshuinchoPage {...stampProps} />);
      expect(getByTestId('flip-page-spot-name-stamp-1').props.children).toBe('浅草寺');
    });

    it('フッターに和暦の訪問日を表示する', () => {
      const { getByTestId } = render(<GoshuinchoPage {...stampProps} />);
      expect(getByTestId('flip-page-date-stamp-1').props.children).toBe('令和8年5月3日');
    });

    it('訪問日が読めないときは日付行を描画しない', () => {
      const { queryByTestId, getByTestId } = render(
        <GoshuinchoPage {...stampProps} visitedAt="not-a-date" />
      );
      expect(queryByTestId('flip-page-date-stamp-1')).toBeNull();
      expect(getByTestId('flip-page-spot-name-stamp-1')).toBeTruthy();
    });

    it('タップすると onPress が呼ばれる', () => {
      const { getByTestId } = render(<GoshuinchoPage {...stampProps} />);
      fireEvent.press(getByTestId('flip-page-stamp-1'));
      expect(stampProps.onPress).toHaveBeenCalledTimes(1);
    });

    it('画像の resizeMode が contain である（御朱印の縦横比を潰さない）', () => {
      const { getByTestId } = render(<GoshuinchoPage {...stampProps} />);
      expect(getByTestId('flip-page-image-stamp-1').props.resizeMode).toBe('contain');
    });
  });

  describe('白紙ページ', () => {
    it('flip-blank-page として描画される', () => {
      const { getByTestId } = render(<GoshuinchoPage {...blankProps} />);
      expect(getByTestId('flip-blank-page')).toBeTruthy();
    });

    it('案内文を表示する', () => {
      const { getByText } = render(<GoshuinchoPage {...blankProps} />);
      expect(getByText('ここに御朱印を追加する')).toBeTruthy();
    });

    it('タップすると onPress が呼ばれる', () => {
      const { getByTestId } = render(<GoshuinchoPage {...blankProps} />);
      fireEvent.press(getByTestId('flip-blank-page'));
      expect(blankProps.onPress).toHaveBeenCalledTimes(1);
    });

    it('御朱印の画像もフッターも持たない', () => {
      const { queryByTestId } = render(<GoshuinchoPage {...blankProps} />);
      expect(queryByTestId('flip-page-image-stamp-1')).toBeNull();
      expect(queryByTestId('flip-page-spot-name-stamp-1')).toBeNull();
    });
  });

  describe('視覚仕様', () => {
    // 紙面は「紙」であって画面の地ではない。地の色を動かしても白のまま
    it('紙面の背景が白である', () => {
      const { getByTestId } = render(<GoshuinchoPage {...stampProps} />);
      expect(flatten(getByTestId('flip-page-surface-stamp-1')).backgroundColor).toBe(colors.white);
    });

    it('紙面の枠線が gray[200] / 1px である', () => {
      const { getByTestId } = render(<GoshuinchoPage {...stampProps} />);
      const style = flatten(getByTestId('flip-page-surface-stamp-1'));
      expect(style.borderColor).toBe(colors.gray[200]);
      expect(style.borderWidth).toBe(1);
    });

    it('紙面の角丸が borderRadius.lg である', () => {
      const { getByTestId } = render(<GoshuinchoPage {...stampProps} />);
      expect(flatten(getByTestId('flip-page-surface-stamp-1')).borderRadius).toBe(borderRadius.lg);
    });

    it('覗いているページの opacity が PEEK_OPACITY である', () => {
      const { getByTestId } = render(<GoshuinchoPage {...stampProps} isCurrent={false} />);
      expect(flatten(getByTestId('flip-page-stamp-1')).opacity).toBe(PEEK_OPACITY);
    });

    it('中央のページに opacity の減衰が無い', () => {
      const { getByTestId } = render(<GoshuinchoPage {...stampProps} isCurrent />);
      const opacity = flatten(getByTestId('flip-page-stamp-1')).opacity;
      expect(opacity === undefined || opacity === 1).toBe(true);
    });

    it('白紙ページの案内文が gray[400] / bodySmall である', () => {
      const { getByText } = render(<GoshuinchoPage {...blankProps} />);
      const style = flatten(getByText('ここに御朱印を追加する'));
      expect(style.color).toBe(colors.gray[400]);
      expect(style.fontSize).toBe(typography.bodySmall.fontSize);
    });

    it('フッターのスポット名が gray[800] / bodySmall である', () => {
      const { getByTestId } = render(<GoshuinchoPage {...stampProps} />);
      const style = flatten(getByTestId('flip-page-spot-name-stamp-1'));
      expect(style.color).toBe(colors.gray[800]);
      expect(style.fontSize).toBe(typography.bodySmall.fontSize);
    });

    it('フッターの日付が gray[500] / caption である', () => {
      const { getByTestId } = render(<GoshuinchoPage {...stampProps} />);
      const style = flatten(getByTestId('flip-page-date-stamp-1'));
      expect(style.color).toBe(colors.gray[500]);
      expect(style.fontSize).toBe(typography.caption.fontSize);
    });

    it('ページの幅が width プロップに従う', () => {
      const { getByTestId } = render(<GoshuinchoPage {...stampProps} width={300} />);
      expect(flatten(getByTestId('flip-page-stamp-1')).width).toBe(300);
    });
  });
});

describe('GoshuinchoPage 読み込み中（Issue #275）', () => {
  /** 下地は読み上げない（飾り）ので、既定の検索からは外れる。外れたものも探す */
  const hidden = { includeHiddenElements: true };

  type Anim = { start: jest.Mock; stop: jest.Mock; reset: jest.Mock };
  const stub = (): Anim => ({ start: jest.fn(), stop: jest.fn(), reset: jest.fn() });

  let loops: Anim[];
  /** 時計ではない timing（下地のふわっと）。設定とスタブを控える */
  let fades: { config: Animated.TimingAnimationConfig; anim: Anim }[];
  let loopSpy: jest.SpyInstance;
  let timingSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    resetLoadingClockForTests();
    loops = [];
    fades = [];
    loopSpy = jest.spyOn(Animated, 'loop').mockImplementation(() => {
      const anim = stub();
      loops.push(anim);
      return anim as unknown as Animated.CompositeAnimation;
    });
    timingSpy = jest.spyOn(Animated, 'timing').mockImplementation((value, config) => {
      const anim = stub();
      if (value !== loadingClock) fades.push({ config, anim });
      return anim as unknown as Animated.CompositeAnimation;
    });
  });

  afterEach(() => {
    loopSpy.mockRestore();
    timingSpy.mockRestore();
    act(() => resetLoadingClockForTests());
  });

  /** ふわっとが消え終わった知らせ（HeroFlyer.test.tsx と同じ進め方） */
  const finishFade = (index = fades.length - 1) =>
    act(() => {
      const done = fades[index].anim.start.mock.calls[0][0] as (r: { finished: boolean }) => void;
      done({ finished: true });
    });

  const loaded = { nativeEvent: { source: { width: 600, height: 800 } } };

  /** 描いた値を読む。ノードならその値、値そのものならそれ */
  const read = (value: unknown): number => {
    const v =
      value && typeof value === 'object' && '__getValue' in value
        ? (value as { __getValue: () => unknown }).__getValue()
        : value;
    return typeof v === 'string' ? parseFloat(v) : (v as number);
  };
  const rotateYOf = (el: { props: { style?: unknown } }) => {
    const transform = (flatten(el).transform ?? []) as Record<string, unknown>[];
    return read(transform.find(t => 'rotateY' in t)?.rotateY);
  };

  const onImageLoad = jest.fn();
  const flipProps = { ...stampProps, loadingBook: 'flip' as const, onImageLoad };

  describe('写真が届くまで（AC-14）', () => {
    it('紙の中の写真の上に下地を重ねる', () => {
      const { getByTestId, getAllByTestId } = render(<GoshuinchoPage {...flipProps} />);

      expect(
        within(getByTestId('flip-page-surface-stamp-1')).getByTestId(
          'flip-page-loading-stamp-1',
          hidden
        )
      ).toBeTruthy();
      expect(
        getAllByTestId(/^flip-page-(image|loading)-stamp-1$/, hidden).map(el => el.props.testID)
      ).toEqual(['flip-page-image-stamp-1', 'flip-page-loading-stamp-1']);
    });

    it('下地の中に地・枠・本がある', () => {
      const { getByTestId } = render(<GoshuinchoPage {...flipProps} />);
      const cover = within(getByTestId('flip-page-loading-stamp-1', hidden));

      expect(cover.getByTestId('flip-page-loading-stamp-1-ground', hidden)).toBeTruthy();
      expect(cover.getByTestId('flip-page-loading-stamp-1-frame', hidden)).toBeTruthy();
      expect(cover.getByTestId('flip-page-loading-stamp-1-book', hidden)).toBeTruthy();
    });

    // 飾りなので、押せず・読み上げない
    it('下地は触れず、読み上げない', () => {
      const { getByTestId } = render(<GoshuinchoPage {...flipProps} />);

      expect(getByTestId('flip-page-loading-stamp-1', hidden).props).toEqual(
        expect.objectContaining({
          pointerEvents: 'none',
          accessibilityElementsHidden: true,
          importantForAccessibility: 'no-hide-descendants',
        })
      );
    });

    it('めくる本があるので時計が回る', () => {
      render(<GoshuinchoPage {...flipProps} />);

      expect(isLoadingClockRunning()).toBe(true);
    });
  });

  describe('写真が届いたら（AC-15）', () => {
    it('下地を 0.25秒でふわっと消す', () => {
      const { getByTestId } = render(<GoshuinchoPage {...flipProps} />);
      fireEvent(getByTestId('flip-page-image-stamp-1'), 'load', loaded);

      expect(fades).toHaveLength(1);
      expect(fades[0].config).toEqual(
        expect.objectContaining({ toValue: 0, duration: 250, useNativeDriver: true })
      );
      const easing = fades[0].config.easing as (t: number) => number;
      expect(easing(0.5)).toBeCloseTo(Easing.bezier(0.25, 0.1, 0.25, 1)(0.5), 6);
    });

    it('写真の実寸は今までどおり知らせる', () => {
      const { getByTestId } = render(<GoshuinchoPage {...flipProps} />);
      fireEvent(getByTestId('flip-page-image-stamp-1'), 'load', loaded);

      expect(onImageLoad).toHaveBeenCalledTimes(1);
      expect(onImageLoad).toHaveBeenCalledWith(600, 800);
    });

    // 届いた瞬間に離すと、最後の1枚のときに消えている間の本の紙が途中で固まる
    it('消え終わるまでは下地を残し、時計も回し続ける', () => {
      const { getByTestId } = render(<GoshuinchoPage {...flipProps} />);
      fireEvent(getByTestId('flip-page-image-stamp-1'), 'load', loaded);

      expect(getByTestId('flip-page-loading-stamp-1', hidden)).toBeTruthy();
      expect(isLoadingClockRunning()).toBe(true);
    });

    it('消え終わったら下地を外し、時計を止める', () => {
      const { getByTestId, queryByTestId } = render(<GoshuinchoPage {...flipProps} />);
      fireEvent(getByTestId('flip-page-image-stamp-1'), 'load', loaded);
      finishFade();

      expect(queryByTestId('flip-page-loading-stamp-1', hidden)).toBeNull();
      expect(isLoadingClockRunning()).toBe(false);
    });
  });

  describe('写真が届かなかったら（AC-16）', () => {
    it('同じようにふわっと消えて、今と同じ白い紙に戻る', () => {
      const { getByTestId, queryByTestId } = render(<GoshuinchoPage {...flipProps} />);
      fireEvent(getByTestId('flip-page-image-stamp-1'), 'error');

      expect(fades).toHaveLength(1);
      expect(fades[0].config).toEqual(
        expect.objectContaining({ toValue: 0, duration: 250, useNativeDriver: true })
      );
      finishFade();

      expect(queryByTestId('flip-page-loading-stamp-1', hidden)).toBeNull();
      expect(flatten(getByTestId('flip-page-surface-stamp-1')).backgroundColor).toBe(colors.white);
      expect(getByTestId('flip-page-image-stamp-1').props.source.uri).toBe(stampProps.imageUrl);
    });
  });

  describe('URL が変わったら（AC-17）', () => {
    it('下地を不透明のまま出し直す（ふわっと出さない）', () => {
      const { getByTestId, rerender } = render(<GoshuinchoPage {...flipProps} />);
      fireEvent(getByTestId('flip-page-image-stamp-1'), 'load', loaded);
      finishFade();

      rerender(<GoshuinchoPage {...flipProps} imageUrl="https://example.com/stamp-1-b.jpg" />);

      const cover = getByTestId('flip-page-loading-stamp-1', hidden);
      expect(read(flatten(cover).opacity)).toBe(1);
      expect(fades.filter(f => f.config.toValue === 1)).toEqual([]);
    });

    // 遅れて届いた古い URL の知らせで、今の写真を読み込み済みにしない
    it('前の URL の知らせが遅れて届いても、下地は消えない', () => {
      const { getByTestId, rerender } = render(<GoshuinchoPage {...flipProps} />);
      const staleOnLoad = getByTestId('flip-page-image-stamp-1').props.onLoad;

      rerender(<GoshuinchoPage {...flipProps} imageUrl="https://example.com/stamp-1-b.jpg" />);
      act(() => staleOnLoad(loaded));

      expect(getByTestId('flip-page-loading-stamp-1', hidden)).toBeTruthy();
      expect(fades).toEqual([]);
    });
  });

  describe('本の出し方（AC-18・19）', () => {
    it("'still' は開いた形で止まった本を出し、時計を回さない", () => {
      const { getByTestId } = render(<GoshuinchoPage {...stampProps} loadingBook="still" />);
      act(() => loadingClock.setValue(425));

      expect(rotateYOf(getByTestId('flip-page-loading-stamp-1-book-leaf-front', hidden))).toBe(0);
      expect(isLoadingClockRunning()).toBe(false);
    });

    it("'none' は本を描かず、地と枠だけ", () => {
      const { getByTestId, queryByTestId } = render(
        <GoshuinchoPage {...stampProps} loadingBook="none" />
      );

      expect(queryByTestId('flip-page-loading-stamp-1-book', hidden)).toBeNull();
      expect(getByTestId('flip-page-loading-stamp-1-ground', hidden)).toBeTruthy();
      expect(getByTestId('flip-page-loading-stamp-1-frame', hidden)).toBeTruthy();
      expect(isLoadingClockRunning()).toBe(false);
    });

    it("渡さなければ 'still' と同じ", () => {
      const { getByTestId } = render(<GoshuinchoPage {...stampProps} />);
      act(() => loadingClock.setValue(425));

      expect(getByTestId('flip-page-loading-stamp-1-book', hidden)).toBeTruthy();
      expect(rotateYOf(getByTestId('flip-page-loading-stamp-1-book-leaf-front', hidden))).toBe(0);
      expect(isLoadingClockRunning()).toBe(false);
    });

    it('白紙のページには下地を出さない', () => {
      const { queryAllByTestId } = render(<GoshuinchoPage {...blankProps} />);

      expect(queryAllByTestId(/^flip-page-loading-/, hidden)).toHaveLength(0);
    });

    it("'flip' から 'still' に替えると時計を離し、本が止まる", () => {
      const { getByTestId, rerender } = render(<GoshuinchoPage {...flipProps} />);
      expect(isLoadingClockRunning()).toBe(true);

      rerender(<GoshuinchoPage {...flipProps} loadingBook="still" />);
      act(() => loadingClock.setValue(425));

      expect(loops[0].stop).toHaveBeenCalledTimes(1);
      expect(isLoadingClockRunning()).toBe(false);
      expect(rotateYOf(getByTestId('flip-page-loading-stamp-1-book-leaf-front', hidden))).toBe(0);
    });
  });

  describe('下地の見た目（UI-2）', () => {
    it('下地は紙の枠いっぱいに重なる', () => {
      const { getByTestId } = render(<GoshuinchoPage {...flipProps} />);

      expect(flatten(getByTestId('flip-page-loading-stamp-1', hidden))).toEqual(
        expect.objectContaining({ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 })
      );
    });

    it('地は和紙の色で、本を真ん中に置く', () => {
      const { getByTestId } = render(<GoshuinchoPage {...flipProps} />);

      expect(flatten(getByTestId('flip-page-loading-stamp-1-ground', hidden))).toEqual(
        expect.objectContaining({
          backgroundColor: colors.washi,
          alignItems: 'center',
          justifyContent: 'center',
        })
      );
    });

    it('内側 10 に薄い枠（角丸 8）', () => {
      const { getByTestId } = render(<GoshuinchoPage {...flipProps} />);

      expect(flatten(getByTestId('flip-page-loading-stamp-1-frame', hidden))).toEqual(
        expect.objectContaining({
          position: 'absolute',
          top: 10,
          left: 10,
          right: 10,
          bottom: 10,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: colors.washiFrame,
        })
      );
    });

    // 届かなかったときの見た目を変えない
    it('紙の白と枠は今のまま', () => {
      const { getByTestId } = render(<GoshuinchoPage {...flipProps} />);
      const surface = flatten(getByTestId('flip-page-surface-stamp-1'));

      expect(surface.backgroundColor).toBe(colors.white);
      expect(surface.borderColor).toBe(colors.gray[200]);
    });
  });
});
