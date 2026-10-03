const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Provide web stubs for native-only modules
const WEB_STUBS = {
  '@maplibre/maplibre-react-native': 'src/utils/maplibre.web.ts',
  // Web は RevenueCat の iOS のキーでは動かない（Issue #270）
  'react-native-purchases': 'src/utils/purchases.web.ts',
};

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && WEB_STUBS[moduleName]) {
    return {
      filePath: path.resolve(__dirname, WEB_STUBS[moduleName]),
      type: 'sourceFile',
    };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
