import { useState, useEffect, useCallback } from 'react';
import type { Spot, Stamp } from '@/types/supabase';
import { fetchSpotById } from '@services/spots';
import { uploadStampImage, createStamp, ensureStampVariants } from '@services/stamps';
import { fetchProfile } from '@services/profiles';
import { triggerExtraction } from '@services/spotInfo';
import { useAuth } from '@hooks/useAuth';
import { MAX_PHOTOS_PER_RECORD } from '@/constants/record';

interface UseRecordFormParams {
  initialSpotId?: string;
  /**
   * 現在地から既定選択してよいスポット（`pickAutoSelectableSpot` の結果）。
   * 呼び出し側が算出して渡す。ここで `useNearbySpots` を呼ぶと
   * 画面側と二重にスポットを取得することになるため受け取る形にしている
   */
  autoSelectableSpot?: Spot | null;
}

/**
 * submit() のどこで落ちたか。
 * 'upload' = Storage への画像アップロード / 'create' = stamps への insert。
 * 画面には「アップロードエラー」としか出ていなかったため、
 * DB 側の失敗が Storage の失敗と区別できなかった
 */
export type RecordSubmitStage = 'upload' | 'create';

/**
 * 入力の欠けている欄。画面はこれを見て、その欄までスクロールする。
 * 返す順は画面の並び順と同じにする
 */
export type RecordField = 'spot' | 'image';

export interface RecordSubmitResult {
  /** 選んだ写真が全部保存できたか */
  success: boolean;
  /** 保存できた分。1行 = 1御朱印なので、途中で落ちてもここまでは有効な記録 */
  stamps: Stamp[];
  /** 保存できなかった枚数 */
  failedCount: number;
  error?: unknown;
  stage?: RecordSubmitStage;
  message?: string;
}

interface UseRecordFormReturn {
  selectedSpot: Spot | null;
  /** 現在地から自動で選ばれた状態か。ユーザーが選び直すと false になる */
  isSpotAutoSelected: boolean;
  imageUris: string[];
  visitedAt: Date;
  memo: string;
  isPublic: boolean;
  spotError: string | null;
  imageError: string | null;
  isSubmitting: boolean;
  /** 保存できた枚数。保存中の覆いが、写真1枚ぶんずつ進み具合を出すのに使う */
  savedCount: number;
  submitError: string | null;
  selectSpot: (spot: Spot) => void;
  addImages: (uris: string[]) => void;
  removeImage: (index: number) => void;
  setVisitedAt: (date: Date) => void;
  setMemo: (text: string) => void;
  setIsPublic: (value: boolean) => void;
  /** 欠けている欄を画面の並び順で返す。空配列なら問題なし */
  validate: () => RecordField[];
  submit: () => Promise<RecordSubmitResult>;
  reset: () => void;
}

