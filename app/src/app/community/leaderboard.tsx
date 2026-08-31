import React, { useState, useEffect, useMemo } from 'react';
import {
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  View,
  Platform,
  ActivityIndicator,
  Text,
} from 'react-native';
import { useRouter, Stack, useFocusEffect } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { useHabitStore } from '@/store/habit-store';
import { useOnboardingStore } from '@/store/onboarding-store';
import { useSpartanStore } from '@/store/spartan-store';
import { communityApi, CommunityRanking } from '@/services/community-api';
import { SpartanCellData } from '@/services/spartan-api';

const triggerHaptic = (style = Haptics.ImpactFeedbackStyle.Light) => {
  try {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(style);
    }
  } catch (error) {
    // Silent catch
  }
};

export interface GamifiedRank {
  id: string;
  badge: string;
  name: string;
  minDays: number;
  maxDays: number;
  color: string;
}

export const GAMIFIED_RANKS: GamifiedRank[] = [
  { id: 'bronze-1', badge: '🥉', name: 'Bronze I', minDays: 1, maxDays: 7, color: '#D97706' },
  { id: 'bronze-2', badge: '🥉', name: 'Bronze II', minDays: 8, maxDays: 14, color: '#E58A35' },
  { id: 'bronze-3', badge: '🥉', name: 'Bronze III', minDays: 15, maxDays: 30, color: '#F59E0B' },
  { id: 'silver-1', badge: '🥈', name: 'Silver I', minDays: 31, maxDays: 45, color: '#CBD5E1' },
  { id: 'silver-2', badge: '🥈', name: 'Silver II', minDays: 46, maxDays: 60, color: '#E2E8F0' },
  { id: 'silver-3', badge: '🥈', name: 'Silver III', minDays: 61, maxDays: 90, color: '#F1F5F9' },
  { id: 'gold-1', badge: '🥇', name: 'Gold I', minDays: 91, maxDays: 120, color: '#FBBF24' },
  { id: 'gold-2', badge: '🥇', name: 'Gold II', minDays: 121, maxDays: 180, color: '#F59E0B' },
  { id: 'gold-3', badge: '🥇', name: 'Gold III', minDays: 181, maxDays: 270, color: '#FFD700' },
  { id: 'platinum', badge: '💎', name: 'Platinum', minDays: 271, maxDays: 365, color: '#00E5FF' },
  { id: 'diamond', badge: '⚔️', name: 'Diamond', minDays: 366, maxDays: 730, color: '#38BDF8' },
  { id: 'master', badge: '👑', name: 'Master', minDays: 731, maxDays: 1095, color: '#A855F7' },
  { id: 'grandmaster', badge: '🌟', name: 'Grandmaster', minDays: 1096, maxDays: 1825, color: '#EC4899' },
  { id: 'sage', badge: '🔱', name: 'Sage', minDays: 1826, maxDays: 3650, color: '#10B981' },
  { id: 'legend', badge: '☀️', name: 'Legend', minDays: 3651, maxDays: Infinity, color: '#FF5722' },
];

export const getGamifiedRank = (days: number): GamifiedRank => {
  const d = typeof days === 'number' && !isNaN(days) ? days : 0;
  if (d <= 0) return GAMIFIED_RANKS[0];
  const found = GAMIFIED_RANKS.find((r) => d >= r.minDays && d <= r.maxDays);
  return found || GAMIFIED_RANKS[GAMIFIED_RANKS.length - 1];
};

const webNoOutline = Platform.OS === 'web'
  ? ({ outlineStyle: 'none', outlineWidth: 0, webkitTapHighlightColor: 'transparent' } as any)
  : {};

export interface LeaderboardUser {
  rank: number;
  name: string;
  streakDays: number;
  badge: string;
  rankTierName: string;
  rankColor: string;
  isSelf?: boolean;
}

