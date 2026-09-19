interface Params {
  /** 見せたい要素の、コンテンツ座標での上端 */
  blockY: number;
  /** 見せたい要素の高さ */
  blockHeight: number;
  /** ScrollView の見えている高さ */
  viewportHeight: number;
  /** 今のスクロール位置 */
  currentOffset: number;
  /** 下端に残す余白 */
  margin?: number;
}

/**
 * 要素の下端が画面に入るのに必要な、最小のスクロール位置を返す。
 * すでに見えていれば null（動かさない）。
 *
 * 「その要素を画面最上部に持ってくる」だと、上にあるものが画面外に追い出される。
 * 記録画面では、御朱印の写真を見ながら訪問日を決めたいのにそれができなかった。
 */
export function scrollTargetToReveal({
  blockY,
  blockHeight,
  viewportHeight,
  currentOffset,
  margin = 0,
}: Params): number | null {
  // 高さが取れていないうちは判断できない
  if (blockHeight <= 0 || viewportHeight <= 0) return null;

  const target = blockY + blockHeight + margin - viewportHeight;

  // すでに下端まで見えている
  if (target <= currentOffset) return null;

  // 上に戻す方向には動かさない
  return Math.max(0, target);
}
