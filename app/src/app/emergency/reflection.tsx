import React, { useState } from 'react';
import {
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  View,
  Platform,
  TextInput,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { analyticsApi } from '@/services/analytics-api';
import { useDailyMissionStore } from '@/store/daily-mission-store';
import { useHabitStore } from '@/store/habit-store';


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

export default function EmergencyReflectionScreen() {
  const router = useRouter();
  const [selectedTrigger, setSelectedTrigger] = useState('Screen Fatigue');
  const [reflectionText, setReflectionText] = useState('');

  const triggerTags = [
    'Screen Fatigue',
    'Work Stress',
    'Boredom / Loneliness',
    'Late Night Restlessness',
    'Unknown',
  ];

  const handleGoBack = () => {
    triggerHaptic();
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/emergency' as any);
    }
  };

  const handleSubmit = async () => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);

    // 1. Mark task completed & navigate instantly
    useDailyMissionStore.getState().completeTask('rescue');
    router.navigate('/(tabs)/home' as any);

    // 2. Fire backend logging in parallel in the background
    try {
      await Promise.all([
        analyticsApi.completeEmergency({
          session_id: 'emergency_' + Date.now(),
          techniques_used: ['Pranayama Breath Reset', 'Sensory Grounding', 'Urge Surfing'],
          outcome: 'resisted',
          trigger_reason: selectedTrigger,
          most_helpful_technique: selectedTrigger,
          user_feedback: reflectionText || 'User successfully de-escalated urge with breath and sensory grounding.',
          was_effective: true,
        }),
        analyticsApi.logEvent({
          event_type: 'emergency_reflection_submitted',
          trigger_context: selectedTrigger,
          outcome: 'resisted',
          metadata: { reflection_text: reflectionText, trigger: selectedTrigger },
        }),
      ]);
      useHabitStore.getState().syncFromDatabase().catch(() => {});
    } catch (err) {
      console.warn('Backend emergency save warning (offline mode):', err);
    }
  };


  return (
    <LinearGradient
      colors={['#000000', '#000000', '#000000']}
      style={styles.gradientBg}
    >
      <Stack.Screen options={{ headerShown: false }} />

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
            <ThemedText style={styles.stepIndicator}>DE-ESCALATION COMPLETE</ThemedText>
            <ThemedText style={styles.headerTitle}>Victory Reflection</ThemedText>
          </View>
          <View style={{ width: 38 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <ThemedText style={styles.title}>You Successfully Rode the Wave!</ThemedText>
          <ThemedText style={styles.sub}>
            Log what caused the surge so your AI Risk Engine can sharpen future trigger detection.
          </ThemedText>

          {/* Trigger Tag Selector */}
          <View style={styles.sectionBox}>
            <ThemedText style={styles.sectionTitle}>Primary Urge Trigger</ThemedText>
            <View style={styles.tagGrid}>
              {triggerTags.map((tag) => (
                <TouchableOpacity
                  key={tag}
                  style={[
                    styles.tagChip,
                    selectedTrigger === tag && styles.tagChipActive,
                  ]}
                  activeOpacity={0.7}
                  onPress={() => {
                    triggerHaptic();
                    setSelectedTrigger(tag);
                  }}
                >
                  <ThemedText style={[styles.tagText, selectedTrigger === tag && styles.tagTextActive]}>
                    {tag}
                  </ThemedText>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Action Reflection Note */}
          <View style={styles.sectionBox}>
            <ThemedText style={styles.sectionTitle}>What Helped You De-escalate?</ThemedText>
            <TextInput
              style={styles.textArea}
              placeholder="Type your reflection here (e.g. 'Deep breathing and drinking cold water cleared the urge...')"
              placeholderTextColor="rgba(255, 255, 255, 0.4)"
              multiline
              numberOfLines={4}
              value={reflectionText}
              onChangeText={setReflectionText}
            />
          </View>
        </ScrollView>

        {/* Bottom Navigation */}
        <View style={styles.bottomDock}>
          <TouchableOpacity
            style={styles.nextBtn}
            activeOpacity={0.85}
            onPress={handleSubmit}
          >
            <ThemedText style={styles.nextBtnText}>Submit Reflection</ThemedText>
            <Ionicons name="checkmark-done-circle" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradientBg: { flex: 1 },
  safeArea: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
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
  stepIndicator: {
    fontSize: 10,
    fontWeight: '800',
    color: '#10B981',
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
    padding: Spacing.four,
    gap: Spacing.three,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  sub: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.65)',
    lineHeight: 19,
  },
  sectionBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 16,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  tagGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tagChip: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    ...webNoOutline,
  },
  tagChipActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderColor: '#10B981',
  },
  tagText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.65)',
  },
  tagTextActive: {
    color: '#10B981',
    fontWeight: '700',
  },
  textArea: {
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    padding: 14,
    color: '#FFFFFF',
    fontSize: 13.5,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  bottomDock: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    backgroundColor: '#040508',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#10B981',
    paddingVertical: 14,
    borderRadius: 16,
    ...webNoOutline,
  },
  nextBtnText: {
    color: '#FFFFFF',
    fontSize: 14.5,
    fontWeight: '800',
  },
});
