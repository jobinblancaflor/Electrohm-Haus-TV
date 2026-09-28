# Mobile App v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An Expo (React Native) app in `mobile_app/` for Android and iOS that browses the Electrohm Haus TV catalog and plays a channel full screen, sharing the web app's catalog logic.

**Architecture:** The web's framework-free TypeScript (`src/app/lib/catalog.ts`, `format.ts`, a new `selectors.ts`, `src/app/types.ts`) is imported by the mobile app through an `@shared/*` alias. Metro resolves the alias itself, and Jest resolves it with `moduleNameMapper`. A `CatalogProvider` loads the catalog, caches the processed result in a file, and exposes filters. expo-router gives three screens (Home, Browse, Player), and expo-video plays HLS with a fallback through backup sources.

**Tech Stack:** Expo SDK 57 (React Native 0.86.3, React 19.2.3), expo-router ~57.0.23, expo-video ~57.0.5, expo-file-system ~57.0.7, @shopify/flash-list 2.0.2, @expo-google-fonts/*, @expo/vector-icons, jest-expo ~57.0.5; web side Vitest 5.

**Spec:** `docs/superpowers/specs/2026-09-28-mobile-app-design.md`

## Global Constraints

- Android package and iOS bundle identifier: `com.electrohmhaussystems.electrohmtv`. App name "Electrohm TV", scheme `electrohmtv`.
- Colors (from web `@theme`): ink `#14111F`, panel `#1D1929`, raised `#262136`, line `#2F2A42`, paper `#EEEAF6`, dim `#9791AE`, amber `#FFB547`, onair `#FF4D5E`. Add no other colors, except translucent black for scrims over video.
- Fonts: Big Shoulders Display 800/900 (display, uppercase), Instrument Sans 400/500/600 (body), Martian Mono 400/600 (numbers, codes, eyebrows). With custom fonts, never set `fontWeight`: pick the weight by `fontFamily`.
- Catalog cache file: `Paths.document/catalog-v1.json`; stale after 6 hours.
- Home: top 6 categories, 16 channels per rail, logos first. Surf: 12 steps × 55 ms, skipped when reduce motion is on.
- Browse grid columns: 2 under 600 dp wide, 3 under 900, else 4.
- The player overlay auto-hides after 4 s. Backup sources in order, then No signal with **Try again** / **Next channel**.
- Plain http allowed: Android `usesCleartextTraffic: true` (expo-build-properties); iOS `NSAllowsArbitraryLoads: true`.
- Only the player screen may rotate; all others are portrait.
- Shared files stay framework-free: no React, DOM, `window`, or `localStorage`.
- Copy is sentence case, from the user's side: "Watch", "Surf", "See all", "Try again", "Next channel", "Clear filters", "No signal".
- Touch targets are at least 44 dp; every icon-only button has an `accessibilityLabel`.
- Commit messages end with a blank line then `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Never `git add -A`; add explicit paths. `.claude/` stays untracked.

## File Structure

| File | Responsibility |
|---|---|
| `src/app/lib/selectors.ts` (new, shared) | Pure filter/option/rail functions used by web and mobile |
| `src/app/lib/selectors.test.ts` (new) | Vitest tests for selectors |
| `src/app/App.tsx`, `src/app/components/Header.tsx` (modify) | Use selectors; option types move to selectors |
| `vite.config.ts`, `src/styles/index.css` (modify) | Keep Vitest and Tailwind out of `mobile_app/` |
| `mobile_app/package.json`, `app.json`, `tsconfig.json`, `metro.config.js`, `.gitignore` | Project config |
| `mobile_app/scripts/make-icons.mjs`, `mobile_app/assets/*.png` | Icon/splash generation from the web mark |
| `mobile_app/app/_layout.tsx` | Fonts, splash, status bar, provider, stack |
| `mobile_app/app/index.tsx` | Home |
| `mobile_app/app/browse.tsx` | Browse grid |
| `mobile_app/app/player/[id].tsx` | Player |
| `mobile_app/src/theme.ts` | Colors, font names, font assets |
| `mobile_app/src/catalog/cache.ts` (+ test) | Cache read/write/staleness over an injectable store |
| `mobile_app/src/catalog/fileStore.ts` | expo-file-system store |
| `mobile_app/src/catalog/CatalogProvider.tsx` | Loading, cache, filters, queue context |
| `mobile_app/src/catalog/usePlay.ts` | Open the player with a queue |
| `mobile_app/src/player/source.ts` (+ test) | Stream → expo-video source |
| `mobile_app/src/components/*` | ChannelLogo, ChannelCard, Chip, NoSignal, FilterSheet, Tuner, Rail |

---

### Task 1: Shared selectors (web)

**Files:**
- Create: `src/app/lib/selectors.ts`
- Test: `src/app/lib/selectors.test.ts`
- Modify: `src/app/App.tsx`, `src/app/components/Header.tsx`, `src/app/lib/catalog.ts`, `src/app/lib/format.ts`, `src/app/types.ts` (header comment only on the last three)

**Interfaces:**
- Consumes: `Stream`, `Category`, `Language` from `src/app/types.ts`; `countryName` from `src/app/lib/format.ts`.
- Produces (exact exports of `src/app/lib/selectors.ts`):
  - `interface CountryOption { code: string; count: number }`
  - `interface CategoryOption { id: string; name: string; count: number }`
  - `interface LanguageOption extends Language { count: number }`
  - `interface Rail { category: CategoryOption; streams: Stream[] }`
  - `countryOptions(streams: Stream[]): CountryOption[]`: sorted by country name.
  - `streamsInCountry(streams: Stream[], country: string): Stream[]`: `'All'` returns the same array.
  - `languageOptions(pool: Stream[], languages: Language[]): LanguageOption[]`: keeps `languages` order, drops zero counts.
  - `streamsInLanguage(pool: Stream[], language: string): Stream[]`: `'All'` returns the same array.
  - `categoryOptions(pool: Stream[], categories: Category[]): CategoryOption[]`: count descending, drops zero counts.
  - `filterStreams(pool: Stream[], categoryId: string, query: string): Stream[]`: `'all'` means no category filter; the query is trimmed and matched case-insensitively against `title` or `channel_name`.
  - `logosFirst(streams: Stream[]): Stream[]`: stable, logo-bearing first, returns a new array.
  - `homeRails(pool: Stream[], options: CategoryOption[], count: number, size: number): Rail[]`

- [ ] **Step 1: Write the failing tests**

Create `src/app/lib/selectors.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { Stream } from '../types';
import {
  categoryOptions,
  countryOptions,
  filterStreams,
  homeRails,
  languageOptions,
  logosFirst,
  streamsInCountry,
  streamsInLanguage,
} from './selectors';

let serial = 0;
function stream(overrides: Partial<Stream> = {}): Stream {
  serial += 1;
  return {
    id: `s${serial}`,
    number: serial,
    channel: null,
    feed: null,
    title: `Channel ${serial}`,
    url: `https://example.test/${serial}.m3u8`,
    sources: [`https://example.test/${serial}.m3u8`],
    quality: null,
    label: null,
    user_agent: null,
    referrer: null,
    logo: '',
    channel_country: null,
    channel_category_ids: [],
    channel_categories: null,
    channel_name: null,
    channel_is_nsfw: false,
    languages: [],
    ...overrides,
  };
}

describe('countryOptions', () => {
  it('counts streams per country and sorts by country name', () => {
    const streams = [
      stream({ channel_country: 'PH' }),
      stream({ channel_country: 'JP' }),
      stream({ channel_country: 'PH' }),
      stream(),
    ];
    expect(countryOptions(streams)).toEqual([
      { code: 'JP', count: 1 },
      { code: 'PH', count: 2 },
    ]);
  });
});

describe('streamsInCountry / streamsInLanguage', () => {
  const ph = stream({ channel_country: 'PH', languages: ['fil'] });
  const jp = stream({ channel_country: 'JP', languages: ['jpn'] });
  const all = [ph, jp];

  it('returns the same array for All', () => {
    expect(streamsInCountry(all, 'All')).toBe(all);
    expect(streamsInLanguage(all, 'All')).toBe(all);
  });

  it('filters by country code and language code', () => {
    expect(streamsInCountry(all, 'PH')).toEqual([ph]);
    expect(streamsInLanguage(all, 'jpn')).toEqual([jp]);
  });
});

describe('languageOptions', () => {
  it('keeps catalog order and drops languages with no streams', () => {
    const pool = [stream({ languages: ['eng'] }), stream({ languages: ['eng', 'spa'] }), stream()];
    const languages = [
      { code: 'eng', name: 'English' },
      { code: 'fra', name: 'French' },
      { code: 'spa', name: 'Spanish' },
    ];
    expect(languageOptions(pool, languages)).toEqual([
      { code: 'eng', name: 'English', count: 2 },
      { code: 'spa', name: 'Spanish', count: 1 },
    ]);
  });
});

describe('categoryOptions', () => {
  it('sorts by count descending and drops empty categories', () => {
    const pool = [
      stream({ channel_category_ids: ['news'] }),
      stream({ channel_category_ids: ['news', 'sports'] }),
      stream({ channel_category_ids: ['news'] }),
    ];
    const categories = [
      { id: 'sports', name: 'Sports', description: '' },
      { id: 'kids', name: 'Kids', description: '' },
      { id: 'news', name: 'News', description: '' },
    ];
    expect(categoryOptions(pool, categories)).toEqual([
      { id: 'news', name: 'News', count: 3 },
      { id: 'sports', name: 'Sports', count: 1 },
    ]);
  });
});

describe('filterStreams', () => {
  const bbc = stream({ title: 'BBC One', channel_category_ids: ['general'] });
  const cnn = stream({ title: 'Headline Desk', channel_name: 'CNN International', channel_category_ids: ['news'] });
  const pool = [bbc, cnn];

  it('applies no category filter for "all"', () => {
    expect(filterStreams(pool, 'all', '')).toEqual(pool);
  });

  it('filters by category id', () => {
    expect(filterStreams(pool, 'news', '')).toEqual([cnn]);
  });

  it('matches the query against title or channel name, trimmed and case-insensitive', () => {
    expect(filterStreams(pool, 'all', '  bbc ')).toEqual([bbc]);
    expect(filterStreams(pool, 'all', 'cnn')).toEqual([cnn]);
    expect(filterStreams(pool, 'general', 'cnn')).toEqual([]);
  });
});

describe('logosFirst', () => {
  it('moves streams with logos first and keeps order otherwise', () => {
    const a = stream();
    const b = stream({ logo: 'b.png' });
    const c = stream();
    const d = stream({ logo: 'd.png' });
    const input = [a, b, c, d];
    expect(logosFirst(input)).toEqual([b, d, a, c]);
    expect(input).toEqual([a, b, c, d]);
  });
});

describe('homeRails', () => {
  it('builds up to `count` rails of up to `size` streams, logos first', () => {
    const plain = stream({ channel_category_ids: ['news'] });
    const withLogo = stream({ channel_category_ids: ['news'], logo: 'x.png' });
    const third = stream({ channel_category_ids: ['news'] });
    const sport = stream({ channel_category_ids: ['sports'] });
    const options = [
      { id: 'news', name: 'News', count: 3 },
      { id: 'sports', name: 'Sports', count: 1 },
    ];
    const rails = homeRails([plain, withLogo, third, sport], options, 1, 2);
    expect(rails).toEqual([{ category: options[0], streams: [withLogo, plain] }]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test`
Expected: FAIL, "Failed to resolve import "./selectors"". The existing parser tests still pass.

- [ ] **Step 3: Implement the selectors**

Create `src/app/lib/selectors.ts`:

```ts
// Framework-free: shared by the web app and mobile_app. No React, DOM or browser-only APIs.
import type { Category, Language, Stream } from '../types';
import { countryName } from './format';

export interface CountryOption {
  code: string;
  count: number;
}

export interface CategoryOption {
  id: string;
  name: string;
  count: number;
}

export interface LanguageOption extends Language {
  count: number;
}

export interface Rail {
  category: CategoryOption;
  streams: Stream[];
}

export function countryOptions(streams: Stream[]): CountryOption[] {
  const counts = new Map<string, number>();
  for (const s of streams) if (s.channel_country) counts.set(s.channel_country, (counts.get(s.channel_country) ?? 0) + 1);
  return [...counts]
    .map(([code, count]) => ({ code, count }))
    .sort((a, b) => countryName(a.code).localeCompare(countryName(b.code)));
}

export function streamsInCountry(streams: Stream[], country: string): Stream[] {
  return country === 'All' ? streams : streams.filter((s) => s.channel_country === country);
}

export function languageOptions(pool: Stream[], languages: Language[]): LanguageOption[] {
  const counts = new Map<string, number>();
  for (const s of pool) for (const code of s.languages) counts.set(code, (counts.get(code) ?? 0) + 1);
  return languages.filter((l) => counts.has(l.code)).map((l) => ({ ...l, count: counts.get(l.code)! }));
}

export function streamsInLanguage(pool: Stream[], language: string): Stream[] {
  return language === 'All' ? pool : pool.filter((s) => s.languages.includes(language));
}

export function categoryOptions(pool: Stream[], categories: Category[]): CategoryOption[] {
  const counts = new Map<string, number>();
  for (const s of pool) for (const id of s.channel_category_ids) counts.set(id, (counts.get(id) ?? 0) + 1);
  return categories
    .filter((c) => counts.has(c.id))
    .map((c) => ({ id: c.id, name: c.name, count: counts.get(c.id)! }))
    .sort((a, b) => b.count - a.count);
}

export function filterStreams(pool: Stream[], categoryId: string, query: string): Stream[] {
  let result = categoryId === 'all' ? pool : pool.filter((s) => s.channel_category_ids.includes(categoryId));
  const q = query.trim().toLowerCase();
  if (q) {
    result = result.filter((s) => s.title.toLowerCase().includes(q) || s.channel_name?.toLowerCase().includes(q));
  }
  return result;
}

/** Channels with a logo first, so rails don't open on a wall of monograms. */
export function logosFirst(streams: Stream[]): Stream[] {
  return [...streams].sort((a, b) => Number(!a.logo) - Number(!b.logo));
}

