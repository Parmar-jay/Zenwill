import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  View,
  Platform,
  Animated,
  TextInput,
  KeyboardAvoidingView,
  Keyboard,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { analyticsApi } from '@/services/analytics-api';

const triggerHaptic = (style = Haptics.ImpactFeedbackStyle.Light) => {
  try {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(style);
    }
  } catch (error) {
    // Silent catch
  }
};

const webNoOutline = Platform.OS === 'web'
  ? ({ outlineStyle: 'none', outlineWidth: 0, webkitTapHighlightColor: 'transparent' } as any)
  : {};

export default function EmergencyGroundingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const handleGoBack = () => {
    triggerHaptic();
    Keyboard.dismiss();
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/emergency' as any);
    }
  };

  const [activeStepIndex, setActiveStepIndex] = useState<number>(0);
  const [sensoryItems, setSensoryItems] = useState<Record<string, string[]>>({
    '5': [],
    '4': [],
    '3': [],
    '2': [],
    '1': [],
  });
  const [currentDraft, setCurrentDraft] = useState<string>('');
  const [keyboardHeight, setKeyboardHeight] = useState<number>(0);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState<boolean>(false);

  const inputRef = useRef<TextInput>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  // ── Fluid Keyboard Tracking for Gboard & iOS ──
  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        setKeyboardHeight(e.endCoordinates.height);
        setIsKeyboardVisible(true);
        setTimeout(() => {
          scrollViewRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setKeyboardHeight(0);
        setIsKeyboardVisible(false);
      }
    );

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const steps = [
    { num: '5', sense: 'SEE', title: '5 Things You Can See', instruction: 'Look around your room and spot 5 things (e.g. fan, table, water bottle, window, wall).', icon: 'eye-outline' as const, color: '#10B981' },
    { num: '4', sense: 'TOUCH', title: '4 Things You Can Touch', instruction: 'Feel 4 physical textures right now (e.g. your shirt, chair, phone cover, table surface).', icon: 'hand-left-outline' as const, color: '#00E5FF' },
    { num: '3', sense: 'HEAR', title: '3 Sounds You Can Hear', instruction: 'Listen closely for 3 sounds around you (e.g. fan hum, distant vehicles, your breathing).', icon: 'ear-outline' as const, color: '#8B5CF6' },
    { num: '2', sense: 'SMELL', title: '2 Scents You Can Smell', instruction: 'Inhale deeply through your nose and notice 2 smells or the fresh ambient air.', icon: 'flower-outline' as const, color: '#F59E0B' },
    { num: '1', sense: 'TASTE', title: '1 Taste You Can Sense', instruction: 'Notice the taste inside your mouth, or take a refreshing sip of water.', icon: 'restaurant-outline' as const, color: '#EF4444' },
  ];

  const current = steps[activeStepIndex];
  const targetCount = parseInt(current.num, 10);
  const currentItems = sensoryItems[current.num] || [];
  const isStepComplete = currentItems.length >= targetCount;

  const handleAddItem = () => {
    const trimmed = currentDraft.trim();
    if (!trimmed) return;

    if (currentItems.length < targetCount) {
      triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
      const nextList = [...currentItems, trimmed];
      setSensoryItems((prev) => ({
        ...prev,
        [current.num]: nextList,
      }));
      setCurrentDraft('');

      if (nextList.length >= targetCount) {
        // Step completed: dismiss keyboard
        Keyboard.dismiss();
      } else {
        // Keep focus for rapid next item entry
        setTimeout(() => inputRef.current?.focus(), 60);
      }
    }
  };

  const handleRemoveItem = (indexToRemove: number) => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
    setSensoryItems((prev) => ({
      ...prev,
      [current.num]: (prev[current.num] || []).filter((_, idx) => idx !== indexToRemove),
    }));
  };

  const animateStepChange = (newIdx: number) => {
    // If user has typed an uncommitted draft, save it automatically
    if (currentDraft.trim() && currentItems.length < targetCount) {
      setSensoryItems((prev) => ({
        ...prev,
        [current.num]: [...(prev[current.num] || []), currentDraft.trim()],
      }));
    }
    setCurrentDraft('');
    triggerHaptic();
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 0.3, duration: 120, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
    setActiveStepIndex(newIdx);
  };

  const handleNextPress = () => {
    if (currentDraft.trim() && currentItems.length < targetCount) {
      setSensoryItems((prev) => ({
        ...prev,
        [current.num]: [...(prev[current.num] || []), currentDraft.trim()],
      }));
      setCurrentDraft('');
    }

    if (activeStepIndex < steps.length - 1) {
      animateStepChange(activeStepIndex + 1);
    } else {
      triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
      Keyboard.dismiss();
      analyticsApi.logEvent({
        event_type: 'emergency_exercise',
        screen_name: 'emergency_grounding',
        feature_name: 'sensory_grounding_54321',
        duration_seconds: 120,
        outcome: 'resisted',
        emotional_state: 'grounded',
        metadata: {
          inputs_provided: sensoryItems,
          total_anchors: Object.values(sensoryItems).reduce((sum, l) => sum + l.length, 0),
        },
      }).catch(() => {});
      router.push('/emergency/reflection' as any);
    }
  };

  return (
    <View style={styles.blackBg}>
      <Stack.Screen options={{ headerShown: false }} />

      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        {/* Header Bar */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backBtn}
            activeOpacity={0.7}
            onPress={handleGoBack}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="chevron-back" size={24} color="#00E5FF" />
          </TouchableOpacity>
          <View style={{ alignItems: 'center' }}>
            <ThemedText style={styles.stepIndicator}>STEP 3 OF 4 • 5-4-3-2-1 RESET</ThemedText>
            <ThemedText style={styles.headerTitle}>Sensory Grounding</ThemedText>
          </View>
          <View style={{ width: 28 }} />
        </View>

        {/* Keyboard Responsive Wrapper */}
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={0}
        >
          <View style={[styles.mainFlexContainer, { paddingBottom: Platform.OS === 'android' ? keyboardHeight : 0 }]}>
            <ScrollView
              ref={scrollViewRef}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              removeClippedSubviews={false}
            >
              <ThemedText style={styles.title}>5-4-3-2-1 Physical Reset</ThemedText>
              <ThemedText style={styles.sub}>
                Pull your attention out of your racing craving thoughts and anchor back into your physical surroundings.
              </ThemedText>

              {/* Active Step Hero Card with Animated Transition */}
              <Animated.View style={[styles.heroCard, { opacity: fadeAnim, borderColor: `${current.color}60` }]}>
                <View style={styles.heroTopRow}>
                  <View style={[styles.numBadge, { backgroundColor: `${current.color}25`, borderColor: current.color }]}>
                    <ThemedText style={[styles.numText, { color: current.color }]}>{current.num}</ThemedText>
                  </View>
                  <View style={[styles.senseBadge, { backgroundColor: `${current.color}20`, borderColor: `${current.color}40` }]}>
                    <Ionicons name={current.icon} size={15} color={current.color} />
                    <ThemedText style={[styles.senseBadgeText, { color: current.color }]}>{current.sense}</ThemedText>
                  </View>
                </View>

                <ThemedText style={styles.stepTitle}>{current.title}</ThemedText>
                <ThemedText style={styles.stepInstruction}>{current.instruction}</ThemedText>

                {/* Progress Tracker: Pips & Grounded Counter */}
                <View style={styles.progressRow}>
                  <View style={styles.pipsRow}>
                    {Array.from({ length: targetCount }).map((_, idx) => (
                      <View
                        key={idx}
                        style={[
                          styles.pip,
                          {
                            backgroundColor: idx < currentItems.length ? current.color : 'rgba(255, 255, 255, 0.12)',
                          },
                        ]}
                      />
                    ))}
                  </View>
                  <ThemedText style={[styles.progressCountText, { color: isStepComplete ? current.color : '#94A3B8' }]}>
                    {currentItems.length} of {targetCount} grounded
                  </ThemedText>
                </View>

                {/* Recorded Items List */}
                {currentItems.length > 0 && (
                  <View style={styles.itemsListContainer}>
                    {currentItems.map((item, idx) => (
                      <View key={idx} style={[styles.itemChip, { borderColor: `${current.color}35` }]}>
                        <View style={[styles.itemIdxCircle, { backgroundColor: `${current.color}25` }]}>
                          <ThemedText style={[styles.itemIdxText, { color: current.color }]}>{idx + 1}</ThemedText>
                        </View>
                        <ThemedText style={styles.itemText} numberOfLines={2}>
                          {item}
                        </ThemedText>
                        <TouchableOpacity
                          style={styles.removeItemBtn}
                          activeOpacity={0.7}
                          onPress={() => handleRemoveItem(idx)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Ionicons name="close-circle" size={16} color="rgba(255, 255, 255, 0.45)" />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}

                {/* Card Completion Indicator */}
                {isStepComplete && (
                  <View style={[styles.completedBanner, { backgroundColor: `${current.color}15`, borderColor: `${current.color}35` }]}>
                    <Ionicons name="checkmark-circle" size={18} color={current.color} />
                    <ThemedText style={[styles.completedBannerText, { color: current.color }]}>
                      All {targetCount} {current.sense.toLowerCase()} observations anchored!
                    </ThemedText>
                  </View>
                )}

                {/* Step Navigation Dots */}
                <View style={styles.dotsRow}>
                  {steps.map((_, idx) => (
                    <TouchableOpacity
                      key={idx}
                      style={[
                        styles.dot,
                        activeStepIndex === idx && { backgroundColor: current.color, width: 22 },
                      ]}
                      activeOpacity={0.7}
                      onPress={() => animateStepChange(idx)}
                    />
                  ))}
                </View>
              </Animated.View>

              {/* Step Selector Grid */}
              <View style={styles.stepSelectorGrid}>
                {steps.map((s, idx) => {
                  const count = (sensoryItems[s.num] || []).length;
                  const target = parseInt(s.num, 10);
                  const isDone = count >= target;
                  return (
                    <TouchableOpacity
                      key={s.num}
                      style={[
                        styles.stepPill,
                        activeStepIndex === idx && { borderColor: s.color, backgroundColor: `${s.color}22` },
                      ]}
                      activeOpacity={0.7}
                      onPress={() => animateStepChange(idx)}
                    >
                      <ThemedText style={[styles.stepPillNum, { color: s.color }]}>
                        {isDone ? '✓ ' : ''}{s.num}
                      </ThemedText>
                      <ThemedText style={styles.stepPillSense}>{s.sense}</ThemedText>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>

            {/* Pinned Responsive Dock - ALWAYS directly above Gboard / Keyboard */}
            <View
              style={[
                styles.pinnedDockContainer,
                {
                  paddingBottom: keyboardHeight > 0
                    ? 8
                    : Math.max(10, insets.bottom),
                },
              ]}
            >
              {!isStepComplete ? (
                /* Active Input Bar */
                <View style={[styles.dockInputRow, { borderColor: `${current.color}65` }]}>
                  <View style={[styles.dockItemNumberBadge, { backgroundColor: `${current.color}22` }]}>
                    <ThemedText style={[styles.dockItemNumberText, { color: current.color }]}>
                      #{currentItems.length + 1}
                    </ThemedText>
                  </View>

                  <TextInput
                    ref={inputRef}
                    style={styles.dockSensoryInput}
                    placeholder={`Observation ${currentItems.length + 1} of ${targetCount} (e.g. water bottle)...`}
                    placeholderTextColor="rgba(255, 255, 255, 0.45)"
                    value={currentDraft}
                    onChangeText={setCurrentDraft}
                    onSubmitEditing={handleAddItem}
                    returnKeyType={currentItems.length + 1 >= targetCount ? 'done' : 'next'}
                    blurOnSubmit={false}
                    multiline={false}
                  />

                  <TouchableOpacity
                    style={[
                      styles.dockAddBtn,
                      { backgroundColor: currentDraft.trim() ? current.color : 'rgba(255, 255, 255, 0.08)' },
                    ]}
                    activeOpacity={0.8}
                    disabled={!currentDraft.trim()}
                    onPress={handleAddItem}
                  >
                    <Ionicons
                      name="arrow-up"
                      size={17}
                      color={currentDraft.trim() ? '#000000' : 'rgba(255, 255, 255, 0.3)'}
                    />
                  </TouchableOpacity>
                </View>
              ) : null}

              {/* Next Step / Complete CTA */}
              {(!isKeyboardVisible || isStepComplete) && (
                <TouchableOpacity
                  style={[styles.nextBtn, !isStepComplete && { marginTop: 6, backgroundColor: 'rgba(0, 229, 255, 0.9)' }]}
                  activeOpacity={0.7}
                  onPress={handleNextPress}
                >
                  <ThemedText style={styles.nextBtnText}>
                    {activeStepIndex < steps.length - 1
                      ? `Next: Step ${steps[activeStepIndex + 1].num} (${steps[activeStepIndex + 1].sense})`
                      : 'Next: Victory Feedback & Save'}
                  </ThemedText>
                  <Ionicons name="arrow-forward" size={17} color="#000000" />
                </TouchableOpacity>
              )}
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  blackBg: { flex: 1, backgroundColor: '#000000' },
  safeArea: { flex: 1, backgroundColor: '#000000' },
  mainFlexContainer: { flex: 1 },

  /* Header Bar */
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
    justifyContent: 'center',
    alignItems: 'center',
    padding: 4,
    ...webNoOutline,
  },
  stepIndicator: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#10B981',
    letterSpacing: 1.2,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#ffffff',
  },

  /* Scrollable Content */
  scrollContent: {
    padding: 16,
    gap: 14,
    alignItems: 'center',
    paddingBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#ffffff',
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  sub: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 340,
  },

  /* Hero Card */
  heroCard: {
    width: '100%',
    backgroundColor: 'rgba(18, 18, 18, 0.95)',
    borderRadius: 22,
    borderWidth: 1,
    padding: 18,
    gap: 10,
    marginTop: 4,
    ...webNoOutline,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  numBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  numText: {
    fontSize: 22,
    fontWeight: '800',
  },
  senseBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  senseBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  stepTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#ffffff',
  },
  stepInstruction: {
    fontSize: 13.5,
    color: '#CBD5E1',
    lineHeight: 20,
  },

  /* Progress Row & Pips */
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 2,
    marginTop: 2,
  },
  pipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  pip: {
    width: 16,
    height: 5,
    borderRadius: 2.5,
  },
  progressCountText: {
    fontSize: 11.5,
    fontWeight: '700',
  },

  /* Items List & Chips */
  itemsListContainer: {
    gap: 8,
    marginTop: 4,
  },
  itemChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 10,
    gap: 10,
  },
  itemIdxCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemIdxText: {
    fontSize: 11,
    fontWeight: '800',
  },
  itemText: {
    flex: 1,
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  removeItemBtn: {
    padding: 2,
  },

  /* Completed Banner */
  completedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: 4,
  },
  completedBannerText: {
    fontSize: 12.5,
    fontWeight: '700',
  },

  /* Dots */
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginTop: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },

  /* Step Selector Grid */
  stepSelectorGrid: {
    flexDirection: 'row',
    gap: 8,
    width: '100%',
    marginTop: 4,
  },
  stepPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: 'rgba(18, 18, 18, 0.95)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.15)',
    paddingVertical: 10,
    ...webNoOutline,
  },
  stepPillNum: {
    fontSize: 14,
    fontWeight: '800',
  },
  stepPillSense: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
  },

  /* Pinned Bottom Dock directly above Gboard */
  pinnedDockContainer: {
    backgroundColor: '#000000',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 14,
    paddingTop: 8,
  },
  dockInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0A0A0A',
    borderRadius: 22,
    borderWidth: 1.5,
    paddingHorizontal: 6,
    paddingVertical: 2,
    minHeight: 46,
  },
  dockItemNumberBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginLeft: 4,
    marginRight: 2,
  },
  dockItemNumberText: {
    fontSize: 11,
    fontWeight: '900',
  },
  dockSensoryInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 13.5,
    paddingHorizontal: 8,
    paddingVertical: Platform.OS === 'ios' ? 8 : 6,
    ...webNoOutline,
  },
  dockAddBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 4,
  },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#00E5FF',
    paddingVertical: 13,
    borderRadius: 14,
    ...webNoOutline,
  },
  nextBtnText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '800',
  },
});
