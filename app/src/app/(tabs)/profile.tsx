import React, { useState } from 'react';
import {
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  View,
  Platform,
  Modal,
  TextInput,
  useWindowDimensions,
} from 'react-native';
import { useRouter, Stack, useFocusEffect } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAuthStore } from '@/store/auth-store';
import { useHabitStore } from '@/store/habit-store';
import { useOnboardingStore, SelfControl, DailySchedule, Occupation } from '@/store/onboarding-store';
import { getGamifiedRank } from './home';
import { profileApi } from '@/services/profile-api';
import { PageEntrance } from '@/components/ui/smooth-loader';

const triggerHaptic = (style = Haptics.ImpactFeedbackStyle.Light) => {
  try {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(style);
    }
  } catch (error) {
    // Silent catch
  }
};

const formatLabel = (str: string) => {
  if (!str) return 'Not Specified';
  return str
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

export default function TabsProfileScreen() {
  const router = useRouter();
  const logout = useAuthStore((state) => state.logout);
  const authUser = useAuthStore((state) => state.user);
  const updateUser = useAuthStore((state) => state.updateUser);
  
  const { streak } = useHabitStore();
  const currentRank = getGamifiedRank(streak);

  React.useEffect(() => {
    useHabitStore.getState().syncFromDatabase();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      useHabitStore.getState().syncFromDatabase();
    }, [])
  );

  const onboarding = useOnboardingStore();
  const updateOnboarding = useOnboardingStore((state) => state.updateProfile);

  // Editable Profile State
  const [name, setName] = useState<string>(
    authUser?.name || onboarding.firstName || authUser?.email?.split('@')[0] || 'Zen Operative'
  );
  const [email] = useState<string>(authUser?.email || 'user@zenwill.me');
  const [bio, setBio] = useState<string>(
    onboarding.personalStatement || 'Unshakable focus & daily habit mastery.'
  );
  const [primaryGoal, setPrimaryGoal] = useState<string>(
    onboarding.primaryOutcome ? formatLabel(onboarding.primaryOutcome) : 'Stronger Discipline'
  );
  const [occupation, setOccupation] = useState<Occupation>(onboarding.occupation || 'employee');
  const [dailySchedule, setDailySchedule] = useState<DailySchedule>(onboarding.dailySchedule || 'morning');
  const [selfControl, setSelfControl] = useState<SelfControl>(onboarding.selfControl || 'strong');

  // Modal Visibility
  const [isEditModalVisible, setIsEditModalVisible] = useState<boolean>(false);
  const [isDeleteModalVisible, setIsDeleteModalVisible] = useState<boolean>(false);

  // Delete Account State
  const [deletePassword, setDeletePassword] = useState<string>('');
  const [deleteReason, setDeleteReason] = useState<string>('Achieved my goal / Quitting addiction');
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeletingAccount, setIsDeletingAccount] = useState<boolean>(false);

  const deletionReasonOptions = [
    'Achieved my goal / Quitting addiction',
    'Taking a temporary break',
    'Privacy / Data concerns',
    'App experience / Technical issues',
    'Other reason',
  ];

  // Temporary Edit Form State
  const [tempName, setTempName] = useState(name);
  const [tempBio, setTempBio] = useState(bio);
  const [tempGoal, setTempGoal] = useState(primaryGoal);
  const [tempOccupation, setTempOccupation] = useState<Occupation>(occupation);
  const [tempSchedule, setTempSchedule] = useState<DailySchedule>(dailySchedule);
  const [tempSelfControl, setTempSelfControl] = useState<SelfControl>(selfControl);

  const openEditModal = () => {
    triggerHaptic();
    setTempName(name);
    setTempBio(bio);
    setTempGoal(primaryGoal);
    setTempOccupation(occupation);
    setTempSchedule(dailySchedule);
    setTempSelfControl(selfControl);
    setIsEditModalVisible(true);
  };

  const handleSaveProfile = async () => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
    setName(tempName);
    setBio(tempBio);
    setPrimaryGoal(tempGoal);
    setOccupation(tempOccupation);
    setDailySchedule(tempSchedule);
    setSelfControl(tempSelfControl);

    // Sync back to Onboarding Store
    updateOnboarding({
      firstName: tempName,
      personalStatement: tempBio,
      occupation: tempOccupation,
      dailySchedule: tempSchedule,
      selfControl: tempSelfControl,
    });

    // Update local authentication session
    updateUser({ name: tempName });

    // Sync back to backend database
    try {
      await profileApi.updateMe({ name: tempName });
    } catch (error) {
      console.warn('Failed to sync profile update to server:', error);
    }

    setIsEditModalVisible(false);
  };

  const handleConfirmAccountDeletion = async () => {
    if (!deletePassword.trim()) {
      setDeleteError('Please enter your password to confirm account deletion.');
      return;
    }

    triggerHaptic(Haptics.ImpactFeedbackStyle.Heavy);
    setIsDeletingAccount(true);
    setDeleteError(null);

    try {
      const { authApi } = require('@/services/auth-api');
      const res = await authApi.requestAccountDeletion(deletePassword, deleteReason);
      if (res.success) {
        setIsDeleteModalVisible(false);
        setDeletePassword('');
        setDeleteError(null);

        if (Platform.OS !== 'web') {
          const { Alert } = require('react-native');
          Alert.alert(
            'Account Scheduled for Deletion',
            'Your account has been scheduled for deletion in 7 days. If you log back in within 7 days, your account deletion will be automatically cancelled.',
            [
              {
                text: 'OK',
                onPress: async () => {
                  await logout();
                  router.replace('/(auth)/login' as any);
                },
              },
            ]
          );
        } else {
          await logout();
          router.replace('/(auth)/login' as any);
        }
      } else {
        setDeleteError(res.message || 'Failed to request account deletion.');
      }
    } catch (err: any) {
      const errMsg = err?.response?.data?.detail || err?.message || 'Incorrect password. Please enter your valid password.';
      setDeleteError(errMsg);
    } finally {
      setIsDeletingAccount(false);
    }
  };

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
                router.replace('/(tabs)/home' as any);
              }
            }}
          >
            <Ionicons name="chevron-back" size={24} color="#00E5FF" />
          </TouchableOpacity>

          <View style={{ alignItems: 'center', flex: 1 }}>
            <ThemedText style={styles.categoryBadge}>PERSONAL DASHBOARD</ThemedText>
            <ThemedText style={styles.headerTitle}>User Profile</ThemedText>
          </View>

          <View style={{ width: 36 }} />
        </View>

        <PageEntrance style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          
          {/* Main User Profile Card */}
          <View style={styles.profileHeroCard}>
            <LinearGradient
              colors={['rgba(0, 229, 255, 0.12)', 'rgba(59, 130, 246, 0.04)']}
              style={styles.profileHeroGradient}
            >
              <View style={styles.profileTopRow}>
                <View style={styles.avatarGlowContainer}>
                  <ThemedText style={styles.avatarText}>{name.charAt(0).toUpperCase()}</ThemedText>
                </View>

                <View style={{ flex: 1, gap: 4 }}>
                  <ThemedText style={styles.usernameText}>{name}</ThemedText>
                  <ThemedText style={styles.emailText}>{email}</ThemedText>
                  
                  <View style={[styles.levelBadgeRow, { backgroundColor: currentRank.bgGlow, borderColor: currentRank.borderColor, borderWidth: 1 }]}>
                    <ThemedText style={{ fontSize: 11, marginRight: 2 }}>{currentRank.badge}</ThemedText>
                    <ThemedText style={[styles.levelBadgeText, { color: currentRank.color }]}>
                      Rank: {currentRank.name}
                    </ThemedText>
                  </View>
                </View>
              </View>

              {/* Bio & Primary Target Pill */}
              <View style={styles.bioContainer}>
                <View style={styles.bioQuoteRow}>
                  <Ionicons name="chatbox-ellipses-outline" size={14} color="#00E5FF" />
                  <ThemedText style={styles.bioText}>"{bio}"</ThemedText>
                </View>
                
                <View style={styles.goalPill}>
                  <Ionicons name="sparkles" size={12} color="#10B981" />
                  <ThemedText style={styles.goalPillText}>Target: {primaryGoal}</ThemedText>
                </View>
              </View>
            </LinearGradient>
          </View>

          {/* Habit Metrics Bar */}
          <View style={styles.quickMetricsRow}>
            <View style={styles.metricChip}>
              <Ionicons name="flame" size={18} color="#F59E0B" style={{ marginBottom: 4 }} />
              <ThemedText style={styles.metricVal}>{streak} Days</ThemedText>
              <ThemedText style={styles.metricLabel}>Clean Streak</ThemedText>
            </View>

            <View style={styles.metricChip}>
              <ThemedText style={{ fontSize: 18, marginBottom: 4 }}>{currentRank.badge}</ThemedText>
              <ThemedText style={styles.metricVal}>{currentRank.name}</ThemedText>
              <ThemedText style={styles.metricLabel}>Discipline Rank</ThemedText>
            </View>
          </View>

          {/* Onboarding & Profile Details Card */}
          <View style={styles.cardSection}>
            <View style={styles.cardSectionHeader}>
              <View style={styles.sectionHeaderTitleRow}>
                <Ionicons name="person-circle-outline" size={20} color="#00E5FF" />
                <ThemedText style={styles.cardSectionTitle}>Onboarding & Personal Data</ThemedText>
              </View>

              <TouchableOpacity style={styles.sectionEditBtn} onPress={openEditModal}>
                <Ionicons name="create-outline" size={14} color="#00E5FF" />
                <ThemedText style={styles.sectionEditBtnText}>Edit Data</ThemedText>
              </TouchableOpacity>
            </View>

            {/* Editable Fields Summary */}
            <View style={styles.detailGrid}>
              <View style={styles.detailCard}>
                <ThemedText style={styles.detailLabel}>Display Name</ThemedText>
                <ThemedText style={styles.detailValue}>{name}</ThemedText>
              </View>

              <View style={styles.detailCard}>
                <ThemedText style={styles.detailLabel}>Primary Goal</ThemedText>
                <ThemedText style={styles.detailValue}>{primaryGoal}</ThemedText>
              </View>

              <View style={styles.detailCard}>
                <ThemedText style={styles.detailLabel}>Occupation</ThemedText>
                <ThemedText style={styles.detailValue}>{formatLabel(occupation)}</ThemedText>
              </View>

              <View style={styles.detailCard}>
                <ThemedText style={styles.detailLabel}>Daily Focus Peak</ThemedText>
                <ThemedText style={styles.detailValue}>{formatLabel(dailySchedule)}</ThemedText>
              </View>

              <View style={styles.detailCardFull}>
                <ThemedText style={styles.detailLabel}>Self-Control Baseline</ThemedText>
                <ThemedText style={styles.detailValue}>{formatLabel(selfControl)}</ThemedText>
              </View>

              <View style={styles.detailCardFull}>
                <ThemedText style={styles.detailLabel}>Personal Motivation / Bio</ThemedText>
                <ThemedText style={styles.detailValueSub}>{bio}</ThemedText>
              </View>
            </View>

          </View>

          {/* Bottom Account Actions */}
          <View style={styles.bottomActionsContainer}>
            {/* Sign Out Button */}
            <TouchableOpacity
              style={styles.logoutBtn}
              activeOpacity={0.8}
              onPress={async () => {
                triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
                await logout();
                router.replace('/(auth)/welcome' as any);
              }}
            >
              <Ionicons name="log-out-outline" size={16} color="rgba(255, 255, 255, 0.8)" />
              <ThemedText style={styles.logoutText}>Sign Out</ThemedText>
            </TouchableOpacity>

            {/* Delete Account Button */}
            <TouchableOpacity
              style={styles.deleteAccountBtn}
              activeOpacity={0.8}
              onPress={() => {
                triggerHaptic(Haptics.ImpactFeedbackStyle.Heavy);
                setIsDeleteModalVisible(true);
              }}
            >
              <Ionicons name="trash-outline" size={16} color="#EF4444" />
              <ThemedText style={styles.deleteAccountText}>Delete Account</ThemedText>
            </TouchableOpacity>
          </View>

        </ScrollView>
      </PageEntrance>
      </SafeAreaView>

      {/* Edit Onboarding & Profile Modal */}
      <Modal
        visible={isEditModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsEditModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setIsEditModalVisible(false)}
        >
          <TouchableOpacity activeOpacity={1} style={styles.editCard}>
            <View style={styles.modalHeaderRow}>
              <Ionicons name="create-outline" size={20} color="#00E5FF" />
              <ThemedText style={styles.editCardHeader}>Edit Profile & Onboarding Data</ThemedText>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
              <View style={styles.inputGroup}>
                <ThemedText style={styles.inputLabel}>Full Name / Handle</ThemedText>
                <TextInput
                  style={styles.textInput}
                  value={tempName}
                  onChangeText={setTempName}
                  placeholder="Enter name"
                  placeholderTextColor="rgba(255,255,255,0.3)"
                />
              </View>

              <View style={styles.inputGroup}>
                <ThemedText style={styles.inputLabel}>Personal Statement / Bio</ThemedText>
                <TextInput
                  style={[styles.textInput, { height: 60, textAlignVertical: 'top' }]}
                  value={tempBio}
                  onChangeText={setTempBio}
                  multiline
                  placeholder="Enter bio or motivation statement"
                  placeholderTextColor="rgba(255,255,255,0.3)"
                />
              </View>

              <View style={styles.inputGroup}>
                <ThemedText style={styles.inputLabel}>Primary Goal / Target</ThemedText>
                <TextInput
                  style={styles.textInput}
                  value={tempGoal}
                  onChangeText={setTempGoal}
                  placeholder="e.g. Stronger Discipline, Digital Detox"
                  placeholderTextColor="rgba(255,255,255,0.3)"
                />
              </View>

              <View style={styles.inputGroup}>
                <ThemedText style={styles.inputLabel}>Occupation</ThemedText>
                <View style={styles.chipOptionRow}>
                  {(['student', 'employee', 'business_owner', 'freelancer', 'other'] as Occupation[]).map((occ) => (
                    <TouchableOpacity
                      key={occ}
                      style={[
                        styles.chipOption,
                        tempOccupation === occ && styles.chipOptionSelected,
                      ]}
                      onPress={() => {
                        triggerHaptic();
                        setTempOccupation(occ);
                      }}
                    >
                      <ThemedText
                        style={[
                          styles.chipOptionText,
                          tempOccupation === occ && styles.chipOptionTextSelected,
                        ]}
                      >
                        {formatLabel(occ)}
                      </ThemedText>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.inputGroup}>
                <ThemedText style={styles.inputLabel}>Daily Focus Peak</ThemedText>
                <View style={styles.chipOptionRow}>
                  {(['early_morning', 'morning', 'afternoon', 'evening', 'night_shift'] as DailySchedule[]).map((sched) => (
                    <TouchableOpacity
                      key={sched}
                      style={[
                        styles.chipOption,
                        tempSchedule === sched && styles.chipOptionSelected,
                      ]}
                      onPress={() => {
                        triggerHaptic();
                        setTempSchedule(sched);
                      }}
                    >
                      <ThemedText
                        style={[
                          styles.chipOptionText,
                          tempSchedule === sched && styles.chipOptionTextSelected,
                        ]}
                      >
                        {formatLabel(sched)}
                      </ThemedText>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.inputGroup}>
                <ThemedText style={styles.inputLabel}>Self-Control Strength</ThemedText>
                <View style={styles.chipOptionRow}>
                  {(['very_strong', 'strong', 'average', 'weak', 'very_weak'] as SelfControl[]).map((sc) => (
                    <TouchableOpacity
                      key={sc}
                      style={[
                        styles.chipOption,
                        tempSelfControl === sc && styles.chipOptionSelected,
                      ]}
                      onPress={() => {
                        triggerHaptic();
                        setTempSelfControl(sc);
                      }}
                    >
                      <ThemedText
                        style={[
                          styles.chipOptionText,
                          tempSelfControl === sc && styles.chipOptionTextSelected,
                        ]}
                      >
                        {formatLabel(sc)}
                      </ThemedText>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </ScrollView>

            <View style={styles.modalActionRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setIsEditModalVisible(false)}
              >
                <ThemedText style={styles.modalCancelText}>Cancel</ThemedText>
              </TouchableOpacity>

              <TouchableOpacity style={styles.modalSaveBtn} onPress={handleSaveProfile}>
                <LinearGradient
                  colors={['#00E5FF', '#3B82F6']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.modalSaveGradient}
                >
                  <ThemedText style={styles.modalSaveText}>Save Data</ThemedText>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Delete Account Confirmation Modal */}
      <Modal
        visible={isDeleteModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsDeleteModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setIsDeleteModalVisible(false)}
        >
          <TouchableOpacity activeOpacity={1} style={styles.deleteConfirmCard}>
            <View style={styles.deleteIconBox}>
              <Ionicons name="trash-bin" size={26} color="#EF4444" />
            </View>

            <ThemedText style={styles.deleteCardTitle}>Delete Account (7-Day Grace Period)</ThemedText>
            
            <View style={styles.deleteGraceBanner}>
              <Ionicons name="shield-checkmark" size={14} color="#00E5FF" />
              <ThemedText style={styles.deleteGraceBannerText}>
                Your account will be scheduled for permanent deletion in 7 days. If you log back in within 7 days, the deletion process will be automatically cancelled.
              </ThemedText>
            </View>

            {/* Error Message Display */}
            {deleteError && (
              <View style={styles.deleteErrorBox}>
                <Ionicons name="alert-circle" size={14} color="#EF4444" />
                <ThemedText style={styles.deleteErrorText}>{deleteError}</ThemedText>
              </View>
            )}

            {/* Deletion Reason Selector */}
            <View style={{ width: '100%', gap: 6 }}>
              <ThemedText style={styles.inputLabel}>Why are you deleting your account?</ThemedText>
              <View style={{ gap: 6 }}>
                {deletionReasonOptions.map((opt) => (
                  <TouchableOpacity
                    key={opt}
                    style={[
                      styles.reasonOptionPill,
                      deleteReason === opt && styles.reasonOptionPillSelected,
                    ]}
                    onPress={() => {
                      triggerHaptic();
                      setDeleteReason(opt);
                    }}
                  >
                    <Ionicons
                      name={deleteReason === opt ? 'radio-button-on' : 'radio-button-off'}
                      size={14}
                      color={deleteReason === opt ? '#00E5FF' : '#64748B'}
                    />
                    <ThemedText
                      style={[
                        styles.reasonOptionText,
                        deleteReason === opt && styles.reasonOptionTextSelected,
                      ]}
                    >
                      {opt}
                    </ThemedText>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Password Security Verification Field */}
            <View style={{ width: '100%', gap: 4, marginTop: 4 }}>
              <ThemedText style={styles.inputLabel}>Enter Password to Confirm</ThemedText>
              <TextInput
                style={styles.deletePasswordInput}
                placeholder="Enter account password"
                placeholderTextColor="rgba(255, 255, 255, 0.4)"
                secureTextEntry
                value={deletePassword}
                onChangeText={(txt) => {
                  setDeletePassword(txt);
                  setDeleteError(null);
                }}
              />
            </View>

            <View style={styles.deleteActionRow}>
              <TouchableOpacity
                style={styles.cancelDeleteBtn}
                disabled={isDeletingAccount}
                onPress={() => {
                  setIsDeleteModalVisible(false);
                  setDeleteError(null);
                  setDeletePassword('');
                }}
              >
                <ThemedText style={styles.cancelDeleteText}>Keep Account</ThemedText>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.confirmDeleteBtn, isDeletingAccount && { opacity: 0.6 }]}
                disabled={isDeletingAccount}
                onPress={handleConfirmAccountDeletion}
              >
                <ThemedText style={styles.confirmDeleteText}>
                  {isDeletingAccount ? 'Scheduling...' : 'Schedule Deletion'}
                </ThemedText>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
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
    paddingVertical: 12,
  },
  backBtn: {
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
  },
  categoryBadge: {
    fontSize: 10,
    fontWeight: '700',
    color: '#00E5FF',
    letterSpacing: 1.5,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: -0.5,
    marginTop: 2,
  },
  quickEditHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0, 229, 255, 0.12)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.3)',
  },
  quickEditHeaderText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#00E5FF',
  },
  scrollContent: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    paddingBottom: 100,
    gap: 16,
  },
  profileHeroCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.25)',
    overflow: 'hidden',
  },
  profileHeroGradient: {
    padding: 12,
    gap: 12,
  },
  profileTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatarGlowContainer: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: 'rgba(0, 229, 255, 0.15)',
    borderWidth: 2,
    borderColor: '#00E5FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 24,
    fontWeight: '800',
    color: '#00E5FF',
  },
  usernameText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#ffffff',
  },
  emailText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.5)',
  },
  levelBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(245, 158, 11, 0.14)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginTop: 2,
  },
  levelBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#F59E0B',
  },
  bioContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 10,
    padding: 10,
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  bioQuoteRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  bioText: {
    flex: 1,
    fontSize: 12.5,
    color: 'rgba(255, 255, 255, 0.8)',
    fontStyle: 'italic',
  },
  goalPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  goalPillText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#10B981',
  },
  quickMetricsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  metricChip: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.025)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
    paddingVertical: 10,
    paddingHorizontal: 6,
  },
  metricVal: {
    fontSize: 13,
    fontWeight: '800',
    color: '#ffffff',
    textAlign: 'center',
  },
  metricLabel: {
    fontSize: 9,
    color: 'rgba(255, 255, 255, 0.45)',
    textAlign: 'center',
  },
  cardSection: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    padding: 12,
    gap: 12,
  },
  cardSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionHeaderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardSectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
  },
  sectionEditBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sectionEditBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#00E5FF',
  },
  detailGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 10,
  },
  detailCard: {
    width: '48.5%',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 10,
    padding: 10,
    gap: 3,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  detailCardFull: {
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 10,
    padding: 10,
    gap: 3,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  detailLabel: {
    fontSize: 10.5,
    color: 'rgba(255, 255, 255, 0.45)',
    fontWeight: '600',
  },
  detailValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },
  detailValueSub: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.75)',
    fontStyle: 'italic',
  },
  fullOnboardingBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(0, 229, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.25)',
    paddingVertical: 9,
    borderRadius: 10,
    marginTop: 6,
  },
  fullOnboardingBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#00E5FF',
  },
  bottomActionsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  logoutBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingVertical: 10,
    borderRadius: 12,
  },
  logoutText: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 13,
    fontWeight: '700',
  },
  deleteAccountBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    paddingVertical: 10,
  },
  deleteAccountText: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '700',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.four,
  },
  editCard: {
    width: '100%',
    backgroundColor: '#0A0D16',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.3)',
    padding: Spacing.four,
    gap: 14,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
    paddingBottom: 10,
  },
  editCardHeader: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  inputGroup: {
    gap: 6,
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 11.5,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.6)',
  },
  textInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#ffffff',
    fontSize: 13,
  },
  chipOptionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chipOption: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  chipOptionSelected: {
    backgroundColor: 'rgba(0, 229, 255, 0.15)',
    borderColor: '#00E5FF',
  },
  chipOptionText: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.5)',
  },
  chipOptionTextSelected: {
    color: '#00E5FF',
    fontWeight: '700',
  },
  modalActionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 8,
  },
  modalCancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  modalCancelText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12.5,
    fontWeight: '600',
  },
  modalSaveBtn: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  modalSaveGradient: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalSaveText: {
    color: '#ffffff',
    fontSize: 12.5,
    fontWeight: '800',
  },
  deleteConfirmCard: {
    width: '90%',
    backgroundColor: '#0A0D16',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
    padding: Spacing.four,
    gap: 14,
    alignItems: 'center',
  },
  deleteIconBox: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  deleteCardTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#ffffff',
  },
  deleteCardDesc: {
    fontSize: 12.5,
    color: 'rgba(255, 255, 255, 0.65)',
    textAlign: 'center',
    lineHeight: 18,
  },
  deleteGraceBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(0, 229, 255, 0.1)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.25)',
    padding: 10,
  },
  deleteGraceBannerText: {
    fontSize: 11,
    color: '#E2E8F0',
    flex: 1,
    lineHeight: 15,
  },
  deleteErrorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    padding: 8,
    width: '100%',
  },
  deleteErrorText: {
    fontSize: 11.5,
    color: '#EF4444',
    flex: 1,
    fontWeight: '600',
  },
  reasonOptionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  reasonOptionPillSelected: {
    backgroundColor: 'rgba(0, 229, 255, 0.1)',
    borderColor: 'rgba(0, 229, 255, 0.3)',
  },
  reasonOptionText: {
    fontSize: 11.5,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  reasonOptionTextSelected: {
    color: '#ffffff',
    fontWeight: '700',
  },
  deletePasswordInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 9,
    color: '#ffffff',
    fontSize: 13,
  },
  deleteActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
    width: '100%',
  },
  cancelDeleteBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
  },
  cancelDeleteText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12.5,
    fontWeight: '700',
  },
  confirmDeleteBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#EF4444',
    alignItems: 'center',
  },
  confirmDeleteText: {
    color: '#ffffff',
    fontSize: 12.5,
    fontWeight: '800',
  },
});