export function homeRails(pool: Stream[], options: CategoryOption[], count: number, size: number): Rail[] {
  return options.slice(0, count).map((category) => ({
    category,
    streams: logosFirst(pool.filter((s) => s.channel_category_ids.includes(category.id))).slice(0, size),
  }));
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS, the 12 parser tests plus 10 selector tests.

- [ ] **Step 5: Move the option types out of `Header.tsx`**

In `src/app/components/Header.tsx`:
- Delete the three declarations `export interface CountryOption {...}`, `export interface CategoryOption {...}` and `export interface LanguageOption extends Language {...}`.
- Delete the line `import type { Language } from '../types';`.
- Add, below the other imports:

```ts
import type { CategoryOption, CountryOption, LanguageOption } from '../lib/selectors';
```

`FAVORITES` stays exported from `Header.tsx`.

- [ ] **Step 6: Use the selectors in `App.tsx`**

In `src/app/App.tsx`:

1. Replace the Header import block:

```ts
import {
  FAVORITES,
  Header,
  type CategoryOption,
  type CountryOption,
  type LanguageOption,
} from './components/Header';
```

with:

```ts
import { FAVORITES, Header } from './components/Header';
import * as selectors from './lib/selectors';
```

2. Delete the local function `logosFirst` and its doc comment.

3. Replace the `countries`, `countryPool`, `languageOptions`, `pool` and `categoryOptions` `useMemo` declarations with the block below. Keep the two "reset when empty" `useEffect`s exactly where they are, between them.

```ts
  const countries = useMemo(() => selectors.countryOptions(streams), [streams]);

  const countryPool = useMemo(() => selectors.streamsInCountry(streams, country), [streams, country]);

  const languageOptions = useMemo(
    () => selectors.languageOptions(countryPool, catalog?.languages ?? []),
    [catalog, countryPool],
  );
```

```ts
  const pool = useMemo(() => selectors.streamsInLanguage(countryPool, language), [countryPool, language]);

  const categoryOptions = useMemo(
    () => selectors.categoryOptions(pool, catalog?.categories ?? []),
    [catalog, pool],
  );
```

4. Replace the `gridStreams` `useMemo` with:

```ts
  const gridStreams = useMemo(
    () =>
      // My channels ignores the country and language filters: they're yours wherever you are.
      categoryId === FAVORITES
        ? selectors.filterStreams(favoriteStreams, 'all', query)
        : selectors.filterStreams(pool, categoryId, query),
    [pool, favoriteStreams, categoryId, query],
  );
```

5. Replace the `homeRails` `useMemo` with:

```ts
  const homeRails = useMemo(
    () => selectors.homeRails(pool, categoryOptions, HOME_CATEGORIES, RAIL_SIZE),
    [categoryOptions, pool],
  );
```

- [ ] **Step 7: Mark the shared files**

Add this as the first line of `src/app/lib/catalog.ts`, `src/app/lib/format.ts` and `src/app/types.ts`:

```ts
// Framework-free: shared by the web app and mobile_app. No React, DOM or browser-only APIs.
```

- [ ] **Step 8: Typecheck, test, build, and check behaviour**

Run: `npx tsc --noEmit && npm test && npx vite build`
Expected: all pass.

Then start the web dev server (`npm run dev`), open http://localhost:5173, and confirm:
- the eyebrow shows the same channel count as before (currently about 13,1xx channels);
- choosing Philippines as the country and then the News chip gives a non-empty grid;
- searching "bbc" returns results.

- [ ] **Step 9: Commit**

```bash
git add src/app/lib/selectors.ts src/app/lib/selectors.test.ts src/app/App.tsx src/app/components/Header.tsx src/app/lib/catalog.ts src/app/lib/format.ts src/app/types.ts
git commit -m "Extract shared catalog selectors for web and mobile"
```

---

### Task 2: Scaffold the Expo app

**Files:**
- Create: `mobile_app/` via `create-expo-app`, then modify `mobile_app/package.json`, `mobile_app/app.json`, `mobile_app/tsconfig.json`, `mobile_app/.gitignore`
- Create: `mobile_app/metro.config.js`, `mobile_app/scripts/make-icons.mjs`, `mobile_app/assets/icon.png`, `mobile_app/assets/adaptive-icon.png`, `mobile_app/assets/splash-icon.png`
- Create: `mobile_app/src/theme.ts`, `mobile_app/app/_layout.tsx`, `mobile_app/app/index.tsx` (placeholder, replaced in Task 4)
- Test: `mobile_app/src/__tests__/shared.test.ts`
- Delete: the template's `mobile_app/App.tsx` and `mobile_app/index.ts`
- Modify (root): `vite.config.ts`, `src/styles/index.css`

**Interfaces:**
- Consumes: `channelNumber` from `@shared/lib/format`, `logosFirst` from `@shared/lib/selectors` (Task 1).
- Produces:
  - Alias `@shared/*` → `<repo>/src/app/*` in Metro, TypeScript and Jest.
  - `mobile_app/src/theme.ts` exports `colors` (`ink panel raised line paper dim amber onair`), `fonts` (`display displayBlack sans sansMedium sansSemiBold mono monoSemiBold`: font-family strings), and `fontAssets` (the map for `useFonts`).
  - Scripts: `npm test` (jest), `npm run typecheck`, `npm run android`, `npm run ios`, `npm start`.

- [ ] **Step 1: Create the project**

From the repo root: `npx create-expo-app@latest mobile_app --template blank-typescript`
Expected: `mobile_app/` with `package.json`, `app.json`, `App.tsx`, `index.ts`, `assets/`, `tsconfig.json`, and `node_modules` installed. If it created `mobile_app/.git`, delete that folder (the repo root is already a git repo).

Then delete `mobile_app/App.tsx` and `mobile_app/index.ts`.

- [ ] **Step 2: Install dependencies with SDK-matched versions**

From `mobile_app/`:

```bash
npx expo install expo-router react-native-safe-area-context react-native-screens expo-linking expo-constants expo-status-bar expo-splash-screen expo-font expo-video expo-file-system expo-build-properties @shopify/flash-list @expo/vector-icons @expo-google-fonts/big-shoulders-display @expo-google-fonts/instrument-sans @expo-google-fonts/martian-mono
npx expo install --dev jest-expo jest @resvg/resvg-js
```

Expected: `package.json` lists these; expo-router `~57.0.x`, expo-video `~57.0.x`, @shopify/flash-list `2.0.2`.

- [ ] **Step 3: Configure `package.json`**

In `mobile_app/package.json`:
- set `"name": "electrohm-tv-mobile"`, `"private": true`, and `"main": "expo-router/entry"`;
- set `"scripts"` to:

```json
  "scripts": {
    "start": "expo start",
    "android": "expo run:android",
    "ios": "expo run:ios",
    "test": "jest",
    "typecheck": "tsc --noEmit",
    "icons": "node scripts/make-icons.mjs"
  },
```

- add a top-level `"jest"` block:

```json
  "jest": {
    "preset": "jest-expo",
    "moduleNameMapper": {
      "^@shared/(.*)$": "<rootDir>/../src/app/$1"
    }
  }
```

- [ ] **Step 4: Write `app.json`**

Replace `mobile_app/app.json` with:

```json
{
  "expo": {
    "name": "Electrohm TV",
    "slug": "electrohm-tv",
    "scheme": "electrohmtv",
    "version": "0.1.0",
    "orientation": "default",
    "userInterfaceStyle": "dark",
    "backgroundColor": "#14111F",
    "icon": "./assets/icon.png",
    "ios": {
      "bundleIdentifier": "com.electrohmhaussystems.electrohmtv",
      "supportsTablet": true,
      "infoPlist": {
        "NSAppTransportSecurity": { "NSAllowsArbitraryLoads": true }
      }
    },
    "android": {
      "package": "com.electrohmhaussystems.electrohmtv",
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#14111F"
      }
    },
    "plugins": [
      "expo-router",
      "expo-font",
      "expo-video",
      [
        "expo-splash-screen",
        {
          "image": "./assets/splash-icon.png",
          "imageWidth": 160,
          "resizeMode": "contain",
          "backgroundColor": "#14111F"
        }
      ],
      [
        "expo-build-properties",
        {
          "android": { "usesCleartextTraffic": true }
        }
      ]
    ]
  }
}
```

- [ ] **Step 5: TypeScript, Metro and gitignore**

Replace `mobile_app/tsconfig.json` with:

```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "paths": {
      "@shared/*": ["../src/app/*"]
    }
  },
  "include": ["**/*.ts", "**/*.tsx", ".expo/types/**/*.ts", "expo-env.d.ts"]
}
```

Create `mobile_app/metro.config.js`:

```js
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const sharedRoot = path.resolve(projectRoot, '../src/app');
const config = getDefaultConfig(projectRoot);

// The web app's framework-free catalog code lives outside this project: let Metro watch it and
// resolve "@shared/..." imports to it.
config.watchFolders = [sharedRoot];
const upstreamResolve = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const resolve = upstreamResolve ?? context.resolveRequest;
  if (moduleName.startsWith('@shared/')) {
    return resolve(context, path.join(sharedRoot, moduleName.slice('@shared/'.length)), platform);
  }
  return resolve(context, moduleName, platform);
};

module.exports = config;
```

In `mobile_app/.gitignore`, make sure these lines exist (add any that are missing):

```
node_modules/
.expo/
dist/
/android
/ios
*.jks
*.keystore
```

- [ ] **Step 6: Keep root tooling out of `mobile_app`**

Replace root `vite.config.ts` with:

```ts
import { defineConfig, configDefaults } from 'vitest/config'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // The lazily loaded player chunk is mostly hls.js (~590 kB); it only downloads on first play.
  build: { chunkSizeWarningLimit: 650 },
  // mobile_app has its own Jest suite.
  test: { exclude: [...configDefaults.exclude, 'mobile_app/**'] },
})
```

In root `src/styles/index.css`, directly after the line `@import 'tailwindcss';`, add:

```css
@source not '../../mobile_app';
```

Run from the repo root: `npm test && npx tsc --noEmit && npx vite build`
Expected: the same 22 tests pass (no mobile tests are picked up), the typecheck is clean, and the build succeeds.

- [ ] **Step 7: Icons**

Create `mobile_app/scripts/make-icons.mjs`:

```js
// Renders the app icon, Android adaptive-icon foreground and splash mark from the web favicon mark.
// Run with `npm run icons`; outputs are committed.
import { writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';

const MARK =
  '<rect x="10" y="16" width="44" height="30" rx="6" fill="none" stroke="#ffb547" stroke-width="4"/>' +
  '<path d="M24 54h16" stroke="#ffb547" stroke-width="4" stroke-linecap="round"/>' +
  '<path d="M22 31h5l3-7 4 14 3-7h5" fill="none" stroke="#eeeaf6" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>';

function svg(size, markScale, background) {
  const scale = (size * markScale) / 64;
  const offset = (size - 64 * scale) / 2;
  const fill = background ? `<rect width="${size}" height="${size}" fill="${background}"/>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${fill}<g transform="translate(${offset} ${offset}) scale(${scale})">${MARK}</g></svg>`;
}

const outputs = [
  ['assets/icon.png', svg(1024, 0.8, '#14111F')],
  ['assets/adaptive-icon.png', svg(1024, 0.55)],
  ['assets/splash-icon.png', svg(512, 0.9)],
];

for (const [file, source] of outputs) {
  writeFileSync(new URL(`../${file}`, import.meta.url), new Resvg(source).render().asPng());
  console.log(`Wrote ${file}`);
}
```

Run from `mobile_app/`: `npm run icons`
Expected: three "Wrote …" lines. View `mobile_app/assets/icon.png` to confirm an amber TV outline with a white pulse on a dark background.

- [ ] **Step 8: Theme**

Create `mobile_app/src/theme.ts`:

```ts
import { BigShouldersDisplay_800ExtraBold, BigShouldersDisplay_900Black } from '@expo-google-fonts/big-shoulders-display';
import { InstrumentSans_400Regular, InstrumentSans_500Medium, InstrumentSans_600SemiBold } from '@expo-google-fonts/instrument-sans';
import { MartianMono_400Regular, MartianMono_600SemiBold } from '@expo-google-fonts/martian-mono';

/** Mirrors the web @theme tokens in src/styles/index.css. */
export const colors = {
  ink: '#14111F',
  panel: '#1D1929',
  raised: '#262136',
  line: '#2F2A42',
  paper: '#EEEAF6',
  dim: '#9791AE',
  amber: '#FFB547',
  onair: '#FF4D5E',
} as const;

// With custom fonts, weight comes from the family; never combine these with fontWeight.
export const fonts = {
  display: 'BigShouldersDisplay_800ExtraBold',
  displayBlack: 'BigShouldersDisplay_900Black',
  sans: 'InstrumentSans_400Regular',
  sansMedium: 'InstrumentSans_500Medium',
  sansSemiBold: 'InstrumentSans_600SemiBold',
  mono: 'MartianMono_400Regular',
  monoSemiBold: 'MartianMono_600SemiBold',
} as const;

export const fontAssets = {
  BigShouldersDisplay_800ExtraBold,
  BigShouldersDisplay_900Black,
  InstrumentSans_400Regular,
  InstrumentSans_500Medium,
  InstrumentSans_600SemiBold,
  MartianMono_400Regular,
  MartianMono_600SemiBold,
};
```

- [ ] **Step 9: Layout and placeholder screen**

Create `mobile_app/app/_layout.tsx`:

```tsx
import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { colors, fontAssets } from '../src/theme';

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts(fontAssets);

  useEffect(() => {
    if (loaded || error) void SplashScreen.hideAsync();
  }, [loaded, error]);

  if (!loaded && !error) return null;

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.ink },
          orientation: 'portrait',
          animation: 'fade',
        }}
      />
    </>
  );
}
```

Create `mobile_app/app/index.tsx` (a placeholder that proves fonts and `@shared` work at runtime; Task 4 replaces it):

```tsx
import { StyleSheet, Text, View } from 'react-native';
import { channelNumber } from '@shared/lib/format';
import { colors, fonts } from '../src/theme';

export default function HomeScreen() {
  return (
    <View style={styles.screen}>
      <Text style={styles.wordmark}>Electrohm</Text>
      <Text style={styles.number}>CH {channelNumber(7)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.ink },
  wordmark: { fontFamily: fonts.display, fontSize: 40, color: colors.paper, textTransform: 'uppercase' },
  number: { fontFamily: fonts.monoSemiBold, fontSize: 24, color: colors.amber, marginTop: 8 },
});
```

- [ ] **Step 10: Write the alias smoke test, then run it**

Create `mobile_app/src/__tests__/shared.test.ts`:

```ts
import { describe, expect, it } from '@jest/globals';
import { channelNumber } from '@shared/lib/format';
import { logosFirst } from '@shared/lib/selectors';

describe('@shared alias', () => {
  it('resolves the web app catalog helpers', () => {
    expect(channelNumber(7)).toBe('0007');
    expect(logosFirst([])).toEqual([]);
  });
});
```

Run from `mobile_app/`: `npm test`
Expected: PASS, 1 test.

If Jest cannot transform `../src/app/lib/*.ts` ("SyntaxError: Cannot use import statement" or type-annotation errors), create `mobile_app/babel.config.js` with:

```js
module.exports = function (api) {
  api.cache(true);
  return { presets: ['babel-preset-expo'] };
};
```

and rerun.

- [ ] **Step 11: Typecheck and bundle for Android (no device needed)**

Run from `mobile_app/`:

```bash
npm run typecheck
npx expo export --platform android --output-dir dist
```

Expected: the typecheck is clean. The export ends with a bundle written under `dist/` and no "Unable to resolve module @shared/…" errors. Delete `mobile_app/dist` afterwards (it is gitignored anyway).

- [ ] **Step 12: Commit**

```bash
git add mobile_app/package.json mobile_app/package-lock.json mobile_app/app.json mobile_app/tsconfig.json mobile_app/metro.config.js mobile_app/.gitignore mobile_app/scripts/make-icons.mjs mobile_app/assets mobile_app/src/theme.ts mobile_app/app mobile_app/src/__tests__/shared.test.ts vite.config.ts src/styles/index.css
git status --short mobile_app
```

Also `git add` `mobile_app/babel.config.js`, `mobile_app/expo-env.d.ts` and any other template file (such as `mobile_app/README.md`) that shows as untracked and is part of the project. Never add `node_modules`, `.expo`, or `dist`. Then:

```bash
git commit -m "Scaffold Expo mobile app with shared catalog alias"
```

---

### Task 3: Catalog cache and provider

**Files:**
- Create: `mobile_app/src/catalog/cache.ts`, `mobile_app/src/catalog/fileStore.ts`, `mobile_app/src/catalog/CatalogProvider.tsx`, `mobile_app/src/catalog/usePlay.ts`
- Test: `mobile_app/src/catalog/cache.test.ts`
- Modify: `mobile_app/app/_layout.tsx` (wrap in `CatalogProvider`; register the player screen options)

**Interfaces:**
- Consumes: `loadCatalog()` from `@shared/lib/catalog`; `Catalog`, `Stream` from `@shared/types`; `selectors` functions and option types from `@shared/lib/selectors` (Task 1).
- Produces:
  - `cache.ts`: `CACHE_VERSION = 1`, `STALE_AFTER_MS = 21_600_000`, `interface CacheStore { read(): Promise<string | null>; write(contents: string): void; remove(): void }`, `interface CachedCatalog { catalog: Catalog; savedAt: number }`, `readCache(store): Promise<CachedCatalog | null>`, `writeCache(store, catalog, savedAt?)`, `isStale(savedAt, now?)`.
  - `fileStore: CacheStore`
  - `CatalogProvider`; `useCatalog()` returning `{ load, retry, streams, findStream(id), countries, country, setCountry, languages, language, setLanguage, pool, categories, queue, setQueue }`, where `load` is `{status:'loading'} | {status:'error'; message} | {status:'ready'; catalog}`.
  - `usePlay(): (stream: Stream, queue: Stream[]) => void` pushes `/player/[id]`.

- [ ] **Step 1: Write the failing cache tests**

Create `mobile_app/src/catalog/cache.test.ts`:

```ts
import { describe, expect, it } from '@jest/globals';
import type { Catalog } from '@shared/types';
import { CACHE_VERSION, STALE_AFTER_MS, isStale, readCache, writeCache, type CacheStore } from './cache';

function memoryStore(initial: string | null = null) {
  let contents = initial;
  let removed = false;
  const store: CacheStore = {
    async read() {
      return contents;
    },
    write(next) {
      contents = next;
    },
    remove() {
      contents = null;
      removed = true;
    },
  };
  return { store, get contents() { return contents; }, get removed() { return removed; } };
}

const catalog: Catalog = { streams: [], categories: [{ id: 'news', name: 'News', description: '' }], languages: [] };

describe('catalog cache', () => {
  it('returns null when nothing is cached', async () => {
    expect(await readCache(memoryStore().store)).toBeNull();
  });

  it('round-trips a written catalog with its timestamp', async () => {
    const memory = memoryStore();
    writeCache(memory.store, catalog, 1234);
    expect(await readCache(memory.store)).toEqual({ catalog, savedAt: 1234 });
    expect(JSON.parse(memory.contents!).version).toBe(CACHE_VERSION);
  });

  it('deletes and ignores a corrupt file', async () => {
    const memory = memoryStore('{not json');
    expect(await readCache(memory.store)).toBeNull();
    expect(memory.removed).toBe(true);
  });

  it('deletes and ignores a file from another cache version', async () => {
    const memory = memoryStore(JSON.stringify({ version: CACHE_VERSION + 1, savedAt: 1, catalog }));
    expect(await readCache(memory.store)).toBeNull();
    expect(memory.removed).toBe(true);
  });

  it('treats a read failure as no cache', async () => {
    const store: CacheStore = {
      read: () => Promise.reject(new Error('disk')),
      write: () => undefined,
      remove: () => undefined,
    };
    expect(await readCache(store)).toBeNull();
  });

  it('is stale only after six hours', () => {
    expect(isStale(0, STALE_AFTER_MS)).toBe(false);
    expect(isStale(0, STALE_AFTER_MS + 1)).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run from `mobile_app/`: `npm test`
Expected: FAIL, "Cannot find module './cache'".

- [ ] **Step 3: Implement the cache and the file store**

Create `mobile_app/src/catalog/cache.ts`:

```ts
import type { Catalog } from '@shared/types';

export const CACHE_VERSION = 1;
export const STALE_AFTER_MS = 6 * 60 * 60 * 1000;

/** Where the processed catalog is kept; injectable so the logic is testable without a file system. */
export interface CacheStore {
  read(): Promise<string | null>;
  write(contents: string): void;
  remove(): void;
}

export interface CachedCatalog {
  catalog: Catalog;
  savedAt: number;
}

export async function readCache(store: CacheStore): Promise<CachedCatalog | null> {
  let text: string | null;
  try {
    text = await store.read();
  } catch {
    return null;
  }
  if (!text) return null;
  try {
    const parsed = JSON.parse(text);
    if (parsed?.version !== CACHE_VERSION || typeof parsed.savedAt !== 'number' || !Array.isArray(parsed.catalog?.streams)) {
      throw new Error('Unexpected cache format');
    }
    return { catalog: parsed.catalog as Catalog, savedAt: parsed.savedAt };
  } catch {
    // A file we can't use would fail the same way every launch: remove it.
    try {
      store.remove();
    } catch {
      // Nothing more to do; the next successful write replaces it.
    }
    return null;
  }
}

export function writeCache(store: CacheStore, catalog: Catalog, savedAt = Date.now()) {
  store.write(JSON.stringify({ version: CACHE_VERSION, savedAt, catalog }));
}

export function isStale(savedAt: number, now = Date.now()) {
  return now - savedAt > STALE_AFTER_MS;
}
```

Create `mobile_app/src/catalog/fileStore.ts`:

```ts
import { File, Paths } from 'expo-file-system';
import type { CacheStore } from './cache';

const cacheFile = () => new File(Paths.document, 'catalog-v1.json');

export const fileStore: CacheStore = {
  async read() {
    const file = cacheFile();
    return file.exists ? file.text() : null;
  },
  write(contents) {
    const file = cacheFile();
    if (!file.exists) file.create();
    file.write(contents);
  },
  remove() {
    const file = cacheFile();
    if (file.exists) file.delete();
  },
};
```

- [ ] **Step 4: Run the tests to verify they pass**

Run from `mobile_app/`: `npm test`
Expected: PASS, 7 tests (6 cache tests plus the alias test).

- [ ] **Step 5: Provider and `usePlay`**

Create `mobile_app/src/catalog/CatalogProvider.tsx`:

```tsx
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Catalog, Stream } from '@shared/types';
import { loadCatalog } from '@shared/lib/catalog';
import * as selectors from '@shared/lib/selectors';
import type { CategoryOption, CountryOption, LanguageOption } from '@shared/lib/selectors';
import { isStale, readCache, writeCache } from './cache';
import { fileStore } from './fileStore';