export function useRecordForm(params?: UseRecordFormParams): UseRecordFormReturn {
  const { user } = useAuth();

  const [selectedSpot, setSelectedSpot] = useState<Spot | null>(null);
  const [isSpotAutoSelected, setIsSpotAutoSelected] = useState(false);
  const [imageUris, setImageUris] = useState<string[]>([]);
  const [visitedAt, setVisitedAt] = useState<Date>(new Date());
  const [memo, setMemo] = useState('');
  const [spotError, setSpotError] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [isPublic, setIsPublic] = useState(false);
  const [defaultPublic, setDefaultPublic] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [savedCount, setSavedCount] = useState(0);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (params?.initialSpotId) {
      fetchSpotById(params.initialSpotId).then(spot => {
        if (spot) {
          setSelectedSpot(spot);
        }
      });
    }
  }, [params?.initialSpotId]);

  useEffect(() => {
    if (user) {
      fetchProfile(user.id).then(profile => {
        if (profile) {
          setIsPublic(profile.default_stamp_public);
          setDefaultPublic(profile.default_stamp_public);
        }
      });
    }
  }, [user]);

  // 既定選択。明示指定（ボトムシート経由）が最優先で、
  // 一度選ばれた後は現在地が動いても上書きしない。
  // ⚠️ setState の更新関数は純粋でなければならない（StrictMode で2回呼ばれる）ので、
  // 「選択済みか」の判定は更新関数の中ではなくここで済ませる
  useEffect(() => {
    if (params?.initialSpotId) return;
    if (!params?.autoSelectableSpot) return;
    if (selectedSpot) return;

    setSelectedSpot(params.autoSelectableSpot);
    setIsSpotAutoSelected(true);
  }, [params?.initialSpotId, params?.autoSelectableSpot, selectedSpot]);

  const selectSpot = useCallback((spot: Spot) => {
    setSelectedSpot(spot);
    setIsSpotAutoSelected(false);
    setSpotError(null);
  }, []);

  const addImages = useCallback((uris: string[]) => {
    // 上限はピッカーの selectionLimit でも効かせているが、カメラからは1枚ずつ
    // 増えるのでここでも止める
    setImageUris(prev => [...prev, ...uris].slice(0, MAX_PHOTOS_PER_RECORD));
    setImageError(null);
  }, []);

  // 並びの中での写真の同一性は URI ではなく位置。URI で外すと、同じ写真が
  // 2枚入っていたときに押していない方まで消える
  const removeImage = useCallback((index: number) => {
    setImageUris(prev => prev.filter((_, i) => i !== index));
  }, []);

  const validate = useCallback((): RecordField[] => {
    const invalid: RecordField[] = [];

    if (!selectedSpot) {
      setSpotError('スポットを選択してください');
      invalid.push('spot');
    } else {
      setSpotError(null);
    }

    if (imageUris.length === 0) {
      setImageError('御朱印の写真を追加してください');
      invalid.push('image');
    } else {
      setImageError(null);
    }

    return invalid;
  }, [selectedSpot, imageUris]);

  const submit = useCallback(async (): Promise<RecordSubmitResult> => {
    if (validate().length > 0) {
      return { success: false, stamps: [], failedCount: 0 };
    }

    // ⚠️ userId の取得を try の外に出さないこと。セッションが切れていると
    // TypeError が finally にも掛からず、isSubmitting が true のまま固まって
    // 以降ボタンが一切押せなくなる。そもそも非 null 断言を置かずに済ませる
    if (!user) {
      const message = 'ログインが切れています。もう一度ログインしてください';
      setSubmitError(message);
      return { success: false, stamps: [], failedCount: imageUris.length, message };
    }
    const userId = user.id;

    setIsSubmitting(true);
    setSubmitError(null);
    // 数え直す。一部だけ失敗したあとのやり直しでは残った写真しか送らないので、
    // 前回の数を引きずると「4 / 1枚」のような表示になる
    setSavedCount(0);

    const saved: Stamp[] = [];
    const failed: string[] = [];
    let lastError: unknown;
    let failedStage: RecordSubmitStage | undefined;
    let message: string | undefined;

    try {
      // 1枚ずつ順番に。並列にすると created_at が前後して、選んだ順に綴じた
      // はずの1組が御朱印帳で並び替わる（Issue #180）
      for (const uri of imageUris) {
        // 例外が飛んだ時点でどちらの処理中だったかを残す。
        // Storage の失敗と stamps への insert の失敗は同じ catch に落ちてくるため、
        // これが無いと画面にもログにも区別が残らない
        let stage: RecordSubmitStage = 'upload';
        try {
          const imagePath = await uploadStampImage(userId, uri);

          stage = 'create';
          const stamp = await createStamp({
            userId,
            spotId: selectedSpot!.id,
            imagePath,
            visitedAt: visitedAt.toISOString(),
            memo,
            isPublic: isPublic,
          });
          saved.push(stamp);
          // 1枚ぶん進んだことを、全部終わるのを待たずに画面へ渡す
          setSavedCount(saved.length);
        } catch (error) {
          // 1枚で止めない。壊れた写真が1枚あっても残りを巻き添えにしない
          failed.push(uri);
          lastError = error;
          failedStage = stage;
          message = error instanceof Error ? error.message : '保存に失敗しました';
          // 実機では Metro のログに出る。画面にも出すが、コピーしづらい場面用に残す
          console.error(`[record] submit failed at ${stage}: ${message}`, error);
        }
      }

      // 保存できた分をフォームから外す。残したままやり直させると同じ御朱印が2件できる
      if (failed.length > 0) {
        setImageUris(failed);
        setSubmitError(message!);
      }

      // fire-and-forget: AI抽出はユーザーの投稿体験に影響しない。
      // 同じスポットに何枚投げても取れる情報は同じなので1枚目だけ
      if (saved.length > 0) {
        triggerExtraction(saved[0].id).catch(() => {});
        // 一覧で使う小さい方を焼いておく。ここで作っておけば、
        // 御朱印帳を開いたときに原寸を取りに行かずに済む（Issue #194）
        ensureStampVariants(saved.map(stamp => stamp.image_path)).catch(() => {});
      }

      return {
        success: failed.length === 0,
        stamps: saved,
        failedCount: failed.length,
        error: lastError,
        stage: failedStage,
        message,
      };
    } finally {
      setIsSubmitting(false);
    }
  }, [validate, user, imageUris, selectedSpot, visitedAt, memo, isPublic]);

  const reset = useCallback(() => {
    setSelectedSpot(null);
    setIsSpotAutoSelected(false);
    setImageUris([]);
    setVisitedAt(new Date());
    setMemo('');
    setIsPublic(defaultPublic);
    setSpotError(null);
    setImageError(null);
    setSubmitError(null);
    setIsSubmitting(false);
    setSavedCount(0);
  }, [defaultPublic]);

  return {
    selectedSpot,
    isSpotAutoSelected,
    imageUris,
    visitedAt,
    memo,
    isPublic,
    spotError,
    imageError,
    isSubmitting,
    savedCount,
    submitError,
    selectSpot,
    addImages,
    removeImage,
    setVisitedAt,
    setMemo,
    setIsPublic,
    validate,
    submit,
    reset,
  };
}
