import { StyleSheet, Text, View } from 'react-native';
import { channelNumber } from '@shared/lib/format';
import { colors, fonts } from '../src/theme';

export default function HomeScreen() {
  return (
    <View style={styles.screen}>
      <Text style={styles.wordmark}>Electrohm</Text>
      <Text style={styles.number}>CH {channelNumber(7)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.ink },
  wordmark: { fontFamily: fonts.display, fontSize: 40, color: colors.paper, textTransform: 'uppercase' },
  number: { fontFamily: fonts.monoSemiBold, fontSize: 24, color: colors.amber, marginTop: 8 },
});