export type LoadState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; catalog: Catalog };

interface CatalogContextValue {
  load: LoadState;
  retry: () => void;
  streams: Stream[];
  findStream: (id: string) => Stream | undefined;
  countries: CountryOption[];
  country: string;
  setCountry: (code: string) => void;
  languages: LanguageOption[];
  language: string;
  setLanguage: (code: string) => void;
  /** Streams after the country and language filters. */
  pool: Stream[];
  categories: CategoryOption[];
  /** The list the player walks with previous/next. */
  queue: Stream[];
  setQueue: (streams: Stream[]) => void;
}

const CatalogContext = createContext<CatalogContextValue | null>(null);

export function CatalogProvider({ children }: { children: ReactNode }) {
  const [load, setLoad] = useState<LoadState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [country, setCountry] = useState('All');
  const [language, setLanguage] = useState('All');
  const [queue, setQueue] = useState<Stream[]>([]);

  // Show the cached catalog at once; fetch a fresh one when there is none or it is over six hours old.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const cached = await readCache(fileStore);
      if (cancelled) return;
      if (cached) setLoad({ status: 'ready', catalog: cached.catalog });
      if (cached && !isStale(cached.savedAt)) return;
      try {
        const fresh = await loadCatalog();
        if (cancelled) return;
        setLoad({ status: 'ready', catalog: fresh });
        try {
          writeCache(fileStore, fresh);
        } catch (error) {
          console.error('Could not save the channel list:', error);
        }
      } catch (error) {
        console.error('Failed to load IPTV data:', error);
        if (!cancelled && !cached) {
          setLoad({ status: 'error', message: error instanceof Error ? error.message : 'The channel list failed to load.' });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const retry = useCallback(() => {
    setLoad({ status: 'loading' });
    setAttempt((n) => n + 1);
  }, []);

  const catalog = load.status === 'ready' ? load.catalog : null;
  const streams = useMemo(() => catalog?.streams ?? [], [catalog]);
  const byId = useMemo(() => new Map(streams.map((s) => [s.id, s])), [streams]);
  const findStream = useCallback((id: string) => byId.get(id), [byId]);

  const countries = useMemo(() => selectors.countryOptions(streams), [streams]);
  const countryPool = useMemo(() => selectors.streamsInCountry(streams, country), [streams, country]);
  const languages = useMemo(
    () => selectors.languageOptions(countryPool, catalog?.languages ?? []),
    [catalog, countryPool],
  );

  // A language picked in one country may not exist in the next.
  useEffect(() => {
    if (language !== 'All' && catalog && !languages.some((l) => l.code === language)) setLanguage('All');
  }, [catalog, language, languages]);

  const pool = useMemo(() => selectors.streamsInLanguage(countryPool, language), [countryPool, language]);
  const categories = useMemo(() => selectors.categoryOptions(pool, catalog?.categories ?? []), [catalog, pool]);

  const value = useMemo<CatalogContextValue>(
    () => ({
      load,
      retry,
      streams,
      findStream,
      countries,
      country,
      setCountry,
      languages,
      language,
      setLanguage,
      pool,
      categories,
      queue,
      setQueue,
    }),
    [load, retry, streams, findStream, countries, country, languages, language, pool, categories, queue],
  );

  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>;
}

export function useCatalog(): CatalogContextValue {
  const value = useContext(CatalogContext);
  if (!value) throw new Error('useCatalog must be used inside CatalogProvider');
  return value;
}
```

Create `mobile_app/src/catalog/usePlay.ts`:

```ts
import { useCallback } from 'react';
import { router } from 'expo-router';
import type { Stream } from '@shared/types';
import { useCatalog } from './CatalogProvider';

/** Opens the player on `stream`; previous/next then walk `queue`. */
export function usePlay() {
  const { setQueue } = useCatalog();
  return useCallback(
    (stream: Stream, queue: Stream[]) => {
      setQueue(queue);
      router.push({ pathname: '/player/[id]', params: { id: stream.id } });
    },
    [setQueue],
  );
}
```

- [ ] **Step 6: Wrap the layout**

In `mobile_app/app/_layout.tsx`:
- add `import { CatalogProvider } from '../src/catalog/CatalogProvider';`
- replace the returned fragment `<>…</>` with:

```tsx
    <CatalogProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.ink },
          orientation: 'portrait',
          animation: 'fade',
        }}
      >
        {/* Only the player may rotate. */}
        <Stack.Screen name="player/[id]" options={{ orientation: 'all', presentation: 'fullScreenModal' }} />
      </Stack>
    </CatalogProvider>
