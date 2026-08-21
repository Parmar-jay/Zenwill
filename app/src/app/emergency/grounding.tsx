import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  View,
  Platform,
  Animated,
  Text,
  TextInput,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
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

export default function EmergencyGroundingScreen() {
  const router = useRouter();

  const handleGoBack = () => {
    triggerHaptic();
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/emergency' as any);
    }
  };

  const [activeStepIndex, setActiveStepIndex] = useState<number>(0);
  const [sensoryInputs, setSensoryInputs] = useState<Record<string, string>>({});
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const steps = [
    { num: '5', sense: 'SEE', title: '5 Objects You Can See', instruction: 'Look around your physical space and name 5 distinct objects out loud or in your mind.', icon: 'eye-outline' as const, color: '#10B981' },
    { num: '4', sense: 'TOUCH', title: '4 Textures You Can Feel', instruction: 'Touch 4 physical items (your shirt fabric, table surface, cold glass, or chair).', icon: 'hand-left-outline' as const, color: '#00E5FF' },
    { num: '3', sense: 'HEAR', title: '3 Sounds You Can Hear', instruction: 'Listen closely for 3 background sounds (AC hum, distant traffic, your breath).', icon: 'ear-outline' as const, color: '#8B5CF6' },
    { num: '2', sense: 'SMELL', title: '2 Scents You Can Smell', instruction: 'Inhale deeply and identify 2 scents or focus on fresh ambient air.', icon: 'flower-outline' as const, color: '#F59E0B' },
    { num: '1', sense: 'TASTE', title: '1 Taste You Can Sense', instruction: 'Notice 1 taste or sip a glass of cold water to anchor physical presence.', icon: 'restaurant-outline' as const, color: '#EF4444' },
  ];

  const current = steps[activeStepIndex];

  const animateStepChange = (newIdx: number) => {
    triggerHaptic();
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 0.3, duration: 120, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
    setActiveStepIndex(newIdx);
  };

  return (
    <View style={styles.blackBg}>
      <Stack.Screen options={{ headerShown: false }} />

      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
        {/* Header Bar */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} activeOpacity={0.7} onPress={handleGoBack}>
            <Ionicons name="chevron-back" size={24} color="#00E5FF" />
          </TouchableOpacity>
          <View style={{ alignItems: 'center' }}>
            <ThemedText style={styles.stepIndicator}>DE-ESCALATION PROTOCOL 2</ThemedText>
            <ThemedText style={styles.headerTitle}>Sensory Grounding</ThemedText>
          </View>
          <View style={{ width: 38 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <ThemedText style={styles.title}>5-4-3-2-1 Sensory Reset</ThemedText>
          <ThemedText style={styles.sub}>
            Re-engage your physical senses to force brain activity out of craving loops and back into present awareness.
          </ThemedText>

          {/* Active Step Hero Card with Animated Transition */}
          <Animated.View style={[styles.heroCard, { opacity: fadeAnim, borderColor: `${current.color}60` }]}>
            <View style={styles.heroTopRow}>
              <View style={[styles.numBadge, { backgroundColor: `${current.color}25`, borderColor: current.color }]}>
                <ThemedText style={[styles.numText, { color: current.color }]}>{current.num}</ThemedText>
              </View>
              <View style={[styles.senseBadge, { backgroundColor: `${current.color}20`, borderColor: `${current.color}40` }]}>
                <Ionicons name={current.icon} size={15} color={current.color} />
                <ThemedText style={[styles.senseBadgeText, { color: current.color }]}>{current.sense}</ThemedText>
              </View>
            </View>

            <ThemedText style={styles.stepTitle}>{current.title}</ThemedText>
            <ThemedText style={styles.stepInstruction}>{current.instruction}</ThemedText>

            {/* Individual Sensory Input Field */}
            <TextInput
              style={[styles.sensoryInput, { borderColor: `${current.color}50` }]}
              placeholder={`Enter your ${current.sense.toLowerCase()} observation here...`}
              placeholderTextColor="#64748B"
              value={sensoryInputs[current.num] || ''}
              onChangeText={(text) =>
                setSensoryInputs((prev) => ({ ...prev, [current.num]: text }))
              }
              multiline={false}
            />

            {/* Step Navigation Dots */}
            <View style={styles.dotsRow}>
              {steps.map((_, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={[
                    styles.dot,
                    activeStepIndex === idx && { backgroundColor: current.color, width: 22 },
                  ]}
                  activeOpacity={0.7}
                  onPress={() => animateStepChange(idx)}
                />
              ))}
            </View>
          </Animated.View>

          {/* Step Selector Grid */}
          <View style={styles.stepSelectorGrid}>
            {steps.map((s, idx) => (
              <TouchableOpacity
                key={s.num}
                style={[
                  styles.stepPill,
                  activeStepIndex === idx && { borderColor: s.color, backgroundColor: `${s.color}22` },
                ]}
                activeOpacity={0.7}
                onPress={() => animateStepChange(idx)}
              >
                <ThemedText style={[styles.stepPillNum, { color: s.color }]}>{s.num}</ThemedText>
                <ThemedText style={styles.stepPillSense}>{s.sense}</ThemedText>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        {/* Bottom Navigation */}
        <View style={styles.bottomDock}>
          <TouchableOpacity
            style={styles.nextBtn}
            activeOpacity={0.7}
            onPress={() => {
              if (activeStepIndex < steps.length - 1) {
                animateStepChange(activeStepIndex + 1);
              } else {
                triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
                useDailyMissionStore.getState().completeTask('rescue');
                analyticsApi.logEvent({
                  event_type: 'emergency_exercise',
                  screen_name: 'emergency_grounding',
                  feature_name: 'sensory_grounding_54321',
                  duration_seconds: 120,
                  outcome: 'resisted',
                  emotional_state: 'grounded',
                  metadata: { inputs_provided: sensoryInputs },
                }).catch(() => {});
                useHabitStore.getState().syncFromDatabase().catch(() => {});
                router.push('/emergency/urge-surfing' as any);
              }
            }}

          >
            <ThemedText style={styles.nextBtnText}>
              {activeStepIndex < steps.length - 1 ? `Next: ${steps[activeStepIndex + 1].sense}` : 'Continue to Urge Surfing'}
            </ThemedText>
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
    color: '#10B981',
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
  heroCard: {
    width: '100%',
    backgroundColor: 'rgba(18, 18, 18, 0.95)',
    borderRadius: 22,
    borderWidth: 1,
    padding: 20,
    gap: 12,
    marginTop: 4,
    ...webNoOutline,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  numBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  numText: {
    fontSize: 22,
    fontWeight: '800',
  },
  senseBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  senseBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  stepTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#ffffff',
  },
  stepInstruction: {
    fontSize: 13.5,
    color: '#CBD5E1',
    lineHeight: 20,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginTop: 10,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  stepSelectorGrid: {
    flexDirection: 'row',
    gap: 8,
    width: '100%',
    marginTop: 4,
  },
  stepPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: 'rgba(18, 18, 18, 0.95)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.15)',
    paddingVertical: 10,
    ...webNoOutline,
  },
  stepPillNum: {
    fontSize: 14,
    fontWeight: '800',
  },
  stepPillSense: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
  },
  sensoryInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 13.5,
    color: '#FFFFFF',
    marginTop: 6,
    ...webNoOutline,
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
