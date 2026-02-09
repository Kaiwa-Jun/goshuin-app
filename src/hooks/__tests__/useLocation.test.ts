import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useLocation } from '@hooks/useLocation';
import { DEFAULT_LOCATION } from '@utils/geo';

const mockGetForegroundPermissionsAsync = jest.fn();
const mockGetCurrentPositionAsync = jest.fn();
const mockRequestForegroundPermissionsAsync = jest.fn();

jest.mock('expo-location', () => ({
  getForegroundPermissionsAsync: (...args: unknown[]) => mockGetForegroundPermissionsAsync(...args),
  getCurrentPositionAsync: (...args: unknown[]) => mockGetCurrentPositionAsync(...args),
  requestForegroundPermissionsAsync: (...args: unknown[]) =>
    mockRequestForegroundPermissionsAsync(...args),
  PermissionStatus: {
    GRANTED: 'granted',
    DENIED: 'denied',
    UNDETERMINED: 'undetermined',
  },
  Accuracy: {
    Balanced: 3,
  },
}));

describe('useLocation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('starts with loading state', () => {
    mockGetForegroundPermissionsAsync.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useLocation());
    expect(result.current.isLoading).toBe(true);
    expect(result.current.location).toBeNull();
  });

  it('returns location when permission is granted', async () => {
    mockGetForegroundPermissionsAsync.mockResolvedValue({ status: 'granted' });
    mockGetCurrentPositionAsync.mockResolvedValue({
      coords: { latitude: 38.26, longitude: 140.87 },
    });

    const { result } = renderHook(() => useLocation());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.location).toEqual({ latitude: 38.26, longitude: 140.87 });
    expect(result.current.permissionStatus).toBe('granted');
    expect(result.current.error).toBeNull();
  });

  it('falls back to DEFAULT_LOCATION when permission is denied', async () => {
    mockGetForegroundPermissionsAsync.mockResolvedValue({ status: 'denied' });

    const { result } = renderHook(() => useLocation());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.location).toEqual(DEFAULT_LOCATION);
    expect(result.current.permissionStatus).toBe('denied');
  });

  it('falls back to DEFAULT_LOCATION when getCurrentPosition fails', async () => {
    mockGetForegroundPermissionsAsync.mockResolvedValue({ status: 'granted' });
    mockGetCurrentPositionAsync.mockRejectedValue(new Error('Location unavailable'));

    const { result } = renderHook(() => useLocation());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.location).toEqual(DEFAULT_LOCATION);
    expect(result.current.error).toBe('Location unavailable');
  });

  it('refreshLocation re-fetches location', async () => {
    mockGetForegroundPermissionsAsync.mockResolvedValue({ status: 'granted' });
    mockGetCurrentPositionAsync
      .mockResolvedValueOnce({ coords: { latitude: 38.26, longitude: 140.87 } })
      .mockResolvedValueOnce({ coords: { latitude: 35.68, longitude: 139.77 } });

    const { result } = renderHook(() => useLocation());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.location).toEqual({ latitude: 38.26, longitude: 140.87 });

    await act(async () => {
      await result.current.refreshLocation();
    });

    expect(result.current.location).toEqual({ latitude: 35.68, longitude: 139.77 });
  });
});
