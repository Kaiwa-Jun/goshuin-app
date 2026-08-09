import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useRecordForm } from '@hooks/useRecordForm';
import type { RecordSubmitResult } from '@hooks/useRecordForm';
import type { Spot, Stamp } from '@/types/supabase';

const mockFetchSpotById = jest.fn();
const mockUploadStampImage = jest.fn();
const mockCreateStamp = jest.fn();
const mockUseAuth = jest.fn();
const mockFetchProfile = jest.fn();
const mockTriggerExtraction = jest.fn();

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

jest.mock('@services/profiles', () => ({
  fetchProfile: (...args: unknown[]) => mockFetchProfile(...args),
}));

jest.mock('@services/spotInfo', () => ({
  triggerExtraction: (...args: unknown[]) => mockTriggerExtraction(...args),
}));

const fakeSpot: Spot = {
  id: 'spot-1',
  name: '大崎八幡宮',
  lat: 38.2744,
  lng: 140.8577,
  type: 'shrine',
  address: '宮城県仙台市青葉区八幡4-6-1',
  prefecture: null,
  status: 'active',
  rank: 3,
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
  is_public: false,
  extracted_info: null,
  created_at: '2024-06-01T00:00:00Z',
  updated_at: '2024-06-01T00:00:00Z',
};

