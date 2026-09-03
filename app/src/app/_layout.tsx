import '../global.css';
import '@/utils/safe-router';
import React, { useEffect } from 'react';
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import * as SystemUI from 'expo-system-ui';
import { useColorScheme, Platform } from 'react-native';
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


SplashScreen.preventAutoHideAsync();

function AuthGuard({ children }: { children: React.ReactNode }) {
  const segments = useSegments();
  const router = useRouter();
  const navigationState = useRootNavigationState();
  const { isAuthenticated, isEmailVerified, isOnboarded, isHydrated, user } = useAuthStore();

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
      const isVerifiedOrEstablished = isEmailVerified || isOnboarded || !!user?.emailVerified;
      if (!isVerifiedOrEstablished) {
        // Email NOT verified -> user MUST verify email first before accessing the app!
        if (secondSegment !== 'verify-email') {
          router.replace({
            pathname: '/(auth)/verify-email' as any,
            params: { email: user?.email || '' },
          });
        }
      } else if (!isOnboarded) {
        // Authenticated & verified, but not onboarded -> restricted to onboarding flow
        if (!isAuthOrOnboardingScreen) {
          router.replace('/(auth)/create-profile' as any);
        }
      } else {
        // Authenticated, verified, and onboarded -> access full app
        const isPublicAuthScreen = inAuthGroup && publicAuthScreens.includes(secondSegment);
        if (isPublicAuthScreen || inRootIndex) {
          router.replace('/(tabs)/home' as any);
        }
      }
    }
  }, [isAuthenticated, isEmailVerified, isOnboarded, isHydrated, segments, navigationState?.key, user?.email]);

  return <>{children}</>;
}

const PureBlackTheme = {
  ...DarkTheme,
  dark: true,
  colors: {
    ...DarkTheme.colors,
    primary: '#00E5FF',
    background: '#000000',
    card: '#000000',
    text: '#FFFFFF',
    border: 'rgba(255, 255, 255, 0.08)',
    notification: '#00E5FF',
  },
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  useEffect(() => {
    SystemUI.setBackgroundColorAsync('#000000').catch(() => {});
  }, []);

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
      <AuthGuard>
        <Stack
          screenOptions={{
            headerShown: false,
            animation: Platform.OS === 'ios' ? 'default' : 'fade',
            animationDuration: 130,
            contentStyle: { backgroundColor: '#000000' },
            freezeOnBlur: false,
            gestureEnabled: true,
          }}
        >
          <Stack.Screen name="index" options={{ headerShown: false, contentStyle: { backgroundColor: '#000000' } }} />
          <Stack.Screen name="(auth)" options={{ headerShown: false, contentStyle: { backgroundColor: '#000000' } }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false, contentStyle: { backgroundColor: '#000000' } }} />
          <Stack.Screen name="daily-checkin/index" options={{ headerShown: false, contentStyle: { backgroundColor: '#000000' } }} />
          <Stack.Screen name="meditation/index" options={{ headerShown: false, contentStyle: { backgroundColor: '#000000' } }} />
          <Stack.Screen name="journal/index" options={{ headerShown: false, contentStyle: { backgroundColor: '#000000' } }} />
          <Stack.Screen name="emergency/index" options={{ headerShown: false, contentStyle: { backgroundColor: '#000000' } }} />
          <Stack.Screen name="emergency/breathing" options={{ headerShown: false, contentStyle: { backgroundColor: '#000000' } }} />
          <Stack.Screen name="emergency/urge-surfing" options={{ headerShown: false, contentStyle: { backgroundColor: '#000000' } }} />
          <Stack.Screen name="emergency/grounding" options={{ headerShown: false, contentStyle: { backgroundColor: '#000000' } }} />
          <Stack.Screen name="emergency/reflection" options={{ headerShown: false, contentStyle: { backgroundColor: '#000000' } }} />
          <Stack.Screen name="emergency/battlefield" options={{ headerShown: false, contentStyle: { backgroundColor: '#000000' } }} />
          <Stack.Screen name="missions/index" options={{ headerShown: false, contentStyle: { backgroundColor: '#000000' } }} />
          <Stack.Screen name="community/index" options={{ headerShown: false, contentStyle: { backgroundColor: '#000000' } }} />
          <Stack.Screen name="community/dm" options={{ headerShown: false, contentStyle: { backgroundColor: '#000000' } }} />
          <Stack.Screen name="community/cell" options={{ headerShown: false, contentStyle: { backgroundColor: '#000000' } }} />
          <Stack.Screen name="community/leaderboard" options={{ headerShown: false, contentStyle: { backgroundColor: '#000000' } }} />
          <Stack.Screen name="relapse-autopsy/index" options={{ headerShown: false, contentStyle: { backgroundColor: '#000000' } }} />
          <Stack.Screen name="trigger-intelligence/index" options={{ headerShown: false, contentStyle: { backgroundColor: '#000000' } }} />
          <Stack.Screen name="purpose/index" options={{ headerShown: false, contentStyle: { backgroundColor: '#000000' } }} />
          <Stack.Screen name="billing/index" options={{ headerShown: false, contentStyle: { backgroundColor: '#000000' } }} />
          <Stack.Screen name="+not-found" options={{ title: 'Oops!' }} />
        </Stack>
      </AuthGuard>
    </ThemeProvider>
  );
}
