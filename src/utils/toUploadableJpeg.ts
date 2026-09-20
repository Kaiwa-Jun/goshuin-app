/**
 * 保管する写真の長辺の上限。
 *
 * 詳細は全幅 393pt ＝ 1179px（3x）で出すので、見るぶんには 1200px あれば足りる
 * （それは view-1200 が持っている）。こちらは元として残す方なので、少し余裕を
 * 見てこの値にする。12MP のまま置いても使い道が無い
 */
export const MAX_UPLOAD_EDGE = 2048;
/** JPEG の品質。御朱印は墨と朱の輪郭が命なので、落としすぎない */
export const UPLOAD_QUALITY = 0.85;

/**
 * 長辺を上限に収めるための指定。すでに収まっていれば null（縮めない）。
 *
 * 短い方を指定すると縦長の写真が上限より大きくなるので、長い方だけを指定する。
 * もう一方は比率から自動で決まる
 */
export function resizeSpecFor(
  width: number,
  height: number,
  maxEdge: number = MAX_UPLOAD_EDGE
): { width?: number; height?: number } | null {
  if (width <= 0 || height <= 0) return null;

  const longest = Math.max(width, height);
  if (longest <= maxEdge) return null;

  return width >= height ? { width: maxEdge } : { height: maxEdge };
}

/**
 * アップロードできる JPEG にして返す（Issue #196）。
 *
 * expo-image-picker の複数選択は元のファイルをそのまま返すので、iPhone の写真は
 * HEIC のまま上がっていた。HEIC を表示できるのは Safari だけで Web では出ず、
 * サーバ側で触るにも毎回復号が要る。ここで JPEG にしておけば入口で片が付く。
 *
 * 失敗したら元の URI をそのまま返す。変換できないことを理由に記録を落とす方が
 * 損で、サーバ側にも見る用を焼く道がある。
 *
 * ⚠ expo-image-manipulator はネイティブモジュールなので、読み込みを関数の中に
 *   置いている。先頭で import すると、この機能を含まないビルド（入れる前に
 *   焼いた dev build など）で "Cannot find native module" がアプリ起動時に飛び、
 *   画面が出なくなる。ここなら変換だけが諦められて記録は続く
 */
export async function toUploadableJpeg(uri: string): Promise<string> {
  try {
    const { ImageManipulator, SaveFormat } = await import('expo-image-manipulator');

    const source = await ImageManipulator.manipulate(uri).renderAsync();
    const spec = resizeSpecFor(source.width, source.height);

    const rendered = spec
      ? await ImageManipulator.manipulate(source).resize(spec).renderAsync()
      : source;

    const saved = await rendered.saveAsync({
      format: SaveFormat.JPEG,
      compress: UPLOAD_QUALITY,
    });
    return saved.uri;
  } catch (error) {
    console.warn('Failed to convert image to JPEG:', error);
    return uri;
  }
}
