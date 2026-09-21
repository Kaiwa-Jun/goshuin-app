/**
 * 縮小版の置き場所と大きさ（Issue #194 / #196）。
 *
 * 元の写真は iPhone の HEIC がそのまま上がっている。HEIC は Safari でしか
 * 表示できず、サーバ側で扱うにも毎回復号が要る。見るための JPEG を2つ焼いて、
 * 元は保管用として触らない
 */
export const VARIANTS = [
  /** 一覧のタイル用。118pt ＝ 354px（3x）なのでこれで足りる */
  { dir: 'thumb-400', width: 400, quality: 70 },
  /** 詳細・Web 用。詳細は全幅 393pt ＝ 1179px（3x）なので、ちょうど覆える */
  { dir: 'view-1200', width: 1200, quality: 78 },
] as const;

/**
 * 一度の呼び出しで **焼く** 枚数の上限。受け取るパスの数ではない。
 *
 * HEIC の復号は重く、Edge Function の CPU 上限に当たると途中で殺される。
 * 既にあるものは数に入れないので、何度か呼べば端から順に埋まっていく。
 * 1枚につき2サイズ焼くので、サムネだけだった頃より少なめにしてある。
 * 1200px の符号化は 400px の約9倍の画素を扱うため、2枚に分けると
 * 大きい写真で予算を分け合って共倒れになる（実測で 1.4MB 超が全滅した）
 */
export const MAX_BAKES = 1;
/** 受け取るパスの数の上限。全件渡されても困らないように */
export const MAX_PATHS = 200;

/**
 * 元の写真のパスから縮小版のパスを決める（Issue #194）。
 *
 * DB に列を持たず、パスの規約だけで場所を決める。こうすると
 * マイグレーションも既存分の一括焼き直しも要らない。
 *
 *   <user>/1789833118004-7nac4q.jpg
 *   → <user>/thumb-400/1789833118004-7nac4q.jpg
 */
export function variantPathFor(imagePath: string, dir: string): string {
  const slash = imagePath.lastIndexOf('/');
  if (slash < 0) return `${dir}/${imagePath}`;
  return `${imagePath.slice(0, slash)}/${dir}/${imagePath.slice(slash + 1)}`;
}

/** 自分のフォルダ配下か。他人の写真を焼かせない */
export function isOwnedBy(imagePath: string, userId: string): boolean {
  return imagePath.startsWith(`${userId}/`);
}

/** 縮小版そのものを渡されたときに二重に掘らない */
export function isVariantPath(imagePath: string): boolean {
  return VARIANTS.some(v => imagePath.includes(`/${v.dir}/`));
}

export function extractBearerToken(header: string | null): string | null {
  if (!header) return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}
