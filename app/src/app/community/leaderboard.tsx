import React, { useState, useEffect, useMemo } from 'react';
import {
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  View,
  Platform,
  ActivityIndicator,
  Text,
  Image,
  Alert,
} from 'react-native';
import { useRouter, useFocusEffect, Stack } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

import { useHabitStore } from '@/store/habit-store';
import { useAuthStore } from '@/store/auth-store';
import { useOnboardingStore } from '@/store/onboarding-store';
import { useSpartanStore } from '@/store/spartan-store';
import { communityApi, CommunityRanking } from '@/services/community-api';
import { SpartanCellData } from '@/services/spartan-api';

const triggerHaptic = (style = Haptics.ImpactFeedbackStyle.Light) => {
  try {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(style);
    }
  } catch (error) { }
};

// Clean, Vector Crest Icon for Squads & Rank Badges
const SquadCrestVector = ({ size = 28, color = '#00E5FF', rank = 0 }: { size?: number; color?: string; rank?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
    <Defs>
      <SvgLinearGradient id={`crestGrad-${rank}`} x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0%" stopColor={color} stopOpacity="0.35" />
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
  const currentUser = useAuthStore((state) => state.user);
  const habitStreak = useHabitStore((state) => state.streak);

  const streak = useMemo(() => {
    if (typeof currentUser?.streak === 'number' && !isNaN(currentUser.streak) && currentUser.streak >= 0) {
      return currentUser.streak;
    }
    return habitStreak || 0;
  }, [currentUser?.streak, habitStreak]);

  const firstName = currentUser?.name || useOnboardingStore((state) => state.firstName) || 'Operative';
  const { myCell, cellLeaderboard, fetchCellLeaderboard, joinCell, fetchMyCell } = useSpartanStore();

  const [viewMode, setViewMode] = useState<'individual' | 'squads'>('individual');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [joiningCellId, setJoiningCellId] = useState<string | null>(null);
  const [dbRankings, setDbRankings] = useState<CommunityRanking[]>([]);

  useEffect(() => {
    fetchRealRankings();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      fetchRealRankings();
      fetchCellLeaderboard();
      fetchMyCell();
      useHabitStore.getState().syncFromDatabase();
    }, [])
  );

  const fetchRealRankings = async () => {
    setIsLoading(true);
    try {
      const data = await communityApi.getRankings();
      if (data) setDbRankings(data);
      await fetchCellLeaderboard();
      await fetchMyCell();
    } catch (e) {
      console.log('Error fetching rankings:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoinFromLeaderboard = async (cell: SpartanCellData) => {
    if (joiningCellId) return;
    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
    setJoiningCellId(cell.id);
    try {
      await joinCell(cell.join_code);
      router.push('/community/cell' as any);
    } catch (err: any) {
      Alert.alert('Unable to Join Squad', err?.message || 'Please verify member capacity or try again.');
    } finally {
      setJoiningCellId(null);
    }
  };

  // Process and sort Individual Leaderboard Users
  const leaderboardUsers: LeaderboardUser[] = useMemo(() => {
    const map = new Map<string, LeaderboardUser>();

    dbRankings.forEach((r) => {
      const isSelf = (r.author_name || '').toLowerCase() === firstName.toLowerCase();
      const sDays = isSelf ? streak : (typeof r.streak_days === 'number' ? r.streak_days : 0);
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
      <Stack.Screen options={{ headerShown: false }} />

      {/* Fixed Spartan Cosmic Background */}
      <Image
        source={require('@/assets/images/leaderboard_bg.png')}
        style={styles.fixedBgImage}
        resizeMode="cover"
      />

      {/* Dark Ambient Gradient Mask */}
      <LinearGradient
        colors={['rgba(0, 0, 0, 0.40)', 'rgba(0, 0, 0, 0.70)', 'rgba(0, 0, 0, 0.95)']}
        style={styles.darkMask}
      />

      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        {/* Header */}
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={styles.backBtn}
            activeOpacity={0.7}
            onPress={() => {
              triggerHaptic();
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace('/community' as any);
              }
            }}
          >
            <Ionicons name="chevron-back" size={24} color="#00E5FF" />
          </TouchableOpacity>

          <View style={styles.headerTitleGroup}>
            <ThemedText style={styles.headerSubtitle}>GLOBAL DISCIPLINE RANKINGS</ThemedText>
            <ThemedText style={styles.headerTitle}>Honor Leaderboard</ThemedText>
          </View>

          <View style={{ width: 40 }} />
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
            style={[styles.segmentBtn, viewMode === 'squads' && styles.segmentBtnActive]}
            activeOpacity={0.8}
            onPress={() => {
              triggerHaptic();
              setViewMode('squads');
            }}
          >
            <Ionicons
              name="shield-checkmark-outline"
              size={15}
              color={viewMode === 'squads' ? '#000000' : '#94A3B8'}
              style={{ marginRight: 6 }}
            />
            <ThemedText style={[styles.segmentText, viewMode === 'squads' && styles.segmentTextActive]}>
              Accountability Squads
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
            {/* Top 3 Podium Card */}
            {podiumWinners.length > 0 && (
              <View style={styles.podiumSection}>
                <View style={styles.podiumHeaderPill}>
                  <Ionicons name="trophy" size={13} color="#F59E0B" style={{ marginRight: 5 }} />
                  <ThemedText style={styles.podiumHeaderPillText}>TOP DISCIPLINE CHAMPIONS</ThemedText>
                </View>

                <View style={styles.podiumRow}>
                  {/* Rank 2 (Silver) */}
                  {podiumWinners[1] && (
                    <View style={styles.podiumColumn}>
                      <View style={[styles.avatarCircle, { borderColor: '#CBD5E1' }]}>
                        <ThemedText style={styles.avatarInitial}>
                          {podiumWinners[1].name.charAt(0).toUpperCase()}
                        </ThemedText>
                      </View>
                      <ThemedText style={styles.podiumName} numberOfLines={1}>
                        {podiumWinners[1].name}
                      </ThemedText>
                      <View style={styles.podiumStreakBadge}>
                        <ThemedText style={styles.podiumStreakText}>🔥 {podiumWinners[1].streakDays}d</ThemedText>
                      </View>
                      <ThemedText style={styles.podiumTierText}>{podiumWinners[1].rankTierName}</ThemedText>

                      {/* Pedestal Base 2 */}
                      <View style={styles.pedestalSilver}>
                        <ThemedText style={styles.pedestalRankTextSilver}>2ND</ThemedText>
                      </View>
                    </View>
                  )}

                  {/* Rank 1 (Gold - Center Elevated) */}
                  {podiumWinners[0] && (
                    <View style={styles.podiumColumn}>
                      <View style={styles.crownContainer}>
                        <Ionicons name="ribbon" size={20} color="#F59E0B" />
                      </View>
                      <View style={[styles.avatarCircle, styles.avatarCircleGold]}>
                        <ThemedText style={[styles.avatarInitial, { color: '#F59E0B', fontSize: 24 }]}>
                          {podiumWinners[0].name.charAt(0).toUpperCase()}
                        </ThemedText>
                      </View>
                      <ThemedText style={[styles.podiumName, { fontWeight: '900', color: '#FFFFFF' }]} numberOfLines={1}>
                        {podiumWinners[0].name}
                      </ThemedText>
                      <View style={[styles.podiumStreakBadge, styles.podiumStreakBadgeGold]}>
                        <ThemedText style={[styles.podiumStreakText, { color: '#F59E0B' }]}>
                          🔥 {podiumWinners[0].streakDays}d
                        </ThemedText>
                      </View>
                      <ThemedText style={[styles.podiumTierText, { color: '#F59E0B', fontWeight: '800' }]}>
                        {podiumWinners[0].rankTierName}
                      </ThemedText>

                      {/* Pedestal Base 1 */}
                      <View style={styles.pedestalGold}>
                        <ThemedText style={styles.pedestalRankTextGold}>1ST</ThemedText>
                      </View>
                    </View>
                  )}

                  {/* Rank 3 (Bronze) */}
                  {podiumWinners[2] && (
                    <View style={styles.podiumColumn}>
                      <View style={[styles.avatarCircle, { borderColor: '#D97706' }]}>
                        <ThemedText style={styles.avatarInitial}>
                          {podiumWinners[2].name.charAt(0).toUpperCase()}
                        </ThemedText>
                      </View>
                      <ThemedText style={styles.podiumName} numberOfLines={1}>
                        {podiumWinners[2].name}
                      </ThemedText>
                      <View style={styles.podiumStreakBadge}>
                        <ThemedText style={styles.podiumStreakText}>🔥 {podiumWinners[2].streakDays}d</ThemedText>
                      </View>
                      <ThemedText style={styles.podiumTierText}>{podiumWinners[2].rankTierName}</ThemedText>

                      {/* Pedestal Base 3 */}
                      <View style={styles.pedestalBronze}>
                        <ThemedText style={styles.pedestalRankTextBronze}>3RD</ThemedText>
                      </View>
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
                  <ThemedText style={styles.selfTierText}>{currentUserRank.rankTierName} Division</ThemedText>
                </View>
              </View>

              <View style={styles.selfStreakBox}>
                <ThemedText style={styles.selfStreakText}>🔥 {currentUserRank.streakDays} Days</ThemedText>
              </View>
            </View>

            {/* Roster List (Rank 4+) */}
            <View style={styles.listSection}>
              <ThemedText style={styles.sectionHeaderTitle}>GLOBAL WARRIOR RANKINGS</ThemedText>
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
          /* ── ACCOUNTABILITY SQUADS / CELLS LEADERBOARD ── */
          <ScrollView
            style={styles.scrollContent}
            contentContainerStyle={styles.scrollInner}
            showsVerticalScrollIndicator={false}
          >
            {cellLeaderboard.length === 0 ? (
              <View style={styles.emptyCellsCard}>
                <SquadCrestVector size={48} color="#334155" />
                <ThemedText style={styles.emptyCellsTitle}>No Active Squads Yet</ThemedText>
                <ThemedText style={styles.emptyCellsSub}>
                  Be the first Commander to establish a 5–20 member Accountability Squad and climb the global ranks!
                </ThemedText>
                <TouchableOpacity
                  style={styles.createCellCTA}
                  activeOpacity={0.85}
                  onPress={() => {
                    triggerHaptic();
                    router.push('/community/cell' as any);
                  }}
                >
                  <ThemedText style={styles.createCellCTAText}>Establish Accountability Squad</ThemedText>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.cellsList}>
                <ThemedText style={styles.sectionHeaderTitle}>TOP ACCOUNTABILITY SQUADS</ThemedText>
                {cellLeaderboard.map((cell, idx) => {
                  const isTop1 = idx === 0;
                  const isTop2 = idx === 1;
                  const isTop3 = idx === 2;
                  const rankColor = isTop1 ? '#F59E0B' : isTop2 ? '#CBD5E1' : isTop3 ? '#D97706' : '#00E5FF';

                  const isMyCohort = myCell?.id === cell.id;
                  const isJoining = joiningCellId === cell.id;

                  return (
                    <View key={cell.id} style={[styles.cellRankingCard, isTop1 && styles.cellRankingCardTop1, isMyCohort && styles.cellRankingCardMine]}>
                      <View style={styles.cellRankHeader}>
                        <View style={styles.cellRankLeft}>
                          <View style={[styles.cellRankBadge, { borderColor: rankColor, backgroundColor: rankColor + '18' }]}>
                            <ThemedText style={[styles.cellRankBadgeText, { color: rankColor }]}>#{idx + 1}</ThemedText>
                          </View>
                          <SquadCrestVector size={26} color={rankColor} rank={idx + 1} />
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
                        <View style={styles.cellMetaGroup}>
                          <View style={styles.cellMetaItem}>
                            <Ionicons name="people-outline" size={12} color="#94A3B8" />
                            <ThemedText style={styles.cellMetaText}>
                              {cell.member_count}/{cell.max_members}
                            </ThemedText>
                          </View>

                          <View style={styles.cellMetaItem}>
                            <Ionicons name="shield-checkmark" size={12} color="#F59E0B" />
                            <ThemedText style={[styles.cellMetaText, { color: '#F59E0B', fontWeight: '800' }]}>
                              {cell.collective_xp} XP
                            </ThemedText>
                          </View>
                        </View>

                        {/* Direct Join / Status CTA */}
                        {isMyCohort ? (
                          <View style={styles.myCohortBadge}>
                            <Ionicons name="checkmark-circle" size={13} color="#10B981" style={{ marginRight: 4 }} />
                            <ThemedText style={styles.myCohortBadgeText}>Your Squad</ThemedText>
                          </View>
                        ) : !myCell ? (
                          <TouchableOpacity
                            style={styles.joinCohortBtn}
                            activeOpacity={0.8}
                            disabled={isJoining}
                            onPress={() => handleJoinFromLeaderboard(cell)}
                          >
                            {isJoining ? (
                              <ActivityIndicator size="small" color="#000000" />
                            ) : (
                              <>
                                <Ionicons name="enter-outline" size={13} color="#000000" style={{ marginRight: 4 }} />
                                <ThemedText style={styles.joinCohortBtnText}>Join Squad</ThemedText>
                              </>
                            )}
                          </TouchableOpacity>
                        ) : (
                          <TouchableOpacity
                            style={styles.viewCohortBtn}
                            activeOpacity={0.8}
                            onPress={() => {
                              triggerHaptic();
                              router.push('/community/cell' as any);
                            }}
                          >
                            <ThemedText style={styles.viewCohortBtnText}>View Hub</ThemedText>
                          </TouchableOpacity>
                        )}
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
  fixedBgImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    opacity: 0.65,
  },
  darkMask: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
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
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderWidth: 0,
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
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    borderRadius: 10,
    padding: 3,
    marginHorizontal: 16,
    marginVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  segmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 8,
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
    marginBottom: 14,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    borderRadius: 14,
    paddingTop: 14,
    paddingBottom: 16,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.09)',
    borderTopColor: 'rgba(245, 158, 11, 0.4)',
  },
  podiumHeaderPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: 'rgba(245, 158, 11, 0.35)',
    marginBottom: 12,
  },
  podiumHeaderPillText: {
    fontSize: 9.5,
    fontWeight: '900',
    color: '#F59E0B',
    letterSpacing: 0.8,
  },
  podiumRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 8,
  },
  podiumColumn: {
    alignItems: 'center',
    flex: 1,
  },
  crownContainer: {
    marginBottom: 3,
  },
  avatarCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    borderWidth: 2,
    borderColor: '#94A3B8',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  avatarCircleGold: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderColor: '#F59E0B',
    borderWidth: 2.5,
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 10,
    elevation: 8,
  },
  avatarInitial: {
    fontSize: 20,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  podiumName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#E2E8F0',
    maxWidth: 90,
    textAlign: 'center',
    marginBottom: 3,
  },
  podiumStreakBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 6,
    marginBottom: 3,
  },
  podiumStreakBadgeGold: {
    backgroundColor: 'rgba(245, 158, 11, 0.18)',
    borderWidth: 0.5,
    borderColor: 'rgba(245, 158, 11, 0.4)',
  },
  podiumStreakText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  podiumTierText: {
    fontSize: 9.5,
    color: '#94A3B8',
    fontWeight: '600',
  },
  pedestalGold: {
    width: '100%',
    height: 44,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  pedestalRankTextGold: {
    fontSize: 12,
    fontWeight: '900',
    color: '#F59E0B',
    letterSpacing: 0.8,
  },
  pedestalSilver: {
    width: '100%',
    height: 34,
    backgroundColor: 'rgba(203, 213, 225, 0.1)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(203, 213, 225, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  pedestalRankTextSilver: {
    fontSize: 11,
    fontWeight: '900',
    color: '#CBD5E1',
    letterSpacing: 0.8,
  },
  pedestalBronze: {
    width: '100%',
    height: 26,
    backgroundColor: 'rgba(217, 119, 6, 0.1)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(217, 119, 6, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  pedestalRankTextBronze: {
    fontSize: 10,
    fontWeight: '900',
    color: '#D97706',
    letterSpacing: 0.8,
  },
  selfStandingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.35)',
    marginBottom: 14,
  },
  selfStandingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  selfRankNumBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(0, 229, 255, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.35)',
  },
  selfRankNumText: {
    fontSize: 13.5,
    fontWeight: '900',
    color: '#00E5FF',
  },
  selfNameText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  selfTierText: {
    fontSize: 10.5,
    color: '#94A3B8',
    marginTop: 1,
  },
  selfStreakBox: {
    backgroundColor: 'rgba(0, 229, 255, 0.16)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.35)',
  },
  selfStreakText: {
    fontSize: 12.5,
    fontWeight: '900',
    color: '#00E5FF',
  },
  listSection: {
    marginBottom: 16,
  },
  sectionHeaderTitle: {
    fontSize: 10,
    fontWeight: '900',
    color: 'rgba(255, 255, 255, 0.5)',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  rosterCardList: {
    gap: 6,
  },
  memberRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
  },
  memberRowCardSelf: {
    borderColor: 'rgba(0, 229, 255, 0.35)',
    backgroundColor: 'rgba(0, 229, 255, 0.06)',
  },
  rankNumBadge: {
    width: 28,
    marginRight: 6,
  },
  rankNumBadgeText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#64748B',
  },
  memberAvatarCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  memberAvatarLetter: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 1,
  },
  memberTier: {
    fontSize: 10.5,
    fontWeight: '600',
  },
  streakBadgePill: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  streakBadgePillText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  emptyCellsCard: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    borderRadius: 14,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginTop: 16,
  },
  emptyCellsTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#FFFFFF',
    marginTop: 12,
    marginBottom: 5,
  },
  emptyCellsSub: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 17,
    marginBottom: 16,
    maxWidth: '85%',
  },
  createCellCTA: {
    backgroundColor: '#00E5FF',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 10,
  },
  createCellCTAText: {
    fontSize: 12.5,
    fontWeight: '900',
    color: '#000000',
  },
  cellsList: {
    gap: 8,
  },
  cellRankingCard: {
    backgroundColor: 'rgba(0, 0, 0, 0.68)',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  cellRankingCardTop1: {
    borderColor: 'rgba(245, 158, 11, 0.35)',
    backgroundColor: 'rgba(245, 158, 11, 0.05)',
  },
  cellRankHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  cellRankLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    marginRight: 8,
  },
  cellRankBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2.5,
    borderRadius: 6,
    borderWidth: 1,
  },
  cellRankBadgeText: {
    fontSize: 10.5,
    fontWeight: '900',
  },
  cellRankTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  cellRankMotto: {
    fontSize: 10.5,
    color: '#94A3B8',
    marginTop: 1,
  },
  cellStreakPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  cellStreakNumber: {
    fontSize: 12.5,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  cellRankFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
    paddingTop: 8,
  },
  cellRankingCardMine: {
    borderColor: 'rgba(16, 185, 129, 0.45)',
    backgroundColor: 'rgba(16, 185, 129, 0.05)',
  },
  cellMetaGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  cellMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cellMetaText: {
    fontSize: 10.5,
    color: '#94A3B8',
    fontWeight: '600',
  },
  myCohortBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.35)',
  },
  myCohortBadgeText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#10B981',
  },
  joinCohortBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#00E5FF',
    paddingHorizontal: 10,
    paddingVertical: 4.5,
    borderRadius: 6,
  },
  joinCohortBtnText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#000000',
  },
  viewCohortBtn: {
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  viewCohortBtnText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#E2E8F0',
  },
});
