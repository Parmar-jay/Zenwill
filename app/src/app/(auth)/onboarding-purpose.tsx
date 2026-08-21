import React, { useState } from 'react';
import {
  StyleSheet, TouchableOpacity, ScrollView, View,
  Platform, TextInput, Dimensions, ActivityIndicator,
} from 'react-native';
import { useRouter, Stack, useLocalSearchParams } from 'expo-router';
import { useAuthStore } from '@/store/auth-store';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useOnboardingStore, ImprovementReason } from '@/store/onboarding-store';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const REASONS: { id: ImprovementReason; label: string; icon: string }[] = [
  { id: 'better_focus',          label: 'Better Focus',           icon: 'eye-outline' },
  { id: 'better_career',         label: 'Better Career',          icon: 'briefcase-outline' },
  { id: 'better_relationships',  label: 'Better Relationships',   icon: 'heart-outline' },
  { id: 'better_mental_health',  label: 'Better Mental Health',   icon: 'happy-outline' },
  { id: 'better_physical_health',label: 'Better Physical Health', icon: 'fitness-outline' },
  { id: 'stronger_discipline',   label: 'Stronger Discipline',    icon: 'shield-outline' },
  { id: 'more_confidence',       label: 'More Confidence',        icon: 'star-outline' },
  { id: 'personal_freedom',      label: 'Personal Freedom',       icon: 'infinite-outline' },
  { id: 'spiritual_growth',      label: 'Spiritual Growth',       icon: 'flower-outline' },
  { id: 'better_sleep',          label: 'Better Sleep',           icon: 'moon-outline' },
  { id: 'become_best_self',      label: 'Become My Best Self',    icon: 'trophy-outline' },
];

