import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  View,
  Platform,
  Modal,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '@/services/api';
import { PageEntrance } from '@/components/ui/smooth-loader';

const fontFamily = Platform.select({
  ios: 'System',
  android: 'sans-serif',
  default: 'sans-serif',
});

const triggerHaptic = (style = Haptics.ImpactFeedbackStyle.Light) => {
  try {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(style);
    }
  } catch (error) {
    // Silent catch
  }
};

const STORAGE_KEY = 'zenwill_3_life_purposes_v2';

interface PurposeData {
  purpose_1: string;
  purpose_2: string;
  purpose_3: string;
  updated_at?: string;
}

const EMPTY_PURPOSES: PurposeData = {
  purpose_1: '',
  purpose_2: '',
  purpose_3: '',
};

export default function PurposeSingleScreen() {
  const router = useRouter();

  const [purposes, setPurposes] = useState<PurposeData>(EMPTY_PURPOSES);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [tempPurposes, setTempPurposes] = useState<PurposeData>(EMPTY_PURPOSES);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string>('');


  // Fetch real user purpose data from backend & storage
  useEffect(() => {
    loadPurposes();
  }, []);

  const loadPurposes = async () => {
    setIsLoading(true);
    try {
      // Check local storage first
      const cached = await AsyncStorage.getItem(STORAGE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        setPurposes(parsed);
        setTempPurposes(parsed);
      }

      // Fetch from API backend
      const res = await api.get<PurposeData>('/purpose');
      if (res) {
        const fetchedData: PurposeData = {
          purpose_1: res.purpose_1 || '',
          purpose_2: res.purpose_2 || '',
          purpose_3: res.purpose_3 || '',
          updated_at: res.updated_at,
        };
        setPurposes(fetchedData);
        setTempPurposes(fetchedData);
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(fetchedData));
      }
    } catch (err) {
      console.log('[Purpose] Fetch note:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartEdit = () => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
    setTempPurposes({ ...purposes });
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    triggerHaptic();
    setTempPurposes({ ...purposes });
    setIsEditing(false);
  };

  const handleSavePurposes = async () => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
    setIsSaving(true);

    const updatedData: PurposeData = {
      purpose_1: tempPurposes.purpose_1.trim(),
      purpose_2: tempPurposes.purpose_2.trim(),
      purpose_3: tempPurposes.purpose_3.trim(),
      updated_at: new Date().toISOString(),
    };

    try {
      // Save locally
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedData));
      setPurposes(updatedData);

      // Save to backend database
      await api.put('/purpose', {
        purpose_1: updatedData.purpose_1,
        purpose_2: updatedData.purpose_2,
        purpose_3: updatedData.purpose_3,
      });

      setToastMessage('3 Life Purposes saved successfully.');
      setTimeout(() => setToastMessage(''), 3500);
      setIsEditing(false);
    } catch (err) {
      console.log('[Purpose] API save note:', err);
      setToastMessage('Saved locally.');
      setTimeout(() => setToastMessage(''), 3500);
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  };

  const hasAnyPurpose =
    purposes.purpose_1.trim() !== '' ||
    purposes.purpose_2.trim() !== '' ||
    purposes.purpose_3.trim() !== '';

  return (
    <LinearGradient
      colors={['#000000', '#000000', '#000000']}
      style={styles.gradientBg}
    >
      <Stack.Screen options={{ headerShown: false }} />

      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {/* Header Bar with Transparent Back Button */}
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backBtn}
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

            <View style={styles.headerTitleBox}>
              <ThemedText style={styles.categoryBadge}>SOUL & WISDOM ANCHORS</ThemedText>
              <ThemedText style={styles.headerTitle}>My 3 Life Purposes</ThemedText>
            </View>

            <View style={{ width: 36 }} />
          </View>

          <PageEntrance style={{ flex: 1 }}>
            <ScrollView
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
            {/* Toast Notification */}
            {toastMessage !== '' && (
              <View style={styles.toastCard}>
                <Ionicons name="checkmark-circle-outline" size={16} color="#EF4444" />
                <ThemedText style={styles.toastText}>{toastMessage}</ThemedText>
              </View>
            )}

            {/* Hero Banner Card */}
            <View style={styles.heroBannerCard}>
              <LinearGradient
                colors={['rgba(239, 68, 68, 0.15)', 'rgba(0, 229, 255, 0.08)', 'rgba(0, 0, 0, 0.85)']}
                style={styles.heroGradient}
              >
                <View style={styles.heroBadgeRow}>
                  <View style={styles.heroBadge}>
                    <Ionicons name="flame" size={12} color="#EF4444" />
                    <ThemedText style={styles.heroBadgeText}>WISDOM & SOUL</ThemedText>
                  </View>

                  {isLoading ? (
                    <ActivityIndicator size="small" color="#EF4444" />
                  ) : (
                    <View style={styles.syncPill}>
                      <Ionicons name="cloud-done" size={11} color="#34D399" />
                      <ThemedText style={styles.syncText}>
                        {hasAnyPurpose ? 'Synced' : 'Ready'}
                      </ThemedText>
                    </View>
                  )}
                </View>

                <ThemedText style={styles.heroTitle}>
                  {isEditing
                    ? 'Writing Your 3 Core Life Purposes'
                    : hasAnyPurpose
                    ? 'Your Defined Life Purposes'
                    : 'Write Your 3 Core Life Purposes'}
                </ThemedText>

                <ThemedText style={styles.heroSubText}>
                  Define the 3 pillar purpose statements that lift your wisdom, anchor your soul, and guide your daily decisions.
                </ThemedText>
              </LinearGradient>
            </View>

            {/* ========================================================== */}
            {/* THE 3 LIFE PURPOSE PILLARS CARDS (VIEW / EDIT INLINE) */}
            {/* ========================================================== */}
            <View style={styles.pillarsContainer}>

              {/* PILLAR 1: WISDOM & MIND (RED) */}
              <View style={styles.pillarCard}>
                <LinearGradient
                  colors={['rgba(239, 68, 68, 0.3)', 'rgba(14, 10, 12, 0.95)']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.pillarBorderGradient}
                >
                  <View style={styles.pillarInner}>
                    <View style={styles.pillarHeaderRow}>
                      <View style={styles.pillarIconBox1}>
                        <Ionicons name="bulb" size={16} color="#EF4444" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <ThemedText style={styles.pillarNumberText}>PILLAR #1</ThemedText>
                        <ThemedText style={styles.pillarTitle1}>Wisdom of Thought & Mind</ThemedText>
                      </View>
                      {isEditing && (
                        <ThemedText style={styles.charCount}>
                          {tempPurposes.purpose_1.length}/200
                        </ThemedText>
                      )}
                      <View style={styles.pillarChip1}>
                        <ThemedText style={styles.pillarChipText1}>MIND</ThemedText>
                      </View>
                    </View>

                    {isEditing ? (
                      <View style={styles.inputGroup}>
                        <TextInput
                          style={styles.textInputArea}
                          multiline
                          maxLength={200}
                          value={tempPurposes.purpose_1}
                          onChangeText={(val) =>
                            setTempPurposes((prev) => ({ ...prev, purpose_1: val }))
                          }
                          placeholder="Write your 1st purpose for mental clarity and wisdom..."
                          placeholderTextColor="#52525B"
                        />
                        <ThemedText style={styles.promptHint}>
                          Prompt: What standard of wisdom & mental focus elevates your mind?
                        </ThemedText>
                      </View>
                    ) : (
                      <TouchableOpacity activeOpacity={0.88} onPress={handleStartEdit}>
                        {purposes.purpose_1.trim() !== '' ? (
                          <ThemedText style={styles.purposeContentText}>
                            "{purposes.purpose_1}"
                          </ThemedText>
                        ) : (
                          <View style={styles.emptyPromptBox}>
                            <Ionicons name="add-circle-outline" size={16} color="#EF4444" />
                            <ThemedText style={styles.emptyPromptText}>
                              Tap to write Purpose #1 (Wisdom & Mind)
                            </ThemedText>
                          </View>
                        )}
                      </TouchableOpacity>
                    )}
                  </View>
                </LinearGradient>
              </View>

              {/* PILLAR 2: SOUL & SPIRIT (CYAN) */}
              <View style={styles.pillarCard}>
                <LinearGradient
                  colors={['rgba(0, 229, 255, 0.25)', 'rgba(10, 14, 16, 0.95)']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.pillarBorderGradient}
                >
                  <View style={styles.pillarInner}>
                    <View style={styles.pillarHeaderRow}>
                      <View style={styles.pillarIconBox2}>
                        <Ionicons name="sparkles" size={16} color="#00E5FF" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <ThemedText style={styles.pillarNumberText}>PILLAR #2</ThemedText>
                        <ThemedText style={styles.pillarTitle2}>Spiritual Inner Alignment</ThemedText>
                      </View>
                      {isEditing && (
                        <ThemedText style={styles.charCount}>
                          {tempPurposes.purpose_2.length}/200
                        </ThemedText>
                      )}
                      <View style={styles.pillarChip2}>
                        <ThemedText style={styles.pillarChipText2}>SOUL</ThemedText>
                      </View>
                    </View>

                    {isEditing ? (
                      <View style={styles.inputGroup}>
                        <TextInput
                          style={styles.textInputArea}
                          multiline
                          maxLength={200}
                          value={tempPurposes.purpose_2}
                          onChangeText={(val) =>
                            setTempPurposes((prev) => ({ ...prev, purpose_2: val }))
                          }
                          placeholder="Write your 2nd purpose for spiritual peace and soul..."
                          placeholderTextColor="#52525B"
                        />
                        <ThemedText style={styles.promptHint}>
                          Prompt: What spiritual value or inner peace anchors your soul?
                        </ThemedText>
                      </View>
                    ) : (
                      <TouchableOpacity activeOpacity={0.88} onPress={handleStartEdit}>
                        {purposes.purpose_2.trim() !== '' ? (
                          <ThemedText style={styles.purposeContentText}>
                            "{purposes.purpose_2}"
                          </ThemedText>
                        ) : (
                          <View style={styles.emptyPromptBox}>
                            <Ionicons name="add-circle-outline" size={16} color="#00E5FF" />
                            <ThemedText style={styles.emptyPromptText}>
                              Tap to write Purpose #2 (Soul & Spirit)
                            </ThemedText>
                          </View>
                        )}
                      </TouchableOpacity>
                    )}
                  </View>
                </LinearGradient>
              </View>

              {/* PILLAR 3: NOBLE ACTION & LEGACY (MAGENTA) */}
              <View style={styles.pillarCard}>
                <LinearGradient
                  colors={['rgba(232, 121, 249, 0.25)', 'rgba(14, 10, 16, 0.95)']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.pillarBorderGradient}
                >
                  <View style={styles.pillarInner}>
                    <View style={styles.pillarHeaderRow}>
                      <View style={styles.pillarIconBox3}>
                        <Ionicons name="heart" size={16} color="#E879F9" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <ThemedText style={styles.pillarNumberText}>PILLAR #3</ThemedText>
                        <ThemedText style={styles.pillarTitle3}>Noble Action & Legacy</ThemedText>
                      </View>
                      {isEditing && (
                        <ThemedText style={styles.charCount}>
                          {tempPurposes.purpose_3.length}/200
                        </ThemedText>
                      )}
                      <View style={styles.pillarChip3}>
                        <ThemedText style={styles.pillarChipText3}>LEGACY</ThemedText>
                      </View>
                    </View>

                    {isEditing ? (
                      <View style={styles.inputGroup}>
                        <TextInput
                          style={styles.textInputArea}
                          multiline
                          maxLength={200}
                          value={tempPurposes.purpose_3}
                          onChangeText={(val) =>
                            setTempPurposes((prev) => ({ ...prev, purpose_3: val }))
                          }
                          placeholder="Write your 3rd purpose for action, family & legacy..."
                          placeholderTextColor="#52525B"
                        />
                        <ThemedText style={styles.promptHint}>
                          Prompt: How will your daily actions uplift family & community?
                        </ThemedText>
                      </View>
                    ) : (
                      <TouchableOpacity activeOpacity={0.88} onPress={handleStartEdit}>
                        {purposes.purpose_3.trim() !== '' ? (
                          <ThemedText style={styles.purposeContentText}>
                            "{purposes.purpose_3}"
                          </ThemedText>
                        ) : (
                          <View style={styles.emptyPromptBox}>
                            <Ionicons name="add-circle-outline" size={16} color="#E879F9" />
                            <ThemedText style={styles.emptyPromptText}>
                              Tap to write Purpose #3 (Action & Legacy)
                            </ThemedText>
                          </View>
                        )}
                      </TouchableOpacity>
                    )}
                  </View>
                </LinearGradient>
              </View>

            </View>

            {/* ACTION BUTTONS (SAVE / CANCEL / EDIT) */}
            {isEditing ? (
              <View style={styles.actionRowContainer}>
                <TouchableOpacity
                  style={styles.cancelBtnInline}
                  onPress={handleCancelEdit}
                >
                  <ThemedText style={styles.cancelBtnInlineText}>Cancel</ThemedText>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.88}
                  style={styles.saveActionBtn}
                  disabled={isSaving}
                  onPress={handleSavePurposes}
                >
                  <LinearGradient
                    colors={['#EF4444', '#DC2626', '#B91C1C']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.editActionGradient}
                  >
                    {isSaving ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <Ionicons name="checkmark-circle-outline" size={17} color="#FFFFFF" />
                        <ThemedText style={styles.editActionBtnText}>
                          Save 3 Life Purposes
                        </ThemedText>
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                activeOpacity={0.88}
                style={styles.editActionBtn}
                onPress={handleStartEdit}
              >
                <LinearGradient
                  colors={['#EF4444', '#DC2626', '#B91C1C']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.editActionGradient}
                >
                  <Ionicons name="create-outline" size={16} color="#FFFFFF" />
                  <ThemedText style={styles.editActionBtnText}>
                    {hasAnyPurpose ? 'Edit My 3 Life Purposes' : 'Write My 3 Life Purposes'}
                  </ThemedText>
                </LinearGradient>
              </TouchableOpacity>
            )}
            </ScrollView>
          </PageEntrance>
        </KeyboardAvoidingView>
      </SafeAreaView>
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
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(239, 68, 68, 0.12)',
  },
  backBtn: {
    paddingVertical: 4,
    paddingHorizontal: 2,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleBox: {
    alignItems: 'center',
  },
  categoryBadge: {
    fontFamily,
    fontSize: 8.5,
    fontWeight: '700',
    color: '#EF4444',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  headerTitle: {
    fontFamily,
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  editBtnHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  editBtnHeaderText: {
    fontFamily,
    fontSize: 11,
    fontWeight: '700',
    color: '#EF4444',
  },
  cancelBtnHeader: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  cancelBtnHeaderText: {
    fontFamily,
    fontSize: 11.5,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  scrollContent: {
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 36,
    gap: 12,
  },
  toastCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: 6,
    padding: 8,
  },
  toastText: {
    fontFamily,
    fontSize: 11.5,
    fontWeight: '600',
    color: '#EF4444',
    flex: 1,
  },
  heroBannerCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    overflow: 'hidden',
    backgroundColor: 'rgba(14, 10, 12, 0.9)',
  },
  heroGradient: {
    padding: 12,
    gap: 8,
  },
  heroBadgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  heroBadgeText: {
    fontFamily,
    fontSize: 9,
    fontWeight: '700',
    color: '#EF4444',
    letterSpacing: 1,
  },
  syncPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(52, 211, 153, 0.12)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  syncText: {
    fontFamily,
    fontSize: 9.5,
    fontWeight: '700',
    color: '#34D399',
  },
  heroTitle: {
    fontFamily,
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  heroSubText: {
    fontFamily,
    fontSize: 11,
    color: '#9CA3AF',
    lineHeight: 15,
  },

  /* PILLARS CONTAINER & CARDS */
  pillarsContainer: {
    gap: 10,
  },
  pillarCard: {
    borderRadius: 10,
    overflow: 'hidden',
  },
  pillarBorderGradient: {
    borderRadius: 10,
    padding: 1,
  },
  pillarInner: {
    backgroundColor: '#0A0608',
    borderRadius: 9,
    padding: 12,
    gap: 8,
  },
  pillarHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pillarIconBox1: {
    width: 26,
    height: 26,
    borderRadius: 6,
    backgroundColor: 'rgba(239, 68, 68, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillarIconBox2: {
    width: 26,
    height: 26,
    borderRadius: 6,
    backgroundColor: 'rgba(0, 229, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillarIconBox3: {
    width: 26,
    height: 26,
    borderRadius: 6,
    backgroundColor: 'rgba(232, 121, 249, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillarNumberText: {
    fontFamily,
    fontSize: 8.5,
    fontWeight: '700',
    color: '#71717A',
    letterSpacing: 0.8,
  },
  pillarTitle1: {
    fontFamily,
    fontSize: 13,
    fontWeight: '700',
    color: '#EF4444',
  },
  pillarTitle2: {
    fontFamily,
    fontSize: 13,
    fontWeight: '700',
    color: '#00E5FF',
  },
  pillarTitle3: {
    fontFamily,
    fontSize: 13,
    fontWeight: '700',
    color: '#E879F9',
  },
  pillarChip1: {
    backgroundColor: 'rgba(239, 68, 68, 0.18)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  pillarChipText1: {
    fontFamily,
    fontSize: 8.5,
    fontWeight: '700',
    color: '#EF4444',
  },
  pillarChip2: {
    backgroundColor: 'rgba(0, 229, 255, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  pillarChipText2: {
    fontFamily,
    fontSize: 8.5,
    fontWeight: '700',
    color: '#00E5FF',
  },
  pillarChip3: {
    backgroundColor: 'rgba(232, 121, 249, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  pillarChipText3: {
    fontFamily,
    fontSize: 8.5,
    fontWeight: '700',
    color: '#E879F9',
  },
  purposeContentText: {
    fontFamily,
    fontSize: 12.5,
    fontWeight: '600',
    color: '#F4F4F5',
    fontStyle: 'italic',
    lineHeight: 17,
  },
  emptyPromptBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  emptyPromptText: {
    fontFamily,
    fontSize: 11.5,
    color: '#71717A',
    fontStyle: 'italic',
  },

  /* INPUT AREA STYLES FOR INLINE EDITING */
  inputGroup: {
    gap: 4,
    marginTop: 2,
  },
  textInputArea: {
    fontFamily,
    backgroundColor: 'rgba(5, 5, 8, 0.9)',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    padding: 10,
    color: '#FFFFFF',
    fontSize: 12.5,
    minHeight: 55,
    textAlignVertical: 'top',
  },
  promptHint: {
    fontFamily,
    fontSize: 9.5,
    color: '#71717A',
    fontStyle: 'italic',
    marginTop: 2,
  },
  charCount: {
    fontFamily,
    fontSize: 9.5,
    color: '#71717A',
  },

  /* ACTION BUTTONS */
  actionRowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  cancelBtnInline: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnInlineText: {
    fontFamily,
    color: '#9CA3AF',
    fontSize: 12.5,
    fontWeight: '600',
  },
  saveActionBtn: {
    flex: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  editActionBtn: {
    borderRadius: 8,
    overflow: 'hidden',
    marginTop: 2,
  },
  editActionGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
  },
  editActionBtnText: {
    fontFamily,
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },

  /* AI SYNC EXPLAINER */
  aiSyncCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(18, 14, 16, 0.8)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
    padding: 10,
  },
  aiSyncTitle: {
    fontFamily,
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  aiSyncSub: {
    fontFamily,
    fontSize: 10.5,
    color: '#71717A',
    marginTop: 1,
  },

  /* MODAL */
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.88)',
    justifyContent: 'flex-end',
  },
  drawerHandle: {
    width: 32,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignSelf: 'center',
  },
  explainerModalContent: {
    backgroundColor: '#0A0608',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    padding: 14,
    gap: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalTitleText: {
    fontFamily,
    fontSize: 14.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  explainerBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: 'rgba(24, 20, 22, 0.6)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
    padding: 10,
  },
  explainerBoxTitle: {
    fontFamily,
    fontSize: 12,
    fontWeight: '700',
    color: '#EF4444',
  },
  explainerBoxDesc: {
    fontFamily,
    fontSize: 10.5,
    color: '#9CA3AF',
    lineHeight: 14,
    marginTop: 1,
  },
  explainerCloseBtn: {
    backgroundColor: '#EF4444',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 4,
  },
  explainerCloseText: {
    fontFamily,
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});
