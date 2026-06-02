import { X, Play, Pause, Volume2, VolumeX, Maximize, Settings, ChevronLeft, ChevronRight, Cast } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import Hls from 'hls.js';

declare global {
  interface Window {
    chrome: any;
    cast: any;
    __onGCastApiAvailable: any;
    isCastApiAvailable: boolean;
  }
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

interface VideoPlayerProps {
  stream: Stream;
  onClose: () => void;
  onNext: () => void;
  onPrevious: () => void;
}

export function VideoPlayer({ stream, onClose, onNext, onPrevious }: VideoPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [isCastAvailable, setIsCastAvailable] = useState(false);
  const [isCasting, setIsCasting] = useState(false);
  const [volume, setVolume] = useState(75);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);

  useEffect(() => {
    const initializeCast = () => {
      if (window.cast && window.cast.framework) {
        const context = window.cast.framework.CastContext.getInstance();
        try {
          context.setOptions({
            receiverApplicationId: 'CC1AD845', // Default Media Receiver
            autoJoinPolicy: window.chrome.cast.AutoJoinPolicy.ORIGIN_SCOPED,
            androidReceiverCompatible: true
          });

          // Update availability based on cast state
          const updateCastState = () => {
            const state = context.getCastState();
            setIsCastAvailable(state !== window.cast.framework.CastState.NO_DEVICES_AVAILABLE);
          };

          context.addEventListener(window.cast.framework.CastContextEventType.CAST_STATE_CHANGED, updateCastState);
          updateCastState();
        } catch (e) {
          console.error('Error setting cast options:', e);
        }
      }
    };

    if (window.isCastApiAvailable || (window.chrome && window.chrome.cast && window.chrome.cast.isAvailable)) {
      initializeCast();
    } else {
      window.__onGCastApiAvailable = (isAvailable: boolean) => {
        if (isAvailable) {
          initializeCast();
        }
      };
    }
  }, []);

  useEffect(() => {
    setError(null);
    const video = videoRef.current;
    if (!video) return;

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    const streamUrl = stream.url;
    const isHls = /\.m3u8(\?|$)/i.test(streamUrl);

    const playVideo = () => {
      const promise = video.play();
      if (promise !== undefined) {
        promise.catch(error => {
          console.log("Autoplay prevented:", error);
          setIsPlaying(false);
        });
      }
    };

    if (isHls && Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
      });
      hlsRef.current = hls;
      hls.loadSource(streamUrl);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        playVideo();
      });
      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              setError('Network error. The stream might be offline or geo-blocked.');
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError();
              break;
            default:
              setError('Playback failed. This stream may not be compatible with your device.');
              break;
          }
        }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = streamUrl;
      video.addEventListener('loadedmetadata', playVideo);
      return () => video.removeEventListener('loadedmetadata', playVideo);
    } else {
      video.src = streamUrl;
      playVideo();
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
      }
    };
  }, [stream.url]);

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handleVolumeChange = (newVolume: number) => {
    setVolume(newVolume);
    if (videoRef.current) {
      videoRef.current.volume = newVolume / 100;
    }
  };

  const handleCast = () => {
    if (!window.cast || !window.cast.framework) return;

    setIsCasting(true);
    const context = window.cast.framework.CastContext.getInstance();
    
    context.requestSession().then(() => {
      setIsCasting(false);
      const session = context.getCurrentSession();
      if (session) {
        const mediaInfo = new window.chrome.cast.media.MediaInfo(stream.url, 'application/x-mpegurl');
        mediaInfo.metadata = new window.chrome.cast.media.GenericMediaMetadata();
        mediaInfo.metadata.title = stream.title;
        mediaInfo.metadata.subtitle = stream.channel_categories || 'Live Stream';
        mediaInfo.metadata.images = [{ url: stream.logo }];
        
        const loadRequest = new window.chrome.cast.media.LoadRequest(mediaInfo);
        session.loadMedia(loadRequest);
      }
    }).catch((err: any) => {
      setIsCasting(false);
      if (err !== 'cancel' && err !== 'error') {
        console.error('Cast error:', err);
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-sm overflow-y-auto p-4 md:p-8">
      <div className="w-full max-w-6xl mx-auto min-h-full flex flex-col justify-center py-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-red-600 text-white px-3 py-1 rounded">
              <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
              <span className="text-sm">LIVE</span>
            </div>
            <h3 className="text-white text-xl">{stream.title}</h3>
          </div>

          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-6 h-6 text-white" />
          </button>
        </div>

        <div 
          className="relative aspect-video bg-black rounded-lg overflow-hidden group cursor-pointer"
          style={{ isolation: 'isolate' }}
          onClick={togglePlay}
        >
          {error ? (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-gray-900 text-white p-4 text-center">
              <div>
                <p className="text-lg mb-2">Oops!</p>
                <p className="text-white/70 mb-4">{error}</p>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    window.location.reload();
                  }}
                  className="bg-primary text-white px-4 py-2 rounded-lg text-sm hover:bg-primary/90 transition-colors"
                >
                  Retry Connection
                </button>
              </div>
            </div>
          ) : (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              webkit-playsinline="true"
              muted={isMuted}
              crossOrigin="anonymous"
              className="w-full h-full relative z-0"
              style={{ WebkitOverflowScrolling: 'touch' }}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
            />
          )}

          <div 
            className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-4 md:p-6 transition-opacity z-20"
            style={{ 
              opacity: 1, 
              transform: 'translateZ(0)',
              WebkitBackfaceVisibility: 'hidden',
              WebkitTransform: 'translateZ(0)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 md:gap-4 overflow-x-auto no-scrollbar">
              <button
                onClick={onPrevious}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors shrink-0"
                title="Previous"
              >
                <ChevronLeft className="w-5 h-5 md:w-6 md:h-6 text-white" />
              </button>

              <button
                onClick={togglePlay}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors shrink-0"
              >
                {isPlaying ? (
                  <Pause className="w-4 h-4 md:w-5 md:h-5 text-white" />
                ) : (
                  <Play className="w-4 h-4 md:w-5 md:h-5 text-white fill-current" />
                )}
              </button>

              <button
                onClick={onNext}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors shrink-0"
                title="Next"
              >
                <ChevronRight className="w-5 h-5 md:w-6 md:h-6 text-white" />
              </button>

              <div className="flex items-center gap-2 flex-1 min-w-[100px]">
                <button
                  onClick={toggleMute}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors shrink-0"
                >
                  {isMuted ? (
                    <VolumeX className="w-4 h-4 md:w-5 md:h-5 text-white" />
                  ) : (
                    <Volume2 className="w-4 h-4 md:w-5 md:h-5 text-white" />
                  )}
                </button>

                <input
                  type="range"
                  min="0"
                  max="100"
                  value={volume}
                  onChange={(e) => handleVolumeChange(Number(e.target.value))}
                  className="w-full max-w-[80px] md:max-w-[120px] h-1 bg-white/30 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              <div className="flex items-center gap-1 md:gap-2 shrink-0">
                {/* Cast Icon */}
                {(isCastAvailable || (window.chrome && window.chrome.cast)) && (
                  <button 
                    onClick={handleCast}
                    className={`p-2 hover:bg-white/20 rounded-lg transition-colors ${isCasting ? 'animate-pulse text-primary' : 'text-white'}`}
                    title="Cast to TV"
                    disabled={isCasting}
                  >
                    <Cast className="w-4 h-4 md:w-5 md:h-5" />
                  </button>
                )}

                <button className="p-2 hover:bg-white/20 rounded-lg transition-colors">
                  <Settings className="w-4 h-4 md:w-5 md:h-5 text-white" />
                </button>

                <button 
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                  onClick={() => videoRef.current?.requestFullscreen()}
                >
                  <Maximize className="w-4 h-4 md:w-5 md:h-5 text-white" />
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 p-4 bg-white/5 rounded-lg">
          <h4 className="text-white mb-2">Stream Details</h4>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-white/50">Quality</p>
              <p className="text-white">{stream.quality || 'N/A'}</p>
            </div>
            <div>
              <p className="text-white/50">Country</p>
              <p className="text-white">{stream.channel_country || 'N/A'}</p>
            </div>
            <div>
              <p className="text-white/50">Categories</p>
              <p className="text-white">{stream.channel_categories || 'N/A'}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
