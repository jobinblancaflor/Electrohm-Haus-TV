import { useState } from 'react';
import { Image, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, fonts } from '../theme';

function initials(name: string) {
  const words = name.split(/\s+/).map((w) => w.replace(/^[^\wÀ-￿]+/, '')).filter(Boolean);
  const letters = words.length > 1 ? [...words[0]][0] + [...words[1]][0] : [...(words[0] ?? '?')].slice(0, 2).join('');
  return letters.toUpperCase();
}

interface ChannelLogoProps {
  uri: string;
  name: string;
  monogramSize?: number;
  style?: StyleProp<ViewStyle>;
}

/** Logos are mostly transparent marks, so they sit contained; a monogram stands in when one is missing or broken. */
export function ChannelLogo({ uri, name, monogramSize = 28, style }: ChannelLogoProps) {
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const showImage = Boolean(uri) && failedUri !== uri;

  return (
    <View style={[styles.box, style]}>
      {showImage ? (
        <Image
          source={{ uri }}
          style={styles.image}
          resizeMode="contain"
          onError={() => setFailedUri(uri)}
          accessibilityIgnoresInvertColors
        />
      ) : (
        <Text style={[styles.monogram, { fontSize: monogramSize }]} importantForAccessibility="no">
          {initials(name)}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  image: { width: '100%', height: '100%' },
  monogram: { fontFamily: fonts.display, color: colors.dim, opacity: 0.7 },
});
