import { render } from '@testing-library/react-native';
import { Text } from 'react-native';
import { Circle, G, Path, Polygon, Rect, Svg, Text as SvgText } from 'react-native-svg';

import { SEAL_FRAMES, SEAL_MARKS, Seal, SealGlyph, type SealMark } from '@components/common/Seal';
import { colors } from '@theme/colors';

/*
 * react-native-svg は fill を ARGB の数値に正規化する（'#C2342B' → 4290913323）。
 * 描画されている実体はこちらなので、期待値の方を同じ形に変換して比べる
 * （JapanMap.test.tsx と同じやり方）
 */
const asPayload = (hex: string) => 0xff000000 + parseInt(hex.slice(1), 16);
const fillOf = (el: { props: { fill?: { payload: number } } }) => el.props.fill?.payload;

const setup = (mark: SealMark, earned = true) =>
  render(<Seal mark={mark} earned={earned} size={58} />);

describe('Seal', () => {
  it('印の種類は11（寺社の鳥居・お堂を含む。Issue #293）', () => {
    expect(SEAL_MARKS).toHaveLength(11);
    expect(SEAL_MARKS).toEqual(expect.arrayContaining(['torii', 'dou']));
  });

  /*
   * 空の印が混ざっていると、そのバッジだけ枠しか出ない。
   *
   * ⚠️ ここを `seal-mark` の children の truthy で見ていた時期があるが、
   * children は JSX の要素そのものなので、中身を空フラグメントに
   * 差し替えても truthy のまま通る＝**彫りが消えても緑になる**。
   * 実際に描かれた図形を数える
   */
  it.each(SEAL_MARKS)('%s は枠のほかに図形が彫られている', mark => {
    const { getByTestId, UNSAFE_queryAllByType } = setup(mark);

    expect(getByTestId('seal-frame').props.d).toBeTruthy();

    // Polygon は内部で Path として描かれる。枠の Path 1本を引く
    const drawn =
      UNSAFE_queryAllByType(Rect).length +
      UNSAFE_queryAllByType(Circle).length +
      UNSAFE_queryAllByType(Path).length -
      1;
    expect(drawn).toBeGreaterThan(0);
  });

  /*
   * 枠は「外周」と「内周」の2つの輪でできていて、evenodd で塗って初めて
   * 帯になる。片方でも欠けると、中の抜けない塗りつぶしの四角になって
   * 字が見えなくなる。react-native-svg は evenodd を 0 に正規化する
   */
  it.each(SEAL_MARKS)('%s の枠は、2つの輪を evenodd で抜いた帯', mark => {
    const frame = setup(mark).getByTestId('seal-frame');

    expect(frame.props.fillRule).toBe(0);
    expect((frame.props.d as string).match(/M/g)).toHaveLength(2);
  });

  it('押された印は朱、まだのものは薄い灰', () => {
    expect(fillOf(setup('mangan', true).getByTestId('seal-mark'))).toBe(asPayload(colors.seal));
    expect(fillOf(setup('mangan', false).getByTestId('seal-mark'))).toBe(
      asPayload(colors.sealEmpty)
    );
  });

  it('枠も字と同じ色で押される', () => {
    const { getByTestId } = setup('juu', false);
    expect(fillOf(getByTestId('seal-frame'))).toBe(asPayload(colors.sealEmpty));
  });

  /*
   * この変更の肝。字は矩形と円で彫ってあるので、印はフォントを一切使わない。
   * Text が1つでも入ると、iOS と Android で顔が変わる元に戻る
   */
  it.each(SEAL_MARKS)('%s は文字を1つも描かない', mark => {
    const { UNSAFE_queryAllByType } = setup(mark);

    expect(UNSAFE_queryAllByType(Text)).toHaveLength(0);
    expect(UNSAFE_queryAllByType(SvgText)).toHaveLength(0);
  });

  // 2文字の印だけ、横に並べるための G が余分に2つ要る
  it.each(['sanjuu', 'gojuu'] as const)('%s は2文字を横に並べている', mark => {
    const { UNSAFE_queryAllByType } = setup(mark);
    const placed = UNSAFE_queryAllByType(G).filter(g => typeof g.props.transform === 'string');

    expect(placed).toHaveLength(2);
    expect(placed.map(g => g.props.transform)).toEqual([
      'translate(9,7) scale(0.46,0.86)',
      'translate(45,7) scale(0.46,0.86)',
    ]);
  });

  /*
   * 9個ぜんぶ同じ枠だと、手彫りではなく機械で作った顔になる。
   * 3種類を散らしていることを、枠の d が3通りあることで見る
   */
  it('枠は3種類を使い分けている', () => {
    const shapes = new Set(
      SEAL_MARKS.map(mark => setup(mark).getByTestId('seal-frame').props.d as string)
    );
    expect(shapes.size).toBe(3);
  });

  /*
   * 同じ枠が隣り合うと、3種類ある意味が薄れる。
   * どの枠を使うかは Seal 側が持っているので、ここで固定する
   */
  it('印ごとの枠の割り当てが決まっている', () => {
    const frameOf = (mark: SealMark) => setup(mark).getByTestId('seal-frame').props.d as string;
    const groups = new Map<string, SealMark[]>();
    for (const mark of SEAL_MARKS) {
      const d = frameOf(mark);
      groups.set(d, [...(groups.get(d) ?? []), mark]);
    }

    expect([...groups.values()].map(g => g.sort()).sort()).toEqual(
      [
        ['gojuu', 'juu', 'mangan'],
        ['dou', 'go', 'mitsu', 'sanjuu'],
        ['hyaku', 'ichi', 'shiki', 'torii'],
      ]
        .map(g => g.sort())
        .sort()
    );
  });

  it('御朱印の上に押すときだけ、下の墨が透ける', () => {
    expect(setup('mangan').UNSAFE_getByType(Svg).props.opacity).toBeUndefined();

    const stamped = render(<Seal mark="mangan" earned size={120} opacity={0.9} />);
    expect(stamped.UNSAFE_getByType(Svg).props.opacity).toBe(0.9);
  });
});

