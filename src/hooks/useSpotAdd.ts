import { useCallback, useRef, useState } from 'react';

import { addManualSpot, addResearchedSpot, researchSpot } from '@services/spotAdd';
import type { Spot, SpotResearchCandidate, SpotType } from '@/types/supabase';
import type { SpotHint } from '@utils/spotHint';

/** 待つのはここまで（サーバーの Claude は 20 秒で打ち切る） */
export const RESEARCH_TIMEOUT_MS = 25000;

export type SpotAddStatus =
  | 'idle'
  | 'asking'
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
  /** 「変える」から来た地域選び（調べ直し）。見出しと回数の知らせが変わる（Issue #277） */
  redo: boolean;
}

const IDLE: SpotAddState = {
  status: 'idle',
  name: '',
  hint: null,
  researchId: null,
  candidates: [],
  saveFailed: false,
  placing: false,
  redo: false,
};

/**
 * 見つからない寺社を調べて追加する流れ（Issue #248 の ②〜④）。
 * 調べる前に地域を聞き（⓪ asking）、選んだ地域で調べ始める（Issue #277）。
 * 追加できた寺社は onAdded に渡して閉じる（記録画面でその寺社が選ばれる）
 */
export function useSpotAdd(onAdded: (spot: Spot) => void) {
  const [state, setState] = useState<SpotAddState>(IDLE);
  // 古い問い合わせの結果（時間切れのあとに返ったもの・調べ直す前のもの）で上書きしない
  const requestId = useRef(0);
  // 地域を聞いている（asking）間だけ、調べる名前を持つ。pick は1回の地域選びにつき1回だけ効かせる
  // （1回ごとに1日10回の枠を使う。同じ描画の中の二度押しは state の status では防げない）
  const askingName = useRef<string | null>(null);

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

  /** まだ調べない。地域を聞く（閉じれば回数は使わない） */
  const start = useCallback((name: string) => {
    askingName.current = name;
    setState({ ...IDLE, status: 'asking', name });
  }, []);

  /** 地域を選んだ瞬間に調べ始める。asking 以外では何もしない */
  const pick = useCallback(
    (hint: SpotHint | null) => {
      const name = askingName.current;
      if (name === null) return undefined;
      askingName.current = null;
      return research(name, hint);
    },
    [research]
  );

  /**
   * 候補・見つからないのあとの「変える」。調べずに地域選び（調べ直し）に戻る。
   * 調べている最中・error・limit では何もしない（調べものを重ねない・捨てない）
   */
  const changeRegion = useCallback(() => {
    if (state.status !== 'candidates' && state.status !== 'notFound') return;
    askingName.current = state.name;
    requestId.current++;
    setState(s => ({
      ...s,
      status: 'asking',
      redo: true,
      candidates: [],
      researchId: null,
      saveFailed: false,
    }));
  }, [state.status, state.name]);

  const retry = useCallback(() => research(state.name, state.hint), [research, state]);

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
    askingName.current = null;
    requestId.current++;
    setState(s => ({ ...s, status: 'manual', saveFailed: false, placing: true }));
  }, []);

  const close = useCallback(() => {
    askingName.current = null;
    requestId.current++;
    setState(IDLE);
  }, []);

  return { state, start, pick, changeRegion, retry, choose, openManual, saveManual, close };
}
