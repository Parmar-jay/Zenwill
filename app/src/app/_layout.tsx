import '../global.css';
import React, { useEffect } from 'react';
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';
import { Stack, useSegments, useRouter, useRootNavigationState } from 'expo-router';
import { useAuthStore } from '@/store/auth-store';

import {
  useFonts,
  SpaceGrotesk_400Regular,
  SpaceGrotesk_500Medium,
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
} from '@expo-google-fonts/space-grotesk';
import {
  DMSans_400Regular,
  DMSans_400Regular_Italic,
  DMSans_500Medium,
  DMSans_500Medium_Italic,
  DMSans_700Bold,
  DMSans_700Bold_Italic,
} from '@expo-google-fonts/dm-sans';

import { AnimatedSplashOverlay } from '@/components/animated-icon';

SplashScreen.preventAutoHideAsync();

function AuthGuard({ children }: { children: React.ReactNode }) {
  const segments = useSegments();
  const router = useRouter();
  const navigationState = useRootNavigationState();
  const { isAuthenticated, isOnboarded, isHydrated } = useAuthStore();

  // Listen for Google OAuth web redirect hash/token
  useEffect(() => {
    if (typeof window !== 'undefined' && window.location && window.location.hash) {
      const hash = window.location.hash;
      if (hash.includes('access_token') || hash.includes('id_token')) {
        const params: Record<string, string> = {};
        hash.substring(1).split('&').forEach((pair) => {
          const [k, v] = pair.split('=');
          if (k && v) params[decodeURIComponent(k)] = decodeURIComponent(v);
        });
        const token = params.id_token || params.access_token;
        if (token) {
          window.history.replaceState(null, '', window.location.pathname);
          useAuthStore.getState().loginWithGoogle({ id_token: token }).catch(() => {});
        }
      }
    }
  }, []);

  useEffect(() => {
    // Wait until root navigation state and Zustand hydration are ready
    if (!navigationState?.key || !isHydrated) return;

    const segList = segments as string[];
    const firstSegment = segList[0] || '';
    const secondSegment = segList[1] || '';

    const inAuthGroup = firstSegment === '(auth)';
    const inRootIndex = firstSegment === 'index' || segList.length === 0;

    // Public auth and onboarding screens allowed
    const publicAuthScreens = ['welcome', 'login', 'register', 'forgot-password', 'verify-email'];
    const onboardingScreens = ['create-profile', 'assessment', 'onboarding-purpose', 'onboarding-triggers', 'onboarding-permissions', 'onboarding-complete'];
    const isAuthOrOnboardingScreen = inAuthGroup && (publicAuthScreens.includes(secondSegment) || onboardingScreens.includes(secondSegment));

    if (!isAuthenticated) {
      // Unauthenticated users allowed on auth and onboarding screens
      if (!isAuthOrOnboardingScreen && !inRootIndex) {
        router.replace('/(auth)/welcome' as any);
      }
    } else {
      // Authenticated users
      if (!isOnboarded) {
        // Authenticated but not onboarded -> restricted to onboarding flow
        if (!isAuthOrOnboardingScreen) {
          router.replace('/(auth)/create-profile' as any);
        }
      } else {
        // Authenticated and onboarded
        // If on public auth screens (login, register, welcome) or root index, send to home.
        const isPublicAuthScreen = inAuthGroup && publicAuthScreens.includes(secondSegment);
        if (isPublicAuthScreen || inRootIndex) {
          router.replace('/(tabs)/home' as any);
        }
      }
    }
  }, [isAuthenticated, isOnboarded, isHydrated, segments, navigationState?.key]);

  return <>{children}</>;
}

const PureBlackTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: '#000000',
    card: '#000000',
    border: 'rgba(255, 255, 255, 0.08)',
  },
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  const [loaded, error] = useFonts({
    SpaceGrotesk_400Regular,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
    'SpaceGrotesk-Regular': SpaceGrotesk_400Regular,
    'SpaceGrotesk-Medium': SpaceGrotesk_500Medium,
    'SpaceGrotesk-SemiBold': SpaceGrotesk_600SemiBold,
    'SpaceGrotesk-Bold': SpaceGrotesk_700Bold,
    'Space Grotesk': SpaceGrotesk_700Bold,
    DMSans_400Regular,
    DMSans_400Regular_Italic,
    DMSans_500Medium,
    DMSans_500Medium_Italic,
    DMSans_700Bold,
    DMSans_700Bold_Italic,
    'DMSans-Regular': DMSans_400Regular,
    'DMSans-Medium': DMSans_500Medium,
    'DMSans-Bold': DMSans_700Bold,
    'DM Sans': DMSans_400Regular,
  });

  useEffect(() => {
    if (loaded || error) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [loaded, error]);

  if (!loaded && !error) {
    return null;
  }

  return (
    <ThemeProvider value={PureBlackTheme}>
      <AnimatedSplashOverlay />
      <AuthGuard>
        <Stack
          screenOptions={{
            headerShown: false,
            animation: 'fade_from_bottom',
            contentStyle: { backgroundColor: '#000000' },
          }}
        >
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="+not-found" options={{ title: 'Oops!' }} />
        </Stack>
      </AuthGuard>
    </ThemeProvider>
  );
}
