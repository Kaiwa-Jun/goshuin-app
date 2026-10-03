// 寺社を調べるときの地域の手がかり（Issue #248）。本人が「地域を絞る」で入れた文字だけを使う。
// いまいる場所から自動で作るのはやめた（家に帰ってから記録すると、いる場所と寺社の場所が違う）
import { PREFECTURE_NAMES } from '../../supabase/functions/_shared/prefectures';
import { PREFECTURE, cityNameOf } from '@utils/frequentArea';

export interface SpotHint {
  prefecture: string | null;
  city: string | null;
}

const CITY = /^[^\s]{1,20}[市区町村]$/;

export function addressToHint(address: string | null, prefecture: string | null): SpotHint | null {
  const pref = address?.match(PREFECTURE)?.[1] ?? prefecture;
  const city = address ? cityNameOf(address) : null;
  if (!pref && !city) return null;
  return { prefecture: pref ?? null, city };
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
