// 寺社を追加する（Issue #248 / 要件 §5・§6）。
//
// - 調べた候補: クライアントからは researchId と候補番号だけを受ける（D-1）。住所・座標・情報源は
//   research-spot がサーバーに置いた値を使う。本文に偽の URL を入れて active を作らせない
// - 地図で決めた（④）: 情報源が無いので常に pending（本人にだけ見える）
// - どの基準で落ちたかはログに出すだけで応答に含めない（公開の通知をしない）
import { cleanSpotName, type StoredCandidate } from '../_shared/spotResearch.ts';
import { distanceMeters, judgePublish, NEARBY_METERS } from '../_shared/spotRules.ts';
import { normalizeSpotName } from '../_shared/spotName.ts';

/** 調べてから「ここです」までの猶予 */
export const RESEARCH_TTL_MS = 60 * 60 * 1000;

export interface NearbySpotRow {
  id: string;
  name: string;
  lat: number;
  lng: number;
  status: string;
  created_by_user_id: string | null;
  [key: string]: unknown;
}

export interface AddSpotDeps {
  getUserId(token: string): Promise<string | null>;
  getResearch(
    id: string
  ): Promise<{ user_id: string; candidates: StoredCandidate[]; created_at: string } | null>;
  /** (lat, lng) の近く（±0.005 度）の spots。status を問わない（service role） */
  nearbySpots(lat: number, lng: number): Promise<NearbySpotRow[]>;
  insertSpot(row: Record<string, unknown>): Promise<Record<string, unknown>>;
  insertOfficialSource(spotId: string, url: string): Promise<void>;
  now(): number;
  log(message: string): void;
}

export type AddSpotOutcome = { status: number; body: Record<string, unknown> };

const fail = (status: number, error: string): AddSpotOutcome => ({ status, body: { error } });

type Place = Omit<StoredCandidate, 'sources' | 'officialUrl' | 'address' | 'prefecture'> & {
  address: string | null;
  prefecture: string | null;
};

function parseManual(value: unknown): Place | null {
  if (!value || typeof value !== 'object') return null;
  const m = value as Record<string, unknown>;
  const name = cleanSpotName(m.name);
  const { type, lat, lng } = m;
  if (!name || (type !== 'shrine' && type !== 'temple')) return null;
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;
  if (!(lat >= 20 && lat <= 46 && lng >= 122 && lng <= 154)) return null;
  return { name, type, lat, lng, address: null, prefecture: null };
}

export async function handleAddSpot(
  deps: AddSpotDeps,
  token: string | null,
  body: Record<string, unknown>
): Promise<AddSpotOutcome> {
  const userId = token ? await deps.getUserId(token) : null;
  if (!userId) return fail(401, 'unauthorized');

  let place: Place;
  let candidate: StoredCandidate | null = null;
  if ('manual' in body) {
    const manual = parseManual(body.manual);
    if (!manual) return fail(400, 'invalid manual spot');
    place = manual;
  } else if (typeof body.researchId === 'string' && Number.isInteger(body.candidateIndex)) {
    const research = await deps.getResearch(body.researchId);
    const index = body.candidateIndex as number;
    const fresh =
      research &&
      research.user_id === userId &&
      deps.now() - Date.parse(research.created_at) <= RESEARCH_TTL_MS;
    candidate = fresh ? (research.candidates[index] ?? null) : null;
    if (!candidate) return fail(404, 'candidate not found');
    place = candidate;
  } else {
    return fail(400, 'invalid body');
  }

  const nearby = await deps.nearbySpots(place.lat, place.lng);
  // 本人に見えるもの（active と本人の pending）だけが重複の対象（D-7）
  const visible = nearby.filter(
    s => s.status === 'active' || (s.status === 'pending' && s.created_by_user_id === userId)
  );
  const same = visible.find(
    s =>
      normalizeSpotName(s.name) === normalizeSpotName(place.name) &&
      distanceMeters(place.lat, place.lng, s.lat, s.lng) <= NEARBY_METERS
  );
  if (same) return { status: 200, body: { spot: same } };

  const judged = judgePublish({
    name: place.name,
    type: place.type,
    prefecture: place.prefecture,
    lat: place.lat,
    lng: place.lng,
    sourceUrls: candidate?.sources.map(s => s.url) ?? [],
    nearbyActives: nearby.filter(s => s.status === 'active'),
    manual: !candidate,
  });
  deps.log(`[add-spot] ${place.name}: ${judged.status} ${judged.failed.join(',')}`);

  const spot = await deps.insertSpot({
    name: place.name,
    type: place.type,
    address: place.address,
    prefecture: place.prefecture,
    lat: place.lat,
    lng: place.lng,
    status: judged.status,
    rank: 1,
    created_by_user_id: userId,
  });
  if (judged.status === 'active' && candidate?.officialUrl) {
    await deps.insertOfficialSource(spot.id as string, candidate.officialUrl);
  }
  return { status: 200, body: { spot } };
}
