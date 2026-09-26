import { renderHook, waitFor } from '@testing-library/react-native';
import { Image } from 'react-native';

import { useAnnualReport } from '@hooks/useAnnualReport';
import { buildAnnualReport, type AnnualVisit } from '@utils/annualReport';
import { ANNUAL_REPORT_SAMPLES } from '@utils/annualReportSample';

const mockFrom = jest.fn();
jest.mock('@services/supabase', () => ({
  supabase: { from: (...args: unknown[]) => mockFrom(...args) },
}));

const mockFetchSource = jest.fn();
jest.mock('@services/annualReport', () => ({
  fetchAnnualReportSource: (...args: unknown[]) => mockFetchSource(...args),
}));

jest.mock('@services/stamps', () => ({
  getStampImageUrl: (path: string) => `https://img/${path}`,
  getStampThumbUrl: (path: string) => `https://img/thumb/${path}`,
  getStampViewUrl: (path: string) => `https://img/view/${path}`,
}));

let mockAuth: { user: { id: string } | null; isLoading: boolean } = {
  user: null,
  isLoading: false,
};
jest.mock('@hooks/useAuth', () => ({
  useAuth: () => mockAuth,
}));

const v = (id: string, visitedAt: string, spotId: string): AnnualVisit => ({
  id,
  spotId,
  visitedAt,
  createdAt: `${visitedAt}T01:00:00Z`,
  imagePath: `u/${id}.jpg`,
  spotName: `寺社${spotId}`,
  spotType: 'shrine',
  prefecture: '宮城県',
});
const SOURCE = {
  visits: [v('a1', '2026-01-03', 's1'), v('a2', '2026-05-02', 's2'), v('a3', '2026-08-15', 's1')],
  pilgrimages: [],
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers({ now: new Date('2026-12-05T10:00:00+09:00') });
  jest.spyOn(Image, 'prefetch').mockResolvedValue(true);
  mockAuth = { user: null, isLoading: false };
});

afterEach(() => {
  jest.useRealTimers();
});

describe('useAnnualReport', () => {
  it('AC-25: 見本があれば Supabase を呼ばずにすぐ ready', () => {
    const { result } = renderHook(() => useAnnualReport({ year: 2026, sample: 'full' }));

    expect(result.current.status).toBe('ready');
    expect(result.current.report).toEqual(
      buildAnnualReport({ year: 2026, currentYear: 2026, ...ANNUAL_REPORT_SAMPLES.full })
    );
    expect(mockFrom).not.toHaveBeenCalled();
    expect(mockFetchSource).not.toHaveBeenCalled();
  });

  it('AC-25: ログイン済みなら読み込み中のあと ready', async () => {
    mockAuth = { user: { id: 'u1' }, isLoading: false };
    mockFetchSource.mockResolvedValue(SOURCE);

    const { result } = renderHook(() => useAnnualReport({ year: 2026 }));
    expect(result.current.status).toBe('loading');

    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(mockFetchSource).toHaveBeenCalledWith('u1');
    expect(result.current.report).toEqual(
      buildAnnualReport({ year: 2026, currentYear: 2026, ...SOURCE })
    );
  });

  it('AC-25: その年の記録が無ければ empty', async () => {
    mockAuth = { user: { id: 'u1' }, isLoading: false };
    mockFetchSource.mockResolvedValue(SOURCE);

    const { result } = renderHook(() => useAnnualReport({ year: 2024 }));

    await waitFor(() => expect(result.current.status).toBe('empty'));
    expect(result.current.report).toBeNull();
  });

  it('AC-25: 読み込めなければ error', async () => {
    mockAuth = { user: { id: 'u1' }, isLoading: false };
    mockFetchSource.mockRejectedValue(new Error('boom'));

    const { result } = renderHook(() => useAnnualReport({ year: 2026 }));

    await waitFor(() => expect(result.current.status).toBe('error'));
  });

  it('AC-25: ログインの確認が終わるまでは読みに行かない', async () => {
    mockAuth = { user: null, isLoading: true };
    mockFetchSource.mockResolvedValue(SOURCE);

    const { result, rerender } = renderHook(() => useAnnualReport({ year: 2026 }));
    expect(result.current.status).toBe('loading');
    expect(mockFetchSource).not.toHaveBeenCalled();

    mockAuth = { user: { id: 'u1' }, isLoading: false };
    rerender({});

    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(mockFetchSource).toHaveBeenCalledTimes(1);
  });

  it('AC-25: ゲストは empty', async () => {
    const { result } = renderHook(() => useAnnualReport({ year: 2026 }));

    await waitFor(() => expect(result.current.status).toBe('empty'));
    expect(mockFetchSource).not.toHaveBeenCalled();
  });

  it('ready になったら表紙とコラージュの写真を先に読んでおく（待たない）', async () => {
    mockAuth = { user: { id: 'u1' }, isLoading: false };
    mockFetchSource.mockResolvedValue(SOURCE);

    const { result } = renderHook(() => useAnnualReport({ year: 2026 }));
    await waitFor(() => expect(result.current.status).toBe('ready'));

    await waitFor(() => expect(Image.prefetch).toHaveBeenCalledWith('https://img/view/u/a1.jpg'));
    expect(Image.prefetch).toHaveBeenCalledWith('https://img/thumb/u/a2.jpg');
    expect(Image.prefetch).toHaveBeenCalledWith('https://img/view/u/a3.jpg');
  });
});
