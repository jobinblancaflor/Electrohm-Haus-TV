import { BigShouldersDisplay_800ExtraBold, BigShouldersDisplay_900Black } from '@expo-google-fonts/big-shoulders-display';
import { InstrumentSans_400Regular, InstrumentSans_500Medium, InstrumentSans_600SemiBold } from '@expo-google-fonts/instrument-sans';
import { MartianMono_400Regular, MartianMono_600SemiBold } from '@expo-google-fonts/martian-mono';

/** Mirrors the web @theme tokens in src/styles/index.css. */
export const colors = {
  ink: '#14111F',
  panel: '#1D1929',
  raised: '#262136',
  line: '#2F2A42',
  paper: '#EEEAF6',
  dim: '#9791AE',
  amber: '#FFB547',
  onair: '#FF4D5E',
} as const;

// With custom fonts, weight comes from the family; never combine these with fontWeight.
export const fonts = {
  display: 'BigShouldersDisplay_800ExtraBold',
  displayBlack: 'BigShouldersDisplay_900Black',
  sans: 'InstrumentSans_400Regular',
  sansMedium: 'InstrumentSans_500Medium',
  sansSemiBold: 'InstrumentSans_600SemiBold',
  mono: 'MartianMono_400Regular',
  monoSemiBold: 'MartianMono_600SemiBold',
} as const;

export const fontAssets = {
  BigShouldersDisplay_800ExtraBold,
  BigShouldersDisplay_900Black,
  InstrumentSans_400Regular,
  InstrumentSans_500Medium,
  InstrumentSans_600SemiBold,
  MartianMono_400Regular,
  MartianMono_600SemiBold,
};