```

- [ ] **Step 7: Typecheck and commit**

Run from `mobile_app/`: `npm run typecheck && npm test`
Expected: clean, with 7 tests passing. (The player route file doesn't exist until Task 6. expo-router only warns about the extra `Stack.Screen` name at runtime, and `tsc` is unaffected.)

```bash
git add mobile_app/src/catalog mobile_app/app/_layout.tsx
git commit -m "Add catalog cache and provider to the mobile app"
```

---

### Task 4: Components and the Home screen

**Files:**
- Create: `mobile_app/src/components/ChannelLogo.tsx`, `ChannelCard.tsx`, `Chip.tsx`, `NoSignal.tsx`, `FilterSheet.tsx`, `Tuner.tsx`, `Rail.tsx`
- Modify: `mobile_app/app/index.tsx` (replace the placeholder)

**Interfaces:**
- Consumes: `useCatalog()` and `usePlay()` (Task 3); `colors`, `fonts` (Task 2); `channelNumber`, `countryName`, `countryInSentence`, `formatCount`, `primaryCategory` from `@shared/lib/format`; `homeRails` from `@shared/lib/selectors`.
- Produces (used by Tasks 5–6):
  - `ChannelCard({ stream, onPress, width? })`
  - `NoSignal({ title?, message, detail?, actions: { label: string; onPress: () => void; primary?: boolean }[] })`
  - `Chip({ label, count?, active?, onPress })`
  - `FilterSheet({ visible, title, options: { value: string; label: string; count?: number }[], selected, onSelect, onClose })`
  - Browse route params: `{ categoryId?: string; query?: string }` at pathname `/browse`.

- [ ] **Step 1: ChannelLogo**

Create `mobile_app/src/components/ChannelLogo.tsx`:

```tsx
import { useState } from 'react';
import { Image, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, fonts } from '../theme';

function initials(name: string) {
  const words = name.split(/\s+/).map((w) => w.replace(/^[^\w\u00C0-\uFFFF]+/, '')).filter(Boolean);
  const letters = words.length > 1 ? [...words[0]][0] + [...words[1]][0] : [...(words[0] ?? '?')].slice(0, 2).join('');
  return letters.toUpperCase();
}

interface ChannelLogoProps {
  uri: string;
  name: string;
  monogramSize?: number;
  style?: StyleProp<ViewStyle>;
}

