import { fetchVisitedSpotIds } from '@services/stamps';

const mockSelect = jest.fn();
const mockFrom = jest.fn();

jest.mock('@services/supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
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
});
