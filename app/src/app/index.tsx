import React, { useEffect } from 'react';
import { StyleSheet, View, Image, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuthStore } from '@/store/auth-store';

export default function RootIndexScreen() {
  const router = useRouter();
  const { isAuthenticated, isOnboarded, isHydrated } = useAuthStore();

  useEffect(() => {
    if (!isHydrated) return;

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
    }, 600);

    return () => clearTimeout(timer);
  }, [isAuthenticated, isOnboarded, isHydrated]);

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#000000', '#030712', '#000000']}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.content}>
        <Image
          source={require('@/assets/images/zenwill_logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <ActivityIndicator size="small" color="#00E5FF" style={{ marginTop: 24 }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 220,
    height: 70,
  },
});


