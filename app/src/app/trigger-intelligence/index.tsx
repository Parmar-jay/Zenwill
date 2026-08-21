import React, { useState } from 'react';
import {
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  View,
  Platform,
  Modal,
  useWindowDimensions,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

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
  category: 'Circadian' | 'Emotional' | 'Environmental' | 'Physical';
  frequency: number;
  riskScore: number; // 0-100
  color: string;
  peakTime: string;
  recommendation: string;
}

interface TimelineEvent {
  id: string;
  time: string;
  triggerName: string;
  status: 'Resolved' | 'Interrupted' | 'Flagged';
  resolutionAction: string;
}

export default function TriggerIntelligenceSingleScreen() {
  const router = useRouter();
  const { width: windowWidth } = useWindowDimensions();
  const isTablet = windowWidth > 600;

  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [isArchModalVisible, setIsArchModalVisible] = useState<boolean>(false);

  const triggers: TriggerItem[] = [
    {
      id: 't-1',
      name: 'Screen Fatigue',
      category: 'Circadian',
      frequency: 14,
      riskScore: 78,
      color: '#F59E0B',
      peakTime: '3:00 PM - 4:30 PM',
      recommendation: 'Schedule a 5-minute physical walk & hydration break at 2:50 PM.',
    },
    {
      id: 't-2',
      name: 'Late Night Pre-Bed Stress',
      category: 'Emotional',
      frequency: 9,
      riskScore: 65,
      color: '#8B5CF6',
      peakTime: '11:00 PM - 12:00 AM',
      recommendation: 'Execute 3-item gratitude journaling 30 minutes before sleep.',
    },
    {
      id: 't-3',
      name: 'Solitary Work Isolation',
      category: 'Environmental',
      frequency: 6,
      riskScore: 52,
      color: '#2B6BFF',
      peakTime: '1:00 PM - 2:30 PM',
      recommendation: 'Switch workspace location or join a co-focus virtual session.',
    },
    {
      id: 't-4',
      name: 'Post-Meal Slump',
      category: 'Physical',
      frequency: 5,
      riskScore: 40,
      color: '#10B981',
      peakTime: '1:30 PM - 2:00 PM',
      recommendation: 'Light 10-minute stretch or cold water splash after lunch.',
    },
  ];

  const timelineEvents: TimelineEvent[] = [
    {
      id: 'ev-1',
      time: 'Today • 3:15 PM',
      triggerName: 'Screen Fatigue',
      status: 'Interrupted',
      resolutionAction: 'Completed 60s Box Breathing & 5-min walk protocol.',
    },
    {
      id: 'ev-2',
      time: 'Yesterday • 11:20 PM',
      triggerName: 'Late Night Stress',
      status: 'Resolved',
      resolutionAction: 'Logged 3 gratitude notes & completed Delta Wave sleep session.',
    },
    {
      id: 'ev-3',
      time: 'Jul 18 • 2:00 PM',
      triggerName: 'Post-Meal Slump',
      status: 'Resolved',
      resolutionAction: 'Drank 500ml cold water & stretched for 5 minutes.',
    },
  ];

  const hourlyHeatmap = [
    { hour: '6 AM', level: 'low', color: '#10B981' },
    { hour: '9 AM', level: 'low', color: '#10B981' },
    { hour: '12 PM', level: 'mid', color: '#F59E0B' },
    { hour: '3 PM', level: 'high', color: '#EF4444' },
    { hour: '6 PM', level: 'mid', color: '#F59E0B' },
    { hour: '9 PM', level: 'low', color: '#10B981' },
    { hour: '11 PM', level: 'high', color: '#EF4444' },
  ];

  const filteredTriggers = triggers.filter(
    (t) => selectedCategory === 'All' || t.category === selectedCategory
  );

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
            <ThemedText style={styles.categoryBadge}>BEHAVIORAL NEUROSCIENCE</ThemedText>
            <ThemedText style={styles.headerTitle}>Trigger Intelligence</ThemedText>
          </View>

          <View style={{ width: 36 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          
          {/* Risk Prediction Gauge Card */}
          <View style={styles.riskCard}>
            <View style={styles.riskTopRow}>
              <View style={styles.riskBadge}>
                <Ionicons name="shield-checkmark" size={14} color="#10B981" />
                <ThemedText style={styles.riskBadgeText}>Current Risk: 18% (Low)</ThemedText>
              </View>
              <ThemedText style={styles.timeText}>Peak Window: 3:00 PM</ThemedText>
            </View>

            <View style={styles.riskMainRow}>
              <View style={styles.scoreGaugeCircle}>
                <ThemedText style={styles.gaugeNum}>18%</ThemedText>
                <ThemedText style={styles.gaugeSub}>Risk Score</ThemedText>
              </View>

              <View style={{ flex: 1, gap: 4 }}>
                <ThemedText style={styles.riskTitle}>Primary Watch: Screen Fatigue</ThemedText>
                <ThemedText style={styles.riskSub}>
                  Neural models predict elevated urge sensitivity during late afternoon continuous work. Pre-armed protocols active.
                </ThemedText>
              </View>
            </View>

            <TouchableOpacity
              style={styles.archExplainerBtn}
              onPress={() => {
                triggerHaptic();
                setIsArchModalVisible(true);
              }}
            >
              <Ionicons name="sparkles" size={14} color="#2B6BFF" />
              <ThemedText style={styles.archExplainerText}>How Trigger Data Syncs Across App</ThemedText>
              <Ionicons name="chevron-forward" size={14} color="#2B6BFF" />
            </TouchableOpacity>
          </View>

          {/* 24-Hour Vulnerability Heatmap */}
          <View style={styles.heatmapSection}>
            <View style={styles.sectionHeaderRow}>
              <ThemedText style={styles.sectionTitle}>Circadian Urge Heatmap</ThemedText>
              <ThemedText style={styles.sectionSub}>24-Hour Probability Matrix</ThemedText>
            </View>

            <View style={styles.heatmapRow}>
              {hourlyHeatmap.map((item) => (
                <View key={item.hour} style={styles.heatmapCol}>
                  <View style={[styles.heatmapBar, { backgroundColor: item.color, height: item.level === 'high' ? 48 : item.level === 'mid' ? 32 : 18 }]} />
                  <ThemedText style={styles.heatmapLabel}>{item.hour}</ThemedText>
                </View>
              ))}
            </View>
          </View>

          {/* Trigger Categories Filter */}
          <View style={styles.categorySection}>
            <ThemedText style={styles.sectionTitle}>Detected Trigger Patterns</ThemedText>
            
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
              {['All', 'Circadian', 'Emotional', 'Environmental', 'Physical'].map((cat) => (
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

          {/* Filtered Triggers Grid */}
          <View style={styles.triggersList}>
            {filteredTriggers.map((t) => (
              <View key={t.id} style={styles.triggerCard}>
                <View style={styles.cardTop}>
                  <View style={[styles.catBadge, { backgroundColor: `${t.color}18` }]}>
                    <ThemedText style={[styles.catBadgeText, { color: t.color }]}>{t.category}</ThemedText>
                  </View>
                  <ThemedText style={styles.freqText}>{t.frequency} Occurrences Logged</ThemedText>
                </View>

                <ThemedText style={styles.cardTitle}>{t.name}</ThemedText>
                <ThemedText style={styles.peakText}>Peak Vulnerability Window: {t.peakTime}</ThemedText>

                <View style={styles.recBox}>
                  <Ionicons name="bulb-outline" size={14} color="#2B6BFF" />
                  <ThemedText style={styles.recText}>{t.recommendation}</ThemedText>
                </View>
              </View>
            ))}
          </View>

          {/* Timeline Visualization */}
          <View style={styles.timelineSection}>
            <ThemedText style={styles.sectionTitle}>Chronological Trigger Timeline</ThemedText>
            
            <View style={styles.timelineList}>
              {timelineEvents.map((ev) => (
                <View key={ev.id} style={styles.timelineItem}>
                  <View style={styles.timelineDot} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <View style={styles.timelineHeader}>
                      <ThemedText style={styles.eventTitle}>{ev.triggerName}</ThemedText>
                      <View style={styles.statusBadge}>
                        <ThemedText style={styles.statusText}>{ev.status}</ThemedText>
                      </View>
                    </View>
                    <ThemedText style={styles.eventTime}>{ev.time}</ThemedText>
                    <ThemedText style={styles.eventAction}>{ev.resolutionAction}</ThemedText>
                  </View>
                </View>
              ))}
            </View>
          </View>

        </ScrollView>
      </SafeAreaView>

      {/* Trigger System Architecture Explainer Modal */}
      <Modal
        visible={isArchModalVisible}
        transparent
        animationType="slide"
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
              <Ionicons name="git-network" size={20} color="#2B6BFF" />
              <ThemedText style={styles.modalTitle}>Trigger Data Lifecycle</ThemedText>
            </View>

            <View style={styles.stepBox}>
              <ThemedText style={styles.stepTitle}>1. CREATED</ThemedText>
              <ThemedText style={styles.stepDesc}>Generated via 90-sec Daily Check-Ins, Journal NLP extraction, or Urge Rescue logs.</ThemedText>
            </View>

            <View style={styles.stepBox}>
              <ThemedText style={styles.stepTitle}>2. STORED</ThemedText>
              <ThemedText style={styles.stepDesc}>Saved into daily vector memory logs and your long-term Trigger Knowledge Graph.</ThemedText>
            </View>

            <View style={styles.stepBox}>
              <ThemedText style={styles.stepTitle}>3. ANALYZED</ThemedText>
              <ThemedText style={styles.stepDesc}>Evaluated by neural risk prediction models to calculate 24-hour heatmaps & vulnerability scores.</ThemedText>
            </View>

            <View style={styles.stepBox}>
              <ThemedText style={styles.stepTitle}>4. SURFACED</ThemedText>
              <ThemedText style={styles.stepDesc}>Injected into AI Coach Chat context, Home Dashboard indicators, & pre-armed Emergency resets.</ThemedText>
            </View>

            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={() => setIsArchModalVisible(false)}
            >
              <ThemedText style={styles.modalCloseText}>Got It</ThemedText>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradientBg: { flex: 1 },
  safeArea: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingVertical: 10,
  },
  backBtn: {
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 4,
  },
  categoryBadge: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.4)',
    letterSpacing: 1.5,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#ffffff',
    marginTop: 2,
  },
  infoBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(43, 107, 255, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    paddingBottom: 110,
    gap: Spacing.three,
  },
  riskCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    padding: Spacing.three,
    gap: Spacing.two,
  },
  riskTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  riskBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  riskBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#10B981',
  },
  timeText: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.4)',
  },
  riskMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  scoreGaugeCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderWidth: 2,
    borderColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
  },
  gaugeNum: {
    fontSize: 20,
    fontWeight: '800',
    color: '#10B981',
  },
  gaugeSub: {
    fontSize: 8.5,
    color: 'rgba(255, 255, 255, 0.5)',
    textTransform: 'uppercase',
  },
  riskTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
  },
  riskSub: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
    lineHeight: 17,
  },
  archExplainerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(43, 107, 255, 0.08)',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 4,
  },
  archExplainerText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2B6BFF',
  },
  heatmapSection: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    padding: Spacing.three,
    gap: 12,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
  },
  sectionSub: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.4)',
  },
  heatmapRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 70,
    paddingTop: 10,
  },
  heatmapCol: {
    alignItems: 'center',
    gap: 6,
  },
  heatmapBar: {
    width: 14,
    borderRadius: 7,
  },
  heatmapLabel: {
    fontSize: 9.5,
    color: 'rgba(255, 255, 255, 0.5)',
  },
  categorySection: {
    gap: 10,
    marginTop: 2,
  },
  filterRow: {
    gap: 8,
  },
  catChip: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  catChipActive: {
    backgroundColor: '#2B6BFF',
    borderColor: '#2B6BFF',
  },
  catChipText: {
    fontSize: 11.5,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  catChipTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  triggersList: {
    gap: 10,
  },
  triggerCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    padding: Spacing.three,
    gap: 8,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  catBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  catBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  freqText: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.4)',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  peakText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  recBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(43, 107, 255, 0.08)',
    borderRadius: 12,
    padding: 10,
    marginTop: 2,
  },
  recText: {
    fontSize: 11.5,
    color: 'rgba(255, 255, 255, 0.8)',
    flex: 1,
    lineHeight: 16,
  },
  timelineSection: {
    gap: 12,
    marginTop: 4,
  },
  timelineList: {
    gap: 12,
    borderLeftWidth: 1.5,
    borderLeftColor: 'rgba(255, 255, 255, 0.08)',
    paddingLeft: 14,
    marginLeft: 6,
  },
  timelineItem: {
    gap: 4,
    position: 'relative',
  },
  timelineDot: {
    position: 'absolute',
    left: -20,
    top: 4,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#2B6BFF',
  },
  timelineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  eventTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
  statusBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#10B981',
  },
  eventTime: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.4)',
  },
  eventAction: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.65)',
    marginTop: 2,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#0B0D14',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: Spacing.four,
    gap: Spacing.three,
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
    fontSize: 18,
    fontWeight: '800',
    color: '#ffffff',
  },
  stepBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    padding: 12,
    gap: 2,
  },
  stepTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#2B6BFF',
    letterSpacing: 1,
  },
  stepDesc: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    lineHeight: 17,
  },
  modalCloseBtn: {
    backgroundColor: '#2B6BFF',
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  modalCloseText: {
    color: '#ffffff',
    fontSize: 13.5,
    fontWeight: '700',
  },
});
