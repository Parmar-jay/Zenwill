import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
  LayoutAnimation,
  Animated,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { ThemedText } from '../../components/themed-text';
import { useSpartanStore } from '../../store/spartan-store';
import { useAuthStore } from '../../store/auth-store';
import { CellMemberItem, SpartanCellData, JoinRequestItem } from '../../services/spartan-api';
import { communityApi } from '../../services/community-api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface AnimatedPressableProps {
  onPress?: (e?: any) => void;
  style?: any;
  disabled?: boolean;
  scaleTo?: number;
  accessibilityLabel?: string;
  children: React.ReactNode;
}

const AnimatedPressable: React.FC<AnimatedPressableProps> = ({
  onPress,
  style,
  disabled,
  scaleTo = 0.95,
  accessibilityLabel,
  children,
}) => {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    if (disabled) return;
    Animated.spring(scale, {
      toValue: scaleTo,
      useNativeDriver: true,
      speed: 35,
      bounciness: 4,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 25,
      bounciness: 5,
    }).start();
  };

  return (
    <Animated.View style={[{ transform: [{ scale }] }]}>
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled}
        accessibilityLabel={accessibilityLabel}
        style={style}
      >
        {children}
      </TouchableOpacity>
    </Animated.View>
  );
};

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
    myPendingRequests,
    isLoadingCell,
    hasLoadedInitialCell,
    isNudging,
    fetchMyCell,
    fetchPublicCells,
    fetchMyJoinRequests,
    respondJoinRequest,
    promoteCoLeader,
    demoteCoLeader,
    kickMember,
    leaveCell,
    deleteCell,
    nudgeMember,
  } = useSpartanStore();

  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [isLeaving, setIsLeaving] = useState<boolean>(false);

  // Review & member moderation states
  const [reviewingRequestId, setReviewingRequestId] = useState<string | null>(null);
  const [reviewAction, setReviewAction] = useState<'approve' | 'reject' | null>(null);
  const [selectedMember, setSelectedMember] = useState<CellMemberItem | null>(null);
  const [isMemberModalVisible, setIsMemberModalVisible] = useState<boolean>(false);
  const [memberActionLoading, setMemberActionLoading] = useState<boolean>(false);
  const [memberActionPhase, setMemberActionPhase] = useState<'idle' | 'promoting' | 'promoted_success' | 'demoting' | 'demoted_success' | 'kicking' | 'kicked_success'>('idle');
  const actionSuccessAnim = useRef(new Animated.Value(0)).current;

  const [customDialog, setCustomDialog] = useState<{
    visible: boolean;
    title: string;
    message: string;
    type: 'success' | 'danger' | 'info';
    confirmText?: string;
    cancelText?: string;
    onConfirm?: () => void;
  } | null>(null);

  const actionLoadingRef = useRef(actionLoading);
  actionLoadingRef.current = actionLoading;
  const isLeavingRef = useRef(isLeaving);
  isLeavingRef.current = isLeaving;

  const triggerHaptic = useCallback((style: 'light' | 'medium' | 'heavy' | 'success' = 'light') => {
    try {
      if (Platform.OS !== 'web') {
        if (style === 'heavy') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        else if (style === 'medium') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        else if (style === 'success') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        else Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch { }
  }, []);

  const loadData = useCallback(async (showLoading = false) => {
    await Promise.allSettled([
      fetchMyCell({ showLoading }),
      fetchPublicCells(),
      fetchMyJoinRequests(),
    ]);
  }, [fetchMyCell, fetchPublicCells, fetchMyJoinRequests]);

  useEffect(() => {
    loadData(!hasLoadedInitialCell);
  }, []);

  useFocusEffect(
    useCallback(() => {
      // Quiet background refresh on screen focus
      loadData(false);
      // Low-frequency fallback poll (45s) while screen is actively focused to conserve free-tier server
      const fastSyncTimer = setInterval(() => {
        if (!actionLoadingRef.current && !isLeavingRef.current) {
          fetchMyCell({ showLoading: false }).catch(() => { });
        }
      }, 45000);

      return () => {
        clearInterval(fastSyncTimer);
      };
    }, [loadData, fetchMyCell])
  );

  const isLeader = useMemo(() => {
    if (!myCell || !user) return false;
    const userIdStr = String(user.id || '');
    return myCell.leader_id === userIdStr || myCell.leader_id === user.email;
  }, [myCell, user]);

  const isCoLeader = useMemo(() => {
    if (!myCell || !user || isLeader) return false;
    const userIdStr = String(user.id || '');
    const coLeaderIds = myCell.co_leader_ids || [];
    return coLeaderIds.includes(userIdStr) || (user.email && coLeaderIds.includes(user.email));
  }, [myCell, user, isLeader]);

  const hasManagementRights = isLeader || isCoLeader;

  // If user is no longer enrolled in a squad (or departed/kicked), seamlessly navigate to discovery Hub
  useEffect(() => {
    if (!myCell && hasLoadedInitialCell && !isLoadingCell && !isLeaving) {
      router.replace('/spartan-squad' as any);
    }
  }, [myCell, hasLoadedInitialCell, isLoadingCell, isLeaving]);

  const handleRespondRequest = async (requestId: string, action: 'approve' | 'reject', applicantName: string) => {
    if (!myCell?.id) return;
    triggerHaptic(action === 'approve' ? 'heavy' : 'medium');
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setReviewingRequestId(requestId);
    setReviewAction(action);
    try {
      const res = await respondJoinRequest(myCell.id, requestId, action);
      if (res?.status === 'already_joined') {
        setCustomDialog({
          visible: true,
          title: 'Applicant Already Enlisted',
          message: res.message || `${applicantName} has already joined another Spartan Cell. Their petition has been cleared from your queue.`,
          type: 'info',
          confirmText: 'Understood',
        });
      } else if (res?.status === 'approved' || action === 'approve') {
        triggerHaptic('heavy');
        setCustomDialog({
          visible: true,
          title: 'Warrior Inducted! 🛡️',
          message: res?.message || `${applicantName} has been admitted to ${myCell.name}. We hold the line together!`,
          type: 'success',
          confirmText: 'Great',
        });
      }
    } catch (err: any) {
      const errorMsg = err?.response?.data?.detail || err?.detail || 'Failed to process request.';
      const isAlreadyJoinedError = typeof errorMsg === 'string' && errorMsg.toLowerCase().includes('already joined another');
      setCustomDialog({
        visible: true,
        title: isAlreadyJoinedError ? 'Applicant Already Enlisted' : 'Review Notice',
        message: errorMsg,
        type: isAlreadyJoinedError ? 'info' : 'danger',
        confirmText: 'Understood',
      });
      fetchMyCell({ showLoading: false }).catch(() => { });
    } finally {
      setReviewingRequestId(null);
      setReviewAction(null);
    }
  };

  const handlePromoteCoLeader = async (member: CellMemberItem) => {
    triggerHaptic('medium');
    actionSuccessAnim.setValue(0);
    setMemberActionPhase('promoting');
    setMemberActionLoading(true);
    try {
      await promoteCoLeader(member.user_id);
      // Task completed successfully -> Trigger celebratory haptic & transition to completion animation
      setMemberActionPhase('promoted_success');
      triggerHaptic('success');
      Animated.spring(actionSuccessAnim, {
        toValue: 1,
        friction: 5,
        tension: 50,
        useNativeDriver: true,
      }).start();

      // Keep success state on screen for 900ms so the user sees and feels the completed animation
      setTimeout(() => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setIsMemberModalVisible(false);
        setTimeout(() => {
          setSelectedMember(null);
          setMemberActionPhase('idle');
          setMemberActionLoading(false);
          actionSuccessAnim.setValue(0);
        }, 300);
      }, 900);
    } catch (err: any) {
      setMemberActionPhase('idle');
      setMemberActionLoading(false);
      setCustomDialog({
        visible: true,
        title: 'Promotion Failed',
        message: err?.response?.data?.detail || err?.detail || 'Could not appoint co-leader.',
        type: 'danger',
        confirmText: 'OK',
      });
    }
  };

  const handleDemoteCoLeader = async (member: CellMemberItem) => {
    triggerHaptic('medium');
    actionSuccessAnim.setValue(0);
    setMemberActionPhase('demoting');
    setMemberActionLoading(true);
    try {
      await demoteCoLeader(member.user_id);
      // Task completed successfully -> Transition to demoted success state
      setMemberActionPhase('demoted_success');
      triggerHaptic('success');
      Animated.spring(actionSuccessAnim, {
        toValue: 1,
        friction: 5,
        tension: 50,
        useNativeDriver: true,
      }).start();

      // Display completion animation before modal dismiss
      setTimeout(() => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setIsMemberModalVisible(false);
        setTimeout(() => {
          setSelectedMember(null);
          setMemberActionPhase('idle');
          setMemberActionLoading(false);
          actionSuccessAnim.setValue(0);
        }, 300);
      }, 900);
    } catch (err: any) {
      setMemberActionPhase('idle');
      setMemberActionLoading(false);
      setCustomDialog({
        visible: true,
        title: 'Demotion Failed',
        message: err?.response?.data?.detail || err?.detail || 'Could not demote co-leader.',
        type: 'danger',
        confirmText: 'OK',
      });
    }
  };

  const handleKickMember = (member: CellMemberItem) => {
    setCustomDialog({
      visible: true,
      title: `Exile ${member.name}?`,
      message: `Are you sure you want to remove ${member.name} from the squad? Their streak will no longer count toward the collective total.`,
      type: 'danger',
      confirmText: 'Exile Member',
      cancelText: 'Cancel',
      onConfirm: async () => {
        triggerHaptic('medium');
        setCustomDialog(null);
        actionSuccessAnim.setValue(0);
        setMemberActionPhase('kicking');
        setMemberActionLoading(true);
        try {
          await kickMember(member.user_id);
          // Task completed successfully -> Transition to kicked success state
          setMemberActionPhase('kicked_success');
          triggerHaptic('success');
          Animated.spring(actionSuccessAnim, {
            toValue: 1,
            friction: 5,
            tension: 50,
            useNativeDriver: true,
          }).start();

          // Display completion animation before modal dismiss
          setTimeout(() => {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            setIsMemberModalVisible(false);
            setTimeout(() => {
              setSelectedMember(null);
              setMemberActionPhase('idle');
              setMemberActionLoading(false);
              actionSuccessAnim.setValue(0);
            }, 300);
          }, 900);
        } catch (err: any) {
          setMemberActionPhase('idle');
          setMemberActionLoading(false);
          setCustomDialog({
            visible: true,
            title: 'Exile Failed',
            message: err?.response?.data?.detail || err?.detail || 'Could not exile member.',
            type: 'danger',
            confirmText: 'OK',
          });
        }
      },
    });
  };

  const handleLeaveCell = () => {
    setCustomDialog({
      visible: true,
      title: 'Leave Accountability Squad',
      message: isLeader && dedupedMembers.length > 1
        ? 'As Leader, departing this squad will transfer leadership to the next highest-streak warrior. Your streak will no longer contribute to the collective total.'
        : 'Are you sure you want to depart this squad? Your streak will no longer contribute to the collective total.',
      type: 'danger',
      confirmText: 'Leave Squad',
      cancelText: 'Cancel',
      onConfirm: async () => {
        triggerHaptic('heavy');
        setActionLoading(true);
        setIsLeaving(true);
        // Immediately unbind myCell so the index view is displayed right away
        useSpartanStore.setState({ myCell: null });
        try {
          await leaveCell();
          fetchPublicCells().catch(() => { });
          fetchMyJoinRequests().catch(() => { });
        } catch (err: any) {
          useSpartanStore.setState({ myCell: null });
        } finally {
          setActionLoading(false);
          setIsLeaving(false);
          setCustomDialog(null);
          router.replace('/spartan-squad' as any);
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
        setIsLeaving(true);
        useSpartanStore.setState({ myCell: null });
        try {
          await deleteCell();
          fetchPublicCells().catch(() => { });
          fetchMyJoinRequests().catch(() => { });
        } catch (err: any) {
          useSpartanStore.setState({ myCell: null });
        } finally {
          setActionLoading(false);
          setIsLeaving(false);
          setCustomDialog(null);
          router.replace('/spartan-squad' as any);
        }
      },
    });
  };

  const handleNudge = async (member: CellMemberItem) => {
    triggerHaptic('medium');
    const reminderText = `🛡️ Streak Reminder: Hey brother, please complete your daily streak check-in today to hold the line for our Squad!`;
    try {
      // 1. Send backend nudge (creates DM in MongoDB)
      await nudgeMember(member.user_id, member.name);
      // 2. Also dispatch via communityApi for instant client sync
      communityApi.sendDirectMessage(member.user_id, reminderText, 'text').catch(() => { });
    } catch {
      communityApi.sendDirectMessage(member.user_id, reminderText, 'text').catch(() => { });
    }
  };

  const dedupedMembers = useMemo(() => {
    if (!myCell?.members) return [];
    const seen = new Set<string>();
    return myCell.members.filter((m) => {
      const uid = (m.user_id || '').trim().toLowerCase();
      const key = uid || (m.name || '').trim().toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [myCell?.members]);

  const relapsedMembers = useMemo(() => {
    return dedupedMembers.filter(
      (m) => m.status === 'relapsed' || m.last_retain_status === 'relapsed' || (typeof m.streak === 'number' && m.streak === 0)
    );
  }, [dedupedMembers]);

  const hasRelapsedMembers = relapsedMembers.length > 0;
  const hasPendingMembers = useMemo(() => {
    return dedupedMembers.some(
      (m) =>
        !m.today_checked_in &&
        m.status !== 'relapsed' &&
        m.last_retain_status !== 'relapsed' &&
        typeof m.streak === 'number' &&
        m.streak > 0
    );
  }, [dedupedMembers]);

  const isGoldShield = myCell?.shield_status === 'gold' && !hasRelapsedMembers && !hasPendingMembers;
  const isCrackedShield = hasRelapsedMembers || myCell?.shield_status === 'cracked';

  const handleShareCode = async () => {
    if (!myCell?.join_code) return;
    triggerHaptic('light');
    try {
      await Share.share({
        message: `🛡️ Join my Accountability Squad "${myCell.name}" on ZenWill — the neuroscience-backed platform for dopamine mastery, daily retention, and shared brotherhood discipline.\n\nCollective Squad Streak: ${myCell.total_streak} Days\nJoin Code: ${myCell.join_code}\n\nDownload ZenWill & master your dopamine: https://zenwill.me`,
      });
    } catch { }
  };

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

        {isLoadingCell && !hasLoadedInitialCell && !myCell ? (
          <View style={styles.centerLoading}>
            <ActivityIndicator size="large" color="#00E5FF" />
            <ThemedText style={styles.loadingText}>Syncing Squad Discipline Matrix...</ThemedText>
          </View>
        ) : !myCell && hasLoadedInitialCell ? (
          <View style={styles.centerLoading}>
            <ActivityIndicator size="large" color="#00E5FF" />
            <ThemedText style={styles.loadingText}>Redirecting to Spartan Squad Hub...</ThemedText>
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
              <AnimatedPressable
                style={styles.joinCodeStrip}
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
              </AnimatedPressable>
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
                  Combined clean days of all {dedupedMembers.length || 1} members. Drops if any member relapses.
                </ThemedText>
              </View>

              {/* Right Stacked Column: Active Members & Squad Honor */}
              <View style={styles.sideStatsCol}>
                <View style={styles.smallStatCard}>
                  <ThemedText style={styles.smallStatValue}>
                    {dedupedMembers.length || 1}/{myCell.max_members || 20}
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

            {/* Shield Status Banner */}
            <View style={[
              styles.shieldStatusCard,
              isGoldShield ? styles.shieldGold : isCrackedShield ? styles.shieldCracked : styles.shieldActive
            ]}>
              <View style={styles.shieldHeaderRow}>
                <Ionicons
                  name={
                    isGoldShield
                      ? 'shield-checkmark'
                      : hasRelapsedMembers
                        ? 'warning-outline'
                        : hasPendingMembers
                          ? 'time-outline'
                          : 'shield-outline'
                  }
                  size={24}
                  color={
                    isGoldShield
                      ? '#F59E0B'
                      : hasRelapsedMembers
                        ? '#EF4444'
                        : hasPendingMembers
                          ? '#F59E0B'
                          : '#00E5FF'
                  }
                />
                <View style={styles.shieldTitleWrapper}>
                  <ThemedText style={[
                    styles.shieldTitleText,
                    {
                      color:
                        isGoldShield
                          ? '#F59E0B'
                          : hasRelapsedMembers
                            ? '#EF4444'
                            : hasPendingMembers
                              ? '#F59E0B'
                              : '#00E5FF'
                    }
                  ]}>
                    {isGoldShield
                      ? 'GOLD SHIELD ACTIVE (+20% XP)'
                      : hasRelapsedMembers
                        ? 'SQUAD SHIELD CRACKED'
                        : hasPendingMembers
                          ? 'SHIELD PENDING (CHECK-IN AWAITED)'
                          : 'DISCIPLINE SHIELD ACTIVE'}
                  </ThemedText>
                  <ThemedText style={styles.shieldSubText}>
                    {isGoldShield
                      ? '100% of squad members confirmed retention today! +20% XP boost active for the entire squad.'
                      : hasRelapsedMembers
                        ? 'A squad member has relapsed today. In this squad, we hold the line together and rebuild retention.'
                        : hasPendingMembers
                          ? 'One or more members have pending daily check-ins. Remind them to complete check-in before midnight.'
                          : 'Maintain consistent daily check-ins across all members to unlock the Gold Shield before midnight.'}
                  </ThemedText>
                </View>
              </View>
            </View>



            {/* Join Petitions Review Section (Leader & Co-Leaders) */}
            {hasManagementRights && myCell.join_requests && myCell.join_requests.length > 0 && (
              <View style={styles.requestsSection}>
                <View style={styles.requestsHeaderRow}>
                  <View style={styles.requestsHeaderTitleGroup}>
                    <View style={styles.requestsBadgeCount}>
                      <ThemedText style={styles.requestsBadgeCountText}>
                        {myCell.join_requests.length}
                      </ThemedText>
                    </View>
                    <ThemedText style={styles.requestsSectionTitle}>JOIN PETITIONS</ThemedText>
                  </View>
                  <View style={styles.verificationTag}>
                    <View style={styles.verificationDot} />
                    <ThemedText style={styles.requestsSubtitle}>Verification Required</ThemedText>
                  </View>
                </View>

                <View style={styles.requestsList}>
                  {myCell.join_requests.map((req) => {
                    const reqRank = getGamifiedRank(req.streak || 0);
                    const isCurrentReviewing = reviewingRequestId === req.id;
                    const applicantDisplayName = req.user_name || req.name || 'Applicant';
                    return (
                      <View key={req.id} style={styles.requestCard}>
                        <View style={styles.requestLeft}>
                          <View
                            style={[
                              styles.requestAvatarBox,
                              {
                                backgroundColor: `${reqRank.color}18`,
                                borderColor: `${reqRank.color}45`,
                              },
                            ]}
                          >
                            <Text style={styles.requestAvatarEmoji}>{req.badge || reqRank.badge}</Text>
                          </View>
                          <View style={styles.requestInfo}>
                            <ThemedText style={styles.requestName} numberOfLines={1}>
                              {applicantDisplayName}
                            </ThemedText>
                            <View style={styles.requestDetailsRow}>
                              <ThemedText style={styles.requestStreak}>🔥 {req.streak || 0}d streak</ThemedText>
                              <ThemedText style={styles.requestRankTier}>• {req.rank_tier || reqRank.name}</ThemedText>
                            </View>
                          </View>
                        </View>

                        <View style={styles.requestActionsGroup}>
                          {/* Reject Button (X) */}
                          <AnimatedPressable
                            style={[
                              styles.rejectReqBtn,
                              isCurrentReviewing && reviewAction === 'reject' && styles.reqBtnLoading,
                            ]}
                            disabled={isCurrentReviewing}
                            onPress={() => handleRespondRequest(req.id, 'reject', applicantDisplayName)}
                            accessibilityLabel={`Reject petition from ${applicantDisplayName}`}
                          >
                            {isCurrentReviewing && reviewAction === 'reject' ? (
                              <ActivityIndicator size="small" color="#EF4444" />
                            ) : (
                              <Ionicons name="close" size={20} color="#EF4444" />
                            )}
                          </AnimatedPressable>

                          {/* Approve Button (Checkmark) */}
                          <AnimatedPressable
                            style={[
                              styles.approveReqBtn,
                              isCurrentReviewing && reviewAction === 'approve' && styles.reqBtnLoading,
                            ]}
                            disabled={isCurrentReviewing}
                            onPress={() => handleRespondRequest(req.id, 'approve', applicantDisplayName)}
                            accessibilityLabel={`Approve petition from ${applicantDisplayName}`}
                          >
                            {isCurrentReviewing && reviewAction === 'approve' ? (
                              <ActivityIndicator size="small" color="#FFFFFF" />
                            ) : (
                              <Ionicons name="checkmark" size={20} color="#FFFFFF" />
                            )}
                          </AnimatedPressable>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Squad Members Roster */}
            <View style={styles.rosterSection}>
              <View style={styles.rosterHeaderRow}>
                <ThemedText style={styles.rosterTitle}>
                  SQUAD MEMBERS ({dedupedMembers.length}/{myCell.max_members || 20})
                </ThemedText>
                <ThemedText style={styles.rosterSortLabel}>Ordered by Retention</ThemedText>
              </View>

              <View style={styles.rosterList}>
                {dedupedMembers.map((member, index) => {
                  const currentUserId = String(user?.id || '').trim();
                  const currentUserEmail = (user?.email || '').trim().toLowerCase();
                  const isCurrentUser = Boolean(
                    (currentUserId && member.user_id === currentUserId) ||
                    (currentUserEmail && member.user_id && member.user_id.toLowerCase() === currentUserEmail)
                  );
                  const memberStreak = typeof member.streak === 'number' ? member.streak : 0;
                  const memberXp = typeof member.xp === 'number' ? member.xp : 0;
                  const memberRank = getGamifiedRank(memberStreak);

                  const isRelapsed =
                    member.status === 'relapsed' ||
                    member.last_retain_status === 'relapsed' ||
                    memberStreak === 0;
                  const isRetained = !isRelapsed && (member.status === 'retained' || member.today_checked_in);

                  const isCoLeaderMember = Boolean(
                    member.is_co_leader ||
                    (myCell?.co_leader_ids && (myCell.co_leader_ids.includes(member.user_id) || (member.name && myCell.co_leader_ids.includes(member.name))))
                  );
                  const canManageThisMember = hasManagementRights && !isCurrentUser && (
                    isLeader || (!member.is_leader && !isCoLeaderMember)
                  );

                  // Priority for thin colored card borders: Leader (Yellow), Co-Leader (Orange), You (Cyan), Relapsed (Red)
                  const memberRowBorderStyle = member.is_leader
                    ? styles.memberRowLeader
                    : isCoLeaderMember
                      ? styles.memberRowCoLeader
                      : isCurrentUser
                        ? styles.memberRowSelf
                        : isRelapsed
                          ? styles.memberRowRelapsed
                          : null;

                  return (
                    <TouchableOpacity
                      key={`${member.user_id}-${index}`}
                      style={[
                        styles.memberRow,
                        memberRowBorderStyle,
                      ]}
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
                              {member.name}
                            </ThemedText>
                            {member.is_leader ? (
                              <View style={styles.leaderBadge}>
                                <ThemedText style={styles.leaderText}>Leader</ThemedText>
                              </View>
                            ) : isCoLeaderMember ? (
                              <View style={styles.coLeaderBadge}>
                                <ThemedText style={styles.coLeaderText}>Co-Leader</ThemedText>
                              </View>
                            ) : null}
                            {isCurrentUser && (
                              <View style={styles.youBadge}>
                                <ThemedText style={styles.youBadgeText}>You</ThemedText>
                              </View>
                            )}
                          </View>
                          <ThemedText style={styles.memberMetaText} numberOfLines={1}>
                            {memberRank.name} • {Number(memberXp).toLocaleString()} XP
                          </ThemedText>
                        </View>
                      </View>

                      <View style={styles.memberRightWrapper}>
                        <View style={styles.memberRightGroup}>
                          <View style={[styles.streakBadge, isRelapsed && styles.streakBadgeRelapsed]}>
                            <ThemedText style={[styles.streakText, isRelapsed && styles.streakTextRelapsed]}>
                              🔥 {memberStreak}d
                            </ThemedText>
                          </View>

                          <View style={styles.statusActionSlot}>
                            {isRelapsed ? (
                              <View style={styles.relapsedPill}>
                                <Ionicons name="refresh-circle-outline" size={12} color="#EF4444" />
                                <ThemedText style={styles.relapsedText}>Relapsed</ThemedText>
                              </View>
                            ) : isRetained ? (
                              <View style={styles.checkedInPill}>
                                <Ionicons name="shield-checkmark" size={11} color="#10B981" />
                                <ThemedText style={styles.checkedInText}>Retained</ThemedText>
                              </View>
                            ) : isCurrentUser ? (
                              <View style={styles.pendingSelfPill}>
                                <Ionicons name="time-outline" size={11} color="#F59E0B" />
                                <ThemedText style={styles.pendingSelfText}>Pending</ThemedText>
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
                                <Ionicons name="notifications-outline" size={11} color="#EF4444" />
                                <ThemedText style={styles.nudgeBtnText}>Remind</ThemedText>
                              </TouchableOpacity>
                            )}
                          </View>
                        </View>

                        {canManageThisMember && (
                          <AnimatedPressable
                            style={styles.memberManageBtn}
                            onPress={(e) => {
                              e?.stopPropagation?.();
                              triggerHaptic('light');
                              setSelectedMember(member);
                              setIsMemberModalVisible(true);
                            }}
                            accessibilityLabel={`Manage ${member.name}`}
                          >
                            <Ionicons name="ellipsis-vertical" size={16} color="#94A3B8" />
                          </AnimatedPressable>
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Action Buttons: Leave Squad (available for all) & Leader Disband */}
            <View style={styles.cellFooterActions}>
              <AnimatedPressable
                style={[styles.leaveBtn, (isLeaving || actionLoading) && styles.leaveBtnLoading]}
                onPress={handleLeaveCell}
                disabled={actionLoading || isLeaving}
              >
                {isLeaving ? (
                  <View style={styles.btnLoadingRow}>
                    <ActivityIndicator size="small" color="#EF4444" />
                    <ThemedText style={[styles.leaveBtnText, { color: '#EF4444' }]}>Departing Squad...</ThemedText>
                  </View>
                ) : (
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons name="exit-outline" size={16} color="#EF4444" style={{ marginRight: 6 }} />
                    <ThemedText style={styles.leaveBtnText}>Leave Accountability Squad</ThemedText>
                  </View>
                )}
              </AnimatedPressable>

              {isLeader && (
                <AnimatedPressable
                  style={styles.disbandBtn}
                  onPress={handleDeleteCell}
                  disabled={actionLoading || isLeaving}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons name="trash-outline" size={15} color="#94A3B8" style={{ marginRight: 6 }} />
                    <ThemedText style={styles.disbandBtnText}>Disband Squad (Leader)</ThemedText>
                  </View>
                </AnimatedPressable>
              )}
            </View>

            <View style={{ height: 40 }} />
          </ScrollView>
        ) : null}

        {/* Modal: Member Management (Promote / Demote / Kick) */}
        {selectedMember && (
          <Modal
            visible={isMemberModalVisible}
            transparent
            animationType="fade"
            onRequestClose={() => {
              if (!memberActionLoading && memberActionPhase === 'idle') setIsMemberModalVisible(false);
            }}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.memberActionCard}>
                <View style={styles.memberActionHeader}>
                  <View style={styles.memberActionAvatarBox}>
                    <Text style={{ fontSize: 24 }}>
                      {getGamifiedRank(selectedMember.streak || 0).badge}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <ThemedText style={styles.memberActionName} numberOfLines={1}>
                      {selectedMember.name}
                    </ThemedText>
                    <ThemedText style={styles.memberActionSub}>
                      🔥 {selectedMember.streak || 0}d streak • {getGamifiedRank(selectedMember.streak || 0).name}
                    </ThemedText>
                  </View>
                  <TouchableOpacity
                    onPress={() => setIsMemberModalVisible(false)}
                    style={styles.modalCloseBtn}
                    disabled={memberActionLoading || memberActionPhase !== 'idle'}
                  >
                    <Ionicons name="close" size={20} color="#94A3B8" />
                  </TouchableOpacity>
                </View>

                <View style={styles.memberActionDivider} />

                {/* Leader & Moderation Actions */}
                {(() => {
                  const isSelectedMemberCoLeader = Boolean(
                    selectedMember.is_co_leader ||
                    (myCell?.co_leader_ids && myCell.co_leader_ids.some((cid) => {
                      const cStr = String(cid || '').trim().toLowerCase();
                      return (
                        cStr === String(selectedMember.user_id || '').trim().toLowerCase() ||
                        (selectedMember.email && cStr === String(selectedMember.email).trim().toLowerCase()) ||
                        (selectedMember.name && cStr === String(selectedMember.name).trim().toLowerCase())
                      );
                    }))
                  );

                  const isPromoting = memberActionPhase === 'promoting';
                  const isPromotedDone = memberActionPhase === 'promoted_success';
                  const isDemoting = memberActionPhase === 'demoting';
                  const isDemotedDone = memberActionPhase === 'demoted_success';
                  const isKicking = memberActionPhase === 'kicking';
                  const isKickedDone = memberActionPhase === 'kicked_success';
                  const isAnyActionRunning = memberActionPhase !== 'idle';

                  return (
                    <>
                      {isLeader && (
                        <>
                          {isSelectedMemberCoLeader ? (
                            isDemotedDone ? (
                              <View style={[styles.actionRowBtn, styles.actionRowBtnSuccessAmber]}>
                                <Animated.View style={[styles.actionIconBox, { backgroundColor: 'rgba(245, 158, 11, 0.25)', transform: [{ scale: actionSuccessAnim }] }]}>
                                  <Ionicons name="checkmark-circle" size={24} color="#F59E0B" />
                                </Animated.View>
                                <View style={{ flex: 1 }}>
                                  <ThemedText style={[styles.actionBtnTitle, { color: '#F59E0B', fontSize: 14.5 }]}>
                                    Returned to Warrior Rank ✓
                                  </ThemedText>
                                  <ThemedText style={[styles.actionBtnDesc, { color: '#FCD34D' }]}>
                                    Co-Leader privileges revoked successfully
                                  </ThemedText>
                                </View>
                              </View>
                            ) : (
                              <AnimatedPressable
                                style={[
                                  styles.actionRowBtn,
                                  isDemoting && styles.actionRowBtnActiveAmber,
                                  (isAnyActionRunning && !isDemoting) && { opacity: 0.35 },
                                ]}
                                onPress={() => handleDemoteCoLeader(selectedMember)}
                                disabled={isAnyActionRunning}
                              >
                                <View style={[styles.actionIconBox, { backgroundColor: 'rgba(245, 158, 11, 0.15)' }]}>
                                  {isDemoting ? (
                                    <ActivityIndicator size="small" color="#F59E0B" />
                                  ) : (
                                    <Ionicons name="shield-outline" size={18} color="#F59E0B" />
                                  )}
                                </View>
                                <View style={{ flex: 1 }}>
                                  <ThemedText style={[styles.actionBtnTitle, { color: '#F59E0B' }]}>
                                    {isDemoting ? 'Revoking Co-Leader Rank...' : 'Demote from Co-Leader'}
                                  </ThemedText>
                                  <ThemedText style={styles.actionBtnDesc}>
                                    {isDemoting ? 'Updating permissions...' : 'Remove petition review and moderation privileges'}
                                  </ThemedText>
                                </View>
                              </AnimatedPressable>
                            )
                          ) : (
                            isPromotedDone ? (
                              <View style={[styles.actionRowBtn, styles.actionRowBtnSuccessCyan]}>
                                <Animated.View style={[styles.actionIconBox, { backgroundColor: 'rgba(0, 229, 255, 0.25)', transform: [{ scale: actionSuccessAnim }] }]}>
                                  <Ionicons name="checkmark-circle" size={24} color="#00E5FF" />
                                </Animated.View>
                                <View style={{ flex: 1 }}>
                                  <ThemedText style={[styles.actionBtnTitle, { color: '#00E5FF', fontSize: 14.5 }]}>
                                    Appointed Co-Leader! 🛡️
                                  </ThemedText>
                                  <ThemedText style={[styles.actionBtnDesc, { color: '#A5F3FC' }]}>
                                    Granted petition review & squad moderation rights
                                  </ThemedText>
                                </View>
                              </View>
                            ) : (
                              <AnimatedPressable
                                style={[
                                  styles.actionRowBtn,
                                  isPromoting && styles.actionRowBtnActiveCyan,
                                  (isAnyActionRunning && !isPromoting) && { opacity: 0.35 },
                                ]}
                                onPress={() => handlePromoteCoLeader(selectedMember)}
                                disabled={isAnyActionRunning}
                              >
                                <View style={[styles.actionIconBox, { backgroundColor: 'rgba(0, 229, 255, 0.15)' }]}>
                                  {isPromoting ? (
                                    <ActivityIndicator size="small" color="#00E5FF" />
                                  ) : (
                                    <Ionicons name="shield-half" size={18} color="#00E5FF" />
                                  )}
                                </View>
                                <View style={{ flex: 1 }}>
                                  <ThemedText style={[styles.actionBtnTitle, { color: '#00E5FF' }]}>
                                    {isPromoting ? 'Appointing Co-Leader...' : 'Promote to Co-Leader'}
                                  </ThemedText>
                                  <ThemedText style={styles.actionBtnDesc}>
                                    {isPromoting ? 'Activating leadership authority...' : 'Grant petition review & member moderation rights'}
                                  </ThemedText>
                                </View>
                              </AnimatedPressable>
                            )
                          )}
                        </>
                      )}

                      {/* Kick / Exile Option: Leader can kick anyone except self, Co-Leader can kick regular members */}
                      {(isLeader || (!selectedMember.is_leader && !isSelectedMemberCoLeader)) && (
                        isKickedDone ? (
                          <View style={[styles.actionRowBtn, styles.actionRowBtnSuccessRed]}>
                            <Animated.View style={[styles.actionIconBox, { backgroundColor: 'rgba(239, 68, 68, 0.25)', transform: [{ scale: actionSuccessAnim }] }]}>
                              <Ionicons name="checkmark-circle" size={24} color="#EF4444" />
                            </Animated.View>
                            <View style={{ flex: 1 }}>
                              <ThemedText style={[styles.actionBtnTitle, { color: '#EF4444', fontSize: 14.5 }]}>
                                Exiled from Squad ✓
                              </ThemedText>
                              <ThemedText style={[styles.actionBtnDesc, { color: '#FCA5A5' }]}>
                                Warrior removed from squad roster
                              </ThemedText>
                            </View>
                          </View>
                        ) : (
                          <AnimatedPressable
                            style={[
                              styles.actionRowBtn,
                              styles.actionRowBtnDanger,
                              isKicking && styles.actionRowBtnActiveRed,
                              (isAnyActionRunning && !isKicking) && { opacity: 0.35 },
                            ]}
                            onPress={() => handleKickMember(selectedMember)}
                            disabled={isAnyActionRunning}
                          >
                            <View style={[styles.actionIconBox, { backgroundColor: 'rgba(239, 68, 68, 0.15)' }]}>
                              {isKicking ? (
                                <ActivityIndicator size="small" color="#EF4444" />
                              ) : (
                                <Ionicons name="person-remove-outline" size={18} color="#EF4444" />
                              )}
                            </View>
                            <View style={{ flex: 1 }}>
                              <ThemedText style={[styles.actionBtnTitle, { color: '#EF4444' }]}>
                                {isKicking ? 'Exiling Member...' : 'Exile Member from Squad'}
                              </ThemedText>
                              <ThemedText style={styles.actionBtnDesc}>
                                {isKicking ? 'Removing from roster...' : 'Remove member and revoke squad membership'}
                              </ThemedText>
                            </View>
                          </AnimatedPressable>
                        )
                      )}
                    </>
                  );
                })()}

                <AnimatedPressable
                  style={[styles.actionCancelBtn, memberActionPhase !== 'idle' && { opacity: 0.4 }]}
                  onPress={() => setIsMemberModalVisible(false)}
                  disabled={memberActionLoading || memberActionPhase !== 'idle'}
                >
                  <ThemedText style={styles.actionCancelBtnText}>Cancel</ThemedText>
                </AnimatedPressable>
              </View>
            </View>
          </Modal>
        )}

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
                      style={[styles.dialogCancelBtn, (actionLoading || isLeaving) && { opacity: 0.5 }]}
                      activeOpacity={0.7}
                      disabled={actionLoading || isLeaving}
                      onPress={() => setCustomDialog(null)}
                    >
                      <ThemedText style={styles.dialogCancelText}>{customDialog.cancelText}</ThemedText>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={[
                      styles.dialogConfirmBtn,
                      customDialog.type === 'danger' && { backgroundColor: '#EF4444' },
                      (actionLoading || isLeaving) && { opacity: 0.85 },
                    ]}
                    activeOpacity={0.85}
                    disabled={actionLoading || isLeaving}
                    onPress={() => {
                      if (customDialog.onConfirm) {
                        customDialog.onConfirm();
                      } else {
                        setCustomDialog(null);
                      }
                    }}
                  >
                    {actionLoading || isLeaving ? (
                      <View style={styles.btnLoadingRow}>
                        <ActivityIndicator
                          size="small"
                          color={customDialog.type === 'danger' ? '#FFFFFF' : '#000000'}
                        />
                        <ThemedText
                          style={[
                            styles.dialogConfirmText,
                            customDialog.type === 'danger' && { color: '#FFFFFF' },
                          ]}
                        >
                          Processing...
                        </ThemedText>
                      </View>
                    ) : (
                      <ThemedText
                        style={[
                          styles.dialogConfirmText,
                          customDialog.type === 'danger' && { color: '#FFFFFF' },
                        ]}
                      >
                        {customDialog.confirmText || 'OK'}
                      </ThemedText>
                    )}
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
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  memberRowSelf: {
    borderColor: '#00E5FF',
    borderWidth: 1.2,
    backgroundColor: 'rgba(0, 229, 255, 0.035)',
  },
  memberRowLeader: {
    borderColor: '#FBBF24',
    borderWidth: 1.2,
    backgroundColor: 'rgba(251, 191, 36, 0.035)',
  },
  memberRowCoLeader: {
    borderColor: '#FB923C',
    borderWidth: 1.2,
    backgroundColor: 'rgba(251, 146, 60, 0.035)',
  },
  memberLeftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    marginRight: 10,
  },
  memberRankIndexBox: {
    width: 18,
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
    fontSize: 13.5,
    fontWeight: '800',
    color: '#FFFFFF',
    flexShrink: 1,
  },
  memberMetaText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94A3B8',
    marginTop: 2,
  },
  youBadge: {
    backgroundColor: 'rgba(0, 229, 255, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.5)',
  },
  youBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#00E5FF',
  },
  leaderBadge: {
    backgroundColor: 'rgba(251, 191, 36, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.5)',
  },
  leaderText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#FBBF24',
  },
  memberRightGroup: {
    flexDirection: 'column',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 5,
    flexShrink: 0,
  },
  streakBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  streakBadgeRelapsed: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderColor: 'rgba(239, 68, 68, 0.25)',
  },
  streakText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  streakTextRelapsed: {
    color: '#EF4444',
  },
  statusActionSlot: {
    alignItems: 'flex-end',
  },
  brotherhoodAlertCard: {
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.35)',
    marginBottom: 14,
    gap: 10,
  },
  brotherhoodAlertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  brotherhoodAlertIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(239, 68, 68, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brotherhoodAlertTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: '#EF4444',
    letterSpacing: 0.8,
  },
  brotherhoodAlertSub: {
    fontSize: 11.5,
    color: 'rgba(255, 255, 255, 0.8)',
    lineHeight: 16,
    marginTop: 2,
  },
  sendStrengthBannerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00E5FF',
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 12,
  },
  sendStrengthBannerBtnText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#000000',
    letterSpacing: 0.3,
  },
  memberRowRelapsed: {
    borderColor: 'rgba(239, 68, 68, 0.35)',
    backgroundColor: 'rgba(239, 68, 68, 0.04)',
  },
  relapsedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.14)',
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.35)',
    gap: 3,
  },
  relapsedText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#EF4444',
  },
  sendStrengthBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#00E5FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 7,
    gap: 3,
  },
  sendStrengthBtnText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#000000',
    letterSpacing: 0.2,
  },
  checkedInPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    gap: 3,
  },
  checkedInText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#10B981',
  },
  pendingSelfPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    gap: 3,
  },
  pendingSelfText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#F59E0B',
  },
  nudgeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    gap: 3,
  },
  nudgeBtnText: {
    fontSize: 10.5,
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
    paddingVertical: 11,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  disbandBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#94A3B8',
  },
  leaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    borderRadius: 14,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1.5,
    borderColor: 'rgba(239, 68, 68, 0.45)',
    marginBottom: 8,
  },
  leaveBtnLoading: {
    borderColor: 'rgba(239, 68, 68, 0.65)',
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
  },
  leaveBtnText: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#EF4444',
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
    borderColor: 'rgba(255, 255, 255, 0.07)',
    marginBottom: 8,
  },
  publicCellCardPending: {
    backgroundColor: 'rgba(245, 158, 11, 0.035)',
    borderColor: 'rgba(245, 158, 11, 0.4)',
    borderWidth: 1.2,
  },
  pendingBadgePill: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.45)',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  pendingBadgePillText: {
    fontSize: 9.5,
    fontWeight: '900',
    color: '#F59E0B',
    letterSpacing: 0.5,
  },
  publicCellHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 6,
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
    borderWidth: 0.5,
    borderColor: 'rgba(245, 158, 11, 0.35)',
  },
  publicStreakText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#F59E0B',
  },
  publicCellFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    gap: 8,
  },
  publicMembersCount: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600',
    flex: 1,
  },
  joinPublicBtn: {
    backgroundColor: 'rgba(0, 229, 255, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.4)',
    paddingHorizontal: 12,
    paddingVertical: 6.5,
    borderRadius: 8,
  },
  joinPublicBtnLoading: {
    backgroundColor: 'rgba(0, 229, 255, 0.25)',
    borderColor: 'rgba(0, 229, 255, 0.65)',
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
  submitModalBtnLoading: {
    opacity: 0.85,
  },
  btnLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
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
  /* ── JOIN PETITIONS REVIEW SECTION ── */
  requestsSection: {
    backgroundColor: '#09101E',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1.2,
    borderColor: 'rgba(0, 229, 255, 0.35)',
    marginBottom: 16,
    shadowColor: '#00E5FF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  requestsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  requestsHeaderTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  requestsBadgeCount: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#00E5FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  requestsBadgeCountText: {
    fontSize: 11.5,
    fontWeight: '900',
    color: '#000000',
  },
  requestsSectionTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.8,
  },
  verificationTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(0, 229, 255, 0.08)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: 'rgba(0, 229, 255, 0.25)',
  },
  verificationDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#00E5FF',
  },
  requestsSubtitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#00E5FF',
    letterSpacing: 0.3,
  },
  requestsList: {
    gap: 8,
  },
  requestCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.035)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 14,
    padding: 12,
  },
  requestLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    marginRight: 10,
  },
  requestAvatarBox: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  requestAvatarEmoji: {
    fontSize: 18,
  },
  requestInfo: {
    flex: 1,
  },
  requestName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  requestDetailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  requestStreak: {
    fontSize: 11,
    fontWeight: '800',
    color: '#00E5FF',
  },
  requestRankTier: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94A3B8',
  },
  requestActionsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rejectReqBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  approveReqBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#10B981',
    borderWidth: 1,
    borderColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 3,
  },
  reqBtnLoading: {
    opacity: 0.6,
  },
  /* ── CO-LEADER & MEMBER MODERATION ── */
  coLeaderBadge: {
    backgroundColor: 'rgba(251, 146, 60, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: 'rgba(251, 146, 60, 0.5)',
  },
  coLeaderText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#FB923C',
  },
  memberRightWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  memberManageBtn: {
    width: 32,
    height: 36,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  /* ── PENDING REQUEST BUTTON ── */
  pendingRequestBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.45)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  pendingRequestBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#F59E0B',
  },
  /* ── MEMBER ACTION MODAL ── */
  memberActionCard: {
    width: '100%',
    backgroundColor: '#0C1220',
    borderRadius: 22,
    padding: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(0, 229, 255, 0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.6,
    shadowRadius: 18,
    elevation: 12,
  },
  memberActionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  memberActionAvatarBox: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 229, 255, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberActionName: {
    fontSize: 16,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  memberActionSub: {
    fontSize: 12,
    fontWeight: '600',
    color: '#CBD5E1',
    marginTop: 2,
  },
  memberActionDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 14,
  },
  actionRowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 10,
  },
  actionRowBtnDanger: {
    backgroundColor: 'rgba(239, 68, 68, 0.06)',
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  actionRowBtnActiveCyan: {
    backgroundColor: 'rgba(0, 229, 255, 0.08)',
    borderColor: '#00E5FF',
  },
  actionRowBtnSuccessCyan: {
    backgroundColor: 'rgba(0, 229, 255, 0.18)',
    borderColor: '#00E5FF',
  },
  actionRowBtnActiveAmber: {
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
    borderColor: '#F59E0B',
  },
  actionRowBtnSuccessAmber: {
    backgroundColor: 'rgba(245, 158, 11, 0.18)',
    borderColor: '#F59E0B',
  },
  actionRowBtnActiveRed: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderColor: '#EF4444',
  },
  actionRowBtnSuccessRed: {
    backgroundColor: 'rgba(239, 68, 68, 0.22)',
    borderColor: '#EF4444',
  },
  actionIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnTitle: {
    fontSize: 13.5,
    fontWeight: '800',
  },
  actionBtnDesc: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 1,
  },
  actionCancelBtn: {
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    marginTop: 4,
  },
  actionCancelBtnText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#94A3B8',
  },
});
