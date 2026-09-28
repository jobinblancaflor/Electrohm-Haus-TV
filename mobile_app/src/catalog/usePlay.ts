import { useCallback } from 'react';
import { router } from 'expo-router';
import type { Stream } from '@shared/types';
import { useCatalog } from './CatalogProvider';

/** Opens the player on `stream`; previous/next then walk `queue`. */
export function usePlay() {
  const { setQueue } = useCatalog();
  return useCallback(
    (stream: Stream, queue: Stream[]) => {
      setQueue(queue);
      router.push({ pathname: '/player/[id]', params: { id: stream.id } });
    },
    [setQueue],
  );
}
