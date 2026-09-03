import React, { useState } from 'react';
import {
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  View,
  Platform,
  TextInput,
  ActivityIndicator,
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
import { omSoundManager } from '@/utils/audio-player';

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

  // Form State
  const [selectedTrigger, setSelectedTrigger] = useState<string>('📱 Late Night Phone / Screen Fatigue');
  const [selectedContext, setSelectedContext] = useState<string>('Alone in bedroom');
  const [effectivenessRating, setEffectivenessRating] = useState<number>(5);
  const [mostHelpfulTool, setMostHelpfulTool] = useState<string>('5-Min Mind Shield Breath');
  const [urgeOutcome, setUrgeOutcome] = useState<'vanished' | 'weakened' | 'holding_strong'>('vanished');
  const [reflectionText, setReflectionText] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const triggerTags = [
    '📱 Mobile phone scrolling',
    '💼 Study / Exam / Job stress',
    '🥱 Boredom / Sitting idle',
    '🌪️ Feeling lonely or low',
    '😡 Anger or irritation',
    '💬 Social media temptation',
    '❓ Sudden spontaneous craving',
  ];

  const contextTags = [
    'Alone in room',
    'In bed at night',
    'At study / work desk',
    'Using mobile on bed',
    'Taking a free break',
    'Other place',
  ];

  const rescueTools = [
    { id: '5-Min Mind Shield Breath', label: '5-Min Mind Shield Breathing' },
    { id: 'Urge Surfing Wave', label: '90-Second Urge Surfing Wave' },
    { id: '5-4-3-2-1 Sensory Grounding', label: '5-4-3-2-1 Sensory Reset' },
    { id: 'Maha-Mantra Focus Anchor', label: 'Hare Krishna Focus Anchor' },
  ];

  const handleGoBack = () => {
    triggerHaptic();
    omSoundManager.stopAndUnload();
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/emergency' as any);
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    triggerHaptic(Haptics.ImpactFeedbackStyle.Heavy);

    // 1. Immediately turn off and unload rescue audio
    omSoundManager.stopAndUnload();

    // 2. Mark Daily Mission rescue task as completed
    useDailyMissionStore.getState().completeTask('rescue');
    useHabitStore.getState().incrementUrgeCount();

    // 3. Save comprehensive analytics & review data to database
    try {
      await Promise.all([
        analyticsApi.completeEmergency({
          session_id: 'emergency_' + Date.now(),
          techniques_used: ['5-Min Mind Shield', 'Urge Surfing Wave', '5-4-3-2-1 Sensory Reset'],
          outcome: 'resisted',
          was_effective: effectivenessRating >= 3,
          main_influence: mostHelpfulTool,
          trigger_reason: selectedTrigger,
          most_helpful_technique: mostHelpfulTool,
          urge_intensity_before: 7,
          urge_intensity_after: urgeOutcome === 'vanished' ? 1 : urgeOutcome === 'weakened' ? 3 : 4,
          duration_minutes: 6,
          thought_note: reflectionText || `Context: ${selectedContext}. Trigger: ${selectedTrigger}. Rating: ${effectivenessRating}/5. Outcome: ${urgeOutcome}.`,
          user_feedback: reflectionText || 'User successfully de-escalated urge with the full 4-step rescue sequence.',
        }),
        analyticsApi.logEvent({
          event_type: 'emergency_reflection_submitted',
          screen_name: 'emergency_reflection',
          trigger_context: selectedTrigger,
          outcome: 'resisted',
          intensity: urgeOutcome === 'vanished' ? 1 : 3,
          metadata: {
            trigger: selectedTrigger,
            context: selectedContext,
            rating: effectivenessRating,
            most_helpful_tool: mostHelpfulTool,
            outcome: urgeOutcome,
            user_reflection: reflectionText,
          },
        }),
      ]);
      useHabitStore.getState().syncFromDatabase().catch(() => {});
    } catch (err) {
      console.warn('Backend emergency save warning (offline mode):', err);
    }

    setIsSubmitting(false);
    router.replace('/(tabs)/home' as any);
  };

  return (
    <LinearGradient
      colors={['#000000', '#020617', '#000000']}
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
            <View style={styles.badgeRow}>
              <View style={styles.sosPulseDot} />
              <ThemedText style={styles.stepIndicator}>STEP 4 OF 4 • VICTORY LOG</ThemedText>
            </View>
            <ThemedText style={styles.headerTitle}>Victory Reflection</ThemedText>
          </View>
          <View style={{ width: 38 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Victory Hero Banner */}
          <View style={styles.victoryHeroCard}>
            <View style={styles.victoryIconCircle}>
              <Ionicons name="shield-checkmark" size={26} color="#10B981" />
            </View>
            <View style={{ flex: 1 }}>
              <ThemedText style={styles.victoryHeroTitle}>Urge Overcome Successfully!</ThemedText>
              <ThemedText style={styles.victoryHeroSub}>
                Take 30 seconds to save what caused it. This helps ZenWill protect you earlier next time.
              </ThemedText>
            </View>
          </View>

          {/* Section 1: Trigger Reason */}
          <View style={styles.sectionBox}>
            <ThemedText style={styles.sectionTitle}>1. What sparked this craving?</ThemedText>
            <ThemedText style={styles.sectionDesc}>Select the main trigger behind this urge:</ThemedText>
            <View style={styles.tagGrid}>
              {triggerTags.map((tag) => {
                const isSelected = selectedTrigger === tag;
                return (
                  <TouchableOpacity
                    key={tag}
                    style={[
                      styles.tagChip,
                      isSelected && styles.tagChipActive,
                    ]}
                    activeOpacity={0.75}
                    onPress={() => {
                      triggerHaptic();
                      setSelectedTrigger(tag);
                    }}
                  >
                    <ThemedText style={[styles.tagText, isSelected && styles.tagTextActive]}>
                      {tag}
                    </ThemedText>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Section 2: Environment / Context */}
          <View style={styles.sectionBox}>
            <ThemedText style={styles.sectionTitle}>2. Where were you / what situation?</ThemedText>
            <View style={styles.tagGrid}>
              {contextTags.map((ctx) => {
                const isSelected = selectedContext === ctx;
                return (
                  <TouchableOpacity
                    key={ctx}
                    style={[
                      styles.tagChip,
                      isSelected && styles.tagChipActive,
                    ]}
                    activeOpacity={0.75}
                    onPress={() => {
                      triggerHaptic();
                      setSelectedContext(ctx);
                    }}
                  >
                    <ThemedText style={[styles.tagText, isSelected && styles.tagTextActive]}>
                      {ctx}
                    </ThemedText>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Section 3: Helpfulness Rating */}
          <View style={styles.sectionBox}>
            <ThemedText style={styles.sectionTitle}>3. How helpful was this full rescue flow?</ThemedText>
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
              {effectivenessRating === 4 && '✨ Strong Calm • Mind Fully Stabilized'}
              {effectivenessRating === 3 && '👍 Good Relief • Feeling in Control'}
              {effectivenessRating === 2 && '⏳ Calmed Down • Needed Extra Focus'}
              {effectivenessRating === 1 && '🛡️ Slight Relief • Took Good Effort'}
            </ThemedText>
          </View>

          {/* Section 4: Most Helpful Rescue Technique */}
          <View style={styles.sectionBox}>
            <ThemedText style={styles.sectionTitle}>4. Which tool helped you the most?</ThemedText>
            <View style={{ gap: 8 }}>
              {rescueTools.map((tool) => {
                const isSelected = mostHelpfulTool === tool.id;
                return (
                  <TouchableOpacity
                    key={tool.id}
                    style={[
                      styles.toolOptionCard,
                      isSelected && styles.toolOptionCardActive,
                    ]}
                    activeOpacity={0.85}
                    onPress={() => {
                      triggerHaptic();
                      setMostHelpfulTool(tool.id);
                    }}
                  >
                    <ThemedText style={[styles.toolOptionText, isSelected && styles.toolOptionTextActive]}>
                      {tool.label}
                    </ThemedText>
                    {isSelected && (
                      <Ionicons name="checkmark-circle" size={18} color="#10B981" />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Section 5: Current Urge Outcome */}
          <View style={styles.sectionBox}>
            <ThemedText style={styles.sectionTitle}>5. Current urge state right now</ThemedText>
            <View style={{ gap: 8 }}>
              {[
                { id: 'vanished', label: '✅ Urge Vanished (0-2/10)', sub: 'Completely clear, calm, and grounded' },
                { id: 'weakened', label: '⚡ Significantly Weakened (3-4/10)', sub: 'Craving spike de-escalated safely' },
                { id: 'holding_strong', label: '🛡️ Resisted & Holding Strong', sub: 'In full control of my choices' },
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

          {/* Section 6: Action Reflection Note */}
          <View style={styles.sectionBox}>
            <ThemedText style={styles.sectionTitle}>6. What thought helped you regain control? (Optional)</ThemedText>
            <TextInput
              style={styles.textArea}
              placeholder="e.g., 'Reminded myself that this craving is just temporary dopamine noise...'"
              placeholderTextColor="rgba(255, 255, 255, 0.35)"
              multiline
              numberOfLines={3}
              value={reflectionText}
              onChangeText={setReflectionText}
            />
          </View>
        </ScrollView>

        {/* Bottom Navigation */}
        <View style={styles.bottomDock}>
          <TouchableOpacity
            style={[styles.nextBtn, isSubmitting && { opacity: 0.7 }]}
            activeOpacity={0.88}
            disabled={isSubmitting}
            onPress={handleSubmit}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#000000" size="small" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={19} color="#000000" />
                <ThemedText style={styles.nextBtnText}>Complete Rescue & Save Victory</ThemedText>
              </>
            )}
          </TouchableOpacity>

          <View style={styles.rewardNoticeBox}>
            <Ionicons name="flame" size={13} color="#F59E0B" />
            <ThemedText style={styles.rewardNoticeText}>+50 Discipline XP • Mind Strength Boosted</ThemedText>
          </View>
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
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  sosPulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  stepIndicator: {
    fontSize: 10,
    fontWeight: '800',
    color: '#10B981',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  scrollContent: {
    padding: Spacing.four,
    gap: 14,
    paddingBottom: 40,
  },

  // Victory Hero Card
  victoryHeroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  victoryIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.4)',
  },
  victoryHeroTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  victoryHeroSub: {
    fontSize: 11.5,
    color: 'rgba(255, 255, 255, 0.65)',
    lineHeight: 16,
  },

  // Form Sections
  sectionBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 14,
    gap: 10,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  sectionDesc: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.5)',
    marginTop: -4,
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
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: '#10B981',
  },
  tagText: {
    fontSize: 11.5,
    color: 'rgba(255, 255, 255, 0.65)',
    fontWeight: '600',
  },
  tagTextActive: {
    color: '#10B981',
    fontWeight: '700',
  },

  // Rating Row
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

  // Option Cards
  toolOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  toolOptionCardActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderColor: '#10B981',
  },
  toolOptionText: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.8)',
  },
  toolOptionTextActive: {
    color: '#10B981',
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

  textArea: {
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    padding: 12,
    color: '#FFFFFF',
    fontSize: 12.5,
    minHeight: 70,
    textAlignVertical: 'top',
  },

  // Bottom Dock
  bottomDock: {
    paddingHorizontal: Spacing.four,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 24 : 14,
    backgroundColor: '#040508',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    gap: 8,
  },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#10B981',
    paddingVertical: 14,
    borderRadius: 14,
    ...webNoOutline,
  },
  nextBtnText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '900',
  },
  rewardNoticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  rewardNoticeText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#F59E0B',
  },
});
