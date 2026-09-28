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
