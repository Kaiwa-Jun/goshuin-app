import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { SearchScreen } from '@screens/SearchScreen';

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

const mockSpots = [
  {
    id: 'spot-1',
    name: '仙台東照宮',
    lat: 38.27,
    lng: 140.87,
    type: 'shrine' as const,
    status: 'active' as const,
    rank: 3,
    address: '仙台市青葉区東照宮1-6-1',
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
    created_by_user_id: null,
    merged_into_spot_id: null,
    created_at: '2024-01-01',
    updated_at: '2024-01-01',
  },
];

const mockSetQuery = jest.fn();
const mockSetFilterType = jest.fn();
const mockClearSearch = jest.fn();

let mockUseSearchScreenReturn = {
  query: '',
  setQuery: mockSetQuery,
  results: [] as { spot: (typeof mockSpots)[0]; distance: number }[],
  filterType: 'all' as 'all' | 'shrine' | 'temple',
  setFilterType: mockSetFilterType,
  clearSearch: mockClearSearch,
  suggestedSpots: [] as { spot: (typeof mockSpots)[0]; distance: number }[],
  suggestionMode: 'nearby' as 'nearby' | 'popular',
};

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
      results: [],
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
        results: [{ spot: mockSpots[0], distance: 1.2 }],
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
        results: [{ spot: mockSpots[0], distance: 1.2 }],
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
        results: [{ spot: mockSpots[0], distance: 1.2 }],
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
        results: [
          { spot: mockSpots[0], distance: 1.2 },
          { spot: mockSpots[1], distance: 3.5 },
        ],
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
        results: [],
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
        results: [{ spot: mockSpots[0], distance: 1.2 }],
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
      results: [{ spot: mockSpots[0], distance: 1.2 }],
    };

    const { getByTestId } = render(
      <SearchScreen navigation={mockNavigation as never} route={mockRoute} />
    );
    fireEvent.press(getByTestId('search-clear-button'));
    expect(mockClearSearch).toHaveBeenCalled();
  });
});