export default function AuthOnboardingPurposeScreen() {
  const router = useRouter();
  const { edit } = useLocalSearchParams<{ edit?: string }>();
  const profile = useOnboardingStore();
  const updateProfile = useOnboardingStore((s) => s.updateProfile);

  const [selectedReasons, setSelectedReasons] = useState<ImprovementReason[]>(profile.improvementReasons || []);
  const [primaryOutcome, setPrimaryOutcome] = useState<ImprovementReason | ''>(profile.primaryOutcome || '');
  const [statement, setStatement] = useState(profile.personalStatement || '');
  const [statementFocused, setStatementFocused] = useState(false);

  const toggleReason = (id: ImprovementReason) => {
    setSelectedReasons((prev) => {
      if (prev.includes(id)) {
        const next = prev.filter((r) => r !== id);
        if (primaryOutcome === id) setPrimaryOutcome('');
        return next;
      }
      if (prev.length >= 5) return prev;
      return [...prev, id];
    });
  };

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleContinue = () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    updateProfile({ improvementReasons: selectedReasons, primaryOutcome, personalStatement: statement });
    router.replace({ pathname: '/(auth)/onboarding-triggers', params: edit === 'true' ? { edit: 'true' } : {} } as any);
    setTimeout(() => setIsSubmitting(false), 1000);
  };

  return (
    <View style={styles.container}>
      <View style={styles.ambientGlow1} pointerEvents="none" />
      <View style={styles.ambientGlow2} pointerEvents="none" />
      <LinearGradient colors={['rgba(0,0,0,0.1)', '#000000']} style={styles.fadeOverlay} pointerEvents="none" />
      <Stack.Screen options={{ headerShown: false }} />

      <SafeAreaView style={styles.safeArea} edges={['top','bottom','left','right']}>
        <Animated.View entering={FadeIn.duration(400)} style={styles.mainWrapper}>
          {/* Header */}
          <View style={styles.headerRow}>
            <TouchableOpacity activeOpacity={0.6} style={styles.backButton}
              onPress={() => router.replace({ pathname: '/(auth)/assessment', params: edit === 'true' ? { edit: 'true' } : {} } as any)}>
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
              <LinearGradient colors={['#00A8FF','#0052D4']} start={{x:0,y:0}} end={{x:1,y:0}}
                style={[styles.progressFill, { width: '60%' }]} />
            </View>
            <ThemedText style={styles.progressLabel}>Step 3 of 5</ThemedText>
          </View>

          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <View style={styles.contentContainer}>
              <View style={styles.titleSection}>
                <ThemedText style={styles.stepText}>Your Purpose</ThemedText>
                <ThemedText style={styles.title}>Why Do You Want to Change?</ThemedText>
                <ThemedText style={styles.subtitle}>
                  Choose up to 5 things you want to improve. Remembering your core reason helps you stay strong whenever cravings or temptations happen.
                </ThemedText>
              </View>

              {/* Reason Multi-Select */}
              <View style={styles.fieldBlock}>
                <View style={styles.fieldLabelRow}>
                  <ThemedText style={styles.fieldLabel}>What do you want to improve?</ThemedText>
                  <View style={styles.countBadge}>
                    <ThemedText style={styles.countBadgeText}>{selectedReasons.length}/5</ThemedText>
                  </View>
                </View>
                <View style={styles.cardGrid}>
                  {REASONS.map((r) => {
                    const selected = selectedReasons.includes(r.id);
                    const disabled = !selected && selectedReasons.length >= 5;
                    return (
                      <TouchableOpacity
                        key={r.id}
                        activeOpacity={disabled ? 1 : 0.7}
                        style={[styles.reasonCard, selected && styles.reasonCardSelected, disabled && styles.reasonCardDisabled]}
                        onPress={() => !disabled && toggleReason(r.id)}
                      >
                        <Ionicons name={r.icon as any} size={18} color={selected ? '#00A8FF' : disabled ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.45)'} />
                        <ThemedText style={[styles.reasonCardText, selected && styles.reasonCardTextSelected, disabled && styles.reasonCardTextDisabled]}>
                          {r.label}
                        </ThemedText>
                        {selected && (
                          <View style={styles.checkDot}>
                            <Ionicons name="checkmark" size={10} color="#ffffff" />
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Primary Outcome */}
              {selectedReasons.length > 0 && (
                <View style={styles.fieldBlock}>
                  <ThemedText style={styles.fieldLabel}>Which outcome matters most?</ThemedText>
                  <ThemedText style={styles.fieldHint}>Choose one from your selections above</ThemedText>
                  <View style={styles.chipRow}>
                    {selectedReasons.map((id) => {
                      const r = REASONS.find((x) => x.id === id)!;
                      const active = primaryOutcome === id;
                      return (
                        <TouchableOpacity key={id} activeOpacity={0.7}
                          style={[styles.chip, active && styles.chipActive]}
                          onPress={() => setPrimaryOutcome(id)}
                        >
                          <ThemedText style={[styles.chipText, active && styles.chipTextActive]}>{r.label}</ThemedText>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* Personal Statement */}
              <View style={styles.fieldBlock}>
                <ThemedText style={styles.fieldLabel}>Personal Motivation Note</ThemedText>
                <ThemedText style={styles.fieldHint}>Complete the sentence below to set your motivation:</ThemedText>
                <View style={[styles.inputCard, statementFocused && styles.inputCardFocused]}>
                  <ThemedText style={styles.inputPrefix}>{"\"I want to change because…"}</ThemedText>
                  <TextInput
                    style={styles.textInput}
                    placeholder="enter your main reason"
                    placeholderTextColor="rgba(255,255,255,0.25)"
                    value={statement}
                    onChangeText={(t) => t.length <= 100 && setStatement(t)}
                    multiline
                    onFocus={() => setStatementFocused(true)}
                    onBlur={() => setStatementFocused(false)}
                  />
                </View>
                <View style={styles.charCountRow}>
                  <ThemedText style={styles.charCount}>{statement.length}/100</ThemedText>
                </View>
              </View>

              {/* CTA */}
              <TouchableOpacity activeOpacity={0.85} style={[styles.btnPrimaryContainer, isSubmitting && { opacity: 0.75 }]} onPress={handleContinue} disabled={isSubmitting}>
                <LinearGradient colors={['#00A8FF','#0052D4']} start={{x:0,y:0}} end={{x:1,y:0}} style={styles.btnPrimaryGradient}>
                  {isSubmitting ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                      <ActivityIndicator size="small" color="#ffffff" style={{ marginRight: 8 }} />
                      <ThemedText style={styles.btnPrimaryText}>Saving Purpose...</ThemedText>
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
                <TouchableOpacity onPress={() => router.replace('/(auth)/onboarding-triggers' as any)}>
                  <ThemedText style={styles.footerAction}>Skip Step</ThemedText>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const CARD_WIDTH = (SCREEN_WIDTH - Spacing.four * 2 - 10) / 2;

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
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.four, paddingTop: Spacing.two, height: 50 },
  backButton: { backgroundColor: 'transparent', padding: 4, alignItems: 'center', justifyContent: 'center' },
  logoCenter: { alignItems: 'center' },
  logoText: { fontSize: 22, fontFamily: Platform.select({ ios: 'Didot', android: 'serif', default: 'serif' }), fontWeight: '800', letterSpacing: 2 },
  logoZen: { color: '#ffffff' },
  logoWill: { color: '#00A8FF' },
  progressContainer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.four, paddingTop: 10, gap: 10 },
  progressBar: { flex: 1, height: 3, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 2 },
  progressLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: '600' },
  scrollContent: { flexGrow: 1, alignItems: 'center' },
  contentContainer: { width: '100%', maxWidth: 600, paddingHorizontal: Spacing.four, paddingBottom: Spacing.five, paddingTop: 4 },
  titleSection: { marginTop: Spacing.four, marginBottom: Spacing.four, gap: Spacing.one },
  stepText: { color: '#00A8FF', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  title: { fontSize: 28, fontWeight: '800', color: '#ffffff', letterSpacing: -0.5 },
  subtitle: { fontSize: 14, color: 'rgba(255,255,255,0.45)', lineHeight: 20, marginTop: 2 },
  fieldBlock: { marginBottom: 22 },
  fieldLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  fieldLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: '600', letterSpacing: 0.3 },
  fieldHint: { color: 'rgba(255,255,255,0.3)', fontSize: 12, marginBottom: 10 },
  countBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20, backgroundColor: 'rgba(0,168,255,0.12)', borderWidth: 1, borderColor: 'rgba(0,168,255,0.3)' },
  countBadgeText: { color: '#00A8FF', fontSize: 12, fontWeight: '700' },
  cardGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  reasonCard: {
    flex: 1, minWidth: 140, maxWidth: 280, paddingVertical: 14, paddingHorizontal: 12,
    backgroundColor: '#111215', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14, flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  reasonCardSelected: { borderColor: 'rgba(0,168,255,0.5)', backgroundColor: 'rgba(0,168,255,0.07)' },
  reasonCardDisabled: { opacity: 0.4 },
  reasonCardText: { color: 'rgba(255,255,255,0.55)', fontSize: 12, fontWeight: '500', flex: 1 },
  reasonCardTextSelected: { color: '#00A8FF', fontWeight: '700' },
  reasonCardTextDisabled: { color: 'rgba(255,255,255,0.2)' },
  checkDot: { width: 16, height: 16, borderRadius: 8, backgroundColor: '#00A8FF', alignItems: 'center', justifyContent: 'center' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 24, backgroundColor: '#111215', borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)' },
  chipActive: { backgroundColor: 'rgba(0,168,255,0.12)', borderColor: '#00A8FF' },
  chipText: { color: 'rgba(255,255,255,0.5)', fontSize: 13, fontWeight: '500' },
  chipTextActive: { color: '#00A8FF', fontWeight: '700' },
  inputCard: { backgroundColor: '#111215', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', borderRadius: 16, padding: 16 },
  inputCardFocused: { borderColor: '#00A8FF' },
  inputPrefix: { color: 'rgba(255,255,255,0.4)', fontSize: 13, fontStyle: 'italic', marginBottom: 6 },
  textInput: { color: '#ffffff', fontSize: 15, fontWeight: '500', lineHeight: 22, outlineStyle: 'none' } as any,
  charCountRow: { alignItems: 'flex-end', marginTop: 6 },
  charCount: { color: 'rgba(255,255,255,0.3)', fontSize: 11 },
  btnPrimaryContainer: { borderRadius: 20, overflow: 'hidden', marginTop: 8 },
  btnPrimaryGradient: { paddingVertical: 16 },
  btnPrimaryInner: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  btnPrimaryText: { color: '#ffffff', fontWeight: '700', fontSize: 16, letterSpacing: 0.5 },
  btnArrow: { color: '#ffffff', fontSize: 15, fontWeight: 'bold' },
  footerLinkRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: Spacing.four },
  footerAction: { color: 'rgba(255,255,255,0.4)', fontSize: 14, fontWeight: '600', textDecorationLine: 'underline' },
});
