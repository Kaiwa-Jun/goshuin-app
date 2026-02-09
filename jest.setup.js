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

// [REVERT-TO-NATIVE] ネイティブ版に戻す際に @react-native-google-signin/google-signin モックを復活
// expo-auth-session mock
jest.mock('expo-auth-session', () => ({
  makeRedirectUri: jest.fn(() => 'com.goshuin.app://auth/callback'),
}));

// expo-web-browser mock
jest.mock('expo-web-browser', () => ({
  openAuthSessionAsync: jest.fn(() =>
    Promise.resolve({
      type: 'success',
      url: 'com.goshuin.app://auth/callback#access_token=mock-access&refresh_token=mock-refresh',
    })
  ),
  maybeCompleteAuthSession: jest.fn(),
}));

// expo-crypto mock
jest.mock('expo-crypto', () => ({}));

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

// react-native-maps mock
jest.mock('react-native-maps', () => {
  const React = require('react');
  const { View } = require('react-native');
  const MockMapView = React.forwardRef((props, ref) =>
    React.createElement(View, { ...props, testID: props.testID || 'map-view', ref }, props.children)
  );
  MockMapView.displayName = 'MapView';
  const MockMarker = props =>
    React.createElement(View, { ...props, testID: props.testID || 'marker' }, props.children);
  MockMarker.displayName = 'Marker';
  return { __esModule: true, default: MockMapView, Marker: MockMarker, PROVIDER_GOOGLE: 'google' };
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
