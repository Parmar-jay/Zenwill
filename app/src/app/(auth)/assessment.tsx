import React, { useState } from 'react';
import {
  StyleSheet, TouchableOpacity, ScrollView, View,
  Platform, Dimensions, ActivityIndicator,
  KeyboardAvoidingView,
} from 'react-native';
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
  SelfControl, Mood, EnergyLevel, SleepQuality, FocusLevel, EmotionalControl,
  UrgeFrequency, ScreenTime,
} from '@/store/onboarding-store';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ── Data ──────────────────────────────────────────────────────────────────────
const SELF_CONTROL_OPTS: { id: SelfControl; label: string; color: string }[] = [
  { id: 'very_strong', label: 'Very Strong', color: '#00C851' },
  { id: 'strong', label: 'Strong', color: '#7CFC00' },
  { id: 'average', label: 'Average', color: '#FFB300' },
  { id: 'weak', label: 'Weak', color: '#FF6B35' },
  { id: 'very_weak', label: 'Very Weak', color: '#FF3B30' },
];

const MOOD_OPTS: { id: Mood; label: string; emoji: string }[] = [
  { id: 'excellent', label: 'Excellent', emoji: '😄' },
  { id: 'good', label: 'Good', emoji: '🙂' },
  { id: 'neutral', label: 'Neutral', emoji: '😐' },
  { id: 'low', label: 'Low', emoji: '😔' },
  { id: 'very_low', label: 'Very Low', emoji: '😞' },
];

const ENERGY_OPTS: { id: EnergyLevel; label: string; icon: string }[] = [
  { id: 'high', label: 'High', icon: 'flash-outline' },
  { id: 'medium', label: 'Medium', icon: 'battery-half-outline' },
  { id: 'low', label: 'Low', icon: 'battery-dead-outline' },
  { id: 'very_low', label: 'Very Low', icon: 'remove-circle-outline' },
];

const makeQuality = <T extends string>(ids: T[], labels: string[]): { id: T; label: string }[] =>
  ids.map((id, i) => ({ id, label: labels[i] }));

const SLEEP_OPTS = makeQuality<SleepQuality>(
  ['excellent', 'good', 'average', 'poor', 'very_poor'],
  ['Excellent', 'Good', 'Average', 'Poor', 'Very Poor']
);
const FOCUS_OPTS = makeQuality<FocusLevel>(
  ['excellent', 'good', 'average', 'poor', 'very_poor'],
  ['Excellent', 'Good', 'Average', 'Poor', 'Very Poor']
);
const EMO_CTRL_OPTS = makeQuality<EmotionalControl>(
  ['excellent', 'good', 'average', 'poor', 'very_poor'],
  ['Excellent', 'Good', 'Average', 'Poor', 'Very Poor']
);
const URGE_FREQ_OPTS: { id: UrgeFrequency; label: string }[] = [
  { id: 'rarely', label: 'Rarely' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'few_times_weekly', label: 'Few Times Weekly' },
  { id: 'daily', label: 'Daily' },
  { id: 'multiple_daily', label: 'Multiple Times Daily' },
];
const SCREEN_TIME_OPTS: { id: ScreenTime; label: string }[] = [
  { id: 'under_2h', label: 'Under 2 Hours' },
  { id: '2_4h', label: '2–4 Hours' },
  { id: '4_6h', label: '4–6 Hours' },
  { id: '6_8h', label: '6–8 Hours' },
  { id: 'more_8h', label: 'More Than 8 Hours' },
];

