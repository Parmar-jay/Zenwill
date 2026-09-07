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
  UIManager,
  RefreshControl,
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

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const MOTTO_PRESETS = [
  'We hold the line together.',
  'Iron will, sovereign mind.',
  'Brotherhood over impulse.',
  'Unconquered in the storm.',
  'Transmute desire into power.',
];

export default function SpartanSquadIndexScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const {
    myCell,
    publicCells,
    myPendingRequests,
    isLoadingCell,
    hasLoadedInitialCell,
    fetchMyCell,
    fetchPublicCells,
    fetchMyJoinRequests,
    createCell,
    joinCell,
    requestJoinCell,
    cancelJoinRequest,
  } = useSpartanStore();

  const [isCreateModalVisible, setIsCreateModalVisible] = useState<boolean>(false);
  const [isJoinModalVisible, setIsJoinModalVisible] = useState<boolean>(false);
  const [newCellName, setNewCellName] = useState<string>('');
  const [newCellMotto, setNewCellMotto] = useState<string>(MOTTO_PRESETS[0]);
  const [joinCodeInput, setJoinCodeInput] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [joiningCode, setJoiningCode] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState<boolean>(false);

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
  const joiningCodeRef = useRef(joiningCode);
  joiningCodeRef.current = joiningCode;

  const triggerHaptic = useCallback((style: 'light' | 'medium' | 'heavy' = 'light') => {
    try {
      if (Platform.OS !== 'web') {
        if (style === 'heavy') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        else if (style === 'medium') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        else Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch {}
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
      loadData(false);
      const fastSyncTimer = setInterval(() => {
        if (!actionLoadingRef.current && !joiningCodeRef.current) {
          fetchMyCell({ showLoading: false }).catch(() => {});
          fetchPublicCells().catch(() => {});
          fetchMyJoinRequests().catch(() => {});
        }
      }, 3500);

      return () => {
        clearInterval(fastSyncTimer);
      };
    }, [loadData, fetchMyCell, fetchPublicCells, fetchMyJoinRequests])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    triggerHaptic('light');
    await loadData(false);
    setRefreshing(false);
  }, [loadData, triggerHaptic]);

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
      router.replace('/spartan-squad/cell' as any);
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

  const handleRequestJoin = async (codeToJoin?: string) => {
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
    setJoiningCode(cleanCode);
    try {
      await requestJoinCell(cleanCode);
      setIsJoinModalVisible(false);
      setJoinCodeInput('');
      fetchMyJoinRequests().catch(() => {});
      fetchPublicCells().catch(() => {});
    } catch (err: any) {
      setCustomDialog({
        visible: true,
        title: 'Request Failed',
        message: err?.response?.data?.detail || err?.detail || 'Could not send join petition.',
        type: 'danger',
        confirmText: 'Dismiss',
      });
    } finally {
      setActionLoading(false);
      setJoiningCode(null);
    }
  };

  const handleCancelJoinRequest = (cellCodeOrId: string) => {
    triggerHaptic('medium');
    setActionLoading(true);
    cancelJoinRequest(cellCodeOrId)
      .catch(() => {})
      .finally(() => {
        setActionLoading(false);
      });
  };

  // If user is currently enrolled in a squad, seamlessly navigate to dedicated Squad dashboard
  useEffect(() => {
    if (myCell && hasLoadedInitialCell) {
      router.replace('/spartan-squad/cell' as any);
    }
  }, [myCell, hasLoadedInitialCell]);

  if (myCell) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.centerLoading}>
          <ActivityIndicator size="large" color="#00E5FF" />
          <ThemedText style={styles.loadingText}>Opening Squad Dashboard...</ThemedText>
        </View>
      </SafeAreaView>
    );
  }

  // Filtered public squads based on search query
  const filteredCells = (publicCells || []).filter((c) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.trim().toLowerCase();
    return (
      (c.name && c.name.toLowerCase().includes(q)) ||
      (c.join_code && c.join_code.toLowerCase().includes(q)) ||
      (c.leader_name && c.leader_name.toLowerCase().includes(q)) ||
      (c.motto && c.motto.toLowerCase().includes(q))
    );
  });

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.topHeader}>
        <TouchableOpacity
          style={styles.headerBackBtn}
          activeOpacity={0.7}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
        </TouchableOpacity>

        <View style={styles.headerTitleGroup}>
          <ThemedText style={styles.headerTitleText}>Spartan Squads</ThemedText>
          <ThemedText style={styles.headerSubtitleText}>Accountability & Shared Stakes</ThemedText>
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

      {isLoadingCell && !hasLoadedInitialCell ? (
        <View style={styles.centerLoading}>
          <ActivityIndicator size="large" color="#00E5FF" />
          <ThemedText style={styles.loadingText}>Syncing Spartan Squad Matrix...</ThemedText>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollContent}
          contentContainerStyle={styles.scrollInner}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#00E5FF"
              colors={['#00E5FF']}
            />
          }
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

          {/* Search Bar */}
          <View style={styles.searchBarBox}>
            <Ionicons name="search" size={16} color="#64748B" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search squads by name or join code..."
              placeholderTextColor="#64748B"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={16} color="#64748B" />
              </TouchableOpacity>
            )}
          </View>

          {/* Public Open Cells List */}
          <View style={styles.publicSection}>
            <View style={styles.publicHeaderRow}>
              <Ionicons name="globe-outline" size={14} color="#00E5FF" />
              <ThemedText style={styles.publicSectionTitle}>
                OPEN SQUADS RECRUITING ({filteredCells.length})
              </ThemedText>
            </View>

            {filteredCells.length === 0 ? (
              <View style={styles.emptyPublicCard}>
                <View style={styles.emptyIconCircle}>
                  <Ionicons name="shield-outline" size={24} color="#64748B" />
                </View>
                <ThemedText style={styles.emptyPublicTitle}>
                  {searchQuery ? 'No Matching Squads Found' : 'No Open Squads Active'}
                </ThemedText>
                <ThemedText style={styles.emptyPublicText}>
                  {searchQuery
                    ? 'Try searching with a different squad name or enter their exact join code.'
                    : 'Establish a new accountability squad to lead fellow members and climb the global ranks.'}
                </ThemedText>
              </View>
            ) : (
              filteredCells.map((cell) => {
                const isUserInCellRequests = (cell.join_requests || []).some((req: any) => {
                  const reqUid = String(req.user_id || '').trim().toLowerCase();
                  const reqEmail = String(req.user_email || req.email || '').trim().toLowerCase();
                  const currentUid = String(user?.id || '').trim().toLowerCase();
                  const currentEmail = String(user?.email || '').trim().toLowerCase();
                  return (currentUid && reqUid === currentUid) || (currentEmail && reqEmail === currentEmail);
                });

                const isPending =
                  isUserInCellRequests ||
                  myPendingRequests.some((key) => {
                    const k = String(key || '').trim().toLowerCase();
                    const cellId = String(cell.id || '').trim().toLowerCase();
                    const cellCode = String(cell.join_code || '').trim().toLowerCase();
                    const pureCode = cellCode.replace('sp-', '').replace('sp ', '').replace('sp', '').trim();
                    return (
                      k === cellId ||
                      k === cellCode ||
                      k === pureCode ||
                      k === `sp-${pureCode}` ||
                      k === `sp ${pureCode}` ||
                      (pureCode && (k === pureCode || k.includes(pureCode)))
                    );
                  });

                const isJoiningThis = joiningCode === cell.join_code;
                return (
                  <View key={cell.id} style={[styles.publicCellCard, isPending && styles.publicCellCardPending]}>
                    <View style={styles.publicCellHeader}>
                      <View style={{ flex: 1, marginRight: 10 }}>
                        <ThemedText style={styles.publicCellName} numberOfLines={1}>
                          {cell.name}
                        </ThemedText>
                        <ThemedText style={styles.publicCellMotto} numberOfLines={2}>
                          {cell.motto}
                        </ThemedText>
                      </View>
                      <View style={styles.publicStreakBadge}>
                        <ThemedText style={styles.publicStreakText}>🔥 {cell.total_streak}d</ThemedText>
                      </View>
                    </View>

                    <View style={styles.publicCellFooter}>
                      <ThemedText style={styles.publicMembersCount} numberOfLines={1}>
                        {cell.member_count}/{cell.max_members || 20} Members • Commander {cell.leader_name}
                      </ThemedText>

                      {isPending ? (
                        <TouchableOpacity
                          style={styles.pendingRequestBtn}
                          activeOpacity={0.8}
                          onPress={() => handleCancelJoinRequest(cell.join_code || cell.id)}
                          disabled={actionLoading}
                        >
                          <Ionicons name="time-outline" size={13} color="#F59E0B" />
                          <ThemedText style={styles.pendingRequestBtnText}>Pending Approval ⏳</ThemedText>
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity
                          style={[
                            styles.joinPublicBtn,
                            isJoiningThis && styles.joinPublicBtnLoading,
                          ]}
                          activeOpacity={0.8}
                          onPress={() => handleRequestJoin(cell.join_code)}
                          disabled={actionLoading || !!joiningCode}
                        >
                          {isJoiningThis ? (
                            <View style={styles.btnLoadingRow}>
                              <ActivityIndicator size="small" color="#00E5FF" />
                              <ThemedText style={styles.joinPublicBtnText}>Submitting...</ThemedText>
                            </View>
                          ) : (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                              <Ionicons name="paper-plane-outline" size={13} color="#00E5FF" />
                              <ThemedText style={styles.joinPublicBtnText}>Request Join</ThemedText>
                            </View>
                          )}
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                );
              })
            )}
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      {/* Modal: Establish Accountability Squad */}
      <Modal
        visible={isCreateModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsCreateModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheetCard}>
            <View style={styles.modalSheetHeader}>
              <View>
                <ThemedText style={styles.modalSheetTitle}>Establish Squad</ThemedText>
                <ThemedText style={styles.modalSheetSubtitle}>Create your sovereign 5–20 warrior unit</ThemedText>
              </View>
              <TouchableOpacity
                onPress={() => setIsCreateModalVisible(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={22} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            <ThemedText style={styles.inputLabel}>Squad Call-Sign / Name</ThemedText>
            <TextInput
              style={styles.textInputModern}
              placeholder="e.g. Iron Vanguard, Phoenix Core"
              placeholderTextColor="#64748B"
              value={newCellName}
              onChangeText={setNewCellName}
              maxLength={40}
              autoFocus={true}
            />

            <ThemedText style={[styles.inputLabel, { marginTop: 14 }]}>Squad Creed / Motto</ThemedText>
            <TextInput
              style={styles.textInputModern}
              placeholder="Enter custom creed..."
              placeholderTextColor="#64748B"
              value={newCellMotto}
              onChangeText={setNewCellMotto}
              maxLength={80}
            />

            <ThemedText style={[styles.inputLabel, { marginTop: 12, marginBottom: 8 }]}>Or Select Creed:</ThemedText>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.mottoPresetsRow}>
              {MOTTO_PRESETS.map((motto, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={[styles.mottoPresetChip, newCellMotto === motto && styles.mottoPresetChipActive]}
                  onPress={() => setNewCellMotto(motto)}
                >
                  <ThemedText style={[styles.mottoPresetChipText, newCellMotto === motto && styles.mottoPresetChipTextActive]}>
                    "{motto}"
                  </ThemedText>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity
              style={[styles.modalPrimaryBtn, actionLoading && styles.modalPrimaryBtnLoading]}
              activeOpacity={0.85}
              onPress={handleCreateCell}
              disabled={actionLoading}
            >
              {actionLoading ? (
                <ActivityIndicator size="small" color="#000000" />
              ) : (
                <ThemedText style={styles.modalPrimaryBtnText}>Commission Squad</ThemedText>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal: Join With Code */}
      <Modal
        visible={isJoinModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsJoinModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheetCard}>
            <View style={styles.modalSheetHeader}>
              <View>
                <ThemedText style={styles.modalSheetTitle}>Join by Code</ThemedText>
                <ThemedText style={styles.modalSheetSubtitle}>Enter 6-character Spartan Squad code</ThemedText>
              </View>
              <TouchableOpacity
                onPress={() => setIsJoinModalVisible(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={22} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            <ThemedText style={styles.inputLabel}>Squad Join Code</ThemedText>
            <TextInput
              style={[styles.textInputModern, styles.codeInput]}
              placeholder="SP-XXXX"
              placeholderTextColor="#64748B"
              value={joinCodeInput}
              onChangeText={(text) => setJoinCodeInput(text.toUpperCase())}
              autoCapitalize="characters"
              maxLength={12}
              autoFocus={true}
            />

            <TouchableOpacity
              style={[styles.modalPrimaryBtn, actionLoading && styles.modalPrimaryBtnLoading]}
              activeOpacity={0.85}
              onPress={() => handleRequestJoin()}
              disabled={actionLoading}
            >
              {actionLoading ? (
                <ActivityIndicator size="small" color="#000000" />
              ) : (
                <ThemedText style={styles.modalPrimaryBtnText}>Send Join Petition</ThemedText>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Custom Confirmation / Alert Dialog */}
      <Modal
        visible={!!customDialog?.visible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setCustomDialog(null)}
      >
        <View style={styles.dialogBackdrop}>
          <View style={styles.dialogCard}>
            <View
              style={[
                styles.dialogIconCircle,
                customDialog?.type === 'danger' && { backgroundColor: 'rgba(239, 68, 68, 0.15)' },
                customDialog?.type === 'success' && { backgroundColor: 'rgba(16, 185, 129, 0.15)' },
                customDialog?.type === 'info' && { backgroundColor: 'rgba(0, 229, 255, 0.15)' },
              ]}
            >
              <Ionicons
                name={
                  customDialog?.type === 'danger'
                    ? 'alert-circle'
                    : customDialog?.type === 'success'
                    ? 'checkmark-circle'
                    : 'information-circle'
                }
                size={28}
                color={
                  customDialog?.type === 'danger'
                    ? '#EF4444'
                    : customDialog?.type === 'success'
                    ? '#10B981'
                    : '#00E5FF'
                }
              />
            </View>

            <ThemedText style={styles.dialogTitle}>{customDialog?.title}</ThemedText>
            <ThemedText style={styles.dialogMessage}>{customDialog?.message}</ThemedText>

            <View style={styles.dialogBtnRow}>
              {customDialog?.cancelText && (
                <TouchableOpacity
                  style={styles.dialogCancelBtn}
                  activeOpacity={0.7}
                  onPress={() => setCustomDialog(null)}
                >
                  <ThemedText style={styles.dialogCancelBtnText}>{customDialog.cancelText}</ThemedText>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[
                  styles.dialogConfirmBtn,
                  customDialog?.type === 'danger' && { backgroundColor: '#EF4444' },
                  customDialog?.type === 'success' && { backgroundColor: '#10B981' },
                ]}
                activeOpacity={0.8}
                onPress={() => {
                  if (customDialog?.onConfirm) {
                    customDialog.onConfirm();
                  } else {
                    setCustomDialog(null);
                  }
                }}
              >
                <ThemedText
                  style={[
                    styles.dialogConfirmBtnText,
                    customDialog?.type === 'danger' && { color: '#FFFFFF' },
                  ]}
                >
                  {customDialog?.confirmText || 'OK'}
                </ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  headerBackBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleGroup: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 10,
  },
  headerTitleText: {
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.5,
    color: '#FFFFFF',
  },
  headerSubtitleText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
    marginTop: 1,
  },
  leaderboardBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    fontSize: 13,
    color: '#94A3B8',
    fontWeight: '700',
    marginTop: 12,
    letterSpacing: 0.3,
  },
  scrollContent: {
    flex: 1,
  },
  scrollInner: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  unaffiliatedHero: {
    alignItems: 'center',
    backgroundColor: '#0A0F1D',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.2)',
    marginBottom: 16,
  },
  crestAura: {
    marginBottom: 14,
  },
  shieldGlowCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: 'rgba(0, 229, 255, 0.1)',
    borderWidth: 1.5,
    borderColor: 'rgba(0, 229, 255, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  unaffiliatedCategory: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.5,
    color: '#00E5FF',
    marginBottom: 6,
  },
  unaffiliatedTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
  },
  unaffiliatedBody: {
    fontSize: 12.5,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
  },
  pillarStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    marginBottom: 16,
  },
  pillarItem: {
    flex: 1,
    alignItems: 'center',
  },
  pillarIconBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  pillarTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  pillarDesc: {
    fontSize: 9.5,
    color: '#64748B',
    fontWeight: '600',
  },
  pillarDivider: {
    width: 1,
    height: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  heroActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    width: '100%',
  },
  createCellBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00E5FF',
    paddingVertical: 13,
    borderRadius: 13,
  },
  createCellBtnText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#000000',
    letterSpacing: 0.3,
  },
  joinWithCodeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 229, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.35)',
    paddingVertical: 13,
    borderRadius: 13,
  },
  joinWithCodeBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#00E5FF',
  },
  searchBarBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 16,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#F8FAFC',
    padding: 0,
  },
  publicSection: {
    marginBottom: 24,
  },
  publicHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
    paddingHorizontal: 2,
  },
  publicSectionTitle: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.2,
    color: '#00E5FF',
  },
  emptyPublicCard: {
    backgroundColor: '#0A0F1D',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  emptyIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  emptyPublicTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  emptyPublicText: {
    fontSize: 11.5,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 16,
  },
  publicCellCard: {
    backgroundColor: '#0F172A',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 12,
  },
  publicCellCardPending: {
    borderColor: 'rgba(245, 158, 11, 0.35)',
    backgroundColor: 'rgba(245, 158, 11, 0.03)',
  },
  publicCellHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  publicCellName: {
    fontSize: 14.5,
    fontWeight: '800',
    color: '#F8FAFC',
    marginBottom: 2,
  },
  publicCellMotto: {
    fontSize: 11.5,
    color: '#94A3B8',
  },
  publicStreakBadge: {
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.25)',
  },
  publicStreakText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#F59E0B',
  },
  publicCellFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
    paddingTop: 10,
  },
  publicMembersCount: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
    flex: 1,
    marginRight: 8,
  },
  joinPublicBtn: {
    backgroundColor: 'rgba(0, 229, 255, 0.12)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.4)',
  },
  joinPublicBtnLoading: {
    opacity: 0.6,
  },
  joinPublicBtnText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#00E5FF',
  },
  pendingRequestBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 5.5,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.35)',
    gap: 4,
  },
  pendingRequestBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#F59E0B',
  },
  btnLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    padding: 20,
  },
  modalSheetCard: {
    backgroundColor: '#0F172A',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalSheetHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalSheetTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  modalSheetSubtitle: {
    fontSize: 11.5,
    color: '#94A3B8',
    marginTop: 2,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    color: '#94A3B8',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  textInputModern: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  codeInput: {
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 3,
    textAlign: 'center',
  },
  mottoPresetsRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  mottoPresetChip: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  mottoPresetChipActive: {
    backgroundColor: 'rgba(0, 229, 255, 0.12)',
    borderColor: 'rgba(0, 229, 255, 0.4)',
  },
  mottoPresetChipText: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600',
  },
  mottoPresetChipTextActive: {
    color: '#00E5FF',
    fontWeight: '800',
  },
  modalPrimaryBtn: {
    backgroundColor: '#00E5FF',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  modalPrimaryBtnLoading: {
    opacity: 0.7,
  },
  modalPrimaryBtnText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#000000',
    letterSpacing: 0.3,
  },
  dialogBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    padding: 24,
  },
  dialogCard: {
    backgroundColor: '#0F172A',
    borderRadius: 20,
    padding: 22,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  dialogIconCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  dialogTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  dialogMessage: {
    fontSize: 12.5,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 18,
  },
  dialogBtnRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  dialogCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialogCancelBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#94A3B8',
  },
  dialogConfirmBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#00E5FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialogConfirmBtnText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#000000',
  },
});
