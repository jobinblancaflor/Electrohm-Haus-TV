import { AdEventType, InterstitialAd } from 'react-native-google-mobile-ads';
import { adUnits } from './config';
import { shouldShowInterstitial, type InterstitialState } from './policy';

let ad: InterstitialAd | null = null;
let loaded = false;
let loadFailed = false;
let showing = false;
const state: InterstitialState = { opens: 0, lastShownAt: null };

function preload() {
  const next = InterstitialAd.createForAdRequest(adUnits.interstitial);
  loaded = false;
  loadFailed = false;
  next.addAdEventListener(AdEventType.LOADED, () => {
    loaded = true;
  });
  next.addAdEventListener(AdEventType.ERROR, () => {
    loaded = false;
    loadFailed = true;
  });
  next.load();
  ad = next;
}

/** Called once ads may be requested (after consent and SDK init). */
export function startInterstitials() {
  if (!ad) preload();
}

/**
 * Gate for opening a channel from Home or Browse: runs `proceed` straight away, or after an interstitial
 * closes when one is loaded and the frequency policy allows it. A failed show still proceeds.
 */
export function beforeChannelOpen(proceed: () => void) {
  // A second tap while an interstitial is up must not queue another open, nor count as one.
  if (showing) return;
  state.opens += 1;
  const now = Date.now();
  const current = ad;
  if (!current || !loaded || !shouldShowInterstitial(state, now)) {
    // Retry a failed load now so an ad may be ready by the next channel open, instead of staying
    // disabled for the rest of the session.
    if (current && loadFailed) preload();
    proceed();
    return;
  }

  let finished = false;
  const unsubscribers: (() => void)[] = [];
  const finish = () => {
    if (finished) return;
    finished = true;
    showing = false;
    unsubscribers.forEach((unsubscribe) => unsubscribe());
    preload();
    proceed();
  };
  unsubscribers.push(current.addAdEventListener(AdEventType.CLOSED, finish));
  unsubscribers.push(current.addAdEventListener(AdEventType.ERROR, finish));
  state.lastShownAt = now;
  showing = true;
  loaded = false;
  current.show().catch(finish);
}
