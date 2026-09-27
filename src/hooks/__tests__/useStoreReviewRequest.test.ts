import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, renderHook } from '@testing-library/react-native';
import { requireOptionalNativeModule } from 'expo';
import { AppState, type AppStateStatus } from 'react-native';

import { useStoreReviewRequest } from '@hooks/useStoreReviewRequest';
import { clearRecordCompleted, noteRecordCompleted } from '@services/storeReview';

/*
 * Issue #288 AC-15〜25。完了画面から戻ったメインのタブで、少し待ってからレビュー依頼を出す（D-6）。
 * 条件（特に書かない限り）: フォーカスあり・偽のモジュール（使える）・履歴なし・今は 2026-10-05 12:00（JST）
 */

let mockFocused = true;
jest.mock('@react-navigation/native', () => ({
  useIsFocused: () => mockFocused,
}));

const KEY = 'store_review_history';
const getItem = jest.mocked(AsyncStorage.getItem);
const setItem = jest.mocked(AsyncStorage.setItem);
/** 端末の中身。getItem / setItem が同じ Map を読み書きする（1回出したあとに2回目が出ないことを見る） */
let storage: Map<string, string>;

const requireOptional = jest.mocked(requireOptionalNativeModule);
const defaultRequireOptional = requireOptional.getMockImplementation();
let fake: { isAvailableAsync: jest.Mock; requestReview: jest.Mock };
const useFakeModule = () =>
  requireOptional.mockImplementation(
    (name: string) => (name === 'ExpoStoreReview' ? fake : null) as never
  );

/** 履歴の読み取り・書き込み（他のキーは数えない） */
const historyReads = () => getItem.mock.calls.filter(([key]) => key === KEY);
const historyWrites = () => setItem.mock.calls.filter(([key]) => key === KEY);

/** 非同期の判定を流しきる */
const flush = () =>
  act(async () => {
    for (let i = 0; i < 20; i += 1) await Promise.resolve();
  });

/** 時計を進めて、そのあとの Promise も流す */
const advance = async (ms: number) => {
  act(() => {
    jest.advanceTimersByTime(ms);
  });
  await flush();
};

function setup() {
  return renderHook(() => useStoreReviewRequest());
}

/** フォーカスを外して戻す */
async function blurAndFocus(hook: ReturnType<typeof setup>) {
  mockFocused = false;
  hook.rerender({});
  await flush();
  mockFocused = true;
  hook.rerender({});
  await flush();
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers({ now: new Date('2026-10-05T12:00:00+09:00') });
  storage = new Map();
  getItem.mockImplementation(async key => storage.get(key) ?? null);
  setItem.mockImplementation(async (key, value) => {
    storage.set(key, value);
  });
  fake = {
    isAvailableAsync: jest.fn(async () => true),
    requestReview: jest.fn(async () => undefined),
  };
  useFakeModule();
  mockFocused = true;
  clearRecordCompleted();
});

