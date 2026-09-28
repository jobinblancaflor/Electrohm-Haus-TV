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
