import React, { useState } from 'react';
import { StyleSheet, TouchableOpacity, ScrollView, View, Platform, Dimensions, ActivityIndicator } from 'react-native';
import { useRouter, Stack, useLocalSearchParams } from 'expo-router';
import { useAuthStore } from '@/store/auth-store';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn } from 'react-native-reanimated';
import {
  useOnboardingStore,
  UrgeTime, UrgeLocation, EmotionalTrigger,
  FirstWarningSign, UrgeDuration, TypicalResponse,
  EmotionalAftermath, PrimaryDevice, OnlinePlatform,
} from '@/store/onboarding-store';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ── Data ──────────────────────────────────────────────────────────────────────
const URGE_TIMES: { id: UrgeTime; label: string; icon: string }[] = [
  { id: 'morning', label: 'Morning', icon: 'partly-sunny-outline' },
  { id: 'afternoon', label: 'Afternoon', icon: 'cloud-outline' },
  { id: 'evening', label: 'Evening', icon: 'cloudy-night-outline' },
  { id: 'night', label: 'Night', icon: 'moon-outline' },
  { id: 'late_night', label: 'Late Night', icon: 'star-outline' },
];

const URGE_LOCATIONS: { id: UrgeLocation; label: string; icon: string }[] = [
  { id: 'bedroom', label: 'Bedroom', icon: 'bed-outline' },
  { id: 'bathroom', label: 'Bathroom', icon: 'water-outline' },
  { id: 'living_room', label: 'Living Room', icon: 'tv-outline' },
  { id: 'office', label: 'Office', icon: 'business-outline' },
  { id: 'college', label: 'College', icon: 'school-outline' },
  { id: 'traveling', label: 'Traveling', icon: 'car-outline' },
  { id: 'home_alone', label: 'Home Alone', icon: 'home-outline' },
  { id: 'anywhere', label: 'Anywhere', icon: 'location-outline' },
];

const EMO_TRIGGERS: { id: EmotionalTrigger; label: string }[] = [
  { id: 'stress', label: 'Stress' },
  { id: 'anxiety', label: 'Anxiety' },
  { id: 'loneliness', label: 'Loneliness' },
  { id: 'boredom', label: 'Boredom' },
  { id: 'fatigue', label: 'Fatigue' },
  { id: 'anger', label: 'Anger' },
  { id: 'rejection', label: 'Rejection' },
  { id: 'conflict', label: 'Conflict' },
  { id: 'social_media', label: 'Social Media' },
  { id: 'watching_videos', label: 'Watching Videos' },
  { id: 'being_alone', label: 'Being Alone' },
  { id: 'after_work', label: 'After Work' },
  { id: 'before_sleeping', label: 'Before Sleeping' },
  { id: 'after_waking', label: 'After Waking Up' },
  { id: 'random', label: 'Random' },
];

const WARNING_SIGNS: { id: FirstWarningSign; label: string; icon: string }[] = [
  { id: 'thought', label: 'A Thought', icon: 'bulb-outline' },
  { id: 'fantasy', label: 'A Fantasy', icon: 'cloud-outline' },
  { id: 'memory', label: 'A Memory', icon: 'time-outline' },
  { id: 'emotion', label: 'An Emotion', icon: 'heart-outline' },
  { id: 'physical', label: 'Physical Sensation', icon: 'body-outline' },
  { id: 'craving', label: 'A Craving', icon: 'flame-outline' },
  { id: 'dont_know', label: "Don't Know", icon: 'help-outline' },
];

const URGE_DURATIONS: { id: UrgeDuration; label: string }[] = [
  { id: 'under_5min', label: 'Less Than 5 Minutes' },
  { id: '5_10min', label: '5–10 Minutes' },
  { id: '10_20min', label: '10–20 Minutes' },
  { id: 'over_20min', label: 'More Than 20 Minutes' },
];

