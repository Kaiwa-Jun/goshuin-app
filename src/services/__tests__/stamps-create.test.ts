import { uploadStampImage, createStamp } from '@services/stamps';

const mockFrom = jest.fn();
const mockUpload = jest.fn();
const mockInsert = jest.fn();
const mockSelect = jest.fn();
const mockSingle = jest.fn();

jest.mock('@services/supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
    storage: {
      from: () => ({
        upload: (...args: unknown[]) => mockUpload(...args),
      }),
    },
  },
}));

const mockFetch = jest.fn();
(global as unknown as { fetch: jest.Mock }).fetch = mockFetch;

describe('uploadStampImage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns uploaded path on success', async () => {
    const mockBlob = new Blob(['image-data'], { type: 'image/jpeg' });
    mockFetch.mockResolvedValue({ blob: () => Promise.resolve(mockBlob) });
    mockUpload.mockResolvedValue({ data: { path: 'user-1/12345-abc.jpg' }, error: null });

    const result = await uploadStampImage('user-1', 'file:///photo.jpg');

    expect(mockFetch).toHaveBeenCalledWith('file:///photo.jpg');
    expect(mockUpload).toHaveBeenCalledWith(
      expect.stringMatching(/^user-1\/\d+-[a-z0-9]+\.jpg$/),
      mockBlob,
      { contentType: 'image/jpeg' }
    );
    expect(typeof result).toBe('string');
    expect(result).toMatch(/^user-1\//);
  });

  it('throws error when upload fails', async () => {
    const mockBlob = new Blob(['image-data'], { type: 'image/jpeg' });
    mockFetch.mockResolvedValue({ blob: () => Promise.resolve(mockBlob) });
    mockUpload.mockResolvedValue({ data: null, error: { message: 'Upload failed' } });

    await expect(uploadStampImage('user-1', 'file:///photo.jpg')).rejects.toThrow('Upload failed');
  });
});

describe('createStamp', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns Stamp on success', async () => {
    const mockStamp = {
      id: 'stamp-1',
      user_id: 'user-1',
      spot_id: 'spot-1',
      goshuincho_id: null,
      visited_at: '2024-06-01',
      image_path: 'user-1/img.jpg',
      memo: 'Great visit',
      created_at: '2024-06-01T00:00:00Z',
      updated_at: '2024-06-01T00:00:00Z',
    };

    mockFrom.mockReturnValue({ insert: mockInsert });
    mockInsert.mockReturnValue({ select: mockSelect });
    mockSelect.mockReturnValue({ single: mockSingle });
    mockSingle.mockResolvedValue({ data: mockStamp, error: null });

    const result = await createStamp({
      userId: 'user-1',
      spotId: 'spot-1',
      imagePath: 'user-1/img.jpg',
      visitedAt: '2024-06-01',
      memo: 'Great visit',
    });

    expect(mockFrom).toHaveBeenCalledWith('stamps');
    expect(mockInsert).toHaveBeenCalledWith({
      user_id: 'user-1',
      spot_id: 'spot-1',
      image_path: 'user-1/img.jpg',
      visited_at: '2024-06-01',
      memo: 'Great visit',
    });
    expect(result).toEqual(mockStamp);
  });

  it('saves memo as null when omitted', async () => {
    const mockStamp = {
      id: 'stamp-2',
      user_id: 'user-1',
      spot_id: 'spot-1',
      goshuincho_id: null,
      visited_at: '2024-06-01',
      image_path: 'user-1/img.jpg',
      memo: null,
      created_at: '2024-06-01T00:00:00Z',
      updated_at: '2024-06-01T00:00:00Z',
    };

    mockFrom.mockReturnValue({ insert: mockInsert });
    mockInsert.mockReturnValue({ select: mockSelect });
    mockSelect.mockReturnValue({ single: mockSingle });
    mockSingle.mockResolvedValue({ data: mockStamp, error: null });

    await createStamp({
      userId: 'user-1',
      spotId: 'spot-1',
      imagePath: 'user-1/img.jpg',
      visitedAt: '2024-06-01',
    });

    expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({ memo: null }));
  });

  it('throws error when DB insert fails', async () => {
    mockFrom.mockReturnValue({ insert: mockInsert });
    mockInsert.mockReturnValue({ select: mockSelect });
    mockSelect.mockReturnValue({ single: mockSingle });
    mockSingle.mockResolvedValue({ data: null, error: { message: 'DB error' } });

    await expect(
      createStamp({
        userId: 'user-1',
        spotId: 'spot-1',
        imagePath: 'user-1/img.jpg',
        visitedAt: '2024-06-01',
      })
    ).rejects.toThrow('DB error');
  });
});
