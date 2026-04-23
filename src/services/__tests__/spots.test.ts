import {
  fetchSpotsByBounds,
  fetchSpotById,
  searchSpotsByName,
  fetchSpotsByPrefecture,
} from '@services/spots';
import type { BoundingBox } from '@utils/geo';

const mockSelect = jest.fn();
const mockEq = jest.fn();
const mockGte = jest.fn();
const mockLte = jest.fn();
const mockIlike = jest.fn();
const mockLimit = jest.fn();
const mockFrom = jest.fn();

jest.mock('@services/supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

describe('spots service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Chain: from().select().eq().gte().lte().gte().lte()
    mockFrom.mockReturnValue({ select: mockSelect });
    mockSelect.mockReturnValue({ eq: mockEq });
    mockEq.mockReturnValue({ gte: mockGte });
    mockGte.mockReturnValueOnce({ lte: mockLte });
    mockLte.mockReturnValueOnce({ gte: mockGte });
    mockGte.mockReturnValueOnce({ lte: mockLte });
    mockLte.mockReturnValueOnce({
      data: [
        {
          id: '1',
          name: 'Test Shrine',
          lat: 38.27,
          lng: 140.87,
          type: 'shrine',
          status: 'active',
          rank: 3,
        },
      ],
      error: null,
    });
  });

  describe('fetchSpotsByBounds', () => {
    it('queries spots within bounding box', async () => {
      const bounds: BoundingBox = { minLat: 38.25, maxLat: 38.29, minLng: 140.85, maxLng: 140.89 };
      const result = await fetchSpotsByBounds(bounds);

      expect(mockFrom).toHaveBeenCalledWith('spots');
      expect(mockSelect).toHaveBeenCalledWith('*');
      expect(mockEq).toHaveBeenCalledWith('status', 'active');
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Test Shrine');
    });

    it('returns empty array on error', async () => {
      mockFrom.mockReturnValue({ select: mockSelect });
      mockSelect.mockReturnValue({ eq: mockEq });
      mockEq.mockReturnValue({ gte: mockGte });
      mockGte.mockReset();
      mockGte.mockReturnValueOnce({ lte: mockLte });
      mockLte.mockReset();
      mockLte.mockReturnValueOnce({ gte: mockGte });
      mockGte.mockReturnValueOnce({ lte: mockLte });
      mockLte.mockReturnValueOnce({ data: null, error: { message: 'DB error' } });

      const bounds: BoundingBox = { minLat: 38.25, maxLat: 38.29, minLng: 140.85, maxLng: 140.89 };
      const result = await fetchSpotsByBounds(bounds);
      expect(result).toEqual([]);
    });
  });

  describe('fetchSpotById', () => {
    const mockSingle = jest.fn();

    it('fetches a single spot by id', async () => {
      mockFrom.mockReturnValue({ select: mockSelect });
      mockSelect.mockReturnValue({ eq: mockEq });
      mockEq.mockReturnValue({ single: mockSingle });
      mockSingle.mockReturnValue({
        data: { id: 'spot-1', name: 'Test Shrine', type: 'shrine' },
        error: null,
      });

      const result = await fetchSpotById('spot-1');
      expect(mockFrom).toHaveBeenCalledWith('spots');
      expect(mockEq).toHaveBeenCalledWith('id', 'spot-1');
      expect(result).toEqual({ id: 'spot-1', name: 'Test Shrine', type: 'shrine' });
    });

    it('returns null on error', async () => {
      mockFrom.mockReturnValue({ select: mockSelect });
      mockSelect.mockReturnValue({ eq: mockEq });
      mockEq.mockReturnValue({ single: mockSingle });
      mockSingle.mockReturnValue({ data: null, error: { message: 'Not found' } });

      const result = await fetchSpotById('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('searchSpotsByName', () => {
    it('searches spots by name with ilike', async () => {
      mockFrom.mockReturnValue({ select: mockSelect });
      mockSelect.mockReturnValue({ eq: mockEq });
      mockEq.mockReturnValue({ ilike: mockIlike });
      mockIlike.mockReturnValue({ limit: mockLimit });
      mockLimit.mockReturnValue({
        data: [{ id: '1', name: 'Test Shrine' }],
        error: null,
      });

      const result = await searchSpotsByName('Test');
      expect(mockIlike).toHaveBeenCalledWith('name', '%Test%');
      expect(mockLimit).toHaveBeenCalledWith(10);
      expect(result).toHaveLength(1);
    });

    it('returns empty array on error', async () => {
      mockFrom.mockReturnValue({ select: mockSelect });
      mockSelect.mockReturnValue({ eq: mockEq });
      mockEq.mockReturnValue({ ilike: mockIlike });
      mockIlike.mockReturnValue({ limit: mockLimit });
      mockLimit.mockReturnValue({ data: null, error: { message: 'error' } });

      const result = await searchSpotsByName('Test');
      expect(result).toEqual([]);
    });
  });

  describe('fetchSpotsByPrefecture', () => {
    it('指定都道府県のアクティブスポットを返す', async () => {
      const mockSpots = [
        {
          id: '1',
          name: '宮城縣護國神社',
          type: 'shrine',
          status: 'active',
          rank: 3,
          prefecture: '宮城県',
        },
        {
          id: '2',
          name: '仙台東照宮',
          type: 'shrine',
          status: 'active',
          rank: 3,
          prefecture: '宮城県',
        },
      ];

      mockFrom.mockReturnValue({ select: mockSelect });
      mockSelect.mockReturnValue({ eq: mockEq });
      mockEq.mockReturnValueOnce({ eq: mockEq });
      mockEq.mockReturnValueOnce({ data: mockSpots, error: null });

      const result = await fetchSpotsByPrefecture('宮城県');

      expect(mockFrom).toHaveBeenCalledWith('spots');
      expect(mockSelect).toHaveBeenCalledWith('*');
      expect(mockEq).toHaveBeenCalledWith('status', 'active');
      expect(mockEq).toHaveBeenCalledWith('prefecture', '宮城県');
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('宮城縣護國神社');
    });

    it('エラー時は空配列を返す', async () => {
      mockFrom.mockReturnValue({ select: mockSelect });
      mockSelect.mockReturnValue({ eq: mockEq });
      mockEq.mockReturnValueOnce({ eq: mockEq });
      mockEq.mockReturnValueOnce({ data: null, error: { message: 'DB error' } });

      const result = await fetchSpotsByPrefecture('宮城県');
      expect(result).toEqual([]);
    });
  });
});