/** Logos are mostly transparent marks, so they sit contained; a monogram stands in when one is missing or broken. */
export function ChannelLogo({ uri, name, monogramSize = 28, style }: ChannelLogoProps) {
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const showImage = Boolean(uri) && failedUri !== uri;

  return (
    <View style={[styles.box, style]}>
      {showImage ? (
        <Image
          source={{ uri }}
          style={styles.image}
          resizeMode="contain"
          onError={() => setFailedUri(uri)}
          accessibilityIgnoresInvertColors
        />
      ) : (
        <Text style={[styles.monogram, { fontSize: monogramSize }]} importantForAccessibility="no">
          {initials(name)}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  image: { width: '100%', height: '100%' },
  monogram: { fontFamily: fonts.display, color: colors.dim, opacity: 0.7 },
});
```

- [ ] **Step 2: ChannelCard, Chip, NoSignal**

Create `mobile_app/src/components/ChannelCard.tsx`:

```tsx
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Stream } from '@shared/types';
import { channelNumber, countryName, primaryCategory } from '@shared/lib/format';
import { colors, fonts } from '../theme';
import { ChannelLogo } from './ChannelLogo';

interface ChannelCardProps {
  stream: Stream;
  onPress: (stream: Stream) => void;
  /** Fixed width for horizontal rails; grids let the card fill its cell. */
  width?: number;
}

export function ChannelCard({ stream, onPress, width }: ChannelCardProps) {
  return (
    <Pressable
      onPress={() => onPress(stream)}
      accessibilityRole="button"
      accessibilityLabel={`Watch ${stream.title}`}
      style={({ pressed }) => [width ? { width } : styles.fill, pressed && styles.pressed]}
    >
      <View style={styles.plate}>
        <Text style={styles.number}>CH {channelNumber(stream.number)}</Text>
        {stream.channel_country ? <Text style={styles.country}>{stream.channel_country}</Text> : null}
        <ChannelLogo uri={stream.logo} name={stream.title} style={styles.logo} monogramSize={26} />
      </View>
      <Text numberOfLines={1} style={styles.title}>
        {stream.title}
      </Text>
      <Text numberOfLines={1} style={styles.meta}>
        {primaryCategory(stream.channel_categories)} · {countryName(stream.channel_country)}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  pressed: { opacity: 0.75 },
  plate: {
    aspectRatio: 16 / 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panel,
  },
  number: { position: 'absolute', top: 7, left: 9, fontFamily: fonts.mono, fontSize: 9, color: colors.dim },
  country: { position: 'absolute', top: 7, right: 9, fontFamily: fonts.mono, fontSize: 9, color: colors.dim },
  logo: { position: 'absolute', left: 20, right: 20, top: 24, bottom: 14 },
  title: { marginTop: 8, fontFamily: fonts.sansSemiBold, fontSize: 14, color: colors.paper },
  meta: { fontFamily: fonts.sans, fontSize: 12, color: colors.dim },
});
```

Create `mobile_app/src/components/Chip.tsx`:

```tsx
import { Pressable, StyleSheet, Text } from 'react-native';
import { formatCount } from '@shared/lib/format';
import { colors, fonts } from '../theme';

interface ChipProps {
  label: string;
  count?: number;
  active?: boolean;
  onPress: () => void;
}

export function Chip({ label, count, active = false, onPress }: ChipProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={({ pressed }) => [styles.chip, active && styles.active, pressed && styles.pressed]}
    >
      <Text style={[styles.label, active && styles.labelActive]}>{label}</Text>
      {count !== undefined ? <Text style={[styles.count, active && styles.countActive]}>{formatCount(count)}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.line,
  },
  active: { backgroundColor: colors.amber, borderColor: colors.amber },
  pressed: { opacity: 0.8 },
  label: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.paper },
  labelActive: { color: colors.ink },
  count: { fontFamily: fonts.mono, fontSize: 10, color: colors.dim },
  countActive: { color: colors.ink },
});
```

Create `mobile_app/src/components/NoSignal.tsx`:

```tsx
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, fonts } from '../theme';

interface NoSignalAction {
  label: string;
  onPress: () => void;
  primary?: boolean;
}

interface NoSignalProps {
  title?: string;
  message: string;
  detail?: string;
  actions: NoSignalAction[];
  style?: StyleProp<ViewStyle>;
}

export function NoSignal({ title, message, detail, actions, style }: NoSignalProps) {
  return (
    <View style={[styles.box, style]}>
      <Text style={styles.eyebrow}>No signal</Text>
      {title ? <Text style={styles.title}>{title}</Text> : null}
      <Text style={styles.message}>{message}</Text>
      {detail ? <Text style={styles.detail}>{detail}</Text> : null}
      <View style={styles.actions}>
        {actions.map((action) => (
          <Pressable
            key={action.label}
            onPress={action.onPress}
            accessibilityRole="button"
            style={({ pressed }) => [styles.button, action.primary && styles.primary, pressed && styles.pressed]}
          >
            <Text style={[styles.buttonLabel, action.primary && styles.primaryLabel]}>{action.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: 'center', justifyContent: 'center', padding: 24 },
  eyebrow: { fontFamily: fonts.mono, fontSize: 11, letterSpacing: 2, color: colors.onair, textTransform: 'uppercase' },
  title: {
    marginTop: 10,
    fontFamily: fonts.display,
    fontSize: 32,
    lineHeight: 34,
    color: colors.paper,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  message: { marginTop: 10, maxWidth: 420, fontFamily: fonts.sans, fontSize: 15, color: colors.paper, textAlign: 'center' },
  detail: { marginTop: 6, fontFamily: fonts.mono, fontSize: 11, color: colors.dim, textAlign: 'center' },
  actions: { flexDirection: 'row', gap: 12, marginTop: 22 },
  button: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 20,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.line,
  },
  primary: { backgroundColor: colors.amber, borderColor: colors.amber },
  pressed: { opacity: 0.8 },
  buttonLabel: { fontFamily: fonts.sansSemiBold, fontSize: 14, color: colors.paper },
  primaryLabel: { color: colors.ink },
});
```

- [ ] **Step 3: FilterSheet**

Create `mobile_app/src/components/FilterSheet.tsx`:

```tsx
import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { formatCount } from '@shared/lib/format';
import { colors, fonts } from '../theme';

export interface FilterOption {
  value: string;
  label: string;
  count?: number;
}

interface FilterSheetProps {
  visible: boolean;
  title: string;
  options: FilterOption[];
  selected: string;
  onSelect: (value: string) => void;
  onClose: () => void;
}

/** Bottom sheet picker with a type-to-filter field (lists run to ~200 entries). */
export function FilterSheet({ visible, title, options, selected, onSelect, onClose }: FilterSheetProps) {
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState('');
  const shown = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;
  }, [options, filter]);

  const close = () => {
    setFilter('');
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close} statusBarTranslucent>
      <View style={styles.container}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel={`Close ${title} picker`} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 12 }]}>
          <View style={styles.grabber} />
          <Text style={styles.title}>{title}</Text>
          <TextInput
            value={filter}
            onChangeText={setFilter}
            placeholder={`Find a ${title.toLowerCase()}`}
            placeholderTextColor={colors.dim}
            style={styles.input}
            autoCorrect={false}
            autoCapitalize="none"
            clearButtonMode="while-editing"
          />
          <FlatList
            data={shown}
            keyExtractor={(o) => o.value}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => {
              const active = item.value === selected;
              return (
                <Pressable
                  onPress={() => {
                    onSelect(item.value);
                    close();
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                >
                  <Text style={[styles.label, active && styles.labelActive]} numberOfLines={1}>
                    {item.label}
                  </Text>
                  {item.count !== undefined ? <Text style={styles.count}>{formatCount(item.count)}</Text> : null}
                  {active ? <Ionicons name="checkmark" size={18} color={colors.amber} /> : null}
                </Pressable>
              );
            }}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: {
    maxHeight: '78%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panel,
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.line, marginBottom: 12 },
  title: { fontFamily: fonts.display, fontSize: 26, color: colors.paper, textTransform: 'uppercase' },
  input: {
    marginTop: 10,
    marginBottom: 6,
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.ink,
    color: colors.paper,
    fontFamily: fonts.sans,
    fontSize: 15,
  },
  row: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 4 },
  rowPressed: { backgroundColor: colors.raised },
  label: { flex: 1, fontFamily: fonts.sans, fontSize: 15, color: colors.paper },
  labelActive: { fontFamily: fonts.sansSemiBold, color: colors.amber },
  count: { fontFamily: fonts.mono, fontSize: 11, color: colors.dim },
});
```

- [ ] **Step 4: Tuner and Rail**

Create `mobile_app/src/components/Tuner.tsx`:

```tsx
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { Stream } from '@shared/types';
import { channelNumber, countryName, formatCount, primaryCategory } from '@shared/lib/format';
import { colors, fonts } from '../theme';
import { ChannelLogo } from './ChannelLogo';

const ROLL_STEPS = 12;
const ROLL_INTERVAL_MS = 55;

function pick(pool: Stream[], avoid?: Stream | null) {
  if (pool.length === 0) return null;
  if (pool.length === 1) return pool[0];
  let next = pool[Math.floor(Math.random() * pool.length)];
  while (next.id === avoid?.id) next = pool[Math.floor(Math.random() * pool.length)];
  return next;
}

interface TunerProps {
  pool: Stream[];
  totalChannels: number;
  totalCountries: number;
  countryLabel: string | null;
  onWatch: (stream: Stream) => void;
}

