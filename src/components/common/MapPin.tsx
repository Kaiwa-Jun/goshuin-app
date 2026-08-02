import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colors } from '@theme/colors';
import { shadows } from '@theme/shadows';

interface MapPinProps {
  type: 'current-location';
}

const PIN_CONFIG = { color: colors.pin.currentLocation, size: 20 };

/**
 * 現在地ピン。地図マーカー内での無限アニメーションは、tracksViewChanges と
 * 組み合わさると毎フレームの再スナップショットでネイティブメモリを消費し
 * 続け、実機クラッシュ(Jetsam)の原因になるため置かない(#99 追補3)。
 * 静的なハロー + ドットで表現する
 */
export function MapPin({ type }: MapPinProps) {
  const config = PIN_CONFIG;

  return (
    <View style={styles.wrapper} testID={`map-pin-${type}`}>
      <View
        testID="map-pin-halo"
        style={[
          styles.halo,
          {
            width: config.size * 2,
            height: config.size * 2,
            borderRadius: config.size,
            backgroundColor: config.color,
          },
        ]}
      />
      <View
        style={[
          styles.pin,
          {
            width: config.size,
            height: config.size,
            borderRadius: config.size / 2,
            backgroundColor: config.color,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  halo: {
    position: 'absolute',
    opacity: 0.2,
  },
  pin: {
    borderWidth: 3,
    borderColor: colors.white,
    ...shadows.sm,
  },
});
