import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  View,
  Text,
  Platform,
  Modal,
  Image,
  Animated,
  useWindowDimensions,
  LayoutAnimation,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useDailyMissionStore } from '@/store/daily-mission-store';
import { useHabitStore } from '@/store/habit-store';
import { analyticsApi, getCachedRecommendations } from '@/services/analytics-api';
import { meditationApi, MeditationStats } from '@/services/meditation-api';
import { YOGIC_PRACTICES, YogicTechnique, EMERGENCY_SOS_SEQUENCE } from '@/constants/practices';
import { PageEntrance } from '@/components/ui/smooth-loader';
import { omSoundManager, MEDITATION_TUNES, MeditationTune } from '@/utils/audio-player';
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

export default function MeditationScreen() {
  const router = useRouter();
  const { width: windowWidth } = useWindowDimensions();
  const isTablet = windowWidth > 600;

  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [activeTechnique, setActiveTechnique] = useState<YogicTechnique | null>(null);

  // Detail Modal State
  const [isDetailModalVisible, setIsDetailModalVisible] = useState<boolean>(false);

  // Session Player Modal & State
  const [isPlayerVisible, setIsPlayerVisible] = useState<boolean>(false);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [roundCount, setRoundCount] = useState<number>(1);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(300);
  const [stepTimer, setStepTimer] = useState<number>(4);

  // Sacred Om Sound State for Meditation
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [selectedTune, setSelectedTune] = useState<MeditationTune>(MEDITATION_TUNES[0]);

  // Start Timestamp for accurate logging
  const sessionStartTimeRef = useRef<Date | null>(null);

  // User Meditation Stats from Database
  const [meditationStats, setMeditationStats] = useState<MeditationStats | null>(null);

  // Visualizer Animation
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(0.6)).current;

  // Completion Modal State
  const [isCompletedModalVisible, setIsCompletedModalVisible] = useState<boolean>(false);
  const [completedSummary, setCompletedSummary] = useState<any>(null);

  const categories = ['All', 'Pranayama', 'Devotional & Mantra', 'Emergency Reset', 'Focus & Gita'];

  const filteredPractices = YOGIC_PRACTICES.filter(
    (p) => selectedCategory === 'All' || p.category === selectedCategory
  );

  const [recommendedData, setRecommendedData] = useState<any>(null);

  const loadStats = async () => {
    try {
      const data = await meditationApi.getStats();
      if (data) setMeditationStats(data);
    } catch (_) {}
  };

  useEffect(() => {
    loadStats();
    const cached = getCachedRecommendations();
    if (cached) setRecommendedData(cached);

    analyticsApi.getRecommendations()
      .then((res: any) => {
        if (res) setRecommendedData(res);
      })
      .catch(() => {});
  }, []);

  const currentHour = useMemo(() => new Date().getHours(), []);
  const timeContextLabel = useMemo(() => {
    if (currentHour < 12) return 'Morning Protocol';
    if (currentHour < 18) return 'Afternoon Protocol';
    return 'Evening Deep Calm';
  }, [currentHour]);

  const recommendedPractice = useMemo(() => {
    const recKey = recommendedData?.recommended_meditation?.technique_id || '';
    const found = YOGIC_PRACTICES.find((p) => p.id === recKey || (recKey === 'krishna-meditation' && p.id === 'krishna-centered-meditation'));
    if (found) return found;

    // Fallback based on time of day
    if (currentHour < 12) return YOGIC_PRACTICES[0]; // Nadi Shodhana (Morning Clarity)
    if (currentHour < 18) return YOGIC_PRACTICES[1]; // Bhramari (Midday Reset)
    return YOGIC_PRACTICES[1]; // Bhramari (Evening Calm)
  }, [recommendedData, currentHour]);

  const recommendedReason = useMemo(() => {
    return recommendedData?.recommended_meditation?.reason || recommendedPractice.purpose;
  }, [recommendedData, recommendedPractice]);

  const handleOpenDetail = (technique: YogicTechnique) => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
    setActiveTechnique(technique);
    setIsDetailModalVisible(true);
  };

  const handleStartSession = (technique: YogicTechnique) => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
    sessionStartTimeRef.current = new Date();
    const initialTune = omSoundManager.getTuneForTechnique(technique.id);
    setSelectedTune(initialTune);
    omSoundManager.setTune(initialTune);
    setActiveTechnique(technique);
    setSecondsRemaining(technique.durationMinutes * 60);
    setCurrentStepIndex(0);
    setRoundCount(1);
    setStepTimer(technique.steps[0]?.durationSec || 10);
    setIsDetailModalVisible(false);
    setIsPlaying(true);
    setIsPlayerVisible(true);
  };

  // Timer loop & Step animation
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isPlaying && secondsRemaining > 0) {
      interval = setInterval(() => {
        setSecondsRemaining((prev) => {
          if (prev <= 1) {
            setIsPlaying(false);
            triggerHaptic(Haptics.ImpactFeedbackStyle.Heavy);
            return 0;
          }
          return prev - 1;
        });

        setStepTimer((prevStepTime) => {
          if (prevStepTime <= 1) {
            // Advance to next step in technique
            if (activeTechnique && activeTechnique.steps.length > 0) {
              let nextIndex = currentStepIndex + 1;
              if (nextIndex >= activeTechnique.steps.length) {
                // Loop back to step 1 (first breathing step after mandatory setup index 0)
                nextIndex = activeTechnique.steps.length > 1 ? 1 : 0;
                setRoundCount((r) => r + 1);
              }
              try {
                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              } catch (_) {}
              setCurrentStepIndex(nextIndex);
              triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
              return activeTechnique.steps[nextIndex]?.durationSec || 4;
            }
            return 4;
          }
          return prevStepTime - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isPlaying, secondsRemaining, currentStepIndex, activeTechnique]);

  // Breathing Circle Pulse & Phase Animation
  useEffect(() => {
    if (isPlaying && activeTechnique) {
      const currentStep = activeTechnique.steps[currentStepIndex];
      const phase = currentStep?.phase || 'inhale';
      const durMs = (currentStep?.durationSec || 4) * 1000;

      if (phase === 'inhale') {
        Animated.timing(scaleAnim, {
          toValue: 1.35,
          duration: durMs,
          useNativeDriver: true,
        }).start();
      } else if (phase === 'pause') {
        Animated.timing(scaleAnim, {
          toValue: 1.35,
          duration: durMs,
          useNativeDriver: true,
        }).start();
      } else if (phase === 'exhale') {
        Animated.timing(scaleAnim, {
          toValue: 1.0,
          duration: durMs,
          useNativeDriver: true,
        }).start();
      } else if (phase === 'rest') {
        Animated.timing(scaleAnim, {
          toValue: 1.05,
          duration: durMs,
          useNativeDriver: true,
        }).start();
      } else {
        Animated.timing(scaleAnim, {
          toValue: 1.0,
          duration: durMs,
          useNativeDriver: true,
        }).start();
      }

      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 2000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 0.6,
            duration: 2000,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      scaleAnim.stopAnimation();
      pulseAnim.stopAnimation();
    }
  }, [isPlaying, currentStepIndex, activeTechnique]);

  // Handle Continuous Ambient / Sacred Sound for All Practices (Dirgha, Krishna-Centered, Bhramari, Nadi Shodhana, Ajapa Japa)
  // Starts after seating posture setup step (step 0) completes and stays on till meditation finishes
  useEffect(() => {
    const hasAudioSupport = Boolean(activeTechnique);
    if (isPlayerVisible && hasAudioSupport) {
      const isSeatingPostureFinished = currentStepIndex > 0 || !activeTechnique?.steps[currentStepIndex]?.isMandatorySetup;
      if (isSeatingPostureFinished && isPlaying) {
        omSoundManager.play();
      } else {
        omSoundManager.pause();
      }
    } else {
      omSoundManager.stopAndUnload();
    }
  }, [isPlayerVisible, activeTechnique?.id, currentStepIndex, isPlaying, isMuted]);

  // Clean up audio when player modal closes or unmounts
  useEffect(() => {
    if (!isPlayerVisible) {
      omSoundManager.stopAndUnload();
    }
  }, [isPlayerVisible]);

  const formatTime = (totalSecs: number) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const handleFinishSession = async () => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Heavy);
    omSoundManager.stopAndUnload();
    const now = new Date();
    const startedAt = sessionStartTimeRef.current || new Date(now.getTime() - (activeTechnique?.durationMinutes || 5) * 60000);
    const durationSec = activeTechnique ? Math.max(activeTechnique.durationMinutes * 60 - secondsRemaining, 30) : 300;
    const durationMin = Math.round((durationSec / 60) * 10) / 10;
    const executedSteps = activeTechnique ? activeTechnique.steps.map((s) => s.title) : [];

    // 1. Direct MongoDB Logging via Dedicated Meditation API
    try {
      await meditationApi.logSession({
        technique_id: activeTechnique?.id || 'meditation',
        technique_title: activeTechnique?.title || 'Meditation Practice',
        category: activeTechnique?.category || 'Pranayama',
        duration_seconds: durationSec,
        duration_minutes: durationMin,
        rounds_completed: roundCount,
        completed: true,
        started_at: startedAt.toISOString(),
        completed_at: now.toISOString(),
        emotional_state: 'calm',
        rating: activeTechnique?.rating || 5,
        steps_performed: executedSteps,
        metadata: {
          difficulty: activeTechnique?.difficulty,
          source: activeTechnique?.source,
        },
      });
    } catch (_) {}

    // 2. Behavioral Telemetry Logging
    analyticsApi.logEvent({
      event_type: 'meditation_session',
      screen_name: 'meditation_screen',
      feature_name: activeTechnique?.title || 'Meditation Practice',
      duration_seconds: durationSec,
      outcome: 'completed',
      emotional_state: 'calm',
      metadata: {
        technique_id: activeTechnique?.id,
        technique_title: activeTechnique?.title,
        category: activeTechnique?.category,
        duration_minutes: durationMin,
        difficulty: activeTechnique?.difficulty,
        completed: true,
      },
    }).catch(() => {});

    // 3. Mark Daily Mission Complete & Sync Mind Strength
    useDailyMissionStore.getState().completeTask('meditation');
    useHabitStore.getState().syncFromDatabase().catch(() => {});
    loadStats();

    setCompletedSummary({
      title: activeTechnique?.title || 'Meditation Practice',
      durationMinutes: durationMin,
      rounds: roundCount,
      timestamp: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    });

    setIsPlayerVisible(false);
    setIsCompletedModalVisible(true);
  };


  const renderStars = (rating: number) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <Ionicons
          key={i}
          name={i <= rating ? 'star' : 'star-outline'}
          size={13}
          color={i <= rating ? '#F59E0B' : 'rgba(255,255,255,0.2)'}
        />
      );
    }
    return <View style={styles.starRow}>{stars}</View>;
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
            onPress={() => {
              triggerHaptic();
              if (router.canGoBack()) {
                router.back();
              } else {
                router.navigate('/(tabs)/home' as any);
              }
            }}
          >
            <Ionicons name="chevron-back" size={24} color="#00E5FF" />
          </TouchableOpacity>

          <View style={{ alignItems: 'center', flex: 1 }}>
            <ThemedText style={styles.categoryBadge}>VEDIC & YOGIC PRACTICES</ThemedText>
            <ThemedText style={styles.headerTitle}>Meditation & Breathing</ThemedText>
          </View>

          <View style={{ width: 36 }} />
        </View>

        <PageEntrance style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          
          {/* Dynamic Featured / Recommended Practice Card */}
          <TouchableOpacity
            style={styles.heroCard}
            activeOpacity={0.92}
            onPress={() => handleOpenDetail(recommendedPractice)}
          >
            <Image
              source={recommendedPractice.image}
              style={styles.heroImageBg}
              resizeMode="cover"
            />
            <LinearGradient
              colors={['rgba(5, 6, 9, 0.35)', 'rgba(5, 6, 9, 0.75)', 'rgba(5, 6, 9, 0.98)']}
              style={styles.heroGradientOverlay}
            >
              <View style={styles.heroTopRow}>
                <View style={styles.heroBadge}>
                  <Ionicons name="sparkles" size={11} color="#00E5FF" />
                  <ThemedText style={styles.heroBadgeText} numberOfLines={1}>
                    RECOMMENDED • {timeContextLabel.toUpperCase()}
                  </ThemedText>
                </View>
                <View style={styles.heroRatingWrap}>
                  {renderStars(recommendedPractice.rating)}
                </View>
              </View>

              <View style={styles.heroTextSection}>
                <View style={styles.heroTitleRow}>
                  <ThemedText style={styles.heroTitle} numberOfLines={1}>
                    {recommendedPractice.title}
                  </ThemedText>
                  <ThemedText style={styles.heroSanskrit} numberOfLines={1}>
                    • {recommendedPractice.sanskritTitle}
                  </ThemedText>
                </View>
                <ThemedText style={styles.heroSubtitle} numberOfLines={2}>
                  {recommendedReason}
                </ThemedText>
              </View>

              <View style={styles.heroFooter}>
                <View style={styles.sourceTag}>
                  <Ionicons name="book-outline" size={11} color="rgba(255,255,255,0.6)" />
                  <ThemedText style={styles.sourceTagText} numberOfLines={1}>
                    {recommendedPractice.source}
                  </ThemedText>
                </View>

                <TouchableOpacity
                  style={styles.heroPlayBtn}
                  activeOpacity={0.85}
                  onPress={() => handleStartSession(recommendedPractice)}
                >
                  <Ionicons name="play" size={13} color="#000000" />
                  <ThemedText style={styles.heroPlayText}>Start Session</ThemedText>
                </TouchableOpacity>
              </View>
            </LinearGradient>
          </TouchableOpacity>

          {/* User Lifetime Meditation Stats Strip */}
          {meditationStats && (
            <View style={styles.statsStripContainer}>
              <View style={styles.statBox}>
                <ThemedText style={styles.statValue}>{meditationStats.total_sessions}</ThemedText>
                <ThemedText style={styles.statLabel}>SESSIONS</ThemedText>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statBox}>
                <ThemedText style={styles.statValue}>{meditationStats.total_minutes}m</ThemedText>
                <ThemedText style={styles.statLabel}>MINUTES</ThemedText>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statBox}>
                <ThemedText style={styles.statValue}>{meditationStats.total_days_meditated}d</ThemedText>
                <ThemedText style={styles.statLabel}>DISCIPLINE</ThemedText>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statBox}>
                <ThemedText style={styles.statValue} numberOfLines={1}>
                  {meditationStats.favorite_technique.split(' ')[0]}
                </ThemedText>
                <ThemedText style={styles.statLabel}>TOP FOCUS</ThemedText>
              </View>
            </View>
          )}

          {/* Category Filters */}
          <View style={styles.categorySection}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRow}>
              {categories.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[
                    styles.catChip,
                    selectedCategory === cat && styles.catChipActive,
                  ]}
                  onPress={() => {
                    triggerHaptic();
                    setSelectedCategory(cat);
                  }}
                >
                  <ThemedText style={[styles.catChipText, selectedCategory === cat && styles.catChipTextActive]}>
                    {cat}
                  </ThemedText>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Practices Cards List */}
          <View style={styles.librarySection}>
            <View style={styles.sectionHeaderRow}>
              <ThemedText style={styles.sectionTitle}>Curated Practices</ThemedText>
              <ThemedText style={styles.sectionCount}>{filteredPractices.length} Sessions Available</ThemedText>
            </View>

            <View style={styles.practicesList}>
              {filteredPractices.map((technique) => (
                <TouchableOpacity
                  key={technique.id}
                  style={styles.practiceCard}
                  activeOpacity={0.88}
                  onPress={() => handleOpenDetail(technique)}
                >
                  <View style={styles.cardHeaderRow}>
                    <View style={styles.cardImageContainer}>
                      <Image source={technique.image} style={styles.cardThumbImage} resizeMode="cover" />
                      <View style={[styles.colorGlowOverlay, { backgroundColor: `${technique.color}25` }]} />
                    </View>

                    <View style={styles.cardMainText}>
                      <View style={styles.cardTitleRow}>
                        <ThemedText style={styles.cardTitle}>{technique.title}</ThemedText>
                      </View>
                      <ThemedText style={styles.cardSanskrit}>{technique.sanskritTitle}</ThemedText>
                      
                      <View style={styles.cardMetaRow}>
                        {renderStars(technique.rating)}
                        <View style={styles.metaDivider} />
                        <View style={styles.durationChip}>
                          <Ionicons name="time-outline" size={11} color="rgba(255,255,255,0.5)" />
                          <ThemedText style={styles.durationChipText}>{technique.durationText}</ThemedText>
                        </View>
                        <View style={styles.difficultyChip}>
                          <ThemedText style={styles.difficultyText}>{technique.difficulty}</ThemedText>
                        </View>
                      </View>
                    </View>
                  </View>

                  <View style={styles.cardSourceRow}>
                    <Ionicons name="bookmark-outline" size={12} color={technique.color} />
                    <ThemedText style={styles.sourceText}>Source: {technique.source}</ThemedText>
                  </View>

                  <ThemedText style={styles.purposeText} numberOfLines={2}>
                    {technique.purpose}
                  </ThemedText>

                  {/* Situation Chips */}
                  <View style={styles.useWhenContainer}>
                    <ThemedText style={styles.useWhenLabel}>Use when:</ThemedText>
                    <View style={styles.tagWrap}>
                      {technique.useWhen.map((tag) => (
                        <View key={tag} style={styles.tagChip}>
                          <ThemedText style={styles.tagChipText}>{tag}</ThemedText>
                        </View>
                      ))}
                    </View>
                  </View>

                  {/* Footer Action */}
                  <View style={styles.cardFooterRow}>
                    <TouchableOpacity
                      style={[styles.detailBtn, { borderColor: `${technique.color}50`, backgroundColor: 'transparent' }]}
                      activeOpacity={0.8}
                      onPress={() => handleOpenDetail(technique)}
                    >
                      <Ionicons name="information-circle-outline" size={14} color={technique.color} />
                      <ThemedText style={[styles.detailBtnText, { color: technique.color }]}>How to Practice</ThemedText>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.startBtn, { backgroundColor: technique.color }]}
                      activeOpacity={0.88}
                      onPress={() => handleStartSession(technique)}
                    >
                      <Ionicons name="play" size={13} color="#ffffff" />
                      <ThemedText style={styles.startBtnText}>Start Practice</ThemedText>
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>

        </ScrollView>
      </PageEntrance>
      </SafeAreaView>

      {/* Technique Detail & Step-by-Step Preparation Modal */}
      <Modal
        visible={isDetailModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsDetailModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <SafeAreaView style={styles.detailContainer}>
            {activeTechnique && (
              <ScrollView contentContainerStyle={styles.detailScroll} showsVerticalScrollIndicator={false}>
                <View style={styles.detailHeaderRow}>
                  <TouchableOpacity
                    style={styles.closeBtn}
                    onPress={() => setIsDetailModalVisible(false)}
                  >
                    <Ionicons name="close" size={22} color="#ffffff" />
                  </TouchableOpacity>
                  <ThemedText style={styles.detailCategory}>{activeTechnique.category}</ThemedText>
                  <View style={{ width: 38 }} />
                </View>

                <View style={styles.detailHeroBox}>
                  <Image source={activeTechnique.image} style={styles.detailHeroImg} resizeMode="cover" />
                  <LinearGradient
                    colors={['transparent', 'rgba(10, 12, 18, 0.95)']}
                    style={styles.detailHeroOverlay}
                  >
                    {renderStars(activeTechnique.rating)}
                    <ThemedText style={styles.detailTitle}>{activeTechnique.title}</ThemedText>
                    <ThemedText style={styles.detailSanskrit}>{activeTechnique.sanskritTitle}</ThemedText>
                  </LinearGradient>
                </View>

                {/* Source & Specs Container */}
                <View style={styles.specsContainer}>
                  {/* Top: Origin & Scriptural Tradition */}
                  <View style={styles.specSourceCard}>
                    <View style={styles.specSourceHeader}>
                      <Ionicons name="book-outline" size={13} color={activeTechnique.color} />
                      <ThemedText style={[styles.specLabel, { color: activeTechnique.color }]}>
                        TRADITIONAL SOURCE
                      </ThemedText>
                    </View>
                    <ThemedText style={styles.specSourceValue}>
                      {activeTechnique.source}
                    </ThemedText>
                  </View>

                  {/* Bottom: Side-by-Side Duration & Difficulty */}
                  <View style={styles.specsRow}>
                    <View style={styles.specBox}>
                      <View style={styles.specBoxHeader}>
                        <Ionicons name="time-outline" size={13} color="#F59E0B" />
                        <ThemedText style={styles.specLabel}>DURATION</ThemedText>
                      </View>
                      <ThemedText style={styles.specValue}>{activeTechnique.durationText}</ThemedText>
                    </View>

                    <View style={styles.specBox}>
                      <View style={styles.specBoxHeader}>
                        <Ionicons name="options-outline" size={13} color="#10B981" />
                        <ThemedText style={styles.specLabel}>DIFFICULTY</ThemedText>
                      </View>
                      <ThemedText style={styles.specValue}>{activeTechnique.difficulty}</ThemedText>
                    </View>
                  </View>
                </View>

                {/* ── 1. STEP-BY-STEP PRACTICE PROTOCOL (WHAT & HOW TO PERFORM) ── */}
                <View style={styles.detailSection}>
                  <View style={styles.sectionHeaderFlex}>
                    <Ionicons name="list-circle" size={20} color={activeTechnique.color} />
                    <ThemedText style={styles.detailSectionTitle}>How to Perform (Step-by-Step)</ThemedText>
                  </View>
                  <ThemedText style={styles.protocolIntroText}>
                    Review all steps below carefully. Once you understand the sequence, posture, and breath timings, click 'I Understand' to start your practice.
                  </ThemedText>

                  <View style={styles.protocolStepsList}>
                    {activeTechnique.steps.map((step, sIdx) => {
                      const isSetup = step.isMandatorySetup;
                      return (
                        <View
                          key={sIdx}
                          style={[
                            styles.protocolStepCard,
                            isSetup && styles.protocolStepCardSetup,
                          ]}
                        >
                          <View style={styles.protocolStepHeader}>
                            <View
                              style={[
                                styles.stepBadgeNumber,
                                { backgroundColor: isSetup ? '#F59E0B' : activeTechnique.color },
                              ]}
                            >
                              <ThemedText style={styles.stepBadgeNumberText}>{sIdx + 1}</ThemedText>
                            </View>
                            <View style={{ flex: 1, marginLeft: 10 }}>
                              <ThemedText style={styles.protocolStepTitle}>{step.title}</ThemedText>
                              <View style={styles.protocolStepSubRow}>
                                {step.phase && (
                                  <View style={styles.phasePill}>
                                    <ThemedText style={styles.phasePillText}>{step.phase.toUpperCase()}</ThemedText>
                                  </View>
                                )}
                                {step.durationSec ? (
                                  <ThemedText style={styles.protocolStepDurationText}>
                                    ⏱️ {step.durationSec}s Duration
                                  </ThemedText>
                                ) : null}
                              </View>
                            </View>
                          </View>

                          <ThemedText style={styles.protocolStepDesc}>{step.description}</ThemedText>

                          {step.visualCue && (
                            <View style={styles.protocolVisualCueBox}>
                              <Ionicons name="eye-outline" size={12} color="#38BDF8" style={{ marginRight: 5 }} />
                              <ThemedText style={styles.protocolVisualCueText}>
                                Focus: {step.visualCue}
                              </ThemedText>
                            </View>
                          )}
                        </View>
                      );
                    })}
                  </View>
                </View>

                {/* Purpose Section */}
                <View style={styles.detailSection}>
                  <ThemedText style={styles.detailSectionTitle}>Purpose & Core Philosophy</ThemedText>
                  <ThemedText style={styles.detailBodyText}>{activeTechnique.purpose}</ThemedText>
                </View>

                {/* Benefits Section */}
                <View style={styles.detailSection}>
                  <ThemedText style={styles.detailSectionTitle}>Scientifically & Yogically Proven Benefits</ThemedText>
                  <View style={styles.benefitsList}>
                    {activeTechnique.benefits.map((benefit, idx) => (
                      <View key={idx} style={styles.benefitRow}>
                        <View style={[styles.benefitDot, { backgroundColor: activeTechnique.color }]} />
                        <ThemedText style={styles.benefitText}>{benefit}</ThemedText>
                      </View>
                    ))}
                  </View>
                </View>

                {/* Gita Verse if Krishna Centered */}
                {activeTechnique.gitaVerse && (
                  <View style={styles.gitaBox}>
                    <View style={styles.gitaHeader}>
                      <Ionicons name="flower-outline" size={16} color="#06B6D4" />
                      <ThemedText style={styles.gitaChapter}>{activeTechnique.gitaVerse.chapter}</ThemedText>
                    </View>
                    <ThemedText style={styles.gitaSanskrit}>{activeTechnique.gitaVerse.sanskrit}</ThemedText>
                    <ThemedText style={styles.gitaTranslation}>"{activeTechnique.gitaVerse.translation}"</ThemedText>
                  </View>
                )}

                {/* Mantra Text if Ajapa Japa */}
                {activeTechnique.mantraText && (
                  <View style={styles.mantraBox}>
                    <ThemedText style={styles.mantraLabel}>Sacred Mantra Focus:</ThemedText>
                    <ThemedText style={styles.mantraTextDisplay}>{activeTechnique.mantraText}</ThemedText>
                  </View>
                )}

                {/* Best Recommended Use Cases */}
                <View style={styles.detailSection}>
                  <ThemedText style={styles.detailSectionTitle}>Recommended Use Cases</ThemedText>
                  <View style={styles.tagWrap}>
                    {activeTechnique.useWhen.map((tag) => (
                      <View key={tag} style={styles.tagChipLarge}>
                        <Ionicons name="checkmark-circle-outline" size={12} color={activeTechnique.color} />
                        <ThemedText style={styles.tagChipLargeText}>{tag}</ThemedText>
                      </View>
                    ))}
                  </View>
                </View>

                {/* Confirmation CTA to Start Practice */}
                <TouchableOpacity
                  style={[styles.startSessionLargeBtn, { backgroundColor: activeTechnique.color }]}
                  activeOpacity={0.88}
                  onPress={() => handleStartSession(activeTechnique)}
                >
                  <Ionicons name="checkmark-circle" size={20} color="#ffffff" />
                  <ThemedText style={styles.startSessionLargeText}>I Understand the Steps • Begin Meditation</ThemedText>
                </TouchableOpacity>

              </ScrollView>
            )}
          </SafeAreaView>
        </View>
      </Modal>

      {/* Built-in Interactive Player Modal with All Steps Timeline */}
      <Modal
        visible={isPlayerVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsPlayerVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <SafeAreaView style={styles.playerContainer}>
            {activeTechnique && (
              <>
                {/* Player Header */}
                <View style={styles.playerHeader}>
                  <TouchableOpacity
                    style={styles.closeBtn}
                    onPress={() => setIsPlayerVisible(false)}
                  >
                    <Ionicons name="close" size={22} color="#ffffff" />
                  </TouchableOpacity>

                  <View style={{ alignItems: 'center' }}>
                    <ThemedText style={styles.playerCategoryText}>{activeTechnique.sanskritTitle}</ThemedText>
                    <ThemedText style={styles.playerHeaderTitle}>{activeTechnique.title}</ThemedText>
                  </View>

                  <TouchableOpacity
                    style={styles.closeBtn}
                    onPress={handleFinishSession}
                  >
                    <Ionicons name="checkmark-done" size={20} color="#10B981" />
                  </TouchableOpacity>
                </View>

                <ScrollView contentContainerStyle={styles.playerMain} showsVerticalScrollIndicator={false}>

                  {/* Read-First Notice Banner */}
                  <View style={styles.readFirstNoticeBanner}>
                    <Ionicons name="book-outline" size={16} color="#38BDF8" />
                    <ThemedText style={styles.readFirstNoticeText}>
                      Read all practice steps below to understand the full sequence before or during your breathing exercise.
                    </ThemedText>
                  </View>

                  {/* Ambient / Sacred Sound Indicator for Practices */}
                  {activeTechnique && (
                    currentStepIndex === 0 && activeTechnique.steps[0]?.isMandatorySetup ? (
                      <View style={styles.omWaitingBanner}>
                        <Ionicons name="sparkles" size={14} color="#F59E0B" />
                        <ThemedText style={styles.omWaitingText}>
                          Sacred ambient sound will begin automatically after seating posture setup.
                        </ThemedText>
                      </View>
                    ) : (
                      <View style={styles.omActiveBar}>
                        <View style={styles.omActiveLeft}>
                          <View style={styles.omPulsingDot} />
                          <Ionicons name={isMuted ? "volume-mute" : "musical-notes"} size={13} color="#F59E0B" />
                          <ThemedText style={styles.omActiveText} numberOfLines={1}>
                            {isMuted ? "Muted" : `${selectedTune.frequency} • ${selectedTune.name.split(' ')[0]}`}
                          </ThemedText>
                        </View>
                        <TouchableOpacity
                          style={styles.omMuteBtn}
                          activeOpacity={0.8}
                          onPress={async () => {
                            triggerHaptic();
                            const nextMuted = !isMuted;
                            setIsMuted(nextMuted);
                            await omSoundManager.setMuted(nextMuted);
                          }}
                        >
                          <Ionicons name={isMuted ? "volume-mute" : "volume-high"} size={12} color="#ffffff" />
                          <ThemedText style={styles.omMuteText}>{isMuted ? "Unmute" : "Mute"}</ThemedText>
                        </TouchableOpacity>
                      </View>
                    )
                  )}

                  {/* Galaxy Particle Breathing Visualization */}
                  <View style={styles.playerCircleContainer}>
                    <BreathingParticles
                      phase={activeTechnique.steps[currentStepIndex]?.visualCue || 'Breathe'}
                      subtitle={formatTime(secondsRemaining)}
                      color={activeTechnique.color || '#00F5D4'}
                      isRunning={isPlaying}
                      size={260}
                    />
                  </View>

                  {/* Overall Timeline Progress Bar */}
                  <View style={styles.timelineProgressTrack}>
                    <View
                      style={[
                        styles.timelineProgressFill,
                        {
                          width: `${((currentStepIndex + 1) / activeTechnique.steps.length) * 100}%`,
                          backgroundColor: activeTechnique.color,
                        },
                      ]}
                    />
                  </View>

                  {/* Timeline Header Row with Round Counter */}
                  <View style={styles.timelineHeaderRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Ionicons name="list-outline" size={16} color={activeTechnique.color} />
                      <ThemedText style={styles.timelineSectionTitle}>PRACTICE STEPS TIMELINE</ThemedText>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <View style={[styles.roundBadge, { backgroundColor: `${activeTechnique.color}20`, borderColor: `${activeTechnique.color}40` }]}>
                        <Ionicons name="repeat-outline" size={12} color={activeTechnique.color} />
                        <ThemedText style={[styles.roundBadgeText, { color: activeTechnique.color }]}>
                          Round {roundCount}
                        </ThemedText>
                      </View>
                      <ThemedText style={styles.timelineStepCount}>
                        Step {currentStepIndex + 1} of {activeTechnique.steps.length}
                      </ThemedText>
                    </View>
                  </View>

                  {/* ALL STEPS TIMELINE DISPLAY (ALL STEPS VISIBLE AT ONCE) */}
                  <View style={styles.allStepsTimelineContainer}>
                    {/* Vertical Connector Line */}
                    <View style={styles.timelineVerticalLine} />

                    {activeTechnique.steps.map((step, idx) => {
                      const isActive = idx === currentStepIndex;
                      const isPast = idx < currentStepIndex;

                      return (
                        <TouchableOpacity
                          key={idx}
                          activeOpacity={0.88}
                          style={[
                            styles.timelineStepCard,
                            isActive && [styles.timelineStepCardActive, { borderColor: activeTechnique.color }],
                            isPast && styles.timelineStepCardPast,
                          ]}
                          onPress={() => {
                            triggerHaptic();
                            try {
                              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                            } catch (_) {}
                            setCurrentStepIndex(idx);
                            setStepTimer(step.durationSec || 4);
                          }}
                        >
                          {/* Timeline Left Node Dot with Perfectly Centered Number */}
                          <View
                            style={[
                              styles.timelineNodeDot,
                              isActive && [styles.timelineNodeDotActive, { borderColor: activeTechnique.color, backgroundColor: activeTechnique.color }],
                              isPast && styles.timelineNodeDotPast,
                            ]}
                          >
                            {isPast ? (
                              <Ionicons name="checkmark" size={14} color="#ffffff" style={{ alignSelf: 'center' }} />
                            ) : (
                              <Text style={[styles.timelineNodeText, isActive && { color: '#ffffff' }]}>
                                {idx + 1}
                              </Text>
                            )}
                          </View>

                          {/* Step Content: Title & Status Badges Only */}
                          <View style={styles.timelineStepContent}>
                            <View style={styles.timelineStepMainCol}>
                              <ThemedText style={[styles.timelineStepTitle, isActive && { color: '#ffffff', fontWeight: '800' }]}>
                                {step.title}
                              </ThemedText>

                              <View style={styles.timelineStepSubRow}>
                                {step.isMandatorySetup && (
                                  <View style={styles.mandatoryBadge}>
                                    <Ionicons name="shield-checkmark" size={10} color="#F59E0B" />
                                    <ThemedText style={styles.mandatoryBadgeText}>POSTURE</ThemedText>
                                  </View>
                                )}
                                {step.visualCue && (
                                  <View style={[styles.cuePill, { backgroundColor: `${activeTechnique.color}20` }]}>
                                    <ThemedText style={[styles.cuePillText, { color: activeTechnique.color }]}>
                                      {step.visualCue}
                                    </ThemedText>
                                  </View>
                                )}
                              </View>
                            </View>

                            {isActive && (
                              <View style={[styles.activePill, { backgroundColor: activeTechnique.color }]}>
                                <ThemedText style={styles.activePillText}>Active • {stepTimer}s</ThemedText>
                              </View>
                            )}
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {/* Mantra Card if present */}
                  {activeTechnique.mantraText && (
                    <View style={styles.playerMantraCard}>
                      <ThemedText style={styles.playerMantraLabel}>Mental Mantra Repeat:</ThemedText>
                      <ThemedText style={styles.playerMantraContent}>{activeTechnique.mantraText}</ThemedText>
                    </View>
                  )}

                  {/* Gita Verse Card if present */}
                  {activeTechnique.gitaVerse && (
                    <View style={styles.playerGitaCard}>
                      <ThemedText style={styles.playerGitaHeader}>{activeTechnique.gitaVerse.chapter}</ThemedText>
                      <ThemedText style={styles.playerGitaVerse}>{activeTechnique.gitaVerse.sanskrit}</ThemedText>
                      <ThemedText style={styles.gitaTranslation}>"{activeTechnique.gitaVerse.translation}"</ThemedText>
                    </View>
                  )}

                  {/* Player Controls */}
                  <View style={styles.playerControlsRow}>
                    <TouchableOpacity
                      style={styles.controlBtn}
                      onPress={() => {
                        triggerHaptic();
                        const prevIdx = (currentStepIndex - 1 + activeTechnique.steps.length) % activeTechnique.steps.length;
                        setCurrentStepIndex(prevIdx);
                        setStepTimer(activeTechnique.steps[prevIdx].durationSec || 4);
                      }}
                    >
                      <Ionicons name="play-back" size={20} color="#ffffff" />
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.playPauseBtn, { backgroundColor: activeTechnique.color }]}
                      onPress={() => {
                        triggerHaptic();
                        setIsPlaying(!isPlaying);
                      }}
                    >
                      <Ionicons name={isPlaying ? 'pause' : 'play'} size={28} color="#ffffff" />
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.controlBtn}
                      onPress={() => {
                        triggerHaptic();
                        const nextIdx = (currentStepIndex + 1) % activeTechnique.steps.length;
                        setCurrentStepIndex(nextIdx);
                        setStepTimer(activeTechnique.steps[nextIdx].durationSec || 4);
                      }}
                    >
                      <Ionicons name="play-forward" size={20} color="#ffffff" />
                    </TouchableOpacity>
                  </View>

                  {/* Complete Action Button */}
                  <TouchableOpacity
                    style={[styles.completeBtn, { backgroundColor: activeTechnique.color }]}
                    onPress={handleFinishSession}
                  >
                    <Ionicons name="checkmark-circle" size={18} color="#ffffff" />
                    <ThemedText style={styles.completeBtnText}>Complete Session & Log Progress</ThemedText>
                  </TouchableOpacity>

                </ScrollView>
              </>
            )}
          </SafeAreaView>
        </View>
      </Modal>

      {/* Completion Modal */}
      <Modal
        visible={isCompletedModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsCompletedModalVisible(false)}
      >
        <View style={styles.modalBackdropCenter}>
          <View style={styles.completedCard}>
            <View style={styles.completedIconCircle}>
              <Ionicons name="checkmark-done-circle" size={44} color="#10B981" />
            </View>

            <View style={styles.syncedBadge}>
              <Ionicons name="cloud-done" size={13} color="#10B981" style={{ marginRight: 4 }} />
              <ThemedText style={styles.syncedBadgeText}>LOGGED IN DATABASE</ThemedText>
            </View>

            <ThemedText style={styles.completedTitle}>{completedSummary?.title || 'Session Completed'}</ThemedText>
            <ThemedText style={styles.completedSub}>
              Your breathing discipline and physiological calm have been permanently recorded in your neural profile.
            </ThemedText>

            {/* Logged Data Breakdown */}
            <View style={styles.completedDataGrid}>
              <View style={styles.completedDataCell}>
                <ThemedText style={styles.completedDataCellLabel}>DURATION</ThemedText>
                <ThemedText style={styles.completedDataCellValue}>{completedSummary?.durationMinutes || 5} min</ThemedText>
              </View>
              <View style={styles.completedDataDivider} />
              <View style={styles.completedDataCell}>
                <ThemedText style={styles.completedDataCellLabel}>CYCLES</ThemedText>
                <ThemedText style={styles.completedDataCellValue}>{completedSummary?.rounds || 1} rounds</ThemedText>
              </View>
              <View style={styles.completedDataDivider} />
              <View style={styles.completedDataCell}>
                <ThemedText style={styles.completedDataCellLabel}>TIME</ThemedText>
                <ThemedText style={styles.completedDataCellValue}>{completedSummary?.timestamp || 'Just now'}</ThemedText>
              </View>
            </View>

            <View style={styles.rewardBox}>
              <Ionicons name="shield-checkmark" size={16} color="#F59E0B" />
              <ThemedText style={styles.rewardText}>+50 Discipline XP • +1.5 Mind Strength</ThemedText>
            </View>

            <TouchableOpacity
              style={styles.completedDoneBtn}
              activeOpacity={0.88}
              onPress={() => {
                triggerHaptic();
                setIsCompletedModalVisible(false);
              }}
            >
              <ThemedText style={styles.completedDoneText}>Return to Practices</ThemedText>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradientBg: { flex: 1 },
  safeArea: { flex: 1 },
  scrollContent: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    paddingBottom: 110,
    gap: Spacing.three,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingVertical: 8,
  },
  backBtn: {
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 4,
  },
  emergencyBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryBadge: {
    fontSize: 9,
    fontWeight: '800',
    color: '#06B6D4',
    letterSpacing: 1.5,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#ffffff',
    marginTop: 1,
  },
  starRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },

  // Hero Card (Thinner, Responsive, Perfectly Aligned)
  heroCard: {
    width: '100%',
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.25)',
    backgroundColor: '#08090C',
    position: 'relative',
  },
  heroImageBg: {
    ...StyleSheet.absoluteFill,
    width: '100%',
    height: '100%',
    opacity: 0.65,
  },
  heroGradientOverlay: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
    justifyContent: 'space-between',
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0, 229, 255, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.35)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    flexShrink: 1,
  },
  heroBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#00E5FF',
    letterSpacing: 0.5,
  },
  heroRatingWrap: {
    flexShrink: 0,
  },
  heroTextSection: {
    gap: 3,
  },
  heroTitleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    flexWrap: 'wrap',
  },
  heroTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: -0.3,
  },
  heroSanskrit: {
    fontSize: 11.5,
    color: '#00E5FF',
    fontWeight: '700',
  },
  heroSubtitle: {
    fontSize: 10.5,
    color: 'rgba(255, 255, 255, 0.72)',
    lineHeight: 14.5,
  },
  heroFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  sourceTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
    flexShrink: 1,
    marginRight: 6,
  },
  sourceTagText: {
    fontSize: 9.5,
    color: 'rgba(255, 255, 255, 0.55)',
    fontWeight: '600',
    flexShrink: 1,
  },
  heroPlayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: '#00E5FF',
    paddingHorizontal: 10,
    paddingVertical: 5.5,
    minHeight: 30,
    borderRadius: 8,
    flexShrink: 0,
  },
  heroPlayText: {
    fontSize: 10.5,
    fontWeight: '900',
    color: '#000000',
    letterSpacing: 0.2,
  },

  // Categories
  categorySection: {
    marginVertical: 4,
  },
  categoryRow: {
    gap: 8,
  },
  catChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  catChipActive: {
    backgroundColor: 'rgba(6, 182, 212, 0.2)',
    borderColor: '#06B6D4',
  },
  catChipText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
    fontWeight: '600',
  },
  catChipTextActive: {
    color: '#ffffff',
    fontWeight: '800',
  },

  // Library List
  librarySection: {
    gap: 12,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#ffffff',
  },
  sectionCount: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.45)',
  },
  practicesList: {
    gap: 16,
  },
  practiceCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 16,
    gap: 10,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    gap: 12,
  },
  cardImageContainer: {
    width: 64,
    height: 64,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  cardThumbImage: {
    width: '100%',
    height: '100%',
  },
  colorGlowOverlay: {
    ...StyleSheet.absoluteFill,
  },
  cardMainText: {
    flex: 1,
    justifyContent: 'center',
  },
  cardTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#ffffff',
  },
  cardSanskrit: {
    fontSize: 11.5,
    color: 'rgba(255, 255, 255, 0.5)',
    marginTop: 1,
  },
  cardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  metaDivider: {
    width: 1,
    height: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  durationChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  durationChipText: {
    fontSize: 10.5,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  difficultyChip: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  difficultyText: {
    fontSize: 9.5,
    color: 'rgba(255, 255, 255, 0.7)',
    fontWeight: '700',
  },
  cardSourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  sourceText: {
    fontSize: 10.5,
    color: 'rgba(255, 255, 255, 0.65)',
    fontWeight: '600',
  },
  purposeText: {
    fontSize: 12.5,
    color: 'rgba(255, 255, 255, 0.75)',
    lineHeight: 18,
  },
  useWhenContainer: {
    gap: 4,
  },
  useWhenLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.4)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tagWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tagChip: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  tagChipText: {
    fontSize: 10.5,
    color: 'rgba(255, 255, 255, 0.65)',
  },
  cardFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 6,
  },
  detailBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    minHeight: 33,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 9,
    borderWidth: 1,
    backgroundColor: 'transparent',
  },
  detailBtnText: {
    fontSize: 10.8,
    fontWeight: '700',
    textAlign: 'center',
  },
  startBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    minHeight: 33,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 9,
  },
  startBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#ffffff',
  },

  // Modal Backdrop
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
  },
  detailContainer: {
    flex: 1,
    backgroundColor: '#07090E',
  },
  detailScroll: {
    padding: Spacing.four,
    gap: Spacing.three,
  },
  detailHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailCategory: {
    fontSize: 11,
    fontWeight: '800',
    color: '#06B6D4',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  detailHeroBox: {
    height: 180,
    borderRadius: 20,
    overflow: 'hidden',
    position: 'relative',
  },
  detailHeroImg: {
    width: '100%',
    height: '100%',
  },
  detailHeroOverlay: {
    ...StyleSheet.absoluteFill,
    padding: 16,
    justifyContent: 'flex-end',
    gap: 4,
  },
  detailTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#ffffff',
  },
  detailSanskrit: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.65)',
    fontWeight: '600',
  },
  specsContainer: {
    gap: 8,
    width: '100%',
  },
  specSourceCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 4,
  },
  specSourceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  specSourceValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
    lineHeight: 17,
  },
  specsRow: {
    flexDirection: 'row',
    gap: 8,
    width: '100%',
  },
  specBox: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
  },
  specBoxHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  specLabel: {
    fontSize: 9.5,
    fontWeight: '800',
    color: 'rgba(255, 255, 255, 0.5)',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  specValue: {
    fontSize: 12,
    fontWeight: '800',
    color: '#ffffff',
  },
  detailSection: {
    gap: 8,
  },
  detailSectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#ffffff',
  },
  detailBodyText: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.75)',
    lineHeight: 19,
  },
  benefitsList: {
    gap: 8,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  benefitDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 6,
  },
  benefitText: {
    flex: 1,
    fontSize: 12.5,
    color: 'rgba(255, 255, 255, 0.8)',
    lineHeight: 18,
  },
  gitaBox: {
    backgroundColor: 'rgba(6, 182, 212, 0.1)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.3)',
    padding: 14,
    gap: 6,
  },
  gitaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  gitaChapter: {
    fontSize: 11,
    fontWeight: '800',
    color: '#06B6D4',
  },
  gitaSanskrit: {
    fontSize: 11.5,
    fontStyle: 'italic',
    color: 'rgba(255, 255, 255, 0.85)',
  },
  gitaTranslation: {
    fontSize: 11.5,
    color: 'rgba(255, 255, 255, 0.65)',
    lineHeight: 16,
  },
  mantraBox: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    padding: 14,
    gap: 4,
  },
  mantraLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#F59E0B',
  },
  mantraTextDisplay: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#ffffff',
    lineHeight: 18,
  },
  tagChipLarge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  tagChipLargeText: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  startSessionLargeBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 16,
    marginTop: 8,
  },
  startSessionLargeText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#ffffff',
  },

  // Player Screen
  playerContainer: {
    flex: 1,
    backgroundColor: '#05060A',
  },
  playerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    paddingVertical: 10,
  },
  playerCategoryText: {
    fontSize: 9.5,
    color: 'rgba(255, 255, 255, 0.45)',
    fontWeight: '700',
  },
  playerHeaderTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#ffffff',
  },
  playerMain: {
    padding: Spacing.four,
    gap: Spacing.four,
    alignItems: 'center',
  },
  playerCircleContainer: {
    marginVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playerCircleOuter: {
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playerCircleInner: {
    width: 150,
    height: 150,
    borderRadius: 75,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  playerStepCue: {
    fontSize: 13,
    fontWeight: '800',
    color: '#ffffff',
    textAlign: 'center',
  },
  playerTimerDisplay: {
    fontSize: 24,
    fontWeight: '900',
    color: '#ffffff',
  },
  readFirstNoticeBanner: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.25)',
    borderRadius: 14,
    padding: 12,
  },
  readFirstNoticeText: {
    flex: 1,
    fontSize: 11.5,
    color: '#E2E8F0',
    lineHeight: 16,
  },
  timelineProgressTrack: {
    width: '100%',
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 2,
    overflow: 'hidden',
    marginTop: 4,
  },
  timelineProgressFill: {
    height: '100%',
    borderRadius: 2,
  },
  timelineHeaderRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  roundBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  roundBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  mandatoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(245, 158, 11, 0.18)',
    borderColor: 'rgba(245, 158, 11, 0.35)',
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  mandatoryBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#F59E0B',
    letterSpacing: 0.5,
  },
  timelineSectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 1,
  },
  timelineStepCount: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  allStepsTimelineContainer: {
    width: '100%',
    position: 'relative',
    gap: 12,
    paddingLeft: 8,
  },
  timelineVerticalLine: {
    position: 'absolute',
    left: 19,
    top: 14,
    bottom: 14,
    width: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 1,
  },
  timelineStepCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  timelineStepCardActive: {
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  timelineStepCardPast: {
    opacity: 0.65,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
  },
  timelineNodeDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    zIndex: 2,
  },
  timelineNodeDotActive: {
    borderWidth: 2,
  },
  timelineNodeDotPast: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  timelineNodeText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#94A3B8',
    textAlign: 'center',
    textAlignVertical: 'center',
    includeFontPadding: false,
    lineHeight: 15,
  },
  timelineStepContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  timelineStepMainCol: {
    flex: 1,
    gap: 4,
  },
  timelineStepSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  timelineStepTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#CBD5E1',
    lineHeight: 18,
  },
  cuePill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  cuePillText: {
    fontSize: 9.5,
    fontWeight: '700',
  },
  activePill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'center',
  },
  activePillText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#ffffff',
  },
  timelineStepDesc: {
    fontSize: 12,
    color: '#94A3B8',
    lineHeight: 17,
  },
  timelineStepDescActive: {
    color: '#E2E8F0',
  },
  stepDurationMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  stepDurationText: {
    fontSize: 10.5,
    color: '#94A3B8',
  },
  playerMantraCard: {
    width: '100%',
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    padding: 14,
    gap: 4,
  },
  playerMantraLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#F59E0B',
    textTransform: 'uppercase',
  },
  playerMantraContent: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
    lineHeight: 18,
  },
  playerGitaCard: {
    width: '100%',
    backgroundColor: 'rgba(6, 182, 212, 0.12)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.3)',
    padding: 14,
    gap: 4,
  },
  playerGitaHeader: {
    fontSize: 10,
    fontWeight: '800',
    color: '#06B6D4',
  },
  playerGitaVerse: {
    fontSize: 11.5,
    fontStyle: 'italic',
    color: '#ffffff',
  },
  playerControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 24,
    marginTop: 8,
  },
  controlBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playPauseBtn: {
    width: 58,
    height: 58,
    borderRadius: 29,
    justifyContent: 'center',
    alignItems: 'center',
  },
  completeBtn: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 16,
    marginTop: 8,
  },
  completeBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#ffffff',
  },

  // Completion Modal
  modalBackdropCenter: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  completedCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#090B10',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    padding: 24,
    alignItems: 'center',
    gap: 12,
  },
  completedIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  completedTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#ffffff',
  },
  completedSub: {
    fontSize: 12.5,
    color: 'rgba(255, 255, 255, 0.65)',
    textAlign: 'center',
    lineHeight: 18,
  },
  rewardBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
  },
  rewardText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#F59E0B',
  },
  completedDoneBtn: {
    width: '100%',
    backgroundColor: '#10B981',
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 6,
  },
  completedDoneText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#ffffff',
  },

  // Stats Strip on Main Screen
  statsStripContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  statBox: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 15,
    fontWeight: '900',
    color: '#00E5FF',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: 'rgba(255, 255, 255, 0.45)',
    letterSpacing: 0.6,
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },

  // Step Protocol Guide Styles
  sectionHeaderFlex: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  protocolIntroText: {
    fontSize: 12,
    color: '#94A3B8',
    lineHeight: 17,
    marginBottom: 12,
  },
  protocolStepsList: {
    gap: 10,
  },
  protocolStepCard: {
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
  },
  protocolStepCardSetup: {
    borderColor: 'rgba(245, 158, 11, 0.35)',
    backgroundColor: 'rgba(245, 158, 11, 0.04)',
  },
  protocolStepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  stepBadgeNumber: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBadgeNumberText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#ffffff',
  },
  protocolStepTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#ffffff',
  },
  protocolStepSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  phasePill: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  phasePillText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#38BDF8',
  },
  protocolStepDurationText: {
    fontSize: 10.5,
    color: '#94A3B8',
  },
  protocolStepDesc: {
    fontSize: 12,
    color: '#CBD5E1',
    lineHeight: 17,
    marginBottom: 6,
  },
  protocolVisualCueBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(56, 189, 248, 0.08)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  protocolVisualCueText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#38BDF8',
  },

  // Completion Screen Data Grid
  syncedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 0.5,
    borderColor: 'rgba(16, 185, 129, 0.35)',
  },
  syncedBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#10B981',
    letterSpacing: 0.6,
  },
  completedDataGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  completedDataCell: {
    alignItems: 'center',
    flex: 1,
  },
  completedDataCellLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: 'rgba(255, 255, 255, 0.45)',
    marginBottom: 2,
  },
  completedDataCellValue: {
    fontSize: 13,
    fontWeight: '800',
    color: '#ffffff',
  },
  completedDataDivider: {
    width: 1,
    height: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },

  // Om Audio Controls & Indicators in Live Player
  omWaitingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.25)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    width: '100%',
  },
  omWaitingText: {
    fontSize: 11,
    color: '#F59E0B',
    fontWeight: '600',
    flex: 1,
  },
  omActiveBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.35)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    width: '100%',
  },
  omActiveLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  omPulsingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#F59E0B',
  },
  omActiveText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#F59E0B',
  },
  omMuteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  omMuteText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#ffffff',
  },
});
