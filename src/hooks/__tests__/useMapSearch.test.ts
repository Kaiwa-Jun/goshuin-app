import { renderHook, act } from '@testing-library/react-native';
import { useMapSearch } from '@hooks/useMapSearch';
import type { Spot } from '@/types/supabase';

const makeFakeSpot = (overrides: Partial<Spot> = {}): Spot => ({
  id: 'spot-1',
  name: 'Test Shrine',
  lat: 38.27,
  lng: 140.87,
  type: 'shrine',
  address: null,
  status: 'active',
  created_by_user_id: null,
  merged_into_spot_id: null,
  created_at: '2024-01-01',
  updated_at: '2024-01-01',
  ...overrides,
});

describe('useMapSearch', () => {
  const allSpots = [
    makeFakeSpot({ id: '1', name: 'Aoba Shrine', lat: 38.269, lng: 140.87 }),
    makeFakeSpot({ id: '2', name: 'Sendai Temple', lat: 38.28, lng: 140.88 }),
    makeFakeSpot({ id: '3', name: 'Zuihoden Temple', lat: 38.25, lng: 140.86 }),
  ];

  const userLocation = { latitude: 38.2682, longitude: 140.8694 };

  it('starts with empty query', () => {
    const { result } = renderHook(() => useMapSearch(allSpots, userLocation));
    expect(result.current.query).toBe('');
  });

  it('returns nearby spots sorted by distance when query is empty', () => {
    const { result } = renderHook(() => useMapSearch(allSpots, userLocation));
    expect(result.current.nearbySpots).toHaveLength(3);
    // Nearest should be first
    expect(result.current.nearbySpots[0].spot.id).toBe('1');
  });

  it('filters spots by query text', async () => {
    jest.useFakeTimers();
    const { result } = renderHook(() => useMapSearch(allSpots, userLocation));

    act(() => {
      result.current.setQuery('Temple');
    });

    // Advance past debounce
    act(() => {
      jest.advanceTimersByTime(350);
    });

    expect(result.current.suggestions.length).toBe(2);
    expect(result.current.suggestions.every(s => s.spot.name.includes('Temple'))).toBe(true);
    jest.useRealTimers();
  });

  it('is case-insensitive', async () => {
    jest.useFakeTimers();
    const { result } = renderHook(() => useMapSearch(allSpots, userLocation));

    act(() => {
      result.current.setQuery('shrine');
    });

    act(() => {
      jest.advanceTimersByTime(350);
    });

    expect(result.current.suggestions.length).toBe(1);
    expect(result.current.suggestions[0].spot.name).toBe('Aoba Shrine');
    jest.useRealTimers();
  });

  it('clearSearch resets query and suggestions', async () => {
    jest.useFakeTimers();
    const { result } = renderHook(() => useMapSearch(allSpots, userLocation));

    act(() => {
      result.current.setQuery('Temple');
    });

    act(() => {
      jest.advanceTimersByTime(350);
    });

    expect(result.current.suggestions.length).toBe(2);

    act(() => {
      result.current.clearSearch();
    });

    expect(result.current.query).toBe('');
    expect(result.current.suggestions).toEqual([]);
    jest.useRealTimers();
  });

  it('showSuggestions can be toggled', () => {
    const { result } = renderHook(() => useMapSearch(allSpots, userLocation));
    expect(result.current.showSuggestions).toBe(false);

    act(() => {
      result.current.setShowSuggestions(true);
    });
    expect(result.current.showSuggestions).toBe(true);
  });
});
