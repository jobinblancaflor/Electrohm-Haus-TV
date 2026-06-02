import { Play, Info } from 'lucide-react';

interface HeroSectionProps {
  onWatchNow?: () => void;
}

export function HeroSection({ onWatchNow }: HeroSectionProps) {
  return (
    <section className="relative h-[450px] md:h-[600px] w-full overflow-hidden">
      <div className="absolute inset-0">
        <img
          src="https://images.unsplash.com/photo-1546519638-68e109498ffc?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1920"
          alt="NBA Featured content"
          className="w-full h-full object-cover object-center md:object-top"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent md:via-background/60" />
      </div>

      <div className="relative container mx-auto px-4 h-full flex items-end pb-12 md:pb-16">
        <div className="max-w-2xl">
          <div className="inline-block px-3 py-1 bg-red-600 text-white text-xs font-bold rounded mb-3 md:mb-4">
            LIVE NOW
          </div>

          <h2 className="text-3xl md:text-5xl font-bold mb-3 md:mb-4 text-white leading-tight">
            NBA Live: Season Finals
          </h2>

          <p className="text-sm md:text-lg text-gray-200 mb-6 line-clamp-2 md:line-clamp-none">
            Experience the intensity of the NBA Finals live. Watch every slam dunk, three-pointer, and game-winning shot from the world's best basketball league.
          </p>

          <div className="flex items-center gap-3 md:gap-4">
            <button 
              onClick={onWatchNow}
              className="flex items-center gap-2 bg-white text-black px-5 py-2.5 md:px-6 md:py-3 rounded-lg hover:bg-gray-100 transition-all active:scale-95 shadow-lg"
            >
              <Play className="w-4 h-4 md:w-5 md:h-5 fill-current" />
              <span className="text-sm md:text-base font-semibold">Watch Now</span>
            </button>

            <button className="flex items-center gap-2 bg-white/20 backdrop-blur-md text-white px-5 py-2.5 md:px-6 md:py-3 rounded-lg hover:bg-white/30 transition-all active:scale-95">
              <Info className="w-4 h-4 md:w-5 md:h-5" />
              <span className="text-sm md:text-base font-medium">More Info</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
