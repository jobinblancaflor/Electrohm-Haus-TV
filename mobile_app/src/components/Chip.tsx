import { Pressable, StyleSheet, Text } from 'react-native';
import { formatCount } from '@shared/lib/format';
import { colors, fonts } from '../theme';

interface ChipProps {
  label: string;
  count?: number;
  active?: boolean;
  onPress: () => void;
}

export function Chip({ label, count, active = false, onPress }: ChipProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={({ pressed }) => [styles.chip, active && styles.active, pressed && styles.pressed]}
    >
      <Text style={[styles.label, active && styles.labelActive]}>{label}</Text>
      {count !== undefined ? <Text style={[styles.count, active && styles.countActive]}>{formatCount(count)}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.line,
  },
  active: { backgroundColor: colors.amber, borderColor: colors.amber },
  pressed: { opacity: 0.8 },
  label: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.paper },
  labelActive: { color: colors.ink },
  count: { fontFamily: fonts.mono, fontSize: 10, color: colors.dim },
  countActive: { color: colors.ink },
});
