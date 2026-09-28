import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEvent, useEventListener } from 'expo';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { channelNumber } from '@shared/lib/format';
import { useCatalog } from '../../src/catalog/CatalogProvider';
import { NoSignal } from '../../src/components/NoSignal';
import { AttemptTracker, attemptId } from '../../src/player/attempt';
import { videoSource } from '../../src/player/source';
import { colors, fonts } from '../../src/theme';

const HIDE_CONTROLS_MS = 4000;
const OFFLINE_MESSAGE = "This channel isn't responding. It may be off air or blocked in your region.";

export default function PlayerScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  // Deep links can repeat a key; use the first value.
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const { load, findStream, queue, pool } = useCatalog();
  const stream = id ? findStream(id) : undefined;
  const insets = useSafeAreaInsets();

  const player = useVideoPlayer(null, (p) => {
    p.keepScreenOnWhilePlaying = true;
  });
  const { status } = useEvent(player, 'statusChange', { status: player.status });
  const { isPlaying } = useEvent(player, 'playingChange', { isPlaying: player.playing });

  // Which backup source is playing, scoped to the channel so a new channel starts at its best source.
  const [source, setSource] = useState({ streamId: '', index: 0 });
  const [retryKey, setRetryKey] = useState(0);
  const [failed, setFailed] = useState(false);
  const [muted, setMuted] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const sourceIndex = stream && source.streamId === stream.id ? source.index : 0;
  const sourceCount = stream?.sources.length ?? 0;

  // A stale link or refreshed catalog can point at a channel that no longer exists.
  useEffect(() => {
    if (load.status === 'ready' && !stream) router.replace('/');
  }, [load.status, stream]);

  const advance = useCallback(() => {
    if (!stream) return;
    if (sourceIndex + 1 < stream.sources.length) setSource({ streamId: stream.id, index: sourceIndex + 1 });
    else setFailed(true);
  }, [stream, sourceIndex]);
  // Player events outlive renders; always call the latest advance.
  const advanceRef = useRef(advance);
  advanceRef.current = advance;

  // Scopes each replaceAsync to one attempt, so a rejection and a statusChange error
  // for the same failed load only advance once, and a late error for a superseded
  // attempt (previous source or channel) never advances the current one.
  const tracker = useRef(new AttemptTracker()).current;

  useEffect(() => {
    if (!stream) return;
    let cancelled = false;
    setFailed(false);
    const attempt = attemptId(stream.id, sourceIndex, retryKey);
    tracker.start(attempt);
    player
      .replaceAsync(videoSource(stream, stream.sources[sourceIndex] ?? stream.url))
      .then(() => {
        if (cancelled) return;
        tracker.markReady(attempt);
        player.play();
      })
      .catch(() => {
        if (!cancelled) tracker.fail(attempt, () => advanceRef.current());
      });
    return () => {
      cancelled = true;
    };
  }, [player, stream?.id, sourceIndex, retryKey, tracker]);

  useEventListener(player, 'statusChange', ({ status: next }) => {
    // An error before the current attempt's replaceAsync resolves belongs to the
    // previous source and surfaces through its own rejection handler instead.
    if (next === 'error' && tracker.isCurrentAttemptReady()) {
      const attempt = tracker.currentAttempt();
      if (attempt) tracker.fail(attempt, () => advanceRef.current());
    }
  });

  useEffect(() => {
    player.muted = muted;
  }, [player, muted]);

  const showControls = useCallback(() => {
    setControlsVisible(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setControlsVisible(false), HIDE_CONTROLS_MS);
  }, []);

  useEffect(() => {
    showControls();
    return () => clearTimeout(hideTimer.current);
  }, [showControls, stream?.id]);

  const list = queue.length ? queue : pool;
  const step = (direction: 1 | -1) => {
    if (!stream || list.length === 0) return;
    const index = list.findIndex((s) => s.id === stream.id);
    const next = list[(index + direction + list.length) % list.length];
    router.setParams({ id: next.id });
    showControls();
  };

  const retry = () => {
    if (!stream) return;
    setSource({ streamId: stream.id, index: 0 });
    setRetryKey((k) => k + 1);
  };

  const togglePlay = () => {
    if (isPlaying) player.pause();
    else player.play();
    showControls();
  };

  if (!stream) {
    return (
      <View style={[styles.screen, styles.center]}>
        <ActivityIndicator size="large" color={colors.amber} />
      </View>
    );
  }

  const showOverlay = controlsVisible || failed;

  return (
    <View style={styles.screen}>
      <StatusBar hidden />
      <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="contain" nativeControls={false} />
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={() => (controlsVisible ? setControlsVisible(false) : showControls())}
        accessibilityLabel={controlsVisible ? 'Hide controls' : 'Show controls'}
      />

      {status === 'loading' && !failed ? (
        <View style={[StyleSheet.absoluteFill, styles.center, { pointerEvents: 'none' }]}>
          <ActivityIndicator size="large" color={colors.amber} accessibilityLabel="Tuning in" />
          {sourceIndex > 0 ? (
            <Text style={styles.backup}>
              Trying backup stream {sourceIndex + 1} of {sourceCount}
            </Text>
          ) : null}
        </View>
      ) : null}

      {failed ? (
        <NoSignal
          style={[StyleSheet.absoluteFill, styles.failed]}
          message={OFFLINE_MESSAGE}
          detail={sourceCount > 1 ? `All ${sourceCount} streams for this channel failed.` : undefined}
          actions={[
            { label: 'Try again', onPress: retry },
            { label: 'Next channel', onPress: () => step(1), primary: true },
          ]}
        />
      ) : null}

      {showOverlay ? (
        <>
          <View style={[styles.topBar, { paddingTop: insets.top + 8, paddingLeft: insets.left + 12, paddingRight: insets.right + 12 }]}>
            <IconButton name="arrow-back" label="Close player" onPress={() => router.back()} />
            <View style={styles.live}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>LIVE</Text>
            </View>
            <Text style={styles.channel}>CH {channelNumber(stream.number)}</Text>
            <Text style={styles.title} numberOfLines={1}>
              {stream.title}
            </Text>
          </View>
          {!failed ? (
            <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12, paddingLeft: insets.left + 12, paddingRight: insets.right + 12 }]}>
              <IconButton name="play-skip-back" label="Previous channel" onPress={() => step(-1)} />
              <IconButton name={isPlaying ? 'pause' : 'play'} label={isPlaying ? 'Pause' : 'Play'} onPress={togglePlay} large />
              <IconButton name="play-skip-forward" label="Next channel" onPress={() => step(1)} />
              <View style={styles.spacer} />
              <IconButton
                name={muted ? 'volume-mute' : 'volume-high'}
                label={muted ? 'Unmute' : 'Mute'}
                onPress={() => {
                  setMuted((m) => !m);
                  showControls();
                }}
              />
            </View>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

function IconButton({
  name,
  label,
  onPress,
  large = false,
}: {
  name: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  large?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      style={({ pressed }) => [styles.iconButton, large && styles.iconButtonLarge, pressed && styles.pressed]}
    >
      <Ionicons name={name} size={large ? 28 : 22} color={large ? colors.ink : colors.paper} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000' },
  center: { alignItems: 'center', justifyContent: 'center' },
  backup: {
    marginTop: 12,
    overflow: 'hidden',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.paper,
  },
  failed: { backgroundColor: colors.panel },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingBottom: 24,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  live: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 3, backgroundColor: colors.onair, paddingHorizontal: 7, paddingVertical: 3 },
  liveDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#fff' },
  liveText: { fontFamily: fonts.monoSemiBold, fontSize: 9, letterSpacing: 2, color: '#fff' },
  channel: { fontFamily: fonts.monoSemiBold, fontSize: 13, color: colors.amber },
  title: { flex: 1, fontFamily: fonts.display, fontSize: 24, color: colors.paper, textTransform: 'uppercase' },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 28,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  spacer: { flex: 1 },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22 },
  iconButtonLarge: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.amber },
  pressed: { opacity: 0.6 },
});
