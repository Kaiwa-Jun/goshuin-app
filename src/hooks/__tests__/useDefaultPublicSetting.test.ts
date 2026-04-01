import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useDefaultPublicSetting } from '@hooks/useDefaultPublicSetting';

const mockFetchProfile = jest.fn();
const mockUpdateDefaultPublicSetting = jest.fn();
const mockUseAuth = jest.fn();

jest.mock('@services/profiles', () => ({
  fetchProfile: (...args: unknown[]) => mockFetchProfile(...args),
  updateDefaultPublicSetting: (...args: unknown[]) => mockUpdateDefaultPublicSetting(...args),
}));

jest.mock('@hooks/useAuth', () => ({
  useAuth: () => mockUseAuth(),
}));

describe('useDefaultPublicSetting', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuth.mockReturnValue({ user: null });
    mockUpdateDefaultPublicSetting.mockResolvedValue(undefined);
  });

  it('fetches default_stamp_public from profile when logged in', async () => {
    mockUseAuth.mockReturnValue({ user: { id: 'user-1' } });
    mockFetchProfile.mockResolvedValue({ default_stamp_public: true });

    const { result } = renderHook(() => useDefaultPublicSetting());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.defaultPublic).toBe(true);
    expect(mockFetchProfile).toHaveBeenCalledWith('user-1');
  });

  it('returns defaultPublic false when not logged in', async () => {
    mockUseAuth.mockReturnValue({ user: null });

    const { result } = renderHook(() => useDefaultPublicSetting());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.defaultPublic).toBe(false);
    expect(mockFetchProfile).not.toHaveBeenCalled();
  });

  it('updateDefaultPublic calls updateDefaultPublicSetting and updates local state', async () => {
    mockUseAuth.mockReturnValue({ user: { id: 'user-1' } });
    mockFetchProfile.mockResolvedValue({ default_stamp_public: false });

    const { result } = renderHook(() => useDefaultPublicSetting());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.defaultPublic).toBe(false);

    await act(async () => {
      await result.current.updateDefaultPublic(true);
    });

    expect(mockUpdateDefaultPublicSetting).toHaveBeenCalledWith('user-1', true);
    expect(result.current.defaultPublic).toBe(true);
  });

  it('does not throw on error from fetchProfile', async () => {
    mockUseAuth.mockReturnValue({ user: { id: 'user-1' } });
    mockFetchProfile.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useDefaultPublicSetting());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.defaultPublic).toBe(false);
  });

  it('does not throw on error from updateDefaultPublicSetting', async () => {
    mockUseAuth.mockReturnValue({ user: { id: 'user-1' } });
    mockFetchProfile.mockResolvedValue({ default_stamp_public: false });
    mockUpdateDefaultPublicSetting.mockRejectedValue(new Error('Update failed'));

    const { result } = renderHook(() => useDefaultPublicSetting());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Should not throw
    await act(async () => {
      await result.current.updateDefaultPublic(true);
    });

    // State should not change on error
    expect(result.current.defaultPublic).toBe(false);
  });
});
