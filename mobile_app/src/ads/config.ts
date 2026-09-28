import { Platform } from 'react-native';
import { TestIds } from 'react-native-google-mobile-ads';

// Real ad units only in builds made with EXPO_PUBLIC_REAL_ADS=1 (store releases). Every other build, including
// local release APKs, uses Google's test units: real ads on your own devices count as invalid traffic.
const REAL_ADS = process.env.EXPO_PUBLIC_REAL_ADS === '1';

const ANDROID_UNITS = {
  banner: 'ca-app-pub-4201476043998878/3300791574',
  interstitial: 'ca-app-pub-4201476043998878/2381183882',
};

// iOS stays on test units until the iOS AdMob app exists.
export const adUnits =
  REAL_ADS && Platform.OS === 'android'
    ? ANDROID_UNITS
    : { banner: TestIds.ADAPTIVE_BANNER, interstitial: TestIds.INTERSTITIAL };

export const usingTestAds = adUnits.banner === TestIds.ADAPTIVE_BANNER;
