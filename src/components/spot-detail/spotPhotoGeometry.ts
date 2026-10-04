/**
 * 帯の写真の置き方（Issue #302 D-11。試作 `photoGeom()`）。
 *
 * 写真は幅いっぱいに置き、見せたい縦の位置 focusY の所が、帯の見えている所（名前の行を
 * 除いた所）の真ん中に来るように縦にずらす。端は帯の外に出さない。横長すぎて大きくの
 * 帯の高さに足りない写真は、その高さまで拡大して左右を切る。
 *
 * import を持たない純関数。選ぶ画面の `supabase/scripts/spot-photos/review/geometry.js` は
 * 同じ式の写しで、Deno のテストが2つを同じ入力で比べる（AC-12）。直すときは両方を直す
 */

/** 帯の下に重なる名前の行の高さ（試作 `NAME_H`） */
export const PHOTO_NAME_HEIGHT = 30;

export interface PhotoSize {
  width: number;
  height: number;
  /** 見せたい所の縦の位置（0 = 上の端・1 = 下の端） */
  focusY: number;
}

/** 帯の見えている高さ（半分・大きく） */
export interface PhotoBand {
  compact: number;
  expanded: number;
}

export interface PhotoGeometry {
  left: number;
  width: number;
  height: number;
  /** 半分のときの translateY */
  compactY: number;
  /** 大きくのときの translateY */
  expandedY: number;
}

export function photoGeometry(
  photo: PhotoSize,
  windowWidth: number,
  band: PhotoBand
): PhotoGeometry {
  let width = windowWidth;
  let height = (windowWidth * photo.height) / photo.width;
  if (height < band.expanded) {
    width = (width * band.expanded) / height;
    height = band.expanded;
  }
  const yAt = (bandHeight: number) =>
    Math.min(
      0,
      Math.max(bandHeight - height, (bandHeight - PHOTO_NAME_HEIGHT) / 2 - photo.focusY * height)
    );
  return {
    left: (windowWidth - width) / 2,
    width,
    height,
    compactY: yAt(band.compact),
    expandedY: yAt(band.expanded),
  };
}
