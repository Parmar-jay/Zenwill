import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  View,
  Platform,
  Modal,
  Image,
  Animated,
  useWindowDimensions,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useDailyMissionStore } from '@/store/daily-mission-store';
import { YOGIC_PRACTICES, YogicTechnique, EMERGENCY_SOS_SEQUENCE } from '@/constants/practices';
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

  // Visualizer Animation
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(0.6)).current;

  // Completion Modal State
  const [isCompletedModalVisible, setIsCompletedModalVisible] = useState<boolean>(false);

  const categories = ['All', 'Pranayama', 'Devotional & Mantra', 'Emergency Reset', 'Focus & Gita'];

  const filteredPractices = YOGIC_PRACTICES.filter(
    (p) => selectedCategory === 'All' || p.category === selectedCategory
  );

  const handleOpenDetail = (technique: YogicTechnique) => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
    setActiveTechnique(technique);
    setIsDetailModalVisible(true);
  };

  const handleStartSession = (technique: YogicTechnique) => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
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

  const formatTime = (totalSecs: number) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const handleFinishSession = () => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Heavy);
    useDailyMissionStore.getState().completeTask('meditation');
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
          
          {/* Featured Practice Card */}
          <TouchableOpacity
            style={styles.heroCard}
            activeOpacity={0.92}
            onPress={() => handleOpenDetail(YOGIC_PRACTICES[4])} // Krishna Centered Meditation
          >
            <Image
              source={YOGIC_PRACTICES[4].image}
              style={styles.heroImageBg}
              resizeMode="cover"
            />
            <LinearGradient
              colors={['rgba(5, 6, 9, 0.4)', 'rgba(5, 6, 9, 0.95)']}
              style={styles.heroGradientOverlay}
            >
              <View style={styles.heroTopRow}>
                <View style={styles.heroBadge}>
                  <Ionicons name="sparkles" size={12} color="#06B6D4" />
                  <ThemedText style={styles.heroBadgeText}>Featured Practice</ThemedText>
                </View>
                {renderStars(YOGIC_PRACTICES[4].rating)}
              </View>

              <View style={styles.heroTextSection}>
                <ThemedText style={styles.heroTitle}>{YOGIC_PRACTICES[4].title}</ThemedText>
                <ThemedText style={styles.heroSanskrit}>{YOGIC_PRACTICES[4].sanskritTitle}</ThemedText>
                <ThemedText style={styles.heroSubtitle} numberOfLines={2}>
                  {YOGIC_PRACTICES[4].purpose}
                </ThemedText>
              </View>

              <View style={styles.heroFooter}>
                <View style={styles.sourceTag}>
                  <Ionicons name="book-outline" size={12} color="rgba(255,255,255,0.6)" />
                  <ThemedText style={styles.sourceTagText}>{YOGIC_PRACTICES[4].source}</ThemedText>
                </View>

                <TouchableOpacity
                  style={styles.heroPlayBtn}
                  onPress={() => handleStartSession(YOGIC_PRACTICES[4])}
                >
                  <Ionicons name="play" size={14} color="#ffffff" />
                  <ThemedText style={styles.heroPlayText}>Start Session</ThemedText>
                </TouchableOpacity>
              </View>
            </LinearGradient>
          </TouchableOpacity>

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
                      style={[styles.detailBtn, { borderColor: `${technique.color}40` }]}
                      onPress={() => handleOpenDetail(technique)}
                    >
                      <ThemedText style={styles.detailBtnText}>View Details & Benefits</ThemedText>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.startBtn, { backgroundColor: technique.color }]}
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

      {/* Technique Detail Modal */}
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

                {/* Source & Specs Bar */}
                <View style={styles.specsBar}>
                  <View style={styles.specItem}>
                    <Ionicons name="book-outline" size={14} color={activeTechnique.color} />
                    <ThemedText style={styles.specLabel}>Source</ThemedText>
                    <ThemedText style={styles.specValue}>{activeTechnique.source}</ThemedText>
                  </View>

                  <View style={styles.specDivider} />

                  <View style={styles.specItem}>
                    <Ionicons name="time-outline" size={14} color={activeTechnique.color} />
                    <ThemedText style={styles.specLabel}>Duration</ThemedText>
                    <ThemedText style={styles.specValue}>{activeTechnique.durationText}</ThemedText>
                  </View>

                  <View style={styles.specDivider} />

                  <View style={styles.specItem}>
                    <Ionicons name="options-outline" size={14} color={activeTechnique.color} />
                    <ThemedText style={styles.specLabel}>Difficulty</ThemedText>
                    <ThemedText style={styles.specValue}>{activeTechnique.difficulty}</ThemedText>
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

                {/* Start Session CTA */}
                <TouchableOpacity
                  style={[styles.startSessionLargeBtn, { backgroundColor: activeTechnique.color }]}
                  onPress={() => handleStartSession(activeTechnique)}
                >
                  <Ionicons name="play" size={18} color="#ffffff" />
                  <ThemedText style={styles.startSessionLargeText}>Begin Guided Session Now</ThemedText>
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

                  {/* Pulsing Visualizer Circle */}
                  <View style={styles.playerCircleContainer}>
                    <Animated.View
                      style={[
                        styles.playerCircleOuter,
                        {
                          borderColor: activeTechnique.color,
                          transform: [{ scale: scaleAnim }],
                        },
                      ]}
                    >
                      <Animated.View
                        style={[
                          styles.playerCircleInner,
                          {
                            backgroundColor: activeTechnique.color,
                            opacity: pulseAnim,
                          },
                        ]}
                      >
                        <ThemedText style={styles.playerStepCue}>
                          {activeTechnique.steps[currentStepIndex]?.visualCue || 'Breathe'}
                        </ThemedText>
                        <ThemedText style={styles.playerTimerDisplay}>{formatTime(secondsRemaining)}</ThemedText>
                      </Animated.View>
                    </Animated.View>
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
                            setCurrentStepIndex(idx);
                            setStepTimer(step.durationSec || 4);
                          }}
                        >
                          {/* Timeline Left Node Dot */}
                          <View
                            style={[
                              styles.timelineNodeDot,
                              isActive && [styles.timelineNodeDotActive, { borderColor: activeTechnique.color, backgroundColor: activeTechnique.color }],
                              isPast && styles.timelineNodeDotPast,
                            ]}
                          >
                            {isPast ? (
                              <Ionicons name="checkmark" size={12} color="#ffffff" />
                            ) : (
                              <ThemedText style={[styles.timelineNodeText, isActive && { color: '#ffffff' }]}>
                                {idx + 1}
                              </ThemedText>
                            )}
                          </View>

                          {/* Step Content */}
                          <View style={styles.timelineStepContent}>
                            <View style={styles.timelineStepTopRow}>
                              <View style={styles.timelineStepBadgeRow}>
                                {step.isMandatorySetup && (
                                  <View style={styles.mandatoryBadge}>
                                    <Ionicons name="shield-checkmark" size={10} color="#F59E0B" />
                                    <ThemedText style={styles.mandatoryBadgeText}>MANDATORY POSTURE</ThemedText>
                                  </View>
                                )}
                                <ThemedText style={[styles.timelineStepTitle, isActive && { color: '#ffffff', fontWeight: '800' }]}>
                                  {step.title}
                                </ThemedText>
                                {step.visualCue && (
                                  <View style={[styles.cuePill, { backgroundColor: `${activeTechnique.color}20` }]}>
                                    <ThemedText style={[styles.cuePillText, { color: activeTechnique.color }]}>
                                      {step.visualCue}
                                    </ThemedText>
                                  </View>
                                )}
                              </View>

                              {isActive && (
                                <View style={[styles.activePill, { backgroundColor: activeTechnique.color }]}>
                                  <ThemedText style={styles.activePillText}>Active • {stepTimer}s</ThemedText>
                                </View>
                              )}
                            </View>

                            <ThemedText style={[styles.timelineStepDesc, isActive && styles.timelineStepDescActive]}>
                              {step.description}
                            </ThemedText>

                            {step.durationSec && (
                              <View style={styles.stepDurationMeta}>
                                <Ionicons name="time-outline" size={11} color="#94A3B8" />
                                <ThemedText style={styles.stepDurationText}>Target duration: {step.durationSec}s</ThemedText>
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
              <Ionicons name="checkmark-done-circle" size={48} color="#10B981" />
            </View>

            <ThemedText style={styles.completedTitle}>Session Completed</ThemedText>
            <ThemedText style={styles.completedSub}>
              You have completed {activeTechnique?.title || 'your practice'}. Mindful regulation logged into your daily mission streaks.
            </ThemedText>

            <View style={styles.rewardBox}>
              <Ionicons name="shield-checkmark" size={18} color="#F59E0B" />
              <ThemedText style={styles.rewardText}>+50 Discipline XP Earned</ThemedText>
            </View>

            <TouchableOpacity
              style={styles.completedDoneBtn}
              onPress={() => {
                triggerHaptic();
                setIsCompletedModalVisible(false);
              }}
            >
              <ThemedText style={styles.completedDoneText}>Return to Library</ThemedText>
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

  // Hero Card
  heroCard: {
    width: '100%',
    height: 220,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.3)',
    position: 'relative',
  },
  heroImageBg: {
    ...StyleSheet.absoluteFill,
    width: '100%',
    height: '100%',
  },
  heroGradientOverlay: {
    ...StyleSheet.absoluteFill,
    padding: Spacing.four,
    justifyContent: 'space-between',
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(6, 182, 212, 0.25)',
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.4)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  heroBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#06B6D4',
  },
  heroTextSection: {
    gap: 2,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: -0.4,
  },
  heroSanskrit: {
    fontSize: 12,
    color: '#06B6D4',
    fontWeight: '700',
  },
  heroSubtitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.75)',
    lineHeight: 16,
    marginTop: 4,
  },
  heroFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sourceTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sourceTagText: {
    fontSize: 10.5,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  heroPlayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#06B6D4',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
  },
  heroPlayText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#ffffff',
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
    gap: 10,
    marginTop: 4,
  },
  detailBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  detailBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.8)',
  },
  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
  },
  startBtnText: {
    fontSize: 11.5,
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
  specsBar: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 12,
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  specItem: {
    alignItems: 'center',
    gap: 2,
  },
  specLabel: {
    fontSize: 9.5,
    color: 'rgba(255, 255, 255, 0.45)',
    textTransform: 'uppercase',
  },
  specValue: {
    fontSize: 11,
    fontWeight: '800',
    color: '#ffffff',
  },
  specDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
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
    alignItems: 'center',
    gap: 10,
  },
  benefitDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  benefitText: {
    fontSize: 12.5,
    color: 'rgba(255, 255, 255, 0.8)',
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
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 12,
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
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
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
    fontSize: 10,
    fontWeight: '800',
    color: '#94A3B8',
  },
  timelineStepContent: {
    flex: 1,
    gap: 4,
  },
  timelineStepTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 6,
  },
  timelineStepBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
    flex: 1,
  },
  timelineStepTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#CBD5E1',
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
    paddingVertical: 3,
    borderRadius: 8,
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
});
