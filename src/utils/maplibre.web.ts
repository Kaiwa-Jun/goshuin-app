// Web stub for @maplibre/maplibre-react-native (native-only module).
// platform=web のとき metro.config.js がここに解決する。
//
// Expo Web は UI 検証専用なので地図そのものは描かない。ただし MapScreen が
// cameraRef.current.flyTo(...) 等を呼ぶため、命令的 API は生やしておく
// （無いと TypeError でスポット選択の処理が途中で止まる）。

import React from 'react';
import { View } from 'react-native';

const passthrough = (displayName: string) => {
  const C = (props: Record<string, unknown>) =>
    React.createElement(View, props as never, props.children as never);
  C.displayName = displayName;
  return C;
};

const noop = () => {};

export const Map = React.forwardRef((props: Record<string, unknown>, ref: unknown) => {
  React.useImperativeHandle(ref as never, () => ({
    getCenter: async () => [0, 0],
    getZoom: async () => 0,
  }));
  return React.createElement(View, props as never, props.children as never);
});
Map.displayName = 'Map';

export const Camera = React.forwardRef((props: Record<string, unknown>, ref: unknown) => {
  React.useImperativeHandle(ref as never, () => ({
    setStop: noop,
    jumpTo: noop,
    easeTo: noop,
    flyTo: noop,
    fitBounds: noop,
    zoomTo: noop,
  }));
  return React.createElement(View, props as never);
});
Camera.displayName = 'Camera';

export const GeoJSONSource = React.forwardRef((props: Record<string, unknown>, ref: unknown) => {
  React.useImperativeHandle(ref as never, () => ({
    getClusterExpansionZoom: async () => 0,
    getClusterLeaves: async () => ({ type: 'FeatureCollection', features: [] }),
    getClusterChildren: async () => ({ type: 'FeatureCollection', features: [] }),
  }));
  return React.createElement(View, props as never, props.children as never);
});
GeoJSONSource.displayName = 'GeoJSONSource';

export const Layer = passthrough('Layer');
export const Images = passthrough('Images');
export const Marker = passthrough('Marker');
export const UserLocation = passthrough('UserLocation');
export const NativeUserLocation = passthrough('NativeUserLocation');

export type CameraRef = {
  jumpTo: () => void;
  easeTo: () => void;
  flyTo: () => void;
  fitBounds: () => void;
  zoomTo: () => void;
};
export type GeoJSONSourceRef = { getClusterExpansionZoom: (id: number) => Promise<number> };
export type FilterSpecification = unknown[];
