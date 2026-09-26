import React, { useMemo } from 'react';
import { GeoJSONSource, Layer } from '@maplibre/maplibre-react-native';

import { pointCollection } from '@utils/spotGeoJson';
import { colors } from '@theme/colors';

/** 現在地の点。ネイティブビューではなくレイヤなので再描画コストがない（地図タブと予定を組む画面） */
export function CurrentLocationLayer({
  coords,
}: {
  coords: { latitude: number; longitude: number } | null;
}) {
  const data = useMemo(() => pointCollection(coords), [coords]);
  return (
    <GeoJSONSource id="goshuin-current-location" data={data}>
      <Layer
        id="goshuin-current-location-halo"
        type="circle"
        paint={{
          'circle-radius': 20,
          'circle-color': colors.pin.currentLocation,
          'circle-opacity': 0.2,
        }}
      />
      <Layer
        id="goshuin-current-location-dot"
        type="circle"
        paint={{
          'circle-radius': 7,
          'circle-color': colors.pin.currentLocation,
          'circle-stroke-width': 3,
          'circle-stroke-color': colors.white,
        }}
      />
    </GeoJSONSource>
  );
}
