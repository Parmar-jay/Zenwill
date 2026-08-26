import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { useHabitStore } from '@/store/habit-store';
import { PageEntrance } from '@/components/ui/smooth-loader';
import { analyticsApi, TriggerIntelligence } from '@/services/analytics-api';

const triggerHaptic = (style = Haptics.ImpactFeedbackStyle.Light) => {
  try {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(style);
    }
  } catch (error) {
    // Silent catch
  }
};

interface TriggerItem {
  id: string;
  name: string;
  category: 'Circadian' | 'Emotional' | 'Environmental' | 'Physical' | string;
  frequency: number;
  riskScore: number;
  color: string;
  peakTime: string;
  recommendation: string;
}

export default function TriggerIntelligenceScreen() {
  const router = useRouter();
  const { width: windowWidth } = useWindowDimensions();

  const { streak, totalUrgesCount, todayUrgesCount } = useHabitStore();

  const [triggerData, setTriggerData] = useState<TriggerIntelligence | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [isArchModalVisible, setIsArchModalVisible] = useState<boolean>(false);

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await analyticsApi.getTriggerIntelligence();
      setTriggerData(data);
    } catch (e) {
      console.log('Trigger intelligence fetch notice:', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const triggersList: TriggerItem[] = useMemo(() => {
    if (triggerData?.triggers && triggerData.triggers.length > 0) {
      return triggerData.triggers;
    }
    return [
      {
        id: 'trig-circadian',
        name: `Peak Risk Window (${triggerData?.peak_risk_window || '10:30 PM - 01:00 AM'})`,
        category: 'Circadian',
        frequency: totalUrgesCount || 1,
        riskScore: triggerData?.risk_score || 75,
        color: '#00E5FF',
        peakTime: triggerData?.peak_risk_window || '10:30 PM - 01:00 AM',
        recommendation: 'Pre-commit to digital shutdown 30 minutes before this window.',
      },
      {
        id: 'trig-environmental',
        name: triggerData?.environmental_rule ? 'Spatial & Device Proximity' : 'Device in Bedroom',
        category: 'Environmental',
        frequency: totalUrgesCount || 2,
        riskScore: 65,
        color: '#8B5CF6',
        peakTime: triggerData?.peak_risk_window || 'Night',
        recommendation: triggerData?.environmental_rule || 'Keep phone outside sleeping area 45 min before sleep.',
      },
      {
        id: 'trig-physical',
        name: 'First Warning Cue',
        category: 'Physical',
        frequency: 1,
        riskScore: 60,
        color: '#10B981',
        peakTime: 'Immediate',
        recommendation: triggerData?.first_sign_action || 'Execute 3-Second Snap: Splash cold water and vocalize.',
      },
    ];
  }, [triggerData, totalUrgesCount]);

  const filteredTriggers = useMemo(() => {
    return triggersList.filter(
      (t) => selectedCategory === 'All' || t.category.toLowerCase() === selectedCategory.toLowerCase()
    );
  }, [triggersList, selectedCategory]);

  const riskScore = triggerData?.risk_score ?? 65;
  const riskLevel = triggerData?.risk_level ?? 'MODERATE VIGILANCE';

  const riskColor = riskLevel.includes('CRITICAL')
    ? '#EF4444'
    : riskLevel.includes('ELEVATED')
    ? '#F59E0B'
    : '#10B981';

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
            <ThemedText style={styles.headerCategory}>NEURAL BEHAVIORAL INTEL</ThemedText>
            <ThemedText style={styles.headerTitleText}>Trigger Intelligence</ThemedText>
          </View>

          <TouchableOpacity
            style={styles.infoBtn}
            activeOpacity={0.7}
            onPress={() => {
              triggerHaptic();
              setIsArchModalVisible(true);
            }}
          >
            <Ionicons name="information-circle-outline" size={22} color="#94A3B8" />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <PageEntrance>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.contentContainer}>

            {/* 1. Radar Overview Hero Card */}
            <View style={styles.darkCard}>
              <View style={styles.cardHeaderRow}>
                <View style={styles.headerBadgeRow}>
                  <Ionicons name="shield-checkmark" size={14} color="#00E5FF" />
                  <ThemedText style={styles.cardCategoryTitle}>PREDICTIVE RISK INTELLIGENCE</ThemedText>
                </View>
                <View style={[styles.statusPill, { backgroundColor: `${riskColor}20`, borderColor: `${riskColor}40` }]}>
                  <ThemedText style={[styles.statusPillText, { color: riskColor }]}>
                    {riskLevel}
                  </ThemedText>
                </View>
              </View>

              {/* Peak Danger Window & Critical Day */}
              <View style={styles.timingBox}>
                <View style={{ flex: 1, gap: 2 }}>
                  <ThemedText style={styles.timingLabel}>NEXT PREDICTED TRIGGER</ThemedText>
                  <ThemedText style={styles.timingValue}>
                    {triggerData?.next_predicted_window || triggerData?.peak_risk_window || 'Tonight, 10:30 PM - 12:30 AM'}
                  </ThemedText>
                </View>

                <View style={{ alignItems: 'flex-end', gap: 2 }}>
                  <ThemedText style={styles.timingLabel}>
                    {triggerData?.today_status_label ? 'TODAY\'S PHASE' : 'CRITICAL PHASE'}
                  </ThemedText>
                  <ThemedText style={styles.timingDayValue}>
                    {triggerData?.today_weekday ? `${triggerData.today_weekday} (${triggerData.highest_risk_day})` : (triggerData?.highest_risk_day || 'Weekends')}
                  </ThemedText>
                </View>
              </View>

              {/* Primary Vulnerability Analysis */}
              <View style={styles.vulnerabilitySection}>
                <ThemedText style={styles.vulnerabilityLabel}>Primary Vulnerability Identified:</ThemedText>
                <ThemedText style={styles.vulnerabilityText}>
                  {triggerData?.primary_vulnerability || 'Solitary device usage in private areas with elevated evening stress.'}
                </ThemedText>
              </View>

              {/* Active Catalyst Chips */}
              {triggerData?.active_triggers && triggerData.active_triggers.length > 0 && (
                <View style={styles.chipsWrap}>
                  {triggerData.active_triggers.map((cat, idx) => (
                    <View key={idx} style={styles.catalystChip}>
                      <View style={[styles.catalystDot, { backgroundColor: idx === 0 ? '#EF4444' : '#00E5FF' }]} />
                      <ThemedText style={styles.catalystText}>{cat}</ThemedText>
                    </View>
                  ))}
                </View>
              )}

              {/* Tactical Defense Protocol */}
              <View style={styles.tacticalBox}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="flash" size={13} color="#00E5FF" />
                  <ThemedText style={styles.tacticalTitle}>TACTICAL DEFENSE SEQUENCE</ThemedText>
                </View>
                <ThemedText style={styles.tacticalBody}>
                  {triggerData?.tactical_defense || '1) Execute 3-Second Snap on first sign. 2) Remove device from room. 3) Transmute vital energy via 15 pushups or Pranayama.'}
                </ThemedText>
              </View>

              {/* Quick Action to Launch Emergency Shield */}
              <TouchableOpacity
                style={styles.actionBtn}
                activeOpacity={0.8}
                onPress={() => {
                  triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
                  router.push('/emergency/urge-surfing' as any);
                }}
              >
                <Ionicons name="shield" size={16} color="#000000" />
                <ThemedText style={styles.actionBtnText}>Launch Emergency Urge Shield</ThemedText>
              </TouchableOpacity>
            </View>

            {/* 2. Core Purpose Alignment Callout */}
            {triggerData?.purpose_alignment_quote && (
              <View style={[styles.darkCard, { borderColor: 'rgba(0, 229, 255, 0.2)' }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="compass-outline" size={15} color="#00E5FF" />
                  <ThemedText style={[styles.cardCategoryTitle, { color: '#00E5FF' }]}>PURPOSE & VISION REINFORCEMENT</ThemedText>
                </View>
                <ThemedText style={styles.purposeText}>
                  "{triggerData.purpose_alignment_quote}"
                </ThemedText>
              </View>
            )}

            {/* 3. Category Filter Row */}
            <View style={styles.sectionWrap}>
              <ThemedText style={styles.sectionHeading}>Trigger Breakdown & Protocol</ThemedText>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filterScroll}
              >
                {['All', 'Circadian', 'Emotional', 'Environmental', 'Physical', 'Cognitive'].map((cat) => {
                  const isSelected = selectedCategory.toLowerCase() === cat.toLowerCase();
                  return (
                    <TouchableOpacity
                      key={cat}
                      style={[
                        styles.filterTab,
                        isSelected && styles.filterTabSelected,
                      ]}
                      activeOpacity={0.7}
                      onPress={() => {
                        triggerHaptic();
                        setSelectedCategory(cat);
                      }}
                    >
                      <ThemedText
                        style={[
                          styles.filterTabText,
                          isSelected && styles.filterTabTextSelected,
                        ]}
                      >
                        {cat}
                      </ThemedText>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* 4. Trigger Cards List */}
            <View style={{ gap: 10 }}>
              {filteredTriggers.map((item) => (
                <View key={item.id} style={styles.triggerCard}>
                  <View style={styles.triggerHeader}>
                    <View style={{ flex: 1, gap: 2 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <View style={[styles.categoryTag, { backgroundColor: `${item.color}20` }]}>
                          <ThemedText style={[styles.categoryTagText, { color: item.color }]}>
                            {item.category.toUpperCase()}
                          </ThemedText>
                        </View>
                        <ThemedText style={styles.triggerRiskText}>
                          Risk: {item.riskScore}/100
                        </ThemedText>
                      </View>
                      <ThemedText style={styles.triggerTitleText}>{item.name}</ThemedText>
                    </View>
                  </View>

                  <View style={styles.triggerRecBox}>
                    <Ionicons name="shield-outline" size={13} color="#00E5FF" style={{ marginTop: 2 }} />
                    <ThemedText style={styles.triggerRecText}>{item.recommendation}</ThemedText>
                  </View>
                </View>
              ))}
            </View>

          </View>
        </ScrollView>
      </PageEntrance>

      {/* Architecture Explainer Modal */}
      <Modal
        visible={isArchModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsArchModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setIsArchModalVisible(false)}
        >
          <View style={styles.modalContent}>
            <View style={styles.drawerHandle} />

            <View style={styles.modalHeader}>
              <Ionicons name="shield-checkmark" size={20} color="#00E5FF" />
              <ThemedText style={styles.modalTitle}>How Trigger Intelligence Works</ThemedText>
            </View>

            <View style={styles.modalBodyTextWrap}>
              <ThemedText style={styles.modalBodyP}>
                ZenWill's Trigger Intelligence engine synthesizes your <ThemedText style={{ color: '#00E5FF', fontWeight: '800' }}>100% real database records</ThemedText>:
              </ThemedText>
              <ThemedText style={styles.modalBodyBullet}>
                • <ThemedText style={{ color: '#FFFFFF', fontWeight: '700' }}>Emergency Urge Logs</ThemedText>: Temporal clustering & after-urge notes
              </ThemedText>
              <ThemedText style={styles.modalBodyBullet}>
                • <ThemedText style={{ color: '#FFFFFF', fontWeight: '700' }}>Daily Checklists</ThemedText>: Stress cortisol scores, sleep debt, and mood intensity
              </ThemedText>
              <ThemedText style={styles.modalBodyBullet}>
                • <ThemedText style={{ color: '#FFFFFF', fontWeight: '700' }}>Onboarding Intake</ThemedText>: Primary devices, locations, first warning signs, and core purpose
              </ThemedText>
              <ThemedText style={styles.modalBodyBullet}>
                • <ThemedText style={{ color: '#FFFFFF', fontWeight: '700' }}>Journals & Progress</ThemedText>: Introspective themes and cognitive patterns
              </ThemedText>
            </View>

            <TouchableOpacity
              style={styles.modalCloseBtn}
              activeOpacity={0.8}
              onPress={() => setIsArchModalVisible(false)}
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
  infoBtn: {
    padding: 4,
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

  /* Dark Grey Card (Unified UI Standard) */
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
  },
  statusPillText: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.3,
  },

  /* Timing Box */
  timingBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#111215',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  timingLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.6,
  },
  timingValue: {
    fontSize: 14,
    fontWeight: '800',
    color: '#00E5FF',
  },
  timingDayValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  /* Vulnerability Section */
  vulnerabilitySection: {
    gap: 4,
  },
  vulnerabilityLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  vulnerabilityText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#FFFFFF',
    lineHeight: 17,
  },

  /* Catalyst Chips */
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  catalystChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#16181D',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  catalystDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  catalystText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.85)',
  },

  /* Tactical Sequence Box */
  tacticalBox: {
    backgroundColor: '#111215',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.2)',
    padding: 12,
    gap: 6,
  },
  tacticalTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#00E5FF',
    letterSpacing: 0.8,
  },
  tacticalBody: {
    fontSize: 11.5,
    color: 'rgba(255, 255, 255, 0.85)',
    lineHeight: 16,
  },

  actionBtn: {
    backgroundColor: '#00E5FF',
    borderRadius: 10,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#000000',
  },

  purposeText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.85)',
    lineHeight: 17,
    fontStyle: 'italic',
  },

  /* Categories & Filters */
  sectionWrap: {
    gap: 10,
  },
  sectionHeading: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  filterScroll: {
    gap: 8,
  },
  filterTab: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#0E0F12',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  filterTabSelected: {
    backgroundColor: 'rgba(0, 229, 255, 0.15)',
    borderColor: '#00E5FF',
  },
  filterTabText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  filterTabTextSelected: {
    color: '#00E5FF',
    fontWeight: '800',
  },

  /* Trigger Cards */
  triggerCard: {
    backgroundColor: '#0E0F12',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 14,
    gap: 8,
  },
  triggerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  categoryTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  categoryTagText: {
    fontSize: 8.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  triggerRiskText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#64748B',
  },
  triggerTitleText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  triggerRecBox: {
    flexDirection: 'row',
    gap: 6,
    backgroundColor: '#111215',
    borderRadius: 8,
    padding: 10,
  },
  triggerRecText: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.75)',
    lineHeight: 15,
    flex: 1,
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
  modalBodyTextWrap: {
    gap: 6,
    paddingVertical: 4,
  },
  modalBodyP: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    lineHeight: 17,
  },
  modalBodyBullet: {
    fontSize: 11.5,
    color: 'rgba(255, 255, 255, 0.7)',
    lineHeight: 17,
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
