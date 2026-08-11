import type { StampWithSpot } from '@/types/supabase';

/**
 * Expo Web での検証イネーブラ（Issue #116 の S-7）。
 *
 * Expo Web は Google / Apple のネイティブサインインしか経路が無く、ログイン済み
 * 状態に到達できない。めくり表示はログイン後の画面にしか無いため、このままでは
 * Evaluator が W 群をほぼ全滅で SKIP することになる。
 *
 * そこで Metro のプラットフォーム拡張子解決を使い、web ビルドでのみ
 * `webPreview.web.ts` を解決させて fixture を差し込む。
 * こちらは native / Jest 向けの既定実装で、常に「プレビューではない」を返す。
 * fixture データも data URI もネイティブのバンドルには入らない。
 */
export function getWebPreviewStamps(): StampWithSpot[] | null {
  return null;
}

export function previewImageUrl(_stamp: StampWithSpot): string {
  return '';
}
