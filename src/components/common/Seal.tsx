import { Circle, G, Path, Polygon, Rect, Svg } from 'react-native-svg';

import { colors } from '@theme/colors';

/**
 * 印。**フォントは使わない**。すべて彫った図形。
 *
 * もとは「色つきの丸 + 絵文字」だった。🎊🏆👑 はゲームの実績の顔で、
 * 御朱印アプリである理由がゼロだったのと、絵文字は OS が描くので
 * iOS と Android で形も色も変わる。
 *
 * 図形の出どころは docs/design/mockups/2026-09-badge-seal-v2.html。
 * あの試作の SVG がそのままここにある（承認されたのはあの見た目）。
 */
export type SealMark =
  /* 訪問数は漢数字。並ぶと数が増えていくのが絵になる */
  | 'ichi'
  | 'go'
  | 'juu'
  | 'sanjuu'
  | 'gojuu'
  | 'hyaku'
  /* 作法・旅のしかたは字をやめて紋にする。軸が違うものは見た目も違っていい */
  | 'mangan'
  | 'shiki'
  | 'mitsu'
  /* 寺社そのものの印。地図のシートの帯に大きく押す（Issue #293） */
  | 'torii'
  | 'dou';

/**
 * 枠。手彫りなので直線でも左右対称でもない。
 *
 * 外周と内周を1つの d に入れて fillRule="evenodd" で帯にする。
 * 3本を使い回す。9個ぜんぶ同じ枠だと、また機械で作った顔になる
 */
export const SEAL_FRAMES = [
  'M4.0 5.2 L50 3.4 L96.0 5.0 L97.4 50 L95.8 96.2 L50 97.4 L4.6 95.6 L3.0 50 Z' +
    'M11.6 12.4 L50 10.8 L88.8 12.6 L90.4 50 L88.6 88.2 L50 90.6 L11.2 88.6 L9.8 50 Z',

  /* 右の縁が少し欠けている */
  'M3.2 4.0 L50 5.0 L96.8 3.6 L97.2 24 L93.4 29 L97.0 34 L96.2 96.4 L50 95.2 L4.4 96.8 L3.6 50 Z' +
    'M10.2 11.0 L50 12.4 L89.4 10.6 L90.8 50 L89.0 89.6 L50 87.8 L11.4 90.2 L12.6 50 Z',

  /* 上の内側が彫り込まれて、帯が細くなっている */
  'M4.8 3.6 L50 4.8 L95.2 3.2 L96.8 50 L95.0 95.0 L50 96.8 L4.2 95.4 L3.4 50 Z' +
    'M10.6 12.8 L34 10.2 L40 13.8 L50 10.0 L89.8 11.4 L88.4 50 L90.6 89.0 L50 91.0 L12.0 88.8 L10.8 50 Z',
] as const;

/** 印ごとの枠。同じ枠が隣り合わないように散らしてある */
const FRAME_OF: Record<SealMark, 0 | 1 | 2> = {
  mangan: 0,
  shiki: 1,
  mitsu: 2,
  ichi: 1,
  go: 2,
  juu: 0,
  sanjuu: 2,
  gojuu: 0,
  hyaku: 1,
  torii: 1,
  dou: 2,
};

/* ── 1文字ぶんの字。100×100 に彫る ── */

const ICHI = <Rect x={22} y={44} width={56} height={12} />;

/*
 * 五。2画目は中の横棒を**突き抜けて**下の棒まで届く。
 * 途中で止めると互になる（実際そう見えたので直した）
 */
const GO = (
  <>
    <Rect x={28} y={22} width={44} height={9} />
    <Polygon points="37.6,29.9 46.4,32.1 37.4,69.1 28.6,66.9" />
    <Rect x={33} y={46} width={40} height={9} />
    <Rect x={64} y={55} width={9} height={13} />
    <Rect x={22} y={68} width={56} height={9.5} />
  </>
);

const JUU = (
  <>
    <Rect x={22} y={45} width={56} height={10} />
    <Rect x={45} y={22} width={10} height={56} />
  </>
);

/** 三。真ん中がいちばん短い */
const SAN = (
  <>
    <Rect x={24} y={28} width={52} height={9} />
    <Rect x={30} y={45.5} width={40} height={9} />
    <Rect x={21} y={63} width={58} height={9} />
  </>
);

/** 百。一 のあと 白。左上の払いは 日 の角に食い込ませる */
const HYAKU = (
  <>
    <Rect x={24} y={20} width={52} height={8.5} />
    <Polygon points="33.8,26.7 40.2,31.4 32.2,42.4 25.8,37.7" />
    <Rect x={33} y={36} width={36} height={7.5} />
    <Rect x={33} y={71.5} width={36} height={7.5} />
    <Rect x={33} y={36} width={7.5} height={43} />
    <Rect x={61.5} y={36} width={7.5} height={43} />
    <Rect x={33} y={53.7} width={36} height={7.5} />
  </>
);

/**
 * 2文字を横に並べる。縦に積むと1文字に見える（三十が丰になった）。
 * 縦横を別倍率にするのは角印の組み方で、2文字は細長く彫る
 */
const pair = (left: React.ReactNode, right: React.ReactNode) => (
  <>
    <G transform="translate(9,7) scale(0.46,0.86)">{left}</G>
    <G transform="translate(45,7) scale(0.46,0.86)">{right}</G>
  </>
);

