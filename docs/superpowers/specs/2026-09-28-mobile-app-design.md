# Mobile app v1 (core browse + play) — design

Date: 2026-09-28
Status: approved in chat, awaiting spec review
Branch: `feature/mobile-app` (from `feature/redesign-quick-wins`, which carries the shared catalog code in PR #1)

## Goal

A React Native app in `mobile_app/` for Android and iOS that lets people browse the Electrohm Haus TV
channel catalog and watch a channel full screen, with the same identity and channel logic as the web app.

## Decisions

| Question | Decision | Why |
|---|---|---|
| Platforms / distribution | Android + iOS; no store submission in v1 | Store policies (Apple third-party content rules, Google Play IP policy) often reject IPTV aggregators; submission waits for a store-safe catalog mode. |
| v1 scope | Core browse + play only | Favorites/recents, casting, PiP/background audio, TV guide are later versions. |
| Framework | Expo (SDK 57, React Native 0.87) with expo-router and expo-video | Android builds locally (SDK + emulator present); iOS via EAS cloud builds or Expo Go (Windows can't build iOS). |
| Code sharing | Import the web's framework-free TypeScript from `../src/app/lib` | One copy of catalog logic without restructuring the web app. |

## Environment facts

- Windows 10; Node 24; Java 21 (Android Studio JBR); `ANDROID_HOME=F:\AndroidSDK` with emulator and
  platform-tools; AVD `Medium_Phone_API_36.1`.
- Latest: `expo` 57.0.25, `react-native` 0.87.1, `expo-video` 57.0.5.

## Structure

```
mobile_app/
  app/
    _layout.tsx          fonts, status bar, CatalogProvider, Stack navigator
    index.tsx            Home: header (search field, filter buttons), category chips, Tuner, rails
    browse.tsx           Grid for a category / search / all channels (route params)
    player/[id].tsx      Full-screen player for one channel id
  src/
    catalog/
      CatalogProvider.tsx   context: catalog status, streams, filters state
      cache.ts              read/write processed catalog file; staleness
    components/
      ChannelCard.tsx, ChannelLogo.tsx, Tuner.tsx, Rail.tsx, Chip.tsx, FilterSheet.tsx, NoSignal.tsx
    theme.ts             tokens copied from web `src/styles/index.css` @theme
  app.json               Expo config (name, scheme, orientation, plugins)
  metro.config.js        watchFolders include the repo root so `../src/app/lib` resolves
  tsconfig.json          extends expo/tsconfig.base; path alias `@shared/*` → `../src/app/lib/*`
  package.json
```

## Shared code

- Mobile imports `src/app/lib/catalog.ts`, `src/app/lib/format.ts`, `src/app/types.ts` via `@shared/*`.
- New `src/app/lib/selectors.ts` (pure), used by web and mobile. It takes the filter logic now inline in web
  `App.tsx`:

  ```ts
  export interface Rail { category: CategoryOption; streams: Stream[] }
  export function countryOptions(streams: Stream[]): CountryOption[];
  export function streamsInCountry(streams: Stream[], country: string): Stream[];
  export function languageOptions(pool: Stream[], languages: Language[]): LanguageOption[];
  export function streamsInLanguage(pool: Stream[], language: string): Stream[];
  export function categoryOptions(pool: Stream[], categories: Category[]): CategoryOption[];
  export function filterStreams(pool: Stream[], categoryId: string, query: string): Stream[];
  export function homeRails(pool: Stream[], options: CategoryOption[], count: number, size: number): Rail[];
  export function logosFirst(streams: Stream[]): Stream[];
  ```

  `CountryOption`, `CategoryOption`, `LanguageOption` move from `Header.tsx` into `selectors.ts`
  (`Header.tsx` re-imports them). The web `App.tsx` is refactored to call these; behaviour is unchanged.
- The shared files get a header comment: framework-free — no React, DOM or browser-only APIs.
  `format.ts` already falls back when `Intl.DisplayNames` is missing (Hermes may lack it), returning the code.
- `storage.ts` (localStorage) is not shared.

## Data and caching

- First launch: `loadCatalog()` (6 iptv-org files, ~3.7 MB gzipped), then the processed `Catalog` is written to
  `FileSystem.documentDirectory + 'catalog-v1.json'` together with `savedAt`.
- Later launches: read the cached file, show it immediately, and refresh in the background when older than
  6 hours; a successful refresh replaces the in-memory catalog and the file.
- Channel numbers can change after a refresh (same as web); v1 stores no ids, so nothing breaks.
- No network and no cache: full-screen "No signal" with "The channel list didn't load" and **Try again**.
- A corrupt or unreadable cache file is deleted and treated as no cache.

## Screens

**Home (`index`)**
- Header: wordmark, search field (submitting opens Browse with the query), buttons for Country and Language
  that open `FilterSheet`.
- Category chip row (horizontal, with counts), "All channels" first; tapping opens Browse for that category.
- `Tuner`: eyebrow (On air · N channels · M countries), `CH ####` readout in Martian Mono amber, logo plate,
  title, category · country; **Watch** opens the player; **Surf** rolls digits (12 steps × 55 ms; skipped when
  the OS reduce-motion setting is on) and lands on a random channel with a logo.
- Rails: top 6 categories by count, 16 channels each, logos first; "See all N" opens Browse.
- "Browse all N channels" button.

**Browse (`browse`)** params: `categoryId?`, `query?`
- Title, count, `FlashList` grid (2 columns under 600 dp wide, 3 under 900, else 4) of `ChannelCard`.
- Empty state text: "No channels match … Check the spelling or clear the filters." with **Clear filters**.

**Player (`player/[id]`)**
- `expo-video` `VideoView`, full screen, `contentFit="contain"`, native fullscreen off (the screen is full screen).
- Source: `{ uri, headers, contentType }`. Headers include `User-Agent` / `Referer` when the stream has
  `user_agent` / `referrer`. `contentType: 'hls'` unless the URL is a progressive file
  (`.mp4|.m4v|.webm|.mp3|.aac`).
- Overlay (auto-hides after 4 s of no touch; tap toggles): back, LIVE tag, `CH ####`, title; previous / play-pause /
  next; mute.
- Backup streams: on player `statusChange` to `error`, move to the next URL in `stream.sources`; while retrying
  show "Trying backup stream N of M"; after the last fails show `NoSignal` with **Try again** (restart at
  source 1) and **Next channel**.
- Previous/next walk the list the user came from (the rail, grid or the tuner pool), wrapping around; the list is
  passed through the catalog context, not route params.
- Orientation: the player unlocks rotation (`expo-screen-orientation`) and restores portrait on leave; other
  screens are portrait.
- Keep the screen awake while playing (`expo-keep-awake`).

## Platform configuration

- Android: `usesCleartextTraffic: true` via `expo-build-properties` (many streams are plain http).
- iOS: `NSAppTransportSecurity.NSAllowsArbitraryLoads = true` in `app.json` `ios.infoPlist`.
  Flagged for store review later; acceptable because v1 is not submitted.
- App name "Electrohm TV", scheme `electrohmtv`, dark UI, icon/splash from the web favicon mark on #14111F.

## Look and feel

- `theme.ts` mirrors web tokens: ink #14111F, panel #1D1929, raised #262136, line #2F2A42, paper #EEEAF6,
  dim #9791AE, amber #FFB547, onair #FF4D5E. Fonts: Big Shoulders Display (800/900), Instrument Sans
  (400/500/600), Martian Mono (400/600) via `@expo-google-fonts/*`.
- `StyleSheet` only; no styling library. `FlashList` (`@shopify/flash-list`) for grids and rails.
- Touch targets ≥ 44 dp; `accessibilityLabel` on icon-only buttons; respects OS font scaling.

## Error handling

| Case | Behaviour |
|---|---|
| Catalog fetch fails, cache exists | Keep cache; no error shown |
| Catalog fetch fails, no cache | Full-screen No signal + Try again |
| Cache unreadable | Delete it; behave as no cache |
| Stream fails | Next backup source; after all fail, NoSignal with Try again / Next channel |
| Unknown player id (stale deep link) | Go back to Home |
| Logo fails to load | Monogram fallback (as web) |

## Testing

- `jest-expo` in `mobile_app/` for `cache.ts` (fresh/stale/corrupt) with a mocked file system.
- Vitest (web, existing) for `src/app/lib/selectors.ts`, covering each function; web behaviour check that the
  refactored `App.tsx` still renders the same counts.
- Android emulator run (`npx expo run:android`): first launch loads and caches; relaunch opens from cache;
  filters, chips, search, grid scrolling, Surf; playback, backup fallback (forced), rotation, No signal.
- iOS: not testable on this machine; verified by the user through Expo Go on an iPhone or an EAS build.

## Out of scope (v1)

Favorites/recents/resume, casting, picture-in-picture, background audio, TV guide, share links, number tuning,
language of UI other than English, store submission, Android TV.
