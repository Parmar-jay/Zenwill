import React, { useState } from 'react';
import {
  StyleSheet, TouchableOpacity, ScrollView, View,
  Platform, TextInput, Dimensions, Alert, ActivityIndicator,
} from 'react-native';
import { useRouter, Stack, useLocalSearchParams } from 'expo-router';
import { useAuthStore } from '@/store/auth-store';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useOnboardingStore, AgeGroup, Gender, Occupation, DailySchedule, RelationshipStatus } from '@/store/onboarding-store';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ── Data ──────────────────────────────────────────────────────────────────────
const AGE_GROUPS: { id: AgeGroup; label: string }[] = [
  { id: 'under_18', label: 'Under 18' },
  { id: '18_24', label: '18–24' },
  { id: '25_34', label: '25–34' },
  { id: '35_44', label: '35–44' },
  { id: '45_plus', label: '45+' },
];

const GENDERS: { id: Gender; label: string }[] = [
  { id: 'male', label: 'Male' },
  { id: 'female', label: 'Female' },
  { id: 'non_binary', label: 'Non-binary' },
  { id: 'prefer_not', label: 'Prefer not to say' },
];

const OCCUPATIONS: { id: Occupation; label: string; icon: string }[] = [
  { id: 'student', label: 'Student', icon: 'school-outline' },
  { id: 'employee', label: 'Employee', icon: 'briefcase-outline' },
  { id: 'business_owner', label: 'Business Owner', icon: 'storefront-outline' },
  { id: 'freelancer', label: 'Freelancer', icon: 'laptop-outline' },
  { id: 'homemaker', label: 'Homemaker', icon: 'home-outline' },
  { id: 'other', label: 'Other', icon: 'ellipsis-horizontal-outline' },
];

const SCHEDULES: { id: DailySchedule; label: string; icon: string }[] = [
  { id: 'early_morning', label: 'Early Morning', icon: 'sunny-outline' },
  { id: 'morning', label: 'Morning', icon: 'partly-sunny-outline' },
  { id: 'afternoon', label: 'Afternoon', icon: 'cloud-outline' },
  { id: 'evening', label: 'Evening', icon: 'moon-outline' },
  { id: 'night_shift', label: 'Night Shift', icon: 'flashlight-outline' },
  { id: 'irregular', label: 'Irregular', icon: 'shuffle-outline' },
];

const RELATIONSHIPS: { id: RelationshipStatus; label: string }[] = [
  { id: 'single', label: 'Single' },
  { id: 'married', label: 'Married' },
  { id: 'in_relationship', label: 'In a Relationship' },
  { id: 'prefer_not', label: 'Prefer not to say' },
];

// Generic chip row
const ChipRow = <T extends string>({
  options,
  selected,
  onSelect,
}: {
  options: { id: T; label: string }[];
  selected: T;
  onSelect: (id: T) => void;
}) => (
  <View style={styles.chipRow}>
    {options.map((o) => {
      const active = selected === o.id;
      return (
        <TouchableOpacity
          key={o.id}
          activeOpacity={0.7}
          style={[styles.chip, active && styles.chipActive]}
          onPress={() => onSelect(o.id)}
        >
          <ThemedText style={[styles.chipText, active && styles.chipTextActive]}>
            {o.label}
          </ThemedText>
        </TouchableOpacity>
      );
    })}
  </View>
);

