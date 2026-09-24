import { useCallback, useRef, useState } from 'react';

import { addManualSpot, addResearchedSpot, researchSpot } from '@services/spotAdd';
import type { Spot, SpotResearchCandidate, SpotType } from '@/types/supabase';
import type { SpotHint } from '@utils/spotHint';

/** 待つのはここまで（サーバーの Claude は 20 秒で打ち切る） */
export const RESEARCH_TIMEOUT_MS = 25000;

export type SpotAddStatus =
  | 'idle'
  | 'researching'
  | 'candidates'
  | 'notFound'
  | 'error'
  | 'limit'
  | 'manual'
  | 'saving';

export interface SpotAddState {
  status: SpotAddStatus;
  name: string;
  hint: SpotHint | null;
  researchId: string | null;
  candidates: SpotResearchCandidate[];
  /** 追加の保存に失敗した（シート・地図はそのまま） */
  saveFailed: boolean;
  /** 地図で決める（④）を開いている。保存中（saving）もどちらの画面かをこれで分ける */
  placing: boolean;
}

const IDLE: SpotAddState = {
  status: 'idle',
  name: '',
  hint: null,
  researchId: null,
  candidates: [],
  saveFailed: false,
  placing: false,
};

/**
 * 見つからない寺社を調べて追加する流れ（Issue #248 の ②〜④）。
 * 追加できた寺社は onAdded に渡して閉じる（記録画面でその寺社が選ばれる）
 */
export function useSpotAdd(onAdded: (spot: Spot) => void) {
  const [state, setState] = useState<SpotAddState>(IDLE);
  // 古い問い合わせの結果（時間切れのあとに返ったもの・調べ直す前のもの）で上書きしない
  const requestId = useRef(0);

  const research = useCallback(async (name: string, hint: SpotHint | null) => {
    const id = ++requestId.current;
    setState({ ...IDLE, status: 'researching', name, hint });
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<{ kind: 'error' }>(resolve => {
      timer = setTimeout(() => resolve({ kind: 'error' }), RESEARCH_TIMEOUT_MS);
    });
    const result = await Promise.race([researchSpot(name, hint), timeout]);
    clearTimeout(timer);
    if (id !== requestId.current) return;
    setState(s => {
      if (s.status !== 'researching') return s;
      if (result.kind === 'ok') {
        return result.candidates.length > 0
          ? {
              ...s,
              status: 'candidates',
              researchId: result.researchId,
              candidates: result.candidates,
            }
          : { ...s, status: 'notFound' };
      }
      return { ...s, status: result.kind };
    });
  }, []);

  const start = useCallback(
    (name: string, hint: SpotHint | null) => research(name, hint),
    [research]
  );
  const retry = useCallback(() => research(state.name, state.hint), [research, state]);
  const changeHint = useCallback(
    (hint: SpotHint | null) => research(state.name, hint),
    [research, state.name]
  );

  const finish = useCallback(
    async (save: () => Promise<Spot>) => {
      const back = state.status;
      setState(s => ({ ...s, status: 'saving', saveFailed: false }));
      try {
        const spot = await save();
        requestId.current++;
        setState(IDLE);
        onAdded(spot);
      } catch (error) {
        console.warn('寺社を追加できませんでした:', error);
        setState(s => ({ ...s, status: back, saveFailed: true }));
      }
    },
    [onAdded, state.status]
  );

  const choose = useCallback(
    (index: number) =>
      state.researchId ? finish(() => addResearchedSpot(state.researchId!, index)) : undefined,
    [finish, state.researchId]
  );

  const saveManual = useCallback(
    (manual: { name: string; type: SpotType; lat: number; lng: number }) =>
      finish(() => addManualSpot(manual)),
    [finish]
  );

  const openManual = useCallback(() => {
    requestId.current++;
    setState(s => ({ ...s, status: 'manual', saveFailed: false, placing: true }));
  }, []);

  const close = useCallback(() => {
    requestId.current++;
    setState(IDLE);
  }, []);

  return { state, start, retry, changeHint, choose, openManual, saveManual, close };
}
