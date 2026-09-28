import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { countryInSentence, countryName, formatCount } from '@shared/lib/format';
import { homeRails } from '@shared/lib/selectors';
import { useCatalog } from '../src/catalog/CatalogProvider';
import { usePlay } from '../src/catalog/usePlay';
import { Chip } from '../src/components/Chip';
import { FilterSheet, type FilterOption } from '../src/components/FilterSheet';
import { NoSignal } from '../src/components/NoSignal';
import { Rail } from '../src/components/Rail';
import { Tuner } from '../src/components/Tuner';
import { colors, fonts } from '../src/theme';
import { Banner } from '../src/ads/Banner';
import { useAds } from '../src/ads/AdsProvider';

const HOME_CATEGORIES = 6;
const RAIL_SIZE = 16;

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { load, retry, pool, countries, country, setCountry, languages, language, setLanguage, categories } = useCatalog();
  const play = usePlay();
  const { privacyOptionsRequired, showPrivacyOptions } = useAds();
  const [query, setQuery] = useState('');
  const [sheet, setSheet] = useState<'country' | 'language' | null>(null);

  const rails = useMemo(() => homeRails(pool, categories, HOME_CATEGORIES, RAIL_SIZE), [pool, categories]);
  const tunerPool = useMemo(() => {
    const withLogos = pool.filter((s) => s.logo);
    return withLogos.length ? withLogos : pool;
  }, [pool]);
  const countrySheetOptions = useMemo<FilterOption[]>(
    () => [
      { value: 'All', label: 'All countries' },
      ...countries.map((c) => ({ value: c.code, label: countryName(c.code), count: c.count })),
    ],
    [countries],
  );
  const languageSheetOptions = useMemo<FilterOption[]>(
    () => [{ value: 'All', label: 'All languages' }, ...languages.map((l) => ({ value: l.code, label: l.name, count: l.count }))],
    [languages],
  );

  if (load.status === 'loading') {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.amber} />
        <Text style={styles.scanning}>Scanning for channels…</Text>
      </View>
    );
  }

  if (load.status === 'error') {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <NoSignal
          title="The channel list didn't load"
          message={`${load.message} Check your connection and try again.`}
          actions={[{ label: 'Try again', onPress: retry, primary: true }]}
        />
      </View>
    );
  }

  const place = country === 'All' ? null : countryInSentence(country);
  const openBrowse = (params: { categoryId?: string; query?: string }) => router.push({ pathname: '/browse', params });
  const languageName = languages.find((l) => l.code === language)?.name;

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingTop: insets.top + 10, paddingBottom: insets.bottom + 32 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <View style={styles.brand}>
            <Text style={styles.wordmark}>Electrohm</Text>
            <Text style={styles.tag}>HAUS TV</Text>
          </View>
          <View style={styles.search}>
            <Ionicons name="search" size={16} color={colors.dim} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={() => query.trim() && openBrowse({ query: query.trim() })}
              placeholder="Search channels"
              placeholderTextColor={colors.dim}
              returnKeyType="search"
              autoCorrect={false}
              autoCapitalize="none"
              style={styles.searchInput}
              accessibilityLabel="Search channels"
            />
          </View>
          <View style={styles.filters}>
            <FilterButton
              label={country === 'All' ? 'All countries' : countryName(country)}
              active={country !== 'All'}
              onPress={() => setSheet('country')}
              accessibilityLabel="Choose country"
            />
            <FilterButton
              label={languageName ?? 'All languages'}
              active={language !== 'All'}
              onPress={() => setSheet('language')}
              accessibilityLabel="Choose language"
            />
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          <Chip label="All channels" count={pool.length} onPress={() => openBrowse({})} />
          {categories.map((c) => (
            <Chip key={c.id} label={c.name} count={c.count} onPress={() => openBrowse({ categoryId: c.id })} />
          ))}
        </ScrollView>

        <Tuner
          pool={tunerPool}
          totalChannels={pool.length}
          totalCountries={countries.length}
          countryLabel={place}
          onWatch={(stream) => play(stream, tunerPool)}
        />

        <View style={styles.rails}>
          {rails.map(({ category, streams }) => (
            <Rail
              key={category.id}
              title={category.name}
              streams={streams}
              total={category.count}
              onSelect={(stream) => play(stream, streams)}
              onSeeAll={() => openBrowse({ categoryId: category.id })}
            />
          ))}
        </View>

        <Pressable
          onPress={() => openBrowse({})}
          accessibilityRole="button"
          style={({ pressed }) => [styles.browseAll, pressed && styles.pressed]}
        >
          <Text style={styles.browseAllLabel}>
            Browse all {formatCount(pool.length)} channels{place ? ` from ${place}` : ''}
          </Text>
        </Pressable>

        {privacyOptionsRequired ? (
          <Pressable onPress={showPrivacyOptions} accessibilityRole="button" hitSlop={8} style={styles.privacy}>
            <Text style={styles.privacyLabel}>Privacy choices</Text>
          </Pressable>
        ) : null}
      </ScrollView>

      <Banner />

      <FilterSheet
        visible={sheet === 'country'}
        title="Country"
        options={countrySheetOptions}
        selected={country}
        onSelect={setCountry}
        onClose={() => setSheet(null)}
      />
      <FilterSheet
        visible={sheet === 'language'}
        title="Language"
        options={languageSheetOptions}
        selected={language}
        onSelect={setLanguage}
        onClose={() => setSheet(null)}
      />
    </View>
  );
}

