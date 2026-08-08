// Web stub for react-native-maps (native-only module)
// This file is resolved by Metro when platform=web to avoid build errors.

import React from 'react';
import { View } from 'react-native';

// 命令的 API は web では何もしない。呼び出し側（MapScreen）が
// mapRef.current.animateToRegion(...) を呼ぶため、生やしておかないと
// TypeError でスポット選択の処理が途中で止まる。
const MapView = React.forwardRef((props: any, ref: any) => {
  React.useImperativeHandle(ref, () => ({
    animateToRegion: () => {},
    animateCamera: () => {},
    fitToCoordinates: () => {},
  }));
  return React.createElement(View, props);
});
MapView.displayName = 'MapView';

const Marker = (props: any) => React.createElement(View, props);

export { Marker };
export default MapView;
export type Region = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};
