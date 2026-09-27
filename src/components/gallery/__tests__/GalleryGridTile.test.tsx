import React from 'react';
import { render, fireEvent, within } from '@testing-library/react-native';
import { Animated, StyleSheet } from 'react-native';
import { GalleryGridTile } from '@components/gallery/GalleryGridTile';
import { GalleryTileImage } from '@components/gallery/GalleryTileImage';
import { tileMotion } from '@components/gallery/viewModeMotion';
import type { StampWithSpot } from '@/types/supabase';

// 描き直した回数を数えるため、写真の部品は中身を描かない形にする
jest.mock('@components/gallery/GalleryTileImage', () => ({
  GalleryTileImage: jest.fn(() => null),
}));

const mockTileImage = GalleryTileImage as unknown as jest.Mock;

const flat = (el: { props: { style?: unknown } }) =>
  (StyleSheet.flatten(el.props.style) ?? {}) as Record<string, unknown>;

const stamp: StampWithSpot = {
  id: 's1',
  user_id: 'user-1',
  spot_id: 'spot-1',
  goshuincho_id: null,
  visited_at: '2024-01-15',
  image_path: 'user-1/stamp-1.jpg',
  memo: null,
  is_public: false,
  extracted_info: null,
  created_at: '2024-01-15T00:00:00Z',
  updated_at: '2024-01-15T00:00:00Z',
  spots: { name: '明治神宮', type: 'shrine' },
};

const motionOf = (faceDown: boolean) => ({
  ...tileMotion(new Animated.Value(0), {
    direction: 'toGrid',
    dx: 10,
    dy: 20,
    tiltDeg: faceDown ? 4 : 0,
    faceDown,
    delayMs: 0,
  }),
  faceDown,
});

const baseProps = {
  stamp,
  index: 4,
  imageUrl: 'https://example.com/thumb-400/user-1/stamp-1.jpg',
  size: 100,
  middleColumn: true,
  showDate: true,
  hidden: false,
  reduceMotion: false,
  stackTop: false,
  onPress: jest.fn(),
  onImageLoad: jest.fn(),
  onThumbMissing: jest.fn(),
  registerHero: jest.fn(),
  registerMotion: jest.fn(),
};

describe('GalleryGridTile（Issue #276）', () => {
  beforeEach(() => jest.clearAllMocks());

  it('静かなときは包みに何も付けず、裏を描かない', () => {
    const utils = render(<GalleryGridTile {...baseProps} />);

    expect(flat(utils.getByTestId('gallery-tile-motion-s1'))).not.toHaveProperty('transform');
    expect(flat(utils.getByTestId('gallery-tile-front-s1'))).not.toHaveProperty(
      'backfaceVisibility'
    );
    expect(flat(utils.getByTestId('gallery-tile-caption-s1'))).not.toHaveProperty('opacity');
    expect(utils.queryByTestId('gallery-tile-back-s1')).toBeNull();
    expect(flat(utils.getByTestId('gallery-item-s1'))).not.toHaveProperty('zIndex');
  });

  it('名前と日付を出す（スポット順のときは日付を出さない）', () => {
    const utils = render(<GalleryGridTile {...baseProps} />);
    const caption = within(utils.getByTestId('gallery-tile-caption-s1'));
    expect(caption.getByText('明治神宮')).toBeTruthy();
    expect(caption.getByText('2024/01/15')).toBeTruthy();

    utils.rerender(<GalleryGridTile {...baseProps} showDate={false} />);
    expect(utils.queryByText('2024/01/15')).toBeNull();
  });

  it('裏向きの動きなら、裏の面と枠を描く', () => {
    const utils = render(<GalleryGridTile {...baseProps} motion={motionOf(true)} />);

    const back = utils.getByTestId('gallery-tile-back-s1');
    expect(within(back).getByTestId('gallery-tile-back-s1-frame')).toBeTruthy();
    expect(flat(utils.getByTestId('gallery-tile-front-s1')).backfaceVisibility).toBe('hidden');
  });

  it('表のままの動き（束のいちばん上）なら、裏を描かない', () => {
    const utils = render(<GalleryGridTile {...baseProps} motion={motionOf(false)} stackTop />);

    expect(utils.queryByTestId('gallery-tile-back-s1')).toBeNull();
    expect(flat(utils.getByTestId('gallery-item-s1')).zIndex).toBe(1);
  });

  it('押すと、並びの中の位置と御朱印を渡す', () => {
    const utils = render(<GalleryGridTile {...baseProps} />);
    fireEvent.press(utils.getByTestId('gallery-item-s1'));
    expect(baseProps.onPress).toHaveBeenCalledWith(4, stamp);
  });

  // 画面が描き直すたびに全部のタイルを描き直すと、切り替わりの動きが 0.8秒に収まらない（S6）
  it('渡すものが変わらなければ描き直さない。動きが付いたら描き直す', () => {
    const utils = render(<GalleryGridTile {...baseProps} />);
    expect(mockTileImage).toHaveBeenCalledTimes(1);

    utils.rerender(<GalleryGridTile {...baseProps} />);
    expect(mockTileImage).toHaveBeenCalledTimes(1);

    utils.rerender(<GalleryGridTile {...baseProps} motion={motionOf(true)} />);
    expect(mockTileImage).toHaveBeenCalledTimes(2);
  });
});
