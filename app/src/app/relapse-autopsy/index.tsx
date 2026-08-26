import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { ThemedText } from '@/components/themed-text';
import { PageEntrance } from '@/components/ui/smooth-loader';
import { analyticsApi, RelapseAutopsyResult } from '@/services/analytics-api';
import { useAuthStore } from '@/store/auth-store';
import { useHabitStore } from '@/store/habit-store';

interface DominoOption {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  color: string;
}

const DOMINO_OPTIONS: DominoOption[] = [
  {
    id: 'phone_in_bed',
    icon: 'bed-outline',
    title: 'Taking phone to bed',
    subtitle: 'Using your phone in bed or in a dark room late at night.',
    color: '#EF4444',
  },
  {
    id: 'doomscrolling',
    icon: 'phone-portrait-outline',
    title: 'Endless social media scrolling',
    subtitle: 'Mindlessly scrolling Reels, TikTok, X, or Reddit until willpower dropped.',
    color: '#EC4899',
  },
  {
    id: 'work_stress_isolation',
    icon: 'briefcase-outline',
    title: 'Work or study stress',
    subtitle: 'Feeling overwhelmed with work or tasks and seeking quick escape.',
    color: '#F59E0B',
  },
  {
    id: 'suggestive_peeking',
    icon: 'eye-outline',
    title: 'Peeking at suggestive content',
    subtitle: 'Looking at provocative pictures, videos, or soft triggers.',
    color: '#8B5CF6',
  },
  {
    id: 'skipped_habits',
    icon: 'calendar-outline',
    title: 'Skipped daily routine',
    subtitle: 'Missed your morning check-in, daily workout, or meditation.',
    color: '#3B82F6',
  },
  {
    id: 'late_night_boredom',
    icon: 'moon-outline',
    title: 'Late-night boredom',
    subtitle: 'Staying awake past 11 PM with nothing productive to do.',
    color: '#00E5FF',
  },
  {
    id: 'bathroom_phone',
    icon: 'water-outline',
    title: 'Taking phone into bathroom',
    subtitle: 'Bringing your mobile device into private bathroom solitude.',
    color: '#10B981',
  },
  {
    id: 'emotional_loneliness',
    icon: 'heart-dislike-outline',
    title: 'Feeling lonely or upset',
    subtitle: 'Feeling hurt, rejected, or alone and wanting dopamine comfort.',
    color: '#F43F5E',
  },
  {
    id: 'couch_procrastination',
    icon: 'tv-outline',
    title: 'Lying on couch doing nothing',
    subtitle: 'Hours of horizontal lounging, putting off tasks, and grazing screens.',
    color: '#EAB308',
  },
  {
    id: 'incognito_browsing',
    icon: 'shield-half-outline',
    title: 'Opening private / incognito tab',
    subtitle: 'Opening unmonitored private browser tabs thinking it wouldn\'t hurt.',
    color: '#A855F7',
  },
  {
    id: 'alcohol_substances',
    icon: 'beer-outline',
    title: 'Tiredness or alcohol',
    subtitle: 'Being physically exhausted or having a drink that lowered your guards.',
    color: '#6366F1',
  },
];

const EMOTIONAL_PRECURSORS = [
  'Stress',
  'Tiredness',
  'Loneliness',
  'Boredom',
  'Anxiety',
  'Frustration',
  'Overwhelmed',
  'Restlessness',
];

const ENVIRONMENTS = [
  'Bedroom Bedside',
  'Bathroom',
  'Living Room Couch',
  'Work Desk',
  'Alone in Room',
  'Car / Traveling',
];

const DEVICES = ['Phone', 'Laptop', 'Tablet', 'Desktop PC'];

