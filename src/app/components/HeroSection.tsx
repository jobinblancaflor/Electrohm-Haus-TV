import { Play, Info } from 'lucide-react';

interface HeroSectionProps {
  onWatchNow?: () => void;
}

export function HeroSection({ onWatchNow }: HeroSectionProps) {
  return (
    <section className="relative h-[600px] w-full overflow-hidden">
      <div className="absolute inset-0">
        <img
          src="https://images.unsplash.com/photo-1546519638-68e109498ffc?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1920"
          alt="NBA Featured content"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
      </div>

      <div className="relative container mx-auto px-4 h-full flex items-end pb-16">
        <div className="max-w-2xl">
          <div className="inline-block px-3 py-1 bg-red-600 text-white rounded mb-4">
            LIVE NOW
          </div>

          <h2 className="text-5xl mb-4 text-white">NBA Live: Season Finals</h2>

          <p className="text-lg text-gray-200 mb-6">
            Experience the intensity of the NBA Finals live. Watch every slam dunk, three-pointer, and game-winning shot from the world's best basketball league.
          </p>

          <div className="flex items-center gap-4">
            <button 
              onClick={onWatchNow}
              className="flex items-center gap-2 bg-white text-black px-6 py-3 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <Play className="w-5 h-5 fill-current" />
              <span>Watch Now</span>
            </button>

            <button className="flex items-center gap-2 bg-white/20 backdrop-blur-sm text-white px-6 py-3 rounded-lg hover:bg-white/30 transition-colors">
              <Info className="w-5 h-5" />
              <span>More Info</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
