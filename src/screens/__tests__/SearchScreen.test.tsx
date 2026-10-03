import React from 'react';
import { StyleSheet } from 'react-native';
import { render, fireEvent, act, within } from '@testing-library/react-native';
import { SearchScreen } from '@screens/SearchScreen';
import type { Spot } from '@/types/supabase';
import type { PlaceRow, SearchRow } from '@utils/placeSearch';
import { buildSearchRows } from '@utils/placeSearch';
import { SHIBUYA_STATION, TEST_SPOTS } from '@utils/__tests__/placeSearchFixtures';
import { colors } from '@theme/colors';
import { borderRadius } from '@theme/spacing';
import { typography } from '@theme/typography';

jest.mock('react-native-safe-area-context', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
  const React = require('react');
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
  const { View } = require('react-native');
  return {
    SafeAreaView: ({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) =>
      React.createElement(View, props, children),
    useSafeAreaInsets: () => ({ top: 47, bottom: 34, left: 0, right: 0 }),
  };
});

const mockSpots: Spot[] = [
  {
    id: 'spot-1',
    name: '仙台東照宮',
    lat: 38.27,
    lng: 140.87,
    type: 'shrine' as const,
    status: 'active' as const,
    rank: 3,
    address: '仙台市青葉区東照宮1-6-1',
    prefecture: null,
    created_by_user_id: null,
    merged_into_spot_id: null,
    created_at: '2024-01-01',
    updated_at: '2024-01-01',
  },
  {
    id: 'spot-2',
    name: '仙台成田山',
    lat: 38.28,
    lng: 140.88,
    type: 'temple' as const,
    status: 'active' as const,
    rank: 3,
    address: '仙台市青葉区荒巻字青葉33-2',
    prefecture: null,
    created_by_user_id: null,
    merged_into_spot_id: null,
    created_at: '2024-01-01',
    updated_at: '2024-01-01',
  },
];

const mockSetQuery = jest.fn();
const mockSetFilterType = jest.fn();
const mockClearSearch = jest.fn();

const mockResolveSubmit = jest.fn(async (): Promise<SearchRow | null> => null);

let mockUseSearchScreenReturn = {
  query: '',
  setQuery: mockSetQuery,
  rows: [] as SearchRow[],
  showPlaceCredit: false,
  resolveSubmit: mockResolveSubmit,
  filterType: 'all' as 'all' | 'shrine' | 'temple',
  setFilterType: mockSetFilterType,
  clearSearch: mockClearSearch,
  suggestedSpots: [] as { spot: Spot; distance: number }[],
  suggestionMode: 'nearby' as 'nearby' | 'popular',
};

/** 一覧の寺社の行（Issue #311 で results は rows になった） */
function spotRow(spot: Spot, distance: number): SearchRow {
  return { kind: 'spot', spot, distance };
}

jest.mock('@hooks/useSearchScreen', () => ({
  useSearchScreen: () => mockUseSearchScreenReturn,
}));

const mockAddHistory = jest.fn();
const mockClearHistory = jest.fn();

let mockUseSearchHistoryReturn = {
  history: [
    { spotId: 'spot-1', spotName: '仙台東照宮' },
    { spotId: 'spot-2', spotName: '仙台成田山' },
  ],
  isLoading: false,
  addHistory: mockAddHistory,
  clearHistory: mockClearHistory,
};

jest.mock('@hooks/useSearchHistory', () => ({
  useSearchHistory: () => mockUseSearchHistoryReturn,
}));

const mockNavigation = {
  navigate: jest.fn(),
  goBack: jest.fn(),
  dispatch: jest.fn(),
  reset: jest.fn(),
  isFocused: jest.fn(),
  canGoBack: jest.fn(),
  getId: jest.fn(),
  getParent: jest.fn(),
  getState: jest.fn(),
  setParams: jest.fn(),
  setOptions: jest.fn(),
  addListener: jest.fn(),
  removeListener: jest.fn(),
  pop: jest.fn(),
  push: jest.fn(),
  replace: jest.fn(),
  popTo: jest.fn(),
  popToTop: jest.fn(),
};

const mockRoute = { key: 'test', name: 'Search' as const, params: undefined };

