import { Radio, Play } from 'lucide-react';
import { ImageWithFallback } from './figma/ImageWithFallback';

interface ChannelCardProps {
  name: string;
  category: string;
  thumbnail: string;
  isLive?: boolean;
  viewers?: string;
  onClick?: () => void;
}

export function ChannelCard({ name, category, thumbnail, isLive, viewers, onClick }: ChannelCardProps) {
  return (
    <div
      className="group relative bg-card rounded-xl overflow-hidden cursor-pointer transition-transform hover:scale-105 hover:shadow-xl"
      onClick={onClick}
    >
      <div className="relative aspect-video">
        <ImageWithFallback
          src={thumbnail}
          alt={name}
          className="w-full h-full object-cover"
        />
...

        {isLive && (
          <div className="absolute top-3 left-3 flex items-center gap-1 bg-red-600 text-white px-2 py-1 rounded text-xs">
            <Radio className="w-3 h-3" />
            <span>LIVE</span>
          </div>
        )}

        {viewers && (
          <div className="absolute top-3 right-3 bg-black/70 backdrop-blur-sm text-white px-2 py-1 rounded text-xs">
            {viewers} watching
          </div>
        )}

        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
          <div className="w-12 h-12 bg-white/90 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity transform scale-75 group-hover:scale-100">
            <Play className="w-5 h-5 text-black fill-current ml-0.5" />
          </div>
        </div>
      </div>

      <div className="p-3 md:p-4">
        <h3 className="text-sm md:text-base font-semibold text-foreground mb-0.5 line-clamp-1">{name}</h3>
        <p className="text-[10px] md:text-sm text-muted-foreground line-clamp-1">{category}</p>
      </div>
    </div>
  );
}
