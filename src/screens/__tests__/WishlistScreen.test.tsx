import { render, fireEvent, waitFor, within } from '@testing-library/react-native';

import { WishlistScreen } from '../WishlistScreen';
import { removeFromWishlist } from '@services/wishlist';
import type { WishlistWithSpot } from '@/types/supabase';

const mockUseAuth = jest.fn();
jest.mock('@hooks/useAuth', () => ({
  useAuth: () => mockUseAuth(),
}));

const mockUseWishlistSpots = jest.fn();
jest.mock('@hooks/useWishlistSpots', () => ({
  useWishlistSpots: () => mockUseWishlistSpots(),
}));

jest.mock('@services/wishlist', () => ({
  removeFromWishlist: jest.fn(() => Promise.resolve()),
}));

const mockNavigate = jest.fn();

function makeSpot(overrides: Partial<WishlistWithSpot> = {}): WishlistWithSpot {
  return {
    id: 'wish-1',
    user_id: 'user-1',
    spot_id: 'spot-1',
    created_at: '2026-08-01',
    spots: {
      name: '浅草神社',
      type: 'shrine',
      address: '東京都台東区浅草2-3-1',
    },
    ...overrides,
  } as WishlistWithSpot;
}

function renderScreen() {
  const navigation = { navigate: mockNavigate } as never;
  const route = {} as never;
  return render(<WishlistScreen navigation={navigation} route={route} />);
}

describe('WishlistScreen', () => {
  const mockRefetch = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuth.mockReturnValue({
      user: { id: 'user-1' },
      isAuthenticated: true,
    });
    mockUseWishlistSpots.mockReturnValue({
      spots: [makeSpot()],
      isLoading: false,
      error: null,
      refetch: mockRefetch,
    });
  });

  it('画面が描画される', () => {
    const { getByTestId } = renderScreen();
    expect(getByTestId('wishlist-screen')).toBeTruthy();
  });

  it('行きたいスポットをカードとして描画する', () => {
    const { getByText, getByTestId } = renderScreen();

    expect(getByTestId('wishlist-item-spot-1')).toBeTruthy();
    expect(getByText('浅草神社')).toBeTruthy();
    expect(getByText('東京都台東区浅草2-3-1')).toBeTruthy();
  });

  it('カードをタップすると地図の該当スポットへ遷移する', () => {
    const { getByTestId } = renderScreen();

    fireEvent.press(getByTestId('wishlist-card-spot-1'));

    expect(mockNavigate).toHaveBeenCalledWith('Map', { focusSpotId: 'spot-1' });
  });

  it('削除ボタンをタップすると removeFromWishlist が呼ばれ refetch される', async () => {
    const { getByTestId } = renderScreen();

    fireEvent.press(within(getByTestId('wishlist-item-spot-1')).getByTestId('wishlist-button'));

    await waitFor(() => {
      expect(removeFromWishlist).toHaveBeenCalledWith('user-1', 'spot-1');
      expect(mockRefetch).toHaveBeenCalled();
    });
  });

  it('削除ボタンをタップしてもカードの遷移は発火しない', async () => {
    const { getByTestId } = renderScreen();

    fireEvent.press(within(getByTestId('wishlist-item-spot-1')).getByTestId('wishlist-button'));

    await waitFor(() => {
      expect(removeFromWishlist).toHaveBeenCalled();
    });
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('0件のとき空状態が出る', () => {
    mockUseWishlistSpots.mockReturnValue({
      spots: [],
      isLoading: false,
      error: null,
      refetch: mockRefetch,
    });

    const { getByTestId, queryByTestId } = renderScreen();

    expect(getByTestId('wishlist-empty-state')).toBeTruthy();
    expect(queryByTestId('wishlist-item-spot-1')).toBeNull();
  });

  it('未ログインでも落ちず、空状態が出る', () => {
    mockUseAuth.mockReturnValue({ user: null, isAuthenticated: false });
    mockUseWishlistSpots.mockReturnValue({
      spots: [],
      isLoading: false,
      error: null,
      refetch: mockRefetch,
    });

    const { getByTestId } = renderScreen();

    expect(getByTestId('wishlist-empty-state')).toBeTruthy();
  });

  it('住所が無いスポットでも落ちない', () => {
    mockUseWishlistSpots.mockReturnValue({
      spots: [makeSpot({ spots: { name: '烏森神社', type: 'shrine', address: null } as never })],
      isLoading: false,
      error: null,
      refetch: mockRefetch,
    });

    const { getByText } = renderScreen();

    expect(getByText('烏森神社')).toBeTruthy();
  });
});
