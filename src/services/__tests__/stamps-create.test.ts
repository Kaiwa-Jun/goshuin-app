import { uploadStampImage, createStamp, fetchPublicStampsBySpotId } from '@services/stamps';

const mockFrom = jest.fn();
const mockUpload = jest.fn();
const mockInsert = jest.fn();
const mockSelect = jest.fn();
const mockSingle = jest.fn();
const mockEq = jest.fn();
const mockNeq = jest.fn();
const mockOrder = jest.fn();
const mockLimit = jest.fn();
const mockGetUser = jest.fn();

jest.mock('@services/supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
    auth: {
      getUser: () => mockGetUser(),
    },
    storage: {
      from: () => ({
        upload: (...args: unknown[]) => mockUpload(...args),
      }),
    },
  },
}));

describe('uploadStampImage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns uploaded path on success', async () => {
    mockUpload.mockResolvedValue({ data: { path: 'user-1/12345-abc.jpg' }, error: null });

    const result = await uploadStampImage('user-1', 'file:///photo.jpg');

    // FormData ではなくバイト列を渡す（実機の FormData は has() が無く落ちる）
    expect(mockUpload).toHaveBeenCalledWith(
      expect.stringMatching(/^user-1\/\d+-[a-z0-9]+\.jpg$/),
      expect.any(Uint8Array),
      { contentType: 'image/jpeg' }
    );
    expect(typeof result).toBe('string');
    expect(result).toMatch(/^user-1\//);
  });

  it('throws error when upload fails', async () => {
    mockUpload.mockResolvedValue({ data: null, error: { message: 'Upload failed' } });

    await expect(uploadStampImage('user-1', 'file:///photo.jpg')).rejects.toThrow('Upload failed');
  });

  it('切り分けのため Storage のステータスコードもメッセージに残す', async () => {
    mockUpload.mockResolvedValue({
      data: null,
      error: { message: 'new row violates row-level security policy', statusCode: '403' },
    });

    await expect(uploadStampImage('user-1', 'file:///photo.jpg')).rejects.toThrow(
      'new row violates row-level security policy (status=403)'
    );
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
      is_public: false,
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
      is_public: false,
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
      is_public: false,
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

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ memo: null, is_public: false })
    );
  });

  it('includes is_public: true when isPublic is true', async () => {
    const mockStamp = {
      id: 'stamp-3',
      user_id: 'user-1',
      spot_id: 'spot-1',
      goshuincho_id: null,
      visited_at: '2024-06-01',
      image_path: 'user-1/img.jpg',
      memo: null,
      is_public: true,
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
      isPublic: true,
    });

    expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({ is_public: true }));
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

  it('PostgREST のエラーコードもメッセージに残す', async () => {
    mockFrom.mockReturnValue({ insert: mockInsert });
    mockInsert.mockReturnValue({ select: mockSelect });
    mockSelect.mockReturnValue({ single: mockSingle });
    mockSingle.mockResolvedValue({
      data: null,
      error: {
        message: 'new row violates row-level security policy for table "stamps"',
        code: '42501',
      },
    });

    await expect(
      createStamp({
        userId: 'user-1',
        spotId: 'spot-1',
        imagePath: 'user-1/img.jpg',
        visitedAt: '2024-06-01',
      })
    ).rejects.toThrow('code=42501');
  });
});

describe('fetchPublicStampsBySpotId', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns public stamps for a spot excluding own stamps', async () => {
    const mockPublicStamps = [
      {
        id: 'stamp-10',
        user_id: 'other-user',
        spot_id: 'spot-1',
        visited_at: '2024-07-01',
        image_path: 'other/img.jpg',
        memo: null,
        is_public: true,
        goshuincho_id: null,
        created_at: '2024-07-01T00:00:00Z',
        updated_at: '2024-07-01T00:00:00Z',
        profiles: { display_name: 'OtherUser', avatar_url: null },
      },
    ];

    mockGetUser.mockResolvedValue({ data: { user: { id: 'my-user-id' } } });
    mockFrom.mockReturnValue({ select: mockSelect });
    mockSelect.mockReturnValue({ eq: mockEq });
    // first eq: spot_id
    mockEq.mockReturnValueOnce({ eq: mockEq });
    // second eq: is_public
    mockEq.mockReturnValueOnce({ order: mockOrder });
    mockOrder.mockReturnValue({ limit: mockLimit });
    mockLimit.mockReturnValue({ neq: mockNeq });
    mockNeq.mockReturnValue({ data: mockPublicStamps, error: null });

    const result = await fetchPublicStampsBySpotId('spot-1');

    expect(mockFrom).toHaveBeenCalledWith('stamps');
    expect(mockSelect).toHaveBeenCalledWith(
      '*, profiles!stamps_user_id_profiles_fkey(display_name, avatar_url)'
    );
    expect(result).toEqual(mockPublicStamps);
    expect(result).toHaveLength(1);
  });

  it('returns public stamps without neq when user is not logged in', async () => {
    const mockPublicStamps = [
      {
        id: 'stamp-10',
        user_id: 'other-user',
        spot_id: 'spot-1',
        visited_at: '2024-07-01',
        image_path: 'other/img.jpg',
        memo: null,
        is_public: true,
        goshuincho_id: null,
        created_at: '2024-07-01T00:00:00Z',
        updated_at: '2024-07-01T00:00:00Z',
        profiles: { display_name: 'OtherUser', avatar_url: null },
      },
    ];

    mockGetUser.mockResolvedValue({ data: { user: null } });
    mockFrom.mockReturnValue({ select: mockSelect });
    mockSelect.mockReturnValue({ eq: mockEq });
    mockEq.mockReturnValueOnce({ eq: mockEq });
    mockEq.mockReturnValueOnce({ order: mockOrder });
    mockOrder.mockReturnValue({ limit: mockLimit });
    mockLimit.mockReturnValue({ data: mockPublicStamps, error: null });

    const result = await fetchPublicStampsBySpotId('spot-1');
    expect(result).toEqual(mockPublicStamps);
  });

  it('returns empty array on error', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    mockFrom.mockReturnValue({ select: mockSelect });
    mockSelect.mockReturnValue({ eq: mockEq });
    mockEq.mockReturnValueOnce({ eq: mockEq });
    mockEq.mockReturnValueOnce({ order: mockOrder });
    mockOrder.mockReturnValue({ limit: mockLimit });
    mockLimit.mockReturnValue({ data: null, error: { message: 'query error' } });

    const result = await fetchPublicStampsBySpotId('spot-1');
    expect(result).toEqual([]);
  });
});
