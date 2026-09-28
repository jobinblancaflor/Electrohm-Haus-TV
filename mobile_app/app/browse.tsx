import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { FlashList } from '@shopify/flash-list';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { countryInSentence, countryName, formatCount } from '@shared/lib/format';
import { filterStreams } from '@shared/lib/selectors';
import { useCatalog } from '../src/catalog/CatalogProvider';
import { usePlay } from '../src/catalog/usePlay';
import { ChannelCard } from '../src/components/ChannelCard';
import { colors, fonts } from '../src/theme';

const GAP = 12;
const SIDE = 16;

/** Deep links can repeat a key; use the first value. */
function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function columnsFor(width: number) {
  if (width < 600) return 2;
  if (width < 900) return 3;
  return 4;
}

export default function BrowseScreen() {
  const params = useLocalSearchParams<{ categoryId?: string | string[]; query?: string | string[] }>();
  const categoryId = firstParam(params.categoryId) || 'all';
  const query = (firstParam(params.query) ?? '').trim();
  const { pool, categories, country, setCountry, languages, language, setLanguage } = useCatalog();
  const play = usePlay();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const streams = useMemo(() => filterStreams(pool, categoryId, query), [pool, categoryId, query]);
  const category = categories.find((c) => c.id === categoryId);
  const columns = columnsFor(width);
  const place = country === 'All' ? null : countryInSentence(country);
  const languageName = languages.find((l) => l.code === language)?.name;

  const title = query ? `"${query}"` : (category?.name ?? (country === 'All' ? 'All channels' : countryName(country)));
  const emptyMessage = `No channels match${query ? ` "${query}"` : ''}${category ? ` in ${category.name}` : ''}${
    languageName ? ` in ${languageName}` : ''
  }${place ? ` from ${place}` : ''}. Check the spelling or clear the filters.`;

  const clearFilters = () => {
    setCountry('All');
    setLanguage('All');
    router.back();
  };

  return (
    <View style={styles.screen}>
      <FlashList
        key={columns}
        data={streams}
        numColumns={columns}
        keyExtractor={(s) => s.id}
        contentContainerStyle={{ paddingHorizontal: SIDE - GAP / 2, paddingBottom: insets.bottom + 24 }}
        ListHeaderComponent={
          <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
            <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Back to home" style={styles.back}>
              <Ionicons name="arrow-back" size={18} color={colors.dim} />
              <Text style={styles.backLabel}>Home</Text>
            </Pressable>
            <Text style={styles.title} numberOfLines={2}>
              {title}
            </Text>
            <Text style={styles.count}>
              {formatCount(streams.length)} {streams.length === 1 ? 'channel' : 'channels'}
            </Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>{emptyMessage}</Text>
            <Pressable onPress={clearFilters} accessibilityRole="button" style={({ pressed }) => [styles.clear, pressed && styles.pressed]}>
              <Text style={styles.clearLabel}>Clear filters</Text>
            </Pressable>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.cell}>
            <ChannelCard stream={item} onPress={(s) => play(s, streams)} />
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ink },
  header: { paddingHorizontal: GAP / 2, paddingBottom: 18 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, alignSelf: 'flex-start' },
  backLabel: { fontFamily: fonts.sansMedium, fontSize: 14, color: colors.dim },
  title: {
    marginTop: 6,
    fontFamily: fonts.displayBlack,
    fontSize: 40,
    lineHeight: 40,
    color: colors.paper,
    textTransform: 'uppercase',
  },
  count: {
    marginTop: 8,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1,
    color: colors.dim,
    textTransform: 'uppercase',
  },
  cell: { flex: 1, paddingHorizontal: GAP / 2, paddingBottom: 20 },
  empty: { alignItems: 'center', paddingVertical: 80, paddingHorizontal: 24 },
  emptyText: { fontFamily: fonts.sans, fontSize: 15, color: colors.dim, textAlign: 'center' },
  clear: {
    marginTop: 18,
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 20,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.line,
  },
  clearLabel: { fontFamily: fonts.sansSemiBold, fontSize: 14, color: colors.paper },
  pressed: { opacity: 0.7 },
});
