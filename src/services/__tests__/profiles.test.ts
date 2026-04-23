import { fetchProfile, updateDefaultPublicSetting } from '@services/profiles';

const mockFrom = jest.fn();
const mockSelect = jest.fn();
const mockEq = jest.fn();
const mockSingle = jest.fn();
const mockUpdate = jest.fn();

jest.mock('@services/supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

describe('fetchProfile', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns profile for a given user', async () => {
    const mockProfile = {
      id: 'user-1',
      email: 'test@example.com',
      display_name: 'Test User',
      avatar_url: null,
      default_stamp_public: false,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    };

    mockFrom.mockReturnValue({ select: mockSelect });
    mockSelect.mockReturnValue({ eq: mockEq });
    mockEq.mockReturnValue({ single: mockSingle });
    mockSingle.mockReturnValue({ data: mockProfile, error: null });

    const result = await fetchProfile('user-1');
    expect(mockFrom).toHaveBeenCalledWith('profiles');
    expect(mockSelect).toHaveBeenCalledWith('*');
    expect(mockEq).toHaveBeenCalledWith('id', 'user-1');
    expect(result).toEqual(mockProfile);
  });

  it('returns null on error', async () => {
    mockFrom.mockReturnValue({ select: mockSelect });
    mockSelect.mockReturnValue({ eq: mockEq });
    mockEq.mockReturnValue({ single: mockSingle });
    mockSingle.mockReturnValue({ data: null, error: { message: 'not found' } });

    const result = await fetchProfile('user-1');
    expect(result).toBeNull();
  });
});

describe('updateDefaultPublicSetting', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('updates default_stamp_public for a user', async () => {
    mockFrom.mockReturnValue({ update: mockUpdate });
    mockUpdate.mockReturnValue({ eq: mockEq });
    mockEq.mockReturnValue({ error: null });

    await updateDefaultPublicSetting('user-1', true);
    expect(mockFrom).toHaveBeenCalledWith('profiles');
    expect(mockUpdate).toHaveBeenCalledWith({ default_stamp_public: true });
    expect(mockEq).toHaveBeenCalledWith('id', 'user-1');
  });

  it('throws on error', async () => {
    mockFrom.mockReturnValue({ update: mockUpdate });
    mockUpdate.mockReturnValue({ eq: mockEq });
    mockEq.mockReturnValue({ error: { message: 'update failed' } });

    await expect(updateDefaultPublicSetting('user-1', true)).rejects.toThrow('update failed');
  });
});
