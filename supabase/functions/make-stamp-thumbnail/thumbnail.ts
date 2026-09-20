/** サムネを置くフォルダ名。元の写真と同じ持ち主フォルダの下に作る */
export const THUMB_DIR = 'thumb-400';
/** 長辺の目安。一覧のタイルは 118pt ＝ 354px（3x）なので、これで足りる */
export const THUMB_WIDTH = 400;
/**
 * 一度の呼び出しで **焼く** 枚数の上限。受け取るパスの数ではない。
 *
 * HEIC の復号は重く、Edge Function の CPU 上限に当たると途中で殺される。
 * 既にあるものは数に入れないので、何度か呼べば端から順に埋まっていく
 */
export const MAX_BAKES = 3;
/** 受け取るパスの数の上限。全件渡されても困らないように */
export const MAX_PATHS = 200;

/**
 * 元の写真のパスからサムネのパスを決める（Issue #194）。
 *
 * DB に列を持たず、パスの規約だけで場所を決める。こうすると
 * マイグレーションも既存分の一括焼き直しも要らない。
 *
 *   <user>/1789833118004-7nac4q.jpg
 *   → <user>/thumb-400/1789833118004-7nac4q.jpg
 */
export function thumbPathFor(imagePath: string): string {
  const slash = imagePath.lastIndexOf('/');
  if (slash < 0) return `${THUMB_DIR}/${imagePath}`;
  return `${imagePath.slice(0, slash)}/${THUMB_DIR}/${imagePath.slice(slash + 1)}`;
}

/** 自分のフォルダ配下か。他人の写真を焼かせない */
export function isOwnedBy(imagePath: string, userId: string): boolean {
  return imagePath.startsWith(`${userId}/`);
}

/** サムネそのものを渡されたときに二重に掘らない */
export function isThumbPath(imagePath: string): boolean {
  return imagePath.includes(`/${THUMB_DIR}/`);
}

export function extractBearerToken(header: string | null): string | null {
  if (!header) return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}
