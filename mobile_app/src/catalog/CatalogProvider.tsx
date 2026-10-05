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
