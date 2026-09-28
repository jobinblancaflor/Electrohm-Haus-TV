import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { BannerAd, BannerAdSize } from 'react-native-google-mobile-ads';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme';
import { useAds } from './AdsProvider';
import { adUnits } from './config';

/** Anchored adaptive banner for the bottom of Home and Browse. Never used on the player. */
export function Banner() {
  const { ready } = useAds();
  const insets = useSafeAreaInsets();
  const [failed, setFailed] = useState(false);

  if (!ready || failed) return null;

  return (
    <View style={[styles.slot, { paddingBottom: insets.bottom }]}>
      <BannerAd unitId={adUnits.banner} size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER} onAdFailedToLoad={() => setFailed(true)} />
    </View>
  );
}

const styles = StyleSheet.create({
  slot: { alignItems: 'center', borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: colors.ink },
});
