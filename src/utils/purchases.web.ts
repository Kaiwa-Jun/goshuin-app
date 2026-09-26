// Web 用の react-native-purchases のスタブ（Issue #270 D-21）。Web は iOS のキーでは動かないので、
// metro.config.js で差し替える。resolveRevenueCatKey が Web を弾くので、実際には呼ばれない
const unavailable = () =>
  Promise.reject(new Error('react-native-purchases is not available on web'));

const Purchases = {
  configure: () => {},
  logIn: unavailable,
  logOut: unavailable,
  getCustomerInfo: unavailable,
  getOfferings: unavailable,
  purchasePackage: unavailable,
  restorePurchases: unavailable,
  addCustomerInfoUpdateListener: () => {},
  removeCustomerInfoUpdateListener: () => true,
};

export default Purchases;
