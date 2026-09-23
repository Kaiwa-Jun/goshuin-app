import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useRecordForm } from '@hooks/useRecordForm';
import type { RecordSubmitResult, RecordField } from '@hooks/useRecordForm';
import type { Spot, Stamp } from '@/types/supabase';
import { MAX_PHOTOS_PER_RECORD } from '@/constants/record';

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
    expect(result.current.imageUris).toEqual([]);
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

  it('sets imageUris with addImages', () => {
    const { result } = renderHook(() => useRecordForm());

    act(() => {
      result.current.addImages(['file:///photo.jpg']);
    });

    expect(result.current.imageUris).toEqual(['file:///photo.jpg']);
    expect(result.current.imageError).toBeNull();
  });

  it('sets memo with setMemo', () => {
    const { result } = renderHook(() => useRecordForm());

    act(() => {
      result.current.setMemo('素晴らしい参拝でした');
    });

    expect(result.current.memo).toBe('素晴らしい参拝でした');
  });

  it('スポット未選択なら spot を返し spotError を出す', () => {
    const { result } = renderHook(() => useRecordForm());

    act(() => {
      result.current.addImages(['file:///photo.jpg']);
    });

    let invalid: RecordField[];
    act(() => {
      invalid = result.current.validate();
    });

    expect(invalid!).toEqual(['spot']);
    expect(result.current.spotError).toBe('スポットを選択してください');
  });

  it('写真が無ければ image を返し imageError を出す', () => {
    const { result } = renderHook(() => useRecordForm());

    act(() => {
      result.current.selectSpot(fakeSpot);
    });

    let invalid: RecordField[];
    act(() => {
      invalid = result.current.validate();
    });

    expect(invalid!).toEqual(['image']);
    expect(result.current.imageError).toBe('御朱印の写真を追加してください');
  });

  // 画面がどの欄までスクロールすべきかを決めるので、並び順は画面と同じにする
  it('両方欠けていたら画面の並び順で返す', () => {
    const { result } = renderHook(() => useRecordForm());

    let invalid: RecordField[];
    act(() => {
      invalid = result.current.validate();
    });

    expect(invalid!).toEqual(['spot', 'image']);
  });

  it('両方そろっていれば空配列', () => {
    const { result } = renderHook(() => useRecordForm());

    act(() => {
      result.current.selectSpot(fakeSpot);
      result.current.addImages(['file:///photo.jpg']);
    });

    let invalid: RecordField[];
    act(() => {
      invalid = result.current.validate();
    });

    expect(invalid!).toEqual([]);
    expect(result.current.spotError).toBeNull();
    expect(result.current.imageError).toBeNull();
  });

  it('submit returns stamp on success', async () => {
    mockUploadStampImage.mockResolvedValue('user-1/12345.jpg');
    mockCreateStamp.mockResolvedValue(fakeStamp);

    const { result } = renderHook(() => useRecordForm());

    act(() => {
      result.current.selectSpot(fakeSpot);
      result.current.addImages(['file:///photo.jpg']);
    });

    let submitResult: RecordSubmitResult;
    await act(async () => {
      submitResult = await result.current.submit();
    });

    expect(submitResult!.success).toBe(true);
    expect(submitResult!.stamps).toEqual([fakeStamp]);
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
      result.current.addImages(['file:///photo.jpg']);
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
      result.current.addImages(['file:///photo.jpg']);
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
      result.current.addImages(['file:///photo.jpg']);
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
      result.current.addImages(['file:///photo.jpg']);
      result.current.setMemo('test memo');
    });

    expect(result.current.selectedSpot).toEqual(fakeSpot);

    act(() => {
      result.current.reset();
    });

    expect(result.current.selectedSpot).toBeNull();
    expect(result.current.imageUris).toEqual([]);
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
      result.current.addImages(['file:///photo.jpg']);
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
      result.current.addImages(['file:///photo.jpg']);
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
      result.current.addImages(['file:///photo.jpg']);
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

  // reset はフォームを初期状態に戻すもので、既定選択は初期状態の一部。
  // 画面を開き直したときと同じ結果になるのが自然なので、選び直しの後でも
  // reset すれば既定値に戻る
  it('reset すると既定選択の状態に戻る', async () => {
    const { result } = renderHook(() => useRecordForm({ autoSelectableSpot: fakeSpot }));

    await waitFor(() => {
      expect(result.current.isSpotAutoSelected).toBe(true);
    });

    act(() => {
      result.current.selectSpot(otherSpot);
    });
    expect(result.current.isSpotAutoSelected).toBe(false);

    act(() => {
      result.current.reset();
    });

    await waitFor(() => {
      expect(result.current.selectedSpot).toEqual(fakeSpot);
    });
    expect(result.current.isSpotAutoSelected).toBe(true);
  });

  it('候補が無ければ reset 後も何も選ばれない', async () => {
    const { result } = renderHook(() => useRecordForm({ autoSelectableSpot: null }));

    act(() => {
      result.current.selectSpot(otherSpot);
    });

    act(() => {
      result.current.reset();
    });

    expect(result.current.selectedSpot).toBeNull();
    expect(result.current.isSpotAutoSelected).toBe(false);
  });
  // 覆いの中の点を染めるための数。1枚ずつ順に上げているので進捗は既に分かる（Issue #190）
  describe('保存できた枚数（savedCount）', () => {
    beforeEach(() => {
      mockTriggerExtraction.mockResolvedValue(undefined);
    });

    it('最初は 0', () => {
      const { result } = renderHook(() => useRecordForm());

      expect(result.current.savedCount).toBe(0);
    });

    it('1枚保存できるたびに増える（全部終わるのを待たずに読める）', async () => {
      let releaseSecond!: () => void;
      const second = new Promise<void>(resolve => {
        releaseSecond = resolve;
      });
      mockUploadStampImage.mockImplementation(async (_userId: string, uri: string) => {
        if (uri.endsWith('b.jpg')) await second;
        return 'user-1/x.jpg';
      });
      mockCreateStamp.mockResolvedValue(fakeStamp);

      const { result } = renderHook(() => useRecordForm());

      act(() => {
        result.current.selectSpot(fakeSpot);
        result.current.addImages(['file:///a.jpg', 'file:///b.jpg']);
      });

      let submitted!: Promise<RecordSubmitResult>;
      await act(async () => {
        submitted = result.current.submit();
      });

      // 2枚目のアップロードで止まっている。この時点で1枚目は数えられている
      await waitFor(() => expect(result.current.savedCount).toBe(1));

      await act(async () => {
        releaseSecond();
        await submitted;
      });

      expect(result.current.savedCount).toBe(2);
    });

    it('失敗した写真は数に入らない', async () => {
      mockUploadStampImage
        .mockResolvedValueOnce('user-1/a.jpg')
        .mockRejectedValueOnce(new Error('アップロードに失敗しました'))
        .mockResolvedValueOnce('user-1/c.jpg');
      mockCreateStamp.mockResolvedValue(fakeStamp);

      const { result } = renderHook(() => useRecordForm());

      act(() => {
        result.current.selectSpot(fakeSpot);
        result.current.addImages(['file:///a.jpg', 'file:///b.jpg', 'file:///c.jpg']);
      });

      await act(async () => {
        await result.current.submit();
      });

      expect(result.current.savedCount).toBe(2);
    });

    // 一部だけ失敗したあとのやり直しでは、残った写真の枚数しか出ない。
    // 数え直さないと「4 / 1枚」のような表示になる
    it('やり直すと 0 から数え直す', async () => {
      mockUploadStampImage.mockResolvedValue('user-1/x.jpg');
      mockCreateStamp.mockResolvedValue(fakeStamp);

      const { result } = renderHook(() => useRecordForm());

      act(() => {
        result.current.selectSpot(fakeSpot);
        result.current.addImages(['file:///a.jpg', 'file:///b.jpg']);
      });

      await act(async () => {
        await result.current.submit();
      });
      expect(result.current.savedCount).toBe(2);

      let releaseFirst!: () => void;
      const first = new Promise<void>(resolve => {
        releaseFirst = resolve;
      });
      mockUploadStampImage.mockImplementation(async () => {
        await first;
        return 'user-1/x.jpg';
      });

      act(() => {
        result.current.addImages(['file:///d.jpg']);
      });

      let submitted!: Promise<RecordSubmitResult>;
      await act(async () => {
        submitted = result.current.submit();
      });

      expect(result.current.savedCount).toBe(0);

      await act(async () => {
        releaseFirst();
        await submitted;
      });
    });

    it('reset で 0 に戻る', async () => {
      mockUploadStampImage.mockResolvedValue('user-1/x.jpg');
      mockCreateStamp.mockResolvedValue(fakeStamp);

      const { result } = renderHook(() => useRecordForm());

      act(() => {
        result.current.selectSpot(fakeSpot);
        result.current.addImages(['file:///a.jpg']);
      });
      await act(async () => {
        await result.current.submit();
      });
      expect(result.current.savedCount).toBe(1);

      act(() => {
        result.current.reset();
      });

      expect(result.current.savedCount).toBe(0);
    });
  });

  describe('複数枚をまとめて登録する（Issue #180）', () => {
    const stampFor = (id: string): Stamp => ({ ...fakeStamp, id, image_path: `user-1/${id}.jpg` });

    it('選んだ枚数ぶん stamps を作る', async () => {
      mockUploadStampImage.mockImplementation((_userId: string, uri: string) =>
        Promise.resolve(`user-1/${uri.slice(-5, -4)}.jpg`)
      );
      mockCreateStamp
        .mockResolvedValueOnce(stampFor('s1'))
        .mockResolvedValueOnce(stampFor('s2'))
        .mockResolvedValueOnce(stampFor('s3'));

      const { result } = renderHook(() => useRecordForm());

      act(() => {
        result.current.selectSpot(fakeSpot);
        result.current.addImages(['file:///a.jpg', 'file:///b.jpg', 'file:///c.jpg']);
      });

      let submitResult: RecordSubmitResult;
      await act(async () => {
        submitResult = await result.current.submit();
      });

      expect(mockCreateStamp).toHaveBeenCalledTimes(3);
      expect(submitResult!.success).toBe(true);
      expect(submitResult!.stamps.map(s => s.id)).toEqual(['s1', 's2', 's3']);
      expect(submitResult!.failedCount).toBe(0);
    });

    // 並列にすると created_at が前後して、選んだ順に綴じたはずの1組が並び替わる
    it('選んだ順に1枚ずつ登録する', async () => {
      const order: string[] = [];
      mockUploadStampImage.mockImplementation(async (_userId: string, uri: string) => {
        order.push(`upload:${uri}`);
        return 'user-1/x.jpg';
      });
      mockCreateStamp.mockImplementation(async (params: { imagePath: string }) => {
        order.push(`create:${params.imagePath}`);
        return fakeStamp;
      });

      const { result } = renderHook(() => useRecordForm());

      act(() => {
        result.current.selectSpot(fakeSpot);
        result.current.addImages(['file:///a.jpg', 'file:///b.jpg']);
      });

      await act(async () => {
        await result.current.submit();
      });

      expect(order).toEqual([
        'upload:file:///a.jpg',
        'create:user-1/x.jpg',
        'upload:file:///b.jpg',
        'create:user-1/x.jpg',
      ]);
    });

    // 同じスポットに何度投げても取れる情報は同じ。枚数ぶん Edge Function を叩かない
    it('AI抽出は1枚目だけ呼ぶ', async () => {
      mockUploadStampImage.mockResolvedValue('user-1/x.jpg');
      mockCreateStamp.mockResolvedValueOnce(stampFor('s1')).mockResolvedValueOnce(stampFor('s2'));

      const { result } = renderHook(() => useRecordForm());

      act(() => {
        result.current.selectSpot(fakeSpot);
        result.current.addImages(['file:///a.jpg', 'file:///b.jpg']);
      });

      await act(async () => {
        await result.current.submit();
      });

      expect(mockTriggerExtraction).toHaveBeenCalledTimes(1);
      expect(mockTriggerExtraction).toHaveBeenCalledWith('s1');
    });

    // 3枚目で落ちたときに全部失敗したように見せると、やり直して重複ができる
    it('途中で失敗しても、成功した分は保存され失敗枚数が返る', async () => {
      mockUploadStampImage
        .mockResolvedValueOnce('user-1/a.jpg')
        .mockRejectedValueOnce(new Error('Upload failed'))
        .mockResolvedValueOnce('user-1/c.jpg');
      mockCreateStamp.mockResolvedValueOnce(stampFor('s1')).mockResolvedValueOnce(stampFor('s3'));

      const { result } = renderHook(() => useRecordForm());

      act(() => {
        result.current.selectSpot(fakeSpot);
        result.current.addImages(['file:///a.jpg', 'file:///b.jpg', 'file:///c.jpg']);
      });

      let submitResult: RecordSubmitResult;
      await act(async () => {
        submitResult = await result.current.submit();
      });

      expect(submitResult!.success).toBe(false);
      expect(submitResult!.stamps.map(s => s.id)).toEqual(['s1', 's3']);
      expect(submitResult!.failedCount).toBe(1);
      expect(submitResult!.message).toContain('Upload failed');
    });

    // 1枚が壊れていても、残りの写真を巻き添えにしない
    it('失敗した写真だけがフォームに残る', async () => {
      mockUploadStampImage
        .mockResolvedValueOnce('user-1/a.jpg')
        .mockRejectedValueOnce(new Error('Upload failed'));
      mockCreateStamp.mockResolvedValueOnce(stampFor('s1'));

      const { result } = renderHook(() => useRecordForm());

      act(() => {
        result.current.selectSpot(fakeSpot);
        result.current.addImages(['file:///a.jpg', 'file:///b.jpg']);
      });

      await act(async () => {
        await result.current.submit();
      });

      // 保存済みの a を残すと、やり直しで同じ御朱印が2件できる
      expect(result.current.imageUris).toEqual(['file:///b.jpg']);
    });

    it('removeImage で1枚だけ外せる', () => {
      const { result } = renderHook(() => useRecordForm());

      act(() => {
        result.current.addImages(['file:///a.jpg', 'file:///b.jpg']);
      });
      act(() => {
        result.current.removeImage(0);
      });

      expect(result.current.imageUris).toEqual(['file:///b.jpg']);
    });

    // 並びの中での写真の同一性は URI ではなく位置。URI で外すと、
    // 同じ写真が2枚入っていたときに押していない方まで消える
    it('同じ写真が2枚入っていても、押した1枚だけを外す', () => {
      const { result } = renderHook(() => useRecordForm());

      act(() => {
        result.current.addImages(['file:///a.jpg', 'file:///a.jpg', 'file:///b.jpg']);
      });
      act(() => {
        result.current.removeImage(1);
      });

      expect(result.current.imageUris).toEqual(['file:///a.jpg', 'file:///b.jpg']);
    });

    it('上限を超える分は受け取らない', () => {
      const { result } = renderHook(() => useRecordForm());

      act(() => {
        result.current.addImages(
          Array.from({ length: MAX_PHOTOS_PER_RECORD + 5 }, (_, i) => `file:///${i}.jpg`)
        );
      });

      expect(result.current.imageUris).toHaveLength(MAX_PHOTOS_PER_RECORD);
    });

    // userId の取得を try の外に出していたため、セッションが切れていると
    // TypeError が finally にも掛からず isSubmitting が true のまま固まり、
    // 以降ボタンが一切押せなくなっていた
    it('ログインが切れていても、ボタンが固まらずエラーを返す', async () => {
      mockUseAuth.mockReturnValue({ user: null });

      const { result } = renderHook(() => useRecordForm());

      act(() => {
        result.current.selectSpot(fakeSpot);
        result.current.addImages(['file:///a.jpg', 'file:///b.jpg']);
      });

      let submitResult: RecordSubmitResult;
      await act(async () => {
        submitResult = await result.current.submit();
      });

      expect(submitResult!.success).toBe(false);
      expect(submitResult!.failedCount).toBe(2);
      expect(submitResult!.message).toBeTruthy();
      expect(mockUploadStampImage).not.toHaveBeenCalled();
      expect(result.current.isSubmitting).toBe(false);
    });

    it('写真が1枚も無ければ imageError を出す', () => {
      const { result } = renderHook(() => useRecordForm());

      act(() => {
        result.current.selectSpot(fakeSpot);
      });
      act(() => {
        expect(result.current.validate()).toEqual(['image']);
      });

      expect(result.current.imageError).toBe('御朱印の写真を追加してください');
    });
  });
  // ずれは「端末が UTC より進んでいる」ときだけ出る。JST の固定は jest.config.js 側
  describe('訪問日のタイムゾーン（Issue #204）', () => {
    it('深夜に登録しても、画面に出ている日付をそのまま createStamp へ渡す', async () => {
      mockUploadStampImage.mockResolvedValue('user-1/12345.jpg');
      mockCreateStamp.mockResolvedValue(fakeStamp);

      const { result } = renderHook(() => useRecordForm());
      const midnight = new Date(2026, 8, 20, 0, 30);

      act(() => {
        result.current.selectSpot(fakeSpot);
        result.current.addImages(['file:///photo.jpg']);
        result.current.setVisitedAt(midnight);
      });

      await act(async () => {
        await result.current.submit();
      });

      // toISOString() を通していた頃は 2026-09-19 が渡っていた
      expect(midnight.toISOString().slice(0, 10)).toBe('2026-09-19');
      expect(mockCreateStamp).toHaveBeenCalledWith(
        expect.objectContaining({ visitedAt: '2026-09-20' })
      );
    });

    it('DATE 型に入れられる形（YYYY-MM-DD）で渡す', async () => {
      mockUploadStampImage.mockResolvedValue('user-1/12345.jpg');
      mockCreateStamp.mockResolvedValue(fakeStamp);

      const { result } = renderHook(() => useRecordForm());

      act(() => {
        result.current.selectSpot(fakeSpot);
        result.current.addImages(['file:///photo.jpg']);
      });

      await act(async () => {
        await result.current.submit();
      });

      expect(mockCreateStamp.mock.calls[0][0].visitedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });
});
