import { useState, useEffect, useCallback } from 'react';
import type { Spot, Stamp } from '@/types/supabase';
import { fetchSpotById } from '@services/spots';
import { uploadStampImage, createStamp } from '@services/stamps';
import { fetchProfile } from '@services/profiles';
import { triggerExtraction } from '@services/spotInfo';
import { useAuth } from '@hooks/useAuth';

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

export interface RecordSubmitResult {
  success: boolean;
  stamp?: Stamp;
  error?: unknown;
  stage?: RecordSubmitStage;
  message?: string;
}

interface UseRecordFormReturn {
  selectedSpot: Spot | null;
  /** 現在地から自動で選ばれた状態か。ユーザーが選び直すと false になる */
  isSpotAutoSelected: boolean;
  imageUri: string | null;
  visitedAt: Date;
  memo: string;
  isPublic: boolean;
  spotError: string | null;
  imageError: string | null;
  isSubmitting: boolean;
  submitError: string | null;
  selectSpot: (spot: Spot) => void;
  setImageUri: (uri: string) => void;
  setVisitedAt: (date: Date) => void;
  setMemo: (text: string) => void;
  setIsPublic: (value: boolean) => void;
  validate: () => boolean;
  submit: () => Promise<RecordSubmitResult>;
  reset: () => void;
}

export function useRecordForm(params?: UseRecordFormParams): UseRecordFormReturn {
  const { user } = useAuth();

  const [selectedSpot, setSelectedSpot] = useState<Spot | null>(null);
  const [isSpotAutoSelected, setIsSpotAutoSelected] = useState(false);
  const [imageUri, setImageUriState] = useState<string | null>(null);
  const [visitedAt, setVisitedAt] = useState<Date>(new Date());
  const [memo, setMemo] = useState('');
  const [spotError, setSpotError] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [isPublic, setIsPublic] = useState(false);
  const [defaultPublic, setDefaultPublic] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
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

  const setImageUri = useCallback((uri: string) => {
    setImageUriState(uri);
    setImageError(null);
  }, []);

  const validate = useCallback((): boolean => {
    let valid = true;

    if (!selectedSpot) {
      setSpotError('スポットを選択してください');
      valid = false;
    } else {
      setSpotError(null);
    }

    if (!imageUri) {
      setImageError('御朱印の写真を追加してください');
      valid = false;
    } else {
      setImageError(null);
    }

    return valid;
  }, [selectedSpot, imageUri]);

  const submit = useCallback(async (): Promise<RecordSubmitResult> => {
    if (!validate()) {
      return { success: false };
    }

    setIsSubmitting(true);
    setSubmitError(null);

    // 例外が飛んだ時点でどちらの処理中だったかを残す。
    // Storage の失敗と stamps への insert の失敗は同じ catch に落ちてくるため、
    // これが無いと画面にもログにも区別が残らない
    let stage: RecordSubmitStage = 'upload';

    try {
      const userId = user!.id;
      const imagePath = await uploadStampImage(userId, imageUri!);

      stage = 'create';
      const stamp = await createStamp({
        userId,
        spotId: selectedSpot!.id,
        imagePath,
        visitedAt: visitedAt.toISOString(),
        memo,
        isPublic: isPublic,
      });

      // fire-and-forget: AI抽出はユーザーの投稿体験に影響しない
      triggerExtraction(stamp.id).catch(() => {});

      return { success: true, stamp };
    } catch (error) {
      const message = error instanceof Error ? error.message : '保存に失敗しました';
      setSubmitError(message);
      // 実機では Metro のログに出る。画面にも出すが、コピーしづらい場面用に残す
      console.error(`[record] submit failed at ${stage}: ${message}`, error);
      return { success: false, error, stage, message };
    } finally {
      setIsSubmitting(false);
    }
  }, [validate, user, imageUri, selectedSpot, visitedAt, memo, isPublic]);

  const reset = useCallback(() => {
    setSelectedSpot(null);
    setIsSpotAutoSelected(false);
    setImageUriState(null);
    setVisitedAt(new Date());
    setMemo('');
    setIsPublic(defaultPublic);
    setSpotError(null);
    setImageError(null);
    setSubmitError(null);
    setIsSubmitting(false);
  }, [defaultPublic]);

  return {
    selectedSpot,
    isSpotAutoSelected,
    imageUri,
    visitedAt,
    memo,
    isPublic,
    spotError,
    imageError,
    isSubmitting,
    submitError,
    selectSpot,
    setImageUri,
    setVisitedAt,
    setMemo,
    setIsPublic,
    validate,
    submit,
    reset,
  };
}
