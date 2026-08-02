import React from 'react';
import { existsSync } from 'fs';
import { join } from 'path';
import { fireEvent, render } from '@testing-library/react-native';
import { CLUSTER_BUBBLE_IMAGES, ClusterMarker } from '../ClusterMarker';
import { getClusterBucket, type SpotCluster } from '@utils/spotClustering';

function makeCluster(count: number): SpotCluster {
  return { id: 'cluster-a-0', clusterId: 33, latitude: 38.27, longitude: 140.87, count };
}

describe('ClusterMarker', () => {
  it('AC-44: バケット対応の image prop を持ち、子要素を持たない', () => {
    for (const count of [12, 48, 52, 200]) {
      const { getByTestId, unmount } = render(
        <ClusterMarker cluster={makeCluster(count)} onPress={jest.fn()} />
      );
      const marker = getByTestId('cluster-marker-cluster-a-0');

      expect(marker.props.image).toBe(CLUSTER_BUBBLE_IMAGES[getClusterBucket(count).key]);
      expect(marker.props.children).toBeFalsy();
      unmount();
    }
  });

  it('AC-44: count 12 と 48 は同一バケット、48 と 52 は異なるバケットの画像になる', () => {
    expect(getClusterBucket(12).key).toBe(getClusterBucket(48).key);
    expect(getClusterBucket(48).key).not.toBe(getClusterBucket(52).key);
    // 全バケットキーに対応する画像が require 済みである
    for (const count of [2, 9, 10, 50, 100, 500, 1000]) {
      expect(CLUSTER_BUBBLE_IMAGES[getClusterBucket(count).key]).toBeDefined();
    }
  });

  it('AC-45: 13 バケット × @1x/@2x/@3x = 39 のアセットファイルが存在する', () => {
    const dir = join(__dirname, '../../../../assets/cluster-bubbles');
    const keys = ['2', '3', '4', '5', '6', '7', '8', '9', '10p', '50p', '100p', '500p', '1000p'];
    for (const key of keys) {
      for (const suffix of ['', '@2x', '@3x']) {
        expect(existsSync(join(dir, `bubble_${key}${suffix}.png`))).toBe(true);
      }
    }
  });

  it('タップで onPress にクラスタが渡る', () => {
    const onPress = jest.fn();
    const cluster = makeCluster(5);
    const { getByTestId } = render(<ClusterMarker cluster={cluster} onPress={onPress} />);

    fireEvent.press(getByTestId('cluster-marker-cluster-a-0'));

    expect(onPress).toHaveBeenCalledWith(cluster);
  });
});