/** The hero: a tuner readout parked on a random channel. "Surf" rolls the dial and lands somewhere new. */
export function Tuner({ pool, totalChannels, totalCountries, countryLabel, onWatch }: TunerProps) {
  const [current, setCurrent] = useState<Stream | null>(() => pick(pool));
  const [rollingNumber, setRollingNumber] = useState<number | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const busy = useRef(false);

  // Re-tune when the pool changes (e.g. another country).
  useEffect(() => {
    setCurrent((previous) => (previous && pool.some((s) => s.id === previous.id) ? previous : pick(pool)));
  }, [pool]);

  useEffect(() => () => clearInterval(timer.current), []);

  const surf = async () => {
    if (busy.current || pool.length < 2) return;
    const target = pick(pool, current);
    if (!target) return;
    busy.current = true;
    if (await AccessibilityInfo.isReduceMotionEnabled()) {
      setCurrent(target);
      busy.current = false;
      return;
    }
    const max = pool[pool.length - 1].number;
    let step = 0;
    setRollingNumber(current?.number ?? 1);
    timer.current = setInterval(() => {
      step += 1;
      if (step >= ROLL_STEPS) {
        clearInterval(timer.current);
        setRollingNumber(null);
        setCurrent(target);
        busy.current = false;
        return;
      }
      setRollingNumber(1 + Math.floor(Math.random() * max));
    }, ROLL_INTERVAL_MS);
  };

  const rolling = rollingNumber !== null;
  const shownNumber = rollingNumber ?? current?.number ?? 0;

  return (
    <View style={styles.section}>
      <View style={styles.eyebrow}>
        <View style={styles.dot} />
        <Text style={[styles.eyebrowText, { color: colors.onair }]}>On air</Text>
        <Text style={styles.eyebrowText}>{formatCount(totalChannels)} channels</Text>
        <Text style={styles.eyebrowText}>·</Text>
        <Text style={styles.eyebrowText}>{countryLabel ?? `${formatCount(totalCountries)} countries`}</Text>
      </View>
      <Text style={styles.headline}>Tune in to</Text>
      <Text style={[styles.headline, styles.headlineAccent]}>{countryLabel ?? 'the world'}.</Text>

      <View style={styles.panel}>
        <View style={styles.panelTop}>
          <View>
            <Text style={styles.label}>Tuned to</Text>
            <Text
              style={[styles.readout, rolling && styles.readoutRolling]}
              accessibilityLabel={`Channel ${shownNumber}`}
              accessibilityLiveRegion="polite"
            >
              {channelNumber(shownNumber)}
            </Text>
          </View>
          <ChannelLogo
            uri={rolling ? '' : (current?.logo ?? '')}
            name={rolling ? '··' : (current?.title ?? '')}
            style={styles.logoPlate}
            monogramSize={22}
          />
        </View>
        <View style={styles.divider} />
        {current ? (
          <View style={rolling ? styles.dimmed : undefined}>
            <Text style={styles.title} numberOfLines={1}>
              {current.title}
            </Text>
            <Text style={styles.meta}>
              {primaryCategory(current.channel_categories)} · {countryName(current.channel_country)}
            </Text>
          </View>
        ) : (
          <Text style={styles.meta}>No channels to tune to. Try another country.</Text>
        )}
        <View style={styles.buttons}>
          <Pressable
            onPress={() => current && onWatch(current)}
            disabled={!current || rolling}
            accessibilityRole="button"
            style={({ pressed }) => [styles.watch, (pressed || !current || rolling) && styles.pressed]}
          >
            <Ionicons name="play" size={16} color={colors.ink} />
            <Text style={styles.watchLabel}>Watch</Text>
          </Pressable>
          <Pressable
            onPress={surf}
            disabled={pool.length < 2 || rolling}
            accessibilityRole="button"
            style={({ pressed }) => [styles.surf, (pressed || rolling) && styles.pressed]}
          >
            <Ionicons name="shuffle" size={16} color={colors.paper} />
            <Text style={styles.surfLabel}>Surf</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { paddingHorizontal: 16, paddingTop: 18, paddingBottom: 12 },
  eyebrow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 12 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.onair },
  eyebrowText: { fontFamily: fonts.mono, fontSize: 10, letterSpacing: 1, color: colors.dim, textTransform: 'uppercase' },
  headline: { fontFamily: fonts.displayBlack, fontSize: 56, lineHeight: 52, color: colors.paper, textTransform: 'uppercase' },
  headlineAccent: { color: colors.amber },
  panel: {
    marginTop: 22,
    padding: 18,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panel,
  },
  panelTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  label: { fontFamily: fonts.mono, fontSize: 10, letterSpacing: 2, color: colors.dim, textTransform: 'uppercase' },
  readout: { marginTop: 4, fontFamily: fonts.monoSemiBold, fontSize: 52, lineHeight: 60, color: colors.amber },
  readoutRolling: { opacity: 0.6 },
  logoPlate: {
    width: 76,
    height: 76,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.raised,
  },
  divider: { height: 1, backgroundColor: colors.line, marginVertical: 16 },
  dimmed: { opacity: 0.3 },
  title: { fontFamily: fonts.display, fontSize: 30, lineHeight: 32, color: colors.paper, textTransform: 'uppercase' },
  meta: { marginTop: 4, fontFamily: fonts.sans, fontSize: 13, color: colors.dim },
  buttons: { flexDirection: 'row', gap: 12, marginTop: 18 },
  watch: {
    flex: 1,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 999,
    backgroundColor: colors.amber,
  },
  watchLabel: { fontFamily: fonts.sansSemiBold, fontSize: 15, color: colors.ink },
  surf: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 22,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.line,
  },
  surfLabel: { fontFamily: fonts.sansSemiBold, fontSize: 15, color: colors.paper },
  pressed: { opacity: 0.6 },
});
```

Create `mobile_app/src/components/Rail.tsx`:

```tsx
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Stream } from '@shared/types';
import { formatCount } from '@shared/lib/format';
import { colors, fonts } from '../theme';
import { ChannelCard } from './ChannelCard';

const CARD_WIDTH = 164;

interface RailProps {
  title: string;
  streams: Stream[];
  total?: number;
  onSelect: (stream: Stream) => void;
  onSeeAll?: () => void;
}

/** One horizontal row of channels on the home screen (at most 16, so no virtualization needed). */
export function Rail({ title, streams, total, onSelect, onSeeAll }: RailProps) {
  return (
    <View style={styles.section}>
      <View style={styles.head}>
        <Text style={styles.title}>{title}</Text>
        {onSeeAll ? (
          <Pressable onPress={onSeeAll} hitSlop={12} accessibilityRole="button" accessibilityLabel={`See all ${title}`}>
            <Text style={styles.seeAll}>
              See all{total ? <Text style={styles.total}> {formatCount(total)}</Text> : null} →
            </Text>
          </Pressable>
        ) : null}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {streams.map((stream) => (
          <ChannelCard key={stream.id} stream={stream} onPress={onSelect} width={CARD_WIDTH} />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { paddingVertical: 14 },
  head: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  title: { fontFamily: fonts.display, fontSize: 26, lineHeight: 28, color: colors.paper, textTransform: 'uppercase' },
  seeAll: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.dim },
  total: { fontFamily: fonts.mono, fontSize: 11 },
  row: { gap: 12, paddingHorizontal: 16 },
});
```

- [ ] **Step 5: Home screen**

Replace `mobile_app/app/index.tsx` with:

```tsx
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { countryInSentence, countryName, formatCount } from '@shared/lib/format';
import { homeRails } from '@shared/lib/selectors';
import { useCatalog } from '../src/catalog/CatalogProvider';
import { usePlay } from '../src/catalog/usePlay';
import { Chip } from '../src/components/Chip';
import { FilterSheet, type FilterOption } from '../src/components/FilterSheet';
import { NoSignal } from '../src/components/NoSignal';
import { Rail } from '../src/components/Rail';
import { Tuner } from '../src/components/Tuner';
import { colors, fonts } from '../src/theme';

const HOME_CATEGORIES = 6;
const RAIL_SIZE = 16;

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { load, retry, pool, countries, country, setCountry, languages, language, setLanguage, categories } = useCatalog();
  const play = usePlay();
  const [query, setQuery] = useState('');
  const [sheet, setSheet] = useState<'country' | 'language' | null>(null);

  const rails = useMemo(() => homeRails(pool, categories, HOME_CATEGORIES, RAIL_SIZE), [pool, categories]);
  const tunerPool = useMemo(() => {
    const withLogos = pool.filter((s) => s.logo);
    return withLogos.length ? withLogos : pool;
  }, [pool]);
  const countrySheetOptions = useMemo<FilterOption[]>(
    () => [
      { value: 'All', label: 'All countries' },
      ...countries.map((c) => ({ value: c.code, label: countryName(c.code), count: c.count })),
    ],
    [countries],
  );
  const languageSheetOptions = useMemo<FilterOption[]>(
    () => [{ value: 'All', label: 'All languages' }, ...languages.map((l) => ({ value: l.code, label: l.name, count: l.count }))],
    [languages],
  );

  if (load.status === 'loading') {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.amber} />
        <Text style={styles.scanning}>Scanning for channels…</Text>
      </View>
    );
  }

  if (load.status === 'error') {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <NoSignal
          title="The channel list didn't load"
          message={`${load.message} Check your connection and try again.`}
          actions={[{ label: 'Try again', onPress: retry, primary: true }]}
        />
      </View>
    );
  }

  const place = country === 'All' ? null : countryInSentence(country);
  const openBrowse = (params: { categoryId?: string; query?: string }) => router.push({ pathname: '/browse', params });
  const languageName = languages.find((l) => l.code === language)?.name;

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 10, paddingBottom: insets.bottom + 32 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <View style={styles.brand}>
            <Text style={styles.wordmark}>Electrohm</Text>
            <Text style={styles.tag}>HAUS TV</Text>
          </View>
          <View style={styles.search}>
            <Ionicons name="search" size={16} color={colors.dim} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={() => query.trim() && openBrowse({ query: query.trim() })}
              placeholder="Search channels"
              placeholderTextColor={colors.dim}
              returnKeyType="search"
              autoCorrect={false}
              autoCapitalize="none"
              style={styles.searchInput}
              accessibilityLabel="Search channels"
            />
          </View>
          <View style={styles.filters}>
            <FilterButton
              label={country === 'All' ? 'All countries' : countryName(country)}
              active={country !== 'All'}
              onPress={() => setSheet('country')}
              accessibilityLabel="Choose country"
            />
            <FilterButton
              label={languageName ?? 'All languages'}
              active={language !== 'All'}
              onPress={() => setSheet('language')}
              accessibilityLabel="Choose language"
            />
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          <Chip label="All channels" count={pool.length} onPress={() => openBrowse({})} />
          {categories.map((c) => (
            <Chip key={c.id} label={c.name} count={c.count} onPress={() => openBrowse({ categoryId: c.id })} />
          ))}
        </ScrollView>

        <Tuner
          pool={tunerPool}
          totalChannels={pool.length}
          totalCountries={countries.length}
          countryLabel={place}
          onWatch={(stream) => play(stream, tunerPool)}
        />

        <View style={styles.rails}>
          {rails.map(({ category, streams }) => (
            <Rail
              key={category.id}
              title={category.name}
              streams={streams}
              total={category.count}
              onSelect={(stream) => play(stream, streams)}
              onSeeAll={() => openBrowse({ categoryId: category.id })}
            />
          ))}
        </View>

        <Pressable
          onPress={() => openBrowse({})}
          accessibilityRole="button"
          style={({ pressed }) => [styles.browseAll, pressed && styles.pressed]}
        >
          <Text style={styles.browseAllLabel}>
            Browse all {formatCount(pool.length)} channels{place ? ` from ${place}` : ''}
          </Text>
        </Pressable>
      </ScrollView>

      <FilterSheet
        visible={sheet === 'country'}
        title="Country"
        options={countrySheetOptions}
        selected={country}
        onSelect={setCountry}
        onClose={() => setSheet(null)}
      />
      <FilterSheet
        visible={sheet === 'language'}
        title="Language"
        options={languageSheetOptions}
        selected={language}
        onSelect={setLanguage}
        onClose={() => setSheet(null)}
      />
    </View>
  );
}

