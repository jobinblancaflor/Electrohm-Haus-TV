import type { Catalog, Category, Language, Stream } from '../types';

const API = 'https://iptv-org.github.io/api';

async function getJson<T>(file: string): Promise<T> {
  const response = await fetch(`${API}/${file}`);
  if (!response.ok) {
    throw new Error(`Couldn't load ${file} (HTTP ${response.status}).`);
  }
  return response.json() as Promise<T>;
}

interface RawStream {
  channel?: string | null;
  feed?: string | null;
  title?: string;
  url?: string;
  quality?: string | null;
  label?: string | null;
  user_agent?: string | null;
  referrer?: string | null;
  http_referrer?: string | null;
}

interface RawChannel {
  id: string;
  name?: string;
  country?: string;
  categories?: string[];
  is_nsfw?: boolean;
  logo?: string;
}

interface RawCategory {
  id: string;
  name?: string;
  description?: string;
}

interface RawLogo {
  channel?: string;
  feed?: string | null;
  url?: string;
  in_use?: boolean;
}

interface RawFeed {
  channel?: string;
  id?: string;
  languages?: string[];
}

interface RawLanguage {
  code?: string;
  name?: string;
}

/** Short stable id for streams with no iptv-org channel (FNV-1a over the URL). */
function urlId(url: string) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < url.length; i++) {
    hash ^= url.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return `s-${(hash >>> 0).toString(36)}`;
}

/** "1080p" → 1080; unknown quality sorts last. */
function qualityRank(quality: string | null | undefined) {
  return Number.parseInt(quality ?? '', 10) || 0;
}

/**
 * Loads streams from iptv-org and joins them with channel metadata, categories, languages and logos.
 * Streams of the same channel feed are merged into one entry whose extra URLs become backup sources.
 * Adult channels are dropped, as are streams without a playable URL.
 */
export async function loadCatalog(): Promise<Catalog> {
  const [streamsData, channelsData, categoriesData, logosData, feedsData, languagesData] = await Promise.all([
    getJson<RawStream[]>('streams.json'),
    getJson<RawChannel[]>('channels.json'),
    getJson<RawCategory[]>('categories.json'),
    getJson<RawLogo[]>('logos.json'),
    getJson<RawFeed[]>('feeds.json'),
    getJson<RawLanguage[]>('languages.json'),
  ]);

  const channelsById = new Map<string, RawChannel>();
  for (const channel of channelsData) {
    if (channel?.id) channelsById.set(channel.id, channel);
  }

  const categories: Category[] = categoriesData
    .filter((category) => category?.id && category.name)
    .map((category) => ({
      id: String(category.id),
      name: String(category.name),
      description: String(category.description ?? ''),
    }));
  const categoryNames = new Map(categories.map((category) => [category.id, category.name]));

  const languageNames = new Map<string, string>();
  for (const language of languagesData) {
    if (language?.code && language.name) languageNames.set(language.code, language.name);
  }

  const feedLanguages = new Map<string, string[]>();
  for (const feed of feedsData) {
    if (feed?.channel && feed.id && feed.languages?.length) feedLanguages.set(`${feed.channel}@${feed.id}`, feed.languages);
  }

  const logosByChannel = new Map<string, string>();
  const logosByFeed = new Map<string, string>();
  for (const logo of logosData) {
    if (!logo?.channel || !logo.url) continue;
    const feedKey = `${logo.channel}@${logo.feed ?? ''}`;
    if (logo.feed && (!logosByFeed.has(feedKey) || logo.in_use)) logosByFeed.set(feedKey, logo.url);
    if (!logosByChannel.has(logo.channel) || logo.in_use) logosByChannel.set(logo.channel, logo.url);
  }

  // Group sources per channel feed, keeping first-seen order for the catalog itself.
  const groups = new Map<string, RawStream[]>();
  for (const raw of streamsData) {
    if (!raw?.url) continue;
    const meta = raw.channel ? channelsById.get(raw.channel) : undefined;
    if (meta?.is_nsfw) continue;
    const key = raw.channel ? `${raw.channel}@${raw.feed ?? ''}` : urlId(raw.url);
    const group = groups.get(key);
    if (group) group.push(raw);
    else groups.set(key, [raw]);
  }

  const streams: Stream[] = [];
  const usedLanguages = new Set<string>();
  for (const [id, group] of groups) {
    // https first (plain http is blocked on secure pages), then highest quality.
    const ranked = [...group].sort(
      (a, b) =>
        Number(b.url!.startsWith('https:')) - Number(a.url!.startsWith('https:')) ||
        qualityRank(b.quality) - qualityRank(a.quality),
    );
    const best = ranked[0];
    const meta = best.channel ? channelsById.get(best.channel) : undefined;
    const channel = best.channel ?? '';
    const categoryIds = (meta?.categories ?? []).map((value) => String(value).trim()).filter(Boolean);
    const names = categoryIds.map((value) => categoryNames.get(value) ?? value);
    const languages = best.channel ? (feedLanguages.get(`${best.channel}@${best.feed ?? ''}`) ?? []) : [];
    languages.forEach((code) => usedLanguages.add(code));

    streams.push({
      id,
      number: streams.length + 1,
      channel: best.channel ?? null,
      feed: best.feed ?? null,
      title: best.title || meta?.name || channel || `Channel ${streams.length + 1}`,
      url: best.url!,
      sources: [...new Set(ranked.map((raw) => raw.url!))],
      quality: best.quality ?? null,
      label: best.label ?? null,
      user_agent: best.user_agent ?? null,
      referrer: best.referrer ?? best.http_referrer ?? null,
      logo: logosByFeed.get(`${channel}@${best.feed ?? ''}`) || logosByChannel.get(channel) || meta?.logo || '',
      channel_country: meta?.country ?? null,
      channel_category_ids: categoryIds,
      channel_categories: names.length ? names.join(', ') : null,
      channel_name: meta?.name ?? null,
      channel_is_nsfw: false,
      languages,
    });
  }

  const languages: Language[] = [...usedLanguages]
    .map((code) => ({ code, name: languageNames.get(code) ?? code }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return { streams, categories, languages };
}
