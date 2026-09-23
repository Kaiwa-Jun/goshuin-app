/**
 * 縮小版の置き場所。
 *
 * ⚠ Edge Function 側（supabase/functions/make-stamp-thumbnail/thumbnail.ts）と
 *   同じ規約を持っている。片方だけ変えると見つからなくなる
 */
/** 一覧のタイル用 */
export const THUMB_DIR = 'thumb-400';
/** 詳細・Web 用。元は HEIC で Safari でしか表示できないため、見る用はこちら */
export const VIEW_DIR = 'view-1200';

/**
 * 元の写真のパスから縮小版のパスを決める（Issue #194 / #196）。
 *
 * DB に列を持たず、パスの規約だけで場所を決める。こうするとマイグレーションも
 * 既存分の一括焼き直しも要らず、無ければ元の写真に落ちるだけで済む。
 *
 *   <user>/1789833118004-7nac4q.jpg
 *   → <user>/thumb-400/1789833118004-7nac4q.jpg
 */
export function stampVariantPath(imagePath: string, dir: string): string {
  const slash = imagePath.lastIndexOf('/');
  if (slash < 0) return `${dir}/${imagePath}`;
  return `${imagePath.slice(0, slash)}/${dir}/${imagePath.slice(slash + 1)}`;
}

/**
 * 御朱印の写真を配る独自ドメイン（R2 のカスタムドメイン、Issue #227）。
 * 変換（/cdn-cgi/image/）はこのゾーンでしか効かない
 */
export const STAMP_IMAGE_ORIGIN = 'https://img.goshuinsanpo.com';

/**
 * R2 の原本を、幅と品質を指定して配ってもらう URL（Issue #227 S4a）。
 *
 * 焼いて置いておくのをやめ、大きさは URL で頼む。無い大きさを待つことが無くなる。
 * ⚠ format=webp でも `Accept` に image/webp が無いクライアントには JPEG が返る
 *   （表示できない形式は返らない。契約書「S1 の記録」）
 */
export function stampTransformUrl(imagePath: string, width: number, quality: number): string {
  return `${STAMP_IMAGE_ORIGIN}/cdn-cgi/image/width=${width},quality=${quality},format=webp/${imagePath}`;
}
