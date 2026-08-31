import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
  Platform,
  Share,
  Dimensions,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path, Circle, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { ThemedText } from '../../components/themed-text';
import { useSpartanStore } from '../../store/spartan-store';
import { useAuthStore } from '../../store/auth-store';
import { CellMemberItem, SpartanCellData } from '../../services/spartan-api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const MOTTO_PRESETS = [
  'We hold the line together.',
  'Iron will, sovereign mind.',
  'Brotherhood over impulse.',
  'Unconquered in the storm.',
  'Transmute desire into power.',
];

// Vector Spartan Shield Graphic (Cross-platform consistent, never clipped)
const SpartanShieldVector = ({ size = 64, color = '#00E5FF' }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 64 64" fill="none">
    <Defs>
      <SvgLinearGradient id="shieldGrad" x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0%" stopColor={color} stopOpacity="0.3" />
        <Stop offset="100%" stopColor={color} stopOpacity="0.05" />
      </SvgLinearGradient>
      <SvgLinearGradient id="goldGrad" x1="0" y1="0" x2="1" y2="1">
        <Stop offset="0%" stopColor="#F59E0B" />
        <Stop offset="100%" stopColor="#D97706" />
      </SvgLinearGradient>
    </Defs>
    {/* Shield Outer Rim */}
    <Path
      d="M32 4L10 14V30C10 44.5 19.5 56 32 60C44.5 56 54 44.5 54 30V14L32 4Z"
      fill="url(#shieldGrad)"
      stroke={color}
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* Inner Spartan Lambda / Chevron */}
    <Path
      d="M23 40L32 20L41 40"
      stroke={color}
      strokeWidth="3.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path
      d="M26 34H38"
      stroke={color}
      strokeWidth="2.5"
      strokeLinecap="round"
    />
  </Svg>
);

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
        title: 'Invalid Squad Name',
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
        title: 'Spartan Cell Established',
        message: 'Your squad has been created. Share your join code with fellow warriors to start building your collective shield!',
        type: 'success',
        confirmText: 'Enter Shield Wall',
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
    const code = codeToJoin || joinCodeInput;
    if (!code || code.trim().length < 4) {
      setCustomDialog({
        visible: true,
        title: 'Invalid Code',
        message: 'Please enter a valid Spartan Cell join code.',
        type: 'info',
        confirmText: 'Understood',
      });
      return;
    }
    triggerHaptic('medium');
    setActionLoading(true);
    try {
      await joinCell(code.trim());
      setIsJoinModalVisible(false);
      setJoinCodeInput('');
      setCustomDialog({
        visible: true,
        title: 'Shield Wall Joined',
        message: 'You are now an active warrior of this Spartan Cell! Your daily streak now reinforces your brothers.',
        type: 'success',
        confirmText: 'Stand with Squad',
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
      title: 'Depart Spartan Cell',
      message: 'Are you sure you want to leave your squad? Your streak will no longer contribute to the collective total.',
      type: 'danger',
      confirmText: 'Depart',
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
      title: 'Disband Spartan Cell',
      message: 'As Commander, permanently disbanding this cell will delete it from the leaderboard and release all 20 member slots. This action cannot be undone.',
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
            message: 'The Spartan Cell has been dissolved.',
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
    try {
      const msg = await nudgeMember(member.user_id, member.name);
      setNudgeNotice(msg);
      setTimeout(() => setNudgeNotice(null), 4000);
    } catch {
      Alert.alert('Nudge Notice', `Nudge sent to Brother ${member.name}!`);
    }
  };

  const handleShareCode = async () => {
    if (!myCell?.join_code) return;
    triggerHaptic('light');
    try {
      await Share.share({
        message: `🛡️ Join my Spartan Cell "${myCell.name}" on ZenWill! Collective streak: ${myCell.total_streak} days. Join code: ${myCell.join_code}`,
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
              router.back();
            }}
          >
            <Ionicons name="chevron-back" size={22} color="#00E5FF" />
          </TouchableOpacity>

          <View style={styles.headerTitleGroup}>
            <ThemedText style={styles.headerCategory}>SQUAD ACCOUNTABILITY</ThemedText>
            <ThemedText style={styles.headerTitle}>Spartan Cell Hub</ThemedText>
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

        {isLoadingCell ? (
          <View style={styles.centerLoading}>
            <ActivityIndicator size="large" color="#00E5FF" />
            <ThemedText style={styles.loadingText}>Syncing Spartan Squad Matrix...</ThemedText>
          </View>
        ) : myCell ? (
          /* ── ACTIVE SPARTAN CELL VIEW ── */
          <ScrollView
            style={styles.scrollContent}
            contentContainerStyle={styles.scrollInner}
            showsVerticalScrollIndicator={false}
          >
            {/* Cell Banner Card */}
            <View style={styles.cellHeroCard}>
              <View style={styles.cellHeroHeader}>
                <View style={styles.cellBadgeIcon}>
                  <SpartanShieldVector size={36} color="#00E5FF" />
                </View>
                <View style={styles.cellNameGroup}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <ThemedText style={styles.cellNameText}>{myCell.name}</ThemedText>
                    {isLeader && (
                      <View style={styles.commanderBadge}>
                        <ThemedText style={styles.commanderBadgeText}>COMMANDER</ThemedText>
                      </View>
                    )}
                  </View>
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
                  <ThemedText style={styles.shareCodeText}>Invite Brother</ThemedText>
                </View>
              </TouchableOpacity>
            </View>

            {/* Total Collective Streak & Squad Stats */}
            <View style={styles.statsRow}>
              <View style={styles.mainStreakCard}>
                <View style={styles.streakIconRow}>
                  <ThemedText style={styles.fireEmoji}>🔥</ThemedText>
                  <ThemedText style={styles.collectiveStreakNumber}>{myCell.total_streak}</ThemedText>
                </View>
                <ThemedText style={styles.streakCardTitle}>COLLECTIVE CELL STREAK</ThemedText>
                <ThemedText style={styles.streakCardSub}>
                  Combined clean days of all {myCell.member_count} warriors. Drops if any brother relapses.
                </ThemedText>
              </View>

              <View style={styles.sideStatsCol}>
                <View style={styles.smallStatCard}>
                  <ThemedText style={styles.smallStatValue}>{myCell.member_count}/{myCell.max_members}</ThemedText>
                  <ThemedText style={styles.smallStatLabel}>WARRIORS</ThemedText>
                </View>
                <View style={styles.smallStatCard}>
                  <ThemedText style={[styles.smallStatValue, { color: '#F59E0B' }]}>{myCell.collective_xp} XP</ThemedText>
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
                  name={isGoldShield ? 'shield-checkmark' : isCrackedShield ? 'warning-outline' : 'shield'}
                  size={24}
                  color={isGoldShield ? '#F59E0B' : isCrackedShield ? '#EF4444' : '#00E5FF'}
                />
                <View style={styles.shieldTitleWrapper}>
                  <ThemedText style={[
                    styles.shieldTitleText,
                    { color: isGoldShield ? '#F59E0B' : isCrackedShield ? '#EF4444' : '#00E5FF' }
                  ]}>
                    {isGoldShield ? 'GOLD SHIELD ACTIVE (+20% XP)' : isCrackedShield ? 'SHIELD CRACKED (ACTION NEEDED)' : 'SHIELD DEFENSE ACTIVE'}
                  </ThemedText>
                  <ThemedText style={styles.shieldSubText}>
                    {isGoldShield
                      ? '100% of warriors checked in today! 20% XP boost active for the entire squad.'
                      : isCrackedShield
                      ? 'One or more brothers have not checked in. Nudge them to secure the squad Gold Shield.'
                      : 'Keep daily check-ins consistent to unlock the Gold Shield before midnight.'}
                  </ThemedText>
                </View>
              </View>
            </View>

            {/* Nudge Notification Notice */}
            {nudgeNotice && (
              <View style={styles.nudgeNoticeBox}>
                <Ionicons name="checkmark-circle" size={15} color="#10B981" />
                <ThemedText style={styles.nudgeNoticeText}>{nudgeNotice}</ThemedText>
              </View>
            )}

            {/* Warrior Roster Strip (Up to 20 Members) */}
            <View style={styles.rosterSection}>
              <View style={styles.rosterHeaderRow}>
                <ThemedText style={styles.rosterTitle}>
                  WARRIOR ROSTER ({myCell.members?.length || 0}/{myCell.max_members})
                </ThemedText>
                <ThemedText style={styles.rosterSortLabel}>Ranked by Streak</ThemedText>
              </View>

              <View style={styles.rosterList}>
                {myCell.members?.map((member, index) => {
                  const isCurrentUser = member.user_id === String(user?.id || '');
                  return (
                    <View
                      key={`${member.user_id}-${index}`}
                      style={[styles.memberRow, isCurrentUser && styles.memberRowSelf]}
                    >
                      <View style={styles.memberLeftGroup}>
                        <View style={styles.memberBadgeBox}>
                          <ThemedText style={styles.memberBadgeEmoji}>{member.badge || '🥉'}</ThemedText>
                        </View>
                        <View style={styles.memberInfoCol}>
                          <View style={styles.memberNameRow}>
                            <ThemedText style={styles.memberNameText} numberOfLines={1}>
                              {member.name} {isCurrentUser && '(You)'}
                            </ThemedText>
                            {member.is_leader && (
                              <View style={styles.leaderPill}>
                                <ThemedText style={styles.leaderPillText}>LEADER</ThemedText>
                              </View>
                            )}
                          </View>
                          <ThemedText style={styles.memberTierText}>{member.rank_tier}</ThemedText>
                        </View>
                      </View>

                      <View style={styles.memberRightGroup}>
                        <View style={styles.streakBadge}>
                          <ThemedText style={styles.streakText}>🔥 {member.streak}d</ThemedText>
                        </View>

                        {member.today_checked_in ? (
                          <View style={styles.checkedInPill}>
                            <Ionicons name="checkmark" size={12} color="#10B981" />
                            <ThemedText style={styles.checkedInText}>Done</ThemedText>
                          </View>
                        ) : (
                          <TouchableOpacity
                            style={styles.nudgeBtn}
                            activeOpacity={0.7}
                            onPress={() => handleNudge(member)}
                            disabled={isNudging}
                          >
                            <Ionicons name="hand-right-outline" size={12} color="#EF4444" />
                            <ThemedText style={styles.nudgeBtnText}>Nudge</ThemedText>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
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
                  <ThemedText style={styles.disbandBtnText}>Disband Spartan Cell (Commander)</ThemedText>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={styles.leaveBtn}
                  activeOpacity={0.7}
                  onPress={handleLeaveCell}
                  disabled={actionLoading}
                >
                  <Ionicons name="exit-outline" size={15} color="#94A3B8" style={{ marginRight: 6 }} />
                  <ThemedText style={styles.leaveBtnText}>Depart Spartan Cell</ThemedText>
                </TouchableOpacity>
              )}
            </View>

            <View style={{ height: 40 }} />
          </ScrollView>
        ) : (
          /* ── UNAFFILIATED: EPIC SPARTAN CELL ESTABLISHMENT VIEW ── */
          <ScrollView
            style={styles.scrollContent}
            contentContainerStyle={styles.scrollInner}
            showsVerticalScrollIndicator={false}
          >
            {/* Ultra-Polished Holographic Crest Hero */}
            <View style={styles.unaffiliatedHero}>
              {/* Outer Glowing Radial Aura */}
              <View style={styles.crestAura}>
                <View style={styles.shieldGlowCircle}>
                  <SpartanShieldVector size={58} color="#00E5FF" />
                </View>
              </View>

              <ThemedText style={styles.unaffiliatedCategory}>SQUAD SHARED STAKES</ThemedText>
              <ThemedText style={styles.unaffiliatedTitle}>5–20 Man Spartan Cells</ThemedText>
              <ThemedText style={styles.unaffiliatedBody}>
                Solitary battles fail in secrecy. In a Spartan Cell, individual streaks are pooled into a collective squad shield. If 100% of brothers check in daily, your squad unlocks the Gold Shield (+20% XP boost).
              </ThemedText>

              {/* Value Pillar Badges */}
              <View style={styles.pillarRow}>
                <View style={styles.pillarBadge}>
                  <Ionicons name="flash" size={13} color="#F59E0B" />
                  <ThemedText style={styles.pillarText}>Pooled Streak</ThemedText>
                </View>
                <View style={styles.pillarBadge}>
                  <Ionicons name="shield-checkmark" size={13} color="#00E5FF" />
                  <ThemedText style={styles.pillarText}>Gold Shield</ThemedText>
                </View>
                <View style={styles.pillarBadge}>
                  <Ionicons name="people" size={13} color="#10B981" />
                  <ThemedText style={styles.pillarText}>20 Warriors</ThemedText>
                </View>
              </View>

              {/* Hero Action Buttons */}
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
                  <ThemedText style={styles.createCellBtnText}>Establish New Cell</ThemedText>
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
                <ThemedText style={styles.publicSectionTitle}>OPEN SPARTAN CELLS RECRUITING</ThemedText>
              </View>

              {publicCells.length === 0 ? (
                <View style={styles.emptyPublicCard}>
                  <Ionicons name="shield-outline" size={32} color="#334155" style={{ marginBottom: 8 }} />
                  <ThemedText style={styles.emptyPublicText}>
                    No open cells looking for warriors right now. Be the Commander to establish a new cell!
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
                        {cell.member_count}/{cell.max_members} Warriors • Commander: {cell.leader_name}
                      </ThemedText>

                      <TouchableOpacity
                        style={styles.joinPublicBtn}
                        activeOpacity={0.8}
                        onPress={() => handleJoinCell(cell.join_code)}
                        disabled={actionLoading}
                      >
                        <ThemedText style={styles.joinPublicBtnText}>Join Cell</ThemedText>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              )}
            </View>

            <View style={{ height: 40 }} />
          </ScrollView>
        )}

        {/* Modal: Establish Spartan Cell */}
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
                  <SpartanShieldVector size={26} color="#00E5FF" />
                  <ThemedText style={styles.modalTitle}>Establish Spartan Cell</ThemedText>
                </View>
                <TouchableOpacity onPress={() => setIsCreateModalVisible(false)} style={styles.modalCloseBtn}>
                  <Ionicons name="close" size={20} color="#94A3B8" />
                </TouchableOpacity>
              </View>

              <ThemedText style={styles.inputLabel}>SQUAD NAME</ThemedText>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. Iron Phalanx, Ojas Vanguard"
                placeholderTextColor="#64748B"
                value={newCellName}
                onChangeText={setNewCellName}
                maxLength={40}
              />

              <ThemedText style={styles.inputLabel}>CHOOSE BATTLE MOTTO</ThemedText>
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
                  <ThemedText style={styles.submitModalBtnText}>Establish & Become Commander</ThemedText>
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
                  <ThemedText style={styles.modalTitle}>Join Spartan Cell</ThemedText>
                </View>
                <TouchableOpacity onPress={() => setIsJoinModalVisible(false)} style={styles.modalCloseBtn}>
                  <Ionicons name="close" size={20} color="#94A3B8" />
                </TouchableOpacity>
              </View>

              <ThemedText style={styles.inputLabel}>ENTER SQUAD JOIN CODE</ThemedText>
              <TextInput
                style={[styles.textInput, styles.joinCodeInput]}
                placeholder="SP-XXXX"
                placeholderTextColor="#64748B"
                value={joinCodeInput}
                onChangeText={setJoinCodeInput}
                autoCapitalize="characters"
                maxLength={10}
              />

              <TouchableOpacity
                style={styles.submitModalBtn}
                activeOpacity={0.85}
                onPress={() => handleJoinCell()}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <ActivityIndicator color="#00E5FF" />
                ) : (
                  <ThemedText style={styles.submitModalBtnText}>Join Shield Wall</ThemedText>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Custom Glassmorphic Dark Dialog (Replaces white system Alert) */}
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
  headerCategory: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#00E5FF',
    letterSpacing: 1,
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
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(0, 229, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
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
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
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
    padding: 10,
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
  },
  memberBadgeBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberBadgeEmoji: {
    fontSize: 16,
  },
  memberInfoCol: {
    flex: 1,
  },
  memberNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  memberNameText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  leaderPill: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
    borderWidth: 0.5,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  leaderPillText: {
    fontSize: 8.5,
    fontWeight: '900',
    color: '#F59E0B',
    letterSpacing: 0.5,
  },
  memberTierText: {
    fontSize: 10.5,
    color: '#94A3B8',
    marginTop: 1,
  },
  memberRightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  streakBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  streakText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  checkedInPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 3,
  },
  checkedInText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#10B981',
  },
  nudgeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.35)',
    paddingHorizontal: 8,
    paddingVertical: 4,
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
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(0, 229, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.15)',
  },
  shieldGlowCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
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
    fontSize: 19,
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
  pillarRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 18,
  },
  pillarBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    gap: 4,
  },
  pillarText: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.85)',
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
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyPublicText: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 17,
    maxWidth: '85%',
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
  joinCodeInput: {
    textTransform: 'uppercase',
    letterSpacing: 3,
    fontSize: 20,
    textAlign: 'center',
    fontWeight: '900',
    color: '#00E5FF',
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
