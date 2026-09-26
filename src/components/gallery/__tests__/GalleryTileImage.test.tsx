import React from 'react';
import { Animated, StyleSheet } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';

import { GalleryTileImage } from '@components/gallery/GalleryTileImage';
import { loadingClock, resetLoadingClockForTests } from '@components/gallery/loadingClock';
import { colors } from '@theme/colors';
import { borderRadius } from '@theme/spacing';

type Anim = { start: jest.Mock; stop: jest.Mock; reset: jest.Mock };
const stub = (): Anim => ({ start: jest.fn(), stop: jest.fn(), reset: jest.fn() });

/** 下地は読み上げない（飾り）ので、既定の検索からは外れる。外れたものも探す */
const hidden = { includeHiddenElements: true };

const flat = (el: { props: { style?: unknown } }) =>
  (StyleSheet.flatten(el.props.style) ?? {}) as Record<string, unknown>;

/** 描いた値を読む。ノードならその値、値そのものならそれ */
const read = (value: unknown): number => {
  const v =
    value && typeof value === 'object' && '__getValue' in value
      ? (value as { __getValue: () => unknown }).__getValue()
      : value;
  return typeof v === 'string' ? parseFloat(v) : (v as number);
};

const loaded = { nativeEvent: { source: { width: 600, height: 800 } } };

describe('GalleryTileImage', () => {
  let loopSpy: jest.SpyInstance;
  let timingSpy: jest.SpyInstance;
  /** 時計ではない timing（下地のふわっと） */
  let fades: { config: Animated.TimingAnimationConfig; anim: Anim }[];

  const onLoad = jest.fn();
  const onError = jest.fn();
  const props = {
    stampId: 's',
    uri: 'https://x/a.jpg',
    size: 100,
    reduceMotion: false,
    onLoad,
    onError,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    resetLoadingClockForTests();
    fades = [];
    loopSpy = jest
      .spyOn(Animated, 'loop')
      .mockImplementation(() => stub() as unknown as Animated.CompositeAnimation);
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

  const finishFade = () =>
    act(() => {
      const done = fades[fades.length - 1].anim.start.mock.calls[0][0] as (r: {
        finished: boolean;
      }) => void;
      done({ finished: true });
    });

  describe('写真の知らせ（AC-26）', () => {
    it('届いたら実寸を親に知らせる', () => {
      const { getByTestId } = render(<GalleryTileImage {...props} />);
      fireEvent(getByTestId('stamp-image-s'), 'load', loaded);

      expect(onLoad).toHaveBeenCalledTimes(1);
      expect(onLoad).toHaveBeenCalledWith(600, 800);
    });

    it('届かなかったら親に知らせる', () => {
      const { getByTestId } = render(<GalleryTileImage {...props} />);
      fireEvent(getByTestId('stamp-image-s'), 'error');

      expect(onError).toHaveBeenCalledTimes(1);
    });
  });

  it('届いて消えたあと URL が変わったら、下地を不透明のまま出し直す（AC-27）', () => {
    const { getByTestId, rerender } = render(<GalleryTileImage {...props} />);
    fireEvent(getByTestId('stamp-image-s'), 'load', loaded);
    finishFade();

    rerender(<GalleryTileImage {...props} uri="https://x/b.jpg" />);

    expect(read(flat(getByTestId('stamp-image-loading-s', hidden)).opacity)).toBe(1);
    expect(fades.filter(f => f.config.toValue === 1)).toEqual([]);
  });

  // 親が元の写真に替えなかった（替えられなかった）なら、ここで読み込み中を終える
  it('届かず URL もそのままなら、読み込み中を終えて下地を消す（AC-28）', () => {
    const { getByTestId } = render(<GalleryTileImage {...props} />);
    fireEvent(getByTestId('stamp-image-s'), 'error');

    expect(fades).toHaveLength(1);
    expect(fades[0].config).toEqual(expect.objectContaining({ toValue: 0 }));
  });

  describe('見た目（UI-3）', () => {
    it('写真と下地を包む枠は、タイルの大きさで角を丸めて切り抜く', () => {
      const { getByTestId } = render(<GalleryTileImage {...props} />);

      expect(flat(getByTestId('stamp-tile-s'))).toEqual(
        expect.objectContaining({
          width: 100,
          height: 100,
          borderRadius: borderRadius.md,
          overflow: 'hidden',
        })
      );
    });

    it('写真は今までどおり（灰色の地・角丸）', () => {
      const { getByTestId } = render(<GalleryTileImage {...props} />);

      expect(flat(getByTestId('stamp-image-s'))).toEqual(
        expect.objectContaining({
          width: 100,
          height: 100,
          backgroundColor: colors.gray[200],
          borderRadius: borderRadius.md,
        })
      );
    });

    it('写真の上に和紙の下地を重ね、本は置かない', () => {
      const { getByTestId, getAllByTestId, queryByTestId } = render(
        <GalleryTileImage {...props} />
      );

      expect(
        getAllByTestId(/^stamp-image-(loading-)?s$/, hidden).map(el => el.props.testID)
      ).toEqual(['stamp-image-s', 'stamp-image-loading-s']);
      expect(flat(getByTestId('stamp-image-loading-s-ground', hidden)).backgroundColor).toBe(
        colors.washi
      );
      expect(queryByTestId('stamp-image-loading-s-book', hidden)).toBeNull();
    });

    it('内側 6 に薄い枠（角丸 5）', () => {
      const { getByTestId } = render(<GalleryTileImage {...props} />);

      expect(flat(getByTestId('stamp-image-loading-s-frame', hidden))).toEqual(
        expect.objectContaining({
          position: 'absolute',
          top: 6,
          left: 6,
          right: 6,
          bottom: 6,
          borderRadius: 5,
          borderWidth: 1,
          borderColor: colors.washiFrame,
        })
      );
    });
  });
});
