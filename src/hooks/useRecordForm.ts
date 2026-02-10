import { useState, useEffect, useCallback } from 'react';
import type { Spot, Stamp } from '@/types/supabase';
import { fetchSpotById } from '@services/spots';
import { uploadStampImage, createStamp } from '@services/stamps';
import { useAuth } from '@hooks/useAuth';

interface UseRecordFormParams {
  initialSpotId?: string;
}

interface UseRecordFormReturn {
  selectedSpot: Spot | null;
  imageUri: string | null;
  visitedAt: Date;
  memo: string;
  spotError: string | null;
  imageError: string | null;
  isSubmitting: boolean;
  submitError: string | null;
  selectSpot: (spot: Spot) => void;
  setImageUri: (uri: string) => void;
  setVisitedAt: (date: Date) => void;
  setMemo: (text: string) => void;
  validate: () => boolean;
  submit: () => Promise<{ success: boolean; stamp?: Stamp }>;
  reset: () => void;
}

export function useRecordForm(params?: UseRecordFormParams): UseRecordFormReturn {
  const { user } = useAuth();

  const [selectedSpot, setSelectedSpot] = useState<Spot | null>(null);
  const [imageUri, setImageUriState] = useState<string | null>(null);
  const [visitedAt, setVisitedAt] = useState<Date>(new Date());
  const [memo, setMemo] = useState('');
  const [spotError, setSpotError] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
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

  const selectSpot = useCallback((spot: Spot) => {
    setSelectedSpot(spot);
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

  const submit = useCallback(async (): Promise<{ success: boolean; stamp?: Stamp }> => {
    if (!validate()) {
      return { success: false };
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const userId = user!.id;
      const imagePath = await uploadStampImage(userId, imageUri!);
      const stamp = await createStamp({
        userId,
        spotId: selectedSpot!.id,
        imagePath,
        visitedAt: visitedAt.toISOString(),
        memo,
      });

      return { success: true, stamp };
    } catch (error) {
      const message = error instanceof Error ? error.message : '保存に失敗しました';
      setSubmitError(message);
      return { success: false };
    } finally {
      setIsSubmitting(false);
    }
  }, [validate, user, imageUri, selectedSpot, visitedAt, memo]);

  const reset = useCallback(() => {
    setSelectedSpot(null);
    setImageUriState(null);
    setVisitedAt(new Date());
    setMemo('');
    setSpotError(null);
    setImageError(null);
    setSubmitError(null);
    setIsSubmitting(false);
  }, []);

  return {
    selectedSpot,
    imageUri,
    visitedAt,
    memo,
    spotError,
    imageError,
    isSubmitting,
    submitError,
    selectSpot,
    setImageUri,
    setVisitedAt,
    setMemo,
    validate,
    submit,
    reset,
  };
}
