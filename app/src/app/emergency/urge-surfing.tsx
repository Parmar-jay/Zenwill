import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  View,
  Platform,
  Animated,
  Easing,
} from 'react-native';
import { useRouter, Stack, useFocusEffect } from 'expo-router';
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
  } catch (error) {}
};

export default function EmergencyUrgeSurfingScreen() {
  const router = useRouter();
  const [secondsRemaining, setSecondsRemaining] = useState<number>(90);
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(true);
  const [isCompleted, setIsCompleted] = useState<boolean>(false);
  const isMountedRef = useRef<boolean>(true);
  const timerRef = useRef<any>(null);

  // Pulsating Wave Ring Animations
  const wavePulseAnim = useRef(new Animated.Value(1)).current;
  const waveOpacityAnim = useRef(new Animated.Value(0.4)).current;
  const victoryScale = useRef(new Animated.Value(0.8)).current;

  // Stop background timer completely if screen loses focus or unmounts
  useFocusEffect(
    useCallback(() => {
      isMountedRef.current = true;
      return () => {
        isMountedRef.current = false;
        setIsTimerRunning(false);
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
      };
    }, [])
  );

  const handleFinishSession = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsTimerRunning(false);
    setIsCompleted(true);
    triggerHaptic(Haptics.ImpactFeedbackStyle.Heavy);

    Animated.spring(victoryScale, {
      toValue: 1,
      friction: 5,
      tension: 40,
      useNativeDriver: true,
    }).start();

    // 1. Increment local urge counter & complete daily mission task immediately
    useHabitStore.getState().incrementUrgeCount();
    useDailyMissionStore.getState().completeTask('rescue');

    // 2. Fire backend logging in background
    analyticsApi.completeEmergency({
      session_id: 'surge_' + Date.now(),
      techniques_used: ['Urge Surfing', 'Breathing Waves'],
      outcome: 'resisted',
      was_effective: true,
      main_influence: 'Breathing Waves',
      trigger_reason: 'Urge De-escalation',
      urge_intensity_before: 7,
      urge_intensity_after: 2,
      thought_note: 'Completed 90-second Urge Surfing Wave',
      most_helpful_technique: 'Urge Surfing',
    }).catch(() => {});

    analyticsApi.logEvent({
      event_type: 'urge_surfing_completed',
      trigger_context: 'Urge Surfing Protocol',
      outcome: 'resisted',
      intensity: 7,
    }).catch(() => {});

    useHabitStore.getState().syncFromDatabase().catch(() => {});
  }, [victoryScale]);

  useEffect(() => {
    if (!isTimerRunning) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    timerRef.current = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }
          if (isMountedRef.current) {
            handleFinishSession();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isTimerRunning, handleFinishSession]);

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

  return (
    <View style={styles.blackBg}>
      <Stack.Screen options={{ headerShown: false }} />

      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
        {/* Header Bar */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backBtn}
            activeOpacity={0.7}
            onPress={() => {
              if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
              }
              router.back();
            }}
          >
            <Ionicons name="chevron-back" size={24} color="#00E5FF" />
          </TouchableOpacity>
          <View style={{ alignItems: 'center' }}>
            <ThemedText style={styles.stepIndicator}>DE-ESCALATION PROTOCOL</ThemedText>
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
            activeOpacity={0.8}
            onPress={() => {
              triggerHaptic(Haptics.ImpactFeedbackStyle.Heavy);
              handleFinishSession();
            }}
          >
            <ThemedText style={styles.nextBtnText}>
              {secondsRemaining === 0 ? 'Urge Transmuted • Return' : "I'm in Control • Wave Transmuted"}
            </ThemedText>
            <Ionicons name="checkmark-done" size={18} color="#000000" />
          </TouchableOpacity>
        </View>

        {/* Clean In-Screen Victory Completion Card (Zero Popup Modals) */}
        {isCompleted && (
          <View style={styles.victoryOverlay}>
            <Animated.View style={[styles.victoryCard, { transform: [{ scale: victoryScale }] }]}>
              <View style={styles.victoryIconCircle}>
                <Ionicons name="shield-checkmark" size={38} color="#00E5FF" />
              </View>
              <ThemedText style={styles.victoryTitle}>URGE WAVE TRANSMUTED</ThemedText>
              <ThemedText style={styles.victoryBody}>
                You observed the craving wave without reacting. Your prefrontal cortex has reinforced its neural pathway of self-control.
              </ThemedText>
              <View style={styles.victoryRewardBadge}>
                <Ionicons name="flash" size={15} color="#F59E0B" style={{ marginRight: 6 }} />
                <ThemedText style={styles.victoryRewardText}>+1 Urge Resisted • +20 XP Awarded</ThemedText>
              </View>

              <TouchableOpacity
                style={styles.victoryBtn}
                activeOpacity={0.85}
                onPress={() => {
                  triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
                  router.navigate('/(tabs)/progress' as any);
                }}
              >
                <ThemedText style={styles.victoryBtnText}>Return to Headquarters</ThemedText>
              </TouchableOpacity>
            </Animated.View>
          </View>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  blackBg: {
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
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  stepIndicator: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#00E5FF',
    letterSpacing: 1,
    marginBottom: 2,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 100,
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FFFFFF',
    marginBottom: 6,
    textAlign: 'center',
  },
  sub: {
    fontSize: 13,
    color: '#94A3B8',
    lineHeight: 18,
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 10,
  },
  waveHeroBox: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.2)',
    marginBottom: 20,
  },
  ringContainer: {
    width: 170,
    height: 170,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginBottom: 20,
  },
  pulseRing: {
    position: 'absolute',
    width: 170,
    height: 170,
    borderRadius: 85,
    backgroundColor: 'rgba(0, 229, 255, 0.1)',
    borderWidth: 1.5,
    borderColor: 'rgba(0, 229, 255, 0.3)',
  },
  timerCircle: {
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: '#070C16',
    borderWidth: 2,
    borderColor: '#00E5FF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#00E5FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 8,
  },
  timerNum: {
    fontSize: 36,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -1,
  },
  timerSub: {
    fontSize: 10,
    fontWeight: '700',
    color: '#00E5FF',
    marginTop: 2,
    letterSpacing: 0.5,
  },
  waveTrack: {
    width: '100%',
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 8,
  },
  waveFill: {
    height: '100%',
    backgroundColor: '#00E5FF',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
  },
  tipsSection: {
    gap: 10,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: 'rgba(255, 255, 255, 0.5)',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  tipCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.025)',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  tipTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  tipDesc: {
    fontSize: 11.5,
    color: '#94A3B8',
    lineHeight: 16,
  },
  bottomDock: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
  },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00E5FF',
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
  },
  nextBtnText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#000000',
    letterSpacing: 0.2,
  },
  victoryOverlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    zIndex: 1000,
  },
  victoryCard: {
    width: '100%',
    backgroundColor: '#0B1120',
    borderRadius: 22,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#00E5FF',
    shadowColor: '#00E5FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  victoryIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(0, 229, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(0, 229, 255, 0.4)',
  },
  victoryTitle: {
    fontSize: 19,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.5,
    marginBottom: 8,
    textAlign: 'center',
  },
  victoryBody: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 16,
    paddingHorizontal: 6,
  },
  victoryRewardBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.4)',
    marginBottom: 20,
  },
  victoryRewardText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#F59E0B',
  },
  victoryBtn: {
    width: '100%',
    backgroundColor: '#00E5FF',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  victoryBtnText: {
    fontSize: 13.5,
    fontWeight: '900',
    color: '#000000',
    letterSpacing: 0.3,
  },
});
