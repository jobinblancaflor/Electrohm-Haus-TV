import { useState, useEffect, useMemo } from 'react';
import { Header } from './components/Header';
import { HeroSection } from './components/HeroSection';
import { CategorySection } from './components/CategorySection';
import { ChannelCard } from './components/ChannelCard';
import { VideoPlayer } from './components/VideoPlayer';

interface Category {
  id: string;
  name: string;
  description: string;
}

interface Stream {
  id: string;
  channel: string | null;
  feed: string | null;
  title: string;
  url: string;
  quality: string | null;
  label: string | null;
  user_agent: string | null;
  referrer: string | null;
  logo: string;
  channel_country: string | null;
  channel_category_ids: string[];
  channel_categories: string | null;
  channel_name: string | null;
  channel_is_nsfw: boolean;
}

const STREAMS_API_URL = 'https://iptv-org.github.io/api/streams.json';
const CHANNELS_API_URL = 'https://iptv-org.github.io/api/channels.json';
const CATEGORIES_API_URL = 'https://iptv-org.github.io/api/categories.json';
const LOGOS_API_URL = 'https://iptv-org.github.io/api/logos.json';

export default function App() {
  const [selectedStream, setSelectedStream] = useState<Stream | null>(null);
  const [streams, setStreams] = useState<Stream[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCountry, setSelectedCountry] = useState<string>('All');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('All');
  const [viewAllCategory, setViewAllCategory] = useState<Category | null>(null);
  const [isViewingAllLive, setIsViewingAllLive] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallBanner(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User response to the install prompt: ${outcome}`);
    setDeferredPrompt(null);
    setShowInstallBanner(false);
  };

  useEffect(() => {
    async function loadData() {
      try {
        const [streamsResponse, channelsResponse, categoriesResponse, logosResponse] = await Promise.all([
          fetch(STREAMS_API_URL),
          fetch(CHANNELS_API_URL),
          fetch(CATEGORIES_API_URL),
          fetch(LOGOS_API_URL),
        ]);

        const [streamsData, channelsData, categoriesData, logosData] = await Promise.all([
          streamsResponse.json(),
          channelsResponse.json(),
          categoriesResponse.json(),
          logosResponse.json(),
        ]);

        const channelsById = new Map(
          channelsData
            .filter((channel: any) => channel && channel.id)
            .map((channel: any) => [channel.id, channel])
        );
        const categoriesById = new Map(
          categoriesData
            .filter((category: any) => category && category.id)
            .map((category: any) => [category.id, category])
        );
        const logosByChannel = new Map();
        const logosByChannelFeed = new Map();
        for (const logo of logosData) {
          if (!logo || !logo.channel || !logo.url) continue;
          const channel = String(logo.channel);
          const feed = logo.feed ? String(logo.feed) : '';
          const key = `${channel}::${feed}`;
          const isInUse = Boolean(logo.in_use);
          if (feed && (!logosByChannelFeed.has(key) || isInUse)) {
            logosByChannelFeed.set(key, logo.url);
          }
          if (!logosByChannel.has(channel) || isInUse) {
            logosByChannel.set(channel, logo.url);
          }
        }

        const processedCategories = categoriesData
          .filter((category: any) => category && category.id && category.name)
          .map((category: any) => ({
            id: String(category.id),
            name: String(category.name),
            description: String(category.description || ''),
          }));

        const processedStreams = streamsData.map((stream: any, index: number) => {
          const channelMeta = stream.channel ? channelsById.get(stream.channel) : null;
          const streamChannel = stream.channel ? String(stream.channel) : '';
          const streamFeed = stream.feed ? String(stream.feed) : '';
          const logoFromApi =
            logosByChannelFeed.get(`${streamChannel}::${streamFeed}`) ||
            logosByChannel.get(streamChannel) ||
            '';
          const categoryIds = Array.isArray(channelMeta?.categories)
            ? channelMeta.categories.map((value: any) => String(value).trim()).filter(Boolean)
            : [];
          const categoryNames = categoryIds.map((id: string) => categoriesById.get(id)?.name || id);
          return {
            id: stream.id || `stream-${index + 1}`,
            channel: stream.channel ?? null,
            feed: stream.feed ?? null,
            title: stream.title || channelMeta?.name || stream.channel || `Channel ${index + 1}`,
            url: stream.url || '',
            quality: stream.quality ?? null,
            label: stream.label ?? null,
            user_agent: stream.user_agent ?? null,
            referrer: stream.referrer ?? stream.http_referrer ?? null,
            logo: logoFromApi || stream.logo || channelMeta?.logo || '',
            channel_country: channelMeta?.country ?? null,
            channel_category_ids: categoryIds,
            channel_categories: categoryNames.length ? categoryNames.join(', ') : null,
            channel_name: channelMeta?.name ?? null,
            channel_is_nsfw: Boolean(channelMeta?.is_nsfw),
          };
        });

        setCategories(processedCategories);
        setStreams(processedStreams);
      } catch (error) {
        console.error('Failed to load IPTV data:', error);
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, []);

  const countries = useMemo(() => {
    const set = new Set<string>();
    streams.forEach(s => {
      if (s.channel_country) set.add(s.channel_country);
    });
    return ['All', ...Array.from(set).sort()];
  }, [streams]);

  const filteredStreams = useMemo(() => {
    let result = streams;
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(stream => 
        stream.title.toLowerCase().includes(query) ||
        (stream.channel_name && stream.channel_name.toLowerCase().includes(query))
      );
    }

    if (selectedCountry !== 'All') {
      result = result.filter(stream => stream.channel_country === selectedCountry);
    }

    if (selectedCategoryId !== 'All') {
      result = result.filter(stream => stream.channel_category_ids.includes(selectedCategoryId));
    }

    if (viewAllCategory) {
      result = result.filter(stream => stream.channel_category_ids.includes(viewAllCategory.id));
    }

    return result;
  }, [streams, searchQuery, selectedCountry, selectedCategoryId, viewAllCategory]);

  const liveStreams = useMemo(() => {
    if (viewAllCategory || isViewingAllLive) return []; // Don't show "Live Now" when viewing a specific category
    return filteredStreams.slice(0, 8);
  }, [filteredStreams, viewAllCategory, isViewingAllLive]);
  
  const categoriesWithStreams = useMemo(() => {
    if (viewAllCategory || isViewingAllLive) return []; // Don't show other categories when viewing one

    // Only show top 5 categories for now to keep it clean
    return categories.slice(0, 5).map(cat => ({
      ...cat,
      streams: filteredStreams.filter(s => s.channel_category_ids.includes(cat.id)).slice(0, 8)
    })).filter(cat => cat.streams.length > 0);
  }, [categories, filteredStreams, viewAllCategory]);

  const handleChannelClick = (stream: Stream) => {
    setSelectedStream(stream);
  };

  const handleNext = () => {
    if (!selectedStream) return;
    const currentIndex = filteredStreams.findIndex(s => s.id === selectedStream.id);
    if (currentIndex < filteredStreams.length - 1) {
      setSelectedStream(filteredStreams[currentIndex + 1]);
    } else {
      setSelectedStream(filteredStreams[0]); // Wrap around
    }
  };

  const handlePrevious = () => {
    if (!selectedStream) return;
    const currentIndex = filteredStreams.findIndex(s => s.id === selectedStream.id);
    if (currentIndex > 0) {
      setSelectedStream(filteredStreams[currentIndex - 1]);
    } else {
      setSelectedStream(filteredStreams[filteredStreams.length - 1]); // Wrap around
    }
  };

  const handleHeroWatchNow = () => {
    const nbaStream = streams.find(s => s.title.toLowerCase().includes('nba')) || streams[0];
    if (nbaStream) {
      setSelectedStream(nbaStream);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header 
        searchQuery={searchQuery} 
        onSearchChange={setSearchQuery} 
        countries={countries}
        selectedCountry={selectedCountry}
        onCountryChange={setSelectedCountry}
        categories={categories}
        selectedCategoryId={selectedCategoryId}
        onCategoryChange={setSelectedCategoryId}
      />

      <main className="pt-[110px] lg:pt-[70px]">
        {isLoading ? (
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        ) : (
          <div className="max-w-[1600px] mx-auto">
            {!viewAllCategory && !isViewingAllLive && <HeroSection onWatchNow={handleHeroWatchNow} />}

            {(viewAllCategory || isViewingAllLive) && (
              <div className="container mx-auto px-4 py-8">
                <button 
                  onClick={() => {
                    setViewAllCategory(null);
                    setIsViewingAllLive(false);
                  }}
                  className="mb-6 flex items-center gap-2 text-primary hover:underline font-medium"
                >
                  &larr; Back to Home
                </button>
                <h2 className="text-2xl md:text-3xl font-bold mb-8">
                  {isViewingAllLive ? 'Live Now' : viewAllCategory?.name}
                </h2>
                <div className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6">
                  {filteredStreams.map((stream) => (
                    <ChannelCard
                      key={stream.id}
                      name={stream.title}
                      category={stream.channel_categories || (viewAllCategory?.name || 'Live')}
                      thumbnail={stream.logo || 'https://images.unsplash.com/photo-1549403685-c4fa77cf85aa?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=800'}
                      isLive={true}
                      onClick={() => handleChannelClick(stream)}
                    />
                  ))}
                </div>
                {filteredStreams.length === 0 && (
                  <p className="text-muted-foreground text-center py-20">No channels found matching your filters.</p>
                )}
              </div>
            )}

            {!viewAllCategory && !isViewingAllLive && (
              <>
                <CategorySection title="Live Now" onViewAll={() => setIsViewingAllLive(true)}>
                  {liveStreams.map((stream) => (
                    <ChannelCard
                      key={stream.id}
                      name={stream.title}
                      category={stream.channel_categories || 'General'}
                      thumbnail={stream.logo || 'https://images.unsplash.com/photo-1549403685-c4fa77cf85aa?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=800'}
                      isLive={true}
                      onClick={() => handleChannelClick(stream)}
                    />
                  ))}
                </CategorySection>

                {categoriesWithStreams.map((cat) => (
                  <CategorySection 
                    key={cat.id} 
                    title={cat.name} 
                    onViewAll={() => setViewAllCategory(cat)}
                  >
                    {cat.streams.map((stream) => (
                      <ChannelCard
                        key={stream.id}
                        name={stream.title}
                        category={stream.channel_categories || cat.name}
                        thumbnail={stream.logo || 'https://images.unsplash.com/photo-1549403685-c4fa77cf85aa?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=800'}
                        isLive={false}
                        onClick={() => handleChannelClick(stream)}
                      />
                    ))}
                  </CategorySection>
                ))}
              </>
            )}
          </div>
        )}

        <footer className="border-t border-border mt-16 py-8">
          <div className="container mx-auto px-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
              <div>
                <h4 className="text-foreground mb-4">About Electrohm Haus TV</h4>
                <p className="text-sm text-muted-foreground">
                  Your premium IPTV streaming service with thousands of live channels and on-demand content.
                </p>
              </div>

              <div>
                <h4 className="text-foreground mb-4">Legal</h4>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li><a href="#" className="hover:text-foreground transition-colors">Privacy Policy</a></li>
                  <li><a href="#" className="hover:text-foreground transition-colors">Terms of Service</a></li>
                  <li><a href="#" className="hover:text-foreground transition-colors">DMCA Policy</a></li>
                  <li><a href="#" className="hover:text-foreground transition-colors">Cookie Policy</a></li>
                </ul>
              </div>

              <div>
                <h4 className="text-foreground mb-4">Support</h4>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li><a href="#" className="hover:text-foreground transition-colors">Contact Us</a></li>
                  <li><a href="#" className="hover:text-foreground transition-colors">FAQs</a></li>
                </ul>
              </div>

              <div>
                <h4 className="text-foreground mb-4">Follow Us</h4>
                <div className="flex gap-4">
                  {/* Social icons placeholder */}
                </div>
              </div>
            </div>

            <div className="border-t border-border mt-8 pt-8 text-center text-sm text-muted-foreground">
              <p>&copy; 2026 Electrohm Haus TV. All rights reserved.</p>
            </div>
          </div>
        </footer>
      </main>

      {selectedStream && (
        <VideoPlayer
          stream={selectedStream}
          onClose={() => setSelectedStream(null)}
          onNext={handleNext}
          onPrevious={handlePrevious}
        />
      )}

      {showInstallBanner && (
        <div className="fixed bottom-24 left-4 right-4 z-[60] md:left-auto md:right-8 md:bottom-8 md:w-80">
          <div className="bg-primary text-primary-foreground p-4 rounded-xl shadow-2xl border border-white/10 flex items-center justify-between gap-4">
            <div>
              <p className="font-semibold text-sm">Install Electrohm Haus TV</p>
              <p className="text-xs opacity-90">Access your favorite streams faster on your device.</p>
            </div>
            <div className="flex gap-2 shrink-0">
              <button 
                onClick={() => setShowInstallBanner(false)}
                className="p-1 hover:bg-black/10 rounded-lg text-xs"
              >
                Later
              </button>
              <button 
                onClick={handleInstallClick}
                className="bg-white text-primary px-3 py-1 rounded-lg text-xs font-bold hover:bg-gray-100"
              >
                Install
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
