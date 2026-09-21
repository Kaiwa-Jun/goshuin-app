import { JAPAN_MAP_HEIGHT, JAPAN_MAP_WIDTH, JAPAN_PREFECTURE_BOXES } from '@/constants/japanMap';

export interface MapZoom {
  scale: number;
  /** 描画後の px。県の中心を枠の中心へ持ってくる移動量 */
  translateX: number;
  translateY: number;
}

/** 県そのものより広く取って「地方くらい」の寄りにする */
export const REGION_SPAN = 5.5;
/** 大きい県でも、寄ったことが分かるだけは拡大する */
export const MIN_SCALE = 1.8;

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/**
 * その県を枠の真ん中に持ってくる寄り。
 *
 * 枠の中心を軸に拡大されるので、拡大後の中心からのずれを打ち消す。
 * そのうえで**端で地が見えないように移動量を頭打ちにする**。北海道や沖縄は
 * 地図の隅にあるので、素直に中心へ寄せると枠の外の空白が入ってくる。
 */
export function zoomToPrefecture(prefecture: string, width: number): MapZoom {
  const box = JAPAN_PREFECTURE_BOXES[prefecture];
  const height = (width * JAPAN_MAP_HEIGHT) / JAPAN_MAP_WIDTH;
  const k = width / JAPAN_MAP_WIDTH;
  const span = Math.max(box.width, box.height) * REGION_SPAN;
  const scale = Math.max(MIN_SCALE, JAPAN_MAP_WIDTH / span);

  const px = (box.x + box.width / 2) * k;
  const py = (box.y + box.height / 2) * k;
  const limitX = ((scale - 1) * width) / 2;
  const limitY = ((scale - 1) * height) / 2;

  return {
    scale,
    translateX: clamp(-scale * (px - width / 2), -limitX, limitX),
    translateY: clamp(-scale * (py - height / 2), -limitY, limitY),
  };
}
