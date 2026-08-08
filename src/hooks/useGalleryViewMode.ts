import { useState, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type GalleryViewMode = 'flip' | 'grid';

export const GALLERY_VIEW_MODE_KEY = 'gallery_view_mode';
export const DEFAULT_GALLERY_VIEW_MODE: GalleryViewMode = 'flip';

interface UseGalleryViewModeReturn {
  viewMode: GalleryViewMode;
  /** AsyncStorage の読み出しが完了したか。描画のブロックには使わない */
  isHydrated: boolean;
  setViewMode: (mode: GalleryViewMode) => void;
}

function isGalleryViewMode(value: unknown): value is GalleryViewMode {
  return value === 'flip' || value === 'grid';
}

export function useGalleryViewMode(): UseGalleryViewModeReturn {
  const [viewMode, setViewModeState] = useState<GalleryViewMode>(DEFAULT_GALLERY_VIEW_MODE);
  const [isHydrated, setIsHydrated] = useState(false);
  // 読み出しが返る前にユーザーが切り替えていたら、保存値で巻き戻さない
  const hasUserChosen = useRef(false);

  useEffect(() => {
    AsyncStorage.getItem(GALLERY_VIEW_MODE_KEY).then(value => {
      if (!hasUserChosen.current && isGalleryViewMode(value)) {
        setViewModeState(value);
      }
      setIsHydrated(true);
    });
  }, []);

  const setViewMode = useCallback((mode: GalleryViewMode) => {
    hasUserChosen.current = true;
    setViewModeState(mode);
    // 保存の完了は待たない（useSearchHistory.addHistory と同じ作法）
    AsyncStorage.setItem(GALLERY_VIEW_MODE_KEY, mode);
  }, []);

  return { viewMode, isHydrated, setViewMode };
}
