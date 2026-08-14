import { renderHook, waitFor } from '@testing-library/react-native';
import { useSpotStamps } from '@hooks/useSpotStamps';
import type { Stamp } from '@/types/supabase';

const mockFetchStampsBySpotId = jest.fn();
const mockFetchPublicStampsBySpotId = jest.fn();

jest.mock('@services/stamps', () => ({
  fetchStampsBySpotId: (...args: unknown[]) => mockFetchStampsBySpotId(...args),
  fetchPublicStampsBySpotId: (...args: unknown[]) => mockFetchPublicStampsBySpotId(...args),
}));

let mockIsAuthenticated = false;

jest.mock('@hooks/useAuth', () => ({
  useAuth: () => ({
    isAuthenticated: mockIsAuthenticated,
  }),
}));

const makeStamp = (overrides: Partial<Stamp> = {}): Stamp => ({
  id: 'stamp-1',
  user_id: 'user-1',
  spot_id: 'spot-1',
  goshuincho_id: null,
  visited_at: '2024-06-01',
  image_path: 'img/1.jpg',
  memo: null,
  is_public: false,
  extracted_info: null,
  created_at: '2024-06-01',
  updated_at: '2024-06-01',
  ...overrides,
});

describe('useSpotStamps', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsAuthenticated = false;
    mockFetchPublicStampsBySpotId.mockResolvedValue([]);
  });

  it('returns empty result when not authenticated', async () => {
    mockIsAuthenticated = false;
    const { result } = renderHook(() => useSpotStamps('spot-1'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.stamps).toEqual([]);
    expect(result.current.visitCount).toBe(0);
    expect(result.current.latestVisitDate).toBeNull();
    expect(mockFetchStampsBySpotId).not.toHaveBeenCalled();
  });

  it('fetches stamps when authenticated', async () => {
    mockIsAuthenticated = true;
    const stamps = [
      makeStamp({ id: 'stamp-1', visited_at: '2024-06-01' }),
      makeStamp({ id: 'stamp-2', visited_at: '2024-01-15' }),
    ];
    mockFetchStampsBySpotId.mockResolvedValue(stamps);

    const { result } = renderHook(() => useSpotStamps('spot-1'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockFetchStampsBySpotId).toHaveBeenCalledWith('spot-1');
    expect(result.current.stamps).toEqual(stamps);
    expect(result.current.visitCount).toBe(2);
    expect(result.current.latestVisitDate).toBe('2024-06-01');
  });

  it('returns empty result when authenticated but no stamps', async () => {
    mockIsAuthenticated = true;
    mockFetchStampsBySpotId.mockResolvedValue([]);

    const { result } = renderHook(() => useSpotStamps('spot-1'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.stamps).toEqual([]);
    expect(result.current.visitCount).toBe(0);
    expect(result.current.latestVisitDate).toBeNull();
  });

  it('returns empty result on fetch error', async () => {
    mockIsAuthenticated = true;
    mockFetchStampsBySpotId.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useSpotStamps('spot-1'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.stamps).toEqual([]);
    expect(result.current.visitCount).toBe(0);
    expect(result.current.latestVisitDate).toBeNull();
  });

  // Guideline 1.2: 他ユーザーのコンテンツをアプリ内に一切出さない（Issue #147）。
  // v1.1 で通報・ブロック・EULA を実装したら戻すため、services 側の
  // fetchPublicStampsBySpotId と各コンポーネントの publicStamps props は残してある。
  // 絞り口はこの hook 1箇所だけ
  describe('公開御朱印の表示停止（Guideline 1.2）', () => {
    it('ログイン中でも fetchPublicStampsBySpotId を呼ばない', async () => {
      mockIsAuthenticated = true;
      mockFetchStampsBySpotId.mockResolvedValue([]);

      const { result } = renderHook(() => useSpotStamps('spot-1'));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockFetchPublicStampsBySpotId).not.toHaveBeenCalled();
      expect(result.current.publicStamps).toEqual([]);
    });

    it('未ログインでも fetchPublicStampsBySpotId を呼ばない', async () => {
      mockIsAuthenticated = false;

      const { result } = renderHook(() => useSpotStamps('spot-1'));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockFetchPublicStampsBySpotId).not.toHaveBeenCalled();
      expect(result.current.publicStamps).toEqual([]);
    });

    it('自分の御朱印の取得は従来どおり動く', async () => {
      mockIsAuthenticated = true;
      const mine = [makeStamp()];
      mockFetchStampsBySpotId.mockResolvedValue(mine);

      const { result } = renderHook(() => useSpotStamps('spot-1'));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.stamps).toEqual(mine);
      expect(result.current.visitCount).toBe(1);
    });
  });
});
