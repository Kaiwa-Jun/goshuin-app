import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import {
  SpotBottomSheet,
  resolveCompactHeight,
  COMPACT_MIN_HEIGHT,
  COMPACT_MAX_HEIGHT,
  COMPACT_FALLBACK_HEIGHT,
} from '../SpotBottomSheet';
import type { Spot } from '@/types/supabase';

jest.mock('@react-navigation/bottom-tabs', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
  const ReactModule = require('react');
  return { BottomTabBarHeightContext: ReactModule.createContext(49) };
});

jest.mock('@services/stamps', () => ({
  fetchStampsBySpotId: jest.fn(() => Promise.resolve([])),
  getStampImageUrl: jest.fn((path: string) => `https://example.com/${path}`),
}));

const mockSpot: Spot = {
  id: 'spot-1',
  name: '仙台東照宮',
  lat: 38.28,
  lng: 140.88,
  type: 'shrine',
  address: '宮城県仙台市青葉区東照宮一丁目6-1',
  prefecture: null,
  status: 'active',
  rank: 3,
  created_by_user_id: null,
  merged_into_spot_id: null,
  created_at: '2024-01-01',
  updated_at: '2024-01-01',
};

jest.mock('@hooks/useSpotDetail', () => ({
  useSpotDetail: (spotId: string | null) => ({
    spot: spotId === 'spot-1' ? mockSpot : null,
    isLoading: false,
    error: null,
  }),
}));

jest.mock('@hooks/useSpotStamps', () => ({
  useSpotStamps: () => ({
    stamps: [],
    publicStamps: [],
    visitCount: 2,
    latestVisitDate: '2024-06-15',
    isLoading: false,
  }),
}));

jest.mock('@hooks/useSpotInfo', () => ({
  useSpotInfo: () => ({
    spotInfo: null,
    isLoading: false,
  }),
}));

jest.mock('@hooks/useAuth', () => ({
  useAuth: () => ({
    isAuthenticated: true,
    user: { id: 'user-1' },
  }),
}));