describe('useRecordForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuth.mockReturnValue({ user: { id: 'user-1' } });
    mockFetchProfile.mockResolvedValue({ default_stamp_public: false });
    mockTriggerExtraction.mockResolvedValue(undefined);
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
      isPublic: false,
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

  it('アップロードで落ちたら stage=upload と原文を返す', async () => {
    mockUploadStampImage.mockRejectedValue(
      new Error('new row violates row-level security policy (status=403)')
    );

    const { result } = renderHook(() => useRecordForm());

    act(() => {
      result.current.selectSpot(fakeSpot);
      result.current.setImageUri('file:///photo.jpg');
    });

    let submitResult: RecordSubmitResult;
    await act(async () => {
      submitResult = await result.current.submit();
    });

    expect(submitResult!.stage).toBe('upload');
    expect(submitResult!.message).toBe('new row violates row-level security policy (status=403)');
    expect(mockCreateStamp).not.toHaveBeenCalled();
  });

  it('stamps への insert で落ちたら stage=create を返す', async () => {
    mockUploadStampImage.mockResolvedValue('user-1/12345.jpg');
    mockCreateStamp.mockRejectedValue(new Error('insert failed (code=42501)'));

    const { result } = renderHook(() => useRecordForm());

    act(() => {
      result.current.selectSpot(fakeSpot);
      result.current.setImageUri('file:///photo.jpg');
    });

    let submitResult: RecordSubmitResult;
    await act(async () => {
      submitResult = await result.current.submit();
    });

    // 画像は上がっているので「アップロードエラー」ではない
    expect(submitResult!.stage).toBe('create');
    expect(submitResult!.message).toBe('insert failed (code=42501)');
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

  it('isPublic defaults to false', () => {
    const { result } = renderHook(() => useRecordForm());

    expect(result.current.isPublic).toBe(false);
  });

  it('setIsPublic changes isPublic value', () => {
    const { result } = renderHook(() => useRecordForm());

    act(() => {
      result.current.setIsPublic(true);
    });

    expect(result.current.isPublic).toBe(true);
  });

  it('submit passes isPublic to createStamp', async () => {
    mockUploadStampImage.mockResolvedValue('user-1/12345.jpg');
    mockCreateStamp.mockResolvedValue(fakeStamp);

    const { result } = renderHook(() => useRecordForm());

    act(() => {
      result.current.selectSpot(fakeSpot);
      result.current.setImageUri('file:///photo.jpg');
      result.current.setIsPublic(true);
    });

    await act(async () => {
      await result.current.submit();
    });

    expect(mockCreateStamp).toHaveBeenCalledWith({
      userId: 'user-1',
      spotId: 'spot-1',
      imagePath: 'user-1/12345.jpg',
      visitedAt: expect.any(String),
      memo: '',
      isPublic: true,
    });
  });

  it('isPublic initializes to true when profile default_stamp_public is true', async () => {
    mockFetchProfile.mockResolvedValue({ default_stamp_public: true });

    const { result } = renderHook(() => useRecordForm());

    await waitFor(() => {
      expect(result.current.isPublic).toBe(true);
    });

    expect(mockFetchProfile).toHaveBeenCalledWith('user-1');
  });

  it('calls triggerExtraction after successful submit', async () => {
    mockUploadStampImage.mockResolvedValue('user-1/12345.jpg');
    mockCreateStamp.mockResolvedValue(fakeStamp);

    const { result } = renderHook(() => useRecordForm());

    act(() => {
      result.current.selectSpot(fakeSpot);
      result.current.setImageUri('file:///photo.jpg');
    });

    await act(async () => {
      await result.current.submit();
    });

    expect(mockTriggerExtraction).toHaveBeenCalledWith('stamp-1');
  });

  it('does not call triggerExtraction on submit failure', async () => {
    mockUploadStampImage.mockRejectedValue(new Error('Upload failed'));

    const { result } = renderHook(() => useRecordForm());

    act(() => {
      result.current.selectSpot(fakeSpot);
      result.current.setImageUri('file:///photo.jpg');
    });

    await act(async () => {
      await result.current.submit();
    });

    expect(mockTriggerExtraction).not.toHaveBeenCalled();
  });

  it('reset restores isPublic to default value', async () => {
    mockFetchProfile.mockResolvedValue({ default_stamp_public: true });

    const { result } = renderHook(() => useRecordForm());

    await waitFor(() => {
      expect(result.current.isPublic).toBe(true);
    });

    act(() => {
      result.current.setIsPublic(false);
    });
    expect(result.current.isPublic).toBe(false);

    act(() => {
      result.current.reset();
    });

    expect(result.current.isPublic).toBe(true);
  });
});

describe('最寄りスポットの既定選択（Issue #130 / S-4）', () => {
  const otherSpot: Spot = { ...fakeSpot, id: 'spot-9', name: '榴岡天満宮' };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuth.mockReturnValue({ user: { id: 'user-1' } });
    mockFetchProfile.mockResolvedValue({ default_stamp_public: false });
  });

  // D-2 / D-7
  it('候補が渡されたら既定選択し、自動選択フラグを立てる', async () => {
    const { result } = renderHook(() => useRecordForm({ autoSelectableSpot: fakeSpot }));

    await waitFor(() => {
      expect(result.current.selectedSpot).toEqual(fakeSpot);
    });
    expect(result.current.isSpotAutoSelected).toBe(true);
  });

  it('候補が null なら何も選ばない', async () => {
    const { result } = renderHook(() => useRecordForm({ autoSelectableSpot: null }));

    await waitFor(() => {
      expect(result.current.selectedSpot).toBeNull();
    });
    expect(result.current.isSpotAutoSelected).toBe(false);
  });

  // D-5: ボトムシート経由の明示指定を壊さない
  it('initialSpotId があれば既定選択は働かない', async () => {
    mockFetchSpotById.mockResolvedValue(otherSpot);

    const { result } = renderHook(() =>
      useRecordForm({ initialSpotId: 'spot-9', autoSelectableSpot: fakeSpot })
    );

    await waitFor(() => {
      expect(result.current.selectedSpot).toEqual(otherSpot);
    });
    // D-9: 明示指定は「自動選択」ではない
    expect(result.current.isSpotAutoSelected).toBe(false);
  });

  // D-8
  it('ユーザーが選び直すと自動選択フラグが下りる', async () => {
    const { result } = renderHook(() => useRecordForm({ autoSelectableSpot: fakeSpot }));

    await waitFor(() => {
      expect(result.current.isSpotAutoSelected).toBe(true);
    });

    act(() => {
      result.current.selectSpot(otherSpot);
    });

    expect(result.current.selectedSpot).toEqual(otherSpot);
    expect(result.current.isSpotAutoSelected).toBe(false);
  });

  // D-6: 現在地が動いても、選ばれているものを勝手に差し替えない
  it('選択済みなら候補が変わっても上書きしない', async () => {
    const { result, rerender } = renderHook(
      ({ candidate }: { candidate: Spot | null }) =>
        useRecordForm({ autoSelectableSpot: candidate }),
      { initialProps: { candidate: fakeSpot as Spot | null } }
    );

    await waitFor(() => {
      expect(result.current.selectedSpot).toEqual(fakeSpot);
    });

    act(() => {
      result.current.selectSpot(otherSpot);
    });

    // 位置情報が更新されて別のスポットが最寄りになった状況
    rerender({ candidate: fakeSpot });

    expect(result.current.selectedSpot).toEqual(otherSpot);
    expect(result.current.isSpotAutoSelected).toBe(false);
  });

  it('reset で自動選択フラグも戻る', async () => {
    const { result } = renderHook(() => useRecordForm({ autoSelectableSpot: fakeSpot }));

    await waitFor(() => {
      expect(result.current.isSpotAutoSelected).toBe(true);
    });

    act(() => {
      result.current.reset();
    });

    expect(result.current.selectedSpot).toBeNull();
    expect(result.current.isSpotAutoSelected).toBe(false);
  });
});
