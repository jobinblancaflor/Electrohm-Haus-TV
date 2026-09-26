import { Play, Star } from 'lucide-react';
import type { Stream } from '../types';
import { channelNumber, countryName, primaryCategory } from '../lib/format';
import { ChannelLogo } from './ChannelLogo';

interface ChannelCardProps {
  stream: Stream;
  onSelect: (stream: Stream) => void;
  isFavorite: boolean;
  onToggleFavorite: (stream: Stream) => void;
  className?: string;
}

export function ChannelCard({ stream, onSelect, isFavorite, onToggleFavorite, className = '' }: ChannelCardProps) {
  return (
    <div className={`group relative flex flex-col ${className}`}>
      <button
        type="button"
        onClick={() => onSelect(stream)}
        aria-label={`Watch ${stream.title}`}
        className="flex flex-col text-left focus-visible:outline-none"
      >
        <div className="relative aspect-[16/10] w-full rounded-lg border border-line bg-panel transition-[border-color,background-color,transform] duration-200 group-hover:-translate-y-0.5 group-hover:border-amber/70 group-hover:bg-raised group-has-[:focus-visible]:border-amber group-has-[:focus-visible]:ring-2 group-has-[:focus-visible]:ring-amber/40">
          <span className="absolute top-2 left-2.5 font-mono text-[10px] tracking-wider text-dim">
            CH {channelNumber(stream.number)}
          </span>
          <ChannelLogo src={stream.logo} name={stream.title} className="absolute inset-x-6 top-7 bottom-5 text-base" />
          <span className="absolute right-2.5 bottom-2.5 flex size-8 translate-y-1 items-center justify-center rounded-full bg-amber text-ink opacity-0 transition duration-200 group-hover:translate-y-0 group-hover:opacity-100 group-has-[:focus-visible]:translate-y-0 group-has-[:focus-visible]:opacity-100">
            <Play className="ml-0.5 size-3.5 fill-current" />
          </span>
        </div>
        <span className="mt-2.5 line-clamp-1 pr-1 text-sm font-semibold text-paper">{stream.title}</span>
        <span className="line-clamp-1 text-xs text-dim">
          {primaryCategory(stream.channel_categories)} · {countryName(stream.channel_country)}
        </span>
      </button>

      {/* Sibling of the watch button (buttons can't nest), laid over the plate's top-right corner. */}
      <button
        type="button"
        onClick={() => onToggleFavorite(stream)}
        aria-pressed={isFavorite}
        aria-label={isFavorite ? `Remove ${stream.title} from My channels` : `Add ${stream.title} to My channels`}
        className={`absolute top-0.5 right-0.5 flex size-8 items-center justify-center rounded-full transition duration-200 group-hover:-translate-y-0.5 hover:bg-ink/60 focus-visible:opacity-100 ${
          isFavorite ? 'text-amber opacity-100' : 'text-dim opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-70'
        }`}
      >
        <Star className={`size-4 ${isFavorite ? 'fill-current' : ''}`} />
      </button>
    </div>
  );
}
