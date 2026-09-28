import { useCallback, useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import {
  Cast,
  Check,
  ChevronLeft,
  ChevronRight,
  Loader,
  Maximize,
  Minimize,
  Pause,
  PictureInPicture2,
  Play,
  RotateCw,
  Settings2,
  Share2,
  Star,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import type { Stream } from '../types';
import { channelNumber, countryName } from '../lib/format';

declare global {
  interface Window {
    chrome?: any;
    cast?: any;
    __onGCastApiAvailable?: (isAvailable: boolean) => void;
    isCastApiAvailable?: boolean;
  }
  interface HTMLVideoElement {
    webkitEnterFullscreen?: () => void;
  }
}

interface VideoPlayerProps {
  stream: Stream;
  isFavorite: boolean;
  shareUrl: string;
  onToggleFavorite: (stream: Stream) => void;
  onClose: () => void;
  onNext: () => void;
  onPrevious: () => void;
}

interface TrackOption {
  id: number;
  label: string;
}

const PROGRESSIVE_FILE = /\.(mp4|m4v|webm|ogv|ogg|mp3|aac)(\?|$)/i;
const OFFLINE_MESSAGE = "This channel isn't responding. It may be off air or blocked in your region.";
const INSECURE_MESSAGE = 'This channel only broadcasts over plain http, which browsers block on secure pages.';
const FORMAT_MESSAGE = "This stream uses a format your browser can't play.";

export function VideoPlayer({
  stream,
  isFavorite,
  shareUrl,
  onToggleFavorite,
  onClose,
  onNext,
  onPrevious,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const hlsRef = useRef<Hls | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  // Which backup source is playing, scoped to the channel so a new channel starts at its best source.
  const [source, setSource] = useState({ streamId: stream.id, index: 0 });
  const [levels, setLevels] = useState<TrackOption[]>([]);
  const [level, setLevel] = useState(-1);
  const [audioTracks, setAudioTracks] = useState<TrackOption[]>([]);
  const [audioTrack, setAudioTrack] = useState(-1);
  const [subtitleTracks, setSubtitleTracks] = useState<TrackOption[]>([]);
  const [subtitleTrack, setSubtitleTrack] = useState(-1);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPip, setIsPip] = useState(false);
  const [shareNotice, setShareNotice] = useState<string | null>(null);
  const [castReady, setCastReady] = useState(false);
  const [castDevices, setCastDevices] = useState(false);
  const [isCasting, setIsCasting] = useState(false);
  const [castingTo, setCastingTo] = useState<string | null>(null);

  const sourceIndex = source.streamId === stream.id ? source.index : 0;
  const sourceCount = stream.sources.length;
  const url = stream.sources[sourceIndex] ?? stream.url;
  const pipSupported = typeof document !== 'undefined' && document.pictureInPictureEnabled;

  /** Move on to the next backup source, or give up with a message when none are left. */
  const failSource = useCallback(
    (message: string) => {
      if (sourceIndex + 1 < sourceCount) {
        setSource({ streamId: stream.id, index: sourceIndex + 1 });
      } else {
        setIsBuffering(false);
        setError(message);
      }
    },
    [sourceIndex, sourceCount, stream.id],
  );

  // Load the current source: hls.js where supported, native playback otherwise (Safari/iOS, progressive files).
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    setError(null);
    setIsBuffering(true);
    setLevels([]);
    setLevel(-1);
    setAudioTracks([]);
    setAudioTrack(-1);
    setSubtitleTracks([]);
    setSubtitleTrack(-1);

    if (window.location.protocol === 'https:' && url.startsWith('http:')) {
      failSource(INSECURE_MESSAGE);
      return;
    }

    const play = () => {
      video.play().catch((reason: DOMException) => {
        // Autoplay with sound was blocked: start muted instead of not at all.
        if (reason.name === 'NotAllowedError' && !video.muted) {
          video.muted = true;
          setIsMuted(true);
          video.play().catch(() => setIsPlaying(false));
        } else if (reason.name !== 'AbortError') {
          setIsPlaying(false);
        }
      });
    };

    if (Hls.isSupported() && !PROGRESSIVE_FILE.test(url)) {
      const hls = new Hls({ enableWorker: true, lowLatencyMode: true, backBufferLength: 30 });
      hlsRef.current = hls;
      let mediaRecoveries = 0;

      hls.on(Hls.Events.MANIFEST_PARSED, (_, data) => {
        const options = data.levels
          .map((l, index) => ({ index, height: l.height, bitrate: l.bitrate }))
          .filter((l) => l.height || l.bitrate)
          .sort((a, b) => b.height - a.height || b.bitrate - a.bitrate)
          .map((l) => ({ id: l.index, label: l.height ? `${l.height}p` : `${Math.round(l.bitrate / 1000)} kbps` }));
        setLevels(options.length > 1 ? options : []);
        play();
      });
      hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, (_, data) => {
        const tracks = data.audioTracks.map((t) => ({ id: t.id, label: t.name || t.lang || `Track ${t.id + 1}` }));
        setAudioTracks(tracks.length > 1 ? tracks : []);
        setAudioTrack(hls.audioTrack);
      });
      hls.on(Hls.Events.AUDIO_TRACK_SWITCHED, (_, data) => setAudioTrack(data.id));
      hls.on(Hls.Events.SUBTITLE_TRACKS_UPDATED, (_, data) => {
        setSubtitleTracks(data.subtitleTracks.map((t) => ({ id: t.id, label: t.name || t.lang || `Track ${t.id + 1}` })));
        setSubtitleTrack(hls.subtitleTrack);
      });
      hls.on(Hls.Events.ERROR, (_, data) => {
        if (!data.fatal) return;
        if (data.type === Hls.ErrorTypes.MEDIA_ERROR && mediaRecoveries < 2) {
          mediaRecoveries += 1;
          hls.recoverMediaError();
          return;
        }
        hls.destroy();
        if (hlsRef.current === hls) hlsRef.current = null;
        failSource(data.type === Hls.ErrorTypes.NETWORK_ERROR ? OFFLINE_MESSAGE : FORMAT_MESSAGE);
      });

      hls.loadSource(url);
      hls.attachMedia(video);
      return () => {
        hls.destroy();
        if (hlsRef.current === hls) hlsRef.current = null;
      };
    }

    const onNativeError = () => failSource(OFFLINE_MESSAGE);
    video.src = url;
    video.addEventListener('loadedmetadata', play, { once: true });
    video.addEventListener('error', onNativeError, { once: true });
    video.load();
    return () => {
      video.removeEventListener('loadedmetadata', play);
      video.removeEventListener('error', onNativeError);
      video.removeAttribute('src');
      video.load();
    };
    // failSource is derived from the same values; re-running on its identity would double-load.
  }, [url, retryKey]);

  useEffect(() => {
    if (videoRef.current) videoRef.current.volume = volume;
  }, [volume]);

  useEffect(() => setSettingsOpen(false), [stream.id]);

  const retry = () => {
    setSource({ streamId: stream.id, index: 0 });
    setRetryKey((k) => k + 1);
  };

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video || error) return;
    if (video.paused) video.play().catch(() => setIsPlaying(false));
    else video.pause();
  }, [error]);

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
    if (!video.muted && video.volume === 0) setVolume(0.5);
  }, []);

  const toggleFullscreen = useCallback(() => {
    const frame = frameRef.current;
    const video = videoRef.current;
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else if (frame?.requestFullscreen) {
      frame.requestFullscreen().catch(() => video?.webkitEnterFullscreen?.());
    } else {
      // iPhone Safari only allows the video element itself to go full screen.
      video?.webkitEnterFullscreen?.();
    }
  }, []);

  const togglePip = useCallback(() => {
    const video = videoRef.current;
    if (!video || !document.pictureInPictureEnabled) return;
    if (document.pictureInPictureElement) void document.exitPictureInPicture();
    else video.requestPictureInPicture().catch((reason) => console.error('Picture-in-picture failed:', reason));
  }, []);

  const share = useCallback(async () => {
    const data = { title: `${stream.title} on Electrohm Haus TV`, url: shareUrl };
    try {
      if (navigator.share && (!navigator.canShare || navigator.canShare(data))) {
        await navigator.share(data);
        return;
      }
      await navigator.clipboard.writeText(shareUrl);
      setShareNotice('Link copied');
    } catch (reason) {
      if ((reason as DOMException)?.name === 'AbortError') return;
      setShareNotice("Couldn't copy the link");
    }
    window.setTimeout(() => setShareNotice(null), 2000);
  }, [shareUrl, stream.title]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const enter = () => setIsPip(true);
    const leave = () => setIsPip(false);
    video.addEventListener('enterpictureinpicture', enter);
    video.addEventListener('leavepictureinpicture', leave);
    return () => {
      video.removeEventListener('enterpictureinpicture', enter);
      video.removeEventListener('leavepictureinpicture', leave);
    };
  }, []);

  useEffect(() => {
    const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  // Keyboard: space/K play, M mute, F full screen, P picture-in-picture, arrows or PgUp/PgDn change channel, Esc close.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest('input, select, textarea')) return;
      switch (event.key) {
        case 'Escape':
          if (settingsOpen) setSettingsOpen(false);
          else if (!document.fullscreenElement) onClose();
          return;
        case ' ':
        case 'k':
          if (target?.closest('button')) return;
          event.preventDefault();
          togglePlay();
          return;
        case 'm':
          toggleMute();
          return;
        case 'f':
          toggleFullscreen();
          return;
        case 'p':
          togglePip();
          return;
        case 'ArrowRight':
        case 'PageUp':
          event.preventDefault();
          onNext();
          return;
        case 'ArrowLeft':
        case 'PageDown':
          event.preventDefault();
          onPrevious();
          return;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, onNext, onPrevious, settingsOpen, toggleFullscreen, toggleMute, togglePip, togglePlay]);

  // Lock page scroll and restore focus to whatever opened the player.
  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus?.();
    };
  }, []);

  // Google Cast: the sender SDK loads asynchronously from index.html.
  useEffect(() => {
    let detach: (() => void) | undefined;
    const init = () => {
      const framework = window.cast?.framework;
      const chromeCast = window.chrome?.cast;
      if (!framework || !chromeCast) return;
      const context = framework.CastContext.getInstance();
      try {
        context.setOptions({
          receiverApplicationId: chromeCast.media.DEFAULT_MEDIA_RECEIVER_APP_ID,
          autoJoinPolicy: chromeCast.AutoJoinPolicy.ORIGIN_SCOPED,
          androidReceiverCompatible: true,
        });
      } catch (reason) {
        console.error('Cast setup failed:', reason);
        return;
      }
      const update = () => {
        const state = context.getCastState();
        setCastDevices(state !== framework.CastState.NO_DEVICES_AVAILABLE);
        if (state !== framework.CastState.CONNECTED) setCastingTo(null);
      };
      context.addEventListener(framework.CastContextEventType.CAST_STATE_CHANGED, update);
      update();
      setCastReady(true);
      detach = () => context.removeEventListener(framework.CastContextEventType.CAST_STATE_CHANGED, update);
    };

    if (window.isCastApiAvailable) init();
    else window.addEventListener('castapiready', init, { once: true });
    return () => {
      window.removeEventListener('castapiready', init);
      detach?.();
    };
  }, []);

  const castStream = useCallback(async (target: Stream, targetUrl: string) => {
    const framework = window.cast?.framework;
    const chromeCast = window.chrome?.cast;
    if (!framework || !chromeCast) return;
    const context = framework.CastContext.getInstance();
    setIsCasting(true);
    try {
      if (!context.getCurrentSession()) await context.requestSession();
      const session = context.getCurrentSession();
      if (!session) return;
      const media = new chromeCast.media.MediaInfo(targetUrl, 'application/x-mpegURL');
      media.streamType = chromeCast.media.StreamType.LIVE;
      media.metadata = new chromeCast.media.GenericMediaMetadata();
      media.metadata.title = target.title;
      media.metadata.subtitle = target.channel_categories || 'Live TV';
      if (target.logo) media.metadata.images = [new chromeCast.Image(target.logo)];
      await session.loadMedia(new chromeCast.media.LoadRequest(media));
      videoRef.current?.pause();
      setCastingTo(session.getCastDevice()?.friendlyName ?? 'your TV');
    } catch (reason) {
      if (reason !== 'cancel' && (reason as { code?: string })?.code !== 'cancel') {
        console.error('Cast failed:', reason);
      }
    } finally {
      setIsCasting(false);
    }
  }, []);

  // Keep the TV in sync when changing channels mid-cast.
  useEffect(() => {
    if (castingTo) void castStream(stream, stream.url);
  }, [stream.id]);

  const hasSettings = levels.length > 0 || audioTracks.length > 0 || subtitleTracks.length > 0;

  const selectLevel = (id: number) => {
    setLevel(id);
    if (hlsRef.current) hlsRef.current.currentLevel = id;
  };
  const selectAudio = (id: number) => {
    setAudioTrack(id);
    if (hlsRef.current) hlsRef.current.audioTrack = id;
  };
  const selectSubtitle = (id: number) => {
    setSubtitleTrack(id);
    if (hlsRef.current) {
      hlsRef.current.subtitleDisplay = id !== -1;
      hlsRef.current.subtitleTrack = id;
    }
  };

  const iconButton =
    'flex size-10 shrink-0 items-center justify-center rounded-full text-paper transition-colors hover:bg-white/15 disabled:opacity-40';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Now playing: ${stream.title}`}
      className="fixed inset-0 z-50 overflow-y-auto bg-ink/[0.97] backdrop-blur-md"
    >
      {/* Width is capped by viewport height so the whole picture and its controls fit on short screens. */}
      <div
        className="mx-auto flex min-h-full w-full flex-col justify-center px-3 py-5 md:px-8 md:py-8"
        style={{ maxWidth: 'min(76rem, calc((100dvh - 9rem) * 16 / 9 + 4rem))' }}
      >
        <div className="mb-4 flex items-center gap-3 md:mb-5">
          <span className="flex shrink-0 items-center gap-1.5 rounded-sm bg-onair px-2 py-1 font-mono text-[10px] font-semibold tracking-widest text-white">
            <span className="size-1.5 animate-onair rounded-full bg-white" />
            LIVE
          </span>
          <span className="shrink-0 font-mono text-sm font-semibold text-amber">CH {channelNumber(stream.number)}</span>
          <h2 className="min-w-0 truncate font-display text-2xl leading-none font-extrabold tracking-tight uppercase md:text-4xl">
            {stream.title}
          </h2>
          <div className="ml-auto flex shrink-0 items-center">
            <button
              type="button"
              onClick={() => onToggleFavorite(stream)}
              aria-pressed={isFavorite}
              className={`${iconButton} ${isFavorite ? 'text-amber' : ''}`}
              aria-label={isFavorite ? 'Remove from My channels' : 'Add to My channels'}
              title={isFavorite ? 'Remove from My channels' : 'Add to My channels'}
            >
              <Star className={`size-5 ${isFavorite ? 'fill-current' : ''}`} />
            </button>
            <button type="button" onClick={share} className={iconButton} aria-label="Share channel" title="Share channel">
              <Share2 className="size-5" />
            </button>
            <button ref={closeRef} type="button" onClick={onClose} className={iconButton} aria-label="Close player">
              <X className="size-6" />
            </button>
          </div>
        </div>

        <div
          ref={frameRef}
          className={`relative overflow-hidden bg-black ${
            isFullscreen ? 'flex h-full w-full items-center' : 'aspect-video rounded-xl border border-line'
          }`}
        >
          <video
            ref={videoRef}
            playsInline
            autoPlay
            muted={isMuted}
            className="size-full object-contain"
            onClick={() => (settingsOpen ? setSettingsOpen(false) : togglePlay())}
            onDoubleClick={toggleFullscreen}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onWaiting={() => setIsBuffering(true)}
            onPlaying={() => setIsBuffering(false)}
            onCanPlay={() => setIsBuffering(false)}
            onVolumeChange={(event) => setIsMuted(event.currentTarget.muted)}
          />

          {castingTo && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-ink text-center">
              <Cast className="size-8 text-amber" />
              <p className="text-sm text-dim">Playing on {castingTo}</p>
            </div>
          )}

          {isBuffering && !error && !castingTo && (
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3">
              <Loader className="size-9 animate-spin text-amber" aria-label="Tuning in" />
              {sourceIndex > 0 && (
                <p className="rounded-full bg-black/60 px-3 py-1 font-mono text-[11px] text-paper">
                  Trying backup stream {sourceIndex + 1} of {sourceCount}
                </p>
              )}
            </div>
          )}

          {!isPlaying && !isBuffering && !error && !castingTo && (
            <button
              type="button"
              onClick={togglePlay}
              className="absolute top-1/2 left-1/2 flex size-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-amber text-ink shadow-xl transition hover:scale-105"
              aria-label="Play"
            >
              <Play className="ml-1 size-7 fill-current" />
            </button>
          )}

          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-panel px-6 text-center">
              <p className="font-mono text-[11px] tracking-[0.2em] text-onair uppercase">No signal</p>
              <p className="mt-3 max-w-md text-sm text-paper md:text-base">{error}</p>
              {sourceCount > 1 && (
                <p className="mt-2 font-mono text-[11px] text-dim">All {sourceCount} streams for this channel failed.</p>
              )}
              <div className="mt-6 flex gap-3">
                <button
                  type="button"
                  onClick={retry}
                  className="flex h-10 items-center gap-2 rounded-full border border-line px-5 text-sm font-semibold hover:border-amber hover:text-amber"
                >
                  <RotateCw className="size-4" />
                  Try again
                </button>
                <button
                  type="button"
                  onClick={onNext}
                  className="flex h-10 items-center gap-2 rounded-full bg-amber px-5 text-sm font-semibold text-ink hover:bg-[#ffc56e]"
                >
                  Next channel
                  <ChevronRight className="size-4" />
                </button>
              </div>
            </div>
          )}

          {shareNotice && (
            <p role="status" className="absolute top-3 left-1/2 -translate-x-1/2 rounded-full bg-raised px-4 py-1.5 text-xs font-medium shadow-lg">
              {shareNotice}
            </p>
          )}

          {settingsOpen && hasSettings && (
            <div className="absolute right-2 bottom-16 z-10 w-60 rounded-xl border border-line bg-panel/95 p-2 shadow-2xl backdrop-blur md:right-4">
              {levels.length > 0 && (
                <TrackMenu
                  title="Quality"
                  options={[{ id: -1, label: 'Auto' }, ...levels]}
                  value={level}
                  onSelect={selectLevel}
                />
              )}
              {audioTracks.length > 0 && (
                <TrackMenu title="Audio" options={audioTracks} value={audioTrack} onSelect={selectAudio} />
              )}
              {subtitleTracks.length > 0 && (
                <TrackMenu
                  title="Subtitles"
                  options={[{ id: -1, label: 'Off' }, ...subtitleTracks]}
                  value={subtitleTrack}
                  onSelect={selectSubtitle}
                />
              )}
            </div>
          )}

          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/50 to-transparent px-2 pt-10 pb-2 md:px-4 md:pb-3">
            <div className="flex items-center gap-0.5 md:gap-1">
              <button type="button" onClick={onPrevious} className={iconButton} aria-label="Previous channel">
                <ChevronLeft className="size-5" />
              </button>
              <button type="button" onClick={togglePlay} disabled={Boolean(error)} className={iconButton} aria-label={isPlaying ? 'Pause' : 'Play'}>
                {isPlaying ? <Pause className="size-5 fill-current" /> : <Play className="size-5 fill-current" />}
              </button>
              <button type="button" onClick={onNext} className={iconButton} aria-label="Next channel">
                <ChevronRight className="size-5" />
              </button>

              <button type="button" onClick={toggleMute} className={`${iconButton} ml-1 md:ml-3`} aria-label={isMuted ? 'Unmute' : 'Mute'}>
                {isMuted || volume === 0 ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={isMuted ? 0 : volume}
                onChange={(event) => {
                  const next = Number(event.target.value);
                  setVolume(next);
                  if (videoRef.current) videoRef.current.muted = next === 0;
                  setIsMuted(next === 0);
                }}
                aria-label="Volume"
                className="range-amber hidden w-24 xs:block md:w-28"
              />

              <div className="ml-auto flex items-center gap-0.5 md:gap-1">
                {hasSettings && (
                  <button
                    type="button"
                    onClick={() => setSettingsOpen((open) => !open)}
                    aria-expanded={settingsOpen}
                    className={`${iconButton} ${settingsOpen ? 'text-amber' : ''}`}
                    aria-label="Quality, audio and subtitles"
                    title="Quality, audio and subtitles"
                  >
                    <Settings2 className="size-5" />
                  </button>
                )}
                {pipSupported && (
                  <button
                    type="button"
                    onClick={togglePip}
                    disabled={Boolean(error)}
                    className={`${iconButton} ${isPip ? 'text-amber' : ''}`}
                    aria-label={isPip ? 'Exit picture-in-picture' : 'Picture-in-picture'}
                    title="Picture-in-picture"
                  >
                    <PictureInPicture2 className="size-5" />
                  </button>
                )}
                {castReady && (
                  <button
                    type="button"
                    onClick={() => void castStream(stream, url)}
                    disabled={isCasting}
                    className={`${iconButton} ${castingTo ? 'text-amber' : ''} ${isCasting ? 'animate-pulse' : ''}`}
                    aria-label={castingTo ? `Casting to ${castingTo}` : castDevices ? 'Cast to TV' : 'Cast to TV (no devices found)'}
                    title={castDevices ? 'Cast to TV' : 'No Cast devices found on your network'}
                  >
                    <Cast className="size-5" />
                  </button>
                )}
                <button type="button" onClick={toggleFullscreen} className={iconButton} aria-label={isFullscreen ? 'Exit full screen' : 'Full screen'}>
                  {isFullscreen ? <Minimize className="size-5" /> : <Maximize className="size-5" />}
                </button>
              </div>
            </div>
          </div>
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 rounded-xl border border-line bg-panel p-4 text-sm md:grid-cols-4 md:p-5">
          <Detail term="Channel" value={`CH ${channelNumber(stream.number)}`} mono />
          <Detail term="Country" value={countryName(stream.channel_country)} />
          <Detail term="Category" value={stream.channel_categories || 'General'} />
          <Detail
            term="Stream"
            value={`${levels[0]?.label ?? stream.quality ?? 'Auto'}${sourceCount > 1 ? ` · ${sourceIndex + 1} of ${sourceCount}` : ''}`}
            mono
          />
        </dl>
        <p className="mt-3 hidden font-mono text-[10px] tracking-wider text-dim uppercase md:block">
          Space play/pause · M mute · F full screen · P picture-in-picture · ← → change channel · 0–9 go to channel · Esc close
        </p>
      </div>
    </div>
  );
}

function TrackMenu({
  title,
  options,
  value,
  onSelect,
}: {
  title: string;
  options: TrackOption[];
  value: number;
  onSelect: (id: number) => void;
}) {
  return (
    <div role="group" aria-label={title} className="py-1 [&+&]:mt-1 [&+&]:border-t [&+&]:border-line [&+&]:pt-2">
      <p className="px-2 pb-1 font-mono text-[10px] tracking-[0.18em] text-dim uppercase">{title}</p>
      <div className="max-h-40 overflow-y-auto">
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => onSelect(option.id)}
            aria-pressed={option.id === value}
            className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-sm hover:bg-raised"
          >
            {option.label}
            {option.id === value && <Check className="size-4 text-amber" />}
          </button>
        ))}
      </div>
    </div>
  );
}

function Detail({ term, value, mono }: { term: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="font-mono text-[10px] tracking-[0.18em] text-dim uppercase">{term}</dt>
      <dd className={`mt-1 truncate text-paper ${mono ? 'font-mono text-[13px]' : ''}`}>{value}</dd>
    </div>
  );
}
