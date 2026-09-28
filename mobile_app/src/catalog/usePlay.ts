import { useCallback } from 'react';
import { router } from 'expo-router';
import type { Stream } from '@shared/types';
import { useCatalog } from './CatalogProvider';
import { beforeChannelOpen } from '../ads/interstitial';

/** Opens the player on stream (after an interstitial when one is due); previous/next then walk queue. */
export function usePlay() {
  const { setQueue } = useCatalog();
  return useCallback(
    (stream: Stream, queue: Stream[]) => {
      beforeChannelOpen(() => {
        setQueue(queue);
        router.push({ pathname: '/player/[id]', params: { id: stream.id } });
      });
    },
    [setQueue],
  );
}
