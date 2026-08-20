import React, { useEffect, useState } from 'react';
import { StyleSheet, View, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuthStore } from '@/store/auth-store';
import { ThemedText } from '@/components/themed-text';

export default function RootIndexScreen() {
  const router = useRouter();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isOnboarded = useAuthStore((state) => state.isOnboarded);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => {
      setIsMounted(true);
    });
  }, []);

  useEffect(() => {
    if (!isMounted) return;

    // Use a small timeout to let root routing resolve and prevent initial layout jump
    const timer = setTimeout(() => {
      if (isAuthenticated) {
        if (isOnboarded) {
          router.replace('/(tabs)/home' as any);
        } else {
          router.replace('/(auth)/create-profile' as any);
        }
      } else {
        router.replace('/(auth)/welcome' as any);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [isAuthenticated, isOnboarded, isMounted]);

  return (
    <LinearGradient
      colors={['#000000', '#000000', '#000000']}
      style={styles.container}
    >
      {/* Background Grid Lines Overlay */}
      <View style={styles.gridOverlay} pointerEvents="none">
        <View style={{ position: 'absolute', left: 0, right: 0, top: '20%', height: 1, backgroundColor: 'rgba(255,255,255,0.015)' }} />
        <View style={{ position: 'absolute', left: 0, right: 0, top: '40%', height: 1, backgroundColor: 'rgba(255,255,255,0.015)' }} />
        <View style={{ position: 'absolute', left: 0, right: 0, top: '60%', height: 1, backgroundColor: 'rgba(255,255,255,0.015)' }} />
        <View style={{ position: 'absolute', left: 0, right: 0, top: '80%', height: 1, backgroundColor: 'rgba(255,255,255,0.015)' }} />
        <View style={{ position: 'absolute', top: 0, bottom: 0, left: '25%', width: 1, backgroundColor: 'rgba(255,255,255,0.015)' }} />
        <View style={{ position: 'absolute', top: 0, bottom: 0, left: '50%', width: 1, backgroundColor: 'rgba(255,255,255,0.015)' }} />
        <View style={{ position: 'absolute', top: 0, bottom: 0, left: '75%', width: 1, backgroundColor: 'rgba(255,255,255,0.015)' }} />
      </View>

      <View style={styles.content}>
        <ThemedText style={styles.logo}>И</ThemedText>
        <ThemedText style={styles.title}>ZenWill</ThemedText>
        <ActivityIndicator size="small" color="#ffffff" style={{ marginTop: 24 }} />
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gridOverlay: {
    ...StyleSheet.absoluteFill,
    opacity: 0.8,
  },
  content: {
    alignItems: 'center',
  },
  logo: {
    fontSize: 56,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: -1,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#ffffff',
    marginTop: 8,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
});
