import React from 'react';
import {
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  View,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { PageEntrance } from '@/components/ui/smooth-loader';

const triggerHaptic = (style = Haptics.ImpactFeedbackStyle.Medium) => {
  try {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(style);
    }
  } catch (error) {
    // Silent catch
  }
};

const webNoOutline = Platform.OS === 'web'
  ? ({ outlineStyle: 'none', outlineWidth: 0, webkitTapHighlightColor: 'transparent' } as any)
  : {};

export default function EmergencyIndexScreen() {
  const router = useRouter();
  const { width: windowWidth } = useWindowDimensions();

  const isTablet = windowWidth > 600;
  const tileWidth = isTablet ? (windowWidth - 48 - 12) / 2 : '100%';

  const emergencyTools = [
    {
      id: 'breathing',
      title: '5-Min Mind Shield Protocol',
      subtitle: 'Dirgha (1m) + Bhramari (2m) + Nadi Shodhana (2m)',
      icon: 'sync-outline' as const,
      route: '/emergency/breathing',
      color: '#EF4444',
      badge: 'Immediate De-escalation',
    },
    {
      id: 'grounding',
      title: 'Sensory Grounding',
      subtitle: '5-4-3-2-1 technique to anchor focus',
      icon: 'body-outline' as const,
      route: '/emergency/grounding',
      color: '#10B981',
      badge: 'Sensory Anchor',
    },
    {
      id: 'urge-surfing',
      title: 'Urge Surfing',
      subtitle: 'Ride out the 90-second craving wave',
      icon: 'water-outline' as const,
      route: '/emergency/urge-surfing',
      color: '#8B5CF6',
      badge: 'Mindfulness',
    },
  ];

  return (
    <View style={styles.blackBg}>
      <Stack.Screen options={{ headerShown: false }} />

      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
        {/* Header Bar */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backBtn}
            activeOpacity={0.7}
            onPress={() => {
              triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
              router.back();
            }}
          >
            <Ionicons name="chevron-back" size={24} color="#00E5FF" />
          </TouchableOpacity>

          <View style={{ alignItems: 'center', flex: 1 }}>
            <View style={styles.badgeRow}>
              <View style={styles.sosPulseDot} />
              <ThemedText style={styles.categoryBadge}>URGE RESCUE COMMAND</ThemedText>
            </View>
            <ThemedText style={styles.headerTitle}>Urge Rescue Hub</ThemedText>
          </View>

          <View style={{ width: 36 }} />
        </View>

        <PageEntrance style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {/* Primary SOS Hero Card */}
            <TouchableOpacity
              style={styles.heroCard}
              activeOpacity={0.9}
              onPress={() => {
                triggerHaptic(Haptics.ImpactFeedbackStyle.Heavy);
                router.push('/emergency/breathing' as any);
              }}
            >
              <LinearGradient
                colors={['rgba(239, 68, 68, 0.28)', 'rgba(239, 68, 68, 0.08)']}
                style={styles.heroGradient}
              >
              <View style={styles.heroTopRow}>
                <View style={styles.heroIconBox}>
                  <Ionicons name="shield-half" size={24} color="#EF4444" />
                </View>
                <View style={styles.heroBadge}>
                  <ThemedText style={styles.heroBadgeText}>Best Urge De-escalation</ThemedText>
                </View>
              </View>

              <View style={styles.heroTextSection}>
                <ThemedText style={styles.heroTitleText}>Interrupt Urge Loop</ThemedText>
                <ThemedText style={styles.heroSubtitle}>
                  5-Minute Sequence: Diaphragmatic + Bhramari + Nadi Shodhana + Sensory Grounding.
                </ThemedText>
              </View>

              <View style={styles.heroStartBtn}>
                <ThemedText style={styles.heroStartText}>Start 5-Minute Emergency Protocol</ThemedText>
                <Ionicons name="arrow-forward" size={15} color="#000000" />
              </View>
            </LinearGradient>
          </TouchableOpacity>

          {/* Emergency Protocols Grid */}
          <View style={styles.toolsSection}>
            <View style={styles.sectionHeaderRow}>
              <ThemedText style={styles.sectionTitle}>De-escalation Protocols</ThemedText>
              <ThemedText style={styles.sectionCount}>3 Instant Tools</ThemedText>
            </View>

            <View style={styles.toolsGrid}>
              {emergencyTools.map((tool) => (
                <TouchableOpacity
                  key={tool.id}
                  style={[styles.toolCard, { width: tileWidth }]}
                  activeOpacity={0.8}
                  onPress={() => {
                    triggerHaptic();
                    router.push(tool.route as any);
                  }}
                >
                  <View style={styles.toolTopRow}>
                    <View style={[styles.toolIconBox, { backgroundColor: `${tool.color}18`, borderColor: tool.color }]}>
                      <Ionicons name={tool.icon} size={20} color={tool.color} />
                    </View>
                    <View style={[styles.toolBadge, { backgroundColor: `${tool.color}15`, borderColor: `${tool.color}30` }]}>
                      <ThemedText style={[styles.toolBadgeText, { color: tool.color }]}>{tool.badge}</ThemedText>
                    </View>
                  </View>

                  <View style={{ gap: 3 }}>
                    <ThemedText style={styles.toolTitle}>{tool.title}</ThemedText>
                    <ThemedText style={styles.toolSub}>{tool.subtitle}</ThemedText>
                  </View>

                  <View style={styles.toolFooter}>
                    <ThemedText style={[styles.toolActionText, { color: tool.color }]}>Launch Tool</ThemedText>
                    <Ionicons name="chevron-forward" size={14} color={tool.color} />
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </ScrollView>
      </PageEntrance>
    </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  blackBg: { flex: 1, backgroundColor: '#000000' },
  safeArea: { flex: 1, backgroundColor: '#000000' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 229, 255, 0.15)',
    backgroundColor: '#000000',
  },
  backBtn: {
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 4,
    ...webNoOutline,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sosPulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#EF4444',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },
  categoryBadge: {
    fontSize: 9,
    fontWeight: '800',
    color: '#EF4444',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  scrollContent: {
    padding: 16,
    gap: 16,
  },

  // Hero Card
  heroCard: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
    overflow: 'hidden',
    backgroundColor: 'rgba(18, 18, 18, 0.95)',
    ...webNoOutline,
  },
  heroGradient: {
    padding: 18,
    gap: 12,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroBadge: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  heroBadgeText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#EF4444',
  },
  heroTextSection: {
    gap: 4,
  },
  heroTitleText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#ffffff',
  },
  heroSubtitle: {
    fontSize: 12.5,
    color: '#CBD5E1',
    lineHeight: 18,
  },
  heroStartBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#00E5FF',
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 4,
  },
  heroStartText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#000000',
  },

  // Tools Section
  toolsSection: {
    gap: 12,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#ffffff',
  },
  sectionCount: {
    fontSize: 11,
    color: '#64748B',
  },
  toolsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  toolCard: {
    backgroundColor: 'rgba(18, 18, 18, 0.55)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.15)',
    padding: 14,
    gap: 10,
    ...webNoOutline,
  },
  toolTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  toolIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolBadge: {
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  toolBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
  },
  toolTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
  toolSub: {
    fontSize: 11.5,
    color: '#94A3B8',
    lineHeight: 16,
  },
  toolFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  toolActionText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
});