/* Issue #293: 地図のシートの帯に押す、寺社の印（鳥居・お堂）。図形は試作 2026-09-spot-sheet-hero-v2 の TORII・DOU */
const TORII_ROOF = 'M17 22 Q50 30 83 22 L81.5 30 Q50 36.5 18.5 30 Z';
const DOU_ROOF =
  'M47.5 27.5 L52.5 27.5 Q60 42 84 45.5 L82.5 51 Q50 56 17.5 51 L16 45.5 Q40 42 47.5 27.5 Z';
type Shape = { props: Record<string, unknown> };
const rectsOf = (nodes: Shape[]) =>
  nodes.map(r => [r.props.x, r.props.y, r.props.width, r.props.height]);

describe('寺社の印（Issue #293）', () => {
  it('鳥居は枠1、お堂は枠2（AC-4）', () => {
    expect(setup('torii').getByTestId('seal-frame').props.d).toBe(SEAL_FRAMES[1]);
    expect(setup('dou').getByTestId('seal-frame').props.d).toBe(SEAL_FRAMES[2]);
  });

  it('鳥居の図形: 笠木・島木・額束・貫・2本の柱（AC-5）', () => {
    const { UNSAFE_queryAllByType } = setup('torii');
    expect(UNSAFE_queryAllByType(Path).filter(p => p.props.d === TORII_ROOF)).toHaveLength(1);
    expect(rectsOf(UNSAFE_queryAllByType(Rect))).toEqual([
      [23, 33, 54, 5],
      [46.5, 38, 7, 11],
      [20, 48, 60, 6.5],
    ]);
    expect(UNSAFE_queryAllByType(Polygon).map(p => p.props.points)).toEqual([
      '32,38 39,38 37,82 29,82',
      '61,38 68,38 71,82 63,82',
    ]);
  });

  it('お堂の図形: 宝珠・屋根・3本の柱と台（AC-5）', () => {
    const { UNSAFE_queryAllByType } = setup('dou');
    const circles = UNSAFE_queryAllByType(Circle);
    expect(circles).toHaveLength(1);
    expect([circles[0].props.cx, circles[0].props.cy, circles[0].props.r]).toEqual([50, 20.5, 4.2]);
    expect(rectsOf(UNSAFE_queryAllByType(Rect))).toEqual([
      [48.6, 23.5, 2.8, 4.5],
      [24, 57, 52, 5],
      [27, 57, 6, 21],
      [47, 57, 6, 21],
      [67, 57, 6, 21],
      [20, 78, 60, 6],
    ]);
    expect(UNSAFE_queryAllByType(Path).filter(p => p.props.d === DOU_ROOF)).toHaveLength(1);
  });
});

describe('SealGlyph（Issue #293）', () => {
  it('外の G に色・不透明度・ずらしを付け、中に枠と図形を描く（AC-6）', () => {
    const { UNSAFE_getByType, UNSAFE_queryAllByType } = render(
      <Svg viewBox="0 0 100 100">
        <SealGlyph mark="dou" fill={colors.seal} opacity={0.9} offset={-1} />
      </Svg>
    );
    const glyph = UNSAFE_getByType(SealGlyph);
    const outer = glyph.findAllByType(G)[0];
    expect(outer.props).toEqual(
      expect.objectContaining({ fill: colors.seal, opacity: 0.9, x: -1, y: -1 })
    );

    const frame = outer.findAllByType(Path).filter((p: Shape) => p.props.d === SEAL_FRAMES[2]);
    expect(frame).toHaveLength(1);
    expect(frame[0].props.fillRule).toBe('evenodd');
    expect(outer.findAllByType(Path).filter((p: Shape) => p.props.d === DOU_ROOF)).toHaveLength(1);
    expect(outer.findAllByType(Circle)).toHaveLength(1);
    expect(rectsOf(outer.findAllByType(Rect))).toHaveLength(6);

    expect(UNSAFE_queryAllByType(Text)).toHaveLength(0);
    expect(UNSAFE_queryAllByType(SvgText)).toHaveLength(0);
  });

  it('渡されていない不透明度とずらしは付けない（AC-6）', () => {
    const { UNSAFE_getByType, UNSAFE_queryAllByType } = render(
      <Svg viewBox="0 0 100 100">
        <SealGlyph mark="torii" fill={colors.washiShade} />
      </Svg>
    );
    const outer = UNSAFE_getByType(SealGlyph).findAllByType(G)[0];
    expect(outer.props.fill).toBe(colors.washiShade);
    expect(outer.props.x).toBeUndefined();
    expect(outer.props.y).toBeUndefined();
    expect(outer.props.opacity).toBeUndefined();
    expect(
      outer.findAllByType(Path).filter((p: Shape) => p.props.d === SEAL_FRAMES[1])
    ).toHaveLength(1);

    expect(UNSAFE_queryAllByType(Text)).toHaveLength(0);
    expect(UNSAFE_queryAllByType(SvgText)).toHaveLength(0);
  });
});
