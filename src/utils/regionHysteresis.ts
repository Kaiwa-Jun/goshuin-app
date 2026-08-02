import type { MapRegion } from '@utils/spotSelection';

/**
 * 中心移動の許容割合（ビューポート幅に対する比）。
 * VIEWPORT_MARGIN(1.2) の片側余白 0.1 × delta 以内の移動なら
 * 新しく見える領域が旧選択の余白に収まる（<= (VIEWPORT_MARGIN - 1) / 2）
 */
export const HYSTERESIS_CENTER_RATIO = 0.1;
/**
 * delta 変化の許容割合。20% 以内の拡大なら新しい真のビューポートが
 * 旧マージン込み範囲に収まる（<= VIEWPORT_MARGIN - 1）
 */
export const HYSTERESIS_DELTA_RATIO = 0.2;

/**
 * クラスタ再計算用の region を更新すべきか判定する。
 * prev は「直近に採用した region」であること（直前に通知された region と
 * 比較すると微小移動の積み重ねで永久に再計算されなくなる）
 */
export function shouldRecomputeRegion(prev: MapRegion | null, next: MapRegion): boolean {
  if (!prev) return true;
  return (
    Math.abs(next.latitude - prev.latitude) >= prev.latitudeDelta * HYSTERESIS_CENTER_RATIO ||
    Math.abs(next.longitude - prev.longitude) >= prev.longitudeDelta * HYSTERESIS_CENTER_RATIO ||
    Math.abs(next.latitudeDelta - prev.latitudeDelta) >=
      prev.latitudeDelta * HYSTERESIS_DELTA_RATIO ||
    Math.abs(next.longitudeDelta - prev.longitudeDelta) >=
      prev.longitudeDelta * HYSTERESIS_DELTA_RATIO
  );
}
