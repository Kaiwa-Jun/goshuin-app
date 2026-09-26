import { act, renderHook } from '@testing-library/react-native';

import { useRecentPrefectures } from '@hooks/useRecentPrefectures';

/* 契約書: docs/issues/issue-277-spot-research-region.md（S1 / AC-5〜AC-7） */
const mockFetchRecentPrefectures = jest.fn();
jest.mock('@services/collection', () => ({
  fetchRecentPrefectures: (...a: unknown[]) => mockFetchRecentPrefectures(...a),
}));

beforeEach(() => {
  mockFetchRecentPrefectures.mockReset();
});

it('最初は []。取れたら県の一覧を返す', async () => {
  mockFetchRecentPrefectures.mockResolvedValue(['宮城県', '京都府']);

  const { result } = renderHook(() => useRecentPrefectures('user-1'));

  expect(result.current).toEqual([]);
  await act(async () => {});
  expect(result.current).toEqual(['宮城県', '京都府']);
  expect(mockFetchRecentPrefectures).toHaveBeenCalledWith('user-1');
});

it('描き直しても取り直さない（画面を開いたときに1回だけ）', async () => {
  mockFetchRecentPrefectures.mockResolvedValue(['宮城県']);

  const { rerender } = renderHook(() => useRecentPrefectures('user-1'));
  await act(async () => {});
  rerender(undefined);
  rerender(undefined);

  expect(mockFetchRecentPrefectures).toHaveBeenCalledTimes(1);
});

it('未ログイン（null）なら取らずに []', async () => {
  const { result } = renderHook(() => useRecentPrefectures(null));
  await act(async () => {});

  expect(mockFetchRecentPrefectures).not.toHaveBeenCalled();
  expect(result.current).toEqual([]);
});

it('取得が失敗しても例外を外に出さず [] のまま', async () => {
  mockFetchRecentPrefectures.mockRejectedValue(new Error('offline'));

  const { result } = renderHook(() => useRecentPrefectures('user-1'));
  await act(async () => {});

  expect(result.current).toEqual([]);
});

it('画面を閉じたあとに返った結果で state を書かない', async () => {
  let resolve: (v: string[]) => void = () => {};
  mockFetchRecentPrefectures.mockReturnValue(new Promise<string[]>(r => (resolve = r)));
  const error = jest.spyOn(console, 'error').mockImplementation(() => {});

  const { result, unmount } = renderHook(() => useRecentPrefectures('user-1'));
  unmount();
  await act(async () => resolve(['宮城県']));

  expect(result.current).toEqual([]);
  expect(error).not.toHaveBeenCalled();
  error.mockRestore();
});
