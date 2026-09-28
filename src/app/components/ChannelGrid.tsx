import { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import type { Stream } from '../types';
import { formatCount } from '../lib/format';
import { ChannelCard } from './ChannelCard';

const PAGE_SIZE = 60;

interface ChannelGridProps {
  title: string;
  streams: Stream[];
  emptyMessage: string;
  onSelect: (stream: Stream, queue: Stream[]) => void;
  favorites: Set<string>;
  onToggleFavorite: (stream: Stream) => void;
  onBack: () => void;
  onClearFilters: () => void;
}

export function ChannelGrid({
  title,
  streams,
  emptyMessage,
  onSelect,
  favorites,
  onToggleFavorite,
  onBack,
  onClearFilters,
}: ChannelGridProps) {
  const [visible, setVisible] = useState(PAGE_SIZE);

  // Start from the top of the list whenever the filters change.
  useEffect(() => setVisible(PAGE_SIZE), [streams]);

  const shown = streams.slice(0, visible);
  const remaining = streams.length - shown.length;

  return (
    <section className="mx-auto max-w-[1500px] px-4 pt-8 pb-12 md:px-8 md:pt-12">
      <button
        type="button"
        onClick={onBack}
        className="mb-5 flex items-center gap-2 rounded text-sm font-medium text-dim transition-colors hover:text-amber"
      >
        <ArrowLeft className="size-4" />
        Home
      </button>

      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2 border-b border-line pb-5">
        <h1 className="font-display text-4xl leading-[0.9] font-black tracking-tight uppercase md:text-6xl">{title}</h1>
        <p className="font-mono text-xs tracking-wider text-dim uppercase">
          {formatCount(streams.length)} {streams.length === 1 ? 'channel' : 'channels'}
        </p>
      </div>

      {streams.length === 0 ? (
        <div className="flex flex-col items-center py-24 text-center">
          <p className="max-w-sm text-dim">{emptyMessage}</p>
          <button
            type="button"
            onClick={onClearFilters}
            className="mt-5 h-10 rounded-full border border-line px-5 text-sm font-semibold transition-colors hover:border-amber hover:text-amber"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <>
          <div className="mt-7 grid grid-cols-2 gap-x-3 gap-y-6 xs:grid-cols-3 md:grid-cols-4 md:gap-x-5 lg:grid-cols-5 xl:grid-cols-6">
            {shown.map((stream) => (
              <ChannelCard
                key={stream.id}
                stream={stream}
                onSelect={(s) => onSelect(s, streams)}
                isFavorite={favorites.has(stream.id)}
                onToggleFavorite={onToggleFavorite}
              />
            ))}
          </div>
          {remaining > 0 && (
            <div className="mt-10 flex justify-center">
              <button
                type="button"
                onClick={() => setVisible((count) => count + PAGE_SIZE)}
                className="h-11 rounded-full border border-line px-6 text-sm font-semibold transition-colors hover:border-amber hover:text-amber"
              >
                Show {formatCount(Math.min(PAGE_SIZE, remaining))} more
                <span className="ml-2 font-mono text-xs text-dim">{formatCount(remaining)} left</span>
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
