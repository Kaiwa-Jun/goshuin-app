import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, renderHook, waitFor } from '@testing-library/react-native';

import { useAnnualReportAutoPlay } from '@hooks/useAnnualReportAutoPlay';
import { annualReportNow, setDevAsDecember } from '@utils/annualReportNow';
import { jstYearMonth } from '@utils/jstDate';

/*
 * Issue #274 AC-50〜57。12月にメインのタブが出たとき、1回だけ年報を自動で再生する。
 * 印の読み書きは本物（AsyncStorage は jest.setup.js のモック）、記録の数だけモックする
 */

jest.mock('@services/supabase', () => ({
  supabase: { from: jest.fn() },
}));

const mockCount = jest.fn();
jest.mock('@services/annualReport', () => ({
  ...jest.requireActual('@services/annualReport'),
  countStampsInYear: (...args: unknown[]) => mockCount(...args),
}));

let mockFocused = true;
const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useIsFocused: () => mockFocused,
  useNavigation: () => ({ navigate: mockNavigate }),
}));

let mockAuth: { user: { id: string } | null; isLoading: boolean } = {
  user: { id: 'u1' },
  isLoading: false,
};
jest.mock('@hooks/useAuth', () => ({
  useAuth: () => mockAuth,
}));

const SHOWN_KEY = 'annual_report_autoplayed:2026:u1';
const DEV_KEY = 'annual_report_dev_as_december';
const getItem = jest.mocked(AsyncStorage.getItem);
const setItem = jest.mocked(AsyncStorage.setItem);
const removeItem = jest.mocked(AsyncStorage.removeItem);

/** 印の読み取り（開発用のキーの読み取りは数えない） */
const shownReads = () => getItem.mock.calls.filter(([key]) => key === SHOWN_KEY);

/** 非同期の判定を流しきる */
const flush = () =>
  act(async () => {
    for (let i = 0; i < 20; i += 1) await Promise.resolve();
  });

const at = (iso: string) => jest.useFakeTimers({ now: new Date(iso) });

