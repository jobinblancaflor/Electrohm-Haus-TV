import { ArrowRight } from 'lucide-react';
import type { Stream } from '../types';
import { formatCount } from '../lib/format';
import { ChannelCard } from './ChannelCard';

interface CategorySectionProps {
  title: string;
  streams: Stream[];
  total?: number;
  onSelect: (stream: Stream, queue: Stream[]) => void;
  favorites: Set<string>;
  onToggleFavorite: (stream: Stream) => void;
  onViewAll?: () => void;
}

/** One horizontal rail of channels on the home screen. */
export function CategorySection({ title, streams, total, onSelect, favorites, onToggleFavorite, onViewAll }: CategorySectionProps) {
  return (
    <section className="py-5 md:py-7" aria-label={title}>
      <div className="mx-auto flex max-w-[1500px] items-end justify-between gap-4 px-4 md:px-8">
        <h2 className="font-display text-2xl leading-none font-extrabold tracking-tight uppercase md:text-3xl">{title}</h2>
        {onViewAll && (
          <button
            type="button"
            onClick={onViewAll}
            className="group flex items-center gap-1.5 rounded text-sm font-medium text-dim transition-colors hover:text-amber"
          >
            See all{total ? <span className="font-mono text-xs">{formatCount(total)}</span> : null}
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
          </button>
        )}
      </div>

      <div className="no-scrollbar mx-auto mt-4 flex max-w-[1500px] snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-2 md:scroll-px-8 md:gap-5 md:px-8">
        {streams.map((stream) => (
          <ChannelCard
            key={stream.id}
            stream={stream}
            onSelect={(s) => onSelect(s, streams)}
            isFavorite={favorites.has(stream.id)}
            onToggleFavorite={onToggleFavorite}
            className="w-[42vw] shrink-0 snap-start xs:w-44 md:w-52"
          />
        ))}
      </div>
    </section>
  );
}
