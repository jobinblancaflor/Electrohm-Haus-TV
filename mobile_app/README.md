# Electrohm TV (mobile)

Expo SDK 57 / React Native 0.86 app. Shared framework-free code is imported from the web app in `../src/app`
via the `@shared/*` alias.

## Run

```
npm install
npm run android      # build and run on a device or emulator
npm test             # jest
npm run typecheck
```

## Build notes

- The Gradle JS bundle task does not track `../src/app`. After editing shared code, rebuild with `--rerun`
  (for example `cd android && ./gradlew app:createBundleReleaseJsAndAssets --rerun`) or the old bundle is reused.
- Windows has a 260-character path limit that native builds can exceed. Enable `LongPathsEnabled` in the
  registry, or use a short `buildStagingDirectory`.

## Ads

- Builds use Google's test ad units by default.
- `EXPO_PUBLIC_REAL_ADS=1` switches to the real Android units. Set it only in store release build profiles or
  CI, never in a local `.env` (real ads on your own devices count as invalid traffic).
- `EXPO_PUBLIC_ADS_DEBUG_EEA=1` forces the EEA consent flow for testing.
- Before a real-ads release, publish a UMP consent message in AdMob under Privacy & messaging. Without one, no
  ads load.
- The Android app ID is set twice and the two must stay in sync: the `react-native-google-mobile-ads` plugin
  `androidAppId` and the root `react-native-google-mobile-ads.android_app_id` in `app.json`.
- iOS uses Google's sample app ID until an iOS AdMob app exists.

## Not for store submission yet

The channel list comes from a public IPTV catalog whose content is not licensed for redistribution. Resolve
the content policy question before submitting to any store.
