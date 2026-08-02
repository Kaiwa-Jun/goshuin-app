import React, { useEffect, useRef, useState } from 'react';
import { Marker } from 'react-native-maps';

import { ClusterBubble } from './ClusterBubble';
import type { SpotCluster } from '@utils/spotClustering';

/** count 変化時に再スナップショットを許可する時間(ms) */
export const CLUSTER_REDRAW_MS = 350;

interface ClusterMarkerProps {
  cluster: SpotCluster;
  onPress: (cluster: SpotCluster) => void;
}

/**
 * クラスタバブルの Marker。key（cluster.id）が leaf 由来で安定しているため、
 * count が変わっても remount されない。ただし tracksViewChanges=false のままだと
 * iOS でバブルの数字が更新されないので、count 変化時だけ一時的に true にする
 */
export const ClusterMarker = React.memo(function ClusterMarker({
  cluster,
  onPress,
}: ClusterMarkerProps) {
  const [tracksViewChanges, setTracksViewChanges] = useState(false);
  const prevCountRef = useRef(cluster.count);

  useEffect(() => {
    if (prevCountRef.current === cluster.count) return;
    prevCountRef.current = cluster.count;
    setTracksViewChanges(true);
    const timer = setTimeout(() => setTracksViewChanges(false), CLUSTER_REDRAW_MS);
    return () => clearTimeout(timer);
  }, [cluster.count]);

  return (
    <Marker
      coordinate={{ latitude: cluster.latitude, longitude: cluster.longitude }}
      testID={`cluster-marker-${cluster.id}`}
      onPress={() => onPress(cluster)}
      anchor={{ x: 0.5, y: 0.5 }}
      tracksViewChanges={tracksViewChanges}
    >
      <ClusterBubble count={cluster.count} />
    </Marker>
  );
});
