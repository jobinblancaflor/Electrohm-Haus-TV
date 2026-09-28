import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Stream } from '@shared/types';
import { formatCount } from '@shared/lib/format';
import { colors, fonts } from '../theme';
import { ChannelCard } from './ChannelCard';

const CARD_WIDTH = 164;

interface RailProps {
  title: string;
  streams: Stream[];
  total?: number;
  onSelect: (stream: Stream) => void;
  onSeeAll?: () => void;
}

/** One horizontal row of channels on the home screen (at most 16, so no virtualization needed). */
export function Rail({ title, streams, total, onSelect, onSeeAll }: RailProps) {
  return (
    <View style={styles.section}>
      <View style={styles.head}>
        <Text style={styles.title}>{title}</Text>
        {onSeeAll ? (
          <Pressable onPress={onSeeAll} hitSlop={12} accessibilityRole="button" accessibilityLabel={`See all ${title}`}>
            <Text style={styles.seeAll}>
              See all{total ? <Text style={styles.total}> {formatCount(total)}</Text> : null} →
            </Text>
          </Pressable>
        ) : null}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {streams.map((stream) => (
          <ChannelCard key={stream.id} stream={stream} onPress={onSelect} width={CARD_WIDTH} />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { paddingVertical: 14 },
  head: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  title: { fontFamily: fonts.display, fontSize: 26, lineHeight: 28, color: colors.paper, textTransform: 'uppercase' },
  seeAll: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.dim },
  total: { fontFamily: fonts.mono, fontSize: 11 },
  row: { gap: 12, paddingHorizontal: 16 },
});
