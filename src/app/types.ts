// Framework-free: shared by the web app and mobile_app. No React, DOM or browser-only APIs.
export interface Category {
  id: string;
  name: string;
  description: string;
}

export interface Language {
  code: string;
  name: string;
}

export interface Stream {
  /** Stable across visits: "<channel>@<feed>" for known channels, otherwise a hash of the stream URL. */
  id: string;
  /** 1-based position in the catalog, shown as the channel number. */
  number: number;
  channel: string | null;
  feed: string | null;
  title: string;
  /** Primary source; same as sources[0]. */
  url: string;
  /** Every known source for this channel, best first. The player falls back through them. */
  sources: string[];
  quality: string | null;
  label: string | null;
  user_agent: string | null;
  referrer: string | null;
  logo: string;
  channel_country: string | null;
  channel_category_ids: string[];
  channel_categories: string | null;
  channel_name: string | null;
  channel_is_nsfw: boolean;
  languages: string[];
}

export interface Catalog {
  streams: Stream[];
  categories: Category[];
  languages: Language[];
}
