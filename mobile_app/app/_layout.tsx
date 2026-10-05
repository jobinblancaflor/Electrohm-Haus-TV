import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { colors, fontAssets } from '../src/theme';
import { CatalogProvider } from '../src/catalog/CatalogProvider';
import { AdsProvider } from '../src/ads/AdsProvider';

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts(fontAssets);

  useEffect(() => {
    if (loaded || error) void SplashScreen.hideAsync();
  }, [loaded, error]);

  if (!loaded && !error) return null;

  return (
    <AdsProvider>
      <CatalogProvider>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.ink },
            orientation: 'portrait',
            animation: 'fade',
          }}
        >
          {/* Only the player may rotate. */}
          <Stack.Screen name="player/[id]" options={{ orientation: 'all', presentation: 'fullScreenModal' }} />
        </Stack>
      </CatalogProvider>
    </AdsProvider>
  );
}
