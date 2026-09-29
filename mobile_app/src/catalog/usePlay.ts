import { useCallback, useRef } from 'react';
import { router } from 'expo-router';
import type { Stream } from '@shared/types';
import { useCatalog } from './CatalogProvider';
import { beforeChannelOpen } from '../ads/interstitial';

const REENTRY_LOCK_MS = 800;

/** Opens the player on stream (after an interstitial when one is due); previous/next then walk queue. */
export function usePlay() {
  const { setQueue } = useCatalog();
  const lastAccepted = useRef(0);
  return useCallback(
    (stream: Stream, queue: Stream[]) => {
      // A double tap would otherwise push two players.
      const now = Date.now();
      if (now - lastAccepted.current < REENTRY_LOCK_MS) return;
      lastAccepted.current = now;
      beforeChannelOpen(() => {
        setQueue(queue);
        router.push({ pathname: '/player/[id]', params: { id: stream.id } });
      });
    },
    [setQueue],
  );
}
