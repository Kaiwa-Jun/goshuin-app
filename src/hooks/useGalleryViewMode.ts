import { useState, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type GalleryViewMode = 'flip' | 'grid';

export const GALLERY_VIEW_MODE_KEY = 'gallery_view_mode';
export const DEFAULT_GALLERY_VIEW_MODE: GalleryViewMode = 'flip';

interface UseGalleryViewModeReturn {
  viewMode: GalleryViewMode;
  setViewMode: (mode: GalleryViewMode) => void;
}

function isGalleryViewMode(value: unknown): value is GalleryViewMode {
  return value === 'flip' || value === 'grid';
}

export function useGalleryViewMode(): UseGalleryViewModeReturn {
  const [viewMode, setViewModeState] = useState<GalleryViewMode>(DEFAULT_GALLERY_VIEW_MODE);
  // 読み出しが返る前にユーザーが切り替えていたら、保存値で巻き戻さない
  const hasUserChosen = useRef(false);

  useEffect(() => {
    // 保存値が既定と同じ / 不正 / 未設定のときは setState しない。
    // 読み出しの完了そのものを state に持つと、この hook を使う画面のテストが
    // 一律で act() 警告を出すことになるため（誰も使わない情報でもある）。
    AsyncStorage.getItem(GALLERY_VIEW_MODE_KEY).then(value => {
      if (hasUserChosen.current) return;
      if (!isGalleryViewMode(value)) return;
      setViewModeState(prev => (prev === value ? prev : value));
    });
  }, []);

  const setViewMode = useCallback((mode: GalleryViewMode) => {
    hasUserChosen.current = true;
    setViewModeState(mode);
    // 保存の完了は待たない（useSearchHistory.addHistory と同じ作法）
    AsyncStorage.setItem(GALLERY_VIEW_MODE_KEY, mode);
  }, []);

  return { viewMode, setViewMode };
}
