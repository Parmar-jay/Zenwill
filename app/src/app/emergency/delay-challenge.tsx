import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  View,
  Platform,
  Animated,
  Easing,
  Text,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

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

export default function EmergencyDelayChallengeScreen() {
  const router = useRouter();

  const [selectedMinutes, setSelectedMinutes] = useState<number>(5);
  const [secondsLeft, setSecondsLeft] = useState<number>(300);
  const [isRunning, setIsRunning] = useState<boolean>(true);

  // Outer Pulsating Amber Glow Animation (Smooth, no text jitter)
  const ringScaleAnim = useRef(new Animated.Value(1)).current;
  const ringOpacityAnim = useRef(new Animated.Value(0.5)).current;

  // Reset timer on minute selection change
  useEffect(() => {
    setSecondsLeft(selectedMinutes * 60);
    setIsRunning(true);
  }, [selectedMinutes]);

  // Countdown Interval Loop
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isRunning && secondsLeft > 0) {
      interval = setInterval(() => {
        setSecondsLeft((prev) => {
          if (prev <= 1) {
            setIsRunning(false);
            triggerHaptic(Haptics.ImpactFeedbackStyle.Heavy);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRunning, secondsLeft]);

  // Outer Glow Ring Pulse Animation
  useEffect(() => {
    let animationLoop: Animated.CompositeAnimation;
    if (isRunning && secondsLeft > 0) {
      animationLoop = Animated.loop(
        Animated.parallel([
          Animated.sequence([
            Animated.timing(ringScaleAnim, {
              toValue: 1.25,
              duration: 2000,
              easing: Easing.bezier(0.4, 0, 0.2, 1),
              useNativeDriver: true,
            }),
            Animated.timing(ringScaleAnim, {
              toValue: 1.0,
              duration: 2000,
              easing: Easing.bezier(0.4, 0, 0.2, 1),
              useNativeDriver: true,
            }),
          ]),
          Animated.sequence([
            Animated.timing(ringOpacityAnim, {
              toValue: 0.7,
              duration: 2000,
              useNativeDriver: true,
            }),
            Animated.timing(ringOpacityAnim, {
              toValue: 0.2,
              duration: 2000,
              useNativeDriver: true,
            }),
          ]),
        ])
      );
      animationLoop.start();
      return () => animationLoop.stop();
    } else {
      ringScaleAnim.setValue(1);
      ringOpacityAnim.setValue(0.2);
    }
  }, [isRunning, secondsLeft]);

  const formatTime = (totalSecs: number) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const toggleTimer = () => {
    triggerHaptic();
    setIsRunning(!isRunning);
  };

  const resetTimer = () => {
    triggerHaptic();
    setSecondsLeft(selectedMinutes * 60);
    setIsRunning(true);
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
            <ThemedText style={styles.stepIndicator}>DE-ESCALATION PROTOCOL 4</ThemedText>
            <ThemedText style={styles.headerTitle}>Delay Challenge</ThemedText>
          </View>
          <View style={{ width: 38 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Header Titles (Perfect Centering & Alignment) */}
          <View style={styles.titleBox}>
            <ThemedText style={styles.title}>Delay Action by 5-15 Mins</ThemedText>
            <ThemedText style={styles.sub}>
              Studies show delaying impulsive action by just 5 minutes reduces urge compliance by over 70%.
            </ThemedText>
          </View>

          {/* Time Selector Pills */}
          <View style={styles.durationSelectorRow}>
            {[5, 10, 15].map((mins) => (
              <TouchableOpacity
                key={mins}
                style={[
                  styles.durationPill,
                  selectedMinutes === mins && styles.durationPillActive,
                ]}
                activeOpacity={0.7}
                onPress={() => {
                  triggerHaptic();
                  setSelectedMinutes(mins);
                }}
              >
                <ThemedText style={[styles.durationText, selectedMinutes === mins && styles.durationTextActive]}>
                  {mins} Mins
                </ThemedText>
              </TouchableOpacity>
            ))}
          </View>

          {/* Countdown Display Hero Card */}
          <View style={styles.timerHeroCard}>
            {/* Outer Animated Glow Ring Container */}
            <View style={styles.ringOuterContainer}>
              <Animated.View
                style={[
                  styles.pulseRing,
                  {
                    transform: [{ scale: ringScaleAnim }],
                    opacity: ringOpacityAnim,
                  },
                ]}
              />
              <View style={styles.timerCircle}>
                <Text style={styles.timerDisplay}>{formatTime(secondsLeft)}</Text>
                <ThemedText style={styles.timerStatus}>
                  {secondsLeft === 0
                    ? 'Challenge Complete!'
                    : isRunning
                    ? 'Delaying Impulse'
                    : 'Timer Paused'}
                </ThemedText>
              </View>
            </View>

            {/* Play/Pause & Reset Action Controls */}
            <View style={styles.controlButtonsRow}>
              <TouchableOpacity
                style={styles.controlBtn}
                activeOpacity={0.7}
                onPress={toggleTimer}
              >
                <Ionicons name={isRunning ? 'pause' : 'play'} size={18} color="#F59E0B" />
                <ThemedText style={styles.controlBtnText}>
                  {isRunning ? 'Pause' : 'Resume'}
                </ThemedText>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.controlBtn}
                activeOpacity={0.7}
                onPress={resetTimer}
              >
                <Ionicons name="reload" size={16} color="#94A3B8" />
                <ThemedText style={styles.controlBtnResetText}>Reset</ThemedText>
              </TouchableOpacity>
            </View>

            {/* Probability Metric Badge */}
            <View style={styles.benefitBox}>
              <Ionicons name="shield-checkmark" size={18} color="#F59E0B" />
              <ThemedText style={styles.benefitText}>
                {selectedMinutes === 5
                  ? '70% Urge Fade Probability'
                  : selectedMinutes === 10
                  ? '85% Urge Fade Probability'
                  : '95% Complete De-escalation'}
              </ThemedText>
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
              router.push('/emergency/reflection' as any);
            }}
          >
            <ThemedText style={styles.nextBtnText}>Continue to Victory Reflection</ThemedText>
            <Ionicons name="arrow-forward" size={16} color="#000000" />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
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
    color: '#F59E0B',
    letterSpacing: 1.2,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#ffffff',
  },
  scrollContent: {
    padding: 16,
    gap: 16,
    alignItems: 'center',
  },
  titleBox: {
    alignItems: 'center',
    gap: 6,
    width: '100%',
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
  durationSelectorRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  durationPill: {
    flex: 1,
    backgroundColor: 'rgba(18, 18, 18, 0.95)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.15)',
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    ...webNoOutline,
  },
  durationPillActive: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    borderColor: '#F59E0B',
  },
  durationText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
    textAlign: 'center',
  },
  durationTextActive: {
    color: '#F59E0B',
    fontWeight: '800',
  },
  timerHeroCard: {
    width: '100%',
    backgroundColor: 'rgba(18, 18, 18, 0.95)',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.35)',
    padding: 20,
    alignItems: 'center',
    gap: 16,
  },
  ringOuterContainer: {
    width: 160,
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseRing: {
    position: 'absolute',
    width: 155,
    height: 155,
    borderRadius: 77.5,
    backgroundColor: 'rgba(245, 158, 11, 0.25)',
    borderWidth: 1.5,
    borderColor: '#F59E0B',
  },
  timerCircle: {
    width: 135,
    height: 135,
    borderRadius: 67.5,
    backgroundColor: 'rgba(245, 158, 11, 0.16)',
    borderWidth: 2,
    borderColor: '#F59E0B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  timerDisplay: {
    fontSize: 34,
    fontWeight: '800',
    color: '#F59E0B',
    textAlign: 'center',
    includeFontPadding: false,
  },
  timerStatus: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
    textTransform: 'uppercase',
    marginTop: 4,
    textAlign: 'center',
  },
  controlButtonsRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  controlBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    ...webNoOutline,
  },
  controlBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#F59E0B',
  },
  controlBtnResetText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#94A3B8',
  },
  benefitBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    width: '100%',
  },
  benefitText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#F59E0B',
    textAlign: 'center',
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
});
