import React, { useState, useEffect } from 'react';
import { StyleSheet, TouchableOpacity, ScrollView, View, Platform, Alert, ActivityIndicator } from 'react-native';
import { useRouter, Stack, useLocalSearchParams } from 'expo-router';
import { useAuthStore } from '@/store/auth-store';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useOnboardingStore } from '@/store/onboarding-store';

let Notifications: any = null;
try {
  Notifications = require('expo-notifications');
} catch (e) {
  console.log('expo-notifications optional load fallback:', e);
}

export default function AuthOnboardingPermissionsScreen() {
  const router = useRouter();
  const { edit } = useLocalSearchParams<{ edit?: string }>();
  const profile = useOnboardingStore();
  const updateProfile = useOnboardingStore((s) => s.updateProfile);

  const [notificationsEnabled, setNotificationsEnabled] = useState(profile.permNotifications || false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    checkPermissionStatus();
  }, []);

  const checkPermissionStatus = async () => {
    if (Platform.OS === 'web' || !Notifications) return;
    try {
      const { status } = await Notifications.getPermissionsAsync();
      if (status === 'granted') {
        setNotificationsEnabled(true);
      }
    } catch (e) {
      console.log('Error checking notification permissions:', e);
    }
  };

  const handleToggleNotifications = async () => {
    if (notificationsEnabled) {
      setNotificationsEnabled(false);
      updateProfile({ permNotifications: false });
      return;
    }

    if (Platform.OS === 'web' || !Notifications) {
      setNotificationsEnabled(true);
      updateProfile({ permNotifications: true });
      return;
    }

    setLoading(true);
    try {
      const { status } = await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
        },
      });
      if (status === 'granted') {
        setNotificationsEnabled(true);
        updateProfile({ permNotifications: true });
      } else {
        Alert.alert(
          'Permission Required',
          'Notifications were not granted. You can turn notifications on anytime in your phone settings.'
        );
        setNotificationsEnabled(false);
        updateProfile({ permNotifications: false });
      }
    } catch (err) {
      console.log('Error requesting notification permissions:', err);
      setNotificationsEnabled(true);
      updateProfile({ permNotifications: true });
    } finally {
      setLoading(false);
    }
  };

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleContinue = () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    updateProfile({ permNotifications: notificationsEnabled });
    router.replace({ pathname: '/(auth)/onboarding-complete', params: edit === 'true' ? { edit: 'true' } : {} } as any);
    setTimeout(() => setIsSubmitting(false), 1000);
  };

  return (
    <View style={styles.container}>
      <View style={styles.ambientGlow1} pointerEvents="none" />
      <View style={styles.ambientGlow2} pointerEvents="none" />
      <LinearGradient colors={['rgba(0,0,0,0.1)', '#000000']} style={styles.fadeOverlay} pointerEvents="none" />
      <Stack.Screen options={{ headerShown: false }} />

      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
        <Animated.View entering={FadeIn.duration(400)} style={styles.mainWrapper}>
          {/* Header */}
          <View style={styles.headerRow}>
            <TouchableOpacity
              activeOpacity={0.6}
              style={styles.backButton}
              onPress={() => router.replace({ pathname: '/(auth)/onboarding-triggers', params: edit === 'true' ? { edit: 'true' } : {} } as any)}
            >
              <Ionicons name="chevron-back" size={24} color="#00E5FF" />
            </TouchableOpacity>
            <View style={styles.logoCenter}>
              <ThemedText style={styles.logoText}>
                <ThemedText style={styles.logoZen}>ZEN</ThemedText>
                <ThemedText style={styles.logoWill}>WILL</ThemedText>
              </ThemedText>
            </View>
            {edit === 'true' ? (
              <TouchableOpacity
                activeOpacity={0.6}
                style={{ width: 40, alignItems: 'center', justifyContent: 'center' }}
                onPress={() => {
                  useAuthStore.setState({ isOnboarded: true, onboardingStep: 6 });
                  router.replace('/(tabs)/profile' as any);
                }}
              >
                <Ionicons name="close" size={24} color="#ffffff" />
              </TouchableOpacity>
            ) : (
              <View style={{ width: 40 }} />
            )}
          </View>

          {/* Progress */}
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <LinearGradient colors={['#00A8FF', '#0052D4']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.progressFill, { width: '100%' }]} />
            </View>
            <ThemedText style={styles.progressLabel}>Step 5 of 5</ThemedText>
          </View>

          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <View style={styles.contentContainer}>
              {/* Bell Icon */}
              <View style={styles.iconContainer}>
                <LinearGradient colors={['rgba(0,168,255,0.15)', 'rgba(0,82,212,0.05)']} style={styles.iconCircleOuter}>
                  <View style={styles.iconCircleInner}>
                    <Ionicons name={notificationsEnabled ? 'notifications' : 'notifications-outline'} size={48} color="#00A8FF" />
                  </View>
                </LinearGradient>
              </View>

              <View style={styles.titleSection}>
                <ThemedText style={styles.stepText}>Notifications Setup</ThemedText>
                <ThemedText style={styles.title}>Turn On Notifications</ThemedText>
                <ThemedText style={styles.subtitle}>
                  Enable notifications on your phone so ZenWill can send you instant urge support, daily check-in reminders, and streak updates.
                </ThemedText>
              </View>

              {/* Push Notification Toggle Card */}
              <View style={styles.permissionsContainer}>
                <Animated.View entering={FadeInDown.duration(300)}>
                  <View style={[styles.permCard, notificationsEnabled && styles.permCardActive]}>
                    <View style={[styles.permIconWrap, notificationsEnabled && styles.permIconWrapActive]}>
                      <Ionicons name="notifications-outline" size={22} color={notificationsEnabled ? '#ffffff' : '#00A8FF'} />
                    </View>
                    <View style={styles.permContent}>
                      <View style={styles.permTitleRow}>
                        <ThemedText style={[styles.permTitle, notificationsEnabled && styles.permTitleActive]}>
                          Push Notifications
                        </ThemedText>
                        <View style={styles.recommendedBadge}>
                          <ThemedText style={styles.recommendedBadgeText}>Recommended</ThemedText>
                        </View>
                      </View>
                      <ThemedText style={styles.permDesc}>
                        Receive real-time urge protection, daily check-in reminders, and helpful motivational coaching directly on your phone.
                      </ThemedText>
                    </View>

                    {/* Actual Native Phone Permission Button */}
                    <TouchableOpacity
                      activeOpacity={0.7}
                      disabled={loading}
                      onPress={handleToggleNotifications}
                      style={[styles.toggleBtn, notificationsEnabled ? styles.toggleBtnOn : styles.toggleBtnOff]}
                    >
                      <Ionicons
                        name={notificationsEnabled ? 'checkmark-circle' : 'power-outline'}
                        size={16}
                        color={notificationsEnabled ? '#00C851' : 'rgba(255,255,255,0.4)'}
                      />
                      <ThemedText style={[styles.toggleBtnText, notificationsEnabled ? styles.toggleBtnTextOn : styles.toggleBtnTextOff]}>
                        {notificationsEnabled ? 'NOTIFICATIONS ON' : 'TURN ON NOTIFICATIONS'}
                      </ThemedText>
                    </TouchableOpacity>
                  </View>
                </Animated.View>
              </View>

              {/* Privacy note */}
              <View style={styles.privacyNote}>
                <Ionicons name="lock-closed-outline" size={14} color="rgba(255,255,255,0.3)" />
                <ThemedText style={styles.privacyText}>
                  We respect your privacy. You can turn notifications on or off at any time in your phone settings.
                </ThemedText>
              </View>

              {/* CTA */}
              <TouchableOpacity
                activeOpacity={0.85}
                style={[styles.btnPrimaryContainer, isSubmitting && { opacity: 0.75 }]}
                onPress={handleContinue}
                disabled={isSubmitting}
              >
                <LinearGradient
                  colors={['#00E5FF', '#00B4D8']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.btnPrimaryGradient}
                >
                  {isSubmitting ? (
                    <View style={styles.btnPrimaryInner}>
                      <ActivityIndicator size="small" color="#000000" />
                    </View>
                  ) : (
                    <View style={styles.btnPrimaryInner}>
                      <ThemedText style={styles.btnPrimaryText}>Continue to Final Step</ThemedText>
                      <ThemedText style={styles.btnArrow}>➔</ThemedText>
                    </View>
                  )}
                </LinearGradient>
              </TouchableOpacity>

              <View style={styles.footerLinkRow}>
                <TouchableOpacity onPress={() => router.replace('/(auth)/onboarding-complete' as any)}>
                  <ThemedText style={styles.footerAction}>Skip for now</ThemedText>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000', overflow: 'hidden' },
  ambientGlow1: {
    position: 'absolute',
    top: -80,
    right: -80,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(0, 229, 255, 0.12)',
  },
  ambientGlow2: {
    position: 'absolute',
    bottom: -100,
    left: -100,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(99, 102, 241, 0.12)',
  },
  fadeOverlay: { ...StyleSheet.absoluteFill },
  safeArea: { flex: 1 },
  mainWrapper: { flex: 1 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.four, paddingTop: Spacing.two, height: 50 },
  backButton: { backgroundColor: 'transparent', padding: 4, alignItems: 'center', justifyContent: 'center' },
  logoCenter: { alignItems: 'center' },
  logoText: { fontSize: 22, fontFamily: Platform.select({ ios: 'Didot', android: 'serif', default: 'serif' }), fontWeight: '800', letterSpacing: 2 },
  logoZen: { color: '#ffffff' },
  logoWill: { color: '#00E5FF' },
  progressContainer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.four, paddingTop: 10, gap: 10 },
  progressBar: { flex: 1, height: 3, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 2 },
  progressLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: '600' },
  scrollContent: { flexGrow: 1, alignItems: 'center', paddingBottom: 150 },
  contentContainer: { width: '100%', maxWidth: 600, paddingHorizontal: Spacing.four, paddingBottom: Spacing.five, paddingTop: 4 },
  iconContainer: { alignItems: 'center', marginTop: Spacing.four, marginBottom: Spacing.three },
  iconCircleOuter: { width: 120, height: 120, borderRadius: 60, alignItems: 'center', justifyContent: 'center' },
  iconCircleInner: { width: 90, height: 90, borderRadius: 45, backgroundColor: '#111215', borderWidth: 1, borderColor: 'rgba(0,229,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  titleSection: { marginBottom: Spacing.four, gap: Spacing.one },
  stepText: { color: '#00E5FF', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  title: { fontSize: 28, fontWeight: '800', color: '#ffffff', letterSpacing: -0.5 },
  subtitle: { fontSize: 14, color: 'rgba(255,255,255,0.45)', lineHeight: 20, marginTop: 2 },
  permissionsContainer: { gap: 14, marginBottom: 20 },
  permCard: {
    backgroundColor: '#111215',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  permCardActive: { borderColor: 'rgba(0,229,255,0.3)', backgroundColor: 'rgba(0,229,255,0.04)' },
  permIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: 'rgba(0,229,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  permIconWrapActive: { backgroundColor: '#00E5FF' },
  permContent: { flex: 1 },
  permTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  permTitle: { color: 'rgba(255,255,255,0.85)', fontSize: 15, fontWeight: '700' },
  permTitleActive: { color: '#ffffff', fontWeight: '800' },
  recommendedBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, backgroundColor: 'rgba(0,229,255,0.12)' },
  recommendedBadgeText: { color: '#00E5FF', fontSize: 10, fontWeight: '700' },
  permDesc: { color: 'rgba(255,255,255,0.45)', fontSize: 12, lineHeight: 17 },

  toggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    gap: 8,
    marginTop: 6,
  },
  toggleBtnOn: {
    backgroundColor: 'rgba(0,200,81,0.12)',
    borderColor: 'rgba(0,200,81,0.4)',
  },
  toggleBtnOff: {
    backgroundColor: 'rgba(0,229,255,0.1)',
    borderColor: 'rgba(0,229,255,0.3)',
  },
  toggleBtnText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  toggleBtnTextOn: {
    color: '#00C851',
  },
  toggleBtnTextOff: {
    color: '#00E5FF',
  },

  privacyNote: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: 14, marginBottom: 20,
  },
  privacyText: { flex: 1, color: 'rgba(255,255,255,0.35)', fontSize: 12, lineHeight: 17 },
  btnPrimaryContainer: { borderRadius: 20, overflow: 'hidden', marginTop: 4 },
  btnPrimaryGradient: { paddingVertical: 16 },
  btnPrimaryInner: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  btnPrimaryText: { color: '#000000', fontWeight: '700', fontSize: 15.5, letterSpacing: 0.3 },
  btnArrow: { color: '#000000', fontSize: 14, fontWeight: '700' },
  footerLinkRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: Spacing.four },
  footerAction: { color: 'rgba(255,255,255,0.4)', fontSize: 14, fontWeight: '600', textDecorationLine: 'underline' },
});
