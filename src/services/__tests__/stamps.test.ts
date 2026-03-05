import {
  fetchVisitedSpotIds,
  fetchStampsBySpotId,
  getStampImageUrl,
  fetchAllStamps,
  fetchStampById,
  updateStamp,
  deleteStampImage,
  deleteStamp,
} from '@services/stamps';

const mockSelect = jest.fn();
const mockEq = jest.fn();
const mockOrder = jest.fn();
const mockFrom = jest.fn();
const mockGetPublicUrl = jest.fn();
const mockUpdate = jest.fn();
const mockDelete = jest.fn();
const mockRemove = jest.fn();
const mockStorageFrom = jest.fn();

jest.mock('@services/supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
    storage: {
      from: (...args: unknown[]) => mockStorageFrom(...args),
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

  describe('fetchAllStamps', () => {
    it('returns stamps with spots for a given user', async () => {
      const mockStamps = [
        {
          id: 'stamp-1',
          user_id: 'user-1',
          spot_id: 'spot-1',
          visited_at: '2024-06-01',
          image_path: 'img/1.jpg',
          spots: { name: '伊勢神宮', type: 'shrine' },
        },
        {
          id: 'stamp-2',
          user_id: 'user-1',
          spot_id: 'spot-2',
          visited_at: '2024-01-15',
          image_path: 'img/2.jpg',
          spots: { name: '浅草寺', type: 'temple' },
        },
      ];
      mockFrom.mockReturnValue({ select: mockSelect });
      mockSelect.mockReturnValue({ eq: mockEq });
      mockEq.mockReturnValue({ order: mockOrder });
      mockOrder.mockReturnValue({ data: mockStamps, error: null });

      const result = await fetchAllStamps('user-1');
      expect(mockFrom).toHaveBeenCalledWith('stamps');
      expect(mockSelect).toHaveBeenCalledWith('*, spots!inner(name, type)');
      expect(mockEq).toHaveBeenCalledWith('user_id', 'user-1');
      expect(mockOrder).toHaveBeenCalledWith('visited_at', { ascending: false });
      expect(result).toEqual(mockStamps);
    });

    it('returns empty array on error', async () => {
      mockFrom.mockReturnValue({ select: mockSelect });
      mockSelect.mockReturnValue({ eq: mockEq });
      mockEq.mockReturnValue({ order: mockOrder });
      mockOrder.mockReturnValue({ data: null, error: { message: 'error' } });

      const result = await fetchAllStamps('user-1');
      expect(result).toEqual([]);
    });
  });

  describe('fetchStampById', () => {
    it('returns a single stamp with spot', async () => {
      const mockStamp = {
        id: 'stamp-1',
        user_id: 'user-1',
        spot_id: 'spot-1',
        visited_at: '2024-06-01',
        image_path: 'img/1.jpg',
        spots: { name: '伊勢神宮', type: 'shrine' },
      };
      const mockSingle = jest.fn().mockReturnValue({ data: mockStamp, error: null });
      mockFrom.mockReturnValue({ select: mockSelect });
      mockSelect.mockReturnValue({ eq: mockEq });
      mockEq.mockReturnValue({ single: mockSingle });

      const result = await fetchStampById('stamp-1');
      expect(mockFrom).toHaveBeenCalledWith('stamps');
      expect(mockSelect).toHaveBeenCalledWith('*, spots!inner(name, type)');
      expect(mockEq).toHaveBeenCalledWith('id', 'stamp-1');
      expect(result).toEqual(mockStamp);
    });

    it('throws on error', async () => {
      const mockSingle = jest.fn().mockReturnValue({ data: null, error: { message: 'not found' } });
      mockFrom.mockReturnValue({ select: mockSelect });
      mockSelect.mockReturnValue({ eq: mockEq });
      mockEq.mockReturnValue({ single: mockSingle });

      await expect(fetchStampById('stamp-1')).rejects.toThrow('not found');
    });
  });

  describe('getStampImageUrl', () => {
    it('returns public URL for stamp image', () => {
      mockStorageFrom.mockReturnValue({ getPublicUrl: mockGetPublicUrl });
      mockGetPublicUrl.mockReturnValue({
        data: { publicUrl: 'https://example.com/stamps/img/1.jpg' },
      });

      const result = getStampImageUrl('img/1.jpg');
      expect(mockGetPublicUrl).toHaveBeenCalledWith('img/1.jpg');
      expect(result).toBe('https://example.com/stamps/img/1.jpg');
    });
  });

  describe('updateStamp', () => {
    it('returns updated stamp with spot', async () => {
      const mockStamp = {
        id: 'stamp-1',
        user_id: 'user-1',
        spot_id: 'spot-1',
        visited_at: '2024-06-02',
        image_path: 'img/1.jpg',
        memo: '更新したメモ',
        spots: { name: '伊勢神宮', type: 'shrine' },
      };
      const mockSingle = jest.fn().mockReturnValue({ data: mockStamp, error: null });
      mockFrom.mockReturnValue({ update: mockUpdate });
      mockUpdate.mockReturnValue({ eq: mockEq });
      mockEq.mockReturnValue({ select: mockSelect });
      mockSelect.mockReturnValue({ single: mockSingle });

      const result = await updateStamp('stamp-1', {
        visited_at: '2024-06-02',
        memo: '更新したメモ',
      });
      expect(mockFrom).toHaveBeenCalledWith('stamps');
      expect(mockUpdate).toHaveBeenCalledWith({ visited_at: '2024-06-02', memo: '更新したメモ' });
      expect(mockEq).toHaveBeenCalledWith('id', 'stamp-1');
      expect(mockSelect).toHaveBeenCalledWith('*, spots!inner(name, type)');
      expect(result).toEqual(mockStamp);
    });

    it('throws on error', async () => {
      const mockSingle = jest
        .fn()
        .mockReturnValue({ data: null, error: { message: 'update failed' } });
      mockFrom.mockReturnValue({ update: mockUpdate });
      mockUpdate.mockReturnValue({ eq: mockEq });
      mockEq.mockReturnValue({ select: mockSelect });
      mockSelect.mockReturnValue({ single: mockSingle });

      await expect(updateStamp('stamp-1', { memo: null })).rejects.toThrow('update failed');
    });
  });

  describe('deleteStampImage', () => {
    it('removes image from storage', async () => {
      mockStorageFrom.mockReturnValue({ remove: mockRemove });
      mockRemove.mockReturnValue({ error: null });

      await deleteStampImage('img/1.jpg');
      expect(mockStorageFrom).toHaveBeenCalledWith('goshuin-images');
      expect(mockRemove).toHaveBeenCalledWith(['img/1.jpg']);
    });

    it('throws on error', async () => {
      mockStorageFrom.mockReturnValue({ remove: mockRemove });
      mockRemove.mockReturnValue({ error: { message: 'storage error' } });

      await expect(deleteStampImage('img/1.jpg')).rejects.toThrow('storage error');
    });
  });

  describe('deleteStamp', () => {
    it('deletes image then DB record', async () => {
      mockStorageFrom.mockReturnValue({ remove: mockRemove });
      mockRemove.mockReturnValue({ error: null });
      mockFrom.mockReturnValue({ delete: mockDelete });
      mockDelete.mockReturnValue({ eq: mockEq });
      mockEq.mockReturnValue({ error: null });

      await deleteStamp('stamp-1', 'img/1.jpg');
      expect(mockRemove).toHaveBeenCalledWith(['img/1.jpg']);
      expect(mockFrom).toHaveBeenCalledWith('stamps');
      expect(mockDelete).toHaveBeenCalled();
      expect(mockEq).toHaveBeenCalledWith('id', 'stamp-1');
    });

    it('throws if image deletion fails', async () => {
      mockStorageFrom.mockReturnValue({ remove: mockRemove });
      mockRemove.mockReturnValue({ error: { message: 'image delete error' } });

      await expect(deleteStamp('stamp-1', 'img/1.jpg')).rejects.toThrow('image delete error');
    });

    it('throws if DB deletion fails', async () => {
      mockStorageFrom.mockReturnValue({ remove: mockRemove });
      mockRemove.mockReturnValue({ error: null });
      mockFrom.mockReturnValue({ delete: mockDelete });
      mockDelete.mockReturnValue({ eq: mockEq });
      mockEq.mockReturnValue({ error: { message: 'db delete error' } });

      await expect(deleteStamp('stamp-1', 'img/1.jpg')).rejects.toThrow('db delete error');
    });
  });
});
