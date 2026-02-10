import { fetchVisitedSpotIds, fetchStampsBySpotId, getStampImageUrl } from '@services/stamps';

const mockSelect = jest.fn();
const mockEq = jest.fn();
const mockOrder = jest.fn();
const mockFrom = jest.fn();
const mockGetPublicUrl = jest.fn();

jest.mock('@services/supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
    storage: {
      from: () => ({
        getPublicUrl: (...args: unknown[]) => mockGetPublicUrl(...args),
      }),
    },
  },
}));

describe('stamps service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('fetchVisitedSpotIds', () => {
    it('returns Set of visited spot IDs', async () => {
      mockFrom.mockReturnValue({ select: mockSelect });
      mockSelect.mockReturnValue({
        data: [{ spot_id: 'spot-1' }, { spot_id: 'spot-2' }, { spot_id: 'spot-1' }],
        error: null,
      });

      const result = await fetchVisitedSpotIds();
      expect(mockFrom).toHaveBeenCalledWith('stamps');
      expect(mockSelect).toHaveBeenCalledWith('spot_id');
      expect(result).toBeInstanceOf(Set);
      expect(result.size).toBe(2);
      expect(result.has('spot-1')).toBe(true);
      expect(result.has('spot-2')).toBe(true);
    });

    it('returns empty Set on error', async () => {
      mockFrom.mockReturnValue({ select: mockSelect });
      mockSelect.mockReturnValue({ data: null, error: { message: 'error' } });

      const result = await fetchVisitedSpotIds();
      expect(result).toBeInstanceOf(Set);
      expect(result.size).toBe(0);
    });
  });

  describe('fetchStampsBySpotId', () => {
    it('returns stamps array for a given spot', async () => {
      const mockStamps = [
        { id: 'stamp-1', spot_id: 'spot-1', visited_at: '2024-06-01', image_path: 'img/1.jpg' },
        { id: 'stamp-2', spot_id: 'spot-1', visited_at: '2024-01-15', image_path: 'img/2.jpg' },
      ];
      mockFrom.mockReturnValue({ select: mockSelect });
      mockSelect.mockReturnValue({ eq: mockEq });
      mockEq.mockReturnValue({ order: mockOrder });
      mockOrder.mockReturnValue({ data: mockStamps, error: null });

      const result = await fetchStampsBySpotId('spot-1');
      expect(mockFrom).toHaveBeenCalledWith('stamps');
      expect(mockSelect).toHaveBeenCalledWith('*');
      expect(mockEq).toHaveBeenCalledWith('spot_id', 'spot-1');
      expect(mockOrder).toHaveBeenCalledWith('visited_at', { ascending: false });
      expect(result).toEqual(mockStamps);
    });

    it('returns empty array on error', async () => {
      mockFrom.mockReturnValue({ select: mockSelect });
      mockSelect.mockReturnValue({ eq: mockEq });
      mockEq.mockReturnValue({ order: mockOrder });
      mockOrder.mockReturnValue({ data: null, error: { message: 'error' } });

      const result = await fetchStampsBySpotId('spot-1');
      expect(result).toEqual([]);
    });
  });

  describe('getStampImageUrl', () => {
    it('returns public URL for stamp image', () => {
      mockGetPublicUrl.mockReturnValue({
        data: { publicUrl: 'https://example.com/stamps/img/1.jpg' },
      });

      const result = getStampImageUrl('img/1.jpg');
      expect(mockGetPublicUrl).toHaveBeenCalledWith('img/1.jpg');
      expect(result).toBe('https://example.com/stamps/img/1.jpg');
    });
  });
});
