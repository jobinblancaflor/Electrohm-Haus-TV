# TV guide (now/next) in the player — design

Date: 2026-09-27
Status: approved in chat, awaiting spec review

## Goal

When a viewer opens a channel that has schedule data, the player shows what's on now (with progress),
and what's on next. Channels without data show nothing extra. No backend.

## Decisions

| Question | Decision | Why |
|---|---|---|
| Data source | i.mjh.nz XMLTV files, fetched from the browser | CORS open (`Access-Control-Allow-Origin: *`), no scraping, no server. Covers ~2,379 of 11,125 channel feeds (~21%), mostly FAST services (Samsung TV Plus, Pluto, Plex, Roku, PBS). |
| Where it shows | Player only | One schedule file per opened channel. Cards/grid would need many multi-MB files while browsing. |
| Channel → schedule mapping | Build-time lookup file | `guides.json` is 25 MB; name matching is unreliable. |
| Later | A scheduled server job (iptv-org/epg grabber) can raise coverage to ~37% | Out of scope here. |

## Facts this design relies on

- iptv-org does not host EPG files. `https://iptv-org.github.io/api/guides.json` maps
  `{channel, feed, site, site_id}`; for `site: "i.mjh.nz"`, `site_id` is `<file>#<channel id>`,
  e.g. `au/Adelaide/epg#mjh-7flix-ade`.
- The schedule for that entry is published at `https://i.mjh.nz/<file>.xml.gz` (also `.xml`). 39 files are referenced.
- **Browser fetches must use the redirect target** `https://raw.githubusercontent.com/matthuisman/i.mjh.nz/refs/heads/master/<file>.xml.gz`.
  `i.mjh.nz` redirects via `github.com/.../raw`, whose 302 sends an empty `Access-Control-Allow-Origin`, so Chrome
  rejects the request ("Failed to fetch"). The raw host sends `Access-Control-Allow-Origin: *` and serves the `.gz`
  bytes without `Content-Encoding`, so they must be decompressed in code (verified in Chrome: 3 MB in ~0.5 s).
- Sizes vary widely: SamsungTVPlus/us 3 MB raw / 0.5 MB gz; PlutoTV/us 7.4 MB / 0.9 MB;
  Roku/all 34 MB / 3.1 MB; Plex/all 41 MB / 6.8 MB.
- XMLTV `programme` elements carry `start`, `stop`, `channel` attributes (e.g. `20260927120000 +0000`)
  and `title`, optional `sub-title`, `desc` children.

## Components

### 1. `scripts/build-guide-map.mjs` → `public/guide-map.json`

- Run with `npm run guide-map` (manual; the mapping changes rarely). Output is committed.
- Fetches `guides.json`, keeps entries where `site === "i.mjh.nz"` and `channel` is set.
- Writes `{"<channel>@<feed>": "<file>#<id>"}`. Keys match `Stream.id` for channel streams,
  so lookup is a single property access. Where several entries share a key, the first wins.
- Prints entry count and output size; fails (non-zero exit) if the fetch fails or the output is empty.

### 2. `src/app/guide/parseXmltv.ts` (pure, unit-tested)

```ts
export interface Programme { start: number; stop: number; title: string; subtitle?: string; description?: string }

/** Parse "YYYYMMDDhhmmss ±hhmm" to epoch ms. Returns NaN when malformed. */
export function parseXmltvTime(value: string): number;

/**
 * Scan XMLTV text and return programmes grouped by channel id, keeping only those that overlap
 * [windowStart, windowEnd]. Sorted by start. Decodes the five XML entities and numeric entities.
 */
export function parseXmltv(xml: string, windowStart: number, windowEnd: number): Map<string, Programme[]>;
```

- String scanner over `<programme ...>...</programme>`, with attributes read in any order. `DOMParser`
  is unavailable in workers, and a full XML parser is unnecessary for this shape.
- `description` trimmed to 280 characters.
- Missing `stop` → the next programme's start on that channel; drop the entry if still unknown.

### 3. `src/app/guide/guide.worker.ts`

- Message in: `{ file: string }`. Message out: `{ file, ok: true, channels: Record<string, Programme[]> }`
  or `{ file, ok: false, error: string }`.
- Fetch `<GUIDE_BASE>/<file>.xml.gz` (GUIDE_BASE = the raw.githubusercontent.com URL above) and decompress with
  `DecompressionStream('gzip')`; if unsupported or the fetch fails, fetch `<GUIDE_BASE>/<file>.xml` instead.
- Window: now − 1 h to now + 12 h.
- The worker is stateless; the session cache (one promise per file, shared by concurrent requests, failures kept)
  lives in `useGuide`'s module so there is one cache, on the side that decides when to ask.

### 4. `src/app/guide/useGuide.ts`

```ts
type GuideState =
  | { status: 'none' }                       // channel has no mapping
  | { status: 'loading' }
  | { status: 'ready'; programmes: Programme[] }
  | { status: 'unavailable' };                // fetch/parse failed
export function useGuide(stream: Stream): GuideState;
```

- Loads `/guide-map.json` once (module-level promise).
- A single worker per page, created lazily on first use.
- A file that failed stays `unavailable` for the session (no retry storm on channel changes).
- `ready` with an empty list is treated as `unavailable` for display.

### 5. `src/app/components/GuidePanel.tsx`

- Rendered in `VideoPlayer` between the video frame and the details strip.
- `none` → renders nothing. `loading` → one-line skeleton. `unavailable` → a single dim line, "Guide unavailable".
- `ready`:
  - **On now**: title (display face), sub-title if any, `HH:MM–HH:MM` in local time,
    an amber progress bar, and the minutes left.
  - **Up next**: the next 4 programmes, each with a start time (mono) and title.
  - If nothing is airing (a gap), it shows "Up next" only.
- Re-renders every 30 s to advance progress and roll over to the next programme.
- Times are formatted with `Intl.DateTimeFormat` using `hour: '2-digit', minute: '2-digit'`.

### 6. Service worker and credit

- `sw.js`: add `/guide-map.json` to the stale-while-revalidate data cache (same-origin).
  i.mjh.nz files are not SW-cached (they change daily; the worker's session cache covers repeats).
- Footer: "Guide data from i.mjh.nz."

## Error handling

| Case | Behaviour |
|---|---|
| Channel not in map / no-channel stream | `none`, no panel |
| `guide-map.json` fails to load | `none` for all channels this session; logged once |
| Schedule fetch or parse fails | `unavailable` line; file marked failed for the session |
| Worker unsupported | `none` |
| Very large file (Roku/all, Plex/all) | Parsed off the main thread; panel shows loading; playback unaffected |

## Testing

- Add Vitest (dev-only) and `npm test`.
- `parseXmltv.test.ts`: positive/negative offsets; entities (`&amp;`, `&#39;`); attributes in any order;
  missing `sub-title`; window filtering; missing `stop` inferred; malformed time skipped.
- Build-map script: run once, verify count ≈ 2.4k and a size under 250 KB raw.
- Browser: open a Pluto or Samsung TV Plus channel, confirm now/next render and the progress bar advances;
  open an unmapped channel, confirm no panel.

## Out of scope

Guide on cards, full timeline grid page, server-side grabbing, reminders, catch-up.
