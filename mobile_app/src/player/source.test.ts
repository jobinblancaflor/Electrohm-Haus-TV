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
