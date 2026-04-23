import { createSpot } from '@services/spots';

const mockFrom = jest.fn();
const mockInsert = jest.fn();
const mockSelect = jest.fn();
const mockSingle = jest.fn();

jest.mock('@services/supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

describe('createSpot', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns Spot with status pending on success', async () => {
    const mockSpot = {
      id: 'spot-new',
      name: 'Test Shrine',
      lat: 38.26,
      lng: 140.87,
      type: 'shrine' as const,
      address: null,
      status: 'pending' as const,
      created_by_user_id: 'user-1',
      merged_into_spot_id: null,
      created_at: '2024-06-01T00:00:00Z',
      updated_at: '2024-06-01T00:00:00Z',
    };

    mockFrom.mockReturnValue({ insert: mockInsert });
    mockInsert.mockReturnValue({ select: mockSelect });
    mockSelect.mockReturnValue({ single: mockSingle });
    mockSingle.mockResolvedValue({ data: mockSpot, error: null });

    const result = await createSpot({
      name: 'Test Shrine',
      type: 'shrine',
      lat: 38.26,
      lng: 140.87,
      createdByUserId: 'user-1',
    });

    expect(mockFrom).toHaveBeenCalledWith('spots');
    expect(mockInsert).toHaveBeenCalledWith({
      name: 'Test Shrine',
      type: 'shrine',
      lat: 38.26,
      lng: 140.87,
      status: 'pending',
      created_by_user_id: 'user-1',
    });
    expect(result).toEqual(mockSpot);
    expect(result.status).toBe('pending');
  });

  it('throws error when DB insert fails', async () => {
    mockFrom.mockReturnValue({ insert: mockInsert });
    mockInsert.mockReturnValue({ select: mockSelect });
    mockSelect.mockReturnValue({ single: mockSingle });
    mockSingle.mockResolvedValue({ data: null, error: { message: 'Insert failed' } });

    await expect(
      createSpot({
        name: 'Test Temple',
        type: 'temple',
        lat: 35.0,
        lng: 135.0,
        createdByUserId: 'user-2',
      })
    ).rejects.toThrow('Insert failed');
  });
});
