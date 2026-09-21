import { render } from '@testing-library/react-native';
import { Svg } from 'react-native-svg';

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

  // 空の印が混ざっていると、そのバッジだけ枠しか出ない
  it.each(SEAL_MARKS)('%s は枠と図形の両方を持つ', mark => {
    const { getByTestId } = setup(mark);

    expect(getByTestId('seal-frame').props.d).toBeTruthy();
    expect(getByTestId('seal-mark').props.children).toBeTruthy();
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
   * 9個ぜんぶ同じ枠だと、手彫りではなく機械で作った顔になる。
   * 3種類を散らしていることを、枠の d が3通りあることで見る
   */
  it('枠は3種類を使い分けている', () => {
    const shapes = new Set(
      SEAL_MARKS.map(mark => setup(mark).getByTestId('seal-frame').props.d as string)
    );
    expect(shapes.size).toBe(3);
  });

  it('御朱印の上に押すときだけ、下の墨が透ける', () => {
    expect(setup('mangan').UNSAFE_getByType(Svg).props.opacity).toBeUndefined();

    const stamped = render(<Seal mark="mangan" earned size={120} opacity={0.9} />);
    expect(stamped.UNSAFE_getByType(Svg).props.opacity).toBe(0.9);
  });
});