/* ── 紋 ── */

/** 満願 = 12ヶ月の環が閉じた形。月参りカードの12個の丸と同じ数 */
const MANGAN = (
  <>
    {Array.from({ length: 12 }, (_, i) => {
      const a = -Math.PI / 2 + (i * Math.PI) / 6;
      return <Circle key={i} cx={50 + 25.5 * Math.cos(a)} cy={50 + 25.5 * Math.sin(a)} r={6.6} />;
    })}
  </>
);

/** 四季 = 四弁（木瓜紋の組み方）。4つの円の重なりで1つの花になる */
const SHIKI = (
  <>
    <Circle cx={50} cy={32.5} r={19} />
    <Circle cx={50} cy={67.5} r={19} />
    <Circle cx={32.5} cy={50} r={19} />
    <Circle cx={67.5} cy={50} r={19} />
  </>
);

/** 三社 = 三つ巴。神社の太鼓と瓦にある紋そのもの */
const MITSU = (
  <>
    {Array.from({ length: 3 }, (_, k) => {
      const R = 34;
      const half = R / 2;
      const at = (t: number) => [50 + R * Math.cos(t), 50 - R * Math.sin(t)] as const;
      const t0 = Math.PI / 2 + (k * 2 * Math.PI) / 3;
      const [ax, ay] = at(t0);
      const [bx, by] = at(t0 + (2 * Math.PI) / 3);
      return (
        <Path
          key={k}
          d={
            `M${ax} ${ay} A${R} ${R} 0 0 0 ${bx} ${by} ` +
            `A${half} ${half} 0 0 1 50 50 A${half} ${half} 0 0 1 ${ax} ${ay} Z`
          }
        />
      );
    })}
  </>
);

/* ── 寺社の印（Issue #293）。図形は docs/design/mockups/2026-09-spot-sheet-hero-v2.html の TORII・DOU ── */

/** 鳥居。反った笠木・島木・額束・貫と、少し開いた2本の柱 */
const TORII = (
  <>
    <Path d="M17 22 Q50 30 83 22 L81.5 30 Q50 36.5 18.5 30 Z" />
    <Rect x={23} y={33} width={54} height={5} />
    <Rect x={46.5} y={38} width={7} height={11} />
    <Rect x={20} y={48} width={60} height={6.5} />
    <Polygon points="32,38 39,38 37,82 29,82" />
    <Polygon points="61,38 68,38 71,82 63,82" />
  </>
);

/** お堂。宝珠・反った屋根・3本の柱と台 */
const DOU = (
  <>
    <Circle cx={50} cy={20.5} r={4.2} />
    <Rect x={48.6} y={23.5} width={2.8} height={4.5} />
    <Path d="M47.5 27.5 L52.5 27.5 Q60 42 84 45.5 L82.5 51 Q50 56 17.5 51 L16 45.5 Q40 42 47.5 27.5 Z" />
    <Rect x={24} y={57} width={52} height={5} />
    <Rect x={27} y={57} width={6} height={21} />
    <Rect x={47} y={57} width={6} height={21} />
    <Rect x={67} y={57} width={6} height={21} />
    <Rect x={20} y={78} width={60} height={6} />
  </>
);

const MARKS: Record<SealMark, React.ReactNode> = {
  ichi: ICHI,
  go: GO,
  juu: JUU,
  sanjuu: pair(SAN, JUU),
  gojuu: pair(GO, JUU),
  hyaku: HYAKU,
  mangan: MANGAN,
  shiki: SHIKI,
  mitsu: MITSU,
  torii: TORII,
  dou: DOU,
};

interface Props {
  mark: SealMark;
  /** 押されているか。まだなら同じ絵を薄く出す（鍵で塞がない） */
  earned: boolean;
  size: number;
  /** 御朱印の上に押されたときだけ、下の墨が少し透ける */
  opacity?: number;
}

export function Seal({ mark, earned, size, opacity }: Props) {
  const color = earned ? colors.seal : colors.sealEmpty;

  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" opacity={opacity}>
      <Path testID="seal-frame" d={SEAL_FRAMES[FRAME_OF[mark]]} fillRule="evenodd" fill={color} />
      <G testID="seal-mark" fill={color}>
        {MARKS[mark]}
      </G>
    </Svg>
  );
}

interface GlyphProps {
  mark: SealMark;
  fill: string;
  opacity?: number;
  /** 右下へのずらし（100 × 100 の単位）。空押しの陰と光に使う */
  offset?: number;
}

/**
 * 枠と図形だけ。`viewBox="0 0 100 100"` の `Svg` の中に置いて、重ねて使う
 * （地図のシートの帯の空押し・朱。Issue #293）。渡されていない props は付けない
 */
export function SealGlyph({ mark, fill, opacity, offset }: GlyphProps) {
  return (
    <G
      fill={fill}
      {...(opacity !== undefined ? { opacity } : {})}
      {...(offset !== undefined ? { x: offset, y: offset } : {})}
    >
      <Path d={SEAL_FRAMES[FRAME_OF[mark]]} fillRule="evenodd" />
      {MARKS[mark]}
    </G>
  );
}

/** テスト用。印の種類がぜんぶ図形を持っていることを確かめる */
export const SEAL_MARKS = Object.keys(MARKS) as SealMark[];
