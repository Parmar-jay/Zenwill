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
import { useRouter, useFocusEffect } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';
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
  } catch (error) {}
};

// Clean, Vector Crest Icon for Cohorts & Rank Badges
const CohortCrestVector = ({ size = 28, color = '#00E5FF', rank = 0 }: { size?: number; color?: string; rank?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
    <Defs>
      <SvgLinearGradient id={`crestGrad-${rank}`} x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0%" stopColor={color} stopOpacity="0.3" />
        <Stop offset="100%" stopColor={color} stopOpacity="0.05" />
      </SvgLinearGradient>
    </Defs>
    <Path
      d="M16 2L5 7V15C5 22.5 9.8 28.3 16 30C22.2 28.3 27 22.5 27 15V7L16 2Z"
      fill={`url(#crestGrad-${rank})`}
      stroke={color}
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path
      d="M11.5 20L16 10L20.5 20"
      stroke={color}
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path
      d="M13 17H19"
      stroke={color}
      strokeWidth="1.8"
      strokeLinecap="round"
    />
  </Svg>
);

export interface GamifiedRank {
  id: string;
  name: string;
  minDays: number;
  maxDays: number;
  color: string;
}

export const GAMIFIED_RANKS: GamifiedRank[] = [
  { id: 'bronze-1', name: 'Bronze I', minDays: 1, maxDays: 7, color: '#D97706' },
  { id: 'bronze-2', name: 'Bronze II', minDays: 8, maxDays: 14, color: '#E58A35' },
  { id: 'bronze-3', name: 'Bronze III', minDays: 15, maxDays: 30, color: '#F59E0B' },
  { id: 'silver-1', name: 'Silver I', minDays: 31, maxDays: 45, color: '#94A3B8' },
  { id: 'silver-2', name: 'Silver II', minDays: 46, maxDays: 60, color: '#CBD5E1' },
  { id: 'silver-3', name: 'Silver III', minDays: 61, maxDays: 90, color: '#E2E8F0' },
  { id: 'gold-1', name: 'Gold I', minDays: 91, maxDays: 120, color: '#FBBF24' },
  { id: 'gold-2', name: 'Gold II', minDays: 121, maxDays: 180, color: '#F59E0B' },
  { id: 'gold-3', name: 'Gold III', minDays: 181, maxDays: 270, color: '#FFD700' },
  { id: 'platinum', name: 'Platinum', minDays: 271, maxDays: 365, color: '#00E5FF' },
  { id: 'diamond', name: 'Diamond', minDays: 366, maxDays: 730, color: '#38BDF8' },
  { id: 'master', name: 'Master', minDays: 731, maxDays: 1095, color: '#A855F7' },
  { id: 'grandmaster', name: 'Grandmaster', minDays: 1096, maxDays: 1825, color: '#EC4899' },
  { id: 'sage', name: 'Sage', minDays: 1826, maxDays: 3650, color: '#10B981' },
  { id: 'legend', name: 'Sovereign', minDays: 3651, maxDays: Infinity, color: '#FF5722' },
];

export const getGamifiedRank = (days: number): GamifiedRank => {
  const d = typeof days === 'number' && !isNaN(days) ? days : 0;
  if (d <= 0) return GAMIFIED_RANKS[0];
  const found = GAMIFIED_RANKS.find((r) => d >= r.minDays && d <= r.maxDays);
  return found || GAMIFIED_RANKS[GAMIFIED_RANKS.length - 1];
};

export interface LeaderboardUser {
  rank: number;
  name: string;
  streakDays: number;
  rankTierName: string;
  rankColor: string;
  isSelf?: boolean;
}

export default function CommunityLeaderboardScreen() {
  const router = useRouter();
  const { streak } = useHabitStore();
  const firstName = useOnboardingStore((state) => state.firstName) || 'Operative';
  const { cellLeaderboard, fetchCellLeaderboard } = useSpartanStore();

  const [viewMode, setViewMode] = useState<'individual' | 'cohorts'>('individual');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [dbRankings, setDbRankings] = useState<CommunityRanking[]>([]);

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
      if (data) setDbRankings(data);
      await fetchCellLeaderboard();
    } catch (e) {
      console.log('Error fetching rankings:', e);
    } finally {
      setIsLoading(false);
    }
  };

  // Process and sort Individual Leaderboard Users
  const leaderboardUsers: LeaderboardUser[] = useMemo(() => {
    const map = new Map<string, LeaderboardUser>();

    dbRankings.forEach((r) => {
      const isSelf = r.author_name.toLowerCase() === firstName.toLowerCase();
      const sDays = typeof r.streak_days === 'number' ? r.streak_days : 0;
      const rInfo = getGamifiedRank(sDays);

      map.set(r.author_name.toLowerCase(), {
        rank: 0,
        name: isSelf ? `${firstName} (You)` : r.author_name,
        streakDays: sDays,
        rankTierName: rInfo.name,
        rankColor: rInfo.color,
        isSelf,
      });
    });

    if (!map.has(firstName.toLowerCase())) {
      const userRankInfo = getGamifiedRank(streak);
      map.set(firstName.toLowerCase(), {
        rank: 0,
        name: `${firstName} (You)`,
        streakDays: streak,
        rankTierName: userRankInfo.name,
        rankColor: userRankInfo.color,
        isSelf: true,
      });
    }

    const sorted = Array.from(map.values()).sort((a, b) => b.streakDays - a.streakDays);
    return sorted.map((u, index) => ({
      ...u,
      rank: index + 1,
    }));
  }, [dbRankings, firstName, streak]);

  // Current User Standings
  const currentUserRank = useMemo(() => {
    return leaderboardUsers.find((u) => u.isSelf) || {
      rank: 1,
      name: `${firstName} (You)`,
      streakDays: streak,
      rankTierName: getGamifiedRank(streak).name,
      rankColor: getGamifiedRank(streak).color,
      isSelf: true,
    };
  }, [leaderboardUsers, firstName, streak]);

  // Top 3 Podium Winners
  const podiumWinners = useMemo(() => {
    return leaderboardUsers.slice(0, 3);
  }, [leaderboardUsers]);

  const remainingUsers = useMemo(() => {
    return leaderboardUsers.slice(3);
  }, [leaderboardUsers]);

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        {/* Header */}
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={styles.backBtn}
            activeOpacity={0.7}
            onPress={() => {
              triggerHaptic();
              router.back();
            }}
          >
            <Ionicons name="chevron-back" size={22} color="#00E5FF" />
          </TouchableOpacity>

          <View style={styles.headerTitleGroup}>
            <ThemedText style={styles.headerSubtitle}>GLOBAL DISCIPLINE RANKINGS</ThemedText>
            <ThemedText style={styles.headerTitle}>Honor Leaderboard</ThemedText>
          </View>

          <View style={{ width: 38 }} />
        </View>

        {/* View Mode Segment Switcher */}
        <View style={styles.segmentContainer}>
          <TouchableOpacity
            style={[styles.segmentBtn, viewMode === 'individual' && styles.segmentBtnActive]}
            activeOpacity={0.8}
            onPress={() => {
              triggerHaptic();
              setViewMode('individual');
            }}
          >
            <Ionicons
              name="person-outline"
              size={15}
              color={viewMode === 'individual' ? '#000000' : '#94A3B8'}
              style={{ marginRight: 6 }}
            />
            <ThemedText style={[styles.segmentText, viewMode === 'individual' && styles.segmentTextActive]}>
              Individual Discipline
            </ThemedText>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.segmentBtn, viewMode === 'cohorts' && styles.segmentBtnActive]}
            activeOpacity={0.8}
            onPress={() => {
              triggerHaptic();
              setViewMode('cohorts');
            }}
          >
            <Ionicons
              name="shield-checkmark-outline"
              size={15}
              color={viewMode === 'cohorts' ? '#000000' : '#94A3B8'}
              style={{ marginRight: 6 }}
            />
            <ThemedText style={[styles.segmentText, viewMode === 'cohorts' && styles.segmentTextActive]}>
              Accountability Cells
            </ThemedText>
          </TouchableOpacity>
        </View>

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#00E5FF" />
            <ThemedText style={styles.loadingText}>Syncing Global Honor Matrix...</ThemedText>
          </View>
        ) : viewMode === 'individual' ? (
          /* ── INDIVIDUAL DISCIPLINE RANKINGS ── */
          <ScrollView
            style={styles.scrollContent}
            contentContainerStyle={styles.scrollInner}
            showsVerticalScrollIndicator={false}
          >
            {/* Top 3 Podium */}
            {podiumWinners.length > 0 && (
              <View style={styles.podiumSection}>
                <View style={styles.podiumRow}>
                  {/* Rank 2 (Silver) */}
                  {podiumWinners[1] && (
                    <View style={[styles.podiumColumn, { marginTop: 24 }]}>
                      <View style={[styles.avatarCircle, { borderColor: '#CBD5E1' }]}>
                        <ThemedText style={styles.avatarInitial}>
                          {podiumWinners[1].name.charAt(0).toUpperCase()}
                        </ThemedText>
                        <View style={[styles.podiumRankBadge, { backgroundColor: '#CBD5E1' }]}>
                          <Text style={styles.podiumRankBadgeText}>2</Text>
                        </View>
                      </View>
                      <ThemedText style={styles.podiumName} numberOfLines={1}>
                        {podiumWinners[1].name}
                      </ThemedText>
                      <View style={styles.podiumStreakBadge}>
                        <ThemedText style={styles.podiumStreakText}>🔥 {podiumWinners[1].streakDays}d</ThemedText>
                      </View>
                      <ThemedText style={styles.podiumTierText}>{podiumWinners[1].rankTierName}</ThemedText>
                    </View>
                  )}

                  {/* Rank 1 (Gold - Center) */}
                  {podiumWinners[0] && (
                    <View style={styles.podiumColumn}>
                      <View style={styles.crownContainer}>
                        <Ionicons name="trophy" size={20} color="#F59E0B" />
                      </View>
                      <View style={[styles.avatarCircle, styles.avatarCircleGold]}>
                        <ThemedText style={[styles.avatarInitial, { color: '#F59E0B' }]}>
                          {podiumWinners[0].name.charAt(0).toUpperCase()}
                        </ThemedText>
                        <View style={[styles.podiumRankBadge, { backgroundColor: '#F59E0B' }]}>
                          <Text style={[styles.podiumRankBadgeText, { color: '#000000' }]}>1</Text>
                        </View>
                      </View>
                      <ThemedText style={[styles.podiumName, { fontWeight: '900', color: '#FFFFFF' }]} numberOfLines={1}>
                        {podiumWinners[0].name}
                      </ThemedText>
                      <View style={[styles.podiumStreakBadge, styles.podiumStreakBadgeGold]}>
                        <ThemedText style={[styles.podiumStreakText, { color: '#F59E0B' }]}>
                          🔥 {podiumWinners[0].streakDays}d
                        </ThemedText>
                      </View>
                      <ThemedText style={[styles.podiumTierText, { color: '#F59E0B' }]}>
                        {podiumWinners[0].rankTierName}
                      </ThemedText>
                    </View>
                  )}

                  {/* Rank 3 (Bronze) */}
                  {podiumWinners[2] && (
                    <View style={[styles.podiumColumn, { marginTop: 32 }]}>
                      <View style={[styles.avatarCircle, { borderColor: '#D97706' }]}>
                        <ThemedText style={styles.avatarInitial}>
                          {podiumWinners[2].name.charAt(0).toUpperCase()}
                        </ThemedText>
                        <View style={[styles.podiumRankBadge, { backgroundColor: '#D97706' }]}>
                          <Text style={styles.podiumRankBadgeText}>3</Text>
                        </View>
                      </View>
                      <ThemedText style={styles.podiumName} numberOfLines={1}>
                        {podiumWinners[2].name}
                      </ThemedText>
                      <View style={styles.podiumStreakBadge}>
                        <ThemedText style={styles.podiumStreakText}>🔥 {podiumWinners[2].streakDays}d</ThemedText>
                      </View>
                      <ThemedText style={styles.podiumTierText}>{podiumWinners[2].rankTierName}</ThemedText>
                    </View>
                  )}
                </View>
              </View>
            )}

            {/* Current User Standings Card */}
            <View style={styles.selfStandingCard}>
              <View style={styles.selfStandingLeft}>
                <View style={styles.selfRankNumBox}>
                  <ThemedText style={styles.selfRankNumText}>#{currentUserRank.rank}</ThemedText>
                </View>
                <View>
                  <ThemedText style={styles.selfNameText}>Your Current Standing</ThemedText>
                  <ThemedText style={styles.selfTierText}>{currentUserRank.rankTierName} Cohort</ThemedText>
                </View>
              </View>

              <View style={styles.selfStreakBox}>
                <ThemedText style={styles.selfStreakText}>🔥 {currentUserRank.streakDays} Days</ThemedText>
              </View>
            </View>

            {/* Roster List (Rank 4+) */}
            <View style={styles.listSection}>
              <ThemedText style={styles.sectionHeaderTitle}>HONOR ROLL</ThemedText>
              <View style={styles.rosterCardList}>
                {remainingUsers.map((item) => (
                  <View
                    key={item.name}
                    style={[styles.memberRowCard, item.isSelf && styles.memberRowCardSelf]}
                  >
                    <View style={styles.rankNumBadge}>
                      <ThemedText style={styles.rankNumBadgeText}>#{item.rank}</ThemedText>
                    </View>

                    <View style={styles.memberAvatarCircle}>
                      <ThemedText style={styles.memberAvatarLetter}>
                        {item.name.charAt(0).toUpperCase()}
                      </ThemedText>
                    </View>

                    <View style={styles.memberInfo}>
                      <ThemedText style={styles.memberName} numberOfLines={1}>
                        {item.name}
                      </ThemedText>
                      <ThemedText style={[styles.memberTier, { color: item.rankColor }]}>
                        {item.rankTierName}
                      </ThemedText>
                    </View>

                    <View style={styles.streakBadgePill}>
                      <ThemedText style={styles.streakBadgePillText}>🔥 {item.streakDays}d</ThemedText>
                    </View>
                  </View>
                ))}
              </View>
            </View>

            <View style={{ height: 40 }} />
          </ScrollView>
        ) : (
          /* ── ACCOUNTABILITY CELLS / COHORTS LEADERBOARD ── */
          <ScrollView
            style={styles.scrollContent}
            contentContainerStyle={styles.scrollInner}
            showsVerticalScrollIndicator={false}
          >
            {cellLeaderboard.length === 0 ? (
              <View style={styles.emptyCellsCard}>
                <CohortCrestVector size={48} color="#334155" />
                <ThemedText style={styles.emptyCellsTitle}>No Active Cohorts Yet</ThemedText>
                <ThemedText style={styles.emptyCellsSub}>
                  Be the first Commander to establish a 5–20 member Accountability Cell and climb the global ranks!
                </ThemedText>
                <TouchableOpacity
                  style={styles.createCellCTA}
                  activeOpacity={0.85}
                  onPress={() => {
                    triggerHaptic();
                    router.push('/community/cell' as any);
                  }}
                >
                  <ThemedText style={styles.createCellCTAText}>Establish Accountability Cell</ThemedText>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.cellsList}>
                <ThemedText style={styles.sectionHeaderTitle}>TOP ACCOUNTABILITY COHORTS</ThemedText>
                {cellLeaderboard.map((cell, idx) => {
                  const isTop1 = idx === 0;
                  const isTop2 = idx === 1;
                  const isTop3 = idx === 2;
                  const rankColor = isTop1 ? '#F59E0B' : isTop2 ? '#CBD5E1' : isTop3 ? '#D97706' : '#00E5FF';

                  return (
                    <View key={cell.id} style={[styles.cellRankingCard, isTop1 && styles.cellRankingCardTop1]}>
                      <View style={styles.cellRankHeader}>
                        <View style={styles.cellRankLeft}>
                          <View style={[styles.cellRankBadge, { borderColor: rankColor, backgroundColor: rankColor + '18' }]}>
                            <ThemedText style={[styles.cellRankBadgeText, { color: rankColor }]}>#{idx + 1}</ThemedText>
                          </View>
                          <CohortCrestVector size={26} color={rankColor} rank={idx + 1} />
                          <View style={{ flexShrink: 1 }}>
                            <ThemedText style={styles.cellRankTitle} numberOfLines={1}>{cell.name}</ThemedText>
                            <ThemedText style={styles.cellRankMotto} numberOfLines={1}>{cell.motto}</ThemedText>
                          </View>
                        </View>

                        <View style={styles.cellStreakPill}>
                          <ThemedText style={styles.cellStreakNumber}>🔥 {cell.total_streak}d</ThemedText>
                        </View>
                      </View>

                      <View style={styles.cellRankFooter}>
                        <View style={styles.cellMetaItem}>
                          <Ionicons name="people-outline" size={13} color="#94A3B8" />
                          <ThemedText style={styles.cellMetaText}>
                            {cell.member_count}/{cell.max_members} Members
                          </ThemedText>
                        </View>

                        <View style={styles.cellMetaItem}>
                          <Ionicons name="shield-checkmark" size={13} color="#F59E0B" />
                          <ThemedText style={[styles.cellMetaText, { color: '#F59E0B', fontWeight: '800' }]}>
                            {cell.collective_xp} XP
                          </ThemedText>
                        </View>

                        <View style={styles.cellMetaItem}>
                          <Ionicons name="person-circle-outline" size={13} color="#00E5FF" />
                          <ThemedText style={styles.cellMetaText}>
                            Leader: {cell.leader_name}
                          </ThemedText>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

            <View style={{ height: 40 }} />
          </ScrollView>
        )}
      </SafeAreaView>
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  headerTitleGroup: {
    alignItems: 'center',
  },
  headerSubtitle: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#00E5FF',
    letterSpacing: 1.2,
    marginBottom: 2,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  segmentContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 14,
    padding: 4,
    marginHorizontal: 16,
    marginVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  segmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: 10,
  },
  segmentBtnActive: {
    backgroundColor: '#00E5FF',
  },
  segmentText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
  },
  segmentTextActive: {
    color: '#000000',
    fontWeight: '900',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 13.5,
    color: '#94A3B8',
    marginTop: 12,
    fontWeight: '600',
  },
  scrollContent: {
    flex: 1,
  },
  scrollInner: {
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  podiumSection: {
    marginBottom: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: 20,
    paddingVertical: 16,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  podiumRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
  },
  podiumColumn: {
    alignItems: 'center',
    flex: 1,
  },
  crownContainer: {
    marginBottom: 4,
  },
  avatarCircle: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: '#0F172A',
    borderWidth: 2,
    borderColor: '#94A3B8',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginBottom: 8,
  },
  avatarCircleGold: {
    width: 74,
    height: 74,
    borderRadius: 37,
    borderColor: '#F59E0B',
    borderWidth: 2.5,
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 6,
  },
  avatarInitial: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  podiumRankBadge: {
    position: 'absolute',
    bottom: -4,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#000000',
  },
  podiumRankBadgeText: {
    fontSize: 10.5,
    fontWeight: '900',
    color: '#000000',
  },
  podiumName: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#E2E8F0',
    maxWidth: 90,
    textAlign: 'center',
    marginBottom: 4,
  },
  podiumStreakBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginBottom: 3,
  },
  podiumStreakBadgeGold: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
  },
  podiumStreakText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  podiumTierText: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: '600',
  },
  selfStandingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0, 229, 255, 0.06)',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.25)',
    marginBottom: 16,
  },
  selfStandingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  selfRankNumBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 229, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selfRankNumText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#00E5FF',
  },
  selfNameText: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  selfTierText: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 1,
  },
  selfStreakBox: {
    backgroundColor: 'rgba(0, 229, 255, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  selfStreakText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#00E5FF',
  },
  listSection: {
    marginBottom: 16,
  },
  sectionHeaderTitle: {
    fontSize: 10.5,
    fontWeight: '900',
    color: 'rgba(255, 255, 255, 0.5)',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  rosterCardList: {
    gap: 8,
  },
  memberRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.025)',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  memberRowCardSelf: {
    borderColor: 'rgba(0, 229, 255, 0.35)',
    backgroundColor: 'rgba(0, 229, 255, 0.04)',
  },
  rankNumBadge: {
    width: 32,
    marginRight: 8,
  },
  rankNumBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#64748B',
  },
  memberAvatarCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  memberAvatarLetter: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  memberTier: {
    fontSize: 11,
    fontWeight: '600',
  },
  streakBadgePill: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
  },
  streakBadgePillText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  emptyCellsCard: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.025)',
    borderRadius: 20,
    padding: 28,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    marginTop: 20,
  },
  emptyCellsTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#FFFFFF',
    marginTop: 14,
    marginBottom: 6,
  },
  emptyCellsSub: {
    fontSize: 12.5,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
    maxWidth: '85%',
  },
  createCellCTA: {
    backgroundColor: '#00E5FF',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  createCellCTAText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#000000',
  },
  cellsList: {
    gap: 10,
  },
  cellRankingCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.025)',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  cellRankingCardTop1: {
    borderColor: 'rgba(245, 158, 11, 0.35)',
    backgroundColor: 'rgba(245, 158, 11, 0.03)',
  },
  cellRankHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  cellRankLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    marginRight: 10,
  },
  cellRankBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  cellRankBadgeText: {
    fontSize: 11,
    fontWeight: '900',
  },
  cellRankTitle: {
    fontSize: 14.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  cellRankMotto: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 1,
  },
  cellStreakPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  cellStreakNumber: {
    fontSize: 13,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  cellRankFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
    paddingTop: 10,
  },
  cellMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  cellMetaText: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600',
  },
});
