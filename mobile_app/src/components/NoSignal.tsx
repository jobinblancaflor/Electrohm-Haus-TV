import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, fonts } from '../theme';

interface NoSignalAction {
  label: string;
  onPress: () => void;
  primary?: boolean;
}

interface NoSignalProps {
  title?: string;
  message: string;
  detail?: string;
  actions: NoSignalAction[];
  style?: StyleProp<ViewStyle>;
}

export function NoSignal({ title, message, detail, actions, style }: NoSignalProps) {
  return (
    <View style={[styles.box, style]}>
      <Text style={styles.eyebrow}>No signal</Text>
      {title ? <Text style={styles.title}>{title}</Text> : null}
      <Text style={styles.message}>{message}</Text>
      {detail ? <Text style={styles.detail}>{detail}</Text> : null}
      <View style={styles.actions}>
        {actions.map((action) => (
          <Pressable
            key={action.label}
            onPress={action.onPress}
            accessibilityRole="button"
            style={({ pressed }) => [styles.button, action.primary && styles.primary, pressed && styles.pressed]}
          >
            <Text style={[styles.buttonLabel, action.primary && styles.primaryLabel]}>{action.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: 'center', justifyContent: 'center', padding: 24 },
  eyebrow: { fontFamily: fonts.mono, fontSize: 11, letterSpacing: 2, color: colors.onair, textTransform: 'uppercase' },
  title: {
    marginTop: 10,
    fontFamily: fonts.display,
    fontSize: 32,
    lineHeight: 34,
    color: colors.paper,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  message: { marginTop: 10, maxWidth: 420, fontFamily: fonts.sans, fontSize: 15, color: colors.paper, textAlign: 'center' },
  detail: { marginTop: 6, fontFamily: fonts.mono, fontSize: 11, color: colors.dim, textAlign: 'center' },
  actions: { flexDirection: 'row', gap: 12, marginTop: 22 },
  button: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 20,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.line,
  },
  primary: { backgroundColor: colors.amber, borderColor: colors.amber },
  pressed: { opacity: 0.8 },
  buttonLabel: { fontFamily: fonts.sansSemiBold, fontSize: 14, color: colors.paper },
  primaryLabel: { color: colors.ink },
});
