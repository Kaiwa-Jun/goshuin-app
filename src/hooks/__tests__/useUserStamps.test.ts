import { renderHook, waitFor } from '@testing-library/react-native';
import { useUserStamps } from '@hooks/useUserStamps';

const mockFetchVisitedSpotIds = jest.fn();

jest.mock('@services/stamps', () => ({
  fetchVisitedSpotIds: (...args: unknown[]) => mockFetchVisitedSpotIds(...args),
}));

let mockIsAuthenticated = false;

jest.mock('@hooks/useAuth', () => ({
  useAuth: () => ({
    isAuthenticated: mockIsAuthenticated,
  }),
}));

describe('useUserStamps', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsAuthenticated = false;
  });

  it('returns empty Set when not authenticated', async () => {
    mockIsAuthenticated = false;
    const { result } = renderHook(() => useUserStamps());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.visitedSpotIds.size).toBe(0);
    expect(mockFetchVisitedSpotIds).not.toHaveBeenCalled();
  });

  it('fetches visited spot IDs when authenticated', async () => {
    mockIsAuthenticated = true;
    mockFetchVisitedSpotIds.mockResolvedValue(new Set(['spot-1', 'spot-2']));

    const { result } = renderHook(() => useUserStamps());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.visitedSpotIds.size).toBe(2);
    expect(result.current.visitedSpotIds.has('spot-1')).toBe(true);
  });

  it('returns empty Set on fetch error', async () => {
    mockIsAuthenticated = true;
    mockFetchVisitedSpotIds.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useUserStamps());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.visitedSpotIds.size).toBe(0);
  });
});
