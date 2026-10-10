// 外へのリンクと写真の URL（契約書 docs/issues/issue-324-homepage.md D-9・D-10・D-12）
import { APP_STORE_ID, SPOT_PHOTO_TRANSFORM } from './config.ts';

/** 写真を出す幅（切らずに全体を出す） */
export const PHOTO_WIDTH = 1200;

/** pt があれば App Store Connect のキャンペーンリンク（ct=web）、null なら素のリンク */
export function appStoreUrl(pt: string | null): string {
  if (pt === null) return `https://apps.apple.com/jp/app/id${APP_STORE_ID}`;
  return `https://apps.apple.com/app/apple-store/id${APP_STORE_ID}?pt=${encodeURIComponent(pt)}&ct=web&mt=8`;
}

export function photoUrl(r2Key: string): string {
  return SPOT_PHOTO_TRANSFORM + r2Key;
}

export function photoHeight(width: number, height: number): number {
  return Math.round((PHOTO_WIDTH * height) / width);
}

/** 座標でなく名前と住所で探す（#292 で確かめていない座標があるため） */
export function googleMapsUrl(name: string, address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${name} ${address}`)}`;
}

/** lat・lng は seed の値の文字のまま */
export function osmUrl(lat: string, lng: string): string {
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`;
}
