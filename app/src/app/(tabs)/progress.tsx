import React, { useState, useMemo } from 'react';
import {
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  View,
  Platform,
  Modal,
  useWindowDimensions,
} from 'react-native';
import { useRouter, Stack, useFocusEffect } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { useHabitStore } from '@/store/habit-store';
import { PageEntrance } from '@/components/ui/smooth-loader';
import { analyticsApi, MindsetEvaluation, TriggerIntelligence } from '@/services/analytics-api';

const triggerHaptic = (style = Haptics.ImpactFeedbackStyle.Light) => {
  try {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(style);
    }
  } catch (error) {
    // Silent catch
  }
};

export default function ProgressTabScreen() {
  const router = useRouter();
  const { width: windowWidth } = useWindowDimensions();

  const {
    streak,
    mindStrength,
    history,
    lastLoggedStatus,
    aiMindsetAnalysis,
    recentJournals,
    meditationsCount,
    afternoonMeditationDone,
    latestCheckinSummary,
    totalUrgesCount,
    todayUrgesCount,
    dailyUrgeCounts,
  } = useHabitStore();

  const [isCalcModalVisible, setIsCalcModalVisible] = useState<boolean>(false);
  const [mindsetEval, setMindsetEval] = useState<MindsetEvaluation | null>(null);
  const [triggerIntel, setTriggerIntel] = useState<TriggerIntelligence | null>(null);

  // Fetch live Gemini Mindset Score & Trigger Intelligence
  React.useEffect(() => {
    useHabitStore.getState().syncFromDatabase();
    analyticsApi.getTodayMindsetEval()
      .then((data) => setMindsetEval(data))
      .catch(() => {});
    analyticsApi.getTriggerIntelligence()
      .then((data) => setTriggerIntel(data))
      .catch(() => {});
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      useHabitStore.getState().syncFromDatabase();
      analyticsApi.getTodayMindsetEval()
        .then((data) => setMindsetEval(data))
        .catch(() => {});
      analyticsApi.getTriggerIntelligence()
        .then((data) => setTriggerIntel(data))
        .catch(() => {});
    }, [])
  );

  // Computed metrics from real database store
  const totalLogs = history.length;
  const retainedCount = history.filter((h) => h.status === 'retained').length;
  const successRate = totalLogs > 0 ? Math.round((retainedCount / totalLogs) * 100) : (streak > 0 ? 100 : 0);
  const highestStreak = history.length > 0 ? Math.max(...history.map((h) => h.streakAfter), streak) : streak;

  // Recent 7 entries for timeline
  const recentHistory = history.slice(0, 7);

  // Past 7 Days Visual Day-Wise Urge Bar Chart Data Generation
  const urgeChartDays = useMemo(() => {
    const days = [];
    const now = new Date();

    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const dayLabel = d.toLocaleDateString('en-US', { weekday: 'narrow' });

      const matchedUrge = dailyUrgeCounts?.find((item) => item.date === dateStr);
      let count = matchedUrge ? matchedUrge.count : 0;

      if (count === 0 && i === 0 && todayUrgesCount > 0) {
        count = todayUrgesCount;
      }

      let barHeight = 15;
      if (count === 1) barHeight = 50;
      else if (count === 2) barHeight = 75;
      else if (count >= 3) barHeight = 100;

      days.push({
        dateStr,
        dayLabel,
        count,
        barHeight,
        isToday: i === 0,
      });
    }
    return days;
  }, [dailyUrgeCounts, todayUrgesCount]);

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
        {/* Top Header Bar */}
        <View style={styles.headerBar}>
          <TouchableOpacity
            style={styles.backBtn}
            activeOpacity={0.7}
            onPress={() => {
              triggerHaptic();
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace('/(tabs)/home' as any);
              }
            }}
          >
            <Ionicons name="chevron-back" size={24} color="#00E5FF" />
          </TouchableOpacity>

          <View style={styles.headerTitleContainer}>
            <ThemedText style={styles.headerCategory}>AI MINDSET ANALYTICS</ThemedText>
            <ThemedText style={styles.headerTitleText}>Progress Dashboard</ThemedText>
          </View>

          <View style={{ width: 36 }} />
        </View>

        <PageEntrance>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Hero Mindset Score & Radial Gauge Card */}
            <View style={styles.heroCard}>
              <LinearGradient
                colors={['rgba(0, 229, 255, 0.14)', 'rgba(16, 185, 129, 0.08)', 'rgba(3, 7, 18, 0.95)']}
                style={styles.heroCardGradient}
              >
                <View style={styles.heroTopRow}>
                  <View style={styles.heroBadge}>
                    <Ionicons name="sparkles" size={13} color="#00E5FF" />
                    <ThemedText style={styles.heroBadgeText}>AI Mindset Score</ThemedText>
                  </View>
                  <ThemedText style={[styles.statusText, { color: lastLoggedStatus === 'retained' ? '#10B981' : '#94A3B8' }]}>
                    {lastLoggedStatus === 'retained' ? '✓ Clean Today' : streak > 0 ? 'Streak Active' : 'Ready to Start'}
                  </ThemedText>
                </View>

                <View style={styles.scoreRow}>
                  <View style={styles.scoreGaugeCircle}>
                    <ThemedText style={styles.scoreGaugeNum}>{mindsetEval?.score ?? Math.round(mindStrength / 10)}</ThemedText>
                    <ThemedText style={styles.scoreGaugeLabel}>SCORE / 100</ThemedText>
                  </View>

                  <View style={{ flex: 1, gap: 4 }}>
                    <ThemedText style={styles.heroScoreTitle}>
                      Mindset Score: <ThemedText style={{ color: '#00E5FF' }}>{mindsetEval?.score ?? Math.round(mindStrength / 10)}</ThemedText>/100
                    </ThemedText>
                    <ThemedText style={{ fontSize: 11, fontWeight: '800', color: '#10B981' }}>
                      {mindsetEval?.status_title ?? 'Ojas Transmutation Active'}
                    </ThemedText>
                    <ThemedText style={styles.heroScoreSub}>
                      {mindsetEval?.summary || 'Evaluated by Gemini AI from daily check-in, top 3 journals, and 3 PM meditation logs.'}
                    </ThemedText>
                  </View>
                </View>

                {/* AI Energy Transmutation Tip */}
                {mindsetEval?.transmutation_tip && (
                  <View style={styles.aiAnalysisCard}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Ionicons name="sparkles" size={15} color="#00E5FF" />
                      <ThemedText style={styles.aiAnalysisTitle}>ENERGY TRANSMUTATION TIP</ThemedText>
                    </View>
                    <ThemedText style={styles.aiAnalysisBody}>{mindsetEval.transmutation_tip}</ThemedText>
                  </View>
                )}

                {/* AI Trigger Intelligence Defense */}
                {triggerIntel?.tactical_defense && (
                  <View style={[styles.aiAnalysisCard, { backgroundColor: 'rgba(139, 92, 246, 0.08)', borderColor: 'rgba(139, 92, 246, 0.3)' }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Ionicons name="shield-checkmark-outline" size={15} color="#8B5CF6" />
                      <ThemedText style={[styles.aiAnalysisTitle, { color: '#8B5CF6' }]}>TRIGGER INTELLIGENCE ({triggerIntel.peak_risk_window})</ThemedText>
                    </View>
                    <ThemedText style={styles.aiAnalysisBody}>{triggerIntel.tactical_defense}</ThemedText>
                  </View>
                )}

                <TouchableOpacity
                  style={styles.explainerLink}
                  activeOpacity={0.8}
                  onPress={() => {
                    triggerHaptic();
                    setIsCalcModalVisible(true);
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name="information-circle-outline" size={16} color="#00E5FF" />
                    <ThemedText style={styles.explainerLinkText}>How AI Calculates Mindset Score</ThemedText>
                  </View>
                  <Ionicons name="chevron-forward" size={14} color="#00E5FF" />
                </TouchableOpacity>
              </LinearGradient>
            </View>

            {/* 3 PM Meditation & Daily Checklist Activity Widget */}
            <View style={styles.widgetRowContainer}>
              {/* 3 PM Meditation Widget */}
              <View style={[styles.widgetCard, { flex: 1, borderColor: 'rgba(0, 229, 255, 0.25)' }]}>
                <View style={styles.widgetHeader}>
                  <Ionicons name="time-outline" size={16} color="#00E5FF" />
                  <ThemedText style={styles.widgetTitle}>3 PM Meditation</ThemedText>
                </View>
                <ThemedText style={styles.widgetValue}>
                  {afternoonMeditationDone ? '✓ Session Completed' : 'Pending 3 PM Log'}
                </ThemedText>
                <ThemedText style={styles.widgetSub}>
                  Total Meditations: {meditationsCount || 0}
                </ThemedText>
              </View>

              {/* Daily Checklist Summary Widget */}
              <View style={[styles.widgetCard, { flex: 1, borderColor: 'rgba(16, 185, 129, 0.25)' }]}>
                <View style={styles.widgetHeader}>
                  <Ionicons name="checkbox-outline" size={16} color="#10B981" />
                  <ThemedText style={styles.widgetTitle}>Daily Checklist</ThemedText>
                </View>
                <ThemedText style={styles.widgetValue}>
                  {latestCheckinSummary ? `${latestCheckinSummary.mood} Mood` : 'No Check-in Today'}
                </ThemedText>
                <ThemedText style={styles.widgetSub}>
                  {latestCheckinSummary
                    ? `Energy: ${latestCheckinSummary.energy_score}/10 • Focus: ${latestCheckinSummary.focus_score}/10`
                    : 'Log checklist on Home screen'}
                </ThemedText>
              </View>
            </View>

            {/* Top 3 Journal Entries Analyzed Section */}
            <View style={styles.sectionContainer}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <ThemedText style={styles.sectionTitle}>Top 3 Journals (AI Analyzed)</ThemedText>
                <ThemedText style={{ fontSize: 11.5, color: '#64748B' }}>
                  {recentJournals && recentJournals.length > 0 ? `${recentJournals.length} of 3 entries` : '0 entries'}
                </ThemedText>
              </View>

              {recentJournals && recentJournals.length > 0 ? (
                <View style={{ gap: 8 }}>
                  {recentJournals.map((j) => (
                    <View key={j.id} style={styles.journalCard}>
                      <View style={styles.journalHeaderRow}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Ionicons name="journal-outline" size={15} color="#00E5FF" />
                          <ThemedText style={styles.journalTitle}>{j.title}</ThemedText>
                        </View>
                        <View style={styles.moodPill}>
                          <ThemedText style={styles.moodPillText}>{j.mood_tag}</ThemedText>
                        </View>
                      </View>
                      <ThemedText style={styles.journalContent}>{j.content}</ThemedText>
                      <ThemedText style={styles.journalDate}>{j.created_at}</ThemedText>
                    </View>
                  ))}
                </View>
              ) : (
                <View style={styles.emptyCard}>
                  <Ionicons name="book-outline" size={30} color="#00E5FF" />
                  <ThemedText style={styles.emptyTitle}>No Journal Entries Logged</ThemedText>
                  <ThemedText style={styles.emptySub}>
                    Write your daily thoughts to let AI analyze your emotional control and boost your Mindset Score.
                  </ThemedText>
                </View>
              )}
            </View>

            {/* Visual 7-Day Day-Wise Urge Bar Chart */}
            <View style={styles.chartCard}>
              <View style={styles.chartHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="water-outline" size={16} color="#00E5FF" />
                  <ThemedText style={styles.chartTitle}>7-Day Urge Counter Graph</ThemedText>
                </View>
                <ThemedText style={styles.chartSub}>Day-Wise Urges ({todayUrgesCount || 0} today)</ThemedText>
              </View>

              {/* Bar Chart Bars Container */}
              <View style={styles.barChartContainer}>
                {urgeChartDays.map((item, index) => {
                  const hasUrge = item.count > 0;
                  const isHighSpike = item.count >= 3;

                  return (
                    <View key={index} style={styles.barColumn}>
                      <View style={styles.barTrack}>
                        <View
                          style={[
                            styles.barFill,
                            {
                              height: `${item.barHeight}%`,
                              backgroundColor: isHighSpike
                                ? '#EF4444'
                                : hasUrge
                                ? '#00E5FF'
                                : 'rgba(255, 255, 255, 0.08)',
                            },
                          ]}
                        />
                      </View>
                      <ThemedText
                        style={[
                          styles.barDayLabel,
                          item.isToday && { color: '#00E5FF', fontWeight: '900' },
                        ]}
                      >
                        {item.dayLabel}
                      </ThemedText>
                    </View>
                  );
                })}
              </View>

              <View style={styles.chartLegendRow}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: '#00E5FF' }]} />
                  <ThemedText style={styles.legendText}>1-2 Urges Logged</ThemedText>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: '#EF4444' }]} />
                  <ThemedText style={styles.legendText}>3+ High Urge Spike</ThemedText>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: 'rgba(255, 255, 255, 0.15)' }]} />
                  <ThemedText style={styles.legendText}>0 Urges</ThemedText>
                </View>
              </View>
            </View>

            {/* Key Recovery Metrics 2x2 Grid */}
            <View style={styles.sectionContainer}>
              <ThemedText style={styles.sectionTitle}>Key Recovery Metrics</ThemedText>

              <View style={styles.metricsGrid}>
                {/* 1. Current Streak */}
                <View style={[styles.metricTile, { borderColor: 'rgba(0, 229, 255, 0.3)', backgroundColor: 'rgba(11, 15, 25, 0.95)' }]}>
                  <View style={styles.tileHeader}>
                    <Ionicons name="flame" size={18} color="#00E5FF" />
                    <ThemedText style={[styles.tileMetricNum, { color: '#00E5FF' }]}>{streak}d</ThemedText>
                  </View>
                  <ThemedText style={styles.tileTitle}>Current Streak</ThemedText>
                  <ThemedText style={styles.tileSub}>Active clean days</ThemedText>
                </View>

                {/* 2. Highest Streak */}
                <View style={[styles.metricTile, { borderColor: 'rgba(245, 158, 11, 0.3)', backgroundColor: 'rgba(11, 15, 25, 0.95)' }]}>
                  <View style={styles.tileHeader}>
                    <Ionicons name="trophy" size={18} color="#F59E0B" />
                    <ThemedText style={[styles.tileMetricNum, { color: '#F59E0B' }]}>{highestStreak}d</ThemedText>
                  </View>
                  <ThemedText style={styles.tileTitle}>Best Record</ThemedText>
                  <ThemedText style={styles.tileSub}>Longest clean streak</ThemedText>
                </View>

                {/* 3. Urge Counter (Red Card) */}
                <View style={[styles.metricTile, { borderColor: 'rgba(239, 68, 68, 0.35)', backgroundColor: 'rgba(11, 15, 25, 0.95)' }]}>
                  <View style={styles.tileHeader}>
                    <Ionicons name="flame-outline" size={18} color="#EF4444" />
                    <ThemedText style={[styles.tileMetricNum, { color: '#EF4444' }]}>{totalUrgesCount || 0}</ThemedText>
                  </View>
                  <ThemedText style={styles.tileTitle}>Urge Counter</ThemedText>
                  <ThemedText style={styles.tileSub}>{todayUrgesCount || 0} urges today • +1 on beat</ThemedText>
                </View>

                {/* 4. Total Check-ins */}
                <View style={[styles.metricTile, { borderColor: 'rgba(139, 92, 246, 0.3)', backgroundColor: 'rgba(11, 15, 25, 0.95)' }]}>
                  <View style={styles.tileHeader}>
                    <Ionicons name="calendar-outline" size={18} color="#8B5CF6" />
                    <ThemedText style={[styles.tileMetricNum, { color: '#8B5CF6' }]}>{totalLogs}</ThemedText>
                  </View>
                  <ThemedText style={styles.tileTitle}>Total Logged</ThemedText>
                  <ThemedText style={styles.tileSub}>Recorded check-ins</ThemedText>
                </View>
              </View>
            </View>

            {/* Activity Log & History Section */}
            <View style={styles.sectionContainer}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <ThemedText style={styles.sectionTitle}>Recent Activity History</ThemedText>
                <ThemedText style={{ fontSize: 11.5, color: '#64748B' }}>
                  {totalLogs > 0 ? `${totalLogs} total entries` : 'No logs yet'}
                </ThemedText>
              </View>

              {recentHistory.length > 0 ? (
                <View style={styles.historyList}>
                  {recentHistory.map((item, index) => (
                    <View key={`${item.date}-${index}`} style={styles.historyCard}>
                      <View
                        style={[
                          styles.historyStatusDot,
                          { backgroundColor: item.status === 'retained' ? '#10B981' : '#EF4444' },
                        ]}
                      >
                        <Ionicons
                          name={item.status === 'retained' ? 'checkmark' : 'close'}
                          size={12}
                          color="#000000"
                        />
                      </View>
                      <View style={{ flex: 1, gap: 2 }}>
                        <ThemedText style={styles.historyDateText}>
                          {new Date(item.date).toLocaleDateString('en-US', {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </ThemedText>
                        <ThemedText style={styles.historySubText}>
                          {item.status === 'retained' ? 'Logged clean day' : 'Relapse recorded'}
                        </ThemedText>
                      </View>
                      <View style={styles.historyBadge}>
                        <ThemedText style={styles.historyBadgeText}>
                          Streak: {item.streakAfter}d
                        </ThemedText>
                      </View>
                    </View>
                  ))}
                </View>
              ) : (
                <View style={styles.emptyCard}>
                  <Ionicons name="calendar-clear-outline" size={32} color="#00E5FF" />
                  <ThemedText style={styles.emptyTitle}>No Activity Logged Yet</ThemedText>
                  <ThemedText style={styles.emptySub}>
                    Use the daily check-in on the Home screen to log your status and track your journey timeline here.
                  </ThemedText>
                </View>
              )}
            </View>
          </ScrollView>
        </PageEntrance>
      </SafeAreaView>

      {/* Explainer Modal */}
      <Modal
        visible={isCalcModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsCalcModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setIsCalcModalVisible(false)}
        >
          <View style={styles.modalContent}>
            <View style={styles.drawerHandle} />

            <View style={styles.modalHeader}>
              <Ionicons name="information-circle" size={22} color="#00E5FF" />
              <ThemedText style={styles.modalTitle}>How AI Calculates Mindset Score</ThemedText>
            </View>

            <View style={styles.formulaBox}>
              <ThemedText style={styles.formulaHeader}>GEMINI MULTI-VARIABLE EVALUATION (DATABASE SYNCED)</ThemedText>
              <ThemedText style={styles.formulaText}>
                Your Mindset Score ({mindsetEval?.score ?? 85}/100) is evaluated live from your 1-day check-in, recent 3 journals, 3 PM meditation logs, and urge control history.
              </ThemedText>
            </View>

            <View style={styles.calcStep}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <ThemedText style={styles.stepName}>1. Daily Check-in Checklist (30 Points)</ThemedText>
                <ThemedText style={{ fontSize: 13, fontWeight: '900', color: '#00E5FF' }}>
                  {mindsetEval?.checkin_score ?? 30}/30 PTS
                </ThemedText>
              </View>
              <ThemedText style={styles.stepDetail}>Evaluates mood, energy, focus, stress, and sleep scores logged every day.</ThemedText>
            </View>

            <View style={styles.calcStep}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <ThemedText style={styles.stepName}>2. Top 3 Journal Entries (20 Points)</ThemedText>
                <ThemedText style={{ fontSize: 13, fontWeight: '900', color: '#10B981' }}>
                  {mindsetEval?.journal_score ?? 20}/20 PTS
                </ThemedText>
              </View>
              <ThemedText style={styles.stepDetail}>AI analyzes emotional clarity, self-awareness, and sentiment across your top 3 journals.</ThemedText>
            </View>

            <View style={styles.calcStep}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <ThemedText style={styles.stepName}>3. 3 PM Meditation & Urge Rescue (50 Points)</ThemedText>
                <ThemedText style={{ fontSize: 13, fontWeight: '900', color: '#8B5CF6' }}>
                  {mindsetEval?.meditation_urge_score ?? 35}/50 PTS
                </ThemedText>
              </View>
              <ThemedText style={styles.stepDetail}>Tracks afternoon mindfulness sessions, urges defeated, and energy transmutation control.</ThemedText>
            </View>

            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={() => setIsCalcModalVisible(false)}
            >
              <ThemedText style={styles.modalCloseText}>Got It</ThemedText>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  safeArea: {
    flex: 1,
  },
  headerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 229, 255, 0.15)',
    backgroundColor: '#030712',
  },
  backBtn: {
    backgroundColor: 'transparent',
    padding: 4,
    justifyContent: 'center',
    alignItems: 'center',
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
  headerTitleText: {
    fontSize: 17,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: -0.3,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 32,
    gap: 18,
  },

  /* Hero Score Card */
  heroCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.25)',
    overflow: 'hidden',
    backgroundColor: 'rgba(11, 15, 25, 0.95)',
  },
  heroCardGradient: {
    padding: 16,
    gap: 14,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(0, 229, 255, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.25)',
  },
  heroBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#00E5FF',
  },
  statusText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  scoreGaugeCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(0, 229, 255, 0.1)',
    borderWidth: 2.5,
    borderColor: '#00E5FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scoreGaugeNum: {
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '900',
    color: '#00E5FF',
    includeFontPadding: false,
  },
  scoreGaugeLabel: {
    fontSize: 8.5,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.5,
  },
  heroScoreTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#ffffff',
  },
  heroScoreSub: {
    fontSize: 11.5,
    color: '#94A3B8',
    lineHeight: 15,
  },
  aiAnalysisCard: {
    backgroundColor: 'rgba(0, 229, 255, 0.08)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.25)',
    padding: 10,
    gap: 4,
  },
  aiAnalysisTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#00E5FF',
    letterSpacing: 1,
  },
  aiAnalysisBody: {
    fontSize: 11.5,
    color: '#E2E8F0',
    lineHeight: 16,
  },
  explainerLink: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  explainerLinkText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#00E5FF',
  },

  /* Widgets */
  widgetRowContainer: {
    flexDirection: 'row',
    gap: 10,
  },
  widgetCard: {
    backgroundColor: 'rgba(11, 15, 25, 0.95)',
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    gap: 4,
  },
  widgetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  widgetTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  widgetValue: {
    fontSize: 13,
    fontWeight: '800',
    color: '#00E5FF',
    marginTop: 2,
  },
  widgetSub: {
    fontSize: 10.5,
    color: '#94A3B8',
  },

  /* Top 3 Journals */
  journalCard: {
    backgroundColor: 'rgba(11, 15, 25, 0.95)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.2)',
    padding: 12,
    gap: 6,
  },
  journalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  journalTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  moodPill: {
    backgroundColor: 'rgba(0, 229, 255, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  moodPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#00E5FF',
  },
  journalContent: {
    fontSize: 11.5,
    color: '#94A3B8',
    lineHeight: 16,
  },
  journalDate: {
    fontSize: 10,
    color: '#64748B',
    textAlign: 'right',
  },

  /* Visual Bar Chart Card */
  chartCard: {
    backgroundColor: 'rgba(11, 15, 25, 0.95)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.2)',
    padding: 16,
    gap: 14,
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  chartTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  chartSub: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  barChartContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 110,
    paddingHorizontal: 8,
    paddingTop: 10,
  },
  barColumn: {
    alignItems: 'center',
    flex: 1,
    gap: 6,
  },
  barTrack: {
    width: 14,
    height: 80,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 7,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  barFill: {
    width: '100%',
    borderRadius: 7,
  },
  barDayLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  chartLegendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 10.5,
    color: '#94A3B8',
    fontWeight: '600',
  },

  /* Metrics Grid */
  sectionContainer: {
    gap: 10,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metricTile: {
    width: '48%',
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    gap: 4,
  },
  tileHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tileMetricNum: {
    fontSize: 18,
    fontWeight: '900',
  },
  tileTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 2,
  },
  tileSub: {
    fontSize: 10.5,
    color: '#94A3B8',
  },

  /* Activity History */
  historyList: {
    gap: 8,
  },
  historyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(11, 15, 25, 0.95)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 12,
    gap: 12,
  },
  historyStatusDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyDateText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  historySubText: {
    fontSize: 11,
    color: '#94A3B8',
  },
  historyBadge: {
    backgroundColor: 'rgba(0, 229, 255, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.2)',
  },
  historyBadgeText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#00E5FF',
  },
  emptyCard: {
    backgroundColor: 'rgba(11, 15, 25, 0.95)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.2)',
    padding: 24,
    alignItems: 'center',
    gap: 8,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  emptySub: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 16,
  },

  /* Modal */
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.82)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#0F172A',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.3)',
    padding: 20,
    gap: 14,
  },
  drawerHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignSelf: 'center',
    marginBottom: 4,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  formulaBox: {
    backgroundColor: 'rgba(0, 229, 255, 0.1)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.25)',
    padding: 12,
    gap: 4,
  },
  formulaHeader: {
    fontSize: 11,
    fontWeight: '800',
    color: '#00E5FF',
    letterSpacing: 1,
  },
  formulaText: {
    fontSize: 12,
    color: '#94A3B8',
    lineHeight: 16,
  },
  calcStep: {
    gap: 2,
  },
  stepName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  stepDetail: {
    fontSize: 12,
    color: '#94A3B8',
    lineHeight: 16,
  },
  modalCloseBtn: {
    backgroundColor: '#00E5FF',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 6,
  },
  modalCloseText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#000000',
  },
});
