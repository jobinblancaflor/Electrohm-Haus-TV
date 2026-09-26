import { lazy, Suspense, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { RotateCw } from 'lucide-react';
import type { Catalog, Stream } from './types';
import { loadCatalog } from './lib/catalog';
import { countryInSentence, countryName } from './lib/format';
import { readIds, readString, writeIds, writeString } from './lib/storage';
import {
  FAVORITES,
  Header,
  type CategoryOption,
  type CountryOption,
  type LanguageOption,
} from './components/Header';
import { Tuner } from './components/Tuner';
import { CategorySection } from './components/CategorySection';
import { ChannelGrid } from './components/ChannelGrid';
import { ChannelEntry } from './components/ChannelEntry';
import { InstallPrompt } from './components/InstallPrompt';
import { Footer } from './components/Footer';

// hls.js is most of the bundle, so the player loads on first play.
const VideoPlayer = lazy(() => import('./components/VideoPlayer').then((m) => ({ default: m.VideoPlayer })));

const RAIL_SIZE = 16;
const HOME_CATEGORIES = 6;
const RECENT_KEY = 'electrohm:recent';
const RECENT_LIMIT = 16;
const FAVORITES_KEY = 'electrohm:favorites';
const LAST_KEY = 'electrohm:last';
/** Query parameter for shareable channel links: ?watch=<channel id>. */
const WATCH_PARAM = 'watch';

type LoadState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; catalog: Catalog };

/** Channels with a logo first, so rails don't open on a wall of monograms. */
function logosFirst(streams: Stream[]) {
  return [...streams].sort((a, b) => Number(!a.logo) - Number(!b.logo));
}

function watchUrl(id: string) {
  const url = new URL(window.location.href);
  url.search = '';
  url.hash = '';
  url.searchParams.set(WATCH_PARAM, id);
  return url.toString();
}

