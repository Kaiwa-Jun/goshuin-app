import { render } from '@testing-library/react-native';
import { Text } from 'react-native';
import { Circle, G, Path, Rect, Svg, Text as SvgText } from 'react-native-svg';

import { SEAL_MARKS, Seal, type SealMark } from '@components/common/Seal';
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
  it('印の種類は9つ', () => {
    expect(SEAL_MARKS).toHaveLength(9);
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
        ['go', 'mitsu', 'sanjuu'],
        ['hyaku', 'ichi', 'shiki'],
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
