import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  StyleSheet,
  View,
  TouchableOpacity,
  ScrollView,
  Platform,
  Animated,
  Easing,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Stack, useFocusEffect } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useDailyMissionStore, DailyTasks } from '@/store/daily-mission-store';
import { useHabitStore } from '@/store/habit-store';
import { useAuthStore } from '@/store/auth-store';
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

const POWERFUL_QUOTES = [
  {
    quote: "He who conquers himself is the mightiest warrior.",
    author: "Sun Tzu",
    tag: "Self-Mastery",
  },
  {
    quote: "No man is free who is not master of himself.",
    author: "Epictetus",
    tag: "Stoic Wisdom",
  },
  {
    quote: "We don't rise to the level of our expectations, we fall to the level of our training.",
    author: "Archilochus",
    tag: "Discipline",
  },
  {
    quote: "The obstacle in the path becomes the path. Never forget, within every obstacle is an opportunity.",
    author: "Marcus Aurelius",
    tag: "Resilience",
  },
  {
    quote: "You have power over your mind - not outside events. Realize this, and you will find strength.",
    author: "Marcus Aurelius",
    tag: "Mental Fortitude",
  },
];

export default function DailyMissionsScreen() {
  const router = useRouter();
  const { width: windowWidth } = useWindowDimensions();
  const isTabletOrWeb = windowWidth >= 768;

  const { todayTasks, totalPoints, checkAndResetMidnight, getWeeklyStats, syncWithBackend } =
    useDailyMissionStore();
  const { streak } = useHabitStore();
  const user = useAuthStore((state) => state.user);

  const [quoteIndex, setQuoteIndex] = useState(0);

  useEffect(() => {
    checkAndResetMidnight();
    syncWithBackend().catch(() => {});
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      checkAndResetMidnight();
      syncWithBackend().catch(() => {});
    }, [])
  );

  const completedCount = useMemo(() => {
    let c = 0;
    if (todayTasks?.checkin) c++;
    if (todayTasks?.meditation) c++;
    if (todayTasks?.journal) c++;
    if (todayTasks?.coach) c++;
    if (todayTasks?.rescue) c++;
    return c;
  }, [todayTasks]);

  const todayXp = completedCount * 20; // 5 tasks * 20 XP = 100 XP max
  const allCompleted = completedCount === 5;
  const progressPercent = Math.round((completedCount / 5) * 100);

  const weeklyStats = useMemo(() => getWeeklyStats(), [todayTasks]);

  const weeklyStatsSummary = useMemo(() => {
    const totalXp = weeklyStats.reduce((acc, curr) => acc + curr.points, 0);
    const avgPct = Math.round(weeklyStats.reduce((acc, curr) => acc + curr.percent, 0) / 7);
    const activeDays = weeklyStats.filter((s) => s.points > 0).length;
    return {
      totalXp,
      avgPct,
      activeDays,
    };
  }, [weeklyStats]);

  // Entrance Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 400,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // Fix: Button press ONLY routes without premature completion!
  const handleTaskAction = (route: string) => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
    router.push(route as any);
  };

  const handleNextQuote = () => {
    triggerHaptic();
    setQuoteIndex((prev) => (prev + 1) % POWERFUL_QUOTES.length);
  };

  const currentQuote = POWERFUL_QUOTES[quoteIndex];

  const tasksList = [
    {
      id: 'checkin' as keyof DailyTasks,
      title: 'Daily Mind Check-in',
      subtitle: 'Log your mood, energy, stress, and urge level',
      xp: 20,
      icon: 'create-outline' as const,
      color: '#6366F1',
      route: '/daily-checkin',
      actionLabel: 'Check In',
      done: todayTasks?.checkin,
    },
    {
      id: 'meditation' as keyof DailyTasks,
      title: 'Pranayama Breathwork',
      subtitle: '10 min deep breathwork & craving wave control',
      xp: 20,
      icon: 'flower-outline' as const,
      color: '#10B981',
      route: '/meditation',
      actionLabel: 'Meditate',
      done: todayTasks?.meditation,
    },
    {
      id: 'journal' as keyof DailyTasks,
      title: 'Self-Reflection Journal',
      subtitle: 'Write your thoughts & lock in daily wisdom',
      xp: 20,
      icon: 'book-outline' as const,
      color: '#F59E0B',
      route: '/journal',
      actionLabel: 'Journal',
      done: todayTasks?.journal,
    },
    {
      id: 'coach' as keyof DailyTasks,
      title: 'AI Coach Guidance',
      subtitle: 'Consult your AI mindset strategist for daily clarity',
      xp: 20,
      icon: 'chatbubble-ellipses-outline' as const,
      color: '#8B5CF6',
      route: '/(tabs)/chat',
      actionLabel: 'AI Coach',
      done: todayTasks?.coach,
    },
    {
      id: 'rescue' as keyof DailyTasks,
      title: 'Urge Control & Reset',
      subtitle: 'Practice urge surfing or 5-4-3-2-1 grounding protocol',
      xp: 20,
      icon: 'shield-outline' as const,
      color: '#EF4444',
      route: '/emergency',
      actionLabel: 'Urge Reset',
      done: todayTasks?.rescue,
    },
  ];

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <SafeAreaView style={styles.headerSafeArea} edges={['top']}>
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={styles.backBtn}
            activeOpacity={0.7}
            onPress={() => {
              triggerHaptic();
              router.back();
            }}
          >
            <Ionicons name="chevron-back" size={24} color="#00E5FF" />
          </TouchableOpacity>

          <View style={styles.headerTitleContainer}>
            <ThemedText style={styles.headerCategory}>DAILY COMMAND</ThemedText>
            <ThemedText style={styles.headerTitle}>Daily Missions</ThemedText>
          </View>

          <View style={{ width: 36 }} />
        </View>
      </SafeAreaView>

      {/* Scrollable Content */}
      <PageEntrance style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={[styles.scrollContent, isTabletOrWeb && styles.tabletContent]}
          showsVerticalScrollIndicator={false}
        >
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>

          {/* Hard-Hitting Quote Banner */}
          <View style={styles.quoteCard}>
            <View style={styles.quoteHeaderRow}>
              <View style={styles.quoteTagBadge}>
                <Ionicons name="flash-outline" size={12} color="#F59E0B" />
                <ThemedText style={styles.quoteTagText}>{currentQuote.tag.toUpperCase()}</ThemedText>
              </View>
              <TouchableOpacity onPress={handleNextQuote} style={styles.quoteRefreshBtn}>
                <Ionicons name="refresh-outline" size={14} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            <ThemedText style={styles.quoteBodyText}>"{currentQuote.quote}"</ThemedText>
            <ThemedText style={styles.quoteAuthorText}>— {currentQuote.author}</ThemedText>
          </View>

          {/* Progress Hero Card */}
          <LinearGradient
            colors={['#000000', '#000000']}
            style={styles.heroCard}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={styles.heroHeaderRow}>
              <View style={styles.heroTitleGroup}>
                <ThemedText style={styles.heroBadgeText}>DAILY SCORE TRACKER</ThemedText>
                <ThemedText style={styles.heroMainTitle}>{todayXp} / 100 XP</ThemedText>
              </View>

              <View style={styles.streakBadge}>
                <Ionicons name="flame-outline" size={14} color="#F59E0B" />
                <ThemedText style={styles.streakBadgeText}>{streak} Day Streak</ThemedText>
              </View>
            </View>

            {/* Minimalist Progress Bar */}
            <View style={styles.progressBarTrack}>
              <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
            </View>

            <View style={styles.heroFooterRow}>
              <ThemedText style={styles.heroSubtext}>
                {completedCount} of 5 Missions Done today
              </ThemedText>
              <ThemedText style={styles.heroPercentText}>{progressPercent}%</ThemedText>
            </View>

            {allCompleted && (
              <View style={styles.completedBonusBanner}>
                <Ionicons name="trophy-outline" size={16} color="#10B981" style={{ marginRight: 6 }} />
                <ThemedText style={styles.completedBonusText}>
                  PERFECT DAY ACHIEVED! 100/100 XP UNLOCKED
                </ThemedText>
              </View>
            )}
          </LinearGradient>

          {/* Missions Minimalist List */}
          <View style={styles.sectionHeaderRow}>
            <ThemedText style={styles.sectionTitle}>TODAY'S MISSIONS</ThemedText>
            <ThemedText style={styles.sectionSubTitle}>Complete each action to log progress</ThemedText>
          </View>

          <View style={styles.missionsList}>
            {tasksList.map((item) => (
              <View
                key={item.id}
                style={[
                  styles.taskCard,
                  item.done && styles.taskCardDone,
                ]}
              >
                <View style={styles.taskCardLeft}>
                  <View style={[styles.iconContainer, { backgroundColor: item.done ? '#10B981' : item.color + '18' }]}>
                    <Ionicons
                      name={item.done ? 'checkmark-sharp' : item.icon}
                      size={18}
                      color={item.done ? '#FFFFFF' : item.color}
                    />
                  </View>

                  <View style={styles.taskTextCol}>
                    <View style={styles.taskTitleRow}>
                      <ThemedText style={[styles.taskTitle, item.done && styles.taskTitleDone]} numberOfLines={1}>
                        {item.title}
                      </ThemedText>
                      <View style={[styles.ptsBadge, item.done && styles.ptsBadgeDone]}>
                        <ThemedText style={[styles.ptsBadgeText, item.done && styles.ptsBadgeTextDone]}>
                          +{item.xp} XP
                        </ThemedText>
                      </View>
                    </View>
                    <ThemedText style={styles.taskSubtitle} numberOfLines={1}>
                      {item.subtitle}
                    </ThemedText>
                  </View>
                </View>

                {item.done ? (
                  <View style={styles.donePill}>
                    <Ionicons name="checkmark-sharp" size={13} color="#FFFFFF" />
                    <ThemedText style={styles.donePillText}>Done</ThemedText>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: item.color }]}
                    activeOpacity={0.8}
                    onPress={() => handleTaskAction(item.route)}
                  >
                    <ThemedText style={styles.actionBtnText}>{item.actionLabel}</ThemedText>
                    <Ionicons name="chevron-forward" size={13} color="#FFFFFF" style={{ marginLeft: 2 }} />
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </View>

          {/* 7-Day Consistency & Mission Momentum Analysis */}
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionTitleWithBadge}>
              <Ionicons name="stats-chart" size={14} color="#00E5FF" style={{ marginRight: 6 }} />
              <ThemedText style={styles.sectionTitle}>7-DAY CONSISTENCY ANALYSIS</ThemedText>
            </View>
            <View style={styles.consistencyRateBadge}>
              <ThemedText style={styles.consistencyRateBadgeText}>
                {weeklyStatsSummary.activeDays}/7 Days Active
              </ThemedText>
            </View>
          </View>

          <View style={styles.historyCard}>
            {/* Transparent Glassmorphism Gradient Background */}
            <LinearGradient
              colors={['rgba(255, 255, 255, 0.04)', 'rgba(255, 255, 255, 0.015)']}
              style={styles.historyCardGradient}
            >
              {/* 7 Day Vertical Bar Visualizer */}
              <View style={styles.weeklyGraphRow}>
                {weeklyStats.map((stat, idx) => {
                  const isToday = idx === 6;
                  const hasPoints = stat.points > 0;
                  const isFull = stat.percent === 100;

                  return (
                    <View key={stat.dateStr} style={styles.dayCol}>
                      <ThemedText
                        style={[
                          styles.dayColPts,
                          hasPoints && (isToday ? styles.dayColPtsToday : isFull ? styles.dayColPtsFull : styles.dayColPtsActive),
                        ]}
                        numberOfLines={1}
                      >
                        {stat.points > 0 ? `${stat.points}` : '0'}
                      </ThemedText>

                      <View style={[styles.barTrack, isToday && styles.barTrackToday]}>
                        {hasPoints ? (
                          <LinearGradient
                            colors={
                              isToday
                                ? ['#F59E0B', '#D97706']
                                : isFull
                                ? ['#10B981', '#059669']
                                : ['#818CF8', '#6366F1']
                            }
                            style={[
                              styles.barFill,
                              { height: `${Math.max(16, stat.percent)}%` },
                            ]}
                          />
                        ) : (
                          <View style={styles.barEmptyDot} />
                        )}
                      </View>

                      <ThemedText
                        style={[
                          styles.dayColName,
                          isToday && styles.dayColNameToday,
                          hasPoints && !isToday && styles.dayColNameActive,
                        ]}
                        numberOfLines={1}
                      >
                        {stat.dayName}
                      </ThemedText>
                    </View>
                  );
                })}
              </View>

              {/* 3-Metric Summary Row */}
              <View style={styles.historyMetaRow}>
                <View style={styles.historyMetaItem}>
                  <View style={styles.metaIconRow}>
                    <Ionicons name="sparkles" size={12} color="#00E5FF" />
                    <ThemedText style={styles.historyMetaVal}>{completedCount * 20} XP</ThemedText>
                  </View>
                  <ThemedText style={styles.historyMetaLbl}>Today's Score</ThemedText>
                </View>

                <View style={styles.historyMetaDivider} />

                <View style={styles.historyMetaItem}>
                  <View style={styles.metaIconRow}>
                    <Ionicons name="trending-up" size={12} color="#10B981" />
                    <ThemedText style={[styles.historyMetaVal, { color: '#10B981' }]}>
                      {weeklyStatsSummary.avgPct}%
                    </ThemedText>
                  </View>
                  <ThemedText style={styles.historyMetaLbl}>Weekly Avg</ThemedText>
                </View>

                <View style={styles.historyMetaDivider} />

                <View style={styles.historyMetaItem}>
                  <View style={styles.metaIconRow}>
                    <Ionicons name="flame" size={13} color="#F59E0B" />
                    <ThemedText style={[styles.historyMetaVal, { color: '#F59E0B' }]}>{streak}d</ThemedText>
                  </View>
                  <ThemedText style={styles.historyMetaLbl}>Active Streak</ThemedText>
                </View>
              </View>

              {/* Momentum Status Callout */}
              <View style={styles.momentumCallout}>
                <Ionicons
                  name={allCompleted ? 'shield-checkmark' : 'information-circle'}
                  size={14}
                  color={allCompleted ? '#10B981' : '#00E5FF'}
                />
                <ThemedText style={styles.momentumCalloutText} numberOfLines={2}>
                  {allCompleted
                    ? '100% daily discipline achieved today • Peak neural self-regulation active.'
                    : weeklyStatsSummary.activeDays >= 5
                    ? 'High weekly momentum detected • Keep executing daily rituals.'
                    : 'Complete today’s 5 missions to boost your weekly consistency score.'}
                </ThemedText>
              </View>
            </LinearGradient>
          </View>

        </Animated.View>
      </ScrollView>
    </PageEntrance>
  </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  headerSafeArea: {
    backgroundColor: '#000000',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: {
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 4,
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  headerCategory: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#00E5FF',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  pointsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderColor: 'rgba(245, 158, 11, 0.3)',
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  pointsText: {
    color: '#F59E0B',
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 4,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  tabletContent: {
    maxWidth: 680,
    alignSelf: 'center',
    width: '100%',
  },
  quoteCard: {
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.25)',
  },
  quoteHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  quoteTagBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  quoteTagText: {
    color: '#F59E0B',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginLeft: 4,
  },
  quoteRefreshBtn: {
    padding: 4,
  },
  quoteBodyText: {
    color: '#F8FAFC',
    fontSize: 15,
    fontStyle: 'italic',
    lineHeight: 22,
    fontWeight: '500',
  },
  quoteAuthorText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 8,
    textAlign: 'right',
  },
  heroCard: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  heroHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  heroTitleGroup: {
    flex: 1,
  },
  heroBadgeText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },
  heroMainTitle: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '800',
    marginTop: 2,
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
  },
  streakBadgeText: {
    color: '#F59E0B',
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 4,
  },
  progressBarTrack: {
    height: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 5,
    overflow: 'hidden',
    marginBottom: 10,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#10B981',
    borderRadius: 5,
  },
  heroFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroSubtext: {
    color: '#CBD5E1',
    fontSize: 13,
  },
  heroPercentText: {
    color: '#10B981',
    fontSize: 14,
    fontWeight: '800',
  },
  completedBonusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: 'rgba(16, 185, 129, 0.3)',
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginTop: 14,
  },
  completedBonusText: {
    color: '#10B981',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  sectionHeaderRow: {
    marginBottom: 12,
  },
  sectionTitle: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
  },
  sectionSubTitle: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 2,
  },
  missionsList: {
    marginBottom: 24,
  },
  taskCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  taskCardDone: {
    backgroundColor: 'rgba(16, 185, 129, 0.06)',
    borderColor: 'rgba(16, 185, 129, 0.25)',
  },
  taskCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  taskTextCol: {
    flex: 1,
    justifyContent: 'center',
    gap: 2,
  },
  taskTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  taskTitle: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '700',
    flexShrink: 1,
  },
  taskTitleDone: {
    color: '#94A3B8',
  },
  ptsBadge: {
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 5,
    alignSelf: 'center',
  },
  ptsBadgeDone: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  },
  ptsBadgeText: {
    color: '#818CF8',
    fontSize: 9.5,
    fontWeight: '700',
  },
  ptsBadgeTextDone: {
    color: '#10B981',
  },
  taskSubtitle: {
    color: '#64748B',
    fontSize: 10.5,
    lineHeight: 14,
  },
  actionBtn: {
    width: 88,
    minHeight: 32,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  donePill: {
    width: 88,
    minHeight: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10B981',
    borderColor: '#10B981',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 10,
    flexShrink: 0,
  },
  donePillText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    marginLeft: 3,
    letterSpacing: 0.2,
  },
  sectionTitleWithBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  consistencyRateBadge: {
    backgroundColor: 'rgba(0, 229, 255, 0.12)',
    borderColor: 'rgba(0, 229, 255, 0.3)',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  consistencyRateBadgeText: {
    color: '#00E5FF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  historyCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.09)',
    overflow: 'hidden',
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    marginBottom: 8,
  },
  historyCardGradient: {
    paddingVertical: 16,
    paddingHorizontal: 12,
    gap: 12,
  },
  weeklyGraphRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 125,
    paddingHorizontal: 2,
  },
  dayCol: {
    alignItems: 'center',
    flex: 1,
    height: '100%',
    justifyContent: 'flex-end',
    gap: 4,
  },
  dayColPts: {
    color: 'rgba(255, 255, 255, 0.35)',
    fontSize: 10,
    fontWeight: '700',
    marginBottom: 2,
  },
  dayColPtsActive: {
    color: '#818CF8',
  },
  dayColPtsFull: {
    color: '#10B981',
    fontWeight: '800',
  },
  dayColPtsToday: {
    color: '#F59E0B',
    fontWeight: '900',
  },
  barTrack: {
    width: 14,
    height: 75,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 7,
    justifyContent: 'flex-end',
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  barTrackToday: {
    borderColor: 'rgba(245, 158, 11, 0.4)',
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
  },
  barFill: {
    width: '100%',
    borderRadius: 6,
  },
  barEmptyDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    marginBottom: 6,
  },
  dayColName: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
  },
  dayColNameActive: {
    color: '#CBD5E1',
    fontWeight: '700',
  },
  dayColNameToday: {
    color: '#F59E0B',
    fontWeight: '900',
  },
  historyMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
  },
  historyMetaItem: {
    alignItems: 'center',
    gap: 2,
    flex: 1,
  },
  metaIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  historyMetaVal: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  historyMetaLbl: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  historyMetaDivider: {
    width: 1,
    height: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  momentumCallout: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  momentumCalloutText: {
    fontSize: 10.5,
    color: 'rgba(255, 255, 255, 0.7)',
    lineHeight: 15,
    flex: 1,
  },
});