export default function App() {
  const [load, setLoad] = useState<LoadState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [country, setCountry] = useState('All');
  const [language, setLanguage] = useState('All');
  const [categoryId, setCategoryId] = useState('all');
  const [browsingAll, setBrowsingAll] = useState(false);
  const [playing, setPlaying] = useState<{ stream: Stream; queue: Stream[] } | null>(null);
  const [recentIds, setRecentIds] = useState<string[]>(() => readIds(RECENT_KEY));
  const [favoriteIds, setFavoriteIds] = useState<string[]>(() => readIds(FAVORITES_KEY));
  const [lastId] = useState(() => readString(LAST_KEY));
  const deepLinkHandled = useRef(false);

  const query = useDeferredValue(searchQuery.trim().toLowerCase());

  useEffect(() => {
    let cancelled = false;
    setLoad({ status: 'loading' });
    loadCatalog()
      .then((catalog) => !cancelled && setLoad({ status: 'ready', catalog }))
      .catch((error: unknown) => {
        console.error('Failed to load IPTV data:', error);
        if (!cancelled) {
          setLoad({ status: 'error', message: error instanceof Error ? error.message : 'The channel list failed to load.' });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const catalog = load.status === 'ready' ? load.catalog : null;
  const streams = useMemo(() => catalog?.streams ?? [], [catalog]);

  // Lookup by id, and by primary URL for entries saved before ids were stable.
  const streamIndex = useMemo(() => {
    const map = new Map<string, Stream>();
    for (const s of streams) {
      map.set(s.url, s);
      map.set(s.id, s);
    }
    return map;
  }, [streams]);

  const favorites = useMemo(() => new Set(favoriteIds), [favoriteIds]);

  const countries: CountryOption[] = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of streams) if (s.channel_country) counts.set(s.channel_country, (counts.get(s.channel_country) ?? 0) + 1);
    return [...counts]
      .map(([code, count]) => ({ code, count }))
      .sort((a, b) => countryName(a.code).localeCompare(countryName(b.code)));
  }, [streams]);

  const countryPool = useMemo(
    () => (country === 'All' ? streams : streams.filter((s) => s.channel_country === country)),
    [streams, country],
  );

  const languageOptions: LanguageOption[] = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of countryPool) for (const code of s.languages) counts.set(code, (counts.get(code) ?? 0) + 1);
    return (catalog?.languages ?? [])
      .filter((l) => counts.has(l.code))
      .map((l) => ({ ...l, count: counts.get(l.code)! }));
  }, [catalog, countryPool]);

  // A language or category picked in one country may be empty in the next.
  useEffect(() => {
    if (language !== 'All' && catalog && !languageOptions.some((l) => l.code === language)) setLanguage('All');
  }, [catalog, language, languageOptions]);

  const pool = useMemo(
    () => (language === 'All' ? countryPool : countryPool.filter((s) => s.languages.includes(language))),
    [countryPool, language],
  );

  const categoryOptions: CategoryOption[] = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of pool) for (const id of s.channel_category_ids) counts.set(id, (counts.get(id) ?? 0) + 1);
    return (catalog?.categories ?? [])
      .filter((c) => counts.has(c.id))
      .map((c) => ({ id: c.id, name: c.name, count: counts.get(c.id)! }))
      .sort((a, b) => b.count - a.count);
  }, [catalog, pool]);

  useEffect(() => {
    if (categoryId === 'all' || categoryId === FAVORITES || !catalog) return;
    if (!categoryOptions.some((c) => c.id === categoryId)) setCategoryId('all');
  }, [catalog, categoryId, categoryOptions]);

  const favoriteStreams = useMemo(
    () => favoriteIds.map((id) => streamIndex.get(id)).filter((s): s is Stream => Boolean(s)),
    [favoriteIds, streamIndex],
  );

  const recentStreams = useMemo(
    () => recentIds.map((id) => streamIndex.get(id)).filter((s): s is Stream => Boolean(s)),
    [recentIds, streamIndex],
  );

  const lastStream = lastId ? (streamIndex.get(lastId) ?? null) : null;

  const gridStreams = useMemo(() => {
    // My channels ignores the country and language filters: they're yours wherever you are.
    let result = categoryId === FAVORITES ? favoriteStreams : pool;
    if (categoryId !== 'all' && categoryId !== FAVORITES) {
      result = result.filter((s) => s.channel_category_ids.includes(categoryId));
    }
    if (query) {
      result = result.filter(
        (s) => s.title.toLowerCase().includes(query) || s.channel_name?.toLowerCase().includes(query),
      );
    }
    return result;
  }, [pool, favoriteStreams, categoryId, query]);

  const homeRails = useMemo(
    () =>
      categoryOptions.slice(0, HOME_CATEGORIES).map((category) => ({
        category,
        streams: logosFirst(pool.filter((s) => s.channel_category_ids.includes(category.id))).slice(0, RAIL_SIZE),
      })),
    [categoryOptions, pool],
  );

  const tunerPool = useMemo(() => {
    const withLogos = pool.filter((s) => s.logo);
    const base = withLogos.length ? withLogos : pool;
    // Keep the last-watched channel tunable even without a logo.
    return lastStream && !base.includes(lastStream) && pool.includes(lastStream) ? [lastStream, ...base] : base;
  }, [pool, lastStream]);

  const isGrid = Boolean(query) || categoryId !== 'all' || browsingAll;
  const isFavoritesView = categoryId === FAVORITES;
  const selectedCategory = categoryOptions.find((c) => c.id === categoryId);
  const selectedLanguage = languageOptions.find((l) => l.code === language);
  const place = country === 'All' ? null : countryInSentence(country);

  const gridTitle = query
    ? `“${searchQuery.trim()}”`
    : isFavoritesView
      ? 'My channels'
      : (selectedCategory?.name ?? (country === 'All' ? 'All channels' : countryName(country)));

  const emptyMessage = isFavoritesView && !query
    ? 'Nothing here yet. Tap the star on any channel to keep it in My channels.'
    : `No channels match${query ? ` “${searchQuery.trim()}”` : ''}${selectedCategory ? ` in ${selectedCategory.name}` : ''}${
        selectedLanguage && !isFavoritesView ? ` in ${selectedLanguage.name}` : ''
      }${place && !isFavoritesView ? ` from ${place}` : ''}. Check the spelling or clear the filters.`;

  const play = useCallback((stream: Stream, queue: Stream[]) => {
    setPlaying({ stream, queue });
    writeString(LAST_KEY, stream.id);
    setRecentIds((previous) => {
      const next = [stream.id, ...previous.filter((id) => id !== stream.id && id !== stream.url)].slice(0, RECENT_LIMIT);
      writeIds(RECENT_KEY, next);
      return next;
    });
  }, []);

  const toggleFavorite = useCallback((stream: Stream) => {
    setFavoriteIds((previous) => {
      const next = previous.includes(stream.id)
        ? previous.filter((id) => id !== stream.id)
        : [stream.id, ...previous];
      writeIds(FAVORITES_KEY, next);
      return next;
    });
  }, []);

  // Open a shared link (?watch=<id>) once the catalog is in.
  useEffect(() => {
    if (!catalog || deepLinkHandled.current) return;
    deepLinkHandled.current = true;
    const id = new URLSearchParams(window.location.search).get(WATCH_PARAM);
    const stream = id ? streamIndex.get(id) : undefined;
    if (stream) play(stream, streams);
    else if (id) window.history.replaceState(null, '', window.location.pathname);
  }, [catalog, streamIndex, streams, play]);

  // Keep the address bar pointing at what's playing, so it can be copied or bookmarked.
  useEffect(() => {
    if (!catalog) return;
    const target = playing ? watchUrl(playing.stream.id) : window.location.pathname;
    if (target !== window.location.href) window.history.replaceState(null, '', target);
  }, [catalog, playing]);

  const step = useCallback(
    (direction: 1 | -1) => {
      if (!playing || playing.queue.length === 0) return;
      const { queue, stream } = playing;
      const index = queue.findIndex((s) => s.id === stream.id);
      const next = queue[(index + direction + queue.length) % queue.length];
      play(next, queue);
    },
    [playing, play],
  );
  const playNext = useCallback(() => step(1), [step]);
  const playPrevious = useCallback(() => step(-1), [step]);
  const closePlayer = useCallback(() => setPlaying(null), []);
  const tuneByNumber = useCallback((stream: Stream) => play(stream, streams), [play, streams]);

  const goHome = () => {
    setSearchQuery('');
    setCategoryId('all');
    setBrowsingAll(false);
    window.scrollTo({ top: 0 });
  };

  const clearFilters = () => {
    goHome();
    setCountry('All');
    setLanguage('All');
  };

  const changeCategory = (id: string) => {
    setCategoryId(id);
    setBrowsingAll(id === 'all' ? false : browsingAll);
    window.scrollTo({ top: 0 });
  };

  return (
    <div className="flex min-h-dvh flex-col">
      <Header
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        countries={countries}
        selectedCountry={country}
        onCountryChange={setCountry}
        languages={languageOptions}
        selectedLanguage={language}
        onLanguageChange={setLanguage}
        categories={categoryOptions}
        totalInPool={pool.length}
        favoriteCount={favoriteStreams.length}
        selectedCategoryId={categoryId}
        onCategoryChange={changeCategory}
        onHome={goHome}
      />

      <main className="flex-1 pt-[109px]">
        {load.status === 'loading' && <LoadingState />}

        {load.status === 'error' && (
          <div className="mx-auto flex max-w-md flex-col items-center px-4 py-32 text-center">
            <p className="font-mono text-[11px] tracking-[0.2em] text-onair uppercase">No signal</p>
            <h1 className="mt-3 font-display text-4xl font-extrabold uppercase">The channel list didn't load</h1>
            <p className="mt-3 text-dim">{load.message} Check your connection and try again.</p>
            <button
              type="button"
              onClick={() => setAttempt((n) => n + 1)}
              className="mt-7 flex h-11 items-center gap-2 rounded-full bg-amber px-6 font-semibold text-ink hover:bg-[#ffc56e]"
            >
              <RotateCw className="size-4" />
              Try again
            </button>
          </div>
        )}

        {catalog &&
          (isGrid ? (
            <ChannelGrid
              title={gridTitle}
              streams={gridStreams}
              emptyMessage={emptyMessage}
              onSelect={play}
              favorites={favorites}
              onToggleFavorite={toggleFavorite}
              onBack={goHome}
              onClearFilters={clearFilters}
            />
          ) : (
            <>
              <Tuner
                pool={tunerPool}
                totalChannels={pool.length}
                totalCountries={countries.length}
                countryLabel={place}
                resume={lastStream}
                onWatch={(stream) => play(stream, tunerPool)}
              />
              <div className="border-t border-line pt-4 md:pt-6">
                {favoriteStreams.length > 0 && (
                  <CategorySection
                    title="My channels"
                    streams={favoriteStreams.slice(0, RAIL_SIZE)}
                    total={favoriteStreams.length}
                    onSelect={play}
                    favorites={favorites}
                    onToggleFavorite={toggleFavorite}
                    onViewAll={favoriteStreams.length > RAIL_SIZE ? () => changeCategory(FAVORITES) : undefined}
                  />
                )}
                {recentStreams.length > 0 && (
                  <CategorySection
                    title="Watched recently"
                    streams={recentStreams}
                    onSelect={play}
                    favorites={favorites}
                    onToggleFavorite={toggleFavorite}
                  />
                )}
                {homeRails.map(({ category, streams: railStreams }) => (
                  <CategorySection
                    key={category.id}
                    title={category.name}
                    streams={railStreams}
                    total={category.count}
                    onSelect={play}
                    favorites={favorites}
                    onToggleFavorite={toggleFavorite}
                    onViewAll={() => changeCategory(category.id)}
                  />
                ))}
                <div className="mx-auto max-w-[1500px] px-4 pt-6 md:px-8">
                  <button
                    type="button"
                    onClick={() => {
                      setBrowsingAll(true);
                      window.scrollTo({ top: 0 });
                    }}
                    className="h-11 w-full rounded-full border border-line text-sm font-semibold transition-colors hover:border-amber hover:text-amber"
                  >
                    Browse all {pool.length.toLocaleString('en')} channels{place ? ` from ${place}` : ''}
                  </button>
                </div>
              </div>
            </>
          ))}
      </main>

      <Footer />

      {catalog && <ChannelEntry streams={streams} onTune={tuneByNumber} />}

      {playing && (
        <Suspense fallback={<div className="fixed inset-0 z-50 bg-ink/[0.97]" />}>
          <VideoPlayer
            stream={playing.stream}
            isFavorite={favorites.has(playing.stream.id)}
            shareUrl={watchUrl(playing.stream.id)}
            onToggleFavorite={toggleFavorite}
            onClose={closePlayer}
            onNext={playNext}
            onPrevious={playPrevious}
          />
        </Suspense>
      )}

      <InstallPrompt />
    </div>
  );
}

function LoadingState() {
  return (
    <div className="mx-auto max-w-[1500px] px-4 pt-10 md:px-8 md:pt-16" aria-busy="true" aria-label="Loading channels">
      <div className="grid gap-10 lg:grid-cols-[1.05fr_1fr] lg:gap-16">
        <div className="space-y-4">
          <div className="h-3 w-48 animate-pulse rounded bg-panel" />
          <div className="h-24 w-4/5 animate-pulse rounded bg-panel md:h-40" />
          <div className="h-4 w-2/3 animate-pulse rounded bg-panel" />
        </div>
        <div className="h-72 animate-pulse rounded-2xl border border-line bg-panel" />
      </div>
      <p className="mt-10 font-mono text-[11px] tracking-[0.2em] text-dim uppercase">Scanning for channels…</p>
    </div>
  );
}
