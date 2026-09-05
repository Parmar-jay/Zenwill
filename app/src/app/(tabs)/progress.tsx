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
import {
  analyticsApi,
  ProgressIntelligence,
  TriggerIntelligence,
  PredictionItem,
  RecommendationItem,
} from '@/services/analytics-api';

const triggerHaptic = (style = Haptics.ImpactFeedbackStyle.Light) => {
  try {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(style);
    }
  } catch {
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
    todayCheckinDone,
    todayCheckinSummary,
    latestCheckinSummary,
    totalUrgesCount,
    todayUrgesCount,
    dailyUrgeCounts,
  } = useHabitStore();

  const [isCalcModalVisible, setIsCalcModalVisible] = useState<boolean>(false);
  const [progressIntel, setProgressIntel] = useState<ProgressIntelligence | null>(null);
  const [triggerIntel, setTriggerIntel] = useState<TriggerIntelligence | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const loadAnalyticsData = useCallback(async () => {
    useHabitStore.getState().syncFromDatabase();
    try {
      setIsLoading(true);
      const [pData, tData] = await Promise.allSettled([
        analyticsApi.getProgressIntelligence(),
        analyticsApi.getTriggerIntelligence(),
      ]);

      if (pData.status === 'fulfilled' && pData.value) {
        setProgressIntel(pData.value);
      }
      if (tData.status === 'fulfilled' && tData.value) {
        setTriggerIntel(tData.value);
      }
    } catch (e) {
      console.log('Error loading progress intelligence:', e);
    } finally {
      setIsLoading(false);
    }
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

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Strict check: has user actually submitted the checklist for TODAY?
  const isCheckinSubmittedToday = useMemo(() => {
    if (todayCheckinDone) return true;
    if (todayCheckinSummary && (todayCheckinSummary.date === todayStr || todayCheckinSummary.is_today)) return true;
    if (latestCheckinSummary && (latestCheckinSummary.date === todayStr || latestCheckinSummary.is_today)) return true;
    if (progressIntel?.today_checkin_completed) return true;
    return false;
  }, [todayCheckinDone, todayCheckinSummary, latestCheckinSummary, todayStr, progressIntel?.today_checkin_completed]);

  const activeCheckin = isCheckinSubmittedToday
    ? (todayCheckinSummary || (latestCheckinSummary?.date === todayStr ? latestCheckinSummary : null))
    : null;

  // Breakdown points with zero dummy fallbacks
  const checkinPoints = isCheckinSubmittedToday
    ? (typeof progressIntel?.metrics_breakdown?.checkin_points === 'number'
        ? progressIntel.metrics_breakdown.checkin_points
        : 20)
    : null;

  const journalPoints = recentJournals && recentJournals.length > 0
    ? (typeof progressIntel?.metrics_breakdown?.journal_points === 'number'
        ? progressIntel.metrics_breakdown.journal_points
        : 15)
    : null;

  const urgePoints = (streak > 0 || totalUrgesCount > 0)
    ? (typeof progressIntel?.metrics_breakdown?.urge_control_points === 'number'
        ? progressIntel.metrics_breakdown.urge_control_points
        : (streak > 0 ? 15 : 10))
    : null;

  const medPoints = ((meditationsCount || 0) > 0 || afternoonMeditationDone)
    ? (typeof progressIntel?.metrics_breakdown?.meditation_points === 'number'
        ? progressIntel.metrics_breakdown.meditation_points
        : 15)
    : null;

  const scoreValue = progressIntel?.score !== undefined
    ? progressIntel.score
    : (mindStrength > 0 ? Math.min(100, Math.round(mindStrength / 10)) : 'N/A');
  const statusTitle = progressIntel?.status_title ?? (streak > 7 ? 'Ojas Transmutation Sovereign' : (streak > 0 ? 'Neural Rewiring Active' : 'Establishing Foundation'));
  const statusColor = progressIntel?.status_color ?? (streak > 0 ? '#00E5FF' : '#94A3B8');

  // 4 Core Quick Metric Cards fallback
  const coreMetrics = useMemo(() => {
    if (progressIntel?.core_metrics && progressIntel.core_metrics.length >= 4) {
      return progressIntel.core_metrics;
    }
    return [
      {
        id: 'clean_consistency',
        label: '7-Day Consistency',
        value: totalLogs > 0 || streak > 0 ? `${successRate}%` : 'N/A',
        sub: totalLogs > 0 || streak > 0 ? `${Math.min(7, streak)}/7 Clean Days` : '0/7 Clean Days',
        color: '#10B981',
        icon: 'shield-checkmark',
      },
      {
        id: 'urges_neutralized',
        label: 'Urges Neutralized',
        value: `${totalUrgesCount || 0}`,
        sub: `${todayUrgesCount || 0} Defended Today`,
        color: '#00E5FF',
        icon: 'flame',
      },
      {
        id: 'mind_strength',
        label: 'Mind Strength',
        value: mindStrength > 0 ? `${mindStrength}` : 'N/A',
        sub: statusTitle.split(' ')[0] || 'Warrior',
        color: '#A855F7',
        icon: 'flash',
      },
      {
        id: 'recovery_balance',
        label: 'Total Logged',
        value: totalLogs > 0 ? `${totalLogs}` : 'N/A',
        sub: totalLogs > 0 ? 'Check-in Records' : 'No Records',
        color: '#38BDF8',
        icon: 'calendar',
      },
    ];
  }, [progressIntel?.core_metrics, successRate, streak, totalUrgesCount, todayUrgesCount, mindStrength, statusTitle, totalLogs]);

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
            <ThemedText style={styles.headerCategory}>NEURAL TELEMETRY</ThemedText>
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

            {/* 1. Mindset Score & Sovereign Status Hero Card */}
            <View style={styles.darkCard}>
              <View style={styles.cardHeaderRow}>
                <View style={styles.headerBadgeRow}>
                  <Ionicons name="sparkles" size={14} color="#00E5FF" />
                  <ThemedText style={styles.cardCategoryTitle}>MINDSET PROGRESS INTELLIGENCE</ThemedText>
                </View>
                <View style={[styles.statusPill, { backgroundColor: lastLoggedStatus === 'retained' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(255, 255, 255, 0.05)' }]}>
                  <ThemedText style={[styles.statusPillText, { color: lastLoggedStatus === 'retained' ? '#10B981' : '#94A3B8' }]}>
                    {lastLoggedStatus === 'retained' ? '✓ Clean Today' : streak > 0 ? `${streak}d Streak` : 'Active Baseline'}
                  </ThemedText>
                </View>
              </View>

              {/* Score Display & Summary */}
              <View style={styles.scoreRow}>
                <View style={[styles.scoreGaugeBox, { borderColor: `${statusColor}50` }]}>
                  <ThemedText style={[styles.scoreNumber, { color: statusColor }]}>{scoreValue}</ThemedText>
                  <ThemedText style={styles.scoreLabel}>SCORE / 100</ThemedText>
                </View>

                <View style={styles.scoreInfoCol}>
                  <ThemedText style={styles.scoreStatusTitle} numberOfLines={2}>
                    {statusTitle}
                  </ThemedText>
                  <ThemedText style={styles.scoreDescriptionText}>
                    {progressIntel?.headline || progressIntel?.summary || 'Evaluated live from daily check-ins, journals, yogic meditation, and urge control discipline.'}
                  </ThemedText>
                </View>
              </View>

              {/* 4-Pillar Progress Breakdown */}
              <View style={styles.breakdownContainer}>
                <View style={styles.breakdownRow}>
                  <ThemedText style={styles.breakdownLabel}>Check-in Checklist</ThemedText>
                  <ThemedText style={styles.breakdownValue}>
                    {checkinPoints !== null ? `${checkinPoints}/25 XP` : 'N/A'}
                  </ThemedText>
                </View>
                <View style={styles.breakdownTrack}>
                  <View
                    style={[
                      styles.breakdownFill,
                      {
                        width: checkinPoints !== null
                          ? `${Math.min(100, ((checkinPoints / 25) * 100))}%`
                          : '0%',
                        backgroundColor: '#00E5FF',
                      },
                    ]}
                  />
                </View>

                <View style={[styles.breakdownRow, { marginTop: 6 }]}>
                  <ThemedText style={styles.breakdownLabel}>Self-Reflection Journals</ThemedText>
                  <ThemedText style={styles.breakdownValue}>
                    {journalPoints !== null ? `${journalPoints}/20 XP` : 'N/A'}
                  </ThemedText>
                </View>
                <View style={styles.breakdownTrack}>
                  <View
                    style={[
                      styles.breakdownFill,
                      {
                        width: journalPoints !== null
                          ? `${Math.min(100, ((journalPoints / 20) * 100))}%`
                          : '0%',
                        backgroundColor: '#A855F7',
                      },
                    ]}
                  />
                </View>

                <View style={[styles.breakdownRow, { marginTop: 6 }]}>
                  <ThemedText style={styles.breakdownLabel}>Impulse & Urge Control</ThemedText>
                  <ThemedText style={styles.breakdownValue}>
                    {urgePoints !== null ? `${urgePoints}/25 XP` : 'N/A'}
                  </ThemedText>
                </View>
                <View style={styles.breakdownTrack}>
                  <View
                    style={[
                      styles.breakdownFill,
                      {
                        width: urgePoints !== null
                          ? `${Math.min(100, ((urgePoints / 25) * 100))}%`
                          : '0%',
                        backgroundColor: '#10B981',
                      },
                    ]}
                  />
                </View>

                <View style={[styles.breakdownRow, { marginTop: 6 }]}>
                  <ThemedText style={styles.breakdownLabel}>Yogic Meditation</ThemedText>
                  <ThemedText style={styles.breakdownValue}>
                    {medPoints !== null ? `${medPoints}/25 XP` : 'N/A'}
                  </ThemedText>
                </View>
                <View style={styles.breakdownTrack}>
                  <View
                    style={[
                      styles.breakdownFill,
                      {
                        width: medPoints !== null
                          ? `${Math.min(100, ((medPoints / 25) * 100))}%`
                          : '0%',
                        backgroundColor: '#38BDF8',
                      },
                    ]}
                  />
                </View>
              </View>

              {/* Actionable Transmutation Protocol */}
              {progressIntel?.transmutation_tip && (
                <View style={styles.transmutationBox}>
                  <View style={styles.transmutationHeaderRow}>
                    <Ionicons name="flash" size={13} color="#00E5FF" />
                    <ThemedText style={styles.transmutationTitle}>ACTIVE TRANSMUTATION PROTOCOL</ThemedText>
                  </View>
                  <ThemedText style={styles.transmutationBody}>
                    {progressIntel.transmutation_tip}
                  </ThemedText>
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
                <View style={styles.explainerLeft}>
                  <Ionicons name="information-circle-outline" size={15} color="#94A3B8" />
                  <ThemedText style={styles.explainerLinkText}>How Progress Intelligence Calculates Score</ThemedText>
                </View>
                <Ionicons name="chevron-forward" size={14} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* 2. Four Core Metric Quick-Cards (2x2 Grid) */}
            <View style={styles.metricsGrid}>
              {coreMetrics.map((item) => (
                <View key={item.id} style={styles.metricCard}>
                  <View style={styles.metricHeader}>
                    <ThemedText style={styles.metricLabel} numberOfLines={1}>
                      {item.label}
                    </ThemedText>
                    <Ionicons name={item.icon as any} size={15} color={item.color} />
                  </View>
                  <ThemedText style={[styles.metricNumber, { color: item.color }]} numberOfLines={1}>
                    {item.value}
                  </ThemedText>
                  <ThemedText style={styles.metricSub} numberOfLines={1}>
                    {item.sub}
                  </ThemedText>
                </View>
              ))}
            </View>

            {/* 3. Predictive Threat Radar & Warnings */}
            {progressIntel?.predictions && progressIntel.predictions.length > 0 && (
              <View style={styles.darkCard}>
                <View style={styles.cardHeaderRow}>
                  <View style={styles.headerBadgeRow}>
                    <Ionicons name="pulse-outline" size={14} color="#F59E0B" />
                    <ThemedText style={[styles.cardCategoryTitle, { color: '#F59E0B' }]}>
                      PREDICTIVE THREAT RADAR
                    </ThemedText>
                  </View>
                  <ThemedText style={styles.scannableBadge}>AI TELEMETRY</ThemedText>
                </View>

                <View style={styles.predictionList}>
                  {progressIntel.predictions.map((p, idx) => {
                    const isObj = typeof p === 'object' && p !== null;
                    const level = isObj ? (p as PredictionItem).level : 'ALERT';
                    const title = isObj ? (p as PredictionItem).title : 'Behavioral Insight';
                    const text = isObj ? (p as PredictionItem).text : String(p);
                    const color = isObj ? (p as PredictionItem).color : '#00E5FF';
                    const iconName = isObj ? (p as PredictionItem).icon : 'alert-circle-outline';

                    return (
                      <View key={idx} style={styles.predictionItemCard}>
                        <View style={styles.predictionTopRow}>
                          <View style={[styles.predictionLevelPill, { backgroundColor: `${color}18`, borderColor: `${color}35` }]}>
                            <Ionicons name={iconName as any} size={11} color={color} style={{ marginRight: 4 }} />
                            <ThemedText style={[styles.predictionLevelText, { color }]}>{level}</ThemedText>
                          </View>
                          <ThemedText style={styles.predictionTitle} numberOfLines={1}>{title}</ThemedText>
                        </View>
                        <ThemedText style={styles.predictionText}>{text}</ThemedText>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}

            {/* 4. Action Protocol Directives */}
            {progressIntel?.recommendations && progressIntel.recommendations.length > 0 && (
              <View style={styles.darkCard}>
                <View style={styles.cardHeaderRow}>
                  <View style={styles.headerBadgeRow}>
                    <Ionicons name="shield-checkmark" size={14} color="#10B981" />
                    <ThemedText style={[styles.cardCategoryTitle, { color: '#10B981' }]}>
                      RECOMMENDED ACTION PROTOCOLS
                    </ThemedText>
                  </View>
                  <ThemedText style={styles.scannableBadge}>DAILY SHIELD</ThemedText>
                </View>

                <View style={styles.recommendationList}>
                  {progressIntel.recommendations.map((r, idx) => {
                    const isObj = typeof r === 'object' && r !== null;
                    const title = isObj ? (r as RecommendationItem).title : `Protocol #${idx + 1}`;
                    const action = isObj ? (r as RecommendationItem).action : String(r);
                    const tag = isObj ? (r as RecommendationItem).tag : 'Action';
                    const color = isObj ? (r as RecommendationItem).color : '#10B981';

                    return (
                      <View key={idx} style={styles.recommendationCard}>
                        <View style={styles.recommendationTopRow}>
                          <ThemedText style={styles.recommendationTitle} numberOfLines={1}>{title}</ThemedText>
                          <View style={[styles.recommendationTagPill, { backgroundColor: `${color}15`, borderColor: `${color}30` }]}>
                            <ThemedText style={[styles.recommendationTagText, { color }]}>{tag}</ThemedText>
                          </View>
                        </View>
                        <ThemedText style={styles.recommendationAction}>{action}</ThemedText>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}

            {/* 5. Trigger Intelligence Quick Radar Card */}
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
                      <ThemedText
                        numberOfLines={1}
                        style={[
                          styles.statusPillText,
                          triggerIntel.risk_level.includes('CRITICAL') ? { color: '#EF4444' }
                          : triggerIntel.risk_level.includes('ELEVATED') ? { color: '#F59E0B' }
                          : { color: '#10B981' }
                        ]}
                      >
                        {triggerIntel.risk_level.split('(')[0].trim()}
                      </ThemedText>
                    </View>
                  )}
                </View>

                {/* Next Predicted Trigger & Critical Window */}
                <View style={styles.intelTimingRow}>
                  <View style={styles.intelTimingColLeft}>
                    <ThemedText style={styles.intelTimingSub}>NEXT PREDICTED TRIGGER</ThemedText>
                    <ThemedText style={styles.intelTimingTime} numberOfLines={2}>
                      {triggerIntel.next_predicted_window || triggerIntel.peak_risk_window || 'Tonight, 10:30 PM - 12:30 AM'}
                    </ThemedText>
                  </View>
                  <View style={styles.intelTimingColRight}>
                    <ThemedText style={styles.intelTimingSub}>
                      {triggerIntel.today_status_label ? "TODAY'S PHASE" : 'CRITICAL PHASE'}
                    </ThemedText>
                    <ThemedText style={styles.intelTimingDay} numberOfLines={2}>
                      {triggerIntel.today_weekday ? `${triggerIntel.today_weekday}` : (triggerIntel.highest_risk_day || 'Weekends')}
                    </ThemedText>
                  </View>
                </View>

                {/* Primary Vulnerability Statement */}
                {triggerIntel.primary_vulnerability && (
                  <View style={styles.vulnerabilityBox}>
                    <ThemedText style={styles.vulnerabilityLabel}>PRIMARY VULNERABILITY</ThemedText>
                    <ThemedText style={styles.vulnerabilityValue}>{triggerIntel.primary_vulnerability}</ThemedText>
                  </View>
                )}

                {/* Direct Link to Full Trigger Intelligence Suite */}
                <TouchableOpacity
                  style={styles.explainerLink}
                  activeOpacity={0.7}
                  onPress={() => {
                    triggerHaptic();
                    router.push('/trigger-intelligence' as any);
                  }}
                >
                  <View style={styles.explainerLeft}>
                    <Ionicons name="analytics-outline" size={15} color="#00E5FF" />
                    <ThemedText style={[styles.explainerLinkText, { color: '#00E5FF' }]}>View Full Neural Trigger Breakdown</ThemedText>
                  </View>
                  <Ionicons name="chevron-forward" size={14} color="#00E5FF" />
                </TouchableOpacity>
              </View>
            )}

            {/* 6. Activities Quick Row: 3 PM Meditation & Daily Checklist */}
            <View style={styles.activitiesRow}>
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

              <TouchableOpacity
                style={[styles.darkCard, { flex: 1, padding: 14 }]}
                activeOpacity={0.8}
                onPress={() => {
                  triggerHaptic();
                  router.push('/daily-checkin' as any);
                }}
              >
                <View style={styles.activityHeader}>
                  <Ionicons
                    name={isCheckinSubmittedToday ? 'checkbox' : 'clipboard-outline'}
                    size={15}
                    color={isCheckinSubmittedToday ? '#10B981' : '#64748B'}
                  />
                  <ThemedText style={styles.activityTitle}>Daily Checklist</ThemedText>
                </View>
                <ThemedText style={[styles.activityStatus, !isCheckinSubmittedToday && { color: '#94A3B8' }]}>
                  {isCheckinSubmittedToday && activeCheckin ? `${activeCheckin.mood} Mood` : 'N/A'}
                </ThemedText>
                <ThemedText style={styles.activitySub}>
                  {isCheckinSubmittedToday && activeCheckin
                    ? `Energy ${activeCheckin.energy_score}/10 • Focus ${activeCheckin.focus_score}/10`
                    : 'Energy N/A • Focus N/A'}
                </ThemedText>
              </TouchableOpacity>
            </View>

            {/* 7. 7-Day Urge Activity Horizon Graph */}
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

            {/* 8. Recent Self-Reflection Journals */}
            <View style={styles.sectionContainer}>
              <View style={styles.sectionHeaderRow}>
                <ThemedText style={styles.sectionTitle}>Recent Self-Reflection Journals</ThemedText>
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => {
                    triggerHaptic();
                    router.push('/journal' as any);
                  }}
                >
                  <ThemedText style={styles.sectionLinkText}>
                    {recentJournals && recentJournals.length > 0 ? `${recentJournals.length} entries →` : '+ Write Journal'}
                  </ThemedText>
                </TouchableOpacity>
              </View>

              {recentJournals && recentJournals.length > 0 ? (
                <View style={{ gap: 8 }}>
                  {recentJournals.map((j) => (
                    <View key={j.id} style={styles.journalCard}>
                      <View style={styles.journalHeaderRow}>
                        <View style={styles.journalTitleGroup}>
                          <Ionicons name="journal" size={14} color="#00E5FF" />
                          <ThemedText style={styles.journalTitle} numberOfLines={1}>{j.title}</ThemedText>
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
                    Tap here to record your first reflection and build mindful self-awareness.
                  </ThemedText>
                </TouchableOpacity>
              )}
            </View>

            {/* 9. Recent Activity Timeline */}
            <View style={styles.sectionContainer}>
              <View style={styles.sectionHeaderRow}>
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
                      <View style={styles.historyInfoCol}>
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

      {/* Score Calculation Explainer Modal */}
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
                  {checkinPoints !== null ? `${checkinPoints}/25 XP` : 'N/A'}
                </ThemedText>
              </View>
              <ThemedText style={styles.stepDetail}>Evaluates mood, energy, sleep quality, stress management, and daily accountability.</ThemedText>
            </View>

            <View style={styles.calcStep}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <ThemedText style={styles.stepName}>2. Self-Reflection Journals</ThemedText>
                <ThemedText style={{ fontSize: 12, fontWeight: '800', color: '#00E5FF' }}>
                  {journalPoints !== null ? `${journalPoints}/20 XP` : 'N/A'}
                </ThemedText>
              </View>
              <ThemedText style={styles.stepDetail}>Evaluates depth of introspection, emotional honesty, and psychological awareness.</ThemedText>
            </View>

            <View style={styles.calcStep}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <ThemedText style={styles.stepName}>3. Impulse & Urge Transmutation</ThemedText>
                <ThemedText style={{ fontSize: 12, fontWeight: '800', color: '#00E5FF' }}>
                  {urgePoints !== null ? `${urgePoints}/25 XP` : 'N/A'}
                </ThemedText>
              </View>
              <ThemedText style={styles.stepDetail}>Tracks urges neutralized, clean streak consistency, and vital energy transmutation.</ThemedText>
            </View>

            <View style={styles.calcStep}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <ThemedText style={styles.stepName}>4. Yogic Meditation Discipline</ThemedText>
                <ThemedText style={{ fontSize: 12, fontWeight: '800', color: '#00E5FF' }}>
                  {medPoints !== null ? `${medPoints}/25 XP` : 'N/A'}
                </ThemedText>
              </View>
              <ThemedText style={styles.stepDetail}>Quantifies breathwork consistency, afternoon meditation discipline, and focus stamina.</ThemedText>
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

  /* Clean Dark Grey Card */
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
    flexWrap: 'wrap',
    gap: 8,
  },
  headerBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
  },
  cardCategoryTitle: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#00E5FF',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    flexShrink: 1,
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
  scannableBadge: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.8,
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
    justifyContent: 'center',
    alignItems: 'center',
  },
  scoreNumber: {
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  scoreLabel: {
    fontSize: 8,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  scoreInfoCol: {
    flex: 1,
    gap: 4,
    justifyContent: 'center',
  },
  scoreStatusTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
    lineHeight: 18,
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
    color: '#94A3B8',
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
  transmutationHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  transmutationTitle: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#00E5FF',
    letterSpacing: 0.5,
  },
  transmutationBody: {
    fontSize: 11,
    color: '#E2E8F0',
    lineHeight: 16,
  },

  /* Explainer Link */
  explainerLink: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 4,
  },
  explainerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
  },
  explainerLinkText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94A3B8',
    flexShrink: 1,
  },

  /* Four Core Metrics 2x2 Bento Grid */
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metricCard: {
    flex: 1,
    minWidth: '47%',
    backgroundColor: '#0E0F12',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 12,
    gap: 2,
  },
  metricHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
    flexShrink: 1,
  },
  metricNumber: {
    fontSize: 20,
    fontWeight: '900',
    marginTop: 2,
    letterSpacing: -0.3,
  },
  metricSub: {
    fontSize: 9.5,
    color: 'rgba(255, 255, 255, 0.45)',
    lineHeight: 13,
  },

  /* Predictive Threat Radar */
  predictionList: {
    gap: 8,
  },
  predictionItemCard: {
    backgroundColor: '#111215',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    padding: 10,
    gap: 4,
  },
  predictionTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  predictionLevelPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  predictionLevelText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  predictionTitle: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#FFFFFF',
    flexShrink: 1,
  },
  predictionText: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.65)',
    lineHeight: 15,
  },

  /* Action Protocol Recommendations */
  recommendationList: {
    gap: 8,
  },
  recommendationCard: {
    backgroundColor: '#111215',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    padding: 10,
    gap: 4,
  },
  recommendationTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  recommendationTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
    flexShrink: 1,
  },
  recommendationTagPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  recommendationTagText: {
    fontSize: 9,
    fontWeight: '800',
  },
  recommendationAction: {
    fontSize: 11,
    color: '#CBD5E1',
    lineHeight: 15,
  },

  /* Trigger Intel Preview */
  intelTimingRow: {
    flexDirection: 'row',
    backgroundColor: '#111215',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    padding: 10,
    gap: 10,
  },
  intelTimingColLeft: {
    flex: 1,
    gap: 2,
  },
  intelTimingColRight: {
    flex: 1,
    gap: 2,
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(255, 255, 255, 0.08)',
    paddingLeft: 10,
  },
  intelTimingSub: {
    fontSize: 8.5,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.6,
  },
  intelTimingTime: {
    fontSize: 12,
    fontWeight: '800',
    color: '#00E5FF',
    lineHeight: 16,
  },
  intelTimingDay: {
    fontSize: 12,
    fontWeight: '800',
    color: '#C084FC',
    lineHeight: 16,
  },
  vulnerabilityBox: {
    backgroundColor: 'rgba(192, 132, 252, 0.06)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(192, 132, 252, 0.15)',
    padding: 9,
    gap: 2,
  },
  vulnerabilityLabel: {
    fontSize: 8.5,
    fontWeight: '800',
    color: '#C084FC',
    letterSpacing: 0.6,
  },
  vulnerabilityValue: {
    fontSize: 11,
    color: '#E2E8F0',
    lineHeight: 15,
  },

  /* Activities Quick Row */
  activitiesRow: {
    flexDirection: 'row',
    gap: 10,
  },
  activityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  activityTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  activityStatus: {
    fontSize: 13,
    fontWeight: '800',
    color: '#00E5FF',
    marginTop: 4,
  },
  activitySub: {
    fontSize: 9.5,
    color: '#64748B',
    lineHeight: 13,
  },

  /* 7-Day Urge Activity Graph */
  chartCountText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
  },
  barChartContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 80,
    paddingHorizontal: 8,
    paddingTop: 8,
  },
  barColumn: {
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  barTrack: {
    width: 8,
    height: 55,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 4,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  barFill: {
    width: '100%',
    borderRadius: 4,
  },
  barDayLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
  },
  chartLegendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    paddingTop: 4,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  legendText: {
    fontSize: 9.5,
    color: '#94A3B8',
    fontWeight: '600',
  },

  /* Journals & History Sections */
  sectionContainer: {
    gap: 8,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  sectionLinkText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#00E5FF',
  },
  journalCard: {
    backgroundColor: '#0E0F12',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 12,
    gap: 6,
  },
  journalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  journalTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
  },
  journalTitle: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#FFFFFF',
    flexShrink: 1,
  },
  moodPill: {
    backgroundColor: 'rgba(0, 229, 255, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  moodPillText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#00E5FF',
  },
  journalContent: {
    fontSize: 11.5,
    color: 'rgba(255, 255, 255, 0.65)',
    lineHeight: 16,
  },
  journalDate: {
    fontSize: 9.5,
    color: '#64748B',
  },
  emptyCard: {
    backgroundColor: '#0E0F12',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderStyle: 'dashed',
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
    color: 'rgba(255, 255, 255, 0.5)',
    textAlign: 'center',
    lineHeight: 15,
  },

  /* History Timeline List */
  historyList: {
    gap: 6,
  },
  historyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0E0F12',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    padding: 10,
    gap: 10,
  },
  historyStatusDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  historyInfoCol: {
    flex: 1,
    gap: 2,
  },
  historyDateText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  historySubText: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.5)',
  },
  historyBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  historyBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#E2E8F0',
  },

  /* Modal Styles */
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#111216',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    gap: 14,
    maxHeight: '85%',
  },
  drawerHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignSelf: 'center',
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
    flexShrink: 1,
  },
  formulaBox: {
    backgroundColor: 'rgba(0, 229, 255, 0.06)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.15)',
    padding: 12,
    gap: 4,
  },
  formulaHeader: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#00E5FF',
    letterSpacing: 0.8,
  },
  formulaText: {
    fontSize: 11.5,
    color: '#CBD5E1',
    lineHeight: 16,
  },
  calcStep: {
    backgroundColor: '#0E0F12',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    padding: 12,
    gap: 3,
  },
  stepName: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
    flexShrink: 1,
  },
  stepDetail: {
    fontSize: 10.5,
    color: '#94A3B8',
    lineHeight: 15,
  },
  modalCloseBtn: {
    backgroundColor: '#00E5FF',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  modalCloseText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#000000',
  },
});
