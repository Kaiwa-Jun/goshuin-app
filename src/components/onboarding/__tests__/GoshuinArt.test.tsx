import { render } from '@testing-library/react-native';
import { Text } from 'react-native';
import { Path, Text as SvgText } from 'react-native-svg';

import { GoshuinArt, SUMI_STROKE_COUNT } from '@components/onboarding/GoshuinArt';
import { colors } from '@theme/colors';

const asPayload = (hex: string) => 0xff000000 + parseInt(hex.slice(1), 16);
const setup = () => render(<GoshuinArt width={168} />);

describe('GoshuinArt', () => {
  it('墨は16画。紙・墨の色はテーマから取る', () => {
    const { getByTestId } = setup();

    expect(SUMI_STROKE_COUNT).toBe(16);
    expect(getByTestId('goshuin-sumi').props.fill?.payload).toBe(asPayload(colors.sumi));
    expect(getByTestId('goshuin-paper').props.fill?.payload).toBe(asPayload(colors.washi));
  });

  /*
   * nib() はベジェを刻んで法線方向に太さを振った**閉じた形**を返す。
   * 直線の台形（4点）だと筆に見えず、最初それで十字架になった。
   * 刻みが効いていることを、点の数と閉じていることで見る
   */
  it('墨の画は、刻まれた閉じた形になっている', () => {
    const { getByTestId } = setup();
    const strokes = getByTestId('goshuin-sumi').props.children;

    expect(strokes).toHaveLength(SUMI_STROKE_COUNT);
    for (const stroke of strokes) {
      const d = stroke.props.d as string;
      expect(d.endsWith('Z')).toBe(true);
      // 26刻み×左右 + 始点。台形なら4点しかない
      expect((d.match(/L/g) ?? []).length).toBeGreaterThan(20);
    }
  });

  // 御朱印も印と同じで、フォントには頼らない
  it('文字を1つも描かない', () => {
    const { UNSAFE_queryAllByType } = setup();

    expect(UNSAFE_queryAllByType(Text)).toHaveLength(0);
    expect(UNSAFE_queryAllByType(SvgText)).toHaveLength(0);
  });

  it('朱印が2つ押してある（大きいのと、右上の小さいの）', () => {
    const { UNSAFE_getAllByType } = setup();
    // 墨16本 + 朱印の枠2本
    expect(UNSAFE_getAllByType(Path)).toHaveLength(SUMI_STROKE_COUNT + 2);
  });

  it('縦横の比は 240:320。渡した幅に合わせる', () => {
    const { getByTestId } = setup();
    expect(getByTestId('goshuin-art').props.width).toBe(168);
    expect(getByTestId('goshuin-art').props.height).toBe(224);
  });
});