export default function CommunityLeaderboardScreen() {
  const router = useRouter();
  const { streak } = useHabitStore();
  const firstName = useOnboardingStore((state) => state.firstName) || 'Operative';
  const { cellLeaderboard, fetchCellLeaderboard } = useSpartanStore();

  const [viewMode, setViewMode] = useState<'warriors' | 'cells'>('warriors');
  const [activeTab, setActiveTab] = useState<'All-Time' | 'Monthly' | 'Weekly'>('All-Time');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [dbRankings, setDbRankings] = useState<CommunityRanking[]>([]);

  // Fetch real user rankings & cell leaderboard
  useEffect(() => {
    fetchRealRankings();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      fetchRealRankings();
      fetchCellLeaderboard();
      useHabitStore.getState().syncFromDatabase();
    }, [])
  );

  const fetchRealRankings = async () => {
    setIsLoading(true);
    try {
      const data = await communityApi.getRankings();
      if (data) {
        setDbRankings(data);
      }
      await fetchCellLeaderboard();
    } catch (e) {
      console.log('Error fetching real rankings from database:', e);
    } finally {
      setIsLoading(false);
    }
  };

  // Combine real database users with current logged-in user dynamically
  const leaderboardUsers: LeaderboardUser[] = useMemo(() => {
    const map = new Map<string, LeaderboardUser>();

    // 1. Add real users fetched from database
    dbRankings.forEach((r) => {
      const isSelf = r.author_name.toLowerCase() === firstName.toLowerCase();
      const sDays = typeof r.streak_days === 'number' ? r.streak_days : 0;
      const rInfo = getGamifiedRank(sDays);

      let medalIcon = rInfo.badge;
      if (r.badge && r.badge.trim() !== '' && r.badge !== '🛡️') {
        medalIcon = r.badge;
      }

      map.set(r.author_name.toLowerCase(), {
        rank: 0,
        name: isSelf ? `${firstName} (You)` : r.author_name,
        streakDays: sDays,
        badge: medalIcon,
        rankTierName: rInfo.name,
        rankColor: rInfo.color,
        isSelf,
      });
    });

    // 2. Ensure current user is present
    if (!map.has(firstName.toLowerCase())) {
      const userRankInfo = getGamifiedRank(streak);
      map.set(firstName.toLowerCase(), {
        rank: 0,
        name: `${firstName} (You)`,
        streakDays: streak,
        badge: userRankInfo.badge,
        rankTierName: userRankInfo.name,
        rankColor: userRankInfo.color,
        isSelf: true,
      });
    }

    // 3. Sort by streakDays descending & assign dynamic rank number 1..N
    const sorted = Array.from(map.values()).sort((a, b) => b.streakDays - a.streakDays);
    return sorted.map((u, idx) => ({ ...u, rank: idx + 1 }));
  }, [dbRankings, streak, firstName]);

  // Self User Rank Info
  const myUser = useMemo(() => leaderboardUsers.find((u) => u.isSelf), [leaderboardUsers]);
  const myRank = myUser?.rank || 1;

  // Top 3 Podium Real Users
  const podiumRank1 = leaderboardUsers[0] || null;
  const podiumRank2 = leaderboardUsers[1] || null;
  const podiumRank3 = leaderboardUsers[2] || null;
  const restRankings = leaderboardUsers.slice(3);

  // Top 3 Podium Spartan Cells
  const cellRank1 = cellLeaderboard[0] || null;
  const cellRank2 = cellLeaderboard[1] || null;
  const cellRank3 = cellLeaderboard[2] || null;
  const restCells = cellLeaderboard.slice(3);

  return (
    <View style={styles.blackBg}>
      <Stack.Screen options={{ headerShown: false }} />

      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
        {/* Pitch Black Header Bar */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backBtn}
            activeOpacity={0.7}
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
            <ThemedText style={styles.categoryBadge}>GLOBAL LIVE RANKINGS</ThemedText>
            <ThemedText style={styles.headerTitle}>Leaderboard</ThemedText>
          </View>

          <TouchableOpacity
            style={styles.backBtn}
            activeOpacity={0.7}
            onPress={() => {
              triggerHaptic();
              fetchRealRankings();
            }}
          >
            <Ionicons name="refresh-outline" size={18} color="#00E5FF" />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Main Segment Switch: Warriors vs Spartan Cells */}
          <View style={styles.mainSegmentRow}>
            <TouchableOpacity
              style={[styles.segmentBtn, viewMode === 'warriors' && styles.segmentBtnActive]}
              activeOpacity={0.8}
              onPress={() => {
                triggerHaptic();
                setViewMode('warriors');
              }}
            >
              <Ionicons name="person" size={16} color={viewMode === 'warriors' ? '#000000' : '#94A3B8'} style={{ marginRight: 6 }} />
              <ThemedText style={[styles.segmentBtnText, viewMode === 'warriors' && styles.segmentBtnTextActive]}>
                Solo Warriors
              </ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.segmentBtn, viewMode === 'cells' && styles.segmentBtnActive]}
              activeOpacity={0.8}
              onPress={() => {
                triggerHaptic();
                setViewMode('cells');
              }}
            >
              <ThemedText style={{ marginRight: 6, fontSize: 14 }}>🛡️</ThemedText>
              <ThemedText style={[styles.segmentBtnText, viewMode === 'cells' && styles.segmentBtnTextActive]}>
                Spartan Cells
              </ThemedText>
            </TouchableOpacity>
          </View>

          {/* Timeframe Filter Tabs (When in Warriors mode) */}
          {viewMode === 'warriors' && (
            <View style={styles.tabRow}>
              {(['All-Time', 'Monthly', 'Weekly'] as const).map((tab) => (
                <TouchableOpacity
                  key={tab}
                  style={[styles.tabChip, activeTab === tab && styles.tabChipActive]}
                  activeOpacity={0.7}
                  onPress={() => {
                    triggerHaptic();
                    setActiveTab(tab);
                  }}
                >
                  <ThemedText style={[styles.tabChipText, activeTab === tab && styles.tabChipTextActive]}>
                    {tab} Streaks
                  </ThemedText>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Loading Indicator */}
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#00E5FF" />
              <ThemedText style={styles.loadingText}>Fetching real database streaks...</ThemedText>
            </View>
          ) : viewMode === 'cells' ? (
            /* ── SPARTAN CELLS LEADERBOARD VIEW ── */
            <>
              {/* Cell Hub Shortcut Banner */}
              <TouchableOpacity
                style={styles.cellShortcutBanner}
                activeOpacity={0.8}
                onPress={() => {
                  triggerHaptic();
                  router.push('/community/cell' as any);
                }}
              >
                <View style={{ flex: 1 }}>
                  <ThemedText style={styles.cellShortcutTitle}>🛡️ Enter Your Spartan Cell Hub</ThemedText>
                  <ThemedText style={styles.cellShortcutSub}>
                    View your squad roster, Gold Shield status, or establish a new 20-man cell.
                  </ThemedText>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#00E5FF" />
              </TouchableOpacity>

              {/* Cell Rankings List */}
              <View style={styles.listSection}>
                <ThemedText style={styles.sectionTitle}>Global Spartan Cells ({cellLeaderboard.length})</ThemedText>

                {cellLeaderboard.length === 0 ? (
                  <View style={styles.emptyListState}>
                    <ThemedText style={{ fontSize: 36, marginBottom: 8 }}>🛡️</ThemedText>
                    <ThemedText style={styles.emptyListTitle}>No Spartan Cells Established</ThemedText>
                    <ThemedText style={styles.emptyListSub}>
                      Be the first Commander to create a Spartan Cell and claim the #1 global rank!
                    </ThemedText>
                  </View>
                ) : (
                  <View style={styles.rankingsList}>
                    {cellLeaderboard.map((cell, idx) => (
                      <View key={cell.id} style={styles.cellRankCard}>
                        <View style={styles.cellRankNumBox}>
                          <ThemedText style={[
                            styles.cellRankNumText,
                            idx === 0 ? { color: '#F59E0B' } : idx === 1 ? { color: '#CBD5E1' } : idx === 2 ? { color: '#D97706' } : { color: '#64748B' }
                          ]}>
                            #{idx + 1}
                          </ThemedText>
                        </View>

                        <View style={styles.cellRankInfo}>
                          <View style={styles.cellRankTitleRow}>
                            <ThemedText style={styles.cellRankName}>{cell.name}</ThemedText>
                            <View style={[
                              styles.shieldMiniBadge,
                              cell.shield_status === 'gold' ? styles.shieldMiniGold : styles.shieldMiniActive
                            ]}>
                              <ThemedText style={styles.shieldMiniText}>
                                {cell.shield_status === 'gold' ? '🛡️ GOLD' : '🛡️ SHIELD'}
                              </ThemedText>
                            </View>
                          </View>
                          <ThemedText style={styles.cellRankMotto}>{cell.motto}</ThemedText>
                          <ThemedText style={styles.cellRankMeta}>
                            Commander: {cell.leader_name} • {cell.member_count} Warriors
                          </ThemedText>
                        </View>

                        <View style={styles.cellRankStreakBox}>
                          <ThemedText style={styles.cellRankStreakText}>🔥 {cell.total_streak}d</ThemedText>
                          <ThemedText style={styles.cellRankStreakSub}>Squad Streak</ThemedText>
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </>
          ) : (
            /* ── SOLO WARRIORS LEADERBOARD VIEW ── */
            <>
              {/* Top 3 Podium Section (Only Real DB Users) */}
              <View style={styles.podiumSection}>
                {/* Rank 2 - Silver */}
                <View style={[styles.podiumCard, styles.podiumRank2]}>
                  <View style={[styles.avatarCircle, { backgroundColor: '#CBD5E120', borderColor: '#CBD5E1' }]}>
                    <Text style={styles.podiumMedalIcon}>{podiumRank2 ? podiumRank2.badge : '🥈'}</Text>
                  </View>
                  <ThemedText style={styles.podiumName} numberOfLines={1}>
                    {podiumRank2 ? podiumRank2.name : 'Waiting...'}
                  </ThemedText>
                  <ThemedText style={styles.podiumDays}>
                    {podiumRank2 ? `${podiumRank2.streakDays} Days` : '--'}
                  </ThemedText>
                  <View style={styles.rankBadgeSilver}>
                    <ThemedText style={styles.rankBadgeText}>#2 Silver</ThemedText>
                  </View>
                </View>

                {/* Rank 1 - Gold Center */}
                <View style={[styles.podiumCard, styles.podiumRank1]}>
                  <View style={[styles.avatarCircleGold, { backgroundColor: '#F59E0B25', borderColor: '#F59E0B' }]}>
                    <Text style={styles.podiumMedalIconGold}>{podiumRank1 ? podiumRank1.badge : '🥇'}</Text>
                  </View>
                  <ThemedText style={styles.podiumNameGold} numberOfLines={1}>
                    {podiumRank1 ? podiumRank1.name : 'Waiting...'}
                  </ThemedText>
                  <ThemedText style={styles.podiumDaysGold}>
                    {podiumRank1 ? `${podiumRank1.streakDays} Days Clean` : '--'}
                  </ThemedText>
                  <View style={styles.rankBadgeGold}>
                    <ThemedText style={styles.rankBadgeGoldText}>👑 Rank #1 Gold</ThemedText>
                  </View>
                </View>

                {/* Rank 3 - Bronze */}
                <View style={[styles.podiumCard, styles.podiumRank3]}>
                  <View style={[styles.avatarCircle, { backgroundColor: '#D9770620', borderColor: '#D97706' }]}>
                    <Text style={styles.podiumMedalIcon}>{podiumRank3 ? podiumRank3.badge : '🥉'}</Text>
                  </View>
                  <ThemedText style={styles.podiumName} numberOfLines={1}>
                    {podiumRank3 ? podiumRank3.name : 'Waiting...'}
                  </ThemedText>
                  <ThemedText style={styles.podiumDays}>
                    {podiumRank3 ? `${podiumRank3.streakDays} Days` : '--'}
                  </ThemedText>
                  <View style={styles.rankBadgeBronze}>
                    <ThemedText style={styles.rankBadgeText}>#3 Bronze</ThemedText>
                  </View>
                </View>
              </View>

              {/* User's Current Live Database Rank Card */}
              <View style={styles.selfRankCard}>
                <View style={styles.selfRankHeader}>
                  <Ionicons name="sparkles" size={16} color="#00E5FF" />
                  <ThemedText style={styles.selfRankTitle}>Your Live Database Ranking</ThemedText>
                </View>
                <View style={styles.selfRankRow}>
                  <ThemedText style={styles.selfRankNum}>
                    #{myRank} Worldwide
                  </ThemedText>
                  <ThemedText style={styles.selfStreakDays}>{streak} Day{streak !== 1 ? 's' : ''} Unbroken</ThemedText>
                </View>
                <ThemedText style={styles.selfRankSub}>
                  {streak > 0
                    ? 'Keep logging daily check-ins to maintain your position on the database leaderboard!'
                    : 'Complete today\'s challenge to climb up the real global streak rankings!'}
                </ThemedText>
              </View>

              {/* Full Ranked Real Users List */}
              <View style={styles.listSection}>
                <ThemedText style={styles.sectionTitle}>Global Real Operatives List ({leaderboardUsers.length})</ThemedText>

                {leaderboardUsers.length === 0 ? (
                  <View style={styles.emptyListState}>
                    <Ionicons name="people-outline" size={32} color="#64748B" />
                    <ThemedText style={styles.emptyListTitle}>No DB Users Yet</ThemedText>
                    <ThemedText style={styles.emptyListSub}>
                      Post a message in World Chat to record your streak in the database!
                    </ThemedText>
                  </View>
                ) : (
                  <View style={styles.rankingsList}>
                    {leaderboardUsers.map((u) => (
                      <View
                        key={`${u.name}-${u.rank}`}
                        style={[styles.rankTile, u.isSelf && styles.rankTileSelf]}
                      >
                        <ThemedText style={[styles.rankNumber, u.isSelf && { color: '#00E5FF', fontWeight: '800' }]}>
                          #{u.rank}
                        </ThemedText>

                        <View style={[styles.tileAvatar, { backgroundColor: `${u.rankColor}20`, borderColor: u.rankColor }]}>
                          <Text style={styles.tileMedalIcon}>{u.badge}</Text>
                        </View>

                        <View style={{ flex: 1, gap: 2 }}>
                          <ThemedText style={[styles.tileName, u.isSelf && { color: '#00E5FF', fontWeight: '800' }]} numberOfLines={1}>
                            {u.name}
                          </ThemedText>
                          <ThemedText style={[styles.tileBadge, { color: u.rankColor }]}>
                            {u.rankTierName}
                          </ThemedText>
                        </View>

                        <View style={[styles.streakBadgeBox, { borderColor: `${u.rankColor}50` }]}>
                          <Ionicons name="flame" size={14} color="#F59E0B" />
                          <ThemedText style={styles.streakDaysText}>{u.streakDays} Days</ThemedText>
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  blackBg: {
    flex: 1,
    backgroundColor: '#000000',
  },
  safeArea: {
    flex: 1,
    backgroundColor: '#000000',
  },
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
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
    ...webNoOutline,
  },
  categoryBadge: {
    fontSize: 9,
    fontWeight: '800',
    color: '#00E5FF',
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
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 14,
  },
  tabRow: {
    flexDirection: 'row',
    gap: 8,
  },
  tabChip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(18, 18, 18, 0.95)',
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    ...webNoOutline,
  },
  tabChipActive: {
    backgroundColor: 'rgba(0, 229, 255, 0.18)',
    borderColor: '#00E5FF',
  },
  tabChipText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#64748B',
  },
  tabChipTextActive: {
    color: '#00E5FF',
    fontWeight: '800',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
    color: '#00E5FF',
  },

  // Podium Section
  podiumSection: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
  },
  podiumCard: {
    flex: 1,
    backgroundColor: 'rgba(18, 18, 18, 0.95)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.15)',
    padding: 10,
    alignItems: 'center',
    gap: 4,
  },
  podiumRank1: {
    backgroundColor: 'rgba(0, 229, 255, 0.12)',
    borderColor: '#00E5FF',
    paddingVertical: 14,
  },
  podiumRank2: {
    borderColor: 'rgba(203, 213, 225, 0.4)',
  },
  podiumRank3: {
    borderColor: 'rgba(217, 119, 6, 0.4)',
  },
  avatarCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarCircleGold: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  podiumMedalIcon: {
    fontSize: 18,
    includeFontPadding: false,
  },
  podiumMedalIconGold: {
    fontSize: 22,
    includeFontPadding: false,
  },
  podiumName: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  podiumNameGold: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#00E5FF',
  },
  podiumDays: {
    fontSize: 10,
    color: '#64748B',
  },
  podiumDaysGold: {
    fontSize: 11,
    fontWeight: '700',
    color: '#F59E0B',
  },
  rankBadgeSilver: {
    backgroundColor: 'rgba(203, 213, 225, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  rankBadgeGold: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  rankBadgeBronze: {
    backgroundColor: 'rgba(217, 119, 6, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  rankBadgeText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#CBD5E1',
  },
  rankBadgeGoldText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#F59E0B',
  },

  // Self Rank Card
  selfRankCard: {
    backgroundColor: 'rgba(0, 229, 255, 0.10)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.3)',
    padding: 12,
    gap: 6,
  },
  selfRankHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  selfRankTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#00E5FF',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  selfRankRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selfRankNum: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  selfStreakDays: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#F59E0B',
  },
  selfRankSub: {
    fontSize: 11,
    color: '#94A3B8',
    lineHeight: 15,
  },

  // Full Ranked List
  listSection: {
    gap: 10,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  emptyListState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 30,
    gap: 6,
  },
  emptyListTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  emptyListSub: {
    fontSize: 11.5,
    color: '#64748B',
    textAlign: 'center',
    maxWidth: 240,
  },
  rankingsList: {
    gap: 6,
  },
  rankTile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(18, 18, 18, 0.95)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.12)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    ...webNoOutline,
  },
  rankTileSelf: {
    backgroundColor: 'rgba(0, 229, 255, 0.12)',
    borderColor: '#00E5FF',
  },
  rankNumber: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#64748B',
    width: 28,
  },
  tileAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileMedalIcon: {
    fontSize: 14,
    includeFontPadding: false,
  },
  tileName: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  tileBadge: {
    fontSize: 10,
    fontWeight: '600',
  },
  streakBadgeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  streakDaysText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#F59E0B',
  },
  mainSegmentRow: {
    flexDirection: 'row',
    backgroundColor: '#0F172A',
    borderRadius: 14,
    padding: 4,
    gap: 6,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  segmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
  },
  segmentBtnActive: {
    backgroundColor: '#00E5FF',
  },
  segmentBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#94A3B8',
  },
  segmentBtnTextActive: {
    color: '#000000',
    fontWeight: '800',
  },
  cellShortcutBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0B1120',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.3)',
  },
  cellShortcutTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  cellShortcutSub: {
    fontSize: 11,
    color: '#94A3B8',
    lineHeight: 15,
  },
  cellRankCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#1E293B',
    gap: 10,
  },
  cellRankNumBox: {
    width: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellRankNumText: {
    fontSize: 14,
    fontWeight: '900',
  },
  cellRankInfo: {
    flex: 1,
  },
  cellRankTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  cellRankName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  shieldMiniBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: 'rgba(0, 229, 255, 0.15)',
  },
  shieldMiniGold: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
  },
  shieldMiniActive: {
    backgroundColor: 'rgba(0, 229, 255, 0.15)',
  },
  shieldMiniText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#F59E0B',
  },
  cellRankMotto: {
    fontSize: 11,
    color: '#94A3B8',
    fontStyle: 'italic',
    marginBottom: 2,
  },
  cellRankMeta: {
    fontSize: 10,
    color: '#64748B',
  },
  cellRankStreakBox: {
    alignItems: 'flex-end',
  },
  cellRankStreakText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#EF4444',
  },
  cellRankStreakSub: {
    fontSize: 9,
    color: '#64748B',
  },
});
