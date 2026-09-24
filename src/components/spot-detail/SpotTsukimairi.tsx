import React, { useMemo } from 'react';

import { TsukimairiCard, TsukimairiPast } from '@components/spot-detail/TsukimairiCard';
import { tsukimairiOf } from '@utils/tsukimairi';
import { toLocalDateString } from '@utils/localDate';
import type { Stamp } from '@/types/supabase';

/**
 * その寺社の月参り。続いていればカード、途切れていれば1行だけ（月参りの要件 §3）。
 * スポット詳細とシートの両方で使う（Issue #253）
 */
export function SpotTsukimairi({ stamps }: { stamps: Stamp[] }) {
  // 参拝日は DATE のまま渡す（new Date() を挟むと Issue #204 と同じ1日ずれを踏む）
  const tsukimairi = useMemo(
    () =>
      tsukimairiOf(
        stamps.map(s => s.visited_at),
        toLocalDateString(new Date())
      ),
    [stamps]
  );
  return (
    <>
      <TsukimairiCard tsukimairi={tsukimairi} />
      {!tsukimairi.shouldShowCard && <TsukimairiPast longest={tsukimairi.longest} />}
    </>
  );
}