function FilterButton({
  label,
  active,
  onPress,
  accessibilityLabel,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  accessibilityLabel: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${accessibilityLabel}: ${label}`}
      style={({ pressed }) => [styles.filterButton, active && styles.filterActive, pressed && styles.pressed]}
    >
      <Text style={styles.filterLabel} numberOfLines={1}>
        {label}
      </Text>
      <Ionicons name="chevron-down" size={14} color={colors.dim} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ink },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.ink },
  scanning: { marginTop: 16, fontFamily: fonts.mono, fontSize: 11, letterSpacing: 2, color: colors.dim, textTransform: 'uppercase' },
  header: { paddingHorizontal: 16, gap: 12 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  wordmark: { fontFamily: fonts.display, fontSize: 28, color: colors.paper, textTransform: 'uppercase' },
  tag: {
    overflow: 'hidden',
    borderRadius: 3,
    backgroundColor: colors.amber,
    paddingHorizontal: 6,
    paddingVertical: 2,
    fontFamily: fonts.monoSemiBold,
    fontSize: 9,
    letterSpacing: 2,
    color: colors.ink,
  },
  search: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panel,
  },
  searchInput: { flex: 1, minHeight: 44, color: colors.paper, fontFamily: fonts.sans, fontSize: 15 },
  filters: { flexDirection: 'row', gap: 8 },
  filterButton: {
    flex: 1,
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panel,
  },
  filterActive: { borderColor: colors.amber },
  filterLabel: { flexShrink: 1, fontFamily: fonts.sansMedium, fontSize: 13, color: colors.paper },
  chips: { gap: 8, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4 },
  rails: { borderTopWidth: 1, borderTopColor: colors.line, marginTop: 8, paddingTop: 8 },
  browseAll: {
    minHeight: 48,
    marginHorizontal: 16,
    marginTop: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.line,
  },
  browseAllLabel: { fontFamily: fonts.sansSemiBold, fontSize: 14, color: colors.paper },
  pressed: { opacity: 0.7 },
});
```

- [ ] **Step 6: Typecheck, test, bundle**

Run from `mobile_app/`: `npm run typecheck && npm test && npx expo export --platform android --output-dir dist`
Expected: all pass, and no unresolved modules. Delete `mobile_app/dist`.

(Browse and Player routes don't exist yet. Tapping a chip or card before Tasks 5–6 lands on expo-router's "Unmatched route" screen; that is expected at this point.)

- [ ] **Step 7: Commit**

```bash
git add mobile_app/src/components mobile_app/app/index.tsx
git commit -m "Add mobile Home screen with tuner, rails and filters"
```

---

### Task 5: Browse screen

**Files:**
- Create: `mobile_app/app/browse.tsx`

**Interfaces:**
- Consumes: `useCatalog()`, `usePlay()` (Task 3); `ChannelCard`, `NoSignal` (Task 4); `filterStreams` from `@shared/lib/selectors`; `countryName`, `countryInSentence`, `formatCount` from `@shared/lib/format`. Params `{ categoryId?: string; query?: string }`.
- Produces: the route `/browse`.

- [ ] **Step 1: Implement**

Create `mobile_app/app/browse.tsx`:

```tsx
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { FlashList } from '@shopify/flash-list';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { countryInSentence, countryName, formatCount } from '@shared/lib/format';
import { filterStreams } from '@shared/lib/selectors';
import { useCatalog } from '../src/catalog/CatalogProvider';
import { usePlay } from '../src/catalog/usePlay';
import { ChannelCard } from '../src/components/ChannelCard';
import { colors, fonts } from '../src/theme';

const GAP = 12;
const SIDE = 16;

function columnsFor(width: number) {
  if (width < 600) return 2;
  if (width < 900) return 3;
  return 4;
}

export default function BrowseScreen() {
  const params = useLocalSearchParams<{ categoryId?: string; query?: string }>();
  const categoryId = params.categoryId || 'all';
  const query = (params.query ?? '').trim();
  const { pool, categories, country, setCountry, languages, language, setLanguage } = useCatalog();
  const play = usePlay();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const streams = useMemo(() => filterStreams(pool, categoryId, query), [pool, categoryId, query]);
  const category = categories.find((c) => c.id === categoryId);
  const columns = columnsFor(width);
  const place = country === 'All' ? null : countryInSentence(country);
  const languageName = languages.find((l) => l.code === language)?.name;

  const title = query ? `“${query}”` : (category?.name ?? (country === 'All' ? 'All channels' : countryName(country)));
  const emptyMessage = `No channels match${query ? ` “${query}”` : ''}${category ? ` in ${category.name}` : ''}${
    languageName ? ` in ${languageName}` : ''
  }${place ? ` from ${place}` : ''}. Check the spelling or clear the filters.`;

  const clearFilters = () => {
    setCountry('All');
    setLanguage('All');
    router.back();
  };

  return (
    <View style={styles.screen}>
      <FlashList
        key={columns}
        data={streams}
        numColumns={columns}
        keyExtractor={(s) => s.id}
        contentContainerStyle={{ paddingHorizontal: SIDE - GAP / 2, paddingBottom: insets.bottom + 24 }}
        ListHeaderComponent={
          <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
            <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Back to home" style={styles.back}>
              <Ionicons name="arrow-back" size={18} color={colors.dim} />
              <Text style={styles.backLabel}>Home</Text>
            </Pressable>
            <Text style={styles.title} numberOfLines={2}>
              {title}
            </Text>
            <Text style={styles.count}>
              {formatCount(streams.length)} {streams.length === 1 ? 'channel' : 'channels'}
            </Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>{emptyMessage}</Text>
            <Pressable onPress={clearFilters} accessibilityRole="button" style={({ pressed }) => [styles.clear, pressed && styles.pressed]}>
              <Text style={styles.clearLabel}>Clear filters</Text>
            </Pressable>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.cell}>
            <ChannelCard stream={item} onPress={(s) => play(s, streams)} />
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ink },
  header: { paddingHorizontal: GAP / 2, paddingBottom: 18 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, alignSelf: 'flex-start' },
  backLabel: { fontFamily: fonts.sansMedium, fontSize: 14, color: colors.dim },
  title: {
    marginTop: 6,
    fontFamily: fonts.displayBlack,
    fontSize: 40,
    lineHeight: 40,
    color: colors.paper,
    textTransform: 'uppercase',
  },
  count: {
    marginTop: 8,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1,
    color: colors.dim,
    textTransform: 'uppercase',
  },
  cell: { flex: 1, paddingHorizontal: GAP / 2, paddingBottom: 20 },
  empty: { alignItems: 'center', paddingVertical: 80, paddingHorizontal: 24 },
  emptyText: { fontFamily: fonts.sans, fontSize: 15, color: colors.dim, textAlign: 'center' },
  clear: {
    marginTop: 18,
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 20,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.line,
  },
  clearLabel: { fontFamily: fonts.sansSemiBold, fontSize: 14, color: colors.paper },
  pressed: { opacity: 0.7 },
});
```

- [ ] **Step 2: Typecheck, test, bundle**

Run from `mobile_app/`: `npm run typecheck && npm test && npx expo export --platform android --output-dir dist`
Expected: all pass. Delete `mobile_app/dist`.

- [ ] **Step 3: Commit**

```bash
git add mobile_app/app/browse.tsx
git commit -m "Add mobile Browse grid"
```

---

### Task 6: Player screen

**Files:**
- Create: `mobile_app/src/player/source.ts`, `mobile_app/app/player/[id].tsx`
- Test: `mobile_app/src/player/source.test.ts`

**Interfaces:**
- Consumes: `useCatalog()` (`load`, `findStream`, `queue`, `pool`) (Task 3); `NoSignal` (Task 4); `channelNumber` from `@shared/lib/format`; `Stream` from `@shared/types`; expo-video `useVideoPlayer`, `VideoView`, `VideoSource`; `useEvent`, `useEventListener` from `expo`.
- Produces: `videoSource(stream: Stream, url: string): VideoSource`; the route `/player/[id]`.

- [ ] **Step 1: Write the failing test**

Create `mobile_app/src/player/source.test.ts`:

```ts
import { describe, expect, it } from '@jest/globals';
import type { Stream } from '@shared/types';
import { videoSource } from './source';

const base = {
  id: 'x@SD',
  number: 1,
  channel: 'x',
  feed: 'SD',
  title: 'X',
  url: 'https://a.test/live.m3u8',
  sources: ['https://a.test/live.m3u8'],
  quality: null,
  label: null,
  user_agent: null,
  referrer: null,
  logo: '',
  channel_country: null,
  channel_category_ids: [],
  channel_categories: null,
  channel_name: null,
  channel_is_nsfw: false,
  languages: [],
} satisfies Stream;

describe('videoSource', () => {
  it('plays HLS without headers by default', () => {
    expect(videoSource(base, 'https://a.test/live.m3u8')).toEqual({ uri: 'https://a.test/live.m3u8', contentType: 'hls' });
  });

  it('treats extensionless URLs as HLS', () => {
    expect(videoSource(base, 'https://a.test/stream?token=1')).toMatchObject({ contentType: 'hls' });
  });

  it('marks progressive files', () => {
    expect(videoSource(base, 'https://a.test/clip.mp4?x=1')).toMatchObject({ contentType: 'progressive' });
  });

  it('sends the stream user agent and referrer', () => {
    const stream = { ...base, user_agent: 'Mozilla/5.0 X', referrer: 'https://site.test/' };
    expect(videoSource(stream, stream.url)).toEqual({
      uri: stream.url,
      contentType: 'hls',
      headers: { 'User-Agent': 'Mozilla/5.0 X', Referer: 'https://site.test/' },
    });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run from `mobile_app/`: `npm test`
Expected: FAIL, "Cannot find module './source'".

- [ ] **Step 3: Implement `videoSource`**

Create `mobile_app/src/player/source.ts`:

```ts
import type { VideoSource } from 'expo-video';
import type { Stream } from '@shared/types';

const PROGRESSIVE_FILE = /\.(mp4|m4v|webm|mp3|aac)(\?|$)/i;

/**
 * Native players can send the headers some broadcasters require, which browsers can't.
 * iOS needs contentType 'hls' for playlist URLs without a .m3u8 extension.
 */
export function videoSource(stream: Stream, url: string): VideoSource {
  const headers: Record<string, string> = {};
  if (stream.user_agent) headers['User-Agent'] = stream.user_agent;
  if (stream.referrer) headers.Referer = stream.referrer;
  return {
    uri: url,
    contentType: PROGRESSIVE_FILE.test(url) ? 'progressive' : 'hls',
    ...(Object.keys(headers).length ? { headers } : {}),
  };
}
```

- [ ] **Step 4: Run to verify it passes**

Run from `mobile_app/`: `npm test`
Expected: PASS, 11 tests.

- [ ] **Step 5: Player screen**

Create `mobile_app/app/player/[id].tsx`:

```tsx
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEvent, useEventListener } from 'expo';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { channelNumber } from '@shared/lib/format';
import { useCatalog } from '../../src/catalog/CatalogProvider';
import { NoSignal } from '../../src/components/NoSignal';
import { videoSource } from '../../src/player/source';
import { colors, fonts } from '../../src/theme';

const HIDE_CONTROLS_MS = 4000;
const OFFLINE_MESSAGE = "This channel isn't responding. It may be off air or blocked in your region.";

export default function PlayerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { load, findStream, queue, pool } = useCatalog();
  const stream = id ? findStream(id) : undefined;
  const insets = useSafeAreaInsets();

  const player = useVideoPlayer(null, (p) => {
    p.keepScreenOnWhilePlaying = true;
  });
  const { status } = useEvent(player, 'statusChange', { status: player.status });
  const { isPlaying } = useEvent(player, 'playingChange', { isPlaying: player.playing });

  // Which backup source is playing, scoped to the channel so a new channel starts at its best source.
  const [source, setSource] = useState({ streamId: '', index: 0 });
  const [retryKey, setRetryKey] = useState(0);
  const [failed, setFailed] = useState(false);
  const [muted, setMuted] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const sourceIndex = stream && source.streamId === stream.id ? source.index : 0;
  const sourceCount = stream?.sources.length ?? 0;

  // A stale link or refreshed catalog can point at a channel that no longer exists.
  useEffect(() => {
    if (load.status === 'ready' && !stream) router.replace('/');
  }, [load.status, stream]);

  const advance = useCallback(() => {
    if (!stream) return;
    if (sourceIndex + 1 < stream.sources.length) setSource({ streamId: stream.id, index: sourceIndex + 1 });
    else setFailed(true);
  }, [stream, sourceIndex]);
  // Player events outlive renders; always call the latest advance.
  const advanceRef = useRef(advance);
  advanceRef.current = advance;

  useEffect(() => {
    if (!stream) return;
    let cancelled = false;
    setFailed(false);
    player
      .replaceAsync(videoSource(stream, stream.sources[sourceIndex] ?? stream.url))
      .then(() => {
        if (!cancelled) player.play();
      })
      .catch(() => {
        if (!cancelled) advanceRef.current();
      });
    return () => {
      cancelled = true;
    };
  }, [player, stream?.id, sourceIndex, retryKey]);

  useEventListener(player, 'statusChange', ({ status: next }) => {
    if (next === 'error') advanceRef.current();
  });

  useEffect(() => {
    player.muted = muted;
  }, [player, muted]);

  const showControls = useCallback(() => {
    setControlsVisible(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setControlsVisible(false), HIDE_CONTROLS_MS);
  }, []);

  useEffect(() => {
    showControls();
    return () => clearTimeout(hideTimer.current);
  }, [showControls, stream?.id]);

  const list = queue.length ? queue : pool;
  const step = (direction: 1 | -1) => {
    if (!stream || list.length === 0) return;
    const index = list.findIndex((s) => s.id === stream.id);
    const next = list[(index + direction + list.length) % list.length];
    router.setParams({ id: next.id });
    showControls();
  };

  const retry = () => {
    if (!stream) return;
    setSource({ streamId: stream.id, index: 0 });
    setRetryKey((k) => k + 1);
  };

  const togglePlay = () => {
    if (isPlaying) player.pause();
    else player.play();
    showControls();
  };

  if (!stream) {
    return (
      <View style={[styles.screen, styles.center]}>
        <ActivityIndicator size="large" color={colors.amber} />
      </View>
    );
  }

  const showOverlay = controlsVisible || failed;

  return (
    <View style={styles.screen}>
      <StatusBar hidden />
      <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="contain" nativeControls={false} />
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={() => (controlsVisible ? setControlsVisible(false) : showControls())}
        accessibilityLabel={controlsVisible ? 'Hide controls' : 'Show controls'}
      />

      {status === 'loading' && !failed ? (
        <View style={[StyleSheet.absoluteFill, styles.center, { pointerEvents: 'none' }]}>
          <ActivityIndicator size="large" color={colors.amber} accessibilityLabel="Tuning in" />
          {sourceIndex > 0 ? (
            <Text style={styles.backup}>
              Trying backup stream {sourceIndex + 1} of {sourceCount}
            </Text>
          ) : null}
        </View>
      ) : null}

      {failed ? (
        <NoSignal
          style={[StyleSheet.absoluteFill, styles.failed]}
          message={OFFLINE_MESSAGE}
          detail={sourceCount > 1 ? `All ${sourceCount} streams for this channel failed.` : undefined}
          actions={[
            { label: 'Try again', onPress: retry },
            { label: 'Next channel', onPress: () => step(1), primary: true },
          ]}
        />
      ) : null}

      {showOverlay ? (
        <>
          <View style={[styles.topBar, { paddingTop: insets.top + 8, paddingLeft: insets.left + 12, paddingRight: insets.right + 12 }]}>
            <IconButton name="arrow-back" label="Close player" onPress={() => router.back()} />
            <View style={styles.live}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>LIVE</Text>
            </View>
            <Text style={styles.channel}>CH {channelNumber(stream.number)}</Text>
            <Text style={styles.title} numberOfLines={1}>
              {stream.title}
            </Text>
          </View>
          {!failed ? (
            <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12, paddingLeft: insets.left + 12, paddingRight: insets.right + 12 }]}>
              <IconButton name="play-skip-back" label="Previous channel" onPress={() => step(-1)} />
              <IconButton name={isPlaying ? 'pause' : 'play'} label={isPlaying ? 'Pause' : 'Play'} onPress={togglePlay} large />
              <IconButton name="play-skip-forward" label="Next channel" onPress={() => step(1)} />
              <View style={styles.spacer} />
              <IconButton
                name={muted ? 'volume-mute' : 'volume-high'}
                label={muted ? 'Unmute' : 'Mute'}
                onPress={() => {
                  setMuted((m) => !m);
                  showControls();
                }}
              />
            </View>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

function IconButton({
  name,
  label,
  onPress,
  large = false,
}: {
  name: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  large?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      style={({ pressed }) => [styles.iconButton, large && styles.iconButtonLarge, pressed && styles.pressed]}
    >
      <Ionicons name={name} size={large ? 28 : 22} color={large ? colors.ink : colors.paper} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000' },
  center: { alignItems: 'center', justifyContent: 'center' },
  backup: {
    marginTop: 12,
    overflow: 'hidden',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.paper,
  },
  failed: { backgroundColor: colors.panel },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingBottom: 24,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  live: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 3, backgroundColor: colors.onair, paddingHorizontal: 7, paddingVertical: 3 },
  liveDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#fff' },
  liveText: { fontFamily: fonts.monoSemiBold, fontSize: 9, letterSpacing: 2, color: '#fff' },
  channel: { fontFamily: fonts.monoSemiBold, fontSize: 13, color: colors.amber },
  title: { flex: 1, fontFamily: fonts.display, fontSize: 24, color: colors.paper, textTransform: 'uppercase' },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 28,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  spacer: { flex: 1 },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22 },
  iconButtonLarge: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.amber },
  pressed: { opacity: 0.6 },
});
```

- [ ] **Step 6: Typecheck, test, bundle**

Run from `mobile_app/`: `npm run typecheck && npm test && npx expo export --platform android --output-dir dist`
Expected: all pass. Delete `mobile_app/dist`.

If TypeScript rejects `{ pointerEvents: 'none' }` inside a style array on this React Native version, move it to the `pointerEvents="none"` prop on that `View`.

- [ ] **Step 7: Commit**

```bash
git add mobile_app/src/player mobile_app/app/player
git commit -m "Add mobile player with backup-stream fallback"
```

---

### Task 7: Android build and on-device verification

**Files:**
- Modify only if verification finds a defect, and name each fix in the report.

**Interfaces:**
- Consumes: everything above. `ANDROID_HOME=F:\AndroidSDK`; AVD `Medium_Phone_API_36.1`; Java 21 from Android Studio's JBR.

- [ ] **Step 1: Boot the emulator**

```bash
"$ANDROID_HOME/emulator/emulator" -avd Medium_Phone_API_36.1 -no-boot-anim -no-snapshot-save &
"$ANDROID_HOME/platform-tools/adb" wait-for-device
until [ "$("$ANDROID_HOME/platform-tools/adb" shell getprop sys.boot_completed | tr -d '\r')" = "1" ]; do sleep 5; done
```

(In Git Bash, `$ANDROID_HOME` is `F:\AndroidSDK`; use `/f/AndroidSDK` if the backslash path fails.)

- [ ] **Step 2: Build a release APK (embeds the JS bundle, so no Metro is needed)**

From `mobile_app/`:

```bash
npx expo prebuild --platform android --clean
cd android && ./gradlew assembleRelease && cd ..
"$ANDROID_HOME/platform-tools/adb" install -r android/app/build/outputs/apk/release/app-release.apk
```

Expected: `BUILD SUCCESSFUL`, then `Success` from adb. (Expo's prebuild signs release builds with the debug key; this is fine for testing only.) Confirm `android/app/src/main/AndroidManifest.xml` contains `android:usesCleartextTraffic="true"`.

- [ ] **Step 3: Launch and capture**

```bash
"$ANDROID_HOME/platform-tools/adb" shell monkey -p com.electrohmhaussystems.electrohmtv -c android.intent.category.LAUNCHER 1
"$ANDROID_HOME/platform-tools/adb" exec-out screencap -p > ../.superpowers/sdd/2026-09-28-mobile-app/shot-home.png
```

Take a screenshot after each check below, into the same folder, and read each image to judge it. Drive the app with `adb shell input tap X Y`, `adb shell input text`, `adb shell input keyevent 4` (back) and `adb shell input swipe`. Get coordinates from `adb shell uiautomator dump /sdcard/ui.xml && adb pull /sdcard/ui.xml`.

Checklist:
1. First launch shows "Scanning for channels…", then Home: wordmark, search, Country/Language buttons, chips with counts, the tuner with a `CH ####` readout, and category rails. The fonts are the display, mono and sans faces (not the system font).
2. Surf changes the tuned channel.
3. Country → pick "Philippines": the counts drop, the headline reads "THE PHILIPPINES.", and the rails update.
4. Tap a category chip: Browse shows a 2-column grid with a title and count, and scrolls smoothly. Back returns Home.
5. Search "news" + enter: Browse shows results.
6. Tap a channel: the player opens full screen, video plays within ~15 s (try up to 5 channels; some are offline), and the controls hide after ~4 s and return on tap.
7. Next channel changes the title; Back closes the player.
8. Rotate with `adb shell settings put system accelerometer_rotation 0 && adb shell settings put system user_rotation 1`: the player goes landscape; Home stays portrait after closing. Restore with `user_rotation 0`.
9. Force-stop and relaunch (`adb shell am force-stop com.electrohmhaussystems.electrohmtv`, then launch again): Home appears quickly without "Scanning for channels…" (it came from the cache).
10. With the network off (`adb shell svc wifi disable && adb shell svc data disable`) and the app data cleared (`adb shell pm clear com.electrohmhaussystems.electrohmtv`), launch: the No signal screen shows with Try again. Turn the network back on and tap Try again: Home loads.

