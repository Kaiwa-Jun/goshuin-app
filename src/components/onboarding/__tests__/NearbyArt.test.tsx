import { render } from '@testing-library/react-native';
import { Circle } from 'react-native-svg';

import { NearbyArt } from '@components/onboarding/NearbyArt';
import { colors } from '@theme/colors';

describe('NearbyArt', () => {
  /*
   * 未訪問は種別で分けない、という地図の決まりに揃える。
   * 一度1つを寺の紫にしたが、訪問済みの色なので戻した
   */
  it('近くのピンは3つとも、未訪問のブランド色', () => {
    const { getAllByTestId, UNSAFE_getAllByType } = render(<NearbyArt width={300} active />);

    expect(getAllByTestId('onboarding-near-pin')).toHaveLength(3);

    // ピンは白フチと本体の2枚重ね。本体の丸の色だけ数える
    const fills = UNSAFE_getAllByType(Circle)
      .map(c => c.props.fill)
      .filter((f): f is string => typeof f === 'string' && f !== '#fff');
    expect(fills).toHaveLength(3);
    expect(fills.every(f => f === colors.pin.unvisited)).toBe(true);
  });

  it('波紋は3つ', () => {
    const { getAllByTestId } = render(<NearbyArt width={300} active />);
    expect(getAllByTestId('onboarding-wave')).toHaveLength(3);
  });
});
