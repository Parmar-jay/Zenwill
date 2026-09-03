import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Modal,
  ActivityIndicator,
  Platform,
  Share,
  Dimensions,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { ThemedText } from '../../components/themed-text';
import { useSpartanStore } from '../../store/spartan-store';
import { useAuthStore } from '../../store/auth-store';
import { CellMemberItem, SpartanCellData } from '../../services/spartan-api';
import { communityApi } from '../../services/community-api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const MOTTO_PRESETS = [
  'We hold the line together.',
  'Iron will, sovereign mind.',
  'Brotherhood over impulse.',
  'Unconquered in the storm.',
  'Transmute desire into power.',
];

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
  if (days <= 0) return GAMIFIED_RANKS[0];
  const found = GAMIFIED_RANKS.find((r) => days >= r.minDays && days <= r.maxDays);
  return found || GAMIFIED_RANKS[GAMIFIED_RANKS.length - 1];
};

export default function SpartanCellScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const {
    myCell,
    publicCells,
    isLoadingCell,
    isNudging,
    fetchMyCell,
    fetchPublicCells,
    createCell,
    joinCell,
    leaveCell,
    deleteCell,
    nudgeMember,
  } = useSpartanStore();

  const [isCreateModalVisible, setIsCreateModalVisible] = useState<boolean>(false);
  const [isJoinModalVisible, setIsJoinModalVisible] = useState<boolean>(false);
  const [newCellName, setNewCellName] = useState<string>('');
  const [newCellMotto, setNewCellMotto] = useState<string>(MOTTO_PRESETS[0]);
  const [joinCodeInput, setJoinCodeInput] = useState<string>('');
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [nudgeNotice, setNudgeNotice] = useState<string | null>(null);

  const [customDialog, setCustomDialog] = useState<{
    visible: boolean;
    title: string;
    message: string;
    type: 'success' | 'danger' | 'info';
    confirmText?: string;
    cancelText?: string;
    onConfirm?: () => void;
  } | null>(null);

  const triggerHaptic = useCallback((style: 'light' | 'medium' | 'heavy' = 'light') => {
    try {
      if (Platform.OS !== 'web') {
        if (style === 'heavy') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        else if (style === 'medium') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        else Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch {}
  }, []);

  const loadData = useCallback(async () => {
    await fetchMyCell();
    await fetchPublicCells();
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const isLeader = useMemo(() => {
    if (!myCell || !user) return false;
    const userIdStr = String(user.id || '');
    return myCell.leader_id === userIdStr || myCell.leader_id === user.email;
  }, [myCell, user]);


  const handleCreateCell = async () => {
    if (!newCellName.trim() || newCellName.trim().length < 3) {
      setCustomDialog({
        visible: true,
        title: 'Invalid Cell Name',
        message: 'Cell name must be at least 3 characters.',
        type: 'info',
        confirmText: 'Got It',
      });
      return;
    }
    triggerHaptic('medium');
    setActionLoading(true);
    try {
      await createCell(newCellName.trim(), newCellMotto.trim());
      setIsCreateModalVisible(false);
      setNewCellName('');
      setCustomDialog({
        visible: true,
        title: 'Accountability Cell Formed',
        message: 'Your accountability cell has been established. Share your join code with fellow members to begin building collective retention!',
        type: 'success',
        confirmText: 'View Dashboard',
      });
    } catch (err: any) {
      setCustomDialog({
        visible: true,
        title: 'Creation Failed',
        message: err?.response?.data?.detail || 'Could not establish cell.',
        type: 'danger',
        confirmText: 'Dismiss',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleJoinCell = async (codeToJoin?: string) => {
    const raw = codeToJoin || joinCodeInput;
    if (!raw || raw.trim().length < 2) {
      setCustomDialog({
        visible: true,
        title: 'Invalid Code',
        message: 'Please enter a valid Spartan Cell join code.',
        type: 'info',
        confirmText: 'Understood',
      });
      return;
    }
    let cleanCode = raw.trim().toUpperCase();
    if (!cleanCode.startsWith('SP-')) {
      cleanCode = `SP-${cleanCode}`;
    }
    triggerHaptic('medium');
    setActionLoading(true);
    try {
      await joinCell(cleanCode);
      setIsJoinModalVisible(false);
      setJoinCodeInput('');
      setCustomDialog({
        visible: true,
        title: 'Squad Joined',
        message: 'You are now an active member of this Accountability Squad. Your daily retention now strengthens the collective squad shield.',
        type: 'success',
        confirmText: 'Enter Squad',
      });
    } catch (err: any) {
      setCustomDialog({
        visible: true,
        title: 'Join Failed',
        message: err?.response?.data?.detail || 'Invalid or expired cell code.',
        type: 'danger',
        confirmText: 'Dismiss',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleLeaveCell = () => {
    setCustomDialog({
      visible: true,
      title: 'Leave Accountability Squad',
      message: 'Are you sure you want to depart this squad? Your streak will no longer contribute to the collective total.',
      type: 'danger',
      confirmText: 'Leave Squad',
      cancelText: 'Cancel',
      onConfirm: async () => {
        triggerHaptic('heavy');
        setActionLoading(true);
        try {
          await leaveCell();
          await fetchPublicCells();
        } catch (err: any) {
          // silent fallback
        } finally {
          setActionLoading(false);
          setCustomDialog(null);
        }
      },
    });
  };

  const handleDeleteCell = () => {
    setCustomDialog({
      visible: true,
      title: 'Disband Accountability Squad',
      message: 'As Leader, permanently disbanding this cell will dissolve the squad and release all member slots. This action cannot be undone.',
      type: 'danger',
      confirmText: 'Disband & Delete',
      cancelText: 'Cancel',
      onConfirm: async () => {
        triggerHaptic('heavy');
        setActionLoading(true);
        try {
          await deleteCell();
          await fetchPublicCells();
          setCustomDialog({
            visible: true,
            title: 'Cell Disbanded',
            message: 'The accountability cell has been dissolved.',
            type: 'info',
            confirmText: 'OK',
          });
        } catch (err: any) {
          setCustomDialog({
            visible: true,
            title: 'Error',
            message: err?.response?.data?.detail || 'Could not disband cell.',
            type: 'danger',
            confirmText: 'Dismiss',
          });
        } finally {
          setActionLoading(false);
        }
      },
    });
  };

  const handleNudge = async (member: CellMemberItem) => {
    triggerHaptic('medium');
    const reminderText = `🛡️ Streak Reminder: Hey brother, please complete your daily streak check-in today to hold the line for our Squad!`;
    try {
      // 1. Send backend nudge (creates DM in MongoDB)
      const msg = await nudgeMember(member.user_id, member.name);
      // 2. Also dispatch via communityApi for instant client sync
      communityApi.sendDirectMessage(member.user_id, reminderText, 'text').catch(() => {});
      setNudgeNotice(msg || `Streak reminder sent to ${member.name}'s DM!`);
      setTimeout(() => setNudgeNotice(null), 4000);
    } catch {
      communityApi.sendDirectMessage(member.user_id, reminderText, 'text').catch(() => {});
      setNudgeNotice(`Streak reminder sent to ${member.name}'s DM!`);
      setTimeout(() => setNudgeNotice(null), 4000);
    }
  };

  const handleShareCode = async () => {
    if (!myCell?.join_code) return;
    triggerHaptic('light');
    try {
      await Share.share({
        message: `🛡️ Join my Accountability Squad "${myCell.name}" on ZenWill — the neuroscience-backed platform for dopamine mastery, daily retention, and shared brotherhood discipline.\n\nCollective Squad Streak: ${myCell.total_streak} Days\nJoin Code: ${myCell.join_code}\n\nDownload ZenWill & master your dopamine: https://zenwill.me`,
      });
    } catch {}
  };

  const isGoldShield = myCell?.shield_status === 'gold';
  const isCrackedShield = myCell?.shield_status === 'cracked';

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        {/* Top Header */}
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={styles.backBtn}
            activeOpacity={0.7}
            onPress={() => {
              triggerHaptic('light');
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace('/(tabs)/home' as any);
              }
            }}
          >
            <Ionicons name="chevron-back" size={24} color="#00E5FF" />
          </TouchableOpacity>

          <View style={styles.headerTitleGroup}>
            <ThemedText style={styles.headerCategory}>DISCIPLINE & ACCOUNTABILITY</ThemedText>
            <ThemedText style={styles.headerTitle}>Accountability Squad Hub</ThemedText>
          </View>

          <TouchableOpacity
            style={styles.leaderboardBtn}
            activeOpacity={0.7}
            onPress={() => {
              triggerHaptic('light');
              router.push('/community/leaderboard' as any);
            }}
          >
            <Ionicons name="trophy-outline" size={18} color="#F59E0B" />
          </TouchableOpacity>
        </View>

        {isLoadingCell && !myCell ? (
          <View style={styles.centerLoading}>
            <ActivityIndicator size="large" color="#00E5FF" />
            <ThemedText style={styles.loadingText}>Syncing Squad Discipline Matrix...</ThemedText>
          </View>
        ) : myCell ? (
          /* ── ACTIVE SQUAD VIEW ── */
          <ScrollView
            style={styles.scrollContent}
            contentContainerStyle={styles.scrollInner}
          >
            {/* Cell Banner Card */}
            <View style={styles.cellHeroCard}>
              <View style={styles.cellHeroHeader}>
                <View style={styles.cellBadgeIcon}>
                  <ThemedText style={styles.cellBadgeText}>
                    {myCell.name ? myCell.name.charAt(0).toUpperCase() : 'A'}
                  </ThemedText>
                </View>
                <View style={styles.cellNameGroup}>
                  <ThemedText style={styles.cellNameText}>{myCell.name}</ThemedText>
                  <ThemedText style={styles.cellMottoText}>{myCell.motto}</ThemedText>
                </View>
              </View>

              {/* Join Code & Share Chip */}
              <TouchableOpacity
                style={styles.joinCodeStrip}
                activeOpacity={0.8}
                onPress={handleShareCode}
              >
                <View style={styles.codeTextRow}>
                  <ThemedText style={styles.codeLabel}>JOIN CODE:</ThemedText>
                  <ThemedText style={styles.codeValue}>{myCell.join_code}</ThemedText>
                </View>
                <View style={styles.shareCodeBtn}>
                  <Ionicons name="share-social-outline" size={15} color="#00E5FF" />
                  <ThemedText style={styles.shareCodeText}>Invite Member</ThemedText>
                </View>
              </TouchableOpacity>
            </View>

            {/* Exact 2-Column Stats Grid */}
            <View style={styles.statsRow}>
              {/* Left Tall Card: Collective Squad Retention */}
              <View style={styles.mainStreakCard}>
                <View style={styles.streakIconRow}>
                  <ThemedText style={styles.fireEmoji}>🔥</ThemedText>
                  <ThemedText style={styles.collectiveStreakNumber}>{myCell.total_streak}</ThemedText>
                </View>
                <ThemedText style={styles.streakCardTitle}>COLLECTIVE SQUAD RETENTION</ThemedText>
                <ThemedText style={styles.streakCardSub}>
                  Combined clean days of all {myCell.members?.length || 1} members. Drops if any member relapses.
                </ThemedText>
              </View>

              {/* Right Stacked Column: Active Members & Squad Honor */}
              <View style={styles.sideStatsCol}>
                <View style={styles.smallStatCard}>
                  <ThemedText style={styles.smallStatValue}>
                    {myCell.members?.length || 1}/{myCell.max_members || 20}
                  </ThemedText>
                  <ThemedText style={styles.smallStatLabel}>ACTIVE MEMBERS</ThemedText>
                </View>
                <View style={styles.smallStatCard}>
                  <ThemedText style={[styles.smallStatValue, { color: '#F59E0B' }]}>
                    {myCell.collective_xp ?? 100} XP
                  </ThemedText>
                  <ThemedText style={styles.smallStatLabel}>SQUAD HONOR</ThemedText>
                </View>
              </View>
            </View>

            {/* Gold Shield Status Banner */}
            <View style={[
              styles.shieldStatusCard,
              isGoldShield ? styles.shieldGold : isCrackedShield ? styles.shieldCracked : styles.shieldActive
            ]}>
              <View style={styles.shieldHeaderRow}>
                <Ionicons
                  name={isGoldShield ? 'shield-checkmark' : isCrackedShield ? 'warning-outline' : 'shield-outline'}
                  size={24}
                  color={isGoldShield ? '#F59E0B' : isCrackedShield ? '#EF4444' : '#00E5FF'}
                />
                <View style={styles.shieldTitleWrapper}>
                  <ThemedText style={[
                    styles.shieldTitleText,
                    { color: isGoldShield ? '#F59E0B' : isCrackedShield ? '#EF4444' : '#00E5FF' }
                  ]}>
                    {isGoldShield ? 'GOLD SHIELD ACTIVE (+20% XP)' : isCrackedShield ? 'SHIELD PENDING (ACTION REQUIRED)' : 'DISCIPLINE SHIELD ACTIVE'}
                  </ThemedText>
                  <ThemedText style={styles.shieldSubText}>
                    {isGoldShield
                      ? '100% of squad members confirmed retention today! +20% XP boost active for the entire squad.'
                      : isCrackedShield
                      ? 'One or more members have pending daily check-ins. Send reminders to secure the squad Gold Shield.'
                      : 'Maintain consistent daily check-ins across all members to unlock the Gold Shield before midnight.'}
                  </ThemedText>
                </View>
              </View>
            </View>

            {/* Notification Notice */}
            {nudgeNotice && (
              <View style={styles.nudgeNoticeBox}>
                <Ionicons name="checkmark-circle" size={15} color="#10B981" />
                <ThemedText style={styles.nudgeNoticeText}>{nudgeNotice}</ThemedText>
              </View>
            )}

            {/* Squad Members Roster */}
            <View style={styles.rosterSection}>
              <View style={styles.rosterHeaderRow}>
                <ThemedText style={styles.rosterTitle}>
                  SQUAD MEMBERS ({myCell.members?.length || 0}/{myCell.max_members || 20})
                </ThemedText>
                <ThemedText style={styles.rosterSortLabel}>Ordered by Retention</ThemedText>
              </View>

              <View style={styles.rosterList}>
                {myCell.members?.map((member, index) => {
                  const isCurrentUser =
                    member.user_id === String(user?.id || '') ||
                    (member.user_id && user?.email && member.user_id.toLowerCase() === user.email.toLowerCase()) ||
                    (member.name && user?.name && member.name.trim().toLowerCase() === user.name.trim().toLowerCase());
                  const memberStreak = typeof member.streak === 'number' ? member.streak : 0;
                  const memberRank = getGamifiedRank(memberStreak);

                  return (
                    <TouchableOpacity
                      key={`${member.user_id}-${index}`}
                      style={[styles.memberRow, isCurrentUser && styles.memberRowSelf]}
                      activeOpacity={isCurrentUser ? 1 : 0.7}
                      onPress={() => {
                        if (!isCurrentUser) {
                          triggerHaptic('medium');
                          router.push({
                            pathname: '/community/dm',
                            params: {
                              user_id: member.user_id,
                              user_name: member.name,
                              username: (member.name || '').toLowerCase().replace(/\s+/g, '_'),
                            },
                          });
                        }
                      }}
                    >
                      <View style={styles.memberLeftGroup}>
                        <View style={styles.memberRankIndexBox}>
                          <ThemedText style={styles.memberRankIndexText}>#{index + 1}</ThemedText>
                        </View>
                        <View style={[
                          styles.memberAvatarBox,
                          {
                            backgroundColor: `${memberRank.color}15`,
                            borderColor: `${memberRank.color}40`,
                          }
                        ]}>
                          <ThemedText style={[styles.memberAvatarText, { color: memberRank.color }]}>
                            {memberRank.badge}
                          </ThemedText>
                        </View>
                        <View style={styles.memberInfoCol}>
                          <View style={styles.memberNameRow}>
                            <ThemedText style={styles.memberNameText} numberOfLines={1}>
                              {member.name} {isCurrentUser && '(You)'}
                            </ThemedText>
                            {member.is_leader && (
                              <ThemedText style={styles.leaderText}>Leader</ThemedText>
                            )}
                          </View>
                          <View style={[
                            styles.memberRankPill,
                            {
                              backgroundColor: `${memberRank.color}15`,
                              borderColor: `${memberRank.color}40`,
                            }
                          ]}>
                            <Text style={[styles.memberRankNameText, { color: memberRank.color }]}>
                              {memberRank.name}
                            </Text>
                          </View>
                        </View>
                      </View>

                      <View style={styles.memberRightGroup}>
                        <View style={styles.streakBadge}>
                          <ThemedText style={styles.streakText}>🔥 {memberStreak}d</ThemedText>
                        </View>

                        {isCurrentUser ? (
                          member.today_checked_in ? (
                            <View style={styles.checkedInPill}>
                              <Ionicons name="checkmark" size={12} color="#10B981" />
                              <ThemedText style={styles.checkedInText}>Retained</ThemedText>
                            </View>
                          ) : (
                            <View style={styles.pendingSelfPill}>
                              <Ionicons name="time-outline" size={12} color="#F59E0B" />
                              <ThemedText style={styles.pendingSelfText}>Pending</ThemedText>
                            </View>
                          )
                        ) : member.today_checked_in ? (
                          <View style={styles.checkedInPill}>
                            <Ionicons name="checkmark" size={12} color="#10B981" />
                            <ThemedText style={styles.checkedInText}>Retained</ThemedText>
                          </View>
                        ) : (
                          <TouchableOpacity
                            style={styles.nudgeBtn}
                            activeOpacity={0.7}
                            onPress={(e) => {
                              e.stopPropagation?.();
                              handleNudge(member);
                            }}
                            disabled={isNudging}
                          >
                            <Ionicons name="notifications-outline" size={12} color="#EF4444" />
                            <ThemedText style={styles.nudgeBtnText}>Remind</ThemedText>
                          </TouchableOpacity>
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Action Buttons: Leader Disband vs Member Depart */}
            <View style={styles.cellFooterActions}>
              {isLeader ? (
                <TouchableOpacity
                  style={styles.disbandBtn}
                  activeOpacity={0.7}
                  onPress={handleDeleteCell}
                  disabled={actionLoading}
                >
                  <Ionicons name="trash-outline" size={16} color="#EF4444" style={{ marginRight: 6 }} />
                  <ThemedText style={styles.disbandBtnText}>Disband Accountability Cell (Leader)</ThemedText>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={styles.leaveBtn}
                  activeOpacity={0.7}
                  onPress={handleLeaveCell}
                  disabled={actionLoading}
                >
                  <Ionicons name="exit-outline" size={15} color="#94A3B8" style={{ marginRight: 6 }} />
                  <ThemedText style={styles.leaveBtnText}>Leave Accountability Cell</ThemedText>
                </TouchableOpacity>
              )}
            </View>

            <View style={{ height: 40 }} />
          </ScrollView>
        ) : (
          /* ── UNAFFILIATED: ESTABLISHMENT VIEW ── */
          <ScrollView
            style={styles.scrollContent}
            contentContainerStyle={styles.scrollInner}
            showsVerticalScrollIndicator={false}
          >
            {/* Holographic Crest Hero */}
            <View style={styles.unaffiliatedHero}>
              <View style={styles.crestAura}>
                <View style={styles.shieldGlowCircle}>
                  <Ionicons name="shield-checkmark" size={42} color="#00E5FF" />
                </View>
              </View>

              <ThemedText style={styles.unaffiliatedCategory}>SHARED COMMITMENT & REINFORCEMENT</ThemedText>
              <ThemedText style={styles.unaffiliatedTitle}>5–20 Member Accountability Squads</ThemedText>
              <ThemedText style={styles.unaffiliatedBody}>
                Isolation weakens resolve. In an Accountability Squad, individual streaks unite into a collective squad shield. When 100% of members check in daily, your squad maintains Gold Shield status (+20% XP boost).
              </ThemedText>

              {/* Value Pillar Bar */}
              <View style={styles.pillarStrip}>
                <View style={styles.pillarItem}>
                  <View style={[styles.pillarIconBadge, { backgroundColor: 'rgba(245, 158, 11, 0.15)' }]}>
                    <Ionicons name="flash" size={14} color="#F59E0B" />
                  </View>
                  <ThemedText style={styles.pillarTitle}>Pooled Streak</ThemedText>
                  <ThemedText style={styles.pillarDesc}>Shared Stakes</ThemedText>
                </View>
                <View style={styles.pillarDivider} />
                <View style={styles.pillarItem}>
                  <View style={[styles.pillarIconBadge, { backgroundColor: 'rgba(0, 229, 255, 0.15)' }]}>
                    <Ionicons name="shield-checkmark" size={14} color="#00E5FF" />
                  </View>
                  <ThemedText style={styles.pillarTitle}>Gold Shield</ThemedText>
                  <ThemedText style={styles.pillarDesc}>+20% Boost</ThemedText>
                </View>
                <View style={styles.pillarDivider} />
                <View style={styles.pillarItem}>
                  <View style={[styles.pillarIconBadge, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
                    <Ionicons name="people" size={14} color="#10B981" />
                  </View>
                  <ThemedText style={styles.pillarTitle}>20 Members</ThemedText>
                  <ThemedText style={styles.pillarDesc}>Max Capacity</ThemedText>
                </View>
              </View>

              {/* Action Buttons */}
              <View style={styles.heroActionRow}>
                <TouchableOpacity
                  style={styles.createCellBtn}
                  activeOpacity={0.85}
                  onPress={() => {
                    triggerHaptic('medium');
                    setIsCreateModalVisible(true);
                  }}
                >
                  <Ionicons name="add-circle" size={19} color="#000000" style={{ marginRight: 6 }} />
                  <ThemedText style={styles.createCellBtnText}>Establish Squad</ThemedText>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.joinWithCodeBtn}
                  activeOpacity={0.85}
                  onPress={() => {
                    triggerHaptic('light');
                    setIsJoinModalVisible(true);
                  }}
                >
                  <Ionicons name="key-outline" size={17} color="#00E5FF" style={{ marginRight: 6 }} />
                  <ThemedText style={styles.joinWithCodeBtnText}>Enter Code</ThemedText>
                </TouchableOpacity>
              </View>
            </View>

            {/* Public Open Cells List */}
            <View style={styles.publicSection}>
              <View style={styles.publicHeaderRow}>
                <Ionicons name="globe-outline" size={14} color="#00E5FF" />
                <ThemedText style={styles.publicSectionTitle}>OPEN SQUADS RECRUITING</ThemedText>
              </View>

              {publicCells.length === 0 ? (
                <View style={styles.emptyPublicCard}>
                  <View style={styles.emptyIconCircle}>
                    <Ionicons name="shield-outline" size={24} color="#64748B" />
                  </View>
                  <ThemedText style={styles.emptyPublicTitle}>No Open Squads Active</ThemedText>
                  <ThemedText style={styles.emptyPublicText}>
                    Establish a new accountability squad to lead fellow members and climb the global ranks.
                  </ThemedText>
                </View>
              ) : (
                publicCells.map((cell) => (
                  <View key={cell.id} style={styles.publicCellCard}>
                    <View style={styles.publicCellHeader}>
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <ThemedText style={styles.publicCellName}>{cell.name}</ThemedText>
                        <ThemedText style={styles.publicCellMotto}>{cell.motto}</ThemedText>
                      </View>
                      <View style={styles.publicStreakBadge}>
                        <ThemedText style={styles.publicStreakText}>🔥 {cell.total_streak}d</ThemedText>
                      </View>
                    </View>

                    <View style={styles.publicCellFooter}>
                      <ThemedText style={styles.publicMembersCount}>
                        {cell.member_count}/{cell.max_members} Members • Leader: {cell.leader_name}
                      </ThemedText>

                      <TouchableOpacity
                        style={styles.joinPublicBtn}
                        activeOpacity={0.8}
                        onPress={() => handleJoinCell(cell.join_code)}
                        disabled={actionLoading}
                      >
                        <ThemedText style={styles.joinPublicBtnText}>Join Squad</ThemedText>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              )}
            </View>

            <View style={{ height: 40 }} />
          </ScrollView>
        )}

        {/* Modal: Establish Accountability Squad */}
        <Modal
          visible={isCreateModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setIsCreateModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeaderRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="shield-checkmark" size={24} color="#00E5FF" />
                  <ThemedText style={styles.modalTitle}>Establish Accountability Squad</ThemedText>
                </View>
                <TouchableOpacity onPress={() => setIsCreateModalVisible(false)} style={styles.modalCloseBtn}>
                  <Ionicons name="close" size={20} color="#94A3B8" />
                </TouchableOpacity>
              </View>

              <ThemedText style={styles.inputLabel}>SQUAD NAME</ThemedText>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. Sovereign Phalanx, Iron Vanguard"
                placeholderTextColor="#64748B"
                value={newCellName}
                onChangeText={setNewCellName}
                maxLength={40}
              />

              <ThemedText style={styles.inputLabel}>CHOOSE SQUAD MOTTO</ThemedText>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. We hold the line together."
                placeholderTextColor="#64748B"
                value={newCellMotto}
                onChangeText={setNewCellMotto}
                maxLength={80}
              />

              {/* Quick Motto Presets */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.mottoPresetRow}>
                {MOTTO_PRESETS.map((motto, idx) => (
                  <TouchableOpacity
                    key={idx}
                    style={[styles.mottoPill, newCellMotto === motto && styles.mottoPillActive]}
                    activeOpacity={0.7}
                    onPress={() => {
                      triggerHaptic('light');
                      setNewCellMotto(motto);
                    }}
                  >
                    <ThemedText style={[styles.mottoPillText, newCellMotto === motto && styles.mottoPillTextActive]}>
                      {motto}
                    </ThemedText>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <TouchableOpacity
                style={styles.submitModalBtn}
                activeOpacity={0.85}
                onPress={handleCreateCell}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <ActivityIndicator color="#000000" />
                ) : (
                  <ThemedText style={styles.submitModalBtnText}>Establish & Become Leader</ThemedText>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Modal: Enter Join Code */}
        <Modal
          visible={isJoinModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setIsJoinModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeaderRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="key" size={20} color="#00E5FF" />
                  <ThemedText style={styles.modalTitle}>Join Accountability Squad</ThemedText>
                </View>
                <TouchableOpacity onPress={() => setIsJoinModalVisible(false)} style={styles.modalCloseBtn}>
                  <Ionicons name="close" size={20} color="#94A3B8" />
                </TouchableOpacity>
              </View>

              <ThemedText style={styles.inputLabel}>ENTER SQUAD JOIN CODE</ThemedText>
              <View style={styles.joinCodeInputContainer}>
                <View style={styles.codePrefixBadge}>
                  <ThemedText style={styles.codePrefixText}>SP -</ThemedText>
                </View>
                <TextInput
                  style={styles.joinCodeInnerInput}
                  placeholder="A49Q"
                  placeholderTextColor="#475569"
                  value={joinCodeInput}
                  onChangeText={(val) => {
                    const clean = val.replace(/^sp-?/i, '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
                    setJoinCodeInput(clean);
                  }}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  maxLength={6}
                />
              </View>

              <TouchableOpacity
                style={styles.submitModalBtn}
                activeOpacity={0.85}
                onPress={() => handleJoinCell()}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <ActivityIndicator color="#00E5FF" />
                ) : (
                  <ThemedText style={styles.submitModalBtnText}>Join Accountability Squad</ThemedText>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Custom Glassmorphic Dark Dialog */}
        {customDialog && customDialog.visible && (
          <Modal
            visible={customDialog.visible}
            transparent
            animationType="fade"
            onRequestClose={() => setCustomDialog(null)}
          >
            <View style={styles.modalOverlay}>
              <View style={[styles.dialogCard, customDialog.type === 'danger' && styles.dialogCardDanger]}>
                <View style={[styles.dialogIconCircle, customDialog.type === 'danger' ? styles.dialogIconCircleDanger : styles.dialogIconCircleCyan]}>
                  <Ionicons
                    name={customDialog.type === 'danger' ? 'warning' : customDialog.type === 'success' ? 'shield-checkmark' : 'information-circle'}
                    size={28}
                    color={customDialog.type === 'danger' ? '#EF4444' : customDialog.type === 'success' ? '#10B981' : '#00E5FF'}
                  />
                </View>
                <ThemedText style={styles.dialogTitle}>{customDialog.title}</ThemedText>
                <ThemedText style={styles.dialogMessage}>{customDialog.message}</ThemedText>

                <View style={styles.dialogBtnRow}>
                  {customDialog.cancelText && (
                    <TouchableOpacity
                      style={styles.dialogCancelBtn}
                      activeOpacity={0.7}
                      onPress={() => setCustomDialog(null)}
                    >
                      <ThemedText style={styles.dialogCancelText}>{customDialog.cancelText}</ThemedText>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={[
                      styles.dialogConfirmBtn,
                      customDialog.type === 'danger' && { backgroundColor: '#EF4444' }
                    ]}
                    activeOpacity={0.85}
                    onPress={() => {
                      if (customDialog.onConfirm) {
                        customDialog.onConfirm();
                      } else {
                        setCustomDialog(null);
                      }
                    }}
                  >
                    <ThemedText style={[
                      styles.dialogConfirmText,
                      customDialog.type === 'danger' && { color: '#FFFFFF' }
                    ]}>
                      {customDialog.confirmText || 'OK'}
                    </ThemedText>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
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
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderWidth: 0,
    position: 'relative',
  },
  unreadTopLeftBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: '#EF4444',
    borderWidth: 1.5,
    borderColor: '#05070E',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 4,
    elevation: 4,
  },
  headerTitleGroup: {
    alignItems: 'center',
  },
  headerCategory: {
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
  leaderboardBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  centerLoading: {
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
    paddingTop: 14,
  },
  cellHeroCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.025)',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.25)',
    marginBottom: 12,
  },
  cellHeroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    gap: 12,
  },
  cellBadgeIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: 'rgba(0, 229, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellBadgeText: {
    fontSize: 20,
    fontWeight: '900',
    color: '#00E5FF',
  },
  cellNameGroup: {
    flex: 1,
  },
  cellNameText: {
    fontSize: 17,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  commanderBadge: {
    backgroundColor: 'rgba(245, 158, 11, 0.18)',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
    borderWidth: 0.5,
    borderColor: '#F59E0B',
  },
  commanderBadgeText: {
    fontSize: 8.5,
    fontWeight: '900',
    color: '#F59E0B',
    letterSpacing: 0.5,
  },
  cellMottoText: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '500',
    marginTop: 2,
  },
  joinCodeStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0, 229, 255, 0.06)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.2)',
  },
  codeTextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  codeLabel: {
    fontSize: 10.5,
    fontWeight: '800',
    color: 'rgba(255, 255, 255, 0.5)',
    letterSpacing: 0.6,
  },
  codeValue: {
    fontSize: 14,
    fontWeight: '900',
    color: '#00E5FF',
    letterSpacing: 1,
  },
  shareCodeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  shareCodeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#00E5FF',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  mainStreakCard: {
    flex: 1.3,
    backgroundColor: 'rgba(255, 255, 255, 0.025)',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  streakIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  fireEmoji: {
    fontSize: 22,
  },
  collectiveStreakNumber: {
    fontSize: 28,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  streakCardTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#00E5FF',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  streakCardSub: {
    fontSize: 10,
    color: '#94A3B8',
    lineHeight: 14,
  },
  sideStatsCol: {
    flex: 1,
    gap: 10,
  },
  smallStatCard: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.025)',
    borderRadius: 14,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'center',
  },
  smallStatValue: {
    fontSize: 15,
    fontWeight: '900',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  smallStatLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: 'rgba(255, 255, 255, 0.45)',
    letterSpacing: 0.6,
  },
  shieldStatusCard: {
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
  },
  shieldGold: {
    backgroundColor: 'rgba(245, 158, 11, 0.06)',
    borderColor: 'rgba(245, 158, 11, 0.4)',
  },
  shieldCracked: {
    backgroundColor: 'rgba(239, 68, 68, 0.06)',
    borderColor: 'rgba(239, 68, 68, 0.4)',
  },
  shieldActive: {
    backgroundColor: 'rgba(0, 229, 255, 0.05)',
    borderColor: 'rgba(0, 229, 255, 0.3)',
  },
  shieldHeaderRow: {
    flexDirection: 'row',
    gap: 12,
  },
  shieldTitleWrapper: {
    flex: 1,
  },
  shieldTitleText: {
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.4,
    marginBottom: 3,
  },
  shieldSubText: {
    fontSize: 11.5,
    color: 'rgba(255, 255, 255, 0.7)',
    lineHeight: 16,
  },
  nudgeNoticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginBottom: 12,
    gap: 6,
  },
  nudgeNoticeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#10B981',
  },
  rosterSection: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    marginBottom: 16,
  },
  rosterHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  rosterTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.8,
  },
  rosterSortLabel: {
    fontSize: 10.5,
    color: '#64748B',
    fontWeight: '600',
  },
  rosterList: {
    gap: 8,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.025)',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  memberRowSelf: {
    borderColor: 'rgba(0, 229, 255, 0.35)',
    backgroundColor: 'rgba(0, 229, 255, 0.03)',
  },
  memberLeftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    marginRight: 8,
  },
  memberRankIndexBox: {
    width: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberRankIndexText: {
    fontSize: 11,
    fontWeight: '900',
    color: 'rgba(255, 255, 255, 0.45)',
  },
  memberAvatarBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  memberAvatarText: {
    fontSize: 16,
  },
  memberInfoCol: {
    flex: 1,
    justifyContent: 'center',
  },
  memberNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  memberNameText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
    flexShrink: 1,
  },
  leaderText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#F59E0B',
    letterSpacing: 0.2,
    marginLeft: 3,
  },
  memberRankPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 5,
    borderWidth: 0.5,
    marginTop: 3,
  },
  memberRankNameText: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  memberRightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  streakBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  streakText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  checkedInPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    gap: 3,
  },
  checkedInText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#10B981',
  },
  pendingSelfPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    gap: 4,
  },
  pendingSelfText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#F59E0B',
  },
  nudgeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    gap: 3,
  },
  nudgeBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#EF4444',
  },
  cellFooterActions: {
    gap: 8,
  },
  disbandBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    borderRadius: 14,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.35)',
  },
  disbandBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#EF4444',
  },
  leaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  leaveBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#94A3B8',
  },
  unaffiliatedHero: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.025)',
    borderRadius: 22,
    padding: 22,
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.22)',
    marginBottom: 16,
  },
  crestAura: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(0, 229, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.15)',
  },
  shieldGlowCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(0, 229, 255, 0.12)',
    borderWidth: 1.5,
    borderColor: 'rgba(0, 229, 255, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#00E5FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 6,
  },
  unaffiliatedCategory: {
    fontSize: 10,
    fontWeight: '900',
    color: '#00E5FF',
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  unaffiliatedTitle: {
    fontSize: 18.5,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.3,
    marginBottom: 8,
    textAlign: 'center',
  },
  unaffiliatedBody: {
    fontSize: 12.5,
    color: 'rgba(255, 255, 255, 0.65)',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  pillarStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
    width: '100%',
    marginBottom: 18,
  },
  pillarItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  pillarIconBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 229, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  pillarVal: {
    fontSize: 13,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  pillarLbl: {
    fontSize: 9.5,
    color: '#94A3B8',
    fontWeight: '600',
  },
  pillarDivider: {
    width: 1,
    height: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  pillarTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 2,
    textAlign: 'center',
  },
  pillarDesc: {
    fontSize: 9.5,
    color: '#94A3B8',
    fontWeight: '500',
    textAlign: 'center',
  },
  honorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(245, 158, 11, 0.05)',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.25)',
    marginBottom: 12,
  },
  honorLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  honorIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  honorTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: '#F59E0B',
    letterSpacing: 0.6,
  },
  honorSub: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.6)',
    marginTop: 1,
  },
  honorBadge: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.4)',
  },
  honorPointsText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#F59E0B',
  },
  heroActionRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  createCellBtn: {
    flex: 1.25,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00E5FF',
    paddingVertical: 13,
    borderRadius: 14,
  },
  createCellBtnText: {
    fontSize: 13.5,
    fontWeight: '900',
    color: '#000000',
    letterSpacing: 0.2,
  },
  joinWithCodeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 229, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.3)',
    paddingVertical: 13,
    borderRadius: 14,
  },
  joinWithCodeBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#00E5FF',
  },
  publicSection: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  publicHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  publicSectionTitle: {
    fontSize: 10.5,
    fontWeight: '900',
    color: 'rgba(255, 255, 255, 0.5)',
    letterSpacing: 0.8,
  },
  emptyPublicCard: {
    paddingVertical: 22,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  emptyPublicTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 4,
    textAlign: 'center',
  },
  emptyPublicText: {
    fontSize: 11.5,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 16,
    maxWidth: '90%',
  },
  publicCellCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.025)',
    borderRadius: 14,
    padding: 13,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    marginBottom: 8,
  },
  publicCellHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  publicCellName: {
    fontSize: 14.5,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  publicCellMotto: {
    fontSize: 11.5,
    color: '#94A3B8',
  },
  publicStreakBadge: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  publicStreakText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#F59E0B',
  },
  publicCellFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  publicMembersCount: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  joinPublicBtn: {
    backgroundColor: 'rgba(0, 229, 255, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.35)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  joinPublicBtnText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#00E5FF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.88)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  modalCard: {
    width: '100%',
    backgroundColor: '#0B1120',
    borderRadius: 22,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.3)',
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 16.5,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  modalCloseBtn: {
    padding: 4,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '900',
    color: '#00E5FF',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#FFFFFF',
    fontSize: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    marginBottom: 14,
  },
  joinCodeInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(0, 229, 255, 0.3)',
    marginBottom: 16,
    overflow: 'hidden',
  },
  codePrefixBadge: {
    backgroundColor: 'rgba(0, 229, 255, 0.15)',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRightWidth: 1,
    borderRightColor: 'rgba(0, 229, 255, 0.25)',
  },
  codePrefixText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#00E5FF',
    letterSpacing: 1.5,
  },
  joinCodeInnerInput: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 3,
    textTransform: 'uppercase',
  },
  mottoPresetRow: {
    gap: 8,
    marginBottom: 16,
  },
  mottoPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  mottoPillActive: {
    backgroundColor: 'rgba(0, 229, 255, 0.15)',
    borderColor: '#00E5FF',
  },
  mottoPillText: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600',
  },
  mottoPillTextActive: {
    color: '#00E5FF',
    fontWeight: '800',
  },
  submitModalBtn: {
    backgroundColor: '#00E5FF',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  submitModalBtnText: {
    fontSize: 13.5,
    fontWeight: '900',
    color: '#000000',
    letterSpacing: 0.3,
  },
  dialogCard: {
    width: '100%',
    backgroundColor: '#0C1220',
    borderRadius: 22,
    padding: 22,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(0, 229, 255, 0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 10,
  },
  dialogCardDanger: {
    borderColor: 'rgba(239, 68, 68, 0.45)',
  },
  dialogIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  dialogIconCircleCyan: {
    backgroundColor: 'rgba(0, 229, 255, 0.12)',
  },
  dialogIconCircleDanger: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
  },
  dialogTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  dialogMessage: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 20,
    paddingHorizontal: 6,
  },
  dialogBtnRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  dialogCancelBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialogCancelText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#94A3B8',
  },
  dialogConfirmBtn: {
    flex: 1.3,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: '#00E5FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialogConfirmText: {
    fontSize: 13.5,
    fontWeight: '900',
    color: '#000000',
    letterSpacing: 0.2,
  },
});
