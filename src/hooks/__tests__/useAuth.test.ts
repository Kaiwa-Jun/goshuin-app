import { renderHook, act, waitFor } from '@testing-library/react-native';
import type { Session, User, AuthChangeEvent } from '@supabase/supabase-js';

import { useAuth } from '../useAuth';

// Mock supabase before importing useAuth
const mockGetSession = jest.fn();
const mockUnsubscribe = jest.fn();
let authChangeCallback: (event: AuthChangeEvent, session: Session | null) => void;
const mockOnAuthStateChange = jest.fn().mockImplementation(callback => {
  authChangeCallback = callback;
  return { data: { subscription: { unsubscribe: mockUnsubscribe } } };
});

jest.mock('@services/supabase', () => ({
  supabase: {
    auth: {
      getSession: (...args: unknown[]) => mockGetSession(...args),
      onAuthStateChange: (...args: unknown[]) => mockOnAuthStateChange(...args),
    },
  },
}));

const createMockUser = (overrides?: Partial<User>): User =>
  ({
    id: 'user-123',
    email: 'test@example.com',
    aud: 'authenticated',
    role: 'authenticated',
    created_at: '2024-01-01T00:00:00Z',
    app_metadata: {},
    user_metadata: {},
    ...overrides,
  }) as User;

const createMockSession = (user?: User): Session =>
  ({
    access_token: 'access-token',
    refresh_token: 'refresh-token',
    expires_in: 3600,
    token_type: 'bearer',
    user: user ?? createMockUser(),
  }) as Session;

describe('useAuth', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: getSession resolves with no session
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null });
  });

  it('returns isLoading: true and user: null on initial render', () => {
    // Never resolve getSession to keep loading state
    mockGetSession.mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useAuth());

    expect(result.current.isLoading).toBe(true);
    expect(result.current.user).toBeNull();
    expect(result.current.session).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
  });

  it('sets user and isLoading: false after session restoration', async () => {
    const mockUser = createMockUser();
    const mockSession = createMockSession(mockUser);
    mockGetSession.mockResolvedValue({
      data: { session: mockSession },
      error: null,
    });

    const { result } = renderHook(() => useAuth());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.user).toEqual(mockUser);
    expect(result.current.session).toEqual(mockSession);
    expect(result.current.isAuthenticated).toBe(true);
  });

  it('sets user: null and isLoading: false when no session exists', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });

    const { result } = renderHook(() => useAuth());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.user).toBeNull();
    expect(result.current.session).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
  });

  it('updates user when auth state changes', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });

    const { result } = renderHook(() => useAuth());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.user).toBeNull();

    // Simulate sign in
    const mockUser = createMockUser();
    const mockSession = createMockSession(mockUser);

    act(() => {
      authChangeCallback('SIGNED_IN', mockSession);
    });

    expect(result.current.user).toEqual(mockUser);
    expect(result.current.session).toEqual(mockSession);
    expect(result.current.isAuthenticated).toBe(true);

    // Simulate sign out
    act(() => {
      authChangeCallback('SIGNED_OUT', null);
    });

    expect(result.current.user).toBeNull();
    expect(result.current.session).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
  });

  it('returns isAuthenticated: true when user is present', async () => {
    const mockUser = createMockUser();
    const mockSession = createMockSession(mockUser);
    mockGetSession.mockResolvedValue({
      data: { session: mockSession },
      error: null,
    });

    const { result } = renderHook(() => useAuth());

    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(true);
    });
  });

  it('returns isAuthenticated: false when user is null', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });

    const { result } = renderHook(() => useAuth());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isAuthenticated).toBe(false);
  });

  it('unsubscribes on unmount', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });

    const { unmount } = renderHook(() => useAuth());

    await waitFor(() => {
      expect(mockOnAuthStateChange).toHaveBeenCalled();
    });

    unmount();

    expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
  });
});
