// Web stub for react-native-maps (native-only module)
// This file is resolved by Metro when platform=web to avoid build errors.

import React from 'react';
import { View } from 'react-native';

const MapView = React.forwardRef((props: any, ref: any) => {
  return React.createElement(View, { ...props, ref });
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