function FilterButton({
  label,
  active,
  onPress,
  accessibilityLabel,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  accessibilityLabel: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${accessibilityLabel}: ${label}`}
      style={({ pressed }) => [styles.filterButton, active && styles.filterActive, pressed && styles.pressed]}
    >
      <Text style={styles.filterLabel} numberOfLines={1}>
        {label}
      </Text>
      <Ionicons name="chevron-down" size={14} color={colors.dim} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ink },
  scroll: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.ink },
  scanning: { marginTop: 16, fontFamily: fonts.mono, fontSize: 11, letterSpacing: 2, color: colors.dim, textTransform: 'uppercase' },
  header: { paddingHorizontal: 16, gap: 12 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  wordmark: { fontFamily: fonts.display, fontSize: 28, color: colors.paper, textTransform: 'uppercase' },
  tag: {
    overflow: 'hidden',
    borderRadius: 3,
    backgroundColor: colors.amber,
    paddingHorizontal: 6,
    paddingVertical: 2,
    fontFamily: fonts.monoSemiBold,
    fontSize: 9,
    letterSpacing: 2,
    color: colors.ink,
  },
  search: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panel,
  },
  searchInput: { flex: 1, minHeight: 44, color: colors.paper, fontFamily: fonts.sans, fontSize: 15 },
  filters: { flexDirection: 'row', gap: 8 },
  filterButton: {
    flex: 1,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panel,
  },
  filterActive: { borderColor: colors.amber },
  filterLabel: { flexShrink: 1, fontFamily: fonts.sansMedium, fontSize: 13, color: colors.paper },
  chips: { gap: 8, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4 },
  rails: { borderTopWidth: 1, borderTopColor: colors.line, marginTop: 8, paddingTop: 8 },
  browseAll: {
    minHeight: 48,
    marginHorizontal: 16,
    marginTop: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.line,
  },
  browseAllLabel: { fontFamily: fonts.sansSemiBold, fontSize: 14, color: colors.paper },
  privacy: { alignSelf: 'center', minHeight: 44, justifyContent: 'center', marginTop: 12 },
  privacyLabel: { fontFamily: fonts.sans, fontSize: 13, color: colors.dim, textDecorationLine: 'underline' },
  pressed: { opacity: 0.7 },
});