function setup(ready = true) {
  return renderHook(({ ready: r }: { ready: boolean }) => useAnnualReportAutoPlay({ ready: r }), {
    initialProps: { ready },
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  getItem.mockImplementation(() => Promise.resolve(null));
  mockFocused = true;
  mockAuth = { user: { id: 'u1' }, isLoading: false };
  mockCount.mockResolvedValue(3);
  at('2026-12-01T09:00:00+09:00');
});

afterEach(() => {
  setDevAsDecember(false);
  jest.useRealTimers();
});

describe('useAnnualReportAutoPlay', () => {
  it('AC-50: 印を書いてから年報へ（1回）', async () => {
    setup();
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledTimes(1));

    expect(mockNavigate).toHaveBeenCalledWith('AnnualReport', { year: 2026 });
    expect(setItem).toHaveBeenCalledWith(SHOWN_KEY, 'true');
    expect(setItem.mock.invocationCallOrder[0]).toBeLessThan(
      mockNavigate.mock.invocationCallOrder[0]
    );
    expect(mockCount).toHaveBeenCalledWith('u1', 2026);
  });

  it('AC-51: 日本時間の11月30日 23:59 は12月ではない（I/O もしない）', async () => {
    at('2026-11-30T23:59:00+09:00');
    setup();
    await flush();

    expect(mockNavigate).not.toHaveBeenCalled();
    expect(mockCount).not.toHaveBeenCalled();
    expect(shownReads()).toHaveLength(0);
  });

  it('AC-51: 日本時間の12月1日 0:30 は12月（UTC では 11/30）', async () => {
    at('2026-12-01T00:30:00+09:00');
    setup();
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledTimes(1));

    expect(mockCount).toHaveBeenCalledTimes(1);
    expect(shownReads()).toHaveLength(1);
  });

  it('AC-52: ゲストなら何も読まず、何も出さない', async () => {
    mockAuth = { user: null, isLoading: false };
    setup();
    await flush();

    expect(mockCount).not.toHaveBeenCalled();
    expect(shownReads()).toHaveLength(0);
    expect(setItem).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('AC-52: ログインの確認が終わるまでは何もしない', async () => {
    mockAuth = { user: null, isLoading: true };
    const hook = setup();
    await flush();
    expect(getItem).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();
    expect(mockCount).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();

    mockAuth = { user: { id: 'u1' }, isLoading: false };
    hook.rerender({ ready: true });
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledTimes(1));
  });

  it('AC-52: スプラッシュが消えるまで（ready が false の間）は何もしない', async () => {
    const hook = setup(false);
    await flush();
    expect(getItem).not.toHaveBeenCalled();
    expect(mockCount).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();

    hook.rerender({ ready: true });
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledTimes(1));
  });

  it('AC-52: メインのタブにフォーカスが無い間は何もしない', async () => {
    mockFocused = false;
    const hook = setup();
    await flush();
    expect(getItem).not.toHaveBeenCalled();
    expect(mockCount).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();

    mockFocused = true;
    hook.rerender({ ready: true });
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledTimes(1));
  });

  it('AC-53: 印があれば、数えずに出さない', async () => {
    getItem.mockImplementation(key => Promise.resolve(key === SHOWN_KEY ? 'true' : null));
    setup();
    await flush();

    expect(shownReads()).toHaveLength(1);
    expect(mockCount).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('AC-53: 今年の記録が0件なら、印を付けずに出さない', async () => {
    mockCount.mockResolvedValue(0);
    setup();
    await flush();

    expect(mockCount).toHaveBeenCalledTimes(1);
    expect(setItem).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('AC-53: 数えられなければ出さず、次にフォーカスが戻ったらもう一度', async () => {
    mockCount.mockRejectedValueOnce(new Error('offline'));
    const hook = setup();
    await flush();
    expect(setItem).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();

    mockFocused = false;
    hook.rerender({ ready: true });
    mockFocused = true;
    hook.rerender({ ready: true });
    await waitFor(() => expect(mockCount).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledTimes(1));
  });

  it('AC-54: 数えている間にフォーカスが外れたら、その場では出さず、戻ったら問い合わせ直さずに出す', async () => {
    let resolveCount: (n: number) => void = () => {};
    mockCount.mockImplementation(
      () =>
        new Promise<number>(resolve => {
          resolveCount = resolve;
        })
    );
    const hook = setup();
    await waitFor(() => expect(mockCount).toHaveBeenCalledTimes(1));

    mockFocused = false;
    hook.rerender({ ready: true });
    await act(async () => {
      resolveCount(3);
    });
    await flush();
    expect(setItem).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();

    mockFocused = true;
    hook.rerender({ ready: true });
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledTimes(1));
    expect(setItem).toHaveBeenCalledTimes(1);
    expect(setItem.mock.invocationCallOrder[0]).toBeLessThan(
      mockNavigate.mock.invocationCallOrder[0]
    );
    expect(mockCount).toHaveBeenCalledTimes(1);
  });

  it('AC-55: 出したあとは、フォーカスが外れて戻っても二度と出さない', async () => {
    const hook = setup();
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledTimes(1));

    mockFocused = false;
    hook.rerender({ ready: true });
    mockFocused = true;
    hook.rerender({ ready: true });
    await flush();

    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockCount).toHaveBeenCalledTimes(1);
  });

  it('AC-56: ゲストで判定が終わったあと、ログインして戻ると出す', async () => {
    mockAuth = { user: null, isLoading: false };
    const hook = setup();
    await flush();
    expect(mockNavigate).not.toHaveBeenCalled();

    mockAuth = { user: { id: 'u1' }, isLoading: false };
    hook.rerender({ ready: true });
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledTimes(1));
  });

  it('AC-56: 記録が0件で判定が終わったあと、記録して戻ると出す', async () => {
    mockCount.mockResolvedValueOnce(0).mockResolvedValueOnce(1);
    const hook = setup();
    await flush();
    expect(mockNavigate).not.toHaveBeenCalled();

    mockFocused = false;
    hook.rerender({ ready: true });
    mockFocused = true;
    hook.rerender({ ready: true });
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledTimes(1));
  });

  it('AC-57: 開発用のキーがあれば、消して12月として判定する', async () => {
    at('2026-09-27T10:00:00+09:00');
    getItem.mockImplementation(key => Promise.resolve(key === DEV_KEY ? '1' : null));
    setup();
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledTimes(1));

    expect(removeItem).toHaveBeenCalledWith(DEV_KEY);
    expect(mockNavigate).toHaveBeenCalledWith('AnnualReport', { year: 2026 });
    expect(jstYearMonth(annualReportNow()).month).toBe(12);
  });

  it('AC-57: 開発用のキーが無ければ9月のまま出さない', async () => {
    at('2026-09-27T10:00:00+09:00');
    setup();
    await flush();

    expect(getItem).toHaveBeenCalledWith(DEV_KEY);
    expect(removeItem).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(jstYearMonth(annualReportNow()).month).toBe(9);
  });
});
