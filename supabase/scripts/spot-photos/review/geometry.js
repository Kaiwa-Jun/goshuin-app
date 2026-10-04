// 帯の写真の置き方（Issue #302 D-11）。src/components/spot-detail/spotPhotoGeometry.ts の写し。
// 同じ入力で同じ値になるか、geometry_test.ts が比べる（AC-12）。直すときは両方を直す

/** 帯の下に重なる名前の行の高さ（試作 `NAME_H`） */
export const PHOTO_NAME_HEIGHT = 30;

/**
 * @param {{ width: number; height: number; focusY: number }} photo
 * @param {number} windowWidth
 * @param {{ compact: number; expanded: number }} band
 */
export function photoGeometry(photo, windowWidth, band) {
  let width = windowWidth;
  let height = (windowWidth * photo.height) / photo.width;
  if (height < band.expanded) {
    width = (width * band.expanded) / height;
    height = band.expanded;
  }
  const yAt = bandHeight =>
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
