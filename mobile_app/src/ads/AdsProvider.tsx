import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';
import mobileAds, {
  AdsConsent,
  AdsConsentDebugGeography,
  AdsConsentPrivacyOptionsRequirementStatus,
} from 'react-native-google-mobile-ads';
import { requestTrackingPermissionsAsync } from 'expo-tracking-transparency';
import { startInterstitials } from './interstitial';

interface AdsContextValue {
  /** Consent allows ads and the SDK is initialized. */
  ready: boolean;
  /** The user is in a region where a "Privacy choices" entry point is required. */
  privacyOptionsRequired: boolean;
  showPrivacyOptions: () => void;
}

const AdsContext = createContext<AdsContextValue>({
  ready: false,
  privacyOptionsRequired: false,
  showPrivacyOptions: () => undefined,
});

// Set EXPO_PUBLIC_ADS_DEBUG_EEA=1 to see the EEA consent flow on an emulator or test device.
const DEBUG_EEA = process.env.EXPO_PUBLIC_ADS_DEBUG_EEA === '1';

export function AdsProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [privacyOptionsRequired, setPrivacyOptionsRequired] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const info = await AdsConsent.gatherConsent(DEBUG_EEA ? { debugGeography: AdsConsentDebugGeography.EEA } : {});
        if (cancelled) return;
        setPrivacyOptionsRequired(
          info.privacyOptionsRequirementStatus === AdsConsentPrivacyOptionsRequirementStatus.REQUIRED,
        );
        if (!info.canRequestAds) return;
        if (Platform.OS === 'ios') await requestTrackingPermissionsAsync();
        await mobileAds().initialize();
        if (cancelled) return;
        startInterstitials();
        setReady(true);
      } catch (error) {
        // Ads are optional: the app works the same without them.
        console.warn('Ads unavailable:', error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const showPrivacyOptions = useCallback(() => {
    AdsConsent.showPrivacyOptionsForm().catch((error: unknown) => console.warn('Privacy options failed:', error));
  }, []);

  const value = useMemo(
    () => ({ ready, privacyOptionsRequired, showPrivacyOptions }),
    [ready, privacyOptionsRequired, showPrivacyOptions],
  );
  return <AdsContext.Provider value={value}>{children}</AdsContext.Provider>;
}

export function useAds() {
  return useContext(AdsContext);
}
