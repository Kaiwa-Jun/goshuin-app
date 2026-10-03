import { act, renderHook, waitFor } from '@testing-library/react-native';

import { useSpotPhoto } from '@hooks/useSpotPhoto';
import type { SpotPhoto } from '@/types/supabase';

const mockFetchSpotPhoto = jest.fn();

jest.mock('@services/spotPhotos', () => ({
  fetchSpotPhoto: (...args: unknown[]) => mockFetchSpotPhoto(...args),
}));

const photoOf = (name: string): SpotPhoto => ({
  uri: `https://img.goshuinsanpo.com/${name}.jpg`,
  width: 1280,
  height: 960,
  focusY: 0.5,
  author: name,
  license: 'CC BY-SA 3.0',
  licenseUrl: null,
  sourceUrl: `https://commons.wikimedia.org/wiki/File:${name}.jpg`,
  isCropped: true,
});

/** あとから解決する約束 */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('useSpotPhoto（Issue #302 / AC-5）', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('spotId が空なら取らずに null', () => {
    const { result } = renderHook(() => useSpotPhoto(''));
    expect(mockFetchSpotPhoto).not.toHaveBeenCalled();
    expect(result.current.photo).toBeNull();
  });

  it('取れたらその写真', async () => {
    mockFetchSpotPhoto.mockResolvedValue(photoOf('a'));
    const { result } = renderHook(() => useSpotPhoto('spot-1'));
    expect(result.current.photo).toBeNull();
    await waitFor(() => expect(result.current.photo).toEqual(photoOf('a')));
    expect(mockFetchSpotPhoto).toHaveBeenCalledWith('spot-1');
  });

  it('寺社を替えた描画ですぐ null になり、前の寺社の遅れた応答は捨てる', async () => {
    const first = deferred<SpotPhoto | null>();
    const second = deferred<SpotPhoto | null>();
    mockFetchSpotPhoto.mockImplementation((id: string) =>
      id === 'spot-1' ? first.promise : second.promise
    );
    const { result, rerender } = renderHook(({ id }: { id: string }) => useSpotPhoto(id), {
      initialProps: { id: 'spot-1' },
    });

    // spot-1 が先に届いた状態から spot-2 へ
    await act(async () => first.resolve(photoOf('one')));
    expect(result.current.photo).toEqual(photoOf('one'));
    rerender({ id: 'spot-2' });
    expect(result.current.photo).toBeNull();

    await act(async () => second.resolve(photoOf('two')));
    expect(result.current.photo).toEqual(photoOf('two'));
  });

  it('前の寺社の応答が、次の寺社の応答より後に届いても捨てる', async () => {
    const first = deferred<SpotPhoto | null>();
    const second = deferred<SpotPhoto | null>();
    mockFetchSpotPhoto.mockImplementation((id: string) =>
      id === 'spot-1' ? first.promise : second.promise
    );
    const { result, rerender } = renderHook(({ id }: { id: string }) => useSpotPhoto(id), {
      initialProps: { id: 'spot-1' },
    });
    rerender({ id: 'spot-2' });
    expect(result.current.photo).toBeNull();

    await act(async () => second.resolve(photoOf('two')));
    await act(async () => first.resolve(photoOf('one')));
    expect(result.current.photo).toEqual(photoOf('two'));
  });

  it('取れなかったら（reject）null', async () => {
    const pending = deferred<SpotPhoto | null>();
    mockFetchSpotPhoto.mockReturnValue(pending.promise);
    const { result } = renderHook(() => useSpotPhoto('spot-1'));
    await act(async () => pending.reject(new Error('network')));
    expect(result.current.photo).toBeNull();
    expect(mockFetchSpotPhoto).toHaveBeenCalledTimes(1);
  });
});