export default function AuthCreateProfileScreen() {
  const router = useRouter();
  const { edit } = useLocalSearchParams<{ edit?: string }>();
  const profile = useOnboardingStore();
  const updateProfile = useOnboardingStore((s) => s.updateProfile);
  const authUser = useAuthStore((s) => s.user);
  const [firstName, setFirstName] = useState(profile.firstName || authUser?.name || authUser?.email?.split('@')[0] || '');
  const [ageGroup, setAgeGroup] = useState<AgeGroup>(profile.ageGroup || '');
  const [gender, setGender] = useState<Gender>(profile.gender || '');
  const [occupation, setOccupation] = useState<Occupation>(profile.occupation || '');
  const [dailySchedule, setDailySchedule] = useState<DailySchedule>(profile.dailySchedule || '');
  const [relationshipStatus, setRelationshipStatus] = useState<RelationshipStatus>(profile.relationshipStatus || '');
  const [firstNameFocused, setFirstNameFocused] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleContinue = () => {
    if (isSubmitting) return;
    if (!firstName.trim()) {
      Alert.alert('Almost there!', 'Please enter your first name so we can personalise your experience.');
      return;
    }
    setIsSubmitting(true);
    updateProfile({
      firstName: firstName.trim(),
      ageGroup,
      gender,
      occupation,
      dailySchedule,
      relationshipStatus,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });
    router.replace({ pathname: '/(auth)/assessment', params: edit === 'true' ? { edit: 'true' } : {} } as any);
    setTimeout(() => setIsSubmitting(false), 1000);
  };

  return (
    <View style={styles.container}>
      <View style={styles.ambientGlow1} pointerEvents="none" />
      <View style={styles.ambientGlow2} pointerEvents="none" />
      <LinearGradient colors={['rgba(0,0,0,0.1)', '#000000']} style={styles.fadeOverlay} pointerEvents="none" />
      <Stack.Screen options={{ headerShown: false }} />

      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
        <Animated.View entering={FadeIn.duration(400)} style={styles.mainWrapper}>
          {/* Header */}
          <View style={styles.headerRow}>
            <TouchableOpacity
              activeOpacity={0.6}
              style={styles.backButton}
              onPress={() => {
                if (edit === 'true') {
                  useAuthStore.setState({ isOnboarded: true, onboardingStep: 6 });
                  router.replace('/(tabs)/profile' as any);
                } else {
                  router.replace('/(auth)/welcome' as any);
                }
              }}
            >
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

          {/* Progress Bar */}
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <LinearGradient colors={['#00A8FF', '#0052D4']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.progressFill, { width: '20%' }]} />
            </View>
            <ThemedText style={styles.progressLabel}>Step 1 of 5</ThemedText>
          </View>

          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <View style={styles.contentContainer}>
              {/* Title */}
              <View style={styles.titleSection}>
                <ThemedText style={styles.stepText}>Create Profile</ThemedText>
                <ThemedText style={styles.title}>Tell Us About Yourself</ThemedText>
                <ThemedText style={styles.subtitle}>
                  Welcome! Sharing your daily routine helps ZenWill customize your experience and protect you when temptations are most likely to happen.
                </ThemedText>
              </View>

              {/* First Name */}
              <View style={styles.fieldBlock}>
                <ThemedText style={styles.fieldLabel}>First Name</ThemedText>
                <View style={[styles.inputCard, firstNameFocused && styles.inputCardFocused]}>
                  <Ionicons name="person-outline" size={20} color={firstNameFocused ? '#00A8FF' : 'rgba(255,255,255,0.4)'} style={styles.inputIcon} />
                  <TextInput
                    style={styles.textInput}
                    placeholder="Enter your first name"
                    placeholderTextColor="rgba(255,255,255,0.3)"
                    value={firstName}
                    onChangeText={setFirstName}
                    autoCapitalize="words"
                    onFocus={() => setFirstNameFocused(true)}
                    onBlur={() => setFirstNameFocused(false)}
                  />
                </View>
              </View>

              {/* Age Group */}
              <View style={styles.fieldBlock}>
                <ThemedText style={styles.fieldLabel}>Age Group</ThemedText>
                <ChipRow options={AGE_GROUPS} selected={ageGroup} onSelect={setAgeGroup} />
              </View>

              {/* Gender */}
              <View style={styles.fieldBlock}>
                <ThemedText style={styles.fieldLabel}>Gender</ThemedText>
                <ChipRow options={GENDERS} selected={gender} onSelect={setGender} />
              </View>

              {/* Occupation */}
              <View style={styles.fieldBlock}>
                <ThemedText style={styles.fieldLabel}>Occupation / Daily Work</ThemedText>
                <View style={styles.cardGrid}>
                  {OCCUPATIONS.map((o) => {
                    const active = occupation === o.id;
                    return (
                      <TouchableOpacity
                        key={o.id}
                        activeOpacity={0.7}
                        style={[styles.gridCard, active && styles.gridCardActive]}
                        onPress={() => setOccupation(o.id)}
                      >
                        <Ionicons name={o.icon as any} size={22} color={active ? '#00A8FF' : 'rgba(255,255,255,0.45)'} />
                        <ThemedText style={[styles.gridCardText, active && styles.gridCardTextActive]}>{o.label}</ThemedText>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Daily Schedule */}
              <View style={styles.fieldBlock}>
                <ThemedText style={styles.fieldLabel}>Daily Schedule & Free Time</ThemedText>
                <ThemedText style={styles.fieldHint}>
                  Knowing your free time helps ZenWill protect you before cravings start.
                </ThemedText>
                <View style={styles.cardGrid}>
                  {SCHEDULES.map((o) => {
                    const active = dailySchedule === o.id;
                    return (
                      <TouchableOpacity
                        key={o.id}
                        activeOpacity={0.7}
                        style={[styles.gridCard, active && styles.gridCardActive]}
                        onPress={() => setDailySchedule(o.id)}
                      >
                        <Ionicons name={o.icon as any} size={22} color={active ? '#00A8FF' : 'rgba(255,255,255,0.45)'} />
                        <ThemedText style={[styles.gridCardText, active && styles.gridCardTextActive]}>{o.label}</ThemedText>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Relationship Status */}
              <View style={styles.fieldBlock}>
                <ThemedText style={styles.fieldLabel}>Relationship Status</ThemedText>
                <ChipRow options={RELATIONSHIPS} selected={relationshipStatus} onSelect={setRelationshipStatus} />
              </View>

              {/* CTA */}
              <TouchableOpacity activeOpacity={0.85} style={[styles.btnPrimaryContainer, isSubmitting && { opacity: 0.75 }]} onPress={handleContinue} disabled={isSubmitting}>
                <LinearGradient colors={['#00A8FF', '#0052D4']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.btnPrimaryGradient}>
                  {isSubmitting ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                      <ActivityIndicator size="small" color="#ffffff" style={{ marginRight: 8 }} />
                      <ThemedText style={styles.btnPrimaryText}>Saving Profile...</ThemedText>
                    </View>
                  ) : (
                    <View style={styles.btnPrimaryInner}>
                      <ThemedText style={styles.btnPrimaryText}>Continue to Assessment</ThemedText>
                      <ThemedText style={styles.btnArrow}>➔</ThemedText>
                    </View>
                  )}
                </LinearGradient>
              </TouchableOpacity>

              <View style={styles.footerLinkRow}>
                <TouchableOpacity onPress={() => router.replace('/(auth)/assessment' as any)}>
                  <ThemedText style={styles.footerAction}>Skip for now</ThemedText>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
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
  headerRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.four, paddingTop: Spacing.two, height: 50,
  },
  backButton: { backgroundColor: 'transparent', padding: 4, alignItems: 'center', justifyContent: 'center' },
  logoCenter: { alignItems: 'center' },
  logoText: {
    fontSize: 22,
    fontFamily: Platform.select({ ios: 'Didot', android: 'serif', default: 'serif' }),
    fontWeight: '800', letterSpacing: 2,
  },
  logoZen: { color: '#ffffff' },
  logoWill: { color: '#00A8FF' },
  progressContainer: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.four,
    paddingTop: 10, gap: 10,
  },
  progressBar: {
    flex: 1, height: 3, backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 2, overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 2 },
  progressLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: '600' },
  scrollContent: { flexGrow: 1, alignItems: 'center' },
  contentContainer: { width: '100%', maxWidth: 600, paddingHorizontal: Spacing.four, paddingBottom: Spacing.five, paddingTop: 4 },
  titleSection: { marginTop: Spacing.four, marginBottom: Spacing.four, gap: Spacing.one },
  stepText: { color: '#00A8FF', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  title: { fontSize: 28, fontWeight: '800', color: '#ffffff', letterSpacing: -0.5 },
  subtitle: { fontSize: 14, color: 'rgba(255,255,255,0.45)', lineHeight: 20, marginTop: 2 },
  fieldBlock: { marginBottom: 22 },
  fieldLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: '600', marginBottom: 6, letterSpacing: 0.3 },
  fieldHint: { color: 'rgba(255,255,255,0.38)', fontSize: 12, lineHeight: 17, marginBottom: 10 },
  inputCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#111215',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', borderRadius: 16,
    paddingHorizontal: 16, height: 58,
  },
  inputCardFocused: { borderColor: '#00A8FF', backgroundColor: 'rgba(0,168,255,0.01)' },
  inputIcon: { marginRight: 12 },
  textInput: {
    flex: 1, color: '#ffffff', fontSize: 16, fontWeight: '500',
    paddingVertical: 10, outlineStyle: 'none',
  } as any,
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 24,
    backgroundColor: '#111215', borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
  },
  chipActive: { backgroundColor: 'rgba(0,168,255,0.12)', borderColor: '#00A8FF' },
  chipText: { color: 'rgba(255,255,255,0.5)', fontSize: 13, fontWeight: '500' },
  chipTextActive: { color: '#00A8FF', fontWeight: '700' },
  cardGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  gridCard: {
    flex: 1, minWidth: 95, maxWidth: 180,
    paddingVertical: 14, paddingHorizontal: 8,
    backgroundColor: '#111215', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14, alignItems: 'center', gap: 6,
  },
  gridCardActive: { borderColor: 'rgba(0,168,255,0.5)', backgroundColor: 'rgba(0,168,255,0.06)' },
  gridCardText: { color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '500', textAlign: 'center' },
  gridCardTextActive: { color: '#00A8FF', fontWeight: '700' },
  btnPrimaryContainer: { borderRadius: 20, overflow: 'hidden', marginTop: 8 },
  btnPrimaryGradient: { paddingVertical: 16 },
  btnPrimaryInner: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  btnPrimaryText: { color: '#ffffff', fontWeight: '700', fontSize: 16, letterSpacing: 0.5 },
  btnArrow: { color: '#ffffff', fontSize: 15, fontWeight: 'bold' },
  footerLinkRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: Spacing.four },
  footerAction: { color: 'rgba(255,255,255,0.4)', fontSize: 14, fontWeight: '600', textDecorationLine: 'underline' },
});
