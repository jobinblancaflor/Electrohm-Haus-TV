import { useMemo, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { formatCount } from '@shared/lib/format';
import { colors, fonts } from '../theme';

export interface FilterOption {
  value: string;
  label: string;
  count?: number;
}

interface FilterSheetProps {
  visible: boolean;
  title: string;
  options: FilterOption[];
  selected: string;
  onSelect: (value: string) => void;
  onClose: () => void;
}

/** Bottom sheet picker with a type-to-filter field (lists run to ~200 entries). */
export function FilterSheet({ visible, title, options, selected, onSelect, onClose }: FilterSheetProps) {
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState('');
  const shown = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;
  }, [options, filter]);

  const close = () => {
    setFilter('');
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close} statusBarTranslucent>
      <KeyboardAvoidingView style={styles.container} behavior="padding">
        <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel={`Close ${title} picker`} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 12 }]}>
          <View style={styles.grabber} />
          <Text style={styles.title}>{title}</Text>
          <TextInput
            value={filter}
            onChangeText={setFilter}
            placeholder={`Find a ${title.toLowerCase()}`}
            placeholderTextColor={colors.dim}
            style={styles.input}
            autoCorrect={false}
            autoCapitalize="none"
            clearButtonMode="while-editing"
          />
          <FlatList
            data={shown}
            keyExtractor={(o) => o.value}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => {
              const active = item.value === selected;
              return (
                <Pressable
                  onPress={() => {
                    onSelect(item.value);
                    close();
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                >
                  <Text style={[styles.label, active && styles.labelActive]} numberOfLines={1}>
                    {item.label}
                  </Text>
                  {item.count !== undefined ? <Text style={styles.count}>{formatCount(item.count)}</Text> : null}
                  {active ? <Ionicons name="checkmark" size={18} color={colors.amber} /> : null}
                </Pressable>
              );
            }}
          />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: {
    maxHeight: '78%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panel,
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.line, marginBottom: 12 },
  title: { fontFamily: fonts.display, fontSize: 26, color: colors.paper, textTransform: 'uppercase' },
  input: {
    marginTop: 10,
    marginBottom: 6,
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.ink,
    color: colors.paper,
    fontFamily: fonts.sans,
    fontSize: 15,
  },
  row: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 4 },
  rowPressed: { backgroundColor: colors.raised },
  label: { flex: 1, fontFamily: fonts.sans, fontSize: 15, color: colors.paper },
  labelActive: { fontFamily: fonts.sansSemiBold, color: colors.amber },
  count: { fontFamily: fonts.mono, fontSize: 11, color: colors.dim },
});