afterEach(() => {
  requireOptional.mockImplementation(defaultRequireOptional);
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('useStoreReviewRequest', () => {
  it('AC-15: 印が無ければ履歴も読まず、何も出さない', async () => {
    setup();
    await advance(10000);

    expect(historyReads()).toHaveLength(0);
    expect(fake.requestReview).not.toHaveBeenCalled();
  });

  it('AC-16: 3枚目の印があれば、1500ms 後に依頼を出し、そのあと履歴を書く', async () => {
    noteRecordCompleted(3);
    setup();
    await advance(1499);
    expect(fake.requestReview).not.toHaveBeenCalled();

    await advance(1);
    expect(fake.requestReview).toHaveBeenCalledTimes(1);
    expect(historyWrites()).toEqual([
      [KEY, '{"count":1,"lastRequestedAt":"2026-10-05T03:00:01.500Z"}'],
    ]);
    const writeOrder = setItem.mock.invocationCallOrder[setItem.mock.calls.length - 1];
    expect(writeOrder).toBeGreaterThan(fake.requestReview.mock.invocationCallOrder[0]);
  });

  it('AC-17: 2枚なら出さず、書かない。印は消えているので戻り直しても出さない', async () => {
    noteRecordCompleted(2);
    const hook = setup();
    await advance(5000);
    expect(fake.requestReview).not.toHaveBeenCalled();
    expect(historyWrites()).toHaveLength(0);

    await blurAndFocus(hook);
    await advance(5000);
    expect(fake.requestReview).not.toHaveBeenCalled();
  });

  it('AC-18: 待っている間にフォーカスを失えば取りやめ、印は戻さない', async () => {
    noteRecordCompleted(3);
    const hook = setup();
    await advance(1000);
    mockFocused = false;
    hook.rerender({});
    await advance(4000);
    expect(fake.requestReview).not.toHaveBeenCalled();

    mockFocused = true;
    hook.rerender({});
    await advance(5000);
    expect(fake.requestReview).not.toHaveBeenCalled();
  });

  it('AC-19: 待っている間にアプリが裏へ回れば取りやめる', async () => {
    let onChange: ((state: AppStateStatus) => void) | undefined;
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, listener) => {
      onChange = listener as (state: AppStateStatus) => void;
      return { remove: jest.fn() } as never;
    });
    noteRecordCompleted(3);
    setup();
    await advance(1000);
    act(() => onChange?.('background'));
    await advance(4000);

    expect(onChange).toBeDefined();
    expect(fake.requestReview).not.toHaveBeenCalled();
  });

  it('AC-20: 待っている間にフックが外れれば取りやめる', async () => {
    noteRecordCompleted(3);
    const hook = setup();
    await advance(1000);
    hook.unmount();
    await advance(4000);

    expect(fake.requestReview).not.toHaveBeenCalled();
  });

  describe('AC-21: 呼べなかったときは履歴を書かない', () => {
    it('① ネイティブが無い', async () => {
      requireOptional.mockImplementation(defaultRequireOptional);
      noteRecordCompleted(3);
      setup();
      await advance(5000);

      expect(historyWrites()).toHaveLength(0);
    });

    it('② 使えない（TestFlight）', async () => {
      fake.isAvailableAsync.mockResolvedValue(false);
      noteRecordCompleted(3);
      setup();
      await advance(5000);

      expect(historyWrites()).toHaveLength(0);
    });

    it('③ requestReview が reject（例外は外へ出ない）', async () => {
      jest.spyOn(console, 'warn').mockImplementation(() => {});
      fake.requestReview.mockRejectedValue(new Error('MissingCurrentWindowSceneException'));
      noteRecordCompleted(3);
      setup();
      await advance(5000);

      expect(fake.requestReview).toHaveBeenCalledTimes(1);
      expect(historyWrites()).toHaveLength(0);
    });
  });

  it('AC-22: 前回から10日しかたっていなければ、12枚でも出さない', async () => {
    storage.set(KEY, '{"count":1,"lastRequestedAt":"2026-09-25T03:00:00.000Z"}');
    noteRecordCompleted(12);
    setup();
    await advance(5000);

    expect(fake.requestReview).not.toHaveBeenCalled();
    expect(historyWrites()).toHaveLength(0);
  });

  it('AC-23: 履歴を読めなければ出さない（例外は外へ出ない）', async () => {
    getItem.mockImplementation(async () => {
      throw new Error('disk');
    });
    noteRecordCompleted(3);
    setup();
    await advance(5000);

    expect(fake.requestReview).not.toHaveBeenCalled();
  });

  it('AC-24: 1回出したあとは、4枚目で戻っても出さない', async () => {
    noteRecordCompleted(3);
    const hook = setup();
    await advance(1500);
    expect(fake.requestReview).toHaveBeenCalledTimes(1);

    noteRecordCompleted(4);
    await blurAndFocus(hook);
    await advance(5000);
    expect(fake.requestReview).toHaveBeenCalledTimes(1);
  });

  it('AC-25: フォーカスが無い間は待ち、フォーカスを得てから 1500ms 後に出す', async () => {
    mockFocused = false;
    noteRecordCompleted(3);
    const hook = setup();
    await advance(5000);
    expect(fake.requestReview).not.toHaveBeenCalled();

    mockFocused = true;
    hook.rerender({});
    await advance(1499);
    expect(fake.requestReview).not.toHaveBeenCalled();
    await advance(1);
    expect(fake.requestReview).toHaveBeenCalledTimes(1);
  });
});
