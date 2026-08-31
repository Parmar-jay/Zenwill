import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  View,
  Platform,
  Modal,
} from 'react-native';
import { useRouter, Stack, useFocusEffect } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { SafeAreaView } from 'react-native-safe-area-context';
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

  const {
    streak,
    maxStreak,
    mindStrength,
    history,
    lastLoggedStatus,
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

  const loadAnalyticsData = useCallback(() => {
    useHabitStore.getState().syncFromDatabase();
    analyticsApi.getTodayMindsetEval()
      .then((data) => setMindsetEval(data))
      .catch(() => {});
    analyticsApi.getTriggerIntelligence()
      .then((data) => setTriggerIntel(data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadAnalyticsData();
  }, [loadAnalyticsData]);

  useFocusEffect(
    useCallback(() => {
      loadAnalyticsData();
    }, [loadAnalyticsData])
  );

  // Computed metrics from real database store
  const totalLogs = history.length;
  const retainedLogs = history.filter((h) => h.status === 'retained').length;
  const successRate = totalLogs > 0 ? Math.round((retainedLogs / totalLogs) * 100) : (streak > 0 ? 100 : 0);
  const highestStreak = Math.max(
    maxStreak || 0,
    streak || 0,
    ...(history.map((h) => (typeof h.streakAfter === 'number' ? h.streakAfter : 0)))
  );

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

  const scoreValue = mindsetEval?.score ?? Math.min(100, Math.max(10, Math.round((mindStrength || 500) / 10)));

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Top Header Bar */}
      <SafeAreaView style={styles.headerSafeArea} edges={['top']}>
        <View style={styles.headerContainer}>
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

          <View style={styles.headerTitleWrapper}>
            <ThemedText style={styles.headerCategory}>ANALYTICS & PROGRESS</ThemedText>
            <ThemedText style={styles.headerTitleText}>Progress Dashboard</ThemedText>
          </View>

          <View style={{ width: 36 }} />
        </View>
      </SafeAreaView>

      <PageEntrance>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.contentContainer}>

            {/* 1. Mindset Score & Transmutation Overview Card */}
            <View style={styles.darkCard}>
              <View style={styles.cardHeaderRow}>
                <View style={styles.headerBadgeRow}>
                  <Ionicons name="sparkles" size={14} color="#00E5FF" />
                  <ThemedText style={styles.cardCategoryTitle}>MINDSET PROGRESS INTELLIGENCE</ThemedText>
                </View>
                <View style={[styles.statusPill, { backgroundColor: lastLoggedStatus === 'retained' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(255, 255, 255, 0.05)' }]}>
                  <ThemedText style={[styles.statusPillText, { color: lastLoggedStatus === 'retained' ? '#10B981' : '#94A3B8' }]}>
                    {lastLoggedStatus === 'retained' ? '✓ Clean Today' : streak > 0 ? `${streak}d Streak` : 'Ready to Start'}
                  </ThemedText>
                </View>
              </View>

              {/* Score Display & Summary */}
              <View style={styles.scoreRow}>
                <View style={styles.scoreGaugeBox}>
                  <ThemedText style={styles.scoreNumber}>{scoreValue}</ThemedText>
                  <ThemedText style={styles.scoreLabel}>SCORE / 100</ThemedText>
                </View>

                <View style={{ flex: 1, gap: 4 }}>
                  <ThemedText style={styles.scoreStatusTitle}>
                    {mindsetEval?.status_title ?? (streak > 7 ? 'Ojas Transmutation Active' : 'Building Neural Resilience')}
                  </ThemedText>
                  <ThemedText style={styles.scoreDescriptionText}>
                    {mindsetEval?.summary || 'Evaluated live from daily check-ins, journals, yogic meditation, and urge control discipline.'}
                  </ThemedText>
                </View>
              </View>

              {/* Progress Breakdown Bars */}
              <View style={styles.breakdownContainer}>
                <View style={styles.breakdownRow}>
                  <ThemedText style={styles.breakdownLabel}>Daily Checklist Points</ThemedText>
                  <ThemedText style={styles.breakdownValue}>{mindsetEval?.checkin_score ?? (latestCheckinSummary ? 30 : 0)}/30 PTS</ThemedText>
                </View>
                <View style={styles.breakdownTrack}>
                  <View style={[styles.breakdownFill, { width: `${((mindsetEval?.checkin_score ?? (latestCheckinSummary ? 30 : 0)) / 30) * 100}%`, backgroundColor: '#00E5FF' }]} />
                </View>
              </View>

              {/* Actionable Transmutation Tip */}
              {mindsetEval?.transmutation_tip && (
                <View style={styles.transmutationBox}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name="flash" size={13} color="#00E5FF" />
                    <ThemedText style={styles.transmutationTitle}>DAILY TRANSMUTATION PROTOCOL</ThemedText>
                  </View>
                  <ThemedText style={styles.transmutationBody}>{mindsetEval.transmutation_tip}</ThemedText>
                </View>
              )}

              <TouchableOpacity
                style={styles.explainerLink}
                activeOpacity={0.7}
                onPress={() => {
                  triggerHaptic();
                  setIsCalcModalVisible(true);
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="information-circle-outline" size={15} color="#94A3B8" />
                  <ThemedText style={styles.explainerLinkText}>How Progress Intelligence Calculates Score</ThemedText>
                </View>
                <Ionicons name="chevron-forward" size={14} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* 2. Trigger Intelligence & Vulnerability Radar Card */}
            {triggerIntel && (
              <View style={styles.darkCard}>
                <View style={styles.cardHeaderRow}>
                  <View style={styles.headerBadgeRow}>
                    <Ionicons name="shield-checkmark" size={14} color="#C084FC" />
                    <ThemedText style={[styles.cardCategoryTitle, { color: '#C084FC' }]}>TRIGGER INTELLIGENCE</ThemedText>
                  </View>
                  {triggerIntel.risk_level && (
                    <View style={[
                      styles.statusPill,
                      triggerIntel.risk_level.includes('CRITICAL') ? { backgroundColor: 'rgba(239, 68, 68, 0.15)', borderColor: 'rgba(239, 68, 68, 0.3)' }
                      : triggerIntel.risk_level.includes('ELEVATED') ? { backgroundColor: 'rgba(245, 158, 11, 0.15)', borderColor: 'rgba(245, 158, 11, 0.3)' }
                      : { backgroundColor: 'rgba(16, 185, 129, 0.15)', borderColor: 'rgba(16, 185, 129, 0.3)' }
                    ]}>
                      <ThemedText style={[
                        styles.statusPillText,
                        triggerIntel.risk_level.includes('CRITICAL') ? { color: '#EF4444' }
                        : triggerIntel.risk_level.includes('ELEVATED') ? { color: '#F59E0B' }
                        : { color: '#10B981' }
                      ]}>
                        {triggerIntel.risk_level}
                      </ThemedText>
                    </View>
                  )}
                </View>

                {/* Peak Window & Danger Timing */}
                <View style={styles.intelTimingRow}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <ThemedText style={styles.intelTimingSub}>NEXT PREDICTED TRIGGER</ThemedText>
                    <ThemedText style={styles.intelTimingTime}>
                      {triggerIntel.next_predicted_window || triggerIntel.peak_risk_window || 'Tonight, 10:30 PM - 12:30 AM'}
                    </ThemedText>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 2 }}>
                    <ThemedText style={styles.intelTimingSub}>
                      {triggerIntel.today_status_label ? 'TODAY\'S PHASE' : 'CRITICAL PHASE'}
                    </ThemedText>
                    <ThemedText style={styles.intelTimingDay}>
                      {triggerIntel.today_weekday ? `${triggerIntel.today_weekday} (${triggerIntel.highest_risk_day})` : (triggerIntel.highest_risk_day || 'Weekends')}
                    </ThemedText>
                  </View>
                </View>

                {/* Primary Vulnerability Statement */}
                {triggerIntel.primary_vulnerability && (
                  <View style={styles.vulnerabilityBox}>
                    <ThemedText style={styles.vulnerabilityLabel}>Primary Vulnerability:</ThemedText>
                    <ThemedText style={styles.vulnerabilityValue}>{triggerIntel.primary_vulnerability}</ThemedText>
                  </View>
                )}

                {/* Active Catalyst Trigger Chips */}
                {triggerIntel.active_triggers && triggerIntel.active_triggers.length > 0 && (
                  <View style={styles.triggerChipsRow}>
                    {triggerIntel.active_triggers.map((t, idx) => (
                      <View key={idx} style={styles.triggerChip}>
                        <ThemedText style={styles.triggerChipText}>{t}</ThemedText>
                      </View>
                    ))}
                  </View>
                )}

                {/* Tactical Protocol Box */}
                <View style={styles.protocolBox}>
                  <ThemedText style={styles.protocolHeader}>TACTICAL DEFENSE PROTOCOL</ThemedText>
                  <ThemedText style={styles.protocolText}>{triggerIntel.tactical_defense}</ThemedText>
                </View>

                {/* Direct Link to Full Trigger Intelligence Suite */}
                <TouchableOpacity
                  style={styles.explainerLink}
                  activeOpacity={0.7}
                  onPress={() => {
                    triggerHaptic();
                    router.push('/trigger-intelligence' as any);
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name="analytics-outline" size={15} color="#00E5FF" />
                    <ThemedText style={[styles.explainerLinkText, { color: '#00E5FF' }]}>View Full Neural Trigger Breakdown</ThemedText>
                  </View>
                  <Ionicons name="chevron-forward" size={14} color="#00E5FF" />
                </TouchableOpacity>
              </View>
            )}

            {/* 3. Core Purpose Alignment Banner */}
            {triggerIntel?.purpose_alignment_quote && (
              <View style={[styles.darkCard, { borderColor: 'rgba(0, 229, 255, 0.2)' }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="compass-outline" size={15} color="#00E5FF" />
                  <ThemedText style={[styles.cardCategoryTitle, { color: '#00E5FF' }]}>PURPOSE & VISION ALIGNMENT</ThemedText>
                </View>
                <ThemedText style={styles.purposeText}>
                  "{triggerIntel.purpose_alignment_quote}"
                </ThemedText>
              </View>
            )}

            {/* 4. 3 PM Meditation & Daily Checklist Activity Row */}
            <View style={styles.activitiesRow}>
              {/* 3 PM Meditation */}
              <TouchableOpacity
                style={[styles.darkCard, { flex: 1, padding: 14 }]}
                activeOpacity={0.8}
                onPress={() => {
                  triggerHaptic();
                  router.push('/meditation' as any);
                }}
              >
                <View style={styles.activityHeader}>
                  <Ionicons name="time-outline" size={15} color="#00E5FF" />
                  <ThemedText style={styles.activityTitle}>3 PM Meditation</ThemedText>
                </View>
                <ThemedText style={styles.activityStatus}>
                  {afternoonMeditationDone ? '✓ Completed' : 'Pending 3 PM'}
                </ThemedText>
                <ThemedText style={styles.activitySub}>
                  {meditationsCount || 0} total sessions logged
                </ThemedText>
              </TouchableOpacity>

              {/* Daily Checklist */}
              <TouchableOpacity
                style={[styles.darkCard, { flex: 1, padding: 14 }]}
                activeOpacity={0.8}
                onPress={() => {
                  triggerHaptic();
                  router.push('/daily-checkin' as any);
                }}
              >
                <View style={styles.activityHeader}>
                  <Ionicons name="checkbox-outline" size={15} color="#10B981" />
                  <ThemedText style={styles.activityTitle}>Daily Checklist</ThemedText>
                </View>
                <ThemedText style={styles.activityStatus}>
                  {latestCheckinSummary ? `${latestCheckinSummary.mood} Mood` : 'No Check-in'}
                </ThemedText>
                <ThemedText style={styles.activitySub}>
                  {latestCheckinSummary
                    ? `Energy ${latestCheckinSummary.energy_score}/10 • Focus ${latestCheckinSummary.focus_score}/10`
                    : 'Tap to check-in'}
                </ThemedText>
              </TouchableOpacity>
            </View>

            {/* 5. Key Recovery Metrics 2x2 Bento Grid */}
            <View style={styles.sectionContainer}>
              <ThemedText style={styles.sectionTitle}>Key Recovery Metrics</ThemedText>

              <View style={styles.metricsGrid}>
                {/* 1. Current Streak */}
                <View style={styles.metricCard}>
                  <View style={styles.metricHeader}>
                    <ThemedText style={styles.metricLabel}>Current Streak</ThemedText>
                    <Ionicons name="flame" size={16} color="#00E5FF" />
                  </View>
                  <ThemedText style={[styles.metricNumber, { color: '#00E5FF' }]}>{streak}d</ThemedText>
                  <ThemedText style={styles.metricSub}>Active clean days</ThemedText>
                </View>

                {/* 2. Highest Streak */}
                <View style={styles.metricCard}>
                  <View style={styles.metricHeader}>
                    <ThemedText style={styles.metricLabel}>Best Record</ThemedText>
                    <Ionicons name="trophy" size={16} color="#F59E0B" />
                  </View>
                  <ThemedText style={[styles.metricNumber, { color: '#F59E0B' }]}>{highestStreak}d</ThemedText>
                  <ThemedText style={styles.metricSub}>Longest clean streak</ThemedText>
                </View>

                {/* 3. Urge Counter */}
                <View style={styles.metricCard}>
                  <View style={styles.metricHeader}>
                    <ThemedText style={styles.metricLabel}>Urges Defeated</ThemedText>
                    <Ionicons name="shield-checkmark" size={16} color="#10B981" />
                  </View>
                  <ThemedText style={[styles.metricNumber, { color: '#10B981' }]}>{totalUrgesCount || 0}</ThemedText>
                  <ThemedText style={styles.metricSub}>{todayUrgesCount || 0} urges today • +1 on beat</ThemedText>
                </View>

                {/* 4. Total Logged Check-ins */}
                <View style={styles.metricCard}>
                  <View style={styles.metricHeader}>
                    <ThemedText style={styles.metricLabel}>Total Logged</ThemedText>
                    <Ionicons name="calendar" size={16} color="#8B5CF6" />
                  </View>
                  <ThemedText style={[styles.metricNumber, { color: '#8B5CF6' }]}>{totalLogs}</ThemedText>
                  <ThemedText style={styles.metricSub}>{successRate}% retention rate</ThemedText>
                </View>
              </View>
            </View>

            {/* 6. 7-Day Day-Wise Urge Activity Graph */}
            <View style={styles.darkCard}>
              <View style={styles.cardHeaderRow}>
                <View style={styles.headerBadgeRow}>
                  <Ionicons name="bar-chart" size={14} color="#00E5FF" />
                  <ThemedText style={styles.cardCategoryTitle}>7-DAY URGE ACTIVITY GRAPH</ThemedText>
                </View>
                <ThemedText style={styles.chartCountText}>({todayUrgesCount || 0} today)</ThemedText>
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
                  <ThemedText style={styles.legendText}>1–2 Urges</ThemedText>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: '#EF4444' }]} />
                  <ThemedText style={styles.legendText}>3+ High Spike</ThemedText>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: 'rgba(255, 255, 255, 0.15)' }]} />
                  <ThemedText style={styles.legendText}>0 Urges</ThemedText>
                </View>
              </View>
            </View>

            {/* 7. Top 3 Journals (AI Analyzed) */}
            <View style={styles.sectionContainer}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <ThemedText style={styles.sectionTitle}>Top 3 Journals (AI Analyzed)</ThemedText>
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => {
                    triggerHaptic();
                    router.push('/journal' as any);
                  }}
                >
                  <ThemedText style={{ fontSize: 11, fontWeight: '700', color: '#00E5FF' }}>
                    {recentJournals && recentJournals.length > 0 ? `${recentJournals.length} entries →` : '+ Write Journal'}
                  </ThemedText>
                </TouchableOpacity>
              </View>

              {recentJournals && recentJournals.length > 0 ? (
                <View style={{ gap: 8 }}>
                  {recentJournals.map((j) => (
                    <View key={j.id} style={styles.journalCard}>
                      <View style={styles.journalHeaderRow}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Ionicons name="journal" size={14} color="#00E5FF" />
                          <ThemedText style={styles.journalTitle}>{j.title}</ThemedText>
                        </View>
                        {j.mood_tag && (
                          <View style={styles.moodPill}>
                            <ThemedText style={styles.moodPillText}>{j.mood_tag}</ThemedText>
                          </View>
                        )}
                      </View>
                      <ThemedText style={styles.journalContent} numberOfLines={2}>{j.content}</ThemedText>
                      <ThemedText style={styles.journalDate}>{j.created_at}</ThemedText>
                    </View>
                  ))}
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.emptyCard}
                  activeOpacity={0.8}
                  onPress={() => {
                    triggerHaptic();
                    router.push('/journal' as any);
                  }}
                >
                  <Ionicons name="book-outline" size={24} color="#00E5FF" />
                  <ThemedText style={styles.emptyTitle}>No Journal Entries Logged</ThemedText>
                  <ThemedText style={styles.emptySub}>
                    Tap here to record your first reflection and boost your AI Mindset evaluation.
                  </ThemedText>
                </TouchableOpacity>
              )}
            </View>

            {/* 8. Recent Activity History */}
            <View style={styles.sectionContainer}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <ThemedText style={styles.sectionTitle}>Recent Activity History</ThemedText>
                <ThemedText style={{ fontSize: 11, color: '#64748B' }}>
                  {totalLogs > 0 ? `${totalLogs} logs` : 'No logs'}
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
                          size={11}
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
                          {item.status === 'retained' ? 'Clean Day Logged' : 'Reset Recorded'}
                        </ThemedText>
                      </View>
                      <View style={styles.historyBadge}>
                        <ThemedText style={styles.historyBadgeText}>
                          {item.streakAfter}d Streak
                        </ThemedText>
                      </View>
                    </View>
                  ))}
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.emptyCard}
                  activeOpacity={0.8}
                  onPress={() => {
                    triggerHaptic();
                    router.push('/daily-checkin' as any);
                  }}
                >
                  <Ionicons name="calendar-outline" size={24} color="#00E5FF" />
                  <ThemedText style={styles.emptyTitle}>No Activity Logged Yet</ThemedText>
                  <ThemedText style={styles.emptySub}>
                    Tap here to log your daily check-in and start building your recovery timeline.
                  </ThemedText>
                </TouchableOpacity>
              )}
            </View>

          </View>
        </ScrollView>
      </PageEntrance>

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
              <Ionicons name="information-circle" size={20} color="#00E5FF" />
              <ThemedText style={styles.modalTitle}>How Progress Intelligence Calculates Score</ThemedText>
            </View>

            <View style={styles.formulaBox}>
              <ThemedText style={styles.formulaHeader}>4-PILLAR MULTI-VARIABLE EVALUATION</ThemedText>
              <ThemedText style={styles.formulaText}>
                Your Mindset Score ({scoreValue}/100) is evaluated live from your daily check-in, recent journals, yogic meditation logs, and urge transmutation discipline.
              </ThemedText>
            </View>

            <View style={styles.calcStep}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <ThemedText style={styles.stepName}>1. Daily Check-in Checklist</ThemedText>
                <ThemedText style={{ fontSize: 12, fontWeight: '800', color: '#00E5FF' }}>
                  {mindsetEval?.checkin_score ?? 30}/30 PTS
                </ThemedText>
              </View>
              <ThemedText style={styles.stepDetail}>Evaluates mood, energy, sleep quality, stress management, and daily accountability.</ThemedText>
            </View>

            <View style={styles.calcStep}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <ThemedText style={styles.stepName}>2. Self-Reflection Journals</ThemedText>
                <ThemedText style={{ fontSize: 12, fontWeight: '800', color: '#00E5FF' }}>
                  {mindsetEval?.journal_score ?? 20}/20 PTS
                </ThemedText>
              </View>
              <ThemedText style={styles.stepDetail}>Evaluates depth of introspection, emotional honesty, and psychological awareness.</ThemedText>
            </View>

            <View style={styles.calcStep}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <ThemedText style={styles.stepName}>3. Meditation & Urge Transmutation</ThemedText>
                <ThemedText style={{ fontSize: 12, fontWeight: '800', color: '#00E5FF' }}>
                  {mindsetEval?.meditation_urge_score ?? 50}/50 PTS
                </ThemedText>
              </View>
              <ThemedText style={styles.stepDetail}>Tracks yogic mindfulness sessions, urges defeated, and vital energy transmutation.</ThemedText>
            </View>

            <TouchableOpacity
              style={styles.modalCloseBtn}
              activeOpacity={0.8}
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
  headerSafeArea: {
    backgroundColor: '#000000',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  headerContainer: {
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backBtn: {
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
  },
  headerTitleWrapper: {
    alignItems: 'center',
    gap: 1,
  },
  headerCategory: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#00E5FF',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  headerTitleText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },

  /* Scroll Layout */
  scrollContent: {
    paddingTop: 14,
    paddingBottom: 36,
  },
  contentContainer: {
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: 16,
    gap: 16,
  },

  /* Unified Clean Dark Grey Card (Matching Home Screen) */
  darkCard: {
    backgroundColor: '#0E0F12',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 16,
    gap: 12,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cardCategoryTitle: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#00E5FF',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  statusPillText: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.3,
  },

  /* Score Overview Section */
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  scoreGaugeBox: {
    width: 74,
    height: 74,
    borderRadius: 16,
    backgroundColor: '#111215',
    borderWidth: 1.5,
    borderColor: 'rgba(0, 229, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scoreNumber: {
    fontSize: 26,
    fontWeight: '900',
    color: '#00E5FF',
    letterSpacing: -0.5,
  },
  scoreLabel: {
    fontSize: 8,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  scoreStatusTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  scoreDescriptionText: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.65)',
    lineHeight: 15,
  },

  /* Breakdown Progress */
  breakdownContainer: {
    gap: 4,
    paddingTop: 4,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  breakdownLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#64748B',
  },
  breakdownValue: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#00E5FF',
  },
  breakdownTrack: {
    width: '100%',
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  breakdownFill: {
    height: '100%',
    borderRadius: 2,
  },

  /* Transmutation Action Box */
  transmutationBox: {
    backgroundColor: '#111215',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.15)',
    padding: 10,
    gap: 4,
  },
  transmutationTitle: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#00E5FF',
    letterSpacing: 0.8,
  },
  transmutationBody: {
    fontSize: 11.5,
    color: 'rgba(255, 255, 255, 0.8)',
    lineHeight: 16,
  },

  explainerLink: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
  },
  explainerLinkText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#94A3B8',
  },

  purposeText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.85)',
    lineHeight: 17,
    fontStyle: 'italic',
  },

  /* Trigger Intelligence Elements */
  intelTimingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  intelTimingSub: {
    fontSize: 9,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.6,
  },
  intelTimingTime: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#00E5FF',
  },
  intelTimingDay: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  vulnerabilityBox: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  vulnerabilityLabel: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#64748B',
  },
  vulnerabilityValue: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#FFFFFF',
    flexShrink: 1,
  },
  triggerChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  triggerChip: {
    backgroundColor: '#16181D',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  triggerChipText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
  },
  protocolBox: {
    backgroundColor: '#111215',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(192, 132, 252, 0.2)',
    padding: 10,
    gap: 4,
  },
  protocolHeader: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#C084FC',
    letterSpacing: 0.8,
  },
  protocolText: {
    fontSize: 11.5,
    color: 'rgba(255, 255, 255, 0.8)',
    lineHeight: 16,
  },

  /* 3 PM & Checklist Activities Row */
  activitiesRow: {
    flexDirection: 'row',
    gap: 10,
  },
  activityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  activityTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  activityStatus: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 2,
  },
  activitySub: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.45)',
  },

  /* Bento Metric Grid */
  sectionContainer: {
    gap: 10,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metricCard: {
    width: '48%',
    backgroundColor: '#0E0F12',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 14,
    gap: 2,
  },
  metricHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  metricNumber: {
    fontSize: 20,
    fontWeight: '900',
    marginTop: 2,
  },
  metricSub: {
    fontSize: 9.5,
    color: 'rgba(255, 255, 255, 0.45)',
  },

  /* Bar Chart */
  chartCountText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  barChartContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 100,
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
    height: 72,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 7,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  barFill: {
    width: '100%',
    borderRadius: 7,
  },
  barDayLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#64748B',
  },
  chartLegendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  legendText: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '600',
  },

  /* Top 3 Journals */
  journalCard: {
    backgroundColor: '#0E0F12',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 12,
    gap: 4,
  },
  journalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  journalTitle: {
    fontSize: 12.5,
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
    fontSize: 9.5,
    fontWeight: '700',
    color: '#00E5FF',
  },
  journalContent: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.65)',
    lineHeight: 15,
  },
  journalDate: {
    fontSize: 9.5,
    color: '#64748B',
    textAlign: 'right',
  },

  /* Activity History */
  historyList: {
    gap: 8,
  },
  historyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0E0F12',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 12,
    gap: 12,
  },
  historyStatusDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyDateText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  historySubText: {
    fontSize: 10.5,
    color: '#64748B',
  },
  historyBadge: {
    backgroundColor: 'rgba(0, 229, 255, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  historyBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#00E5FF',
  },

  /* Empty State */
  emptyCard: {
    backgroundColor: '#0E0F12',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    padding: 20,
    alignItems: 'center',
    gap: 6,
  },
  emptyTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  emptySub: {
    fontSize: 11,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 15,
  },

  /* Modal */
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#0E0F12',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    padding: 20,
    gap: 12,
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
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  formulaBox: {
    backgroundColor: '#111215',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.2)',
    padding: 12,
    gap: 4,
  },
  formulaHeader: {
    fontSize: 10,
    fontWeight: '800',
    color: '#00E5FF',
    letterSpacing: 0.8,
  },
  formulaText: {
    fontSize: 11.5,
    color: 'rgba(255, 255, 255, 0.65)',
    lineHeight: 16,
  },
  calcStep: {
    gap: 2,
  },
  stepName: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  stepDetail: {
    fontSize: 11,
    color: '#64748B',
    lineHeight: 15,
  },
  modalCloseBtn: {
    backgroundColor: '#00E5FF',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 6,
  },
  modalCloseText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#000000',
  },
});
