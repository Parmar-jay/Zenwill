import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  View,
  Platform,
  Animated,
  Easing,
  TextInput,
  Modal,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { analyticsApi } from '@/services/analytics-api';
import { useHabitStore } from '@/store/habit-store';
import { useDailyMissionStore } from '@/store/daily-mission-store';


const triggerHaptic = (style = Haptics.ImpactFeedbackStyle.Light) => {
  try {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(style);
    }
  } catch (error) {
    // Silent catch
  }
};

const webNoOutline = Platform.OS === 'web'
  ? ({ outlineStyle: 'none', outlineWidth: 0, webkitTapHighlightColor: 'transparent' } as any)
  : {};

export default function EmergencyUrgeSurfingScreen() {
  const router = useRouter();
  const [secondsRemaining, setSecondsRemaining] = useState<number>(90);
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(true);

  // Feedback State
  const [showFeedbackModal, setShowFeedbackModal] = useState<boolean>(false);
  const [wasEffective, setWasEffective] = useState<boolean>(true);
  const [selectedInfluence, setSelectedInfluence] = useState<string>('Breathing Waves');
  const [selectedTrigger, setSelectedTrigger] = useState<string>('Stress');
  const [intensityBefore, setIntensityBefore] = useState<number>(7);
  const [intensityAfter, setIntensityAfter] = useState<number>(2);
  const [thoughtNote, setThoughtNote] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Pulsating Wave Ring Animations
  const wavePulseAnim = useRef(new Animated.Value(1)).current;
  const waveOpacityAnim = useRef(new Animated.Value(0.4)).current;

  const influenceOptions = [
    'Breathing Waves',
    'Visual Timer',
    'Self-Talk Affirmation',
    'Body Scan Grounding',
    'Willpower',
    'Distraction',
    'AI Coach',
  ];

  const triggerOptions = [
    'Stress',
    'Boredom',
    'Fatigue / Exhaustion',
    'Environment / Place',
    'Social Media',
    'Loneliness',
    'Emotional Spike',
    'Habitual Routine',
  ];

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isTimerRunning && secondsRemaining > 0) {
      interval = setInterval(() => {
        setSecondsRemaining((prev) => {
          if (prev <= 1) {
            setIsTimerRunning(false);
            triggerHaptic(Haptics.ImpactFeedbackStyle.Heavy);
            setShowFeedbackModal(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning, secondsRemaining]);

  useEffect(() => {
    if (isTimerRunning) {
      Animated.loop(
        Animated.parallel([
          Animated.sequence([
            Animated.timing(wavePulseAnim, {
              toValue: 1.25,
              duration: 2500,
              easing: Easing.bezier(0.4, 0, 0.2, 1),
              useNativeDriver: true,
            }),
            Animated.timing(wavePulseAnim, {
              toValue: 1.0,
              duration: 2500,
              easing: Easing.bezier(0.4, 0, 0.2, 1),
              useNativeDriver: true,
            }),
          ]),
          Animated.sequence([
            Animated.timing(waveOpacityAnim, {
              toValue: 0.8,
              duration: 2500,
              useNativeDriver: true,
            }),
            Animated.timing(waveOpacityAnim, {
              toValue: 0.3,
              duration: 2500,
              useNativeDriver: true,
            }),
          ]),
        ])
      ).start();
    } else {
      wavePulseAnim.setValue(1);
    }
  }, [isTimerRunning]);

  const waveProgress = Math.round(((90 - secondsRemaining) / 90) * 100);

  const handleCompleteAndSubmit = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    triggerHaptic(Haptics.ImpactFeedbackStyle.Heavy);

    // 1. Increment local urge counter immediately (+1)
    useHabitStore.getState().incrementUrgeCount();

    // 2. Persist feedback and session to backend pipeline
    try {
      await analyticsApi.completeEmergency({
        session_id: 'surge_' + Date.now(),
        techniques_used: ['Urge Surfing', selectedInfluence],
        outcome: 'resisted',
        was_effective: wasEffective,
        main_influence: selectedInfluence,
        trigger_reason: selectedTrigger,
        urge_intensity_before: intensityBefore,
        urge_intensity_after: intensityAfter,
        thought_note: thoughtNote || 'Completed 90-second Urge Surfing Wave',
        most_helpful_technique: selectedInfluence,
      });

      await analyticsApi.logEvent({
        event_type: 'urge_surfing_completed',
        trigger_context: selectedTrigger,
        outcome: 'resisted',
        intensity: intensityBefore,
        metadata: {
          was_effective: wasEffective,
          main_influence: selectedInfluence,
          intensity_after: intensityAfter,
          thought_note: thoughtNote,
        },
      });
    } catch (err) {
      console.warn('Urge surfing logging warning (offline):', err);
    }

    // 3. Mark rescue mission completed & sync database state
    useDailyMissionStore.getState().completeTask('rescue');
    useHabitStore.getState().syncFromDatabase().catch(() => {});

    setIsSubmitting(false);
    setShowFeedbackModal(false);
    router.navigate('/(tabs)/progress' as any);
  };


  return (
    <View style={styles.blackBg}>
      <Stack.Screen options={{ headerShown: false }} />

      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
        {/* Header Bar */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} activeOpacity={0.7} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={24} color="#00E5FF" />
          </TouchableOpacity>
          <View style={{ alignItems: 'center' }}>
            <ThemedText style={styles.stepIndicator}>DE-ESCALATION PROTOCOL 3</ThemedText>
            <ThemedText style={styles.headerTitle}>Urge Surfing</ThemedText>
          </View>
          <View style={{ width: 38 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <ThemedText style={styles.title}>Ride the 90-Second Wave</ThemedText>
          <ThemedText style={styles.sub}>
            An urge is not a command. It is a wave of neuro-electrical activity. Observe it without resistance or judgment until it recedes.
          </ThemedText>

          {/* Animated Wave Timer Hero Box */}
          <View style={styles.waveHeroBox}>
            <View style={styles.ringContainer}>
              <Animated.View
                style={[
                  styles.pulseRing,
                  {
                    transform: [{ scale: wavePulseAnim }],
                    opacity: waveOpacityAnim,
                  },
                ]}
              />
              <View style={styles.timerCircle}>
                <ThemedText style={styles.timerNum}>{secondsRemaining}s</ThemedText>
                <ThemedText style={styles.timerSub}>
                  {secondsRemaining === 0
                    ? 'Wave Receded'
                    : secondsRemaining > 45
                    ? 'Wave Rising'
                    : secondsRemaining > 15
                    ? 'Peak Passing'
                    : 'Wave Receding'}
                </ThemedText>
              </View>
            </View>

            {/* Wave Progress Bar */}
            <View style={styles.waveTrack}>
              <View style={[styles.waveFill, { width: `${waveProgress}%` }]} />
            </View>
            <ThemedText style={styles.progressText}>{waveProgress}% Wave De-escalation Complete</ThemedText>
          </View>

          {/* Mindful Stance Tips */}
          <View style={styles.tipsSection}>
            <ThemedText style={styles.sectionTitle}>Mindful Stance Anchors</ThemedText>

            <View style={styles.tipCard}>
              <Ionicons name="water-outline" size={20} color="#8B5CF6" />
              <View style={{ flex: 1 }}>
                <ThemedText style={styles.tipTitle}>Observe Physical Sensations</ThemedText>
                <ThemedText style={styles.tipDesc}>Notice tightness in chest or belly without trying to force or change it.</ThemedText>
              </View>
            </View>

            <View style={styles.tipCard}>
              <Ionicons name="sparkles-outline" size={20} color="#00E5FF" />
              <View style={{ flex: 1 }}>
                <ThemedText style={styles.tipTitle}>Separate Self from Craving</ThemedText>
                <ThemedText style={styles.tipDesc}>Repeat: "I am experiencing an urge wave, but I am not the urge."</ThemedText>
              </View>
            </View>
          </View>
        </ScrollView>

        {/* Bottom Navigation */}
        <View style={styles.bottomDock}>
          <TouchableOpacity
            style={styles.nextBtn}
            activeOpacity={0.7}
            onPress={() => {
              triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
              setShowFeedbackModal(true);
            }}
          >
            <ThemedText style={styles.nextBtnText}>
              {secondsRemaining === 0 ? 'Log Urge Surfing Feedback (+1)' : 'Complete & Log Feedback'}
            </ThemedText>
            <Ionicons name="checkmark-done" size={18} color="#000000" />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* Interactive Feedback & Data Options Modal */}
      <Modal
        visible={showFeedbackModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowFeedbackModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.sheetHandle} />

            <View style={styles.sheetHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="sparkles" size={18} color="#00E5FF" />
                <ThemedText style={styles.sheetHeaderTitle}>Urge Surfing Feedback</ThemedText>
              </View>
              <TouchableOpacity onPress={() => setShowFeedbackModal(false)}>
                <Ionicons name="close" size={20} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetScroll}>
              {/* Question 1: Effectiveness */}
              <View style={styles.questionBox}>
                <ThemedText style={styles.questionLabel}>Was urge surfing effective for you?</ThemedText>
                <View style={styles.chipRow}>
                  <TouchableOpacity
                    style={[styles.chip, wasEffective === true && styles.chipActiveCyan]}
                    onPress={() => {
                      triggerHaptic();
                      setWasEffective(true);
                    }}
                  >
                    <Ionicons name="checkmark-circle" size={15} color={wasEffective === true ? '#000000' : '#10B981'} />
                    <ThemedText style={[styles.chipText, wasEffective === true && styles.chipTextDark]}>
                      Yes, Effective
                    </ThemedText>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.chip, wasEffective === false && styles.chipActiveRed]}
                    onPress={() => {
                      triggerHaptic();
                      setWasEffective(false);
                    }}
                  >
                    <Ionicons name="close-circle" size={15} color={wasEffective === false ? '#FFFFFF' : '#EF4444'} />
                    <ThemedText style={[styles.chipText, wasEffective === false && styles.chipTextWhite]}>
                      Not Effective
                    </ThemedText>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Question 2: What Influenced User Most */}
              <View style={styles.questionBox}>
                <ThemedText style={styles.questionLabel}>What influenced you the most?</ThemedText>
                <View style={styles.chipWrap}>
                  {influenceOptions.map((item) => (
                    <TouchableOpacity
                      key={item}
                      style={[styles.chip, selectedInfluence === item && styles.chipActivePurple]}
                      onPress={() => {
                        triggerHaptic();
                        setSelectedInfluence(item);
                      }}
                    >
                      <ThemedText style={[styles.chipText, selectedInfluence === item && styles.chipTextWhite]}>
                        {item}
                      </ThemedText>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Question 3: Trigger Reason */}
              <View style={styles.questionBox}>
                <ThemedText style={styles.questionLabel}>What was the trigger reason?</ThemedText>
                <View style={styles.chipWrap}>
                  {triggerOptions.map((item) => (
                    <TouchableOpacity
                      key={item}
                      style={[styles.chip, selectedTrigger === item && styles.chipActiveCyanBorder]}
                      onPress={() => {
                        triggerHaptic();
                        setSelectedTrigger(item);
                      }}
                    >
                      <ThemedText style={[styles.chipText, selectedTrigger === item && styles.chipTextCyan]}>
                        {item}
                      </ThemedText>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Intensity Ratings (Before vs After) */}
              <View style={styles.questionBox}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <ThemedText style={styles.questionLabel}>Urge Intensity (Before vs After)</ThemedText>
                  <ThemedText style={{ fontSize: 11, color: '#00E5FF', fontWeight: '800' }}>
                    {intensityBefore}/10 ➔ {intensityAfter}/10
                  </ThemedText>
                </View>

                <View style={{ gap: 6 }}>
                  <ThemedText style={styles.sliderSub}>Intensity Before Wave:</ThemedText>
                  <View style={styles.numGrid}>
                    {[1, 3, 5, 7, 9, 10].map((num) => (
                      <TouchableOpacity
                        key={`b-${num}`}
                        style={[styles.numBtn, intensityBefore === num && styles.numBtnActiveBefore]}
                        onPress={() => {
                          triggerHaptic();
                          setIntensityBefore(num);
                        }}
                      >
                        <ThemedText style={[styles.numText, intensityBefore === num && styles.chipTextWhite]}>
                          {num}
                        </ThemedText>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <ThemedText style={styles.sliderSub}>Intensity After Wave:</ThemedText>
                  <View style={styles.numGrid}>
                    {[0, 1, 2, 4, 6, 8].map((num) => (
                      <TouchableOpacity
                        key={`a-${num}`}
                        style={[styles.numBtn, intensityAfter === num && styles.numBtnActiveAfter]}
                        onPress={() => {
                          triggerHaptic();
                          setIntensityAfter(num);
                        }}
                      >
                        <ThemedText style={[styles.numText, intensityAfter === num && styles.chipTextDark]}>
                          {num}
                        </ThemedText>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>

              {/* Thought Note Input */}
              <View style={styles.questionBox}>
                <ThemedText style={styles.questionLabel}>Thought Data / Reflection Note</ThemedText>
                <TextInput
                  style={styles.thoughtInput}
                  placeholder="What was driving this thought? (e.g. 'Felt sudden urge after long work session...')"
                  placeholderTextColor="rgba(255, 255, 255, 0.4)"
                  multiline
                  numberOfLines={3}
                  value={thoughtNote}
                  onChangeText={setThoughtNote}
                />
              </View>

              <TouchableOpacity
                style={[styles.submitBtn, isSubmitting && { opacity: 0.6 }]}
                activeOpacity={0.85}
                disabled={isSubmitting}
                onPress={handleCompleteAndSubmit}
              >
                <ThemedText style={styles.submitBtnText}>
                  {isSubmitting ? 'Logging...' : 'Log Urge Beat (+1 Count)'}
                </ThemedText>
                <Ionicons name="arrow-forward" size={18} color="#000000" />
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  blackBg: { flex: 1, backgroundColor: '#000000' },
  safeArea: { flex: 1, backgroundColor: '#000000' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 229, 255, 0.15)',
    backgroundColor: '#000000',
  },
  backBtn: {
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 4,
    ...webNoOutline,
  },
  stepIndicator: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#8B5CF6',
    letterSpacing: 1.2,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#ffffff',
  },
  scrollContent: {
    padding: 16,
    gap: 14,
    alignItems: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#ffffff',
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  sub: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 340,
  },
  waveHeroBox: {
    width: '100%',
    backgroundColor: 'rgba(18, 18, 18, 0.95)',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.35)',
    padding: 20,
    alignItems: 'center',
    gap: 14,
    marginTop: 4,
  },
  ringContainer: {
    width: 150,
    height: 150,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseRing: {
    position: 'absolute',
    width: 145,
    height: 145,
    borderRadius: 72.5,
    backgroundColor: 'rgba(139, 92, 246, 0.25)',
    borderWidth: 1.5,
    borderColor: '#8B5CF6',
  },
  timerCircle: {
    width: 125,
    height: 125,
    borderRadius: 62.5,
    backgroundColor: 'rgba(139, 92, 246, 0.16)',
    borderWidth: 2,
    borderColor: '#8B5CF6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  timerNum: {
    fontSize: 32,
    fontWeight: '800',
    color: '#00E5FF',
  },
  timerSub: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#8B5CF6',
    textTransform: 'uppercase',
    marginTop: 2,
  },
  waveTrack: {
    width: '100%',
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
  },
  waveFill: {
    height: '100%',
    backgroundColor: '#8B5CF6',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#94A3B8',
  },
  tipsSection: {
    width: '100%',
    gap: 10,
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
  tipCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: 'rgba(18, 18, 18, 0.95)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.15)',
    padding: 14,
    ...webNoOutline,
  },
  tipTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },
  tipDesc: {
    fontSize: 11.5,
    color: '#94A3B8',
    lineHeight: 16,
    marginTop: 2,
  },
  bottomDock: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#000000',
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 229, 255, 0.15)',
  },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#00E5FF',
    paddingVertical: 14,
    borderRadius: 14,
    ...webNoOutline,
  },
  nextBtnText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '800',
  },

  /* Feedback Modal Sheet */
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#000000',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.25)',
    maxHeight: '90%',
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 24,
  },
  sheetHandle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignSelf: 'center',
    marginBottom: 10,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  sheetHeaderTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  sheetScroll: {
    paddingVertical: 14,
    gap: 16,
  },
  questionBox: {
    gap: 8,
  },
  questionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#E2E8F0',
  },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    ...webNoOutline,
  },
  chipActiveCyan: {
    backgroundColor: '#00E5FF',
    borderColor: '#00E5FF',
  },
  chipActiveRed: {
    backgroundColor: '#EF4444',
    borderColor: '#EF4444',
  },
  chipActivePurple: {
    backgroundColor: '#8B5CF6',
    borderColor: '#8B5CF6',
  },
  chipActiveCyanBorder: {
    backgroundColor: 'rgba(0, 229, 255, 0.12)',
    borderColor: '#00E5FF',
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
  },
  chipTextDark: {
    color: '#000000',
    fontWeight: '800',
  },
  chipTextWhite: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  chipTextCyan: {
    color: '#00E5FF',
    fontWeight: '700',
  },
  sliderSub: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  numGrid: {
    flexDirection: 'row',
    gap: 6,
  },
  numBtn: {
    flex: 1,
    height: 34,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  numBtnActiveBefore: {
    backgroundColor: '#EF4444',
    borderColor: '#EF4444',
  },
  numBtnActiveAfter: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  numText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
  },
  thoughtInput: {
    backgroundColor: '#0D0D12',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    padding: 12,
    color: '#FFFFFF',
    fontSize: 12.5,
    minHeight: 70,
    textAlignVertical: 'top',
  },
  submitBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#00E5FF',
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 6,
    ...webNoOutline,
  },
  submitBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#000000',
  },
});
