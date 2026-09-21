import { render } from '@testing-library/react-native';
import { Circle } from 'react-native-svg';

import { NearbyArt } from '@components/onboarding/NearbyArt';
import { colors } from '@theme/colors';

describe('NearbyArt', () => {
  // 地図で出会う2色を、先に見せておく
  it('近くのピンは3つで、1つだけ寺の紫', () => {
    const { getAllByTestId, UNSAFE_getAllByType } = render(<NearbyArt width={300} active />);

    expect(getAllByTestId('onboarding-near-pin')).toHaveLength(3);

    // ピンは白フチと本体の2枚重ね。本体の丸の色だけ数える
    const fills = UNSAFE_getAllByType(Circle)
      .map(c => c.props.fill)
      .filter((f): f is string => typeof f === 'string' && f !== '#fff');
    expect(fills.filter(f => f === colors.pin.templeVisited)).toHaveLength(1);
    expect(fills.filter(f => f === colors.pin.unvisited)).toHaveLength(2);
  });

  it('波紋は3つ', () => {
    const { getAllByTestId } = render(<NearbyArt width={300} active />);
    expect(getAllByTestId('onboarding-wave')).toHaveLength(3);
  });
});
