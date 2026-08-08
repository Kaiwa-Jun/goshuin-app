import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import {
  SpotThumbnailStrip,
  selectSheetThumbnails,
  SHEET_THUMBNAIL_LIMIT,
} from '../SpotThumbnailStrip';
import type { Stamp, PublicStampWithUser } from '@/types/supabase';

jest.mock('@services/stamps', () => ({
  getStampImageUrl: (path: string) => `https://example.com/${path}`,
}));

function makeStamp(id: string): Stamp {
  return {
    id,
    user_id: 'user-1',
    spot_id: 'spot-1',
    goshuincho_id: null,
    image_path: `user-1/${id}.jpg`,
    visited_at: '2026-05-03',
    memo: null,
    is_public: false,
    extracted_info: null,
    created_at: '2026-05-03',
    updated_at: '2026-05-03',
  } as unknown as Stamp;
}

function makePublicStamp(id: string): PublicStampWithUser {
  return { ...makeStamp(id), is_public: true } as unknown as PublicStampWithUser;
}

describe('selectSheetThumbnails', () => {
  it('自分の記録を先頭にする', () => {
    const result = selectSheetThumbnails([makeStamp('mine-1')], [makePublicStamp('theirs-1')]);
    expect(result.map(t => t.id)).toEqual(['mine-1', 'theirs-1']);
  });

  it('limit 件で打ち切る', () => {
    const stamps = [makeStamp('a'), makeStamp('b'), makeStamp('c'), makeStamp('d')];
    expect(selectSheetThumbnails(stamps, [])).toHaveLength(SHEET_THUMBNAIL_LIMIT);
  });

  it('id が重複したものを除外する', () => {
    const shared = makeStamp('same');
    const result = selectSheetThumbnails([shared], [{ ...shared } as PublicStampWithUser]);
    expect(result).toHaveLength(1);
  });

  it('両方空なら空配列を返す', () => {
    expect(selectSheetThumbnails([], [])).toEqual([]);
  });

  it('image_path を imagePath として返す', () => {
    const result = selectSheetThumbnails([makeStamp('x')], []);
    expect(result[0].imagePath).toBe('user-1/x.jpg');
  });
});

describe('SpotThumbnailStrip', () => {
  it('画像が1件も無いとき何も描画しない（空枠を置かない）', () => {
    const { queryByTestId } = render(
      <SpotThumbnailStrip stamps={[]} publicStamps={[]} onPress={() => {}} />
    );
    expect(queryByTestId('spot-thumbnails')).toBeNull();
  });

  it('件数分だけ描画し、3枠を埋めない', () => {
    const { getByTestId, queryByTestId } = render(
      <SpotThumbnailStrip
        stamps={[makeStamp('a'), makeStamp('b')]}
        publicStamps={[]}
        onPress={() => {}}
      />
    );
    expect(getByTestId('spot-thumbnail-0')).toBeTruthy();
    expect(getByTestId('spot-thumbnail-1')).toBeTruthy();
    expect(queryByTestId('spot-thumbnail-2')).toBeNull();
  });

  it('最大3件までしか描画しない', () => {
    const stamps = [makeStamp('a'), makeStamp('b'), makeStamp('c'), makeStamp('d')];
    const { queryByTestId } = render(
      <SpotThumbnailStrip stamps={stamps} publicStamps={[]} onPress={() => {}} />
    );
    expect(queryByTestId('spot-thumbnail-2')).toBeTruthy();
    expect(queryByTestId('spot-thumbnail-3')).toBeNull();
  });

  it('サムネイルのタップで onPress を呼ぶ', () => {
    const onPress = jest.fn();
    const { getByTestId } = render(
      <SpotThumbnailStrip stamps={[makeStamp('a')]} publicStamps={[]} onPress={onPress} />
    );
    fireEvent.press(getByTestId('spot-thumbnail-0'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
