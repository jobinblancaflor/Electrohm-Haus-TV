import { X, Play, Pause, Volume2, VolumeX, Maximize, Settings, ChevronLeft, ChevronRight, Cast } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import Hls from 'hls.js';

declare global {
  interface Window {
    chrome: any;
    cast: any;
    __onGCastApiAvailable: any;
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
            receiverApplicationId: window.chrome.cast.media.DEFAULT_RECEIVER_APP_ID,
            autoJoinPolicy: window.chrome.cast.AutoJoinPolicy.ORIGIN_SCOPED
          });
          setIsCastAvailable(true);
        } catch (e) {
          console.error('Error setting cast options:', e);
        }
      }
    };

    if (window.chrome && window.chrome.cast && window.chrome.cast.isAvailable) {
      initializeCast();
    } else {
      // The Cast SDK will call this global function when it's ready
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
    const context = window.cast.framework.CastContext.getInstance();
    context.requestSession().then(() => {
      const session = context.getCurrentSession();
      if (session) {
        const mediaInfo = new window.chrome.cast.media.MediaInfo(stream.url, 'application/x-mpegurl');
        mediaInfo.metadata = new window.chrome.cast.media.GenericMediaMetadata();
        mediaInfo.metadata.title = stream.title;
        mediaInfo.metadata.images = [{ url: stream.logo }];
        
        const request = new window.chrome.cast.media.LoadRequest(mediaInfo);
        session.loadMedia(request);
      }
    }).catch((err: any) => {
      console.error('Cast error:', err);
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-6xl">
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
          onClick={togglePlay}
        >
          {error ? (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900 text-white p-4 text-center">
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
              muted={isMuted}
              crossOrigin="anonymous"
              className="w-full h-full"
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
            />
          )}

          <div 
            className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-6 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-4">
              <button
                onClick={onPrevious}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                title="Previous"
              >
                <ChevronLeft className="w-6 h-6 text-white" />
              </button>

              <button
                onClick={togglePlay}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
              >
                {isPlaying ? (
                  <Pause className="w-5 h-5 text-white" />
                ) : (
                  <Play className="w-5 h-5 text-white fill-current" />
                )}
              </button>

              <button
                onClick={onNext}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                title="Next"
              >
                <ChevronRight className="w-6 h-6 text-white" />
              </button>

              <div className="flex items-center gap-2 flex-1">
                <button
                  onClick={toggleMute}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                >
                  {isMuted ? (
                    <VolumeX className="w-5 h-5 text-white" />
                  ) : (
                    <Volume2 className="w-5 h-5 text-white" />
                  )}
                </button>

                <input
                  type="range"
                  min="0"
                  max="100"
                  value={volume}
                  onChange={(e) => handleVolumeChange(Number(e.target.value))}
                  className="w-24 h-1 bg-white/30 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              <div className="flex items-center gap-2">
                {isCastAvailable && (
                  <button 
                    onClick={handleCast}
                    className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                    title="Cast to TV"
                  >
                    <Cast className="w-5 h-5 text-white" />
                  </button>
                )}

                <button className="p-2 hover:bg-white/20 rounded-lg transition-colors">
                  <Settings className="w-5 h-5 text-white" />
                </button>

                <button 
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                  onClick={() => videoRef.current?.requestFullscreen()}
                >
                  <Maximize className="w-5 h-5 text-white" />
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
