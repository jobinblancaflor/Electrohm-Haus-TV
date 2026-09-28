import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Stream } from '@shared/types';
import { channelNumber, countryName, primaryCategory } from '@shared/lib/format';
import { colors, fonts } from '../theme';
import { ChannelLogo } from './ChannelLogo';

interface ChannelCardProps {
  stream: Stream;
  onPress: (stream: Stream) => void;
  /** Fixed width for horizontal rails; grids let the card fill its cell. */
  width?: number;
}

export function ChannelCard({ stream, onPress, width }: ChannelCardProps) {
  return (
    <Pressable
      onPress={() => onPress(stream)}
      accessibilityRole="button"
      accessibilityLabel={`Watch ${stream.title}`}
      style={({ pressed }) => [width ? { width } : styles.fill, pressed && styles.pressed]}
    >
      <View style={styles.plate}>
        <Text style={styles.number}>CH {channelNumber(stream.number)}</Text>
        {stream.channel_country ? <Text style={styles.country}>{stream.channel_country}</Text> : null}
        <ChannelLogo uri={stream.logo} name={stream.title} style={styles.logo} monogramSize={26} />
      </View>
      <Text numberOfLines={1} style={styles.title}>
        {stream.title}
      </Text>
      <Text numberOfLines={1} style={styles.meta}>
        {primaryCategory(stream.channel_categories)} · {countryName(stream.channel_country)}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  pressed: { opacity: 0.75 },
  plate: {
    aspectRatio: 16 / 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panel,
  },
  number: { position: 'absolute', top: 7, left: 9, fontFamily: fonts.mono, fontSize: 9, color: colors.dim },
  country: { position: 'absolute', top: 7, right: 9, fontFamily: fonts.mono, fontSize: 9, color: colors.dim },
  logo: { position: 'absolute', left: 20, right: 20, top: 24, bottom: 14 },
  title: { marginTop: 8, fontFamily: fonts.sansSemiBold, fontSize: 14, color: colors.paper },
  meta: { fontFamily: fonts.sans, fontSize: 12, color: colors.dim },
});
