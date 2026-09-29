import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { Stream } from '@shared/types';
import { channelNumber, countryName, formatCount, primaryCategory } from '@shared/lib/format';
import { colors, fonts } from '../theme';
import { ChannelLogo } from './ChannelLogo';

const ROLL_STEPS = 12;
const ROLL_INTERVAL_MS = 55;

function pick(pool: Stream[], avoid?: Stream | null) {
  if (pool.length === 0) return null;
  if (pool.length === 1) return pool[0];
  let next = pool[Math.floor(Math.random() * pool.length)];
  while (next.id === avoid?.id) next = pool[Math.floor(Math.random() * pool.length)];
  return next;
}

interface TunerProps {
  pool: Stream[];
  totalChannels: number;
  totalCountries: number;
  countryLabel: string | null;
  onWatch: (stream: Stream) => void;
}

/** The hero: a tuner readout parked on a random channel. "Surf" rolls the dial and lands somewhere new. */
export function Tuner({ pool, totalChannels, totalCountries, countryLabel, onWatch }: TunerProps) {
  const [current, setCurrent] = useState<Stream | null>(() => pick(pool));
  const [rollingNumber, setRollingNumber] = useState<number | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const busy = useRef(false);

  // Re-tune when the pool changes (e.g. another country).
  useEffect(() => {
    setCurrent((previous) => (previous && pool.some((s) => s.id === previous.id) ? previous : pick(pool)));
  }, [pool]);

  useEffect(() => () => clearInterval(timer.current), []);

  const surf = async () => {
    if (busy.current || pool.length < 2) return;
    const target = pick(pool, current);
    if (!target) return;
    busy.current = true;
    if (await AccessibilityInfo.isReduceMotionEnabled()) {
      setCurrent(target);
      busy.current = false;
      return;
    }
    const max = pool[pool.length - 1].number;
    let step = 0;
    setRollingNumber(current?.number ?? 1);
    timer.current = setInterval(() => {
      step += 1;
      if (step >= ROLL_STEPS) {
        clearInterval(timer.current);
        setRollingNumber(null);
        setCurrent(target);
        busy.current = false;
        return;
      }
      setRollingNumber(1 + Math.floor(Math.random() * max));
    }, ROLL_INTERVAL_MS);
  };

  const rolling = rollingNumber !== null;
  const shownNumber = rollingNumber ?? current?.number ?? 0;

  return (
    <View style={styles.section}>
      <View style={styles.eyebrow}>
        <View style={styles.dot} />
        <Text style={[styles.eyebrowText, { color: colors.onair }]}>On air</Text>
        <Text style={styles.eyebrowText}>{formatCount(totalChannels)} channels</Text>
        <Text style={styles.eyebrowText}>·</Text>
        <Text style={styles.eyebrowText}>{countryLabel ?? `${formatCount(totalCountries)} countries`}</Text>
      </View>
      <Text style={styles.headline}>Tune in to</Text>
      <Text style={[styles.headline, styles.headlineAccent]}>{countryLabel ?? 'the world'}.</Text>

      <View style={styles.panel}>
        <View style={styles.panelTop}>
          <View>
            <Text style={styles.label}>Tuned to</Text>
            <Text
              style={[styles.readout, rolling && styles.readoutRolling]}
              accessibilityLabel={`Channel ${shownNumber}`}
              accessibilityLiveRegion="polite"
            >
              CH {channelNumber(shownNumber)}
            </Text>
          </View>
          <ChannelLogo
            uri={rolling ? '' : (current?.logo ?? '')}
            name={rolling ? '··' : (current?.title ?? '')}
            style={styles.logoPlate}
            monogramSize={22}
          />
        </View>
        <View style={styles.divider} />
        {current ? (
          <View style={rolling ? styles.dimmed : undefined}>
            <Text style={styles.title} numberOfLines={1}>
              {current.title}
            </Text>
            <Text style={styles.meta}>
              {primaryCategory(current.channel_categories)} · {countryName(current.channel_country)}
            </Text>
          </View>
        ) : (
          <Text style={styles.meta}>No channels to tune to. Try another country.</Text>
        )}
        <View style={styles.buttons}>
          <Pressable
            onPress={() => current && onWatch(current)}
            disabled={!current || rolling}
            accessibilityRole="button"
            style={({ pressed }) => [styles.watch, (pressed || !current || rolling) && styles.pressed]}
          >
            <Ionicons name="play" size={16} color={colors.ink} />
            <Text style={styles.watchLabel}>Watch</Text>
          </Pressable>
          <Pressable
            onPress={surf}
            disabled={pool.length < 2 || rolling}
            accessibilityRole="button"
            style={({ pressed }) => [styles.surf, (pressed || rolling) && styles.pressed]}
          >
            <Ionicons name="shuffle" size={16} color={colors.paper} />
            <Text style={styles.surfLabel}>Surf</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { paddingHorizontal: 16, paddingTop: 18, paddingBottom: 12 },
  eyebrow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 12 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.onair },
  eyebrowText: { fontFamily: fonts.mono, fontSize: 10, letterSpacing: 1, color: colors.dim, textTransform: 'uppercase' },
  headline: { fontFamily: fonts.displayBlack, fontSize: 56, lineHeight: 52, color: colors.paper, textTransform: 'uppercase' },
  headlineAccent: { color: colors.amber },
  panel: {
    marginTop: 22,
    padding: 18,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panel,
  },
  panelTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  label: { fontFamily: fonts.mono, fontSize: 10, letterSpacing: 2, color: colors.dim, textTransform: 'uppercase' },
  readout: { marginTop: 4, fontFamily: fonts.monoSemiBold, fontSize: 42, lineHeight: 50, color: colors.amber },
  readoutRolling: { opacity: 0.6 },
  logoPlate: {
    width: 76,
    height: 76,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.raised,
  },
  divider: { height: 1, backgroundColor: colors.line, marginVertical: 16 },
  dimmed: { opacity: 0.3 },
  title: { fontFamily: fonts.display, fontSize: 30, lineHeight: 32, color: colors.paper, textTransform: 'uppercase' },
  meta: { marginTop: 4, fontFamily: fonts.sans, fontSize: 13, color: colors.dim },
  buttons: { flexDirection: 'row', gap: 12, marginTop: 18 },
  watch: {
    flex: 1,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 999,
    backgroundColor: colors.amber,
  },
  watchLabel: { fontFamily: fonts.sansSemiBold, fontSize: 15, color: colors.ink },
  surf: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 22,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.line,
  },
  surfLabel: { fontFamily: fonts.sansSemiBold, fontSize: 15, color: colors.paper },
  pressed: { opacity: 0.6 },
});
