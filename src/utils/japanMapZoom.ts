import { JAPAN_MAP_HEIGHT, JAPAN_MAP_WIDTH, JAPAN_PREFECTURE_BOXES } from '@/constants/japanMap';

export interface Pan {
  x: number;
  y: number;
}

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

/**
 * 寄せたあと、その県が画面のどこに来るか。
 *
 * ⚠️ **枠の真ん中とは限らない**。端の県（北海道・沖縄・鹿児島）は移動量を
 * 頭打ちにしているので、中心まで寄り切らない。ピンを枠の中心に置くと、
 * その県から外れたところに刺さる。
 */
export function prefectureScreenPoint(prefecture: string, width: number): Pan {
  const box = JAPAN_PREFECTURE_BOXES[prefecture];
  const height = (width * JAPAN_MAP_HEIGHT) / JAPAN_MAP_WIDTH;
  const k = width / JAPAN_MAP_WIDTH;
  const { scale, translateX, translateY } = zoomToPrefecture(prefecture, width);
  const px = (box.x + box.width / 2) * k;
  const py = (box.y + box.height / 2) * k;

  return {
    x: scale * (px - width / 2) + translateX + width / 2,
    y: scale * (py - height / 2) + translateY + height / 2,
  };
}

/** 指で広げられる上限。これ以上寄っても県の形が粗くなるだけ */
export const MAX_SCALE = 8;

/**
 * 拡大した地図が枠を覆ったままになるよう、移動量を頭打ちにする。
 *
 * 押さえないと、指で動かしたときに地図の外の地が見えて「落ちた」ように見える。
 */
export function clampPan(scale: number, pan: Pan, width: number, height: number): Pan {
  const limitX = ((scale - 1) * width) / 2;
  const limitY = ((scale - 1) * height) / 2;

  return {
    x: clamp(pan.x, -limitX, limitX),
    y: clamp(pan.y, -limitY, limitY),
  };
}

/** 2本指の間の距離。ピンチの倍率のもと */
export function touchDistance(touches: { pageX: number; pageY: number }[]): number {
  if (touches.length < 2) return 0;
  return Math.hypot(touches[0].pageX - touches[1].pageX, touches[0].pageY - touches[1].pageY);
}

/**
 * ピンチ後の倍率。
 *
 * 全体より小さくは縮めない（1 が下限）。地図が枠より小さくなると、
 * 端に地が見えて収まりが悪くなる。
 */
export function pinchScale(baseScale: number, startDistance: number, distance: number): number {
  if (startDistance <= 0) return baseScale;
  return clamp((baseScale * distance) / startDistance, 1, MAX_SCALE);
}

/**
 * 指で広げた分だけ、つまんだ場所を軸に寄る。
 *
 * 枠の中心を軸に拡大されるので、つまんだ点が動かないように移動量を補正する。
 * これをしないと、端をつまんでも真ん中に寄っていって気持ち悪い。
 */
export function panForPinch(
  pan: Pan,
  focus: Pan,
  fromScale: number,
  toScale: number,
  width: number,
  height: number
): Pan {
  const ratio = toScale / fromScale;
  const cx = width / 2;
  const cy = height / 2;

  return {
    x: focus.x - cx - ratio * (focus.x - cx - pan.x),
    y: focus.y - cy - ratio * (focus.y - cy - pan.y),
  };
}