describe('SpotBottomSheet', () => {
  const defaultProps = {
    spotId: 'spot-1' as string | null,
    visitedSpotIds: new Set(['spot-1']),
    onDismiss: jest.fn(),
    onRecord: jest.fn(),
    wishlistSpotIds: new Set<string>(),
    onWishlistToggle: jest.fn(),
  };

  it('renders bottom sheet when spotId is provided', () => {
    const { getByTestId } = render(<SpotBottomSheet {...defaultProps} />);
    expect(getByTestId('bottom-sheet')).toBeTruthy();
  });

  it('does not render when spotId is null', () => {
    const { queryByTestId } = render(<SpotBottomSheet {...defaultProps} spotId={null} />);
    expect(queryByTestId('bottom-sheet')).toBeNull();
  });

  it('renders spot name', () => {
    const { getAllByText } = render(<SpotBottomSheet {...defaultProps} />);
    expect(getAllByText('仙台東照宮').length).toBeGreaterThanOrEqual(1);
  });

  it('renders shrine badge', () => {
    const { getAllByTestId } = render(<SpotBottomSheet {...defaultProps} />);
    expect(getAllByTestId('badge-shrine').length).toBeGreaterThanOrEqual(1);
  });

  it('renders visited badge when spot is visited', () => {
    const { getAllByTestId } = render(<SpotBottomSheet {...defaultProps} />);
    const visitedBadges = getAllByTestId('badge-visited');
    expect(visitedBadges.length).toBeGreaterThanOrEqual(1);
  });

  // A-5: 展開しても差し替わらない共通部分を持つ
  describe('共通ヘッダーと段階的な情報追加', () => {
    it('compact でヘッダーを描画する', () => {
      const { getByTestId } = render(<SpotBottomSheet {...defaultProps} />);
      expect(getByTestId('spot-sheet-header')).toBeTruthy();
    });

    it('compact では詳細を描画しない', () => {
      const { queryByTestId } = render(<SpotBottomSheet {...defaultProps} />);
      expect(queryByTestId('spot-detail-content')).toBeNull();
    });

    it('ハンドルのタップで詳細が現れる', () => {
      const { getByTestId } = render(<SpotBottomSheet {...defaultProps} />);
      fireEvent.press(getByTestId('sheet-handle'));
      expect(getByTestId('spot-detail-content')).toBeTruthy();
    });

    it('展開してもヘッダーが同じ testID のまま残る', () => {
      const { getByTestId } = render(<SpotBottomSheet {...defaultProps} />);
      fireEvent.press(getByTestId('sheet-handle'));
      expect(getByTestId('spot-sheet-header')).toBeTruthy();
    });

    it('展開してもアクション行が残る', () => {
      const { getByTestId } = render(<SpotBottomSheet {...defaultProps} />);
      fireEvent.press(getByTestId('sheet-handle'));
      expect(getByTestId('spot-sheet-actions')).toBeTruthy();
    });

    it('ハンドルを2回タップすると詳細が閉じる', () => {
      const { getByTestId, queryByTestId } = render(<SpotBottomSheet {...defaultProps} />);
      fireEvent.press(getByTestId('sheet-handle'));
      fireEvent.press(getByTestId('sheet-handle'));
      expect(queryByTestId('spot-detail-content')).toBeNull();
    });

    it('展開時にヘッダーが二重に描画されない', () => {
      const { getAllByTestId, getByTestId } = render(<SpotBottomSheet {...defaultProps} />);
      fireEvent.press(getByTestId('sheet-handle'));
      expect(getAllByTestId('spot-sheet-header')).toHaveLength(1);
    });
  });

  // A-7: 記録の導線が展開しなくても届く
  describe('アクション行', () => {
    it('compact の時点で記録するボタンが出ている', () => {
      const { getByTestId } = render(<SpotBottomSheet {...defaultProps} />);
      expect(getByTestId('record-action-button')).toBeTruthy();
    });

    it('記録するのタップで onRecord に spotId を渡す', () => {
      const onRecord = jest.fn();
      const { getByTestId } = render(<SpotBottomSheet {...defaultProps} onRecord={onRecord} />);
      fireEvent.press(getByTestId('record-action-button'));
      expect(onRecord).toHaveBeenCalledWith('spot-1');
    });

    it('行きたいのタップで onWishlistToggle に spotId を渡す', () => {
      const onWishlistToggle = jest.fn();
      const { getByTestId } = render(
        <SpotBottomSheet {...defaultProps} onWishlistToggle={onWishlistToggle} />
      );
      fireEvent.press(getByTestId('wishlist-action-button'));
      expect(onWishlistToggle).toHaveBeenCalledWith('spot-1');
    });

    it('onWishlistToggle が無いとき行きたいを出さない', () => {
      const { queryByTestId } = render(
        <SpotBottomSheet {...defaultProps} onWishlistToggle={undefined} />
      );
      expect(queryByTestId('wishlist-action-button')).toBeNull();
    });
  });
});

describe('resolveCompactHeight', () => {
  const SCREEN = 800;

  it('計測値をそのまま使う（範囲内のとき）', () => {
    expect(resolveCompactHeight(260, SCREEN)).toBe(260);
  });

  it('小さすぎる値は下限に丸める', () => {
    expect(resolveCompactHeight(100, SCREEN)).toBe(COMPACT_MIN_HEIGHT);
  });

  it('大きすぎる値は上限に丸める', () => {
    expect(resolveCompactHeight(999, SCREEN)).toBe(COMPACT_MAX_HEIGHT);
  });

  it('小型端末では画面の半分を超えない', () => {
    // iPhone SE 相当。380 ではなく 334 が上限になる
    expect(resolveCompactHeight(999, 667)).toBe(334);
  });

  it('不正な値はフォールバックする', () => {
    expect(resolveCompactHeight(0, SCREEN)).toBe(COMPACT_FALLBACK_HEIGHT);
    expect(resolveCompactHeight(-10, SCREEN)).toBe(COMPACT_FALLBACK_HEIGHT);
    expect(resolveCompactHeight(NaN, SCREEN)).toBe(COMPACT_FALLBACK_HEIGHT);
  });
});
