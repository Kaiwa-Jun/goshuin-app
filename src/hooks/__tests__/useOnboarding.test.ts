import { renderHook, act, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useOnboarding } from '@hooks/useOnboarding';

// supabase.ts がモジュールグラフ経由でロードされる場合に備えて環境変数を設定
const env = process.env;
env['EXPO_PUBLIC_SUPABASE_URL'] = 'https://test.supabase.co';
env['EXPO_PUBLIC_SUPABASE_ANON_KEY'] = 'test-anon-key';

describe('useOnboarding', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('初期状態は isLoading: true', () => {
    // AsyncStorage.getItem が resolve しないように保留にする
    (AsyncStorage.getItem as jest.Mock).mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useOnboarding());

    expect(result.current.isLoading).toBe(true);
  });

  it('AsyncStorage に値がない場合は isCompleted: false, isLoading: false', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

    const { result } = renderHook(() => useOnboarding());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isCompleted).toBe(false);
  });

  it('AsyncStorage に "true" がある場合は isCompleted: true, isLoading: false', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue('true');

    const { result } = renderHook(() => useOnboarding());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isCompleted).toBe(true);
  });

  it('completeOnboarding() 呼び出しで isCompleted: true に変更', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

    const { result } = renderHook(() => useOnboarding());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isCompleted).toBe(false);

    await act(async () => {
      await result.current.completeOnboarding();
    });

    expect(result.current.isCompleted).toBe(true);
  });

  it('completeOnboarding() は AsyncStorage.setItem を呼ぶ', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

    const { result } = renderHook(() => useOnboarding());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.completeOnboarding();
    });

    expect(AsyncStorage.setItem).toHaveBeenCalledWith('onboarding_completed', 'true');
  });
});
