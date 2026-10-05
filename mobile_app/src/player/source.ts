import type { VideoSource } from 'expo-video';
import type { Stream } from '@shared/types';

const PROGRESSIVE_FILE = /\.(mp4|m4v|webm|mp3|aac)(\?|$)/i;

/**
 * Native players can send the headers some broadcasters require, which browsers can't.
 * iOS needs contentType 'hls' for playlist URLs without a .m3u8 extension.
 */
export function videoSource(stream: Stream, url: string): VideoSource {
  const headers: Record<string, string> = {};
  if (stream.user_agent) headers['User-Agent'] = stream.user_agent;
  if (stream.referrer) headers.Referer = stream.referrer;
  return {
    uri: url,
    contentType: PROGRESSIVE_FILE.test(url) ? 'progressive' : 'hls',
    ...(Object.keys(headers).length ? { headers } : {}),
  };
}
