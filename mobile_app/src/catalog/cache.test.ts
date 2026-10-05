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
