import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { CLUSTER_REDRAW_MS, ClusterMarker } from '../ClusterMarker';
import type { SpotCluster } from '@utils/spotClustering';

function makeCluster(count: number): SpotCluster {
  return { id: 'cluster-a-0', clusterId: 33, latitude: 38.27, longitude: 140.87, count };
}

describe('ClusterMarker', () => {
  it('AC-40: 初期は tracksViewChanges=false、count 変化で true → CLUSTER_REDRAW_MS 後に false', () => {
    jest.useFakeTimers();
    const { getByTestId, rerender } = render(
      <ClusterMarker cluster={makeCluster(10)} onPress={jest.fn()} />
    );
    const marker = () => getByTestId('cluster-marker-cluster-a-0');

    expect(marker().props.tracksViewChanges).toBe(false);

    rerender(<ClusterMarker cluster={makeCluster(12)} onPress={jest.fn()} />);
    expect(marker().props.tracksViewChanges).toBe(true);
    expect(getByTestId('cluster-bubble-count').props.children).toBe('12');

    act(() => {
      jest.advanceTimersByTime(CLUSTER_REDRAW_MS + 10);
    });
    expect(marker().props.tracksViewChanges).toBe(false);
    jest.useRealTimers();
  });

  it('AC-40: count 不変の再レンダーでは tracksViewChanges が false のまま', () => {
    const { getByTestId, rerender } = render(
      <ClusterMarker cluster={makeCluster(10)} onPress={jest.fn()} />
    );

    rerender(<ClusterMarker cluster={makeCluster(10)} onPress={jest.fn()} />);

    expect(getByTestId('cluster-marker-cluster-a-0').props.tracksViewChanges).toBe(false);
  });

  it('AC-41: CLUSTER_REDRAW_MS が 350ms である', () => {
    expect(CLUSTER_REDRAW_MS).toBe(350);
  });

  it('タップで onPress にクラスタが渡る', () => {
    const onPress = jest.fn();
    const cluster = makeCluster(5);
    const { getByTestId } = render(<ClusterMarker cluster={cluster} onPress={onPress} />);

    fireEvent.press(getByTestId('cluster-marker-cluster-a-0'));

    expect(onPress).toHaveBeenCalledWith(cluster);
  });
});
