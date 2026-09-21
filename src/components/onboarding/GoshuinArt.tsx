import { Circle, G, Path, Rect, Svg } from 'react-native-svg';

import { colors } from '@theme/colors';

/**
 * オンボーディングに出る御朱印。**描いたもので、写真ではない**。
 *
 * 実際の御朱印は寺社の方が書いた作品で、複製して配ると「その寺社が
 * このアプリを認めている」と読めてしまう。だから自分たちで彫る。
 *
 * 出どころは docs/design/mockups/2026-09-goshuin-art.html。
 */

const W = 240;
const H = 320;

type P = readonly [number, number];

/**
 * 筆の線。三次ベジェを刻んで、接線の法線方向に太さを振った閉じた形にする。
 *
 * **直線の台形では筆に見えない** — 最初それで作って十字架になった。
 * 太さは入りで最大、抜きへ向かって細る
 */
function nib(p0: P, p1: P, p2: P, p3: P, wIn: number, wOut: number, n = 26): string {
  const at = (t: number): P => {
    const u = 1 - t;
    return [
      u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
      u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
    ];
  };
  const tangent = (t: number): P => {
    const u = 1 - t;
    return [
      3 * u * u * (p1[0] - p0[0]) + 6 * u * t * (p2[0] - p1[0]) + 3 * t * t * (p3[0] - p2[0]),
      3 * u * u * (p1[1] - p0[1]) + 6 * u * t * (p2[1] - p1[1]) + 3 * t * t * (p3[1] - p2[1]),
    ];
  };
  const widthAt = (t: number) => wOut + (wIn - wOut) * Math.pow(1 - t, 0.75);

  const left: P[] = [];
  const right: P[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const [x, y] = at(t);
    const [dx, dy] = tangent(t);
    const len = Math.hypot(dx, dy) || 1;
    const half = widthAt(t) / 2;
    left.push([x + (-dy / len) * half, y + (dx / len) * half]);
    right.push([x - (-dy / len) * half, y - (dx / len) * half]);
  }
  const pt = ([x, y]: P) => `${x.toFixed(1)} ${y.toFixed(1)}`;
  return (
    `M${pt(left[0])}` +
    left
      .slice(1)
      .map(q => `L${pt(q)}`)
      .join('') +
    right
      .reverse()
      .map(q => `L${pt(q)}`)
      .join('') +
    'Z'
  );
}

/** 短い点。打ち込みだけの画 */
const tick = (x: number, y: number, dx: number, dy: number, w: number) =>
  nib(
    [x, y],
    [x + dx * 0.3, y + dy * 0.3],
    [x + dx * 0.7, y + dy * 0.7],
    [x + dx, y + dy],
    w,
    w * 0.45,
    10
  );

/**
 * 墨書。**読める字にはしない**。
 *
 * 中央は寺社の名前が入る場所で、そこに読める字を置くと存在しない寺社の
 * 名前を捏造することになる。御朱印らしさは朱印のほうで担保する
 * （実際の御朱印も朱印が主役で、墨は少ない）。
 *
 * 3回作り直している。等間隔の縦横を重ねると格子（井）に見え、縦の流れだけだと
 * 仮名（ス・る）に見えた。長さも角度もばらばらな運びを4つに減らして落ち着いた
 */
const SUMI: string[] = [
  // 右の列（奉拝の位置）。縦横をそろえると小さな楷書に見えるので斜めに崩す
  nib([195, 38], [209, 42], [199, 45], [215, 44], 3.2, 3.6),
  nib([207, 43], [198, 55], [209, 60], [200, 70], 4.4, 1.8),
  nib([197, 80], [212, 84], [201, 87], [216, 86], 3.0, 3.4),
  nib([209, 85], [201, 98], [212, 103], [203, 113], 4.2, 1.7),

  // 中央。運びは4つだけ
  nib([118, 58], [136, 108], [98, 158], [110, 246], 13.0, 3.4),
  nib([88, 92], [124, 78], [146, 112], [172, 102], 8.5, 2.8),
  nib([152, 138], [140, 176], [126, 182], [104, 218], 9.0, 2.6),
  tick(156, 76, 9, 16, 5.0),

  // 左の列（日付の位置）
  ...Array.from({ length: 4 }, (_, i) => [
    tick(38, 72 + i * 30, 12, 3, 2.8),
    nib([44, 78 + i * 30], [47, 86 + i * 30], [42, 92 + i * 30], [46, 98 + i * 30], 3.0, 1.6),
  ]).flat(),
];

/** 和紙のむら。刷毛目のような縦の筋を、ごく薄く */
const GRAIN = Array.from({ length: 22 }, (_, i) => ({
  x: +(i * 11.4).toFixed(1),
  width: +(1.4 + (i % 5) * 0.9).toFixed(1),
}));

/** 朱印の枠。Seal.tsx の1本目と同じ彫り */
const SEAL_FRAME =
  'M4.0 5.2 L50 3.4 L96.0 5.0 L97.4 50 L95.8 96.2 L50 97.4 L4.6 95.6 L3.0 50 Z' +
  'M11.6 12.4 L50 10.8 L88.8 12.6 L90.4 50 L88.6 88.2 L50 90.6 L11.2 88.6 L9.8 50 Z';

/** 12ヶ月の環。満願の紋と同じ */
const RING = Array.from({ length: 12 }, (_, i) => {
  const a = -Math.PI / 2 + (i * Math.PI) / 6;
  return { cx: +(50 + 25.5 * Math.cos(a)).toFixed(2), cy: +(50 + 25.5 * Math.sin(a)).toFixed(2) };
});

function Stamp({
  x,
  y,
  size,
  rotate,
  dot,
}: {
  x: number;
  y: number;
  size: number;
  rotate: number;
  dot: number;
}) {
  return (
    <G
      transform={`translate(${x} ${y}) rotate(${rotate} ${size / 2} ${size / 2}) scale(${size / 100})`}
      fill={colors.seal}
      opacity={0.88}
    >
      <Path fillRule="evenodd" d={SEAL_FRAME} />
      {RING.map((c, i) => (
        <Circle key={i} cx={c.cx} cy={c.cy} r={dot} />
      ))}
    </G>
  );
}

interface Props {
  width: number;
}

export function GoshuinArt({ width }: Props) {
  return (
    <Svg width={width} height={(width * H) / W} viewBox={`0 0 ${W} ${H}`} testID="goshuin-art">
      <Rect width={W} height={H} fill={colors.washi} testID="goshuin-paper" />
      <G opacity={0.025} fill="#6B5B4A">
        {GRAIN.map((g, i) => (
          <Rect key={i} x={g.x} y={0} width={g.width} height={H} />
        ))}
      </G>
      <G fill={colors.sumi} opacity={0.92} testID="goshuin-sumi">
        {SUMI.map((d, i) => (
          <Path key={i} d={d} />
        ))}
      </G>
      <Stamp x={66} y={150} size={108} rotate={-6} dot={6.6} />
      <Stamp x={190} y={24} size={36} rotate={5} dot={7.6} />
    </Svg>
  );
}

/** テスト用。墨の画の数 */
export const SUMI_STROKE_COUNT = SUMI.length;