// ── Slider ────────────────────────────────────────────────────────────────────
function SliderField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  const steps = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  return (
    <View style={styles.fieldBlock}>
      <View style={styles.sliderHeader}>
        <ThemedText style={styles.fieldLabel}>{label}</ThemedText>
        <View style={styles.sliderBadge}>
          <ThemedText style={styles.sliderBadgeText}>{value}/10</ThemedText>
        </View>
      </View>
      <View style={styles.sliderRow}>
        {steps.map((s) => (
          <TouchableOpacity
            key={s}
            activeOpacity={0.7}
            style={[styles.sliderStep, s <= value && styles.sliderStepActive]}
            onPress={() => onChange(s)}
          >
            <ThemedText style={[styles.sliderStepText, s <= value && styles.sliderStepTextActive]}>
              {s}
            </ThemedText>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

// ── ChipRow ───────────────────────────────────────────────────────────────────
function ChipRow<T extends string>({ options, selected, onSelect }: {
  options: { id: T; label: string }[];
  selected: T;
  onSelect: (id: T) => void;
}) {
  return (
    <View style={styles.chipRow}>
      {options.map((o) => {
        const active = selected === o.id;
        return (
          <TouchableOpacity key={o.id} activeOpacity={0.7}
            style={[styles.chip, active && styles.chipActive]}
            onPress={() => onSelect(o.id)}
          >
            <ThemedText style={[styles.chipText, active && styles.chipTextActive]}>{o.label}</ThemedText>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────
export default function AuthAssessmentScreen() {
  const router = useRouter();
  const { edit } = useLocalSearchParams<{ edit?: string }>();
  const profile = useOnboardingStore();
  const updateProfile = useOnboardingStore((s) => s.updateProfile);

  const [selfControl, setSelfControl] = useState<SelfControl>(profile.selfControl || '');
  const [motivation, setMotivation] = useState(profile.motivationToChange || 5);
  const [confidence, setConfidence] = useState(profile.confidenceInQuitting || 5);
  const [stress, setStress] = useState(profile.stressLevel || 5);
  const [anxiety, setAnxiety] = useState(profile.anxietyLevel || 5);
  const [mood, setMood] = useState<Mood>(profile.mood || '');
  const [energy, setEnergy] = useState<EnergyLevel>(profile.energy || '');
  const [sleepQuality, setSleepQuality] = useState<SleepQuality>(profile.sleepQuality || '');
  const [focusLevel, setFocusLevel] = useState<FocusLevel>(profile.focusLevel || '');
  const [emotionalControl, setEmotionalControl] = useState<EmotionalControl>(profile.emotionalControl || '');
  const [urgeFrequency, setUrgeFrequency] = useState<UrgeFrequency>(profile.urgeFrequency || '');
  const [screenTime, setScreenTime] = useState<ScreenTime>(profile.screenTime || '');

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleContinue = () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    updateProfile({
      selfControl,
      motivationToChange: motivation,
      confidenceInQuitting: confidence,
      stressLevel: stress,
      anxietyLevel: anxiety,
      mood,
      energy,
      sleepQuality,
      focusLevel,
      emotionalControl,
      urgeFrequency,
      screenTime,
    });
    router.replace({ pathname: '/(auth)/onboarding-purpose', params: edit === 'true' ? { edit: 'true' } : {} } as any);
    setTimeout(() => setIsSubmitting(false), 1000);
  };

  return (
    <View style={styles.container}>
      <View style={styles.ambientGlow1} pointerEvents="none" />
      <View style={styles.ambientGlow2} pointerEvents="none" />
      <LinearGradient colors={['rgba(0,0,0,0.1)', '#000000']} style={styles.fadeOverlay} pointerEvents="none" />
      <Stack.Screen options={{ headerShown: false }} />

      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 20 : 0}
        >
          <Animated.View entering={FadeIn.duration(400)} style={styles.mainWrapper}>
            {/* Header */}
            <View style={styles.headerRow}>
              <TouchableOpacity activeOpacity={0.6} style={styles.backButton}
                onPress={() => router.replace({ pathname: '/(auth)/create-profile', params: edit === 'true' ? { edit: 'true' } : {} } as any)}>
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
                <LinearGradient colors={['#00E5FF', '#00A8FF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={[styles.progressFill, { width: '40%' }]} />
              </View>
              <ThemedText style={styles.progressLabel}>Step 2 of 5</ThemedText>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets={true}>
              <View style={styles.contentContainer}>
                <View style={styles.titleSection}>
                  <ThemedText style={styles.stepText}>Self-Control Assessment</ThemedText>
                  <ThemedText style={styles.title}>Your Mental & Energy Check</ThemedText>
                  <ThemedText style={styles.subtitle}>
                    Understanding your current stress, sleep, and self-control helps ZenWill give you the right tools at the right moment.
                  </ThemedText>
                </View>

                {/* Self Control */}
                <View style={styles.fieldBlock}>
                  <ThemedText style={styles.fieldLabel}>Self Control</ThemedText>
                  <View style={styles.chipRow}>
                    {SELF_CONTROL_OPTS.map((o) => {
                      const active = selfControl === o.id;
                      return (
                        <TouchableOpacity key={o.id} activeOpacity={0.7}
                          style={[styles.chip, active && { backgroundColor: `${o.color}22`, borderColor: o.color }]}
                          onPress={() => setSelfControl(o.id)}
                        >
                          <ThemedText style={[styles.chipText, active && { color: o.color, fontWeight: '700' }]}>
                            {o.label}
                          </ThemedText>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                <SliderField label="Motivation to Change" value={motivation} onChange={setMotivation} />
                <SliderField label="Confidence in Quitting" value={confidence} onChange={setConfidence} />
                <SliderField label="Stress Level" value={stress} onChange={setStress} />
                <SliderField label="Anxiety Level" value={anxiety} onChange={setAnxiety} />

                {/* Mood */}
                <View style={styles.fieldBlock}>
                  <ThemedText style={styles.fieldLabel}>Current Mood</ThemedText>
                  <View style={styles.emojiRow}>
                    {MOOD_OPTS.map((o) => {
                      const active = mood === o.id;
                      return (
                        <TouchableOpacity key={o.id} activeOpacity={0.7}
                          style={[styles.emojiCard, active && styles.emojiCardActive]}
                          onPress={() => setMood(o.id)}
                        >
                          <ThemedText style={styles.emoji}>{o.emoji}</ThemedText>
                          <ThemedText style={[styles.emojiLabel, active && styles.emojiLabelActive]}>{o.label}</ThemedText>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {/* Energy */}
                <View style={styles.fieldBlock}>
                  <ThemedText style={styles.fieldLabel}>Energy Level</ThemedText>
                  <View style={styles.chipRow}>
                    {ENERGY_OPTS.map((o) => {
                      const active = energy === o.id;
                      return (
                        <TouchableOpacity key={o.id} activeOpacity={0.7}
                          style={[styles.chip, active && styles.chipActive]}
                          onPress={() => setEnergy(o.id)}
                        >
                          <Ionicons name={o.icon as any} size={14} color={active ? '#00E5FF' : 'rgba(255,255,255,0.4)'} />
                          <ThemedText style={[styles.chipText, active && styles.chipTextActive]}>{o.label}</ThemedText>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {/* Sleep Quality */}
                <View style={styles.fieldBlock}>
                  <ThemedText style={styles.fieldLabel}>Sleep Quality</ThemedText>
                  <ChipRow options={SLEEP_OPTS} selected={sleepQuality} onSelect={setSleepQuality} />
                </View>

                {/* Focus Level */}
                <View style={styles.fieldBlock}>
                  <ThemedText style={styles.fieldLabel}>Focus Level</ThemedText>
                  <ChipRow options={FOCUS_OPTS} selected={focusLevel} onSelect={setFocusLevel} />
                </View>

                {/* Emotional Control */}
                <View style={styles.fieldBlock}>
                  <ThemedText style={styles.fieldLabel}>Emotional Control</ThemedText>
                  <ChipRow options={EMO_CTRL_OPTS} selected={emotionalControl} onSelect={setEmotionalControl} />
                </View>

                {/* Urge Frequency */}
                <View style={styles.fieldBlock}>
                  <ThemedText style={styles.fieldLabel}>Frequency of Unwanted Urges</ThemedText>
                  <ChipRow options={URGE_FREQ_OPTS} selected={urgeFrequency} onSelect={setUrgeFrequency} />
                </View>

                {/* Screen Time */}
                <View style={styles.fieldBlock}>
                  <ThemedText style={styles.fieldLabel}>Average Daily Screen Time</ThemedText>
                  <ChipRow options={SCREEN_TIME_OPTS} selected={screenTime} onSelect={setScreenTime} />
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
                        <ThemedText style={styles.btnPrimaryText}>Continue</ThemedText>
                        <ThemedText style={styles.btnArrow}>➔</ThemedText>
                      </View>
                    )}
                  </LinearGradient>
                </TouchableOpacity>

                <View style={styles.footerLinkRow}>
                  <TouchableOpacity onPress={() => router.replace('/(auth)/onboarding-purpose' as any)}>
                    <ThemedText style={styles.footerAction}>Skip Step</ThemedText>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          </Animated.View>
        </KeyboardAvoidingView>
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
  headerRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.four, paddingTop: Spacing.two, height: 50,
  },
  backButton: { backgroundColor: 'transparent', padding: 4, alignItems: 'center', justifyContent: 'center' },
  logoCenter: { alignItems: 'center' },
  logoText: {
    fontSize: 22,
    fontFamily: Platform.select({ ios: 'Didot', android: 'serif', default: 'serif' }),
    fontWeight: '800', letterSpacing: 2,
  },
  logoZen: { color: '#ffffff' },
  logoWill: { color: '#00E5FF' },
  progressContainer: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.four,
    paddingTop: 10, gap: 10,
  },
  progressBar: {
    flex: 1, height: 3, backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 2, overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 2 },
  progressLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: '600' },
  scrollContent: { flexGrow: 1, alignItems: 'center', paddingBottom: 150 },
  contentContainer: { width: '100%', maxWidth: 600, paddingHorizontal: Spacing.four, paddingBottom: Spacing.five, paddingTop: 4 },
  titleSection: { marginTop: Spacing.four, marginBottom: Spacing.four, gap: Spacing.one },
  stepText: { color: '#00E5FF', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  title: { fontSize: 28, fontWeight: '800', color: '#ffffff', letterSpacing: -0.5 },
  subtitle: { fontSize: 14, color: 'rgba(255,255,255,0.45)', lineHeight: 20, marginTop: 2 },
  fieldBlock: { marginBottom: 22 },
  fieldLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: '600', marginBottom: 10, letterSpacing: 0.3 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 24,
    backgroundColor: '#111215', borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
    flexDirection: 'row', alignItems: 'center', gap: 5,
  },
  chipActive: { backgroundColor: 'rgba(0,229,255,0.12)', borderColor: '#00E5FF' },
  chipText: { color: 'rgba(255,255,255,0.5)', fontSize: 13, fontWeight: '500' },
  chipTextActive: { color: '#00E5FF', fontWeight: '700' },
  // Slider
  sliderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sliderBadge: {
    paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20,
    backgroundColor: 'rgba(0,229,255,0.12)', borderWidth: 1, borderColor: 'rgba(0,229,255,0.3)',
  },
  sliderBadgeText: { color: '#00E5FF', fontSize: 12, fontWeight: '700' },
  sliderRow: { flexDirection: 'row', gap: 5 },
  sliderStep: {
    flex: 1, paddingVertical: 10, borderRadius: 10,
    backgroundColor: '#111215', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
  },
  sliderStepActive: { backgroundColor: 'rgba(0,229,255,0.15)', borderColor: '#00E5FF' },
  sliderStepText: { color: 'rgba(255,255,255,0.3)', fontSize: 12, fontWeight: '600' },
  sliderStepTextActive: { color: '#00E5FF', fontWeight: '700' },
  // Mood
  emojiRow: { flexDirection: 'row', gap: 8 },
  emojiCard: {
    flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 14,
    backgroundColor: '#111215', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', gap: 4,
  },
  emojiCardActive: { borderColor: '#00E5FF', backgroundColor: 'rgba(0,229,255,0.08)' },
  emoji: { fontSize: 22 },
  emojiLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: '500' },
  emojiLabelActive: { color: '#00E5FF', fontWeight: '700' },
  btnPrimaryContainer: { borderRadius: 20, overflow: 'hidden', marginTop: 8 },
  btnPrimaryGradient: { paddingVertical: 16 },
  btnPrimaryInner: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  btnPrimaryText: { color: '#000000', fontWeight: '700', fontSize: 15.5, letterSpacing: 0.3 },
  btnArrow: { color: '#000000', fontSize: 14, fontWeight: '700' },
  footerLinkRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: Spacing.four },
  footerAction: { color: 'rgba(255,255,255,0.4)', fontSize: 14, fontWeight: '600', textDecorationLine: 'underline' },
});
