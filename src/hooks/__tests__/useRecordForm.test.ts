import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useRecordForm } from '@hooks/useRecordForm';
import type { Spot, Stamp } from '@/types/supabase';

const mockFetchSpotById = jest.fn();
const mockUploadStampImage = jest.fn();
const mockCreateStamp = jest.fn();
const mockUseAuth = jest.fn();

jest.mock('@services/spots', () => ({
  fetchSpotById: (...args: unknown[]) => mockFetchSpotById(...args),
}));

jest.mock('@services/stamps', () => ({
  uploadStampImage: (...args: unknown[]) => mockUploadStampImage(...args),
  createStamp: (...args: unknown[]) => mockCreateStamp(...args),
}));

jest.mock('@hooks/useAuth', () => ({
  useAuth: () => mockUseAuth(),
}));

const fakeSpot: Spot = {
  id: 'spot-1',
  name: '大崎八幡宮',
  lat: 38.2744,
  lng: 140.8577,
  type: 'shrine',
  address: '宮城県仙台市青葉区八幡4-6-1',
  status: 'active',
  created_by_user_id: null,
  merged_into_spot_id: null,
  created_at: '2024-01-01',
  updated_at: '2024-01-01',
};

const fakeStamp: Stamp = {
  id: 'stamp-1',
  user_id: 'user-1',
  spot_id: 'spot-1',
  goshuincho_id: null,
  visited_at: '2024-06-01T00:00:00.000Z',
  image_path: 'user-1/12345.jpg',
  memo: '',
  created_at: '2024-06-01T00:00:00Z',
  updated_at: '2024-06-01T00:00:00Z',
};

describe('useRecordForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuth.mockReturnValue({ user: { id: 'user-1' } });
  });

  it('has correct initial state', () => {
    const { result } = renderHook(() => useRecordForm());

    expect(result.current.selectedSpot).toBeNull();
    expect(result.current.imageUri).toBeNull();
    expect(result.current.visitedAt).toBeInstanceOf(Date);
    expect(result.current.memo).toBe('');
    expect(result.current.spotError).toBeNull();
    expect(result.current.imageError).toBeNull();
    expect(result.current.isSubmitting).toBe(false);
    expect(result.current.submitError).toBeNull();
  });

  it('selects a spot with selectSpot', () => {
    const { result } = renderHook(() => useRecordForm());

    act(() => {
      result.current.selectSpot(fakeSpot);
    });

    expect(result.current.selectedSpot).toEqual(fakeSpot);
    expect(result.current.spotError).toBeNull();
  });

  it('sets imageUri with setImageUri', () => {
    const { result } = renderHook(() => useRecordForm());

    act(() => {
      result.current.setImageUri('file:///photo.jpg');
    });

    expect(result.current.imageUri).toBe('file:///photo.jpg');
    expect(result.current.imageError).toBeNull();
  });

  it('sets memo with setMemo', () => {
    const { result } = renderHook(() => useRecordForm());

    act(() => {
      result.current.setMemo('素晴らしい参拝でした');
    });

    expect(result.current.memo).toBe('素晴らしい参拝でした');
  });

  it('validate returns false and sets spotError when no spot selected', () => {
    const { result } = renderHook(() => useRecordForm());

    act(() => {
      result.current.setImageUri('file:///photo.jpg');
    });

    let valid: boolean;
    act(() => {
      valid = result.current.validate();
    });

    expect(valid!).toBe(false);
    expect(result.current.spotError).toBe('スポットを選択してください');
  });

  it('validate returns false and sets imageError when no image', () => {
    const { result } = renderHook(() => useRecordForm());

    act(() => {
      result.current.selectSpot(fakeSpot);
    });

    let valid: boolean;
    act(() => {
      valid = result.current.validate();
    });

    expect(valid!).toBe(false);
    expect(result.current.imageError).toBe('御朱印の写真を追加してください');
  });

  it('validate returns true when spot and image are set', () => {
    const { result } = renderHook(() => useRecordForm());

    act(() => {
      result.current.selectSpot(fakeSpot);
      result.current.setImageUri('file:///photo.jpg');
    });

    let valid: boolean;
    act(() => {
      valid = result.current.validate();
    });

    expect(valid!).toBe(true);
    expect(result.current.spotError).toBeNull();
    expect(result.current.imageError).toBeNull();
  });

  it('submit returns stamp on success', async () => {
    mockUploadStampImage.mockResolvedValue('user-1/12345.jpg');
    mockCreateStamp.mockResolvedValue(fakeStamp);

    const { result } = renderHook(() => useRecordForm());

    act(() => {
      result.current.selectSpot(fakeSpot);
      result.current.setImageUri('file:///photo.jpg');
    });

    let submitResult: { success: boolean; stamp?: Stamp };
    await act(async () => {
      submitResult = await result.current.submit();
    });

    expect(submitResult!.success).toBe(true);
    expect(submitResult!.stamp).toEqual(fakeStamp);
    expect(mockUploadStampImage).toHaveBeenCalledWith('user-1', 'file:///photo.jpg');
    expect(mockCreateStamp).toHaveBeenCalledWith({
      userId: 'user-1',
      spotId: 'spot-1',
      imagePath: 'user-1/12345.jpg',
      visitedAt: expect.any(String),
      memo: '',
    });
    expect(result.current.isSubmitting).toBe(false);
  });

  it('submit sets submitError on upload failure', async () => {
    mockUploadStampImage.mockRejectedValue(new Error('Upload failed'));

    const { result } = renderHook(() => useRecordForm());

    act(() => {
      result.current.selectSpot(fakeSpot);
      result.current.setImageUri('file:///photo.jpg');
    });

    let submitResult: { success: boolean; stamp?: Stamp };
    await act(async () => {
      submitResult = await result.current.submit();
    });

    expect(submitResult!.success).toBe(false);
    expect(submitResult!.stamp).toBeUndefined();
    expect(result.current.submitError).toBe('Upload failed');
    expect(result.current.isSubmitting).toBe(false);
  });

  it('auto-selects spot when initialSpotId is provided', async () => {
    mockFetchSpotById.mockResolvedValue(fakeSpot);

    const { result } = renderHook(() => useRecordForm({ initialSpotId: 'spot-1' }));

    await waitFor(() => {
      expect(result.current.selectedSpot).toEqual(fakeSpot);
    });

    expect(mockFetchSpotById).toHaveBeenCalledWith('spot-1');
  });

  it('reset restores initial state', () => {
    const { result } = renderHook(() => useRecordForm());

    act(() => {
      result.current.selectSpot(fakeSpot);
      result.current.setImageUri('file:///photo.jpg');
      result.current.setMemo('test memo');
    });

    expect(result.current.selectedSpot).toEqual(fakeSpot);

    act(() => {
      result.current.reset();
    });

    expect(result.current.selectedSpot).toBeNull();
    expect(result.current.imageUri).toBeNull();
    expect(result.current.memo).toBe('');
    expect(result.current.spotError).toBeNull();
    expect(result.current.imageError).toBeNull();
    expect(result.current.submitError).toBeNull();
  });
});
