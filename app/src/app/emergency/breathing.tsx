import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  View,
  Platform,
  Animated,
  Easing,
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

  // Animation values
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const pulseOpacity = useRef(new Animated.Value(0.4)).current;

  const currentSosPhase = EMERGENCY_SOS_SEQUENCE.phases[sosPhaseIndex] || EMERGENCY_SOS_SEQUENCE.phases[0];
  const themeColor = currentSosPhase.color || '#10B981';

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
              setIsSosRunning(false);
              triggerHaptic(Haptics.ImpactFeedbackStyle.Heavy);
              useDailyMissionStore.getState().completeTask('rescue');
              analyticsApi.logEvent({
                event_type: 'emergency_exercise',
                screen_name: 'emergency_breathing',
                feature_name: 'box_breathing',
                duration_seconds: 180,
                outcome: 'resisted',
                emotional_state: 'grounded',
                metadata: { phases_completed: EMERGENCY_SOS_SEQUENCE.phases.length },
              }).catch(() => {});
              useHabitStore.getState().syncFromDatabase().catch(() => {});
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
              <ThemedText style={styles.stepIndicator}>DE-ESCALATION PROTOCOL 1</ThemedText>
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

            {/* Breathing Animated Orb Container */}
            <View style={styles.animationContainer}>
              <Animated.View
                style={[
                  styles.breathGlowRing,
                  {
                    backgroundColor: `${themeColor}15`,
                    borderColor: themeColor,
                    transform: [{ scale: scaleAnim }],
                    opacity: pulseOpacity,
                  },
                ]}
              />

              <View style={[styles.breathCoreCircle, { borderColor: themeColor }]}>
                <ThemedText style={[styles.breathStageText, { color: themeColor }]}>
                  {breathStage}
                </ThemedText>
                <ThemedText style={styles.breathSubText}>
                  {isSosRunning ? 'Rhythmic Breath' : 'Paused'}
                </ThemedText>
              </View>
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

          {/* Spiritual / Mantra Anchor Card */}
          <View style={styles.mantraCard}>
            <View style={styles.mantraHeaderRow}>
              <View style={styles.mantraIconBox}>
                <Ionicons name="sparkles" size={16} color="#00E5FF" />
              </View>
              <View style={{ flex: 1 }}>
                <ThemedText style={styles.mantraSectionTitle}>Spiritual Focus Anchor</ThemedText>
                <ThemedText style={styles.mantraSectionSub}>Hare Krishna Maha-Mantra</ThemedText>
              </View>
            </View>

            <View style={styles.mantraDisplayCard}>
              <ThemedText style={styles.mantraText}>
                "Hare Krishna Hare Krishna, Krishna Krishna Hare Hare,{'\n'}Hare Rama Hare Rama, Rama Rama Hare Hare"
              </ThemedText>
            </View>
            <ThemedText style={styles.mantraHint}>
              Mentally synchronize this vibration with your breathing cycle to dissolve mental urge momentum.
            </ThemedText>
          </View>
        </ScrollView>

        {/* Bottom Navigation Dock */}
        <View style={styles.bottomDock}>
          <TouchableOpacity
            style={[styles.nextBtn, { backgroundColor: themeColor }]}
            activeOpacity={0.85}
            onPress={() => {
              triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
              router.push('/emergency/grounding' as any);
            }}
          >
            <ThemedText style={styles.nextBtnText}>Continue to Sensory Grounding</ThemedText>
            <Ionicons name="arrow-forward" size={18} color="#000000" />
          </TouchableOpacity>
        </View>
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
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    ...webNoOutline,
  },
  phaseDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  phaseDotNum: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
  },
  phasePillText: {
    fontSize: 11,
    fontWeight: '600',
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
    width: 200,
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 6,
  },
  breathGlowRing: {
    position: 'absolute',
    width: 190,
    height: 190,
    borderRadius: 95,
    borderWidth: 2,
  },
  breathCoreCircle: {
    width: 136,
    height: 136,
    borderRadius: 68,
    backgroundColor: 'rgba(10, 15, 30, 0.85)',
    borderWidth: 2.5,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
  },
  breathStageText: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  breathSubText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 2,
  },

  // Controls Row
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
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
});