const TYPICAL_RESPONSES: { id: TypicalResponse; label: string; icon: string }[] = [
  { id: 'give_in', label: 'Give In', icon: 'alert-circle-outline' },
  { id: 'resist', label: 'Resist', icon: 'shield-outline' },
  { id: 'distract', label: 'Distract Myself', icon: 'shuffle-outline' },
  { id: 'exercise', label: 'Exercise', icon: 'barbell-outline' },
  { id: 'walk', label: 'Walk', icon: 'walk-outline' },
  { id: 'meditation', label: 'Meditation', icon: 'flower-outline' },
  { id: 'prayer', label: 'Prayer', icon: 'hand-left-outline' },
  { id: 'call_someone', label: 'Call Someone', icon: 'call-outline' },
  { id: 'sleep', label: 'Sleep', icon: 'moon-outline' },
  { id: 'other_healthy', label: 'Other Healthy Act.', icon: 'leaf-outline' },
];

const AFTERMATH: { id: EmotionalAftermath; label: string; emoji: string }[] = [
  { id: 'guilt', label: 'Guilt', emoji: '😞' },
  { id: 'shame', label: 'Shame', emoji: '😓' },
  { id: 'regret', label: 'Regret', emoji: '😔' },
  { id: 'empty', label: 'Empty', emoji: '😶' },
  { id: 'tired', label: 'Tired', emoji: '😴' },
  { id: 'anxious', label: 'Anxious', emoji: '😰' },
  { id: 'motivated', label: 'Motivated to Improve', emoji: '💪' },
  { id: 'no_emotion', label: 'No Emotion', emoji: '😑' },
];

const DEVICES: { id: PrimaryDevice; label: string; icon: string }[] = [
  { id: 'phone', label: 'Phone', icon: 'phone-portrait-outline' },
  { id: 'tablet', label: 'Tablet', icon: 'tablet-portrait-outline' },
  { id: 'laptop', label: 'Laptop', icon: 'laptop-outline' },
  { id: 'desktop', label: 'Desktop', icon: 'desktop-outline' },
  { id: 'tv', label: 'TV', icon: 'tv-outline' },
  { id: 'multiple', label: 'Multiple', icon: 'layers-outline' },
];

const PLATFORMS: { id: OnlinePlatform; label: string }[] = [
  { id: 'instagram', label: 'Instagram' },
  { id: 'youtube', label: 'YouTube' },
  { id: 'reddit', label: 'Reddit' },
  { id: 'x', label: 'X (Twitter)' },
  { id: 'facebook', label: 'Facebook' },
  { id: 'browser', label: 'Browser' },
  { id: 'streaming', label: 'Streaming Apps' },
  { id: 'gaming', label: 'Gaming' },
  { id: 'other', label: 'Other' },
];

// ── MultiSelect helpers ───────────────────────────────────────────────────────
function toggle<T>(arr: T[], val: T): T[] {
  return arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val];
}
function toggleMax<T>(arr: T[], val: T, max: number): T[] {
  if (arr.includes(val)) return arr.filter((x) => x !== val);
  if (arr.length >= max) return arr;
  return [...arr, val];
}

