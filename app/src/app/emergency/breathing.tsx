import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  View,
  Platform,
  Animated,
  Easing,
  Modal,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { EMERGENCY_SOS_SEQUENCE } from '@/constants/practices';
import { useDailyMissionStore } from '@/store/daily-mission-store';
import { useHabitStore } from '@/store/habit-store';
import { analyticsApi } from '@/services/analytics-api';
import { omSoundManager } from '@/utils/audio-player';
import { BreathingParticles } from '@/components/BreathingParticles';


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

export default function EmergencyBreathingScreen() {
  const router = useRouter();

  const handleGoBack = () => {
    triggerHaptic();
    omSoundManager.stopAndUnload();
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/emergency' as any);
    }
  };

  // SOS Sequence State (Phases 0 to 3)
  const [sosPhaseIndex, setSosPhaseIndex] = useState<number>(0);
  const [sosSecondsLeft, setSosSecondsLeft] = useState<number>(
    EMERGENCY_SOS_SEQUENCE.phases[0].durationSec
  );
  const [isSosRunning, setIsSosRunning] = useState<boolean>(true);

  // Breathing Stage Text State ('Inhale' | 'Hold' | 'Exhale' | 'Paused')
  const [breathStage, setBreathStage] = useState<'Inhale' | 'Hold' | 'Exhale' | 'Paused'>('Inhale');

  // Effectiveness Review Modal State
  const [isFeedbackModalVisible, setIsFeedbackModalVisible] = useState<boolean>(false);
  const [selectedTrigger, setSelectedTrigger] = useState<string>('Screen / Late Night Phone');
  const [effectivenessRating, setEffectivenessRating] = useState<number>(5);
  const [urgeOutcome, setUrgeOutcome] = useState<'vanished' | 'weakened' | 'holding_strong'>('vanished');
  const [userNote, setUserNote] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Animation values
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const pulseOpacity = useRef(new Animated.Value(0.4)).current;

  const currentSosPhase = EMERGENCY_SOS_SEQUENCE.phases[sosPhaseIndex] || EMERGENCY_SOS_SEQUENCE.phases[0];
  const themeColor = currentSosPhase.color || '#10B981';

  // 396 Hz Emergency Audio Trigger
  useEffect(() => {
    const tune = omSoundManager.getTuneForTechnique('emergency-sos');
    omSoundManager.setTune(tune).then(() => {
      if (isSosRunning) {
        omSoundManager.play();
      }
    });

    return () => {
      omSoundManager.stopAndUnload();
    };
  }, []);

  useEffect(() => {
    if (isSosRunning) {
      omSoundManager.play();
    } else {
      omSoundManager.pause();
    }
  }, [isSosRunning]);

  // Open Feedback Form and Stop Audio Immediately
  const handleOpenFeedback = () => {
    setIsSosRunning(false);
    omSoundManager.stopAndUnload();
    triggerHaptic(Haptics.ImpactFeedbackStyle.Heavy);
    setIsFeedbackModalVisible(true);
  };

  // Complete Rescue Task and Log Feedback to Database
  const handleCompleteRescue = async () => {
    setIsSubmitting(true);
    triggerHaptic(Haptics.ImpactFeedbackStyle.Heavy);
    omSoundManager.stopAndUnload();

    // 1. Complete Daily Mission Task
    useDailyMissionStore.getState().completeTask('rescue');

    // 2. Fire backend logging in background
    try {
      await Promise.all([
        analyticsApi.completeEmergency({
          session_id: 'sos_' + Date.now(),
          techniques_used: ['396Hz Box Breathing', 'Pranayama De-escalation'],
          outcome: 'resisted',
          trigger_reason: selectedTrigger,
          most_helpful_technique: '396Hz Box Breathing',
          user_feedback: userNote || `Effectiveness: ${effectivenessRating}/5 stars. Outcome: ${urgeOutcome}.`,
          was_effective: effectivenessRating >= 3,
        }),
        analyticsApi.logEvent({
          event_type: 'emergency_exercise',
          screen_name: 'emergency_breathing',
          feature_name: 'box_breathing',
          duration_seconds: 180,
          outcome: urgeOutcome === 'vanished' ? 'resisted' : 'managed',
          emotional_state: 'grounded',
          metadata: {
            trigger: selectedTrigger,
            rating: effectivenessRating,
            outcome: urgeOutcome,
            user_note: userNote,
          },
        }),
      ]);
      useHabitStore.getState().syncFromDatabase().catch(() => {});
    } catch (_) {}

    setIsSubmitting(false);
    setIsFeedbackModalVisible(false);
    router.replace('/(tabs)/home' as any);
  };

  // SOS Timer Loop
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isSosRunning) {
      interval = setInterval(() => {
        setSosSecondsLeft((prev) => {
          if (prev <= 1) {
            if (sosPhaseIndex < EMERGENCY_SOS_SEQUENCE.phases.length - 1) {
              const nextIdx = sosPhaseIndex + 1;
              setSosPhaseIndex(nextIdx);
              triggerHaptic(Haptics.ImpactFeedbackStyle.Heavy);
              return EMERGENCY_SOS_SEQUENCE.phases[nextIdx].durationSec;
            } else {
              // On 5-min breathing completion, seamlessly advance to Step 2: Urge Surfing
              setIsSosRunning(false);
              triggerHaptic(Haptics.ImpactFeedbackStyle.Heavy);
              router.push('/emergency/urge-surfing' as any);
              return 0;
            }
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isSosRunning, sosPhaseIndex]);

  // Synchronized Breathing Animation & Phase Text Loop (4s Inhale, 2s Hold, 4s Exhale, 2s Hold)
  useEffect(() => {
    let animationLoop: Animated.CompositeAnimation;
    let t1: ReturnType<typeof setTimeout>;
    let t2: ReturnType<typeof setTimeout>;
    let t3: ReturnType<typeof setTimeout>;
    let stageInterval: ReturnType<typeof setInterval>;

    const startStageCycle = () => {
      setBreathStage('Inhale');
      t1 = setTimeout(() => setBreathStage('Hold'), 4000);
      t2 = setTimeout(() => setBreathStage('Exhale'), 6000);
      t3 = setTimeout(() => setBreathStage('Hold'), 10000);
    };

    if (isSosRunning) {
      startStageCycle();
      stageInterval = setInterval(startStageCycle, 12000);

      animationLoop = Animated.loop(
        Animated.sequence([
          // Inhale: 4 seconds expansion
          Animated.parallel([
            Animated.timing(scaleAnim, {
              toValue: 1.35,
              duration: 4000,
              easing: Easing.bezier(0.4, 0, 0.2, 1),
              useNativeDriver: true,
            }),
            Animated.timing(pulseOpacity, {
              toValue: 0.95,
              duration: 4000,
              useNativeDriver: true,
            }),
          ]),
          // Hold: 2 seconds steady
          Animated.delay(2000),
          // Exhale: 4 seconds contraction
          Animated.parallel([
            Animated.timing(scaleAnim, {
              toValue: 1.0,
              duration: 4000,
              easing: Easing.bezier(0.4, 0, 0.2, 1),
              useNativeDriver: true,
            }),
            Animated.timing(pulseOpacity, {
              toValue: 0.35,
              duration: 4000,
              useNativeDriver: true,
            }),
          ]),
          // Hold: 2 seconds steady
          Animated.delay(2000),
        ])
      );
      animationLoop.start();
    } else {
      scaleAnim.setValue(1);
      pulseOpacity.setValue(0.5);
      setBreathStage('Paused');
    }

    return () => {
      if (animationLoop) animationLoop.stop();
      clearInterval(stageInterval);
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [isSosRunning, sosPhaseIndex]);

  const switchPhase = (newIndex: number) => {
    if (newIndex >= 0 && newIndex < EMERGENCY_SOS_SEQUENCE.phases.length) {
      triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
      setSosPhaseIndex(newIndex);
      setSosSecondsLeft(EMERGENCY_SOS_SEQUENCE.phases[newIndex].durationSec);
      setIsSosRunning(true);
    }
  };

  const togglePlayPause = () => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
    setIsSosRunning((prev) => !prev);
  };

  const resetCurrentPhase = () => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
    setSosSecondsLeft(currentSosPhase.durationSec);
    setIsSosRunning(true);
  };

  const formatTime = (totalSecs: number) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Dynamic Ambient Background Gradient Tinted by Active Phase */}
      <LinearGradient
        colors={[`${themeColor}25`, '#000000', '#000000']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 0.85 }}
      />

      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
        {/* Header Bar */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backBtn}
            activeOpacity={0.7}
            onPress={handleGoBack}
          >
            <Ionicons name="chevron-back" size={24} color="#00E5FF" />
          </TouchableOpacity>

          <View style={{ alignItems: 'center' }}>
            <View style={styles.badgeRow}>
              <View style={[styles.sosPulseDot, { backgroundColor: themeColor }]} />
              <ThemedText style={styles.stepIndicator}>STEP 1 OF 4 • 5-MIN MIND SHIELD</ThemedText>
            </View>
            <ThemedText style={styles.headerTitle}>Mind Shield Breathing</ThemedText>
          </View>

          <TouchableOpacity
            style={styles.headerResetBtn}
            activeOpacity={0.7}
            onPress={resetCurrentPhase}
          >
            <Ionicons name="refresh-outline" size={20} color="#94A3B8" />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Phase Progress Steps */}
          <View style={styles.phaseProgressRow}>
            {EMERGENCY_SOS_SEQUENCE.phases.map((phase, idx) => {
              const isActive = idx === sosPhaseIndex;
              const isPassed = idx < sosPhaseIndex;
              const pColor = phase.color || '#10B981';

              return (
                <TouchableOpacity
                  key={phase.stepNumber}
                  style={[
                    styles.phasePill,
                    isActive && { borderColor: pColor, backgroundColor: `${pColor}25` },
                    isPassed && { borderColor: `${pColor}60`, backgroundColor: `${pColor}12` },
                  ]}
                  activeOpacity={0.8}
                  onPress={() => switchPhase(idx)}
                >
                  <View
                    style={[
                      styles.phaseDot,
                      { backgroundColor: isPassed || isActive ? pColor : 'rgba(255, 255, 255, 0.2)' },
                    ]}
                  >
                    {isPassed ? (
                      <Ionicons name="checkmark" size={10} color="#000000" />
                    ) : (
                      <ThemedText
                        style={[
                          styles.phaseDotNum,
                          isActive && { color: '#000000', fontWeight: '900' },
                        ]}
                      >
                        {phase.stepNumber}
                      </ThemedText>
                    )}
                  </View>
                  <ThemedText
                    style={[
                      styles.phasePillText,
                      isActive && { color: '#FFFFFF', fontWeight: '800' },
                      isPassed && { color: '#94A3B8' },
                    ]}
                    numberOfLines={1}
                  >
                    {phase.sanskrit.split(' ')[0]}
                  </ThemedText>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Main Hero Breathing Card */}
          <View style={[styles.heroCard, { borderColor: `${themeColor}50` }]}>
            {/* Card Header: Phase Title & Timer */}
            <View style={styles.heroTopRow}>
              <View style={[styles.phaseBadge, { backgroundColor: `${themeColor}20`, borderColor: `${themeColor}50` }]}>
                <ThemedText style={[styles.phaseBadgeText, { color: themeColor }]}>
                  Phase {sosPhaseIndex + 1} of 4 • {currentSosPhase.sanskrit}
                </ThemedText>
              </View>

              <View style={styles.timerBadge}>
                <Ionicons name="time-outline" size={14} color={themeColor} />
                <ThemedText style={[styles.timerText, { color: themeColor }]}>
                  {formatTime(sosSecondsLeft)}
                </ThemedText>
              </View>
            </View>

            {/* Native Particle Breathing Visualization */}
            <View style={styles.animationContainer}>
              <BreathingParticles
                phase={breathStage}
                color={themeColor}
                isRunning={isSosRunning}
                size={260}
              />
            </View>

            {/* Playback Controls Row */}
            <View style={styles.controlsRow}>
              <TouchableOpacity
                style={styles.navControlBtn}
                activeOpacity={0.7}
                disabled={sosPhaseIndex === 0}
                onPress={() => switchPhase(sosPhaseIndex - 1)}
              >
                <Ionicons
                  name="play-skip-back"
                  size={18}
                  color={sosPhaseIndex === 0 ? '#334155' : '#94A3B8'}
                />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.playPauseBtn, { backgroundColor: themeColor }]}
                activeOpacity={0.8}
                onPress={togglePlayPause}
              >
                <Ionicons
                  name={isSosRunning ? 'pause' : 'play'}
                  size={24}
                  color="#000000"
                />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.navControlBtn}
                activeOpacity={0.7}
                disabled={sosPhaseIndex === EMERGENCY_SOS_SEQUENCE.phases.length - 1}
                onPress={() => switchPhase(sosPhaseIndex + 1)}
              >
                <Ionicons
                  name="play-skip-forward"
                  size={18}
                  color={
                    sosPhaseIndex === EMERGENCY_SOS_SEQUENCE.phases.length - 1
                      ? '#334155'
                      : '#94A3B8'
                  }
                />
              </TouchableOpacity>
            </View>

            {/* Step Description */}
            <View style={styles.descriptionBox}>
              <ThemedText style={styles.stepTitleText}>{currentSosPhase.title}</ThemedText>
              <ThemedText style={styles.instructionText}>{currentSosPhase.description}</ThemedText>
            </View>
          </View>
        </ScrollView>

        {/* Bottom Navigation Dock */}
        <View style={styles.bottomDock}>
          <TouchableOpacity
            style={[styles.nextBtn, { backgroundColor: themeColor }]}
            activeOpacity={0.85}
            onPress={() => {
              triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
              router.push('/emergency/urge-surfing' as any);
            }}
          >
            <ThemedText style={styles.nextBtnText}>Next: 90s Urge Surfing</ThemedText>
            <Ionicons name="arrow-forward" size={17} color="#000000" />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.finishRescueBtn, { borderColor: `${themeColor}50` }]}
            activeOpacity={0.8}
            onPress={() => {
              triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
              router.push('/emergency/reflection' as any);
            }}
          >
            <Ionicons name="checkmark-circle-outline" size={16} color={themeColor} />
            <ThemedText style={[styles.finishRescueText, { color: themeColor }]}>Skip to Victory Feedback</ThemedText>
          </TouchableOpacity>
        </View>

        {/* Effectiveness & Trigger Review Modal */}
        <Modal
          visible={isFeedbackModalVisible}
          transparent
          animationType="slide"
          onRequestClose={() => {
            if (!isSubmitting) setIsFeedbackModalVisible(false);
          }}
        >
          <View style={styles.feedbackModalBackdrop}>
            <View style={styles.feedbackModalCard}>
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 16 }}>
                {/* Modal Header */}
                <View style={styles.feedbackHeaderRow}>
                  <View style={styles.feedbackIconBadge}>
                    <Ionicons name="shield-checkmark" size={20} color="#10B981" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <ThemedText style={styles.feedbackTitle}>Rescue Effectiveness</ThemedText>
                    <ThemedText style={styles.feedbackSub}>Help us learn what triggers your cravings</ThemedText>
                  </View>
                  <TouchableOpacity
                    style={styles.feedbackCloseBtn}
                    onPress={() => setIsFeedbackModalVisible(false)}
                  >
                    <Ionicons name="close" size={18} color="#94A3B8" />
                  </TouchableOpacity>
                </View>

                {/* Section 1: What triggered this urge? */}
                <View style={styles.feedbackSection}>
                  <ThemedText style={styles.feedbackSectionLabel}>1. WHAT TRIGGERED THIS URGE?</ThemedText>
                  <View style={styles.triggerChipsWrap}>
                    {[
                      '📱 Screen / Late Night Phone',
                      '💼 Work / Study Stress',
                      '🥱 Boredom & Idleness',
                      '🌪️ Loneliness & Isolation',
                      '😡 Anger & Frustration',
                      '💬 Social Media Temptation',
                      '❓ Sudden / Spontaneous Craving',
                    ].map((trigger) => {
                      const isSelected = selectedTrigger === trigger;
                      return (
                        <TouchableOpacity
                          key={trigger}
                          style={[
                            styles.triggerChip,
                            isSelected && styles.triggerChipActive,
                          ]}
                          activeOpacity={0.8}
                          onPress={() => {
                            triggerHaptic();
                            setSelectedTrigger(trigger);
                          }}
                        >
                          <ThemedText
                            style={[
                              styles.triggerChipText,
                              isSelected && styles.triggerChipTextActive,
                            ]}
                          >
                            {trigger}
                          </ThemedText>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {/* Section 2: How helpful was this session? */}
                <View style={styles.feedbackSection}>
                  <ThemedText style={styles.feedbackSectionLabel}>2. HOW HELPFUL WAS THIS 396Hz RESCUE?</ThemedText>
                  <View style={styles.ratingRow}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <TouchableOpacity
                        key={star}
                        style={[
                          styles.ratingStarBtn,
                          effectivenessRating >= star && styles.ratingStarBtnActive,
                        ]}
                        activeOpacity={0.8}
                        onPress={() => {
                          triggerHaptic();
                          setEffectivenessRating(star);
                        }}
                      >
                        <Ionicons
                          name={effectivenessRating >= star ? 'star' : 'star-outline'}
                          size={22}
                          color={effectivenessRating >= star ? '#F59E0B' : 'rgba(255, 255, 255, 0.3)'}
                        />
                        <ThemedText style={styles.starNumText}>{star}</ThemedText>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <ThemedText style={styles.ratingLabelText}>
                    {effectivenessRating === 5 && '🌟 Extremely Effective • Urge Completely Dissolved'}
                    {effectivenessRating === 4 && '✨ Strong Relief • Mind Fully Stabilized'}
                    {effectivenessRating === 3 && '👍 Good Calm • Feeling in Control'}
                    {effectivenessRating === 2 && '⏳ Calmed Down • Still Processing'}
                    {effectivenessRating === 1 && '🛡️ Slight Relief • Need Extra Grounding'}
                  </ThemedText>
                </View>

                {/* Section 3: Current Urge State */}
                <View style={styles.feedbackSection}>
                  <ThemedText style={styles.feedbackSectionLabel}>3. CURRENT URGE INTENSITY</ThemedText>
                  <View style={{ gap: 8 }}>
                    {[
                      { id: 'vanished', label: '✅ Urge Vanished (0-2/10)', sub: 'Fully grounded and clear' },
                      { id: 'weakened', label: '⚡ Significantly Weakened (3-4/10)', sub: 'Craving spike de-escalated' },
                      { id: 'holding_strong', label: '🛡️ Managed & Holding Strong', sub: 'In control of my actions' },
                    ].map((opt) => {
                      const isSelected = urgeOutcome === opt.id;
                      return (
                        <TouchableOpacity
                          key={opt.id}
                          style={[
                            styles.outcomeOptionCard,
                            isSelected && styles.outcomeOptionCardActive,
                          ]}
                          activeOpacity={0.85}
                          onPress={() => {
                            triggerHaptic();
                            setUrgeOutcome(opt.id as any);
                          }}
                        >
                          <View style={{ flex: 1 }}>
                            <ThemedText style={[styles.outcomeOptionTitle, isSelected && styles.outcomeOptionTitleActive]}>
                              {opt.label}
                            </ThemedText>
                            <ThemedText style={styles.outcomeOptionSub}>{opt.sub}</ThemedText>
                          </View>
                          {isSelected && (
                            <Ionicons name="checkmark-circle" size={18} color="#10B981" />
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {/* Section 4: Optional Reflection Note */}
                <View style={styles.feedbackSection}>
                  <ThemedText style={styles.feedbackSectionLabel}>4. PERSONAL NOTE (OPTIONAL)</ThemedText>
                  <TextInput
                    style={styles.noteInput}
                    placeholder="What thought or cue helped you regain self-control?"
                    placeholderTextColor="rgba(255, 255, 255, 0.3)"
                    multiline
                    value={userNote}
                    onChangeText={setUserNote}
                  />
                </View>

                {/* Submit & Complete CTA */}
                <TouchableOpacity
                  style={[styles.submitRescueBtn, isSubmitting && { opacity: 0.7 }]}
                  activeOpacity={0.88}
                  disabled={isSubmitting}
                  onPress={handleCompleteRescue}
                >
                  {isSubmitting ? (
                    <ActivityIndicator color="#000000" size="small" />
                  ) : (
                    <>
                      <Ionicons name="shield-checkmark" size={18} color="#000000" />
                      <ThemedText style={styles.submitRescueBtnText}>Complete Rescue & Log Victory 🛡️</ThemedText>
                    </>
                  )}
                </TouchableOpacity>

                <View style={styles.rewardNoticeBox}>
                  <Ionicons name="flame" size={14} color="#F59E0B" />
                  <ThemedText style={styles.rewardNoticeText}>+50 Discipline XP • Daily Rescue Mission Completed</ThemedText>
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>

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
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  backBtn: {
    backgroundColor: 'transparent',
    padding: 4,
    justifyContent: 'center',
    alignItems: 'center',
    ...webNoOutline,
  },
  headerResetBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    ...webNoOutline,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sosPulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  stepIndicator: {
    fontSize: 10,
    fontWeight: '800',
    color: '#EF4444',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  scrollContent: {
    padding: 16,
    gap: 16,
  },

  // Phase Progress Steps Bar
  phaseProgressRow: {
    flexDirection: 'row',
    gap: 6,
  },
  phasePill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 7,
    paddingHorizontal: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    ...webNoOutline,
  },
  phaseDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  phaseDotNum: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#94A3B8',
    textAlign: 'center',
    includeFontPadding: false,
    lineHeight: Platform.OS === 'ios' ? 12 : 13,
  },
  phasePillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },

  // Hero Breathing Card
  heroCard: {
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    borderRadius: 24,
    borderWidth: 1.5,
    padding: 20,
    gap: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    ...webNoOutline,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  phaseBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  phaseBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  timerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  timerText: {
    fontSize: 15,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },

  // Animation Visual
  animationContainer: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 4,
  },

  // Controls Row
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    marginTop: 8,
    marginBottom: 4,
    width: '100%',
  },
  navControlBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    ...webNoOutline,
  },
  playPauseBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    ...webNoOutline,
  },

  // Description Box
  descriptionBox: {
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 14,
    padding: 14,
    gap: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  stepTitleText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  instructionText: {
    fontSize: 13,
    color: '#CBD5E1',
    textAlign: 'center',
    lineHeight: 19,
  },

  // Mantra Card
  mantraCard: {
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.2)',
    padding: 16,
    gap: 12,
  },
  mantraHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  mantraIconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(0, 229, 255, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mantraSectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  mantraSectionSub: {
    fontSize: 11,
    color: '#00E5FF',
    fontWeight: '700',
  },
  mantraDisplayCard: {
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.15)',
  },
  mantraText: {
    fontSize: 13,
    color: '#F8FAFC',
    lineHeight: 20,
    fontStyle: 'italic',
    textAlign: 'center',
    fontWeight: '600',
  },
  mantraHint: {
    fontSize: 11.5,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 16,
  },

  // Bottom Dock
  bottomDock: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#060913',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    gap: 10,
  },
  finishRescueBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    ...webNoOutline,
  },
  finishRescueText: {
    fontSize: 13,
    fontWeight: '800',
  },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    ...webNoOutline,
  },
  nextBtnText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '900',
  },

  // Feedback & Effectiveness Modal Styles
  feedbackModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'flex-end',
  },
  feedbackModalCard: {
    backgroundColor: '#0F172A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    maxHeight: '88%',
  },
  feedbackHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 4,
  },
  feedbackIconBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  feedbackTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  feedbackSub: {
    fontSize: 11.5,
    color: 'rgba(255, 255, 255, 0.55)',
  },
  feedbackCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  feedbackSection: {
    gap: 8,
  },
  feedbackSectionLabel: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.8,
  },
  triggerChipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  triggerChip: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  triggerChipActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: '#10B981',
  },
  triggerChipText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.7)',
  },
  triggerChipTextActive: {
    color: '#10B981',
  },
  ratingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  ratingStarBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    gap: 2,
  },
  ratingStarBtnActive: {
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderColor: '#F59E0B',
  },
  starNumText: {
    fontSize: 10,
    fontWeight: '800',
    color: 'rgba(255, 255, 255, 0.5)',
  },
  ratingLabelText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#F59E0B',
    textAlign: 'center',
    marginTop: 2,
  },
  outcomeOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  outcomeOptionCardActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderColor: '#10B981',
  },
  outcomeOptionTitle: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  outcomeOptionTitleActive: {
    color: '#10B981',
  },
  outcomeOptionSub: {
    fontSize: 10.5,
    color: 'rgba(255, 255, 255, 0.5)',
  },
  noteInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 12,
    padding: 12,
    color: '#FFFFFF',
    fontSize: 12,
    minHeight: 64,
    textAlignVertical: 'top',
  },
  submitRescueBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#10B981',
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 6,
  },
  submitRescueBtnText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#000000',
  },
  rewardNoticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 6,
  },
  rewardNoticeText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#F59E0B',
  },
});
