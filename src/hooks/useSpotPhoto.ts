import { useEffect, useState } from 'react';

import { fetchSpotPhoto } from '@services/spotPhotos';
import type { SpotPhoto } from '@/types/supabase';

/**
 * 寺社の帯の写真（Issue #302 D-18）。
 *
 * 寺社を替えた描画で、すぐ null を返す（前の寺社の写真を出さない）。届いた応答が、
 * もう表示していない寺社のものなら捨てる。画面に戻ったときの取り直しはしない
 * （写真は記録で変わらない）
 */
export function useSpotPhoto(spotId: string): { photo: SpotPhoto | null } {
  const [loaded, setLoaded] = useState<{ spotId: string; photo: SpotPhoto | null }>({
    spotId: '',
    photo: null,
  });

  useEffect(() => {
    if (!spotId) return;
    let current = true;
    fetchSpotPhoto(spotId)
      .then(photo => {
        if (current) setLoaded({ spotId, photo });
      })
      .catch(() => {
        if (current) setLoaded({ spotId, photo: null });
      });
    return () => {
      current = false;
    };
  }, [spotId]);

  return { photo: spotId && loaded.spotId === spotId ? loaded.photo : null };
}
