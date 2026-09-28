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