describe('SearchScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseSearchScreenReturn = {
      query: '',
      setQuery: mockSetQuery,
      rows: [],
      showPlaceCredit: false,
      resolveSubmit: mockResolveSubmit,
      filterType: 'all',
      setFilterType: mockSetFilterType,
      clearSearch: mockClearSearch,
      suggestedSpots: [],
      suggestionMode: 'nearby',
    };
    mockUseSearchHistoryReturn = {
      history: [
        { spotId: 'spot-1', spotName: '仙台東照宮' },
        { spotId: 'spot-2', spotName: '仙台成田山' },
      ],
      isLoading: false,
      addHistory: mockAddHistory,
      clearHistory: mockClearHistory,
    };
  });

  it('renders without crashing', () => {
    const { getByTestId } = render(
      <SearchScreen navigation={mockNavigation as never} route={mockRoute} />
    );
    expect(getByTestId('search-screen')).toBeTruthy();
  });

  it('displays back button', () => {
    const { getByTestId } = render(
      <SearchScreen navigation={mockNavigation as never} route={mockRoute} />
    );
    expect(getByTestId('search-left-icon')).toBeTruthy();
  });

  it('navigates back when back button is pressed', () => {
    const { getByTestId } = render(
      <SearchScreen navigation={mockNavigation as never} route={mockRoute} />
    );
    fireEvent.press(getByTestId('search-left-icon'));
    expect(mockNavigation.goBack).toHaveBeenCalled();
  });

  it('displays search bar', () => {
    const { getByTestId } = render(
      <SearchScreen navigation={mockNavigation as never} route={mockRoute} />
    );
    expect(getByTestId('search-bar')).toBeTruthy();
  });

  describe('Search history (query empty)', () => {
    it('displays search history when query is empty', () => {
      const { getByText } = render(
        <SearchScreen navigation={mockNavigation as never} route={mockRoute} />
      );
      expect(getByText('最近の検索')).toBeTruthy();
      expect(getByText('仙台東照宮')).toBeTruthy();
      expect(getByText('仙台成田山')).toBeTruthy();
    });

    it('displays empty history message when no history', () => {
      mockUseSearchHistoryReturn = {
        ...mockUseSearchHistoryReturn,
        history: [],
      };

      const { getByText } = render(
        <SearchScreen navigation={mockNavigation as never} route={mockRoute} />
      );
      expect(getByText('検索履歴はありません')).toBeTruthy();
    });

    it('navigates to SpotDetail when history item is tapped', () => {
      const { getAllByTestId } = render(
        <SearchScreen navigation={mockNavigation as never} route={mockRoute} />
      );
      fireEvent.press(getAllByTestId('history-item')[0]);
      expect(mockNavigation.navigate).toHaveBeenCalledWith('Map', { focusSpotId: 'spot-1' });
    });

    it('clears history when clear button is pressed', () => {
      const { getByTestId } = render(
        <SearchScreen navigation={mockNavigation as never} route={mockRoute} />
      );
      fireEvent.press(getByTestId('clear-history-button'));
      expect(mockClearHistory).toHaveBeenCalled();
    });
  });

  describe('Suggested spots (query empty)', () => {
    const thirdSpot = { ...mockSpots[0], id: 'spot-3', name: '大崎八幡宮' };

    it('displays suggested spots with nearby title', () => {
      mockUseSearchScreenReturn = {
        ...mockUseSearchScreenReturn,
        suggestedSpots: [
          { spot: mockSpots[0], distance: 0.5 },
          { spot: mockSpots[1], distance: 1.2 },
          { spot: thirdSpot, distance: 2.0 },
        ],
        suggestionMode: 'nearby',
      };

      const { getAllByTestId, getByText } = render(
        <SearchScreen navigation={mockNavigation as never} route={mockRoute} />
      );
      expect(getAllByTestId('search-result-card').length).toBe(3);
      expect(getByText('近くのスポット')).toBeTruthy();
    });

    it('displays popular title in popular mode', () => {
      mockUseSearchScreenReturn = {
        ...mockUseSearchScreenReturn,
        suggestedSpots: [
          { spot: mockSpots[0], distance: 0 },
          { spot: mockSpots[1], distance: 0 },
          { spot: thirdSpot, distance: 0 },
        ],
        suggestionMode: 'popular',
      };

      const { getByText, queryByText } = render(
        <SearchScreen navigation={mockNavigation as never} route={mockRoute} />
      );
      expect(getByText('人気のスポット')).toBeTruthy();
      expect(queryByText('近くのスポット')).toBeNull();
    });

    it('hides section title when no suggested spots', () => {
      const { queryByText } = render(
        <SearchScreen navigation={mockNavigation as never} route={mockRoute} />
      );
      expect(queryByText('近くのスポット')).toBeNull();
      expect(queryByText('人気のスポット')).toBeNull();
    });

    it('navigates without adding history when suggested spot is pressed', () => {
      mockUseSearchScreenReturn = {
        ...mockUseSearchScreenReturn,
        suggestedSpots: [{ spot: mockSpots[0], distance: 0.5 }],
        suggestionMode: 'nearby',
      };

      const { getAllByTestId } = render(
        <SearchScreen navigation={mockNavigation as never} route={mockRoute} />
      );
      fireEvent.press(getAllByTestId('search-result-card')[0]);
      expect(mockNavigation.navigate).toHaveBeenCalledWith('Map', { focusSpotId: 'spot-1' });
      expect(mockAddHistory).not.toHaveBeenCalled();
    });

    it('shows distance in nearby mode and hides it in popular mode', () => {
      mockUseSearchScreenReturn = {
        ...mockUseSearchScreenReturn,
        suggestedSpots: [{ spot: mockSpots[0], distance: 0.5 }],
        suggestionMode: 'nearby',
      };

      const { getByText, rerender, queryByText } = render(
        <SearchScreen navigation={mockNavigation as never} route={mockRoute} />
      );
      expect(getByText('500m')).toBeTruthy();

      mockUseSearchScreenReturn = {
        ...mockUseSearchScreenReturn,
        suggestedSpots: [{ spot: mockSpots[0], distance: 0 }],
        suggestionMode: 'popular',
      };
      rerender(<SearchScreen navigation={mockNavigation as never} route={mockRoute} />);
      expect(queryByText('0m')).toBeNull();
    });

    it('hides suggestion titles when query is present', () => {
      mockUseSearchScreenReturn = {
        ...mockUseSearchScreenReturn,
        query: '仙台',
        rows: [spotRow(mockSpots[0], 1.2)],
        suggestedSpots: [{ spot: mockSpots[1], distance: 0.5 }],
        suggestionMode: 'nearby',
      };

      const { queryByText } = render(
        <SearchScreen navigation={mockNavigation as never} route={mockRoute} />
      );
      expect(queryByText('近くのスポット')).toBeNull();
      expect(queryByText('人気のスポット')).toBeNull();
    });
  });

  describe('Search results (query present)', () => {
    it('displays filter chips when query is present', () => {
      mockUseSearchScreenReturn = {
        ...mockUseSearchScreenReturn,
        query: '仙台',
        rows: [spotRow(mockSpots[0], 1.2)],
      };

      const { getByTestId } = render(
        <SearchScreen navigation={mockNavigation as never} route={mockRoute} />
      );
      expect(getByTestId('filter-chip-all')).toBeTruthy();
      expect(getByTestId('filter-chip-shrine')).toBeTruthy();
      expect(getByTestId('filter-chip-temple')).toBeTruthy();
    });

    it('calls setFilterType when filter chip is pressed', () => {
      mockUseSearchScreenReturn = {
        ...mockUseSearchScreenReturn,
        query: '仙台',
        rows: [spotRow(mockSpots[0], 1.2)],
      };

      const { getByTestId } = render(
        <SearchScreen navigation={mockNavigation as never} route={mockRoute} />
      );
      fireEvent.press(getByTestId('filter-chip-shrine'));
      expect(mockSetFilterType).toHaveBeenCalledWith('shrine');
    });

    it('displays search results', () => {
      mockUseSearchScreenReturn = {
        ...mockUseSearchScreenReturn,
        query: '仙台',
        rows: [spotRow(mockSpots[0], 1.2), spotRow(mockSpots[1], 3.5)],
      };

      const { getByText } = render(
        <SearchScreen navigation={mockNavigation as never} route={mockRoute} />
      );
      expect(getByText('検索結果')).toBeTruthy();
    });

    it('displays empty message when query has no results', () => {
      mockUseSearchScreenReturn = {
        ...mockUseSearchScreenReturn,
        query: 'xxxxxx',
        rows: [],
      };

      const { getByText } = render(
        <SearchScreen navigation={mockNavigation as never} route={mockRoute} />
      );
      expect(getByText('見つかりませんでした')).toBeTruthy();
    });

    it('adds spot to history and navigates when result card is pressed', () => {
      mockUseSearchScreenReturn = {
        ...mockUseSearchScreenReturn,
        query: '仙台',
        rows: [spotRow(mockSpots[0], 1.2)],
      };

      const { getAllByTestId } = render(
        <SearchScreen navigation={mockNavigation as never} route={mockRoute} />
      );
      fireEvent.press(getAllByTestId('search-result-card')[0]);
      expect(mockAddHistory).toHaveBeenCalledWith({
        spotId: 'spot-1',
        spotName: '仙台東照宮',
      });
      expect(mockNavigation.navigate).toHaveBeenCalledWith('Map', { focusSpotId: 'spot-1' });
    });
  });

  it('calls setQuery when text is entered in search bar', () => {
    const { getByTestId } = render(
      <SearchScreen navigation={mockNavigation as never} route={mockRoute} />
    );
    fireEvent.changeText(getByTestId('search-input'), '仙台');
    expect(mockSetQuery).toHaveBeenCalledWith('仙台');
  });

  it('shows clear button and calls clearSearch when pressed', () => {
    mockUseSearchScreenReturn = {
      ...mockUseSearchScreenReturn,
      query: '仙台',
      rows: [spotRow(mockSpots[0], 1.2)],
    };

    const { getByTestId } = render(
      <SearchScreen navigation={mockNavigation as never} route={mockRoute} />
    );
    fireEvent.press(getByTestId('search-clear-button'));
    expect(mockClearSearch).toHaveBeenCalled();
  });

  describe('場所の帯とエンター（Issue #311）', () => {
    const rowsFor = (query: string) =>
      buildSearchRows({ query, spots: TEST_SPOTS, filterType: 'all', order: 'nearby' });
    const spotById = (id: string) => TEST_SPOTS.find(s => s.spot.id === id)!.spot;
    const renderScreen = () =>
      render(<SearchScreen navigation={mockNavigation as never} route={mockRoute} />);

    /** 描いた順（host 要素の深さ優先の並び）での位置 */
    type Rendered = ReturnType<typeof render>;
    type Node = ReturnType<Rendered['getByTestId']>;
    function positionOf(r: Rendered, node: Node): number {
      return r.UNSAFE_root.findAll((n: Node) => typeof n.type === 'string').indexOf(node);
    }

    function show(query: string, rows: SearchRow[]) {
      mockUseSearchScreenReturn = { ...mockUseSearchScreenReturn, query, rows };
    }

    async function submit(r: ReturnType<typeof render>) {
      await act(async () => {
        fireEvent(r.getByTestId('search-input'), 'submitEditing');
      });
    }

    it('UI-1: 帯は「検索結果」と最初の寺社の行より上に出る', () => {
      show('横浜', rowsFor('横浜'));
      const r = renderScreen();

      const band = r.getByTestId('search-place-row-0');
      expect(within(band).getByText('横浜のあたり')).toBeTruthy();
      expect(within(band).getByText('神奈川県・寺社 3')).toBeTruthy();
      expect(within(band).getByText('地図で見る')).toBeTruthy();

      const cards = r.getAllByTestId('search-result-card');
      expect(cards).toHaveLength(3);
      expect(positionOf(r, band)).toBeLessThan(positionOf(r, r.getByText('検索結果')));
      expect(positionOf(r, r.getByText('検索結果'))).toBeLessThan(positionOf(r, cards[0]));
    });

    it('UI-2: 帯の色・角丸・アイコン・「地図で見る」の色', () => {
      show('横浜', rowsFor('横浜'));
      const r = renderScreen();
      const band = r.getByTestId('search-place-row-0');

      expect(StyleSheet.flatten(band.props.style)).toMatchObject({
        backgroundColor: colors.primary[50],
        borderRadius: borderRadius.lg,
      });
      const icon = within(band).getByText('map');
      expect(icon.props).toMatchObject({ name: 'map', size: 24, color: colors.primary[500] });
      expect(StyleSheet.flatten(within(band).getByText('地図で見る').props.style).color).toBe(
        colors.primary[600]
      );
    });

    it('AC-41: 場所が上でない言葉（「八坂」）でも、帯は一覧のいちばん上', () => {
      show('八坂', rowsFor('八坂'));
      const r = renderScreen();

      const band = r.getByTestId('search-place-row-0');
      expect(within(band).getByText('静岡県・寺社 1')).toBeTruthy();
      expect(positionOf(r, band)).toBeLessThan(
        positionOf(r, r.getAllByTestId('search-result-card')[0])
      );
    });

    it('UI-4: 「靖國」は寺社の行だけで、帯は出ない', () => {
      show('靖國', rowsFor('靖國'));
      const r = renderScreen();

      expect(within(r.getAllByTestId('search-result-card')[0]).getByText('靖國神社')).toBeTruthy();
      expect(r.queryByTestId('search-place-row-0')).toBeNull();
    });

    it('UI-5: 言葉があって行が無いときは「見つかりませんでした」', () => {
      show('あいうえおかきくけこ', []);
      expect(renderScreen().getByText('見つかりませんでした')).toBeTruthy();
    });

    it('AC-25: 検索欄の確定キーは「検索」で、押してもキーボードを閉じない', () => {
      const input = renderScreen().getByTestId('search-input');
      expect(input.props.returnKeyType).toBe('search');
      expect(input.props.submitBehavior).toBe('submit');
    });

    it('AC-22: エンターで寺社の行が返ると、行を押したのと同じく履歴に残して地図へ', async () => {
      const t1 = spotById('t1');
      show('明治神宮', [spotRow(t1, 5)]);
      mockResolveSubmit.mockResolvedValueOnce(spotRow(t1, 5));
      const r = renderScreen();

      await submit(r);

      expect(mockAddHistory).toHaveBeenCalledTimes(1);
      expect(mockAddHistory).toHaveBeenCalledWith({ spotId: 't1', spotName: '明治神宮' });
      expect(mockNavigation.navigate).toHaveBeenCalledTimes(1);
      expect(mockNavigation.navigate).toHaveBeenCalledWith('Map', { focusSpotId: 't1' });
      const bySubmit = [mockAddHistory.mock.calls, mockNavigation.navigate.mock.calls];

      jest.clearAllMocks();
      fireEvent.press(r.getAllByTestId('search-result-card')[0]);
      expect([mockAddHistory.mock.calls, mockNavigation.navigate.mock.calls]).toEqual(bySubmit);
    });

    it('AC-23: エンターで場所の行が返ると、その地域を地図に渡す。履歴には残さない', async () => {
      const rows = rowsFor('横浜');
      const place = rows[0] as PlaceRow;
      show('横浜', rows);
      mockResolveSubmit.mockResolvedValueOnce(place);
      const r = renderScreen();

      await submit(r);

      expect(mockNavigation.navigate).toHaveBeenCalledTimes(1);
      expect(mockNavigation.navigate).toHaveBeenCalledWith('Map', { focusRegion: place.region });
      expect(mockAddHistory).not.toHaveBeenCalled();

      jest.clearAllMocks();
      fireEvent.press(r.getByTestId('search-place-row-0'));
      expect(mockNavigation.navigate).toHaveBeenCalledTimes(1);
      expect(mockNavigation.navigate).toHaveBeenCalledWith('Map', { focusRegion: place.region });
      expect(mockAddHistory).not.toHaveBeenCalled();
    });

    it('UI-3: 外の地名検索の場所があるときだけ、一覧のいちばん下に「出典：国土地理院」', () => {
      const rows = buildSearchRows({
        query: '渋谷駅',
        spots: TEST_SPOTS,
        filterType: 'all',
        order: 'nearby',
        gsiFeatures: SHIBUYA_STATION,
      });
      mockUseSearchScreenReturn = {
        ...mockUseSearchScreenReturn,
        query: '渋谷駅',
        rows,
        showPlaceCredit: true,
      };
      const r = renderScreen();

      const credit = r.getByTestId('search-place-credit');
      expect(credit.props.children).toBe('出典：国土地理院');
      expect(StyleSheet.flatten(credit.props.style)).toMatchObject({
        color: colors.gray[400],
        fontSize: typography.caption.fontSize,
      });
      const cards = r.getAllByTestId('search-result-card');
      expect(positionOf(r, credit)).toBeGreaterThan(positionOf(r, cards[cards.length - 1]));
    });

    it('UI-3: 端末の中で当たった場所だけなら、出典は出さない', () => {
      show('横浜', rowsFor('横浜'));
      expect(renderScreen().queryByTestId('search-place-credit')).toBeNull();
    });

    it('AC-24: エンターで何も返らなければ、何もしない', async () => {
      show('あいうえおかきくけこ', []);
      const r = renderScreen();

      await submit(r);

      expect(mockNavigation.navigate).not.toHaveBeenCalled();
      expect(mockAddHistory).not.toHaveBeenCalled();
    });
  });
});
