// 名前にも住所にも当たらない言葉（駅名・名所）の場所を、国土地理院の住所検索で引く（Issue #311 の第2段）。
// キー不要・アプリから直接。この API だけの利用条件の文は見つからなかったので、国土地理院コンテンツ利用規約に
// 従い出典「国土地理院」を出す。予告なく変わる・止まることがあるので、失敗は投げずに null（第1段だけで動く）
import type { GsiFeature } from '@utils/placeSearch';

export const GSI_ADDRESS_SEARCH_URL = 'https://msearch.gsi.go.jp/address-search/AddressSearch';
/** これより遅ければ打ち切る。検索欄で待たせるのはこれが限度 */
export const GSI_TIMEOUT_MS = 5000;

function isGsiFeature(value: unknown): value is GsiFeature {
  if (typeof value !== 'object' || value === null) return false;
  const { geometry, properties } = value as {
    geometry?: { coordinates?: unknown };
    properties?: { title?: unknown };
  };
  const coordinates = geometry?.coordinates;
  return (
    Array.isArray(coordinates) &&
    coordinates.length === 2 &&
    coordinates.every(n => typeof n === 'number' && Number.isFinite(n)) &&
    typeof properties?.title === 'string'
  );
}

/**
 * 言葉を国土地理院の住所検索に送り、答えを返す。送るのは言葉だけ（位置情報・アカウントは送らない）。
 * 通信の失敗・時間切れ・200 以外・JSON でない・配列でないときは null。投げない
 */
export async function fetchGsiPlaces(query: string): Promise<GsiFeature[] | null> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  // signal を見ない fetch（古い実装やモック）でも止められるよう、時間切れは自分で reject する
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error(`timeout after ${GSI_TIMEOUT_MS}ms`));
    }, GSI_TIMEOUT_MS);
  });

  const request = async () => {
    const res = await fetch(`${GSI_ADDRESS_SEARCH_URL}?q=${encodeURIComponent(query.trim())}`, {
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body: unknown = await res.json();
    if (!Array.isArray(body)) throw new Error('response is not an array');
    return body.filter(isGsiFeature);
  };

  try {
    return await Promise.race([request(), timeout]);
  } catch (err) {
    console.warn('fetchGsiPlaces error:', err instanceof Error ? err.message : String(err));
    return null;
  } finally {
    clearTimeout(timer);
  }
}