// ── Section header ────────────────────────────────────────────────────────────
function SectionTitle({ title, hint }: { title: string; hint?: string }) {
  return (
    <View style={{ marginBottom: 10 }}>
      <ThemedText style={styles.fieldLabel}>{title}</ThemedText>
      {hint && <ThemedText style={styles.fieldHint}>{hint}</ThemedText>}
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────
export default function AuthOnboardingTriggersScreen() {
  const router = useRouter();
  const { edit } = useLocalSearchParams<{ edit?: string }>();
  const profile = useOnboardingStore();
  const updateProfile = useOnboardingStore((s) => s.updateProfile);

  const [urgeTimes, setUrgeTimes] = useState<UrgeTime[]>(profile.urgeTimes || []);
  const [urgeLocations, setUrgeLocations] = useState<UrgeLocation[]>(profile.urgeLocations || []);
  const [emotionalTriggers, setEmotionalTriggers] = useState<EmotionalTrigger[]>(profile.emotionalTriggers || []);
  const [firstWarningSign, setFirstWarningSign] = useState<FirstWarningSign>(profile.firstWarningSign || '');
  const [urgeDuration, setUrgeDuration] = useState<UrgeDuration>(profile.urgeDuration || '');
  const [typicalResponses, setTypicalResponses] = useState<TypicalResponse[]>(profile.typicalResponses || []);
  const [emotionalAftermath, setEmotionalAftermath] = useState<EmotionalAftermath[]>(profile.emotionalAftermath || []);
  const [primaryDevice, setPrimaryDevice] = useState<PrimaryDevice>(profile.primaryDevice || '');
  const [onlinePlatforms, setOnlinePlatforms] = useState<OnlinePlatform[]>(profile.onlinePlatforms || []);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleContinue = () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    updateProfile({
      urgeTimes,
      urgeLocations,
      emotionalTriggers,
      firstWarningSign,
      urgeDuration,
      typicalResponses,
      emotionalAftermath,
      primaryDevice,
      onlinePlatforms,
    });
    router.replace({ pathname: '/(auth)/onboarding-permissions', params: edit === 'true' ? { edit: 'true' } : {} } as any);
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
            <TouchableOpacity activeOpacity={0.6} style={styles.backButton}
              onPress={() => router.replace({ pathname: '/(auth)/onboarding-purpose', params: edit === 'true' ? { edit: 'true' } : {} } as any)}>
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
              <LinearGradient colors={['#00A8FF', '#0052D4']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={[styles.progressFill, { width: '80%' }]} />
            </View>
            <ThemedText style={styles.progressLabel}>Step 4 of 5</ThemedText>
          </View>

          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <View style={styles.contentContainer}>
              <View style={styles.titleSection}>
                <ThemedText style={styles.stepText}>Mind Triggers</ThemedText>
                <ThemedText style={styles.title}>Understand Your Mind Triggers</ThemedText>
                <ThemedText style={styles.subtitle}>
                  Identifying what triggers your mind and cravings helps ZenWill protect you before temptation grows.
                </ThemedText>
              </View>

              {/* When do urges happen */}
              <View style={styles.fieldBlock}>
                <SectionTitle title="When do urges usually happen?" hint="Select all that apply" />
                <View style={styles.chipRow}>
                  {URGE_TIMES.map((o) => {
                    const active = urgeTimes.includes(o.id);
                    return (
                      <TouchableOpacity key={o.id} activeOpacity={0.7}
                        style={[styles.chip, active && styles.chipActive]}
                        onPress={() => setUrgeTimes(toggle(urgeTimes, o.id))}
                      >
                        <Ionicons name={o.icon as any} size={13} color={active ? '#00A8FF' : 'rgba(255,255,255,0.4)'} />
                        <ThemedText style={[styles.chipText, active && styles.chipTextActive]}>{o.label}</ThemedText>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Where they happen */}
              <View style={styles.fieldBlock}>
                <SectionTitle title="Where do they usually happen?" />
                <View style={styles.chipRow}>
                  {URGE_LOCATIONS.map((o) => {
                    const active = urgeLocations.includes(o.id);
                    return (
                      <TouchableOpacity key={o.id} activeOpacity={0.7}
                        style={[styles.chip, active && styles.chipActive]}
                        onPress={() => setUrgeLocations(toggle(urgeLocations, o.id))}
                      >
                        <Ionicons name={o.icon as any} size={13} color={active ? '#00A8FF' : 'rgba(255,255,255,0.4)'} />
                        <ThemedText style={[styles.chipText, active && styles.chipTextActive]}>{o.label}</ThemedText>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Emotional triggers */}
              <View style={styles.fieldBlock}>
                <SectionTitle title="What usually happens before an urge?" hint="Select all that apply" />
                <View style={styles.chipRow}>
                  {EMO_TRIGGERS.map((o) => {
                    const active = emotionalTriggers.includes(o.id);
                    return (
                      <TouchableOpacity key={o.id} activeOpacity={0.7}
                        style={[styles.chip, active && styles.chipActive]}
                        onPress={() => setEmotionalTriggers(toggle(emotionalTriggers, o.id))}
                      >
                        <ThemedText style={[styles.chipText, active && styles.chipTextActive]}>{o.label}</ThemedText>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* First warning sign */}
              <View style={styles.fieldBlock}>
                <SectionTitle title="What is usually the first sign?" />
                <View style={styles.signGrid}>
                  {WARNING_SIGNS.map((o) => {
                    const active = firstWarningSign === o.id;
                    return (
                      <TouchableOpacity key={o.id} activeOpacity={0.7}
                        style={[styles.signCard, active && styles.signCardActive]}
                        onPress={() => setFirstWarningSign(o.id)}
                      >
                        <Ionicons name={o.icon as any} size={20} color={active ? '#00A8FF' : 'rgba(255,255,255,0.4)'} />
                        <ThemedText style={[styles.signLabel, active && styles.signLabelActive]}>{o.label}</ThemedText>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Urge duration */}
              <View style={styles.fieldBlock}>
                <SectionTitle title="How long does an urge normally last?" />
                <View style={styles.chipRow}>
                  {URGE_DURATIONS.map((o) => {
                    const active = urgeDuration === o.id;
                    return (
                      <TouchableOpacity key={o.id} activeOpacity={0.7}
                        style={[styles.chip, active && styles.chipActive]}
                        onPress={() => setUrgeDuration(o.id)}
                      >
                        <ThemedText style={[styles.chipText, active && styles.chipTextActive]}>{o.label}</ThemedText>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Typical response */}
              <View style={styles.fieldBlock}>
                <SectionTitle title="What do you usually do when an urge starts?" hint="Select all that apply" />
                <View style={styles.chipRow}>
                  {TYPICAL_RESPONSES.map((o) => {
                    const active = typicalResponses.includes(o.id);
                    return (
                      <TouchableOpacity key={o.id} activeOpacity={0.7}
                        style={[styles.chip, active && styles.chipActive]}
                        onPress={() => setTypicalResponses(toggle(typicalResponses, o.id))}
                      >
                        <Ionicons name={o.icon as any} size={13} color={active ? '#00A8FF' : 'rgba(255,255,255,0.4)'} />
                        <ThemedText style={[styles.chipText, active && styles.chipTextActive]}>{o.label}</ThemedText>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Emotional aftermath */}
              <View style={styles.fieldBlock}>
                <SectionTitle title="How do you usually feel afterwards?" hint="Select all that apply" />
                <View style={styles.aftermathGrid}>
                  {AFTERMATH.map((o) => {
                    const active = emotionalAftermath.includes(o.id);
                    return (
                      <TouchableOpacity key={o.id} activeOpacity={0.7}
                        style={[styles.aftermathCard, active && styles.aftermathCardActive]}
                        onPress={() => setEmotionalAftermath(toggle(emotionalAftermath, o.id))}
                      >
                        <ThemedText style={styles.aftermathEmoji}>{o.emoji}</ThemedText>
                        <ThemedText style={[styles.aftermathLabel, active && styles.aftermathLabelActive]}>{o.label}</ThemedText>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Primary device */}
              <View style={styles.fieldBlock}>
                <SectionTitle title="Which device is most commonly involved?" />
                <View style={styles.chipRow}>
                  {DEVICES.map((o) => {
                    const active = primaryDevice === o.id;
                    return (
                      <TouchableOpacity key={o.id} activeOpacity={0.7}
                        style={[styles.chip, active && styles.chipActive]}
                        onPress={() => setPrimaryDevice(o.id)}
                      >
                        <Ionicons name={o.icon as any} size={13} color={active ? '#00A8FF' : 'rgba(255,255,255,0.4)'} />
                        <ThemedText style={[styles.chipText, active && styles.chipTextActive]}>{o.label}</ThemedText>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Online platforms */}
              <View style={styles.fieldBlock}>
                <View style={styles.fieldLabelRow}>
                  <SectionTitle title="Where do you spend the most time online?" hint="Select up to 3" />
                  <View style={styles.countBadge}>
                    <ThemedText style={styles.countBadgeText}>{onlinePlatforms.length}/3</ThemedText>
                  </View>
                </View>
                <View style={styles.chipRow}>
                  {PLATFORMS.map((o) => {
                    const active = onlinePlatforms.includes(o.id);
                    const disabled = !active && onlinePlatforms.length >= 3;
                    return (
                      <TouchableOpacity key={o.id} activeOpacity={disabled ? 1 : 0.7}
                        style={[styles.chip, active && styles.chipActive, disabled && styles.chipDisabled]}
                        onPress={() => !disabled && setOnlinePlatforms(toggleMax(onlinePlatforms, o.id, 3))}
                      >
                        <ThemedText style={[styles.chipText, active && styles.chipTextActive]}>{o.label}</ThemedText>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* CTA */}
              <TouchableOpacity activeOpacity={0.85} style={[styles.btnPrimaryContainer, isSubmitting && { opacity: 0.75 }]} onPress={handleContinue} disabled={isSubmitting}>
                <LinearGradient colors={['#00A8FF', '#0052D4']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.btnPrimaryGradient}>
                  {isSubmitting ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                      <ActivityIndicator size="small" color="#ffffff" style={{ marginRight: 8 }} />
                      <ThemedText style={styles.btnPrimaryText}>Saving Triggers...</ThemedText>
                    </View>
                  ) : (
                    <View style={styles.btnPrimaryInner}>
                      <ThemedText style={styles.btnPrimaryText}>Continue</ThemedText>
                      <ThemedText style={styles.btnArrow}>➔</ThemedText>
                    </View>
                  )}
                </LinearGradient>
              </TouchableOpacity>

              <View style={styles.footerLinkRow}>
                <TouchableOpacity onPress={() => router.replace('/(auth)/onboarding-permissions' as any)}>
                  <ThemedText style={styles.footerAction}>Skip Step</ThemedText>
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
  logoWill: { color: '#00F0FF' },
  progressContainer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.four, paddingTop: 10, gap: 10, alignSelf: 'center', maxWidth: 600, width: '100%' },
  progressBar: { flex: 1, height: 4, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 2, backgroundColor: '#00F0FF' },
  progressLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '600' },
  scrollContent: { flexGrow: 1, alignItems: 'center' },
  contentContainer: { width: '100%', maxWidth: 600, paddingHorizontal: Spacing.four, paddingBottom: Spacing.five, paddingTop: 4 },
  titleSection: { marginTop: Spacing.four, marginBottom: Spacing.four, gap: Spacing.one },
  stepText: { color: '#00F0FF', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  title: { fontSize: 28, fontWeight: '800', color: '#ffffff', letterSpacing: -0.5 },
  subtitle: { fontSize: 14, color: 'rgba(255,255,255,0.55)', lineHeight: 20, marginTop: 2 },
  fieldBlock: { marginBottom: 24 },
  fieldLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  fieldLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: '600', letterSpacing: 0.3 },
  fieldHint: { color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 2 },
  countBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20, backgroundColor: 'rgba(0,240,255,0.12)', borderWidth: 1, borderColor: 'rgba(0,240,255,0.3)' },
  countBadgeText: { color: '#00F0FF', fontSize: 12, fontWeight: '700' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 13, paddingVertical: 9, borderRadius: 24,
    backgroundColor: '#111215', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    flexDirection: 'row', alignItems: 'center', gap: 5,
  },
  chipActive: { backgroundColor: 'rgba(0,240,255,0.12)', borderColor: '#00F0FF' },
  chipDisabled: { opacity: 0.35 },
  chipText: { color: 'rgba(255,255,255,0.55)', fontSize: 12, fontWeight: '500' },
  chipTextActive: { color: '#00F0FF', fontWeight: '700' },
  signGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  signCard: {
    flex: 1, minWidth: 90, paddingVertical: 14, alignItems: 'center', gap: 6,
    backgroundColor: '#111215', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderRadius: 14,
  },
  signCardActive: { borderColor: '#00F0FF', backgroundColor: 'rgba(0,240,255,0.1)' },
  signLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '500', textAlign: 'center' },
  signLabelActive: { color: '#00F0FF', fontWeight: '700' },
  aftermathGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  aftermathCard: {
    flex: 1, minWidth: 70, paddingVertical: 12, alignItems: 'center', gap: 5,
    backgroundColor: '#111215', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderRadius: 12,
  },
  aftermathCardActive: { borderColor: '#00F0FF', backgroundColor: 'rgba(0,240,255,0.1)' },
  aftermathEmoji: { fontSize: 22 },
  aftermathLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 10, fontWeight: '500', textAlign: 'center' },
  aftermathLabelActive: { color: '#00F0FF', fontWeight: '700' },
  btnPrimaryContainer: { borderRadius: 16, overflow: 'hidden', marginTop: 12, shadowColor: '#00F0FF', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 10, elevation: 6 },
  btnPrimaryGradient: { paddingVertical: 16 },
  btnPrimaryInner: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  btnPrimaryText: { color: '#070709', fontWeight: '800', fontSize: 16, letterSpacing: 0.5 },
  btnArrow: { color: '#070709', fontSize: 15, fontWeight: 'bold' },
  footerLinkRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: Spacing.four },
  footerAction: { color: 'rgba(255,255,255,0.5)', fontSize: 14, fontWeight: '600', textDecorationLine: 'underline' },
});
