import { Circle, Polygon, Svg } from 'react-native-svg';

/**
 * 地図のピン。**アプリが実際に使っている形**。
 *
 * 出どころは `scripts/generate-map-pins.py`。尾の三角と丸頭を、白フチぶん
 * 膨らませて2回描く。以前ここに雫型を1本のパスで描いて「地図タブと同じ形」と
 * 書いていたが、実物を見たら違った。
 *
 * 地図のピンは事前レンダリングした PNG（assets/map-pins/）で、拡大縮小や
 * 色替えが要るオンボーディングでは使いにくいので、同じ寸法で描き直している。
 * **寸法を変えるときは両方直すこと**
 */
const W = 84;
const H = 120;
const CX = 42;
const CY = 44;
const R = 34;
/** 尾の付け根の半幅。円の内側に収める */
const TAIL_HALF = 19;
const TAIL_TIP = 112;
/** 白フチの太さ */
const RING = 7.5;

/** 先端から見た、ピンの中でのタップ点。地図に置くときの基準 */
export const PIN_TIP = { x: CX / W, y: TAIL_TIP / H } as const;
export const PIN_RATIO = W / H;

function Shape({ pad, fill }: { pad: number; fill: string }) {
  return (
    <>
      <Polygon
        points={`${CX - TAIL_HALF - pad},${CY + 10} ${CX + TAIL_HALF + pad},${CY + 10} ${CX},${TAIL_TIP + pad * 1.6}`}
        fill={fill}
      />
      <Circle cx={CX} cy={CY} r={R + pad} fill={fill} />
    </>
  );
}

interface Props {
  /** ピンの高さ。幅は 84:120 で決まる */
  height: number;
  color: string;
  testID?: string;
}

export function MapPin({ height, color, testID }: Props) {
  return (
    <Svg width={height * PIN_RATIO} height={height} viewBox={`0 0 ${W} ${H}`} testID={testID}>
      <Shape pad={RING} fill="#fff" />
      <Shape pad={0} fill={color} />
    </Svg>
  );
}
