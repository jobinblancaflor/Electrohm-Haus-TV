import { router } from 'expo-router';

/** Back, or Home when there's no history (a cold deep link into Browse or the player). */
export function goBackOrHome() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}
