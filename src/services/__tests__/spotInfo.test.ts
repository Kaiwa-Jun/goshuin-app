import { fetchSpotAggregatedInfo, triggerExtraction } from '@services/spotInfo';

const mockSelect = jest.fn();
const mockEq = jest.fn();
const mockFrom = jest.fn();
const mockInvoke = jest.fn();

jest.mock('@services/supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
    functions: {
      invoke: (...args: unknown[]) => mockInvoke(...args),
    },
  },
}));

describe('spotInfo service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('fetchSpotAggregatedInfo', () => {
    it('returns data on success', async () => {
      const mockData = [
        {
          id: 'info-1',
          spot_id: 'spot-1',
          info_type: 'parking',
          info_data: { available: true, capacity: 10 },
          source_stamp_ids: ['stamp-1'],
          confidence_score: 0.8,
          last_reported_at: '2024-06-01',
          created_at: '2024-06-01',
          updated_at: '2024-06-01',
        },
      ];
      mockFrom.mockReturnValue({ select: mockSelect });
      mockSelect.mockReturnValue({ eq: mockEq });
      mockEq.mockReturnValue({ data: mockData, error: null });

      const result = await fetchSpotAggregatedInfo('spot-1');
      expect(mockFrom).toHaveBeenCalledWith('spot_aggregated_info');
      expect(mockSelect).toHaveBeenCalledWith('*');
      expect(mockEq).toHaveBeenCalledWith('spot_id', 'spot-1');
      expect(result).toEqual(mockData);
    });

    it('returns empty array on error', async () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
      mockFrom.mockReturnValue({ select: mockSelect });
      mockSelect.mockReturnValue({ eq: mockEq });
      mockEq.mockReturnValue({ data: null, error: { message: 'fetch error' } });

      const result = await fetchSpotAggregatedInfo('spot-1');
      expect(result).toEqual([]);
      expect(warnSpy).toHaveBeenCalledWith('Failed to fetch spot aggregated info:', 'fetch error');
      warnSpy.mockRestore();
    });

    it('returns empty array when data is null without error', async () => {
      mockFrom.mockReturnValue({ select: mockSelect });
      mockSelect.mockReturnValue({ eq: mockEq });
      mockEq.mockReturnValue({ data: null, error: null });

      const result = await fetchSpotAggregatedInfo('spot-1');
      expect(result).toEqual([]);
    });
  });

  describe('triggerExtraction', () => {
    it('calls supabase.functions.invoke with correct parameters', async () => {
      mockInvoke.mockResolvedValue({ error: null });

      await triggerExtraction('stamp-1');
      expect(mockInvoke).toHaveBeenCalledWith('extract-spot-info', {
        body: { stamp_id: 'stamp-1' },
      });
    });

    it('handles errors with console.warn', async () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
      mockInvoke.mockResolvedValue({ error: { message: 'invoke error' } });

      await triggerExtraction('stamp-1');
      expect(warnSpy).toHaveBeenCalledWith('Failed to trigger extraction:', 'invoke error');
      warnSpy.mockRestore();
    });
  });
});
