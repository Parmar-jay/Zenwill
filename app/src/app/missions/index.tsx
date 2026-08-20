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
import { useRouter, Stack } from 'expo-router';
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

  const completedCount = useMemo(() => {
    let c = 0;
    if (todayTasks?.checkin) c++;
    if (todayTasks?.meditation) c++;
    if (todayTasks?.journal) c++;
    if (todayTasks?.coach) c++;
    if (todayTasks?.rescue) c++;
    return c;
  }, [todayTasks]);

  const todayPoints = completedCount * 20; // 5 tasks * 20 PTS = 100 PTS max
  const allCompleted = completedCount === 5;
  const progressPercent = Math.round((completedCount / 5) * 100);

  const weeklyStats = useMemo(() => getWeeklyStats(), [todayTasks]);

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
      pts: 20,
      icon: 'create-outline' as const,
      color: '#6366F1',
      route: '/daily-checkin',
      actionLabel: 'Start Log',
      done: todayTasks?.checkin,
    },
    {
      id: 'meditation' as keyof DailyTasks,
      title: 'Pranayama Breathwork',
      subtitle: '10 min deep breathwork & craving wave control',
      pts: 20,
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
      pts: 20,
      icon: 'book-outline' as const,
      color: '#F59E0B',
      route: '/journal',
      actionLabel: 'Write Entry',
      done: todayTasks?.journal,
    },
    {
      id: 'coach' as keyof DailyTasks,
      title: 'AI Coach Guidance',
      subtitle: 'Consult your AI mindset strategist for daily clarity',
      pts: 20,
      icon: 'chatbubble-ellipses-outline' as const,
      color: '#8B5CF6',
      route: '/coach/chat',
      actionLabel: 'Chat Coach',
      done: todayTasks?.coach,
    },
    {
      id: 'rescue' as keyof DailyTasks,
      title: 'Urge Control & Reset',
      subtitle: 'Practice urge surfing or 5-4-3-2-1 grounding protocol',
      pts: 20,
      icon: 'shield-outline' as const,
      color: '#EF4444',
      route: '/emergency',
      actionLabel: 'Reset Urge',
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
            <ThemedText style={styles.headerTitle}>Daily Missions</ThemedText>
            <ThemedText style={styles.headerSubtitle}>5 Tasks • 100 PTS Total</ThemedText>
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
                <ThemedText style={styles.heroMainTitle}>{todayPoints} / 100 PTS</ThemedText>
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
                  PERFECT DAY ACHIEVED! 100/100 PTS UNLOCKED
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
                  <View style={[styles.iconContainer, { backgroundColor: item.done ? 'rgba(16, 185, 129, 0.15)' : item.color + '18' }]}>
                    <Ionicons
                      name={item.done ? 'checkmark-circle' : item.icon}
                      size={20}
                      color={item.done ? '#10B981' : item.color}
                    />
                  </View>

                  <View style={styles.taskTextCol}>
                    <View style={styles.taskTitleRow}>
                      <ThemedText style={[styles.taskTitle, item.done && styles.taskTitleDone]}>
                        {item.title}
                      </ThemedText>
                      <View style={[styles.ptsBadge, item.done && styles.ptsBadgeDone]}>
                        <ThemedText style={[styles.ptsBadgeText, item.done && styles.ptsBadgeTextDone]}>
                          +{item.pts} PTS
                        </ThemedText>
                      </View>
                    </View>
                    <ThemedText style={styles.taskSubtitle}>{item.subtitle}</ThemedText>
                  </View>
                </View>

                {item.done ? (
                  <View style={styles.donePill}>
                    <Ionicons name="checkmark-sharp" size={14} color="#10B981" />
                    <ThemedText style={styles.donePillText}>Done</ThemedText>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: item.color }]}
                    activeOpacity={0.8}
                    onPress={() => handleTaskAction(item.route)}
                  >
                    <ThemedText style={styles.actionBtnText}>{item.actionLabel}</ThemedText>
                    <Ionicons name="chevron-forward" size={14} color="#FFFFFF" style={{ marginLeft: 2 }} />
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </View>

          {/* Minimalist 7-Day History & Analysis */}
          <View style={styles.sectionHeaderRow}>
            <ThemedText style={styles.sectionTitle}>7-DAY CONSISTENCY ANALYSIS</ThemedText>
          </View>

          <View style={styles.historyCard}>
            <View style={styles.weeklyGraphRow}>
              {weeklyStats.map((stat, idx) => {
                const isToday = idx === 6;
                return (
                  <View key={stat.dateStr} style={styles.dayCol}>
                    <ThemedText style={styles.dayColPts}>
                      {stat.points > 0 ? `${stat.points}` : '0'}
                    </ThemedText>
                    <View style={styles.barTrack}>
                      <View
                        style={[
                          styles.barFill,
                          { height: `${Math.max(10, stat.percent)}%` },
                          stat.percent === 100 && styles.barFillComplete,
                          isToday && styles.barFillToday,
                        ]}
                      />
                    </View>
                    <ThemedText style={[styles.dayColName, isToday && styles.dayColNameToday]}>
                      {stat.dayName}
                    </ThemedText>
                  </View>
                );
              })}
            </View>

            <View style={styles.historyMetaRow}>
              <View style={styles.historyMetaItem}>
                <ThemedText style={styles.historyMetaVal}>{completedCount * 20} PTS</ThemedText>
                <ThemedText style={styles.historyMetaLbl}>Points Today</ThemedText>
              </View>
              <View style={styles.historyMetaDivider} />
              <View style={styles.historyMetaItem}>
                <ThemedText style={styles.historyMetaVal}>{progressPercent}%</ThemedText>
                <ThemedText style={styles.historyMetaLbl}>Completion Rate</ThemedText>
              </View>
              <View style={styles.historyMetaDivider} />
              <View style={styles.historyMetaItem}>
                <ThemedText style={styles.historyMetaVal}>{streak} Days</ThemedText>
                <ThemedText style={styles.historyMetaLbl}>Active Streak</ThemedText>
              </View>
            </View>
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
    marginLeft: 12,
  },
  headerTitle: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '700',
  },
  headerSubtitle: {
    color: '#94A3B8',
    fontSize: 12,
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
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  taskCardDone: {
    backgroundColor: 'rgba(16, 185, 129, 0.05)',
    borderColor: 'rgba(16, 185, 129, 0.2)',
  },
  taskCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  iconContainer: {
    width: 42,
    height: 42,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  taskTextCol: {
    flex: 1,
  },
  taskTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  taskTitle: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '700',
  },
  taskTitleDone: {
    color: '#94A3B8',
  },
  ptsBadge: {
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 8,
  },
  ptsBadgeDone: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  },
  ptsBadgeText: {
    color: '#818CF8',
    fontSize: 10,
    fontWeight: '700',
  },
  ptsBadgeTextDone: {
    color: '#10B981',
  },
  taskSubtitle: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 2,
  },
  actionBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  donePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: 'rgba(16, 185, 129, 0.3)',
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  donePillText: {
    color: '#10B981',
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 4,
  },
  historyCard: {
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  weeklyGraphRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 110,
    paddingBottom: 8,
  },
  dayCol: {
    alignItems: 'center',
    flex: 1,
    height: '100%',
    justifyContent: 'flex-end',
  },
  dayColPts: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '600',
    marginBottom: 4,
  },
  barTrack: {
    width: 8,
    height: 60,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 4,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  barFill: {
    width: '100%',
    backgroundColor: '#6366F1',
    borderRadius: 4,
  },
  barFillComplete: {
    backgroundColor: '#10B981',
  },
  barFillToday: {
    backgroundColor: '#F59E0B',
  },
  dayColName: {
    color: '#64748B',
    fontSize: 11,
    marginTop: 6,
  },
  dayColNameToday: {
    color: '#F59E0B',
    fontWeight: '700',
  },
  historyMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
  },
  historyMetaItem: {
    alignItems: 'center',
  },
  historyMetaVal: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '700',
  },
  historyMetaLbl: {
    color: '#64748B',
    fontSize: 11,
    marginTop: 2,
  },
  historyMetaDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
});
