export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface HeroFlight {
  /** 外枠。非等倍で縮める */
  boxScaleX: number;
  boxScaleY: number;
  /** 外枠の縦の潰れを打ち消す、中身の倍率 */
  contentScaleY: number;
  translateX: number;
  translateY: number;
}

/**
 * 一覧のタイルから詳細の画像へ飛ばすための倍率と距離（Issue #192）。
 *
 * 同じ写真が、一覧では「中央を正方形に切り抜いたもの」、詳細では「全体」として
 * 出ている。だから繋げるには、拡大ではなく **枠が開いて切り抜きが外れる** 動きになる。
 *
 * 外枠（overflow: hidden）を非等倍に縮めると中身も一緒に潰れるので、その逆を
 * 中で掛け戻す。こうすると「切り抜かれた見た目」が transform だけで作れて、
 * useNativeDriver に載る。width / height を動かす手もあるが、あれは
 * ネイティブドライバに載らず、飛んでいる最中に JS スレッドが詰まると跳ねる
 *
 * @param source 一覧のタイル（正方形・cover）の画面座標
 * @param target 詳細の画像（全幅・contain）の画面座標
 * @param imageAspect 写真の 横 ÷ 縦
 */
export function heroFlight(source: Rect, target: Rect, imageAspect: number): HeroFlight | null {
  // 画像の大きさがまだ取れていないと目的地が決まらない。
  // 0 で割った NaN を transform に渡すと、その View ごと画面から消える
  if (source.width <= 0 || source.height <= 0) return null;
  if (target.width <= 0 || target.height <= 0) return null;
  if (imageAspect <= 0) return null;

  const boxScaleX = source.width / target.width;
  const boxScaleY = source.height / target.height;

  // cover は短い辺を埋める。3:4 の写真を正方形に収めると、高さは幅の 4/3 になる。
  // 画面上の中身の高さは target.height * contentScaleY * boxScaleY で、
  // target.height * boxScaleY は source.height に等しいので、この比で足りる
  const coveredHeight = source.width / imageAspect;
  const contentScaleY = coveredHeight / source.height;

  return {
    boxScaleX,
    boxScaleY,
    contentScaleY,
    translateX: source.x + source.width / 2 - (target.x + target.width / 2),
    translateY: source.y + source.height / 2 - (target.y + target.height / 2),
  };
}

/**
 * 2つの基準点の差。文字を動かすのに使う。
 *
 * 文字は左端と下端をそろえる。中心をそろえると幅の違う行が横にずれるし、
 * 上端をそろえると、一覧と詳細で行の高さが違うぶん最後に跳ねる
 */
export function anchorDelta(
  source: { x: number; y: number },
  target: { x: number; y: number }
): { translateX: number; translateY: number } {
  return { translateX: source.x - target.x, translateY: source.y - target.y };
}
