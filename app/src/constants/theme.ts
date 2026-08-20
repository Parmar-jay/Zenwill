/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#ffffff',
    background: '#000000',
    backgroundElement: '#121215',
    backgroundSelected: '#1C1D22',
    textSecondary: '#94A3B8',
  },
  dark: {
    text: '#ffffff',
    background: '#000000',
    backgroundElement: '#121215',
    backgroundSelected: '#1C1D22',
    textSecondary: '#94A3B8',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Typography = {
  // Space Grotesk - for headers, titles, metrics, badges, buttons
  display: {
    regular: 'SpaceGrotesk_400Regular',
    medium: 'SpaceGrotesk_500Medium',
    semiBold: 'SpaceGrotesk_600SemiBold',
    bold: 'SpaceGrotesk_700Bold',
  },
  // DM Sans - for body text, subtitles, descriptions, inputs, captions
  body: {
    regular: 'DMSans_400Regular',
    regularItalic: 'DMSans_400Regular_Italic',
    medium: 'DMSans_500Medium',
    mediumItalic: 'DMSans_500Medium_Italic',
    bold: 'DMSans_700Bold',
    boldItalic: 'DMSans_700Bold_Italic',
  },
} as const;

export const Fonts = Platform.select({
  web: {
    sans: 'var(--font-sans)',
    display: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
  default: {
    sans: 'DMSans_400Regular',
    display: 'SpaceGrotesk_700Bold',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
