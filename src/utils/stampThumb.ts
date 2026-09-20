/**
 * サムネを置くフォルダ名。
 *
 * ⚠ Edge Function 側（supabase/functions/make-stamp-thumbnail/thumbnail.ts）と
 *   同じ規約を持っている。片方だけ変えるとサムネが見つからなくなる
 */
export const THUMB_DIR = 'thumb-400';

/**
 * 元の写真のパスからサムネのパスを決める（Issue #194）。
 *
 * DB に列を持たず、パスの規約だけで場所を決める。こうするとマイグレーションも
 * 既存分の一括焼き直しも要らず、無ければ元の写真に落ちるだけで済む。
 *
 *   <user>/1789833118004-7nac4q.jpg
 *   → <user>/thumb-400/1789833118004-7nac4q.jpg
 */
export function stampThumbPath(imagePath: string): string {
  const slash = imagePath.lastIndexOf('/');
  if (slash < 0) return `${THUMB_DIR}/${imagePath}`;
  return `${imagePath.slice(0, slash)}/${THUMB_DIR}/${imagePath.slice(slash + 1)}`;
}
