import React, { useState, useRef, useMemo } from 'react';
import {
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  View,
  Platform,
  TextInput,
  Animated,
  Easing,
  useWindowDimensions,
  ActivityIndicator,
} from 'react-native';
import { useRouter, Stack, useFocusEffect } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useHabitStore } from '@/store/habit-store';
import { useDailyMissionStore } from '@/store/daily-mission-store';
import { mindApi, CheckinPayload } from '@/services/mind-api';
import { PageEntrance } from '@/components/ui/smooth-loader';

const triggerHaptic = (style = Haptics.ImpactFeedbackStyle.Light) => {
  try {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(style);
    }
  } catch (error) {
    // Silent catch
  }
};

const ROTATING_QUESTIONS = [
  "What helped you stay disciplined today?",
  "What made today difficult?",
  "What are you grateful for today?",
  "What would you do differently tomorrow?",
  "What was your biggest win today?",
  "Which trigger tested your resolve the most today?",
];

export default function DailyCheckinScreen() {
  const router = useRouter();
  const { width: windowWidth } = useWindowDimensions();

  const { logDay } = useHabitStore();

  useFocusEffect(
    React.useCallback(() => {
      useHabitStore.getState().syncFromDatabase();
    }, [])
  );

  // Step wizard state (1 to 7)
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isCompletedAnim, setIsCompletedAnim] = useState<boolean>(false);

  // Animated Step Transition & Progress Loader
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(1 / 7)).current;
  const completeScale = useRef(new Animated.Value(0.3)).current;

  React.useEffect(() => {
    const target = isSubmitting || isCompletedAnim ? 1 : currentStep / 7;
    Animated.timing(progressAnim, {
      toValue: target,
      duration: isSubmitting || isCompletedAnim ? 400 : 250,
      useNativeDriver: false,
      easing: Easing.out(Easing.ease),
    }).start();
  }, [currentStep, isSubmitting, isCompletedAnim]);

  // ── Form State ─────────────────────────────────────────────────────────────
  // Screen 1: Mood
  const [mood, setMood] = useState<string>('Calm');
  const [moodIntensity, setMoodIntensity] = useState<number>(7);
  const [selectedMoodFactors, setSelectedMoodFactors] = useState<string[]>([]);

  // Screen 2: Energy
  const [energyScore, setEnergyScore] = useState<number>(7);
  const [selectedEnergyFactors, setSelectedEnergyFactors] = useState<string[]>([]);

  // Screen 3: Stress
  const [stressScore, setStressScore] = useState<number>(3);
  const [selectedStressCauses, setSelectedStressCauses] = useState<string[]>([]);

  // Screen 4: Sleep
  const [sleepDuration, setSleepDuration] = useState<number>(7.5);
  const [sleepQuality, setSleepQuality] = useState<number>(8);
  const [restedStatus, setRestedStatus] = useState<string>('Yes');

  // Screen 5: Urges
  const [urgeIntensity, setUrgeIntensity] = useState<number>(0);
  const [selectedTriggers, setSelectedTriggers] = useState<string[]>([]);
  const [actionTaken, setActionTaken] = useState<string>('No'); // No, Almost, Yes
  const [pornographyInvolved, setPornographyInvolved] = useState<boolean>(false);
  const [sessionDuration, setSessionDuration] = useState<string>('< 15 mins');
  const [selectedPostEmotions, setSelectedPostEmotions] = useState<string[]>([]);

  // Screen 6: Focus
  const [focusScore, setFocusScore] = useState<number>(7);
  const [selectedFocusFactors, setSelectedFocusFactors] = useState<string[]>([]);

  // Screen 7: Reflection
  const todayQuestionIndex = useMemo(() => {
    const day = new Date().getDate();
    return day % ROTATING_QUESTIONS.length;
  }, []);
  const reflectionQuestion = ROTATING_QUESTIONS[todayQuestionIndex];
  const [reflectionText, setReflectionText] = useState<string>('');

  // Energy Category derived from score
  const energyCategory = useMemo(() => {
    if (energyScore <= 2) return 'Very Low';
    if (energyScore <= 4) return 'Low';
    if (energyScore <= 6) return 'Normal';
    if (energyScore <= 8) return 'Good';
    return 'Excellent';
  }, [energyScore]);

  // Options Data
  const moodOptions = [
    { label: 'Happy', icon: 'happy-outline' as const, color: '#10B981' },
    { label: 'Calm', icon: 'leaf-outline' as const, color: '#06B6D4' },
    { label: 'Neutral', icon: 'disc-outline' as const, color: '#6366F1' },
    { label: 'Sad', icon: 'cloud-outline' as const, color: '#3B82F6' },
    { label: 'Angry', icon: 'flame-outline' as const, color: '#EF4444' },
    { label: 'Anxious', icon: 'pulse-outline' as const, color: '#F59E0B' },
    { label: 'Lonely', icon: 'moon-outline' as const, color: '#8B5CF6' },
    { label: 'Overwhelmed', icon: 'alert-circle-outline' as const, color: '#EC4899' },
    { label: 'Frustrated', icon: 'thunderstorm-outline' as const, color: '#F97316' },
  ];

  const moodFactorOptions = [
    'Work', 'Studies', 'Family', 'Relationship', 'Financial Pressure',
    'Health', 'Sleep', 'Social Media', 'Addiction', 'Other'
  ];

  const energyFactorOptions = [
    'Poor Sleep', 'Heavy Workload', 'Exercise', 'Stress', 'Illness', 'Healthy Routine', 'Other'
  ];

  const stressCauseOptions = [
    'Work', 'Studies', 'Family', 'Relationship', 'Money',
    'Health', 'Loneliness', 'Future', 'Addiction Recovery', 'Other'
  ];

  const triggerOptions = [
    'Boredom', 'Stress', 'Loneliness', 'Social Media', 'Instagram',
    'YouTube', 'Movies', 'Sexual Thoughts', 'Night Time', 'Being Alone',
    'Poor Sleep', 'Anxiety', 'Other'
  ];

  const postEmotionOptions = [
    'Guilty', 'Ashamed', 'Empty', 'Relieved', 'Motivated to Restart', 'Neutral'
  ];

  const focusFactorOptions = [
    'Social Media', 'Phone Usage', 'Stress', 'Poor Sleep',
    'Lack of Motivation', 'Workload', 'Studies', 'Good Routine', 'Other'
  ];

  const durationOptions = ['< 15 mins', '15-30 mins', '30-60 mins', '1+ hour'];

  // Toggle Chip Selections
  const toggleSelection = (item: string, currentList: string[], setList: (val: string[]) => void) => {
    triggerHaptic();
    if (currentList.includes(item)) {
      setList(currentList.filter((i) => i !== item));
    } else {
      setList([...currentList, item]);
    }
  };

  // Step Transition Animation Helper
  const animateStep = (direction: 'next' | 'back', callback: () => void) => {
    const toValue = direction === 'next' ? -20 : 20;
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue, duration: 150, useNativeDriver: true }),
    ]).start(() => {
      callback();
      slideAnim.setValue(direction === 'next' ? 20 : -20);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 200, useNativeDriver: true, easing: Easing.out(Easing.ease) }),
      ]).start();
    });
  };

  const handleNextStep = async () => {
    triggerHaptic();
    if (currentStep === 7) {
      await handleCompleteCheckin();
    } else if (currentStep < 7) {
      animateStep('next', () => setCurrentStep(currentStep + 1));
    }
  };

  const handleBackStep = () => {
    triggerHaptic();
    if (currentStep > 1) {
      animateStep('back', () => setCurrentStep(currentStep - 1));
    } else {
      if (router.canGoBack()) {
        router.back();
      } else {
        router.navigate('/(tabs)/home' as any);
      }
    }
  };

  const handleCompleteCheckin = async () => {
    if (isSubmitting || isCompletedAnim) return;
    setIsSubmitting(true);
    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);

    const relapseOccurred = actionTaken === 'Yes';

    const payload: CheckinPayload = {
      mood,
      mood_intensity: moodIntensity,
      mood_factors: selectedMoodFactors,
      energy_score: energyScore,
      energy_category: energyCategory,
      energy_factors: selectedEnergyFactors,
      stress_score: stressScore,
      stress_causes: selectedStressCauses,
      sleep_duration: sleepDuration,
      sleep_quality: sleepQuality,
      rested_status: restedStatus,
      urge_intensity: urgeIntensity,
      primary_triggers: selectedTriggers,
      action_taken: actionTaken,
      relapse_occurred: relapseOccurred,
      pornography_involved: relapseOccurred ? pornographyInvolved : undefined,
      session_duration: relapseOccurred ? sessionDuration : undefined,
      post_relapse_emotions: relapseOccurred ? selectedPostEmotions : [],
      focus_score: focusScore,
      focus_factors: selectedFocusFactors,
      reflection_question: reflectionQuestion,
      reflection_response: reflectionText.trim() || undefined,
    };

    // Update local habit store for relapse reset if relapse occurred
    if (relapseOccurred) {
      logDay(false);
    }
    useDailyMissionStore.getState().completeTask('checkin');

    try {
      await mindApi.submitCheckin(payload);
      useHabitStore.getState().syncFromDatabase().catch(() => {});
    } catch (error) {
      console.log('Checkin submit notice (handled locally):', error);
    } finally {
      useHabitStore.getState().syncFromDatabase().catch(() => {});
      setIsSubmitting(false);
      setIsCompletedAnim(true);

      triggerHaptic(Haptics.ImpactFeedbackStyle.Heavy);

      Animated.spring(completeScale, {
        toValue: 1,
        friction: 4,
        tension: 50,
        useNativeDriver: true,
      }).start();

      setTimeout(() => {
        if (router.canGoBack()) {
          router.back();
        } else {
          router.navigate('/(tabs)/home' as any);
        }
      }, 500);
    }
  };

  return (
    <LinearGradient colors={['#000000', '#000000', '#000000']} style={styles.gradientBg}>
      <Stack.Screen options={{ headerShown: false }} />

      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
        {/* Header Bar with Progress */}
        <View style={styles.headerBar}>
          <TouchableOpacity
            style={styles.backBtn}
            activeOpacity={0.8}
            onPress={handleBackStep}
          >
            <Ionicons name="chevron-back" size={24} color="#00E5FF" />
          </TouchableOpacity>

          <View style={styles.headerTitleContainer}>
            <ThemedText style={styles.headerCategory}>DAILY PROTOCOL</ThemedText>
            <ThemedText style={styles.headerTitle}>Step {currentStep} of 7</ThemedText>
          </View>

          {/* Clean spacer replacing old Skip/Finish button */}
          <View style={{ width: 36 }} />
        </View>

        {/* Progress Bar Indicator with smooth Animated fill */}
        <View style={styles.progressTrack}>
          <Animated.View
            style={[
              styles.progressFill,
              {
                width: progressAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0%', '100%'],
                }),
              },
            ]}
          >
            <LinearGradient
              colors={['#6366F1', '#3B82F6', '#10B981']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{ flex: 1 }}
            />
          </Animated.View>
        </View>

        {/* Animated Wizard Body */}
        <PageEntrance style={{ flex: 1 }}>
          <Animated.View
            style={[
              styles.wizardContainer,
              { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
            ]}
          >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* ──────────────── SCREEN 1: MOOD ──────────────── */}
            {currentStep === 1 && (
              <View style={styles.stepCard}>
                <View style={styles.stepTitleRow}>
                  <View style={[styles.stepIconBox, { backgroundColor: 'rgba(99, 102, 241, 0.15)', borderColor: '#6366F1' }]}>
                    <Ionicons name="happy-outline" size={20} color="#6366F1" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <ThemedText style={styles.stepNumberLabel}>SCREEN 1 OF 7</ThemedText>
                    <ThemedText style={styles.stepTitle}>How are you feeling right now?</ThemedText>
                  </View>
                </View>

                {/* Mood Selectable Emotions */}
                <ThemedText style={styles.sectionSublabel}>Select your primary emotion</ThemedText>
                <View style={styles.emotionGrid}>
                  {moodOptions.map((item) => (
                    <TouchableOpacity
                      key={item.label}
                      style={[
                        styles.emotionChip,
                        mood === item.label && { backgroundColor: `${item.color}20`, borderColor: item.color, borderWidth: 1.5 },
                      ]}
                      onPress={() => {
                        triggerHaptic();
                        setMood(item.label);
                      }}
                    >
                      <Ionicons name={item.icon} size={16} color={mood === item.label ? item.color : 'rgba(255, 255, 255, 0.4)'} />
                      <ThemedText style={[styles.emotionChipText, mood === item.label && { color: '#ffffff', fontWeight: '700' }]}>
                        {item.label}
                      </ThemedText>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Intensity Rating (1-10) */}
                <ThemedText style={[styles.sectionSublabel, { marginTop: 12 }]}>
                  Mood Intensity: <ThemedText style={{ color: '#6366F1', fontWeight: '800' }}>{moodIntensity}/10</ThemedText>
                </ThemedText>
                <View style={styles.scaleRow}>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                    <TouchableOpacity
                      key={num}
                      style={[
                        styles.scalePill,
                        moodIntensity === num && { backgroundColor: '#6366F1', borderColor: '#6366F1' },
                      ]}
                      onPress={() => {
                        triggerHaptic();
                        setMoodIntensity(num);
                      }}
                    >
                      <ThemedText style={[styles.scaleText, moodIntensity === num && { color: '#ffffff', fontWeight: '800' }]}>
                        {num}
                      </ThemedText>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Influencing Factors */}
                <ThemedText style={[styles.sectionSublabel, { marginTop: 12 }]}>Contributing Factors</ThemedText>
                <View style={styles.chipWrap}>
                  {moodFactorOptions.map((factor) => {
                    const isSelected = selectedMoodFactors.includes(factor);
                    return (
                      <TouchableOpacity
                        key={factor}
                        style={[styles.smallTag, isSelected && styles.smallTagActive]}
                        onPress={() => toggleSelection(factor, selectedMoodFactors, setSelectedMoodFactors)}
                      >
                        <ThemedText style={[styles.smallTagText, isSelected && styles.smallTagTextActive]}>
                          {factor}
                        </ThemedText>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {/* ──────────────── SCREEN 2: ENERGY ──────────────── */}
            {currentStep === 2 && (
              <View style={styles.stepCard}>
                <View style={styles.stepTitleRow}>
                  <View style={[styles.stepIconBox, { backgroundColor: 'rgba(16, 185, 129, 0.15)', borderColor: '#10B981' }]}>
                    <Ionicons name="flash-outline" size={20} color="#10B981" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <ThemedText style={styles.stepNumberLabel}>SCREEN 2 OF 7</ThemedText>
                    <ThemedText style={styles.stepTitle}>What is your energy level?</ThemedText>
                  </View>
                </View>

                {/* Dynamic Energy Category Pill */}
                <View style={styles.energyBadgeBox}>
                  <View>
                    <ThemedText style={styles.sectionSublabel}>Energy Category</ThemedText>
                    <ThemedText style={styles.energyCategoryText}>{energyCategory}</ThemedText>
                  </View>
                  <ThemedText style={styles.energyScoreText}>{energyScore}/10</ThemedText>
                </View>

                {/* Energy Rating Scale (1-10) */}
                <ThemedText style={[styles.sectionSublabel, { marginTop: 12 }]}>Rate your energy (1 to 10)</ThemedText>
                <View style={styles.scaleRow}>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                    <TouchableOpacity
                      key={num}
                      style={[
                        styles.scalePill,
                        energyScore === num && { backgroundColor: '#10B981', borderColor: '#10B981' },
                      ]}
                      onPress={() => {
                        triggerHaptic();
                        setEnergyScore(num);
                      }}
                    >
                      <ThemedText style={[styles.scaleText, energyScore === num && { color: '#ffffff', fontWeight: '800' }]}>
                        {num}
                      </ThemedText>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Energy Factors */}
                <ThemedText style={[styles.sectionSublabel, { marginTop: 12 }]}>Reasons for this energy level</ThemedText>
                <View style={styles.chipWrap}>
                  {energyFactorOptions.map((factor) => {
                    const isSelected = selectedEnergyFactors.includes(factor);
                    return (
                      <TouchableOpacity
                        key={factor}
                        style={[styles.smallTag, isSelected && { backgroundColor: 'rgba(16, 185, 129, 0.2)', borderColor: '#10B981' }]}
                        onPress={() => toggleSelection(factor, selectedEnergyFactors, setSelectedEnergyFactors)}
                      >
                        <ThemedText style={[styles.smallTagText, isSelected && { color: '#ffffff', fontWeight: '700' }]}>
                          {factor}
                        </ThemedText>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {/* ──────────────── SCREEN 3: STRESS ──────────────── */}
            {currentStep === 3 && (
              <View style={styles.stepCard}>
                <View style={styles.stepTitleRow}>
                  <View style={[styles.stepIconBox, { backgroundColor: 'rgba(245, 158, 11, 0.15)', borderColor: '#F59E0B' }]}>
                    <Ionicons name="pulse-outline" size={20} color="#F59E0B" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <ThemedText style={styles.stepNumberLabel}>SCREEN 3 OF 7</ThemedText>
                    <ThemedText style={styles.stepTitle}>How stressed do you feel?</ThemedText>
                  </View>
                </View>

                {/* Stress Rating (1-10) */}
                <ThemedText style={styles.sectionSublabel}>
                  Stress Level: <ThemedText style={{ color: '#F59E0B', fontWeight: '800' }}>{stressScore}/10</ThemedText>
                </ThemedText>
                <View style={styles.scaleRow}>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                    <TouchableOpacity
                      key={num}
                      style={[
                        styles.scalePill,
                        stressScore === num && { backgroundColor: '#F59E0B', borderColor: '#F59E0B' },
                      ]}
                      onPress={() => {
                        triggerHaptic();
                        setStressScore(num);
                      }}
                    >
                      <ThemedText style={[styles.scaleText, stressScore === num && { color: '#ffffff', fontWeight: '800' }]}>
                        {num}
                      </ThemedText>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Conditional Causes if Stress >= 4 */}
                {stressScore >= 4 && (
                  <View style={styles.conditionalBox}>
                    <ThemedText style={styles.conditionalTitle}>What is causing your stress?</ThemedText>
                    <View style={[styles.chipWrap, { marginTop: 6 }]}>
                      {stressCauseOptions.map((cause) => {
                        const isSelected = selectedStressCauses.includes(cause);
                        return (
                          <TouchableOpacity
                            key={cause}
                            style={[styles.smallTag, isSelected && { backgroundColor: 'rgba(245, 158, 11, 0.25)', borderColor: '#F59E0B' }]}
                            onPress={() => toggleSelection(cause, selectedStressCauses, setSelectedStressCauses)}
                          >
                            <ThemedText style={[styles.smallTagText, isSelected && { color: '#ffffff', fontWeight: '700' }]}>
                              {cause}
                            </ThemedText>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                )}
              </View>
            )}

            {/* ──────────────── SCREEN 4: SLEEP ──────────────── */}
            {currentStep === 4 && (
              <View style={styles.stepCard}>
                <View style={styles.stepTitleRow}>
                  <View style={[styles.stepIconBox, { backgroundColor: 'rgba(59, 130, 246, 0.15)', borderColor: '#3B82F6' }]}>
                    <Ionicons name="moon-outline" size={20} color="#3B82F6" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <ThemedText style={styles.stepNumberLabel}>SCREEN 4 OF 7</ThemedText>
                    <ThemedText style={styles.stepTitle}>How was your sleep last night?</ThemedText>
                  </View>
                </View>

                {/* Sleep Duration */}
                <ThemedText style={styles.sectionSublabel}>
                  Sleep Duration: <ThemedText style={{ color: '#3B82F6', fontWeight: '800' }}>{sleepDuration} hours</ThemedText>
                </ThemedText>
                <View style={styles.scaleRow}>
                  {[4, 5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 10].map((hrs) => (
                    <TouchableOpacity
                      key={hrs}
                      style={[
                        styles.scalePill,
                        sleepDuration === hrs && { backgroundColor: '#3B82F6', borderColor: '#3B82F6' },
                      ]}
                      onPress={() => {
                        triggerHaptic();
                        setSleepDuration(hrs);
                      }}
                    >
                      <ThemedText style={[styles.scaleText, sleepDuration === hrs && { color: '#ffffff', fontWeight: '800' }]}>
                        {hrs}h
                      </ThemedText>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Sleep Quality */}
                <ThemedText style={[styles.sectionSublabel, { marginTop: 12 }]}>
                  Sleep Quality: <ThemedText style={{ color: '#3B82F6', fontWeight: '800' }}>{sleepQuality}/10</ThemedText>
                </ThemedText>
                <View style={styles.scaleRow}>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                    <TouchableOpacity
                      key={num}
                      style={[
                        styles.scalePill,
                        sleepQuality === num && { backgroundColor: '#3B82F6', borderColor: '#3B82F6' },
                      ]}
                      onPress={() => {
                        triggerHaptic();
                        setSleepQuality(num);
                      }}
                    >
                      <ThemedText style={[styles.scaleText, sleepQuality === num && { color: '#ffffff', fontWeight: '800' }]}>
                        {num}
                      </ThemedText>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Rested Status */}
                <ThemedText style={[styles.sectionSublabel, { marginTop: 12 }]}>Did you wake up feeling refreshed?</ThemedText>
                <View style={styles.optionRow3}>
                  {['Yes', 'Partially', 'No'].map((status) => (
                    <TouchableOpacity
                      key={status}
                      style={[
                        styles.optionBtn3,
                        restedStatus === status && { backgroundColor: 'rgba(59, 130, 246, 0.25)', borderColor: '#3B82F6' },
                      ]}
                      onPress={() => {
                        triggerHaptic();
                        setRestedStatus(status);
                      }}
                    >
                      <ThemedText style={[styles.optionBtn3Text, restedStatus === status && { color: '#ffffff', fontWeight: '700' }]}>
                        {status}
                      </ThemedText>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* ──────────────── SCREEN 5: URGES ──────────────── */}
            {currentStep === 5 && (
              <View style={styles.stepCard}>
                <View style={styles.stepTitleRow}>
                  <View style={[styles.stepIconBox, { backgroundColor: 'rgba(239, 68, 68, 0.15)', borderColor: '#EF4444' }]}>
                    <Ionicons name="shield-outline" size={20} color="#EF4444" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <ThemedText style={styles.stepNumberLabel}>SCREEN 5 OF 7</ThemedText>
                    <ThemedText style={styles.stepTitle}>Urges & Trigger Control</ThemedText>
                  </View>
                </View>

                {/* Urge Intensity (0-10) */}
                <ThemedText style={styles.sectionSublabel}>
                  Urge Intensity: <ThemedText style={{ color: '#EF4444', fontWeight: '800' }}>{urgeIntensity}/10</ThemedText>
                </ThemedText>
                <View style={styles.scaleRow}>
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                    <TouchableOpacity
                      key={num}
                      style={[
                        styles.scalePill,
                        urgeIntensity === num && { backgroundColor: '#EF4444', borderColor: '#EF4444' },
                      ]}
                      onPress={() => {
                        triggerHaptic();
                        setUrgeIntensity(num);
                      }}
                    >
                      <ThemedText style={[styles.scaleText, urgeIntensity === num && { color: '#ffffff', fontWeight: '800' }]}>
                        {num}
                      </ThemedText>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Triggers */}
                <ThemedText style={[styles.sectionSublabel, { marginTop: 12 }]}>Primary Triggers Today</ThemedText>
                <View style={styles.chipWrap}>
                  {triggerOptions.map((trig) => {
                    const isSelected = selectedTriggers.includes(trig);
                    return (
                      <TouchableOpacity
                        key={trig}
                        style={[styles.smallTag, isSelected && { backgroundColor: 'rgba(239, 68, 68, 0.25)', borderColor: '#EF4444' }]}
                        onPress={() => toggleSelection(trig, selectedTriggers, setSelectedTriggers)}
                      >
                        <ThemedText style={[styles.smallTagText, isSelected && { color: '#ffffff', fontWeight: '700' }]}>
                          {trig}
                        </ThemedText>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Action Taken (Relapse / Retained) */}
                <ThemedText style={[styles.sectionSublabel, { marginTop: 12 }]}>Did you engage in any relapse behavior?</ThemedText>
                <View style={styles.optionRow3}>
                  {[
                    { label: 'No', sub: 'Retained' },
                    { label: 'Almost', sub: 'Urge Beat' },
                    { label: 'Yes', sub: 'Relapsed' },
                  ].map((item) => (
                    <TouchableOpacity
                      key={item.label}
                      style={[
                        styles.optionBtn3,
                        actionTaken === item.label && {
                          backgroundColor: item.label === 'No' ? 'rgba(16, 185, 129, 0.25)' : item.label === 'Almost' ? 'rgba(245, 158, 11, 0.25)' : 'rgba(239, 68, 68, 0.25)',
                          borderColor: item.label === 'No' ? '#10B981' : item.label === 'Almost' ? '#F59E0B' : '#EF4444',
                        },
                      ]}
                      onPress={() => {
                        triggerHaptic();
                        setActionTaken(item.label);
                      }}
                    >
                      <ThemedText style={[styles.optionBtn3Text, actionTaken === item.label && { color: '#ffffff', fontWeight: '800' }]}>
                        {item.label}
                      </ThemedText>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Conditional Relapse Details if Action Taken === 'Yes' */}
                {actionTaken === 'Yes' && (
                  <View style={styles.relapseDetailsBox}>
                    <ThemedText style={styles.relapseHeader}>RELAPSE DETAILS (HONEST RETROSPECTIVE)</ThemedText>
                    
                    <ThemedText style={styles.subTextSmall}>Pornography involved?</ThemedText>
                    <View style={styles.optionRow2}>
                      <TouchableOpacity
                        style={[styles.optionBtn2, pornographyInvolved && styles.optionBtn2Active]}
                        onPress={() => setPornographyInvolved(true)}
                      >
                        <ThemedText style={[styles.optionBtn2Text, pornographyInvolved && styles.optionBtn2TextActive]}>Yes</ThemedText>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.optionBtn2, !pornographyInvolved && styles.optionBtn2Active]}
                        onPress={() => setPornographyInvolved(false)}
                      >
                        <ThemedText style={[styles.optionBtn2Text, !pornographyInvolved && styles.optionBtn2TextActive]}>No</ThemedText>
                      </TouchableOpacity>
                    </View>

                    <ThemedText style={[styles.subTextSmall, { marginTop: 6 }]}>Session Duration</ThemedText>
                    <View style={styles.chipWrap}>
                      {durationOptions.map((dur) => (
                        <TouchableOpacity
                          key={dur}
                          style={[styles.smallTag, sessionDuration === dur && { backgroundColor: 'rgba(239, 68, 68, 0.3)', borderColor: '#EF4444' }]}
                          onPress={() => setSessionDuration(dur)}
                        >
                          <ThemedText style={[styles.smallTagText, sessionDuration === dur && { color: '#ffffff', fontWeight: '700' }]}>
                            {dur}
                          </ThemedText>
                        </TouchableOpacity>
                      ))}
                    </View>

                    {/* Launch Forensic Relapse Autopsy */}
                    <TouchableOpacity
                      style={styles.launchAutopsyBtn}
                      activeOpacity={0.85}
                      onPress={() => {
                        triggerHaptic();
                        router.push('/relapse-autopsy' as any);
                      }}
                    >
                      <Ionicons name="git-network-outline" size={14} color="#00E5FF" style={{ marginRight: 6 }} />
                      <ThemedText style={styles.launchAutopsyBtnText}>Launch Forensic Relapse Autopsy</ThemedText>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}

            {/* ──────────────── SCREEN 6: FOCUS ──────────────── */}
            {currentStep === 6 && (
              <View style={styles.stepCard}>
                <View style={styles.stepTitleRow}>
                  <View style={[styles.stepIconBox, { backgroundColor: 'rgba(6, 182, 212, 0.15)', borderColor: '#06B6D4' }]}>
                    <Ionicons name="disc-outline" size={20} color="#06B6D4" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <ThemedText style={styles.stepNumberLabel}>SCREEN 6 OF 7</ThemedText>
                    <ThemedText style={styles.stepTitle}>Mental Focus & Clarity</ThemedText>
                  </View>
                </View>

                {/* Focus Score (1-10) */}
                <ThemedText style={styles.sectionSublabel}>
                  Focus Rating: <ThemedText style={{ color: '#06B6D4', fontWeight: '800' }}>{focusScore}/10</ThemedText>
                </ThemedText>
                <View style={styles.scaleRow}>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                    <TouchableOpacity
                      key={num}
                      style={[
                        styles.scalePill,
                        focusScore === num && { backgroundColor: '#06B6D4', borderColor: '#06B6D4' },
                      ]}
                      onPress={() => {
                        triggerHaptic();
                        setFocusScore(num);
                      }}
                    >
                      <ThemedText style={[styles.scaleText, focusScore === num && { color: '#ffffff', fontWeight: '800' }]}>
                        {num}
                      </ThemedText>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Focus Factors */}
                <ThemedText style={[styles.sectionSublabel, { marginTop: 12 }]}>Focus Influencers</ThemedText>
                <View style={styles.chipWrap}>
                  {focusFactorOptions.map((factor) => {
                    const isSelected = selectedFocusFactors.includes(factor);
                    return (
                      <TouchableOpacity
                        key={factor}
                        style={[styles.smallTag, isSelected && { backgroundColor: 'rgba(6, 182, 212, 0.25)', borderColor: '#06B6D4' }]}
                        onPress={() => toggleSelection(factor, selectedFocusFactors, setSelectedFocusFactors)}
                      >
                        <ThemedText style={[styles.smallTagText, isSelected && { color: '#ffffff', fontWeight: '700' }]}>
                          {factor}
                        </ThemedText>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {/* ──────────────── SCREEN 7: REFLECTION ──────────────── */}
            {currentStep === 7 && (
              <View style={styles.stepCard}>
                <View style={styles.stepTitleRow}>
                  <View style={[styles.stepIconBox, { backgroundColor: 'rgba(168, 85, 247, 0.15)', borderColor: '#A855F7' }]}>
                    <Ionicons name="sparkles-outline" size={20} color="#A855F7" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <ThemedText style={styles.stepNumberLabel}>SCREEN 7 OF 7 (FINAL)</ThemedText>
                    <ThemedText style={styles.stepTitle}>Daily Mind Reflection</ThemedText>
                  </View>
                </View>

                <View style={styles.reflectionPromptCard}>
                  <Ionicons name="chatbox-ellipses-outline" size={18} color="#A855F7" />
                  <ThemedText style={styles.reflectionPromptText}>{reflectionQuestion}</ThemedText>
                </View>

                <ThemedText style={[styles.sectionSublabel, { marginTop: 12 }]}>Your Thoughts (Optional)</ThemedText>
                <TextInput
                  style={styles.textArea}
                  placeholder="Write a brief reflection to complete your daily check-in..."
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  multiline
                  numberOfLines={4}
                  value={reflectionText}
                  onChangeText={setReflectionText}
                />
              </View>
            )}
          </ScrollView>
        </Animated.View>
      </PageEntrance>

        {/* Bottom Navigation Buttons */}
        <View style={styles.footerNav}>
          <TouchableOpacity
            style={styles.navBackBtn}
            onPress={handleBackStep}
          >
            <Ionicons name="chevron-back" size={18} color="rgba(255,255,255,0.7)" />
            <ThemedText style={styles.navBackText}>Back</ThemedText>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.navNextBtn,
              (currentStep === 7 || isCompletedAnim) && { backgroundColor: '#10B981' },
            ]}
            activeOpacity={0.88}
            onPress={handleNextStep}
            disabled={isSubmitting || isCompletedAnim}
          >
            {isCompletedAnim ? (
              <Animated.View style={[{ transform: [{ scale: completeScale }] }, styles.navNextContent]}>
                <Ionicons name="checkmark-circle" size={16} color="#ffffff" />
                <ThemedText style={styles.navNextText}>Done!</ThemedText>
              </Animated.View>
            ) : isSubmitting ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <View style={styles.navNextContent}>
                <ThemedText style={styles.navNextText}>
                  {currentStep === 7 ? 'Complete' : 'Next'}
                </ThemedText>
                <Ionicons name={currentStep === 7 ? "checkmark" : "arrow-forward"} size={16} color="#ffffff" />
              </View>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradientBg: { flex: 1 },
  safeArea: { flex: 1 },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  backBtn: {
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 4,
  },
  headerTitleContainer: {
    alignItems: 'center',
  },
  headerCategory: {
    fontSize: 9,
    fontWeight: '800',
    color: '#6366F1',
    letterSpacing: 1.5,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#ffffff',
    marginTop: 1,
  },
  skipBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  skipBtnText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.5)',
    fontWeight: '600',
  },
  progressTrack: {
    height: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    width: '100%',
  },
  progressFill: {
    height: '100%',
  },
  wizardContainer: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.four,
    paddingBottom: 40,
  },
  stepCard: {
    backgroundColor: 'rgba(15, 17, 26, 0.95)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 14,
    gap: 10,
  },
  stepTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 2,
  },
  stepIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepNumberLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: 'rgba(255, 255, 255, 0.4)',
    letterSpacing: 1.2,
  },
  stepTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#ffffff',
    marginTop: 1,
  },
  sectionSublabel: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.6)',
  },
  emotionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  emotionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  emotionChipText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.65)',
  },
  scaleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
  },
  scalePill: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scaleText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.6)',
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  smallTag: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  smallTagActive: {
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    borderColor: '#6366F1',
  },
  smallTagText: {
    fontSize: 11.5,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  smallTagTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  energyBadgeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  energyScoreText: {
    fontSize: 20,
    fontWeight: '900',
    color: '#10B981',
  },
  energyCategoryText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
  conditionalBox: {
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.25)',
    padding: 12,
    marginTop: 6,
  },
  conditionalTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#F59E0B',
  },
  optionRow3: {
    flexDirection: 'row',
    gap: 6,
  },
  optionBtn3: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionBtn3Text: {
    fontSize: 11.5,
    color: 'rgba(255, 255, 255, 0.6)',
    textAlign: 'center',
  },
  relapseDetailsBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    padding: 12,
    gap: 6,
    marginTop: 8,
  },
  relapseHeader: {
    fontSize: 9.5,
    fontWeight: '900',
    color: '#EF4444',
    letterSpacing: 1.2,
  },
  subTextSmall: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.7)',
  },
  optionRow2: {
    flexDirection: 'row',
    gap: 6,
  },
  optionBtn2: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingVertical: 8,
    alignItems: 'center',
  },
  optionBtn2Active: {
    backgroundColor: 'rgba(239, 68, 68, 0.25)',
    borderColor: '#EF4444',
  },
  optionBtn2Text: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  optionBtn2TextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  launchAutopsyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 229, 255, 0.12)',
    borderColor: 'rgba(0, 229, 255, 0.35)',
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 9,
    marginTop: 8,
  },
  launchAutopsyBtnText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#00E5FF',
    letterSpacing: 0.3,
  },
  reflectionPromptCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(168, 85, 247, 0.12)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.3)',
    padding: 12,
  },
  reflectionPromptText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
    flex: 1,
  },
  textArea: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 12,
    color: '#ffffff',
    fontSize: 13,
    minHeight: 90,
    textAlignVertical: 'top',
  },
  footerNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: '#000000',
  },
  navBackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  navBackText: {
    fontSize: 12.5,
    color: 'rgba(255, 255, 255, 0.7)',
    fontWeight: '600',
  },
  navNextBtn: {
    minWidth: 120,
    minHeight: 44,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#6366F1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  navNextContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  navNextText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#ffffff',
    textAlign: 'center',
  },
});