- [ ] **Step 4: Fix, re-verify, commit**

For any failed check, fix the code (keeping each fix minimal), rerun `npm run typecheck && npm test`, rebuild, re-check, and commit with a message naming the fix. Do not commit `mobile_app/android`.

Write the report with each checklist item marked pass or fail, plus screenshot paths.

---

## Self-review

- **Spec coverage:**
  - Structure → Tasks 2–6.
  - Shared code and `selectors.ts` → Task 1; framework-free header comments → Task 1, Step 7.
  - Data and caching, with the 6 h refresh and corrupt-file removal → Task 3.
  - Home (header, chips, tuner, 6 rails of 16, Browse all) → Task 4.
  - Browse (columns, empty state, Clear filters) → Task 5.
  - Player (headers, `contentType`, overlay auto-hide, backup sources, No signal, walking the queue, rotation, keep awake via `keepScreenOnWhilePlaying`) → Task 6.
  - Platform config (cleartext, ATS, name, scheme, identifiers, icon and splash) → Task 2.
  - Theme and fonts → Task 2.
  - Error table: no cache + fetch fail → Task 3/4; unreadable cache → Task 3; stream fails → Task 6; unknown id → Task 6; logo fails → Task 4.
  - Testing: Vitest selectors → Task 1; jest cache/source → Tasks 3 and 6; Android emulator → Task 7.
- **Spec deviations, recorded:**
  - `expo-keep-awake` and `expo-screen-orientation` are replaced by expo-video's `keepScreenOnWhilePlaying` and native-stack's `orientation` option (fewer packages, same behaviour).
  - Icons use `@expo/vector-icons` (Ionicons), which the spec didn't name.
- **Type consistency:** `CatalogContextValue` fields, `usePlay` signature, `FilterOption`, `NoSignal` props, and `videoSource` match between their producing and consuming tasks.