export default function RelapseAutopsyScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const streak = useHabitStore((state) => state.streak);

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [selectedDomino, setSelectedDomino] = useState<string>('phone_in_bed');
  const [selectedEmotion, setSelectedEmotion] = useState<string>('Stress');
  const [selectedEnvironment, setSelectedEnvironment] = useState<string>('Bedroom Bedside');
  const [selectedDevice, setSelectedDevice] = useState<string>('Phone');
  const [reflectionNote, setReflectionNote] = useState<string>('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [autopsyResult, setAutopsyResult] = useState<RelapseAutopsyResult | null>(null);

  const triggerHaptic = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {
      // ignore
    }
  };

  const handleBack = () => {
    triggerHaptic();
    if (step > 1 && step < 4) {
      setStep((prev) => (prev - 1) as any);
    } else {
      router.back();
    }
  };

  const handleSubmitAutopsy = async () => {
    try {
      triggerHaptic();
      setIsSubmitting(true);
      // Immediately log relapse optimistically in habitStore so streak and badges update in real-time
      useHabitStore.getState().logDay(false);

      const result = await analyticsApi.submitRelapseAutopsy({
        first_compromise_domino: selectedDomino,
        emotional_precursor: selectedEmotion.toLowerCase(),
        physical_environment: selectedEnvironment,
        device_involved: selectedDevice.toLowerCase(),
        user_reflection_note: reflectionNote,
      });
      setAutopsyResult(result);
      setStep(4);
    } catch (e) {
      // fallback result with actual user streak context if offline
      useHabitStore.getState().logDay(false);
      const dom = DOMINO_OPTIONS.find((d) => d.id === selectedDomino);
      const prevStreak = streak || user?.streak || 0;
      setAutopsyResult({
        success: true,
        retained_percentage: 90.0,
        clean_days_count: prevStreak,
        streak_before: prevStreak,
        domino_title: dom?.title || 'Bedside Phone',
        generated_golden_rule: `The ${selectedEnvironment} Boundary: Keep your ${selectedDevice} away from where you sleep and avoid using screens in bed.`,
        rule_category: 'Environmental',
        reframing_message:
          prevStreak > 0
            ? `Your ${prevStreak} clean ${prevStreak === 1 ? 'day' : 'days'} built real discipline. Follow this simple rule and get right back on track.`
            : 'Every setback gives you clear data. Follow this simple rule starting today to build a strong clean streak.',
      });
      setStep(4);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
        {/* Header Bar with clean cyan back button */}
        <View style={styles.navBar}>
          <TouchableOpacity
            style={styles.backBtn}
            activeOpacity={0.7}
            onPress={handleBack}
          >
            <Ionicons name="chevron-back" size={24} color="#00E5FF" />
          </TouchableOpacity>
          <View style={styles.navCenter}>
            <ThemedText style={styles.navTitle}>RESET & RELOAD</ThemedText>
            <ThemedText style={styles.navSubTitle}>STEP {step} OF 4</ThemedText>
          </View>
          <View style={{ width: 32 }} />
        </View>

        {/* Top Thin Progress Bar */}
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${(step / 4) * 100}%` }]} />
        </View>

        <PageEntrance style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {/* ──────────────── STEP 1: SIMPLE, ENCOURAGING GROUNDING ──────────────── */}
            {step === 1 && (
              <View style={styles.stepContainer}>
                <View style={styles.badgeRow}>
                  <View style={styles.stoicBadge}>
                    <Ionicons name="shield-checkmark" size={13} color="#00E5FF" style={{ marginRight: 4 }} />
                    <ThemedText style={styles.stoicBadgeText}>RESET & PROTECT</ThemedText>
                  </View>
                </View>

                <ThemedText style={styles.heroHeadline}>Don&apos;t Be Hard on Yourself.</ThemedText>

                <ThemedText style={styles.heroBody}>
                  A mistake does not erase your progress. Guilt and shame only make you want to give up. What matters right now is finding what caused this and setting one simple rule so it doesn&apos;t happen again.
                </ThemedText>

                {/* Clear 3-Step Guide Card */}
                <View style={styles.groundingCard}>
                  <View style={styles.groundingHeaderRow}>
                    <Ionicons name="compass-outline" size={16} color="#00E5FF" />
                    <ThemedText style={styles.groundingTitle}>WHAT WE WILL DO IN 60 SECONDS</ThemedText>
                  </View>

                  <View style={styles.stepList}>
                    <View style={styles.stepItemRow}>
                      <View style={styles.stepNumberBadge}>
                        <ThemedText style={styles.stepNumberBadgeText}>1</ThemedText>
                      </View>
                      <ThemedText style={styles.stepItemText}>
                        <ThemedText style={styles.stepItemBold}>Isolate the Trigger:</ThemedText> Find the small choice made 2–3 hours ago that started this.
                      </ThemedText>
                    </View>

                    <View style={styles.stepItemRow}>
                      <View style={styles.stepNumberBadge}>
                        <ThemedText style={styles.stepNumberBadgeText}>2</ThemedText>
                      </View>
                      <ThemedText style={styles.stepItemText}>
                        <ThemedText style={styles.stepItemBold}>Map Environment:</ThemedText> Identify the room, emotional state, and device involved.
                      </ThemedText>
                    </View>

                    <View style={styles.stepItemRow}>
                      <View style={styles.stepNumberBadge}>
                        <ThemedText style={styles.stepNumberBadgeText}>3</ThemedText>
                      </View>
                      <ThemedText style={styles.stepItemText}>
                        <ThemedText style={styles.stepItemBold}>Deploy Shield Rule:</ThemedText> Create 1 ironclad rule to protect you tomorrow.
                      </ThemedText>
                    </View>
                  </View>

                  {(streak > 0 || (user?.streak || 0) > 0) && (
                    <View style={styles.streakContextBox}>
                      <View style={styles.streakIconCircle}>
                        <Ionicons name="flame" size={16} color="#F59E0B" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <ThemedText style={styles.streakContextTitle}>
                          Previous Streak: {streak || user?.streak || 0} {(streak || user?.streak || 0) === 1 ? 'Day' : 'Days'} Clean
                        </ThemedText>
                        <ThemedText style={styles.streakContextSubtitle}>
                          Your neural rewiring and mind strength are preserved.
                        </ThemedText>
                      </View>
                    </View>
                  )}
                </View>

                <TouchableOpacity
                  style={styles.primaryBtn}
                  activeOpacity={0.88}
                  onPress={() => {
                    triggerHaptic();
                    setStep(2);
                  }}
                >
                  <ThemedText style={styles.primaryBtnText}>Find What Happened</ThemedText>
                  <Ionicons name="arrow-forward" size={16} color="#030712" />
                </TouchableOpacity>
              </View>
            )}

            {/* ──────────────── STEP 2: THE FIRST CHOICE (EASY TO UNDERSTAND) ──────────────── */}
            {step === 2 && (
              <View style={styles.stepContainer}>
                <View style={styles.badgeRow}>
                  <View style={[styles.stoicBadge, { borderColor: 'rgba(239, 68, 68, 0.4)', backgroundColor: 'rgba(239, 68, 68, 0.12)' }]}>
                    <Ionicons name="git-branch" size={13} color="#EF4444" style={{ marginRight: 4 }} />
                    <ThemedText style={[styles.stoicBadgeText, { color: '#EF4444' }]}>THE FIRST STEP</ThemedText>
                  </View>
                </View>

                <ThemedText style={styles.heroHeadline}>What started this chain reaction?</ThemedText>
                <ThemedText style={styles.heroSubText}>
                  Relapses usually start hours earlier with a choice that seemed harmless at the time. Which of these happened first?
                </ThemedText>

                <View style={styles.dominoList}>
                  {DOMINO_OPTIONS.map((item) => {
                    const isSelected = selectedDomino === item.id;
                    return (
                      <TouchableOpacity
                        key={item.id}
                        style={[
                          styles.dominoCard,
                          isSelected && { borderColor: item.color, backgroundColor: `${item.color}15` },
                        ]}
                        activeOpacity={0.8}
                        onPress={() => {
                          triggerHaptic();
                          setSelectedDomino(item.id);
                        }}
                      >
                        <View style={[styles.dominoIconCircle, { backgroundColor: `${item.color}25` }]}>
                          <Ionicons name={item.icon} size={20} color={item.color} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <ThemedText style={[styles.dominoTitle, isSelected && { color: item.color }]}>
                            {item.title}
                          </ThemedText>
                          <ThemedText style={styles.dominoSubtitle}>{item.subtitle}</ThemedText>
                        </View>
                        <View style={[styles.radioCircle, isSelected && { borderColor: item.color }]}>
                          {isSelected && <View style={[styles.radioDot, { backgroundColor: item.color }]} />}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <TouchableOpacity
                  style={styles.primaryBtn}
                  activeOpacity={0.88}
                  onPress={() => {
                    triggerHaptic();
                    setStep(3);
                  }}
                >
                  <ThemedText style={styles.primaryBtnText}>Next: What Triggered You?</ThemedText>
                  <Ionicons name="arrow-forward" size={16} color="#030712" />
                </TouchableOpacity>
              </View>
            )}

            {/* ──────────────── STEP 3: WHERE & HOW ──────────────── */}
            {step === 3 && (
              <View style={styles.stepContainer}>
                <View style={styles.badgeRow}>
                  <View style={[styles.stoicBadge, { borderColor: 'rgba(245, 158, 11, 0.4)', backgroundColor: 'rgba(245, 158, 11, 0.12)' }]}>
                    <Ionicons name="analytics" size={13} color="#F59E0B" style={{ marginRight: 4 }} />
                    <ThemedText style={[styles.stoicBadgeText, { color: '#F59E0B' }]}>WHERE & HOW</ThemedText>
                  </View>
                </View>

                <ThemedText style={styles.heroHeadline}>Where were you and how did you feel?</ThemedText>
                <ThemedText style={styles.heroSubText}>
                  Tell us what was happening around you so we can build your protection rule.
                </ThemedText>

                {/* 1. Emotional Precursor */}
                <ThemedText style={styles.fieldLabel}>HOW WERE YOU FEELING?</ThemedText>
                <View style={styles.chipRow}>
                  {EMOTIONAL_PRECURSORS.map((em) => {
                    const isSel = selectedEmotion === em;
                    return (
                      <TouchableOpacity
                        key={em}
                        style={[styles.chipBtn, isSel && styles.chipBtnActive]}
                        onPress={() => {
                          triggerHaptic();
                          setSelectedEmotion(em);
                        }}
                      >
                        <ThemedText style={[styles.chipText, isSel && styles.chipTextActive]}>{em}</ThemedText>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* 2. Physical Environment */}
                <ThemedText style={[styles.fieldLabel, { marginTop: 16 }]}>WHERE WERE YOU?</ThemedText>
                <View style={styles.chipRow}>
                  {ENVIRONMENTS.map((env) => {
                    const isSel = selectedEnvironment === env;
                    return (
                      <TouchableOpacity
                        key={env}
                        style={[styles.chipBtn, isSel && styles.chipBtnActive]}
                        onPress={() => {
                          triggerHaptic();
                          setSelectedEnvironment(env);
                        }}
                      >
                        <ThemedText style={[styles.chipText, isSel && styles.chipTextActive]}>{env}</ThemedText>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* 3. Primary Device */}
                <ThemedText style={[styles.fieldLabel, { marginTop: 16 }]}>WHICH DEVICE WERE YOU USING?</ThemedText>
                <View style={styles.chipRow}>
                  {DEVICES.map((dev) => {
                    const isSel = selectedDevice === dev;
                    return (
                      <TouchableOpacity
                        key={dev}
                        style={[styles.chipBtn, isSel && styles.chipBtnActive]}
                        onPress={() => {
                          triggerHaptic();
                          setSelectedDevice(dev);
                        }}
                      >
                        <ThemedText style={[styles.chipText, isSel && styles.chipTextActive]}>{dev}</ThemedText>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <TouchableOpacity
                  style={[styles.primaryBtn, { marginTop: 24 }]}
                  activeOpacity={0.88}
                  disabled={isSubmitting}
                  onPress={handleSubmitAutopsy}
                >
                  {isSubmitting ? (
                    <ActivityIndicator color="#030712" />
                  ) : (
                    <>
                      <ThemedText style={styles.primaryBtnText}>Create My Protection Rule</ThemedText>
                      <Ionicons name="shield-outline" size={16} color="#030712" />
                    </>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {/* ──────────────── STEP 4: PROTECTION RULE & COMMITMENT ──────────────── */}
            {step === 4 && (
              <View style={styles.stepContainer}>
                <View style={styles.badgeRow}>
                  <View style={[styles.stoicBadge, { borderColor: '#10B981', backgroundColor: 'rgba(16, 185, 129, 0.12)' }]}>
                    <Ionicons name="checkmark-done" size={13} color="#10B981" style={{ marginRight: 4 }} />
                    <ThemedText style={[styles.stoicBadgeText, { color: '#10B981' }]}>PROTECTION READY</ThemedText>
                  </View>
                </View>

                <ThemedText style={styles.heroHeadline}>Here is Your Protection Rule</ThemedText>
                <ThemedText style={styles.heroSubText}>
                  You don&apos;t need superhuman willpower. You just need this simple physical boundary to keep you safe.
                </ThemedText>

                {/* The Rule Card */}
                <View style={styles.ruleCard}>
                  <View style={styles.ruleHeaderRow}>
                    <Ionicons name="lock-closed" size={18} color="#00E5FF" />
                    <ThemedText style={styles.ruleCategoryLabel}>
                      YOUR NEW GOLDEN RULE
                    </ThemedText>
                  </View>
                  <ThemedText style={styles.ruleBodyText}>
                    {autopsyResult?.generated_golden_rule ||
                      `The ${selectedEnvironment} Boundary: Keep your ${selectedDevice} away from where you sleep and avoid using screens in bed.`}
                  </ThemedText>
                </View>

                {/* Directive Summary */}
                <View style={styles.summaryBox}>
                  <ThemedText style={styles.summaryLabel}>How to use this rule:</ThemedText>
                  <ThemedText style={styles.summaryDesc}>
                    {autopsyResult?.reframing_message ||
                      'Your protection boundary is set. Follow this simple rule starting today and get right back on track.'}
                  </ThemedText>
                </View>

                {/* Action Buttons */}
                <TouchableOpacity
                  style={styles.primaryBtn}
                  activeOpacity={0.88}
                  onPress={() => {
                    triggerHaptic();
                    router.push('/meditation' as any);
                  }}
                >
                  <ThemedText style={styles.primaryBtnText}>Take 5 Deep Breaths (Calm Down)</ThemedText>
                  <Ionicons name="flower-outline" size={16} color="#030712" />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.secondaryBtn}
                  activeOpacity={0.8}
                  onPress={() => {
                    triggerHaptic();
                    router.replace('/(tabs)/home' as any);
                  }}
                >
                  <ThemedText style={styles.secondaryBtnText}>Go Back to Home Screen</ThemedText>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </PageEntrance>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  safeArea: {
    flex: 1,
    backgroundColor: '#000000',
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  backBtn: {
    padding: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navCenter: {
    alignItems: 'center',
  },
  navTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: '#F8FAFC',
    letterSpacing: 1,
  },
  navSubTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: '#00E5FF',
    marginTop: 2,
    letterSpacing: 0.5,
  },
  progressTrack: {
    height: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    width: '100%',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#00E5FF',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  stepContainer: {
    gap: 14,
  },
  badgeRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  stoicBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.35)',
    backgroundColor: 'rgba(0, 229, 255, 0.08)',
  },
  stoicBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#00E5FF',
    letterSpacing: 0.8,
  },
  heroHeadline: {
    fontSize: 22,
    fontWeight: '900',
    color: '#F8FAFC',
    letterSpacing: -0.5,
    lineHeight: 28,
  },
  heroBody: {
    fontSize: 13.5,
    color: 'rgba(255, 255, 255, 0.65)',
    lineHeight: 20,
  },
  heroSubText: {
    fontSize: 12.5,
    color: 'rgba(255, 255, 255, 0.5)',
    lineHeight: 18,
  },
  groundingCard: {
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.25)',
    padding: 16,
    gap: 14,
    marginVertical: 10,
  },
  groundingHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  groundingTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: '#00E5FF',
    letterSpacing: 1,
  },
  stepList: {
    gap: 10,
  },
  stepItemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  stepNumberBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0, 229, 255, 0.15)',
    borderColor: 'rgba(0, 229, 255, 0.35)',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  stepNumberBadgeText: {
    fontSize: 10.5,
    fontWeight: '900',
    color: '#00E5FF',
  },
  stepItemText: {
    flex: 1,
    fontSize: 12.5,
    color: 'rgba(255, 255, 255, 0.7)',
    lineHeight: 18,
  },
  stepItemBold: {
    color: '#F8FAFC',
    fontWeight: '700',
  },
  streakContextBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderColor: 'rgba(245, 158, 11, 0.3)',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 12,
    marginTop: 4,
  },
  streakIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(245, 158, 11, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  streakContextTitle: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#F59E0B',
    letterSpacing: -0.2,
  },
  streakContextSubtitle: {
    fontSize: 11,
    color: 'rgba(245, 158, 11, 0.8)',
    marginTop: 2,
    lineHeight: 15,
  },
  dominoList: {
    gap: 10,
    marginVertical: 8,
  },
  dominoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 14,
    gap: 12,
  },
  dominoIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dominoTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#F8FAFC',
    letterSpacing: -0.2,
  },
  dominoSubtitle: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.45)',
    marginTop: 2,
    lineHeight: 15,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  fieldLabel: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.8,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 6,
  },
  chipBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  chipBtnActive: {
    backgroundColor: 'rgba(99, 102, 241, 0.25)',
    borderColor: '#6366F1',
  },
  chipText: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.65)',
  },
  chipTextActive: {
    color: '#ffffff',
  },
  ruleCard: {
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#00E5FF',
    padding: 18,
    gap: 10,
    marginVertical: 10,
  },
  ruleHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  ruleCategoryLabel: {
    fontSize: 10.5,
    fontWeight: '900',
    color: '#00E5FF',
    letterSpacing: 1,
  },
  ruleBodyText: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#F8FAFC',
    lineHeight: 22,
  },
  summaryBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    padding: 14,
    gap: 6,
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '700',
  },
  summaryDesc: {
    fontSize: 11.5,
    color: 'rgba(255, 255, 255, 0.55)',
    lineHeight: 16,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00E5FF',
    borderRadius: 14,
    paddingVertical: 14,
    gap: 8,
    marginTop: 10,
  },
  primaryBtnText: {
    fontSize: 13.5,
    fontWeight: '900',
    color: '#030712',
    letterSpacing: 0.3,
  },
  secondaryBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    paddingVertical: 13,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  secondaryBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#94A3B8',
  },
});
