// Issue #311: 第2段（国土地理院）が要る言葉を打ったときの「見つかりませんでした」「探しています」の出方。
// フックは本物を使い、打ってから答えが来るまでの順を時間で追う（evaluator の指摘: 待ちの 300ms に
// 「見つかりませんでした」が出て、そのあと「探しています」に替わっていた）
import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { PermissionStatus } from 'expo-location';
import { SearchScreen } from '@screens/SearchScreen';
import { useSpots } from '@hooks/useSpots';
import { useLocation } from '@hooks/useLocation';
import { fetchGsiPlaces } from '@services/placeSearch';
import type { GsiFeature } from '@utils/placeSearch';
import { TEST_SPOTS } from '@utils/__tests__/placeSearchFixtures';

// 自動モックにすると本物の useSpots を読み込み、Supabase の初期化まで走るので、形だけ渡す
jest.mock('@hooks/useSpots', () => ({ useSpots: jest.fn() }));
jest.mock('@hooks/useLocation', () => ({ useLocation: jest.fn() }));
jest.mock('@services/placeSearch', () => ({ fetchGsiPlaces: jest.fn() }));
jest.mock('@hooks/useSearchHistory', () => ({
  useSearchHistory: () => ({
    history: [],
    isLoading: false,
    addHistory: jest.fn(),
    clearHistory: jest.fn(),
  }),
}));

const mockUseSpots = useSpots as jest.MockedFunction<typeof useSpots>;
const mockUseLocation = useLocation as jest.MockedFunction<typeof useLocation>;
const mockFetchGsiPlaces = fetchGsiPlaces as jest.MockedFunction<typeof fetchGsiPlaces>;

const navigation = { navigate: jest.fn(), goBack: jest.fn() };
const route = { key: 'search', name: 'Search' as const, params: undefined };

function deferred() {
  let resolve!: (value: GsiFeature[] | null) => void;
  const promise = new Promise<GsiFeature[] | null>(r => {
    resolve = r;
  });
  return { promise, resolve };
}

describe('第2段が要る言葉の、空の一覧の出し方（Issue #311）', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockUseLocation.mockReturnValue({
      location: { latitude: 35.6812, longitude: 139.7671 },
      isLoading: false,
      error: null,
      permissionStatus: PermissionStatus.GRANTED,
      refreshLocation: jest.fn(),
    });
    const spots = TEST_SPOTS.map(s => s.spot);
    mockUseSpots.mockReturnValue({ spots, allSpots: spots, isLoading: false, error: null });
    mockFetchGsiPlaces.mockReset();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  function shown(r: ReturnType<typeof render>) {
    return {
      searching: r.queryByTestId('search-place-searching') !== null,
      notFound: r.queryByText('見つかりませんでした') !== null,
    };
  }

  it('打った直後（待ちの途中）は何も出さず、待ちのあとは「探しています」だけ、0 件の答えで「見つかりませんでした」', async () => {
    const answer = deferred();
    mockFetchGsiPlaces.mockReturnValue(answer.promise);
    const r = render(<SearchScreen navigation={navigation as never} route={route} />);

    fireEvent.changeText(r.getByTestId('search-input'), 'あいうえおかきくけこ');
    expect(shown(r)).toEqual({ searching: false, notFound: false });

    act(() => {
      jest.advanceTimersByTime(299);
    });
    expect(shown(r)).toEqual({ searching: false, notFound: false });

    act(() => {
      jest.advanceTimersByTime(1);
    });
    await act(async () => {});
    expect(shown(r)).toEqual({ searching: true, notFound: false });

    await act(async () => {
      answer.resolve([]);
    });
    expect(shown(r)).toEqual({ searching: false, notFound: true });
  });

  it('問い合わせ中に打ち足すと、待ちの間はまた何も出さない', async () => {
    mockFetchGsiPlaces.mockReturnValue(deferred().promise);
    const r = render(<SearchScreen navigation={navigation as never} route={route} />);

    fireEvent.changeText(r.getByTestId('search-input'), '東京タワ');
    act(() => {
      jest.advanceTimersByTime(300);
    });
    await act(async () => {});
    expect(shown(r)).toEqual({ searching: true, notFound: false });

    fireEvent.changeText(r.getByTestId('search-input'), '東京タワー');
    expect(shown(r)).toEqual({ searching: false, notFound: false });
  });

  it('1 文字目を打ったときも、待ちの間は何も出さない', () => {
    const r = render(<SearchScreen navigation={navigation as never} route={route} />);

    fireEvent.changeText(r.getByTestId('search-input'), 'x');

    expect(shown(r)).toEqual({ searching: false, notFound: false });
  });
});
