// 寺社をみんなの地図に自動で載せる基準（Issue #248 / 要件 §5 の P-1〜P-4）。
// すべて合格なら active、1つでも欠ければ本人にだけ見える pending。
import { isAllowedSourceUrl } from './crawl.ts';
import { inPrefectureBounds } from './prefectures.ts';
import { isSimilarName, typeConflicts } from './spotName.ts';

export { isSimilarName, normalizeSpotName, typeConflicts } from './spotName.ts';

/** P-3 の「近く」 */
export const NEARBY_METERS = 300;

const JP_SECOND_LEVEL = new Set(['co', 'or', 'ne', 'ac', 'go', 'lg', 'gr', 'ed', 'ad']);

/** 同じ運営とみなす単位。a.sakura.ne.jp と b.sakura.ne.jp は同じ（厳しい側に倒す） */
export function registrableDomain(url: string): string | null {
  if (!isAllowedSourceUrl(url)) return null;
  // 末尾のドット（example.jp.）で同じ運営を別に数えさせない。IP アドレスは運営の単位にならないので数えない
  const host = new URL(url).hostname.toLowerCase().replace(/\.+$/, '');
  if (/^[\d.]+$/.test(host) || host.startsWith('[') || !host.includes('.')) return null;
  const labels = host.replace(/^www\./, '').split('.');
  const take = labels.at(-1) === 'jp' && JP_SECOND_LEVEL.has(labels.at(-2) ?? '') ? 3 : 2;
  return labels.slice(-take).join('.');
}

export function countIndependentDomains(urls: string[]): number {
  return new Set(urls.map(registrableDomain).filter(Boolean)).size;
}

export function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLng = (lng2 - lng1) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
}

export interface NamedPoint {
  name: string;
  lat: number;
  lng: number;
}

export function hasSimilarActiveNearby(
  name: string,
  lat: number,
  lng: number,
  actives: NamedPoint[]
): boolean {
  return actives.some(
    a => distanceMeters(lat, lng, a.lat, a.lng) <= NEARBY_METERS && isSimilarName(name, a.name)
  );
}

export interface PublishInput {
  name: string;
  type: 'shrine' | 'temple';
  prefecture: string | null;
  lat: number;
  lng: number;
  sourceUrls: string[];
  /** 近く（±0.005 度程度）の active */
  nearbyActives: NamedPoint[];
  /** 地図で決めた（④）。情報源が無いので自動では載せない */
  manual?: boolean;
}

export type PublishFailure = 'P-1' | 'P-2' | 'P-3' | 'P-4' | 'manual';

export function judgePublish(input: PublishInput): {
  status: 'active' | 'pending';
  failed: PublishFailure[];
} {
  if (input.manual) return { status: 'pending', failed: ['manual'] };
  const failed: PublishFailure[] = [];
  if (countIndependentDomains(input.sourceUrls) < 2) failed.push('P-1');
  if (!input.prefecture || !inPrefectureBounds(input.prefecture, input.lat, input.lng))
    failed.push('P-2');
  if (hasSimilarActiveNearby(input.name, input.lat, input.lng, input.nearbyActives))
    failed.push('P-3');
  if (typeConflicts(input.name, input.type)) failed.push('P-4');
  return { status: failed.length === 0 ? 'active' : 'pending', failed };
}
