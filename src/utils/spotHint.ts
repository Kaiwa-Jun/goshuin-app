// 寺社を調べるときの手がかり（Issue #248 / 要件 §2-5）。
//
// **位置情報はサーバーに送らない**。端末の位置から、端末に取ってある近くの寺社（マスタ）の住所を引き、
// その都道府県・市区町村の**文字**だけを送る。OS の逆ジオコーディングは座標が Apple / Google に渡るので使わない
import { PREFECTURE_NAMES } from '../../supabase/functions/_shared/prefectures';
import { PREFECTURE, cityNameOf } from '@utils/frequentArea';

export interface SpotHint {
  prefecture: string | null;
  city: string | null;
}

/** 「近く」の範囲（D-4）。市区町村をまたがない程度 */
export const HINT_RADIUS_KM = 10;

const CITY = /^[^\s]{1,20}[市区町村]$/;

export function addressToHint(address: string | null, prefecture: string | null): SpotHint | null {
  const pref = address?.match(PREFECTURE)?.[1] ?? prefecture;
  const city = address ? cityNameOf(address) : null;
  if (!pref && !city) return null;
  return { prefecture: pref ?? null, city };
}

/**
 * 近くの寺社の住所から。**位置情報が許可されていないときは必ず null**
 * （useLocation は未許可でも仙台の既定位置を返すので、それを手がかりにしない）
 */
export function nearbyHint(
  items: { spot: { address: string | null; prefecture: string | null }; distanceKm: number }[],
  permissionStatus: string
): SpotHint | null {
  if (permissionStatus !== 'granted') return null;
  const nearest = [...items]
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .find(i => i.spot.address || i.spot.prefecture);
  if (!nearest || nearest.distanceKm > HINT_RADIUS_KM) return null;
  return addressToHint(nearest.spot.address, nearest.spot.prefecture);
}

export function formatHint(hint: SpotHint | null): string | null {
  if (!hint) return null;
  return [hint.prefecture, hint.city].filter(Boolean).join(' ') || null;
}

/** 「変える」で直した文字から。47 に無い県・市区町村の形でない文字は捨てる */
export function parseHintText(text: string): SpotHint | null {
  let rest = text.normalize('NFKC').trim();
  const prefecture = PREFECTURE_NAMES.find(p => rest.startsWith(p)) ?? null;
  if (prefecture) rest = rest.slice(prefecture.length).trim();
  else rest = rest.replace(PREFECTURE, '').trim();
  const city = CITY.test(rest) ? rest : null;
  if (!prefecture && !city) return null;
  return { prefecture, city };
}
