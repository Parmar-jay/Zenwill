import React, { useState, useEffect, useCallback } from 'react';
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
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { ThemedText } from '../../components/themed-text';
import { useSpartanStore } from '../../store/spartan-store';
import { useAuthStore } from '../../store/auth-store';
import { CellMemberItem, SpartanCellData } from '../../services/spartan-api';

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
    nudgeMember,
  } = useSpartanStore();

  const [isCreateModalVisible, setIsCreateModalVisible] = useState<boolean>(false);
  const [isJoinModalVisible, setIsJoinModalVisible] = useState<boolean>(false);
  const [newCellName, setNewCellName] = useState<string>('');
  const [newCellMotto, setNewCellMotto] = useState<string>('We hold the line together.');
  const [joinCodeInput, setJoinCodeInput] = useState<string>('');
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [nudgeNotice, setNudgeNotice] = useState<string | null>(null);

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

  const handleCreateCell = async () => {
    if (!newCellName.trim() || newCellName.trim().length < 3) {
      Alert.alert('Invalid Name', 'Cell name must be at least 3 characters.');
      return;
    }
    triggerHaptic('medium');
    setActionLoading(true);
    try {
      await createCell(newCellName.trim(), newCellMotto.trim());
      setIsCreateModalVisible(false);
      setNewCellName('');
      Alert.alert('Spartan Cell Established', 'Your squad has been created. Share your join code with fellow warriors!');
    } catch (err: any) {
      Alert.alert('Creation Failed', err?.response?.data?.detail || 'Could not establish cell.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleJoinCell = async (codeToJoin?: string) => {
    const code = codeToJoin || joinCodeInput;
    if (!code || code.trim().length < 4) {
      Alert.alert('Invalid Code', 'Please enter a valid Spartan Cell join code.');
      return;
    }
    triggerHaptic('medium');
    setActionLoading(true);
    try {
      await joinCell(code.trim());
      setIsJoinModalVisible(false);
      setJoinCodeInput('');
      Alert.alert('Shield Wall Joined', 'You are now an active warrior of this Spartan Cell!');
    } catch (err: any) {
      Alert.alert('Join Failed', err?.response?.data?.detail || 'Invalid cell code.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleLeaveCell = () => {
    Alert.alert(
      'Depart Spartan Cell',
      'Are you sure you want to leave your squad? Your streak will no longer contribute to the collective total.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            triggerHaptic('heavy');
            setActionLoading(true);
            try {
              await leaveCell();
              await fetchPublicCells();
            } catch (err: any) {
              Alert.alert('Error', 'Could not depart cell.');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
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
                  <ThemedText style={styles.cellBadgeEmoji}>🛡️</ThemedText>
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

            {/* Depart Spartan Cell */}
            <TouchableOpacity
              style={styles.leaveBtn}
              activeOpacity={0.7}
              onPress={handleLeaveCell}
              disabled={actionLoading}
            >
              <Ionicons name="exit-outline" size={15} color="#94A3B8" style={{ marginRight: 6 }} />
              <ThemedText style={styles.leaveBtnText}>Depart Spartan Cell</ThemedText>
            </TouchableOpacity>

            <View style={{ height: 40 }} />
          </ScrollView>
        ) : (
          /* ── UNAFFILIATED: CREATE OR JOIN A CELL ── */
          <ScrollView
            style={styles.scrollContent}
            contentContainerStyle={styles.scrollInner}
            showsVerticalScrollIndicator={false}
          >
            {/* Intro Hero Card */}
            <View style={styles.unaffiliatedHero}>
              <View style={styles.shieldBigIcon}>
                <ThemedText style={{ fontSize: 44 }}>🛡️</ThemedText>
              </View>
              <ThemedText style={styles.unaffiliatedTitle}>JOIN A 5-20 MAN SPARTAN CELL</ThemedText>
              <ThemedText style={styles.unaffiliatedBody}>
                Solitary battles fail in secrecy. In a Spartan Cell, your streak is pooled with your brothers. If 100% of warriors check in daily, your squad earns the Gold Shield (+20% XP boost).
              </ThemedText>

              {/* Action Buttons */}
              <View style={styles.heroActionRow}>
                <TouchableOpacity
                  style={styles.createCellBtn}
                  activeOpacity={0.8}
                  onPress={() => {
                    triggerHaptic('medium');
                    setIsCreateModalVisible(true);
                  }}
                >
                  <Ionicons name="add-circle" size={18} color="#000000" style={{ marginRight: 6 }} />
                  <ThemedText style={styles.createCellBtnText}>Create New Cell</ThemedText>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.joinWithCodeBtn}
                  activeOpacity={0.8}
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
              <ThemedText style={styles.publicSectionTitle}>OPEN SPARTAN CELLS RECRUITING</ThemedText>

              {publicCells.length === 0 ? (
                <View style={styles.emptyPublicCard}>
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
                        {cell.member_count}/{cell.max_members} Warriors
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

        {/* Modal: Create Cell */}
        <Modal
          visible={isCreateModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setIsCreateModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeaderRow}>
                <ThemedText style={styles.modalTitle}>Establish Spartan Cell</ThemedText>
                <TouchableOpacity onPress={() => setIsCreateModalVisible(false)}>
                  <Ionicons name="close" size={22} color="#94A3B8" />
                </TouchableOpacity>
              </View>

              <ThemedText style={styles.inputLabel}>CELL NAME</ThemedText>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. Iron Phalanx, Ojas Vanguard"
                placeholderTextColor="#64748B"
                value={newCellName}
                onChangeText={setNewCellName}
                maxLength={40}
              />

              <ThemedText style={styles.inputLabel}>BATTLE MOTTO</ThemedText>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. We hold the line together."
                placeholderTextColor="#64748B"
                value={newCellMotto}
                onChangeText={setNewCellMotto}
                maxLength={80}
              />

              <TouchableOpacity
                style={styles.submitModalBtn}
                activeOpacity={0.85}
                onPress={handleCreateCell}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <ActivityIndicator color="#000000" />
                ) : (
                  <ThemedText style={styles.submitModalBtnText}>Establish Cell</ThemedText>
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
                <ThemedText style={styles.modalTitle}>Join Spartan Cell</ThemedText>
                <TouchableOpacity onPress={() => setIsJoinModalVisible(false)}>
                  <Ionicons name="close" size={22} color="#94A3B8" />
                </TouchableOpacity>
              </View>

              <ThemedText style={styles.inputLabel}>ENTER SQUAD JOIN CODE</ThemedText>
              <TextInput
                style={[styles.textInput, { textTransform: 'uppercase', letterSpacing: 2, fontSize: 18, textAlign: 'center' }]}
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
                  <ActivityIndicator color="#000000" />
                ) : (
                  <ThemedText style={styles.submitModalBtnText}>Join Shield Wall</ThemedText>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
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
    backgroundColor: 'rgba(0, 229, 255, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellBadgeEmoji: {
    fontSize: 22,
  },
  cellNameGroup: {
    flex: 1,
  },
  cellNameText: {
    fontSize: 17,
    fontWeight: '900',
    color: '#FFFFFF',
    marginBottom: 2,
    letterSpacing: -0.3,
  },
  cellMottoText: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '500',
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
  leaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
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
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.2)',
    marginBottom: 18,
  },
  shieldBigIcon: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 229, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  unaffiliatedTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.5,
    marginBottom: 8,
    textAlign: 'center',
  },
  unaffiliatedBody: {
    fontSize: 12.5,
    color: 'rgba(255, 255, 255, 0.65)',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 18,
  },
  heroActionRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  createCellBtn: {
    flex: 1.2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00E5FF',
    paddingVertical: 12,
    borderRadius: 12,
  },
  createCellBtnText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#000000',
  },
  joinWithCodeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 229, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.3)',
    paddingVertical: 12,
    borderRadius: 12,
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
  publicSectionTitle: {
    fontSize: 10.5,
    fontWeight: '900',
    color: 'rgba(255, 255, 255, 0.5)',
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  emptyPublicCard: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  emptyPublicText: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
  },
  publicCellCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.025)',
    borderRadius: 14,
    padding: 12,
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
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  publicCellMotto: {
    fontSize: 11,
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
    paddingVertical: 5,
    borderRadius: 8,
  },
  joinPublicBtnText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#00E5FF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  modalCard: {
    width: '100%',
    backgroundColor: '#0F172A',
    borderRadius: 20,
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
    fontSize: 17,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  inputLabel: {
    fontSize: 10.5,
    fontWeight: '800',
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
  submitModalBtn: {
    backgroundColor: '#00E5FF',
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  submitModalBtnText: {
    fontSize: 13.5,
    fontWeight: '900',
    color: '#000000',
    letterSpacing: 0.3,
  },
});
