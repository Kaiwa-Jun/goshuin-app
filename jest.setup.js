// Jest setup file
// Add any global test setup here

// react-native-screens mock
jest.mock('react-native-screens', () => {
  const actual = jest.requireActual('react-native-screens');
  return {
    ...actual,
    enableScreens: jest.fn(),
  };
});

// @react-native-async-storage/async-storage mock
jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(() => Promise.resolve()),
  getItem: jest.fn(() => Promise.resolve(null)),
  removeItem: jest.fn(() => Promise.resolve()),
  clear: jest.fn(() => Promise.resolve()),
  getAllKeys: jest.fn(() => Promise.resolve([])),
  multiGet: jest.fn(() => Promise.resolve([])),
  multiSet: jest.fn(() => Promise.resolve()),
  multiRemove: jest.fn(() => Promise.resolve()),
}));

// localStorage mock for Supabase session persistence
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: key => store[key] ?? null,
    setItem: (key, value) => {
      store[key] = String(value);
    },
    removeItem: key => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(global, 'localStorage', {
  value: localStorageMock,
});

// @react-native-google-signin/google-signin mock
jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    configure: jest.fn(),
    signIn: jest.fn(),
    signOut: jest.fn(),
    hasPlayServices: jest.fn(() => Promise.resolve(true)),
  },
  statusCodes: {
    SIGN_IN_CANCELLED: 'SIGN_IN_CANCELLED',
    IN_PROGRESS: 'IN_PROGRESS',
    PLAY_SERVICES_NOT_AVAILABLE: 'PLAY_SERVICES_NOT_AVAILABLE',
  },
}));

// @expo/vector-icons mock
jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const MockIcon = props => React.createElement('Text', props, props.name);
  return {
    MaterialIcons: MockIcon,
  };
});

// react-native-safe-area-context mock
jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  const { View } = require('react-native');
  const insets = { top: 47, bottom: 34, left: 0, right: 0 };
  const frame = { x: 0, y: 0, width: 390, height: 844 };
  return {
    SafeAreaView: React.forwardRef((props, ref) =>
      React.createElement(View, { ...props, ref }, props.children)
    ),
    SafeAreaProvider: ({ children }) => children,
    SafeAreaInsetsContext: React.createContext(insets),
    SafeAreaFrameContext: React.createContext(frame),
    useSafeAreaInsets: () => insets,
    useSafeAreaFrame: () => frame,
    initialWindowMetrics: { insets, frame },
  };
});

// @maplibre/maplibre-react-native mock
jest.mock('@maplibre/maplibre-react-native', () => {
  const React = require('react');
  const { View } = require('react-native');
  // imperative handle はモックファクトリスコープの安定オブジェクトにする。
  // 毎レンダー新しい jest.fn() を作るとテストから呼び出しを検証できない
  const cameraMocks = {
    setStop: jest.fn(),
    jumpTo: jest.fn(),
    easeTo: jest.fn(),
    flyTo: jest.fn(),
    fitBounds: jest.fn(),
    zoomTo: jest.fn(),
  };
  const sourceMocks = {
    getClusterExpansionZoom: jest.fn(async () => 12),
    getClusterLeaves: jest.fn(async () => ({ type: 'FeatureCollection', features: [] })),
    getClusterChildren: jest.fn(async () => ({ type: 'FeatureCollection', features: [] })),
  };
  const named = (displayName, testID, handle) => {
    const C = React.forwardRef((props, ref) => {
      React.useImperativeHandle(ref, () => handle || {});
      return React.createElement(
        View,
        // ソース/レイヤはスタイル上の id で引けるようにする。
        // テストは getByTestId('goshuin-spots').props.data で中身を見る
        { ...props, testID: props.testID || props.id || testID },
        props.children
      );
    });
    C.displayName = displayName;
    return C;
  };
  return {
    __esModule: true,
    Map: named('Map', 'map-view'),
    Camera: named('Camera', 'map-camera', cameraMocks),
    GeoJSONSource: named('GeoJSONSource', undefined, sourceMocks),
    Layer: named('Layer'),
    Images: named('Images'),
    Marker: named('Marker', 'marker'),
    UserLocation: named('UserLocation'),
    NativeUserLocation: named('NativeUserLocation'),
    __cameraMocks: cameraMocks,
    __sourceMocks: sourceMocks,
  };
});

// expo-linear-gradient mock
jest.mock('expo-linear-gradient', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    LinearGradient: React.forwardRef((props, ref) =>
      React.createElement(
        View,
        { ...props, testID: props.testID || 'linear-gradient', ref },
        props.children
      )
    ),
  };
});

// expo-apple-authentication mock
jest.mock('expo-apple-authentication', () => ({
  isAvailableAsync: jest.fn(() => Promise.resolve(true)),
  signInAsync: jest.fn(),
  AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 },
  AppleAuthenticationButtonType: { SIGN_IN: 0 },
  AppleAuthenticationButtonStyle: { BLACK: 0, WHITE: 1 },
  AppleAuthenticationButton: 'AppleAuthenticationButton',
}));

// expo-file-system mock（画像アップロードでファイルをバイト列として読む）
jest.mock('expo-file-system', () => {
  class File {
    constructor(...uris) {
      this.uri = uris.join('/');
    }

    async bytes() {
      return new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
    }
  }

  return { File };
});

// expo-location mock
jest.mock('expo-location', () => ({
  getForegroundPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
  getCurrentPositionAsync: jest.fn(() =>
    Promise.resolve({ coords: { latitude: 38.2682, longitude: 140.8694 } })
  ),
  requestForegroundPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
  PermissionStatus: {
    GRANTED: 'granted',
    DENIED: 'denied',
    UNDETERMINED: 'undetermined',
  },
  Accuracy: {
    Balanced: 3,
  },
}));
