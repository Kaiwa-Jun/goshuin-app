// 見つからない寺社を調べて追加する（Issue #248）。
// **位置情報は送らない**。research-spot に送るのは名前と、手がかりの文字（都道府県・市区町村）だけ
import { supabase } from '@services/supabase';
import type { Spot, SpotResearchCandidate, SpotType } from '@/types/supabase';
import type { SpotHint } from '@utils/spotHint';

export type ResearchResult =
  | { kind: 'ok'; researchId: string; candidates: SpotResearchCandidate[] }
  | { kind: 'limit' }
  | { kind: 'error' };

function statusOf(error: unknown): number | null {
  const status = (error as { context?: { status?: unknown } } | null)?.context?.status;
  return typeof status === 'number' ? status : null;
}

export async function researchSpot(name: string, hint: SpotHint | null): Promise<ResearchResult> {
  try {
    const { data, error } = await supabase.functions.invoke('research-spot', {
      body: { name, hint },
    });
    if (error) {
      if (statusOf(error) === 429) return { kind: 'limit' };
      console.warn('寺社を調べられませんでした:', error.message);
      return { kind: 'error' };
    }
    if (typeof data?.researchId !== 'string' || !Array.isArray(data.candidates)) {
      return { kind: 'error' };
    }
    return { kind: 'ok', researchId: data.researchId, candidates: data.candidates };
  } catch (error) {
    console.warn('寺社を調べられませんでした:', error);
    return { kind: 'error' };
  }
}

async function addSpot(body: Record<string, unknown>): Promise<Spot> {
  const { data, error } = await supabase.functions.invoke('add-spot', { body });
  if (error || !data?.spot) throw new Error(error?.message ?? '寺社を追加できませんでした');
  return data.spot as Spot;
}

/** 調べた候補。住所・座標・情報源はサーバーに置いた値が使われる（こちらからは送らない） */
export function addResearchedSpot(researchId: string, candidateIndex: number): Promise<Spot> {
  return addSpot({ researchId, candidateIndex });
}

/** 地図で決めた寺社。本人の記録にだけ出る */
export function addManualSpot(manual: {
  name: string;
  type: SpotType;
  lat: number;
  lng: number;
}): Promise<Spot> {
  return addSpot({ manual });
}
