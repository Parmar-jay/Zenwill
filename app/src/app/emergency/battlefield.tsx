import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  Easing,
  Platform,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle, Defs, Stop, LinearGradient as SvgLinearGradient } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { ThemedText } from '../../components/themed-text';
import { useSpartanStore } from '../../store/spartan-store';
import { useAuthStore } from '../../store/auth-store';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const TOTAL_SESSION_SECONDS = 90;
const CIRCLE_SIZE = 190;
const STROKE_WIDTH = 5;
const RADIUS = (CIRCLE_SIZE - STROKE_WIDTH * 2) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const REACTION_RUNES = [
  { id: 'rune-1', text: 'Hold the line ⚔️', icon: 'shield-outline', color: '#00E5FF', bg: 'rgba(0, 229, 255, 0.12)' },
  { id: 'rune-2', text: 'Transmute it 🔥', icon: 'flame-outline', color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.12)' },
  { id: 'rune-3', text: 'You are sovereign 👑', icon: 'ribbon-outline', color: '#10B981', bg: 'rgba(16, 185, 129, 0.12)' },
  { id: 'rune-4', text: 'Breathe with me 🛡️', icon: 'water-outline', color: '#38BDF8', bg: 'rgba(56, 189, 248, 0.12)' },
  { id: 'rune-5', text: 'Pure Ojas ⚡', icon: 'flash-outline', color: '#EAB308', bg: 'rgba(234, 179, 8, 0.12)' },
  { id: 'rune-6', text: 'Unbreakable 💎', icon: 'diamond-outline', color: '#A855F7', bg: 'rgba(168, 85, 247, 0.12)' },
  { id: 'rune-7', text: 'Stand firm 🛡️', icon: 'shield-checkmark-outline', color: '#06B6D4', bg: 'rgba(6, 182, 212, 0.12)' },
  { id: 'rune-8', text: 'Iron will 🦾', icon: 'fitness-outline', color: '#EC4899', bg: 'rgba(236, 72, 153, 0.12)' },
  { id: 'rune-9', text: 'Victory is ours 🏆', icon: 'trophy-outline', color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.12)' },
  { id: 'rune-10', text: 'Channel the surge 🌊', icon: 'boat-outline', color: '#3B82F6', bg: 'rgba(59, 130, 246, 0.12)' },
  { id: 'rune-11', text: 'Stay rooted 🌲', icon: 'leaf-outline', color: '#22C55E', bg: 'rgba(34, 197, 94, 0.12)' },
];

const BREATH_PHASES = [
  { label: 'INHALE', sub: 'Draw strength inward', duration: 4000, color: '#00E5FF', tip: 'Slow, deep breath through the nose. Fill the diaphragm completely.' },
  { label: 'HOLD', sub: 'Transmute into willpower', duration: 4000, color: '#F59E0B', tip: 'Stillness. Transmute raw urge energy into willpower and focus.' },
  { label: 'EXHALE', sub: 'Release all tension', duration: 6000, color: '#10B981', tip: 'Controlled, smooth exhale through the mouth. Ground your energy.' },
];

interface FloatingRune {
  id: string;
  text: string;
  color: string;
  animY: Animated.Value;
  animOpacity: Animated.Value;
  animScale: Animated.Value;
  xOffset: number;
}

export default function SpartanBattlefieldScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const {
    activeBattle,
    fetchActiveBattle,
    triggerBattleHorn,
    joinActiveBattle,
    sendReactionRune,
    completeBattle,
  } = useSpartanStore();

  const [secondsLeft, setSecondsLeft] = useState<number>(90);
  const [phaseIndex, setPhaseIndex] = useState<number>(0);
  const [phaseSecondsRemaining, setPhaseSecondsRemaining] = useState<number>(4);
  const [isCompleted, setIsCompleted] = useState<boolean>(false);
  const [isInitiating, setIsInitiating] = useState<boolean>(false);
  const [floatingRunes, setFloatingRunes] = useState<FloatingRune[]>([]);
  const [nowMs, setNowMs] = useState<number>(Date.now());

  // Smooth Animations
  const victoryScale = useRef(new Animated.Value(0.8)).current;
  const breathScaleAnim = useRef(new Animated.Value(1)).current;
  const timerRef = useRef<any>(null);
  const phaseTimerRef = useRef<any>(null);
  const pollRef = useRef<any>(null);
  const clockRef = useRef<any>(null);

  const triggerHaptic = useCallback((style: 'light' | 'medium' | 'heavy' = 'light') => {
    try {
      if (Platform.OS !== 'web') {
        if (style === 'heavy') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        else if (style === 'medium') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        else Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch {}
  }, []);

  // Update wall clock every second for individual participant timeline calculation
  useEffect(() => {
    clockRef.current = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => {
      if (clockRef.current) clearInterval(clockRef.current);
    };
  }, []);

  // Initialize or Join Battle Session
  useEffect(() => {
    let isMounted = true;

    async function initSession() {
      setIsInitiating(true);
      try {
        let session = await fetchActiveBattle();
        if (!session) {
          session = await triggerBattleHorn(user?.name ? `${user.name}'s Sanctum` : 'Global Sanctum');
        } else if (!session.is_joined) {
          session = await joinActiveBattle(session.id);
        }

        if (isMounted && session) {
          setSecondsLeft(session.time_remaining_seconds || 90);
        }
      } catch (err) {
        console.log('Battlefield init error:', err);
      } finally {
        if (isMounted) setIsInitiating(false);
      }
    }

    initSession();

    // Fast 1.5s real-time poll for live feeds and user timelines
    pollRef.current = setInterval(() => {
      fetchActiveBattle().catch(() => {});
    }, 1500);

    return () => {
      isMounted = false;
      if (pollRef.current) clearInterval(pollRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
      if (phaseTimerRef.current) clearInterval(phaseTimerRef.current);
    };
  }, []);

  // Simple, Rock-Solid 90s Countdown Timer
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          setIsCompleted(true);
          triggerHaptic('heavy');
          Animated.spring(victoryScale, {
            toValue: 1,
            friction: 5,
            tension: 40,
            useNativeDriver: true,
          }).start();
          if (activeBattle?.id) {
            completeBattle(activeBattle.id).catch(() => {});
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [activeBattle?.id, victoryScale, completeBattle, triggerHaptic]);

  // Synchronized Diaphragmatic Breath Phase Loop with Smooth Breathing Scale
  useEffect(() => {
    let isCancelled = false;

    function runBreathPhase(idx: number) {
      if (isCancelled || isCompleted) return;
      const phase = BREATH_PHASES[idx];
      setPhaseIndex(idx);
      const phaseDurationSec = Math.round(phase.duration / 1000);
      setPhaseSecondsRemaining(phaseDurationSec);
      triggerHaptic('light');

      // Smooth Scale Transition
      if (idx === 0) {
        // Inhale: expand
        Animated.timing(breathScaleAnim, {
          toValue: 1.06,
          duration: phase.duration,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }).start();
      } else if (idx === 2) {
        // Exhale: contract
        Animated.timing(breathScaleAnim, {
          toValue: 0.98,
          duration: phase.duration,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }).start();
      }

      let currentSec = phaseDurationSec;
      if (phaseTimerRef.current) clearInterval(phaseTimerRef.current);
      phaseTimerRef.current = setInterval(() => {
        currentSec -= 1;
        if (currentSec >= 0) {
          setPhaseSecondsRemaining(currentSec);
        }
      }, 1000);

      setTimeout(() => {
        if (phaseTimerRef.current) clearInterval(phaseTimerRef.current);
        if (!isCancelled && !isCompleted) {
          runBreathPhase((idx + 1) % BREATH_PHASES.length);
        }
      }, phase.duration);
    }

    runBreathPhase(0);

    return () => {
      isCancelled = true;
      if (phaseTimerRef.current) clearInterval(phaseTimerRef.current);
    };
  }, [isCompleted, breathScaleAnim, triggerHaptic]);

  // Spawn Twitch/Live-Stream Floating Reaction Rune
  const handleSendRune = async (runeText: string, color: string) => {
    triggerHaptic('medium');

    const runeId = `${Date.now()}-${Math.random()}`;
    const animY = new Animated.Value(0);
    const animOpacity = new Animated.Value(1);
    const animScale = new Animated.Value(0.7);
    const xOffset = Math.floor(Math.random() * 180) - 90;

    const newFloatingRune: FloatingRune = {
      id: runeId,
      text: runeText,
      color,
      animY,
      animOpacity,
      animScale,
      xOffset,
    };

    setFloatingRunes((prev) => [...prev, newFloatingRune]);

    Animated.parallel([
      Animated.timing(animY, {
        toValue: -260,
        duration: 1700,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(animScale, {
        toValue: 1.15,
        friction: 4,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.delay(1000),
        Animated.timing(animOpacity, {
          toValue: 0,
          duration: 700,
          useNativeDriver: true,
        }),
      ]),
    ]).start(() => {
      setFloatingRunes((prev) => prev.filter((r) => r.id !== runeId));
    });

    if (activeBattle?.id) {
      await sendReactionRune(activeBattle.id, runeText);
    }
  };

  const currentPhase = BREATH_PHASES[phaseIndex];
  const participantCount = activeBattle?.participant_count || 1;
  const initiatorName = activeBattle?.initiator_name || 'Brother Warrior';

  // SVG Progress calculation
  const progressRatio = Math.max(0, Math.min(1, secondsLeft / TOTAL_SESSION_SECONDS));
  const strokeDashoffset = CIRCUMFERENCE * (1 - progressRatio);

  // Parse real-time reactions feed in chronological order
  const liveReactions = useMemo(() => {
    return (activeBattle?.reactions || []).slice(-15).reverse();
  }, [activeBattle?.reactions]);

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
            <View style={styles.liveBadgeRow}>
              <View style={styles.liveDot} />
              <ThemedText style={styles.liveBadgeText}>90s SHIELD WALL ACTIVE</ThemedText>
            </View>
            <ThemedText style={styles.headerTitle}>Spartan Battlefield</ThemedText>
          </View>

          <View style={{ width: 38 }} />
        </View>

        {isInitiating ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#00E5FF" />
            <ThemedText style={styles.loadingText}>Blowing the Spartan Battle Horn...</ThemedText>
          </View>
        ) : (
          <ScrollView
            style={styles.scrollContent}
            contentContainerStyle={styles.scrollInner}
            showsVerticalScrollIndicator={false}
          >
            {/* Initiator Banner Alert */}
            <View style={styles.initiatorCard}>
              <View style={styles.initiatorLeftGlow}>
                <ThemedText style={{ fontSize: 22 }}>⚔️</ThemedText>
              </View>
              <View style={styles.initiatorTextWrapper}>
                <ThemedText style={styles.initiatorHeadline}>
                  Brother {initiatorName} sounded the Horn
                </ThemedText>
                <ThemedText style={styles.initiatorSub}>
                  {participantCount} {participantCount === 1 ? 'Spartan standing' : 'Spartans standing'} united against the urge wave in synchronous breath.
                </ThemedText>
              </View>
            </View>

            {/* Simple, Clean, High-Contrast SVG Countdown Ring with Smooth Breath Scaling */}
            <View style={styles.centerStage}>
              <Animated.View style={[styles.svgWrapper, { transform: [{ scale: breathScaleAnim }] }]}>
                <Svg width={CIRCLE_SIZE} height={CIRCLE_SIZE} viewBox={`0 0 ${CIRCLE_SIZE} ${CIRCLE_SIZE}`}>
                  <Defs>
                    <SvgLinearGradient id="timerGrad" x1="0" y1="0" x2="1" y2="1">
                      <Stop offset="0%" stopColor="#00E5FF" />
                      <Stop offset="50%" stopColor={currentPhase.color} />
                      <Stop offset="100%" stopColor="#10B981" />
                    </SvgLinearGradient>
                  </Defs>

                  {/* Track Circle */}
                  <Circle
                    cx={CIRCLE_SIZE / 2}
                    cy={CIRCLE_SIZE / 2}
                    r={RADIUS}
                    stroke="rgba(255, 255, 255, 0.07)"
                    strokeWidth={STROKE_WIDTH}
                    fill="#070C16"
                  />

                  {/* Animated Progress Ring */}
                  <Circle
                    cx={CIRCLE_SIZE / 2}
                    cy={CIRCLE_SIZE / 2}
                    r={RADIUS}
                    stroke="url(#timerGrad)"
                    strokeWidth={STROKE_WIDTH}
                    fill="transparent"
                    strokeDasharray={`${CIRCUMFERENCE} ${CIRCUMFERENCE}`}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                    transform={`rotate(-90 ${CIRCLE_SIZE / 2} ${CIRCLE_SIZE / 2})`}
                  />
                </Svg>

                {/* Central Numbers Content */}
                <View style={styles.timerCenterContent}>
                  <View style={styles.timerNumberRow}>
                    <Text style={styles.timerBigNumber}>{secondsLeft}</Text>
                    <Text style={styles.timerUnitText}>s</Text>
                  </View>

                  {/* Phase Pill */}
                  <View style={[styles.phasePill, { backgroundColor: currentPhase.color + '22', borderColor: currentPhase.color }]}>
                    <Text style={[styles.phasePillText, { color: currentPhase.color }]}>
                      {currentPhase.label} • {phaseSecondsRemaining}s
                    </Text>
                  </View>
                </View>
              </Animated.View>

              {/* Floating Real-Time Reaction Runes */}
              {floatingRunes.map((rune) => (
                <Animated.View
                  key={rune.id}
                  style={[
                    styles.floatingRuneContainer,
                    {
                      transform: [
                        { translateX: rune.xOffset },
                        { translateY: rune.animY },
                        { scale: rune.animScale },
                      ],
                      opacity: rune.animOpacity,
                    },
                  ]}
                  pointerEvents="none"
                >
                  <View style={[styles.floatingRuneBubble, { borderColor: rune.color }]}>
                    <Text style={[styles.floatingRuneText, { color: rune.color }]}>
                      {rune.text}
                    </Text>
                  </View>
                </Animated.View>
              ))}
            </View>

            {/* Dynamic Neuro-Reset Tip Banner */}
            <View style={[styles.guidanceBox, { borderColor: currentPhase.color + '35' }]}>
              <Ionicons name="sparkles" size={15} color={currentPhase.color} style={{ marginRight: 8 }} />
              <ThemedText style={styles.guidanceTip}>{currentPhase.tip}</ThemedText>
            </View>

            {/* Shield Brothers Standing Live Strip with Individual Timelines */}
            <View style={styles.warriorsSection}>
              <View style={styles.sectionTitleRow}>
                <Ionicons name="shield-checkmark-outline" size={14} color="#00E5FF" />
                <ThemedText style={styles.sectionTitleText}>WARRIORS IN ROOM WITH INDIVIDUAL TIMELINES ({participantCount})</ThemedText>
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.warriorScroll}
              >
                {activeBattle?.participants?.map((p, idx) => {
                  const isCurrent = p.user_id === String(user?.id || '');
                  
                  // Compute individual duration in the room
                  let userElapsedSec = 90 - secondsLeft;
                  if (p.joined_at) {
                    const joinedMs = new Date(p.joined_at).getTime();
                    if (!isNaN(joinedMs) && joinedMs > 0) {
                      userElapsedSec = Math.max(1, Math.min(90, Math.floor((nowMs - joinedMs) / 1000)));
                    }
                  }
                  const userTimelinePct = Math.min(100, Math.round((userElapsedSec / 90) * 100));

                  return (
                    <View key={`${p.user_id}-${idx}`} style={[styles.warriorPill, isCurrent && styles.warriorPillSelf]}>
                      <View style={styles.warriorTopRow}>
                        <View style={[styles.warriorAvatar, isCurrent && { backgroundColor: 'rgba(0, 229, 255, 0.3)' }]}>
                          <ThemedText style={styles.warriorAvatarText}>
                            {p.name ? p.name.charAt(0).toUpperCase() : 'W'}
                          </ThemedText>
                          <View style={styles.onlineDot} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <ThemedText style={[styles.warriorName, isCurrent && { color: '#00E5FF', fontWeight: '800' }]} numberOfLines={1}>
                            {p.name || 'Spartan'} {isCurrent ? '(You)' : ''}
                          </ThemedText>
                          <ThemedText style={styles.warriorStatusSub}>
                            {isCurrent ? '⚡ Active Shield' : '🛡️ Holding Line'}
                          </ThemedText>
                        </View>
                      </View>

                      {/* Individual Participant Timeline Progress Bar */}
                      <View style={styles.memberTimelineContainer}>
                        <View style={styles.memberTimelineTrack}>
                          <View style={[styles.memberTimelineFill, { width: `${userTimelinePct}%` }]} />
                        </View>
                        <View style={styles.memberTimelineMeta}>
                          <ThemedText style={styles.memberTimelineTimeText}>{userElapsedSec}s in sync</ThemedText>
                          <ThemedText style={styles.memberTimelinePctText}>{userTimelinePct}%</ThemedText>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </ScrollView>
            </View>

            {/* Brotherhood Reaction Runes Grid (11+ Reactions) */}
            <View style={styles.runesSection}>
              <View style={styles.runesHeaderRow}>
                <Ionicons name="flash-outline" size={14} color="#F59E0B" />
                <ThemedText style={styles.runesTitle}>BROTHERHOOD RUNES (1-TAP BURST)</ThemedText>
              </View>
              <View style={styles.runesGrid}>
                {REACTION_RUNES.map((rune) => (
                  <TouchableOpacity
                    key={rune.id}
                    style={[styles.runeButton, { backgroundColor: rune.bg, borderColor: rune.color }]}
                    activeOpacity={0.65}
                    onPress={() => handleSendRune(rune.text, rune.color)}
                  >
                    <Ionicons name={rune.icon as any} size={15} color={rune.color} />
                    <Text style={[styles.runeButtonText, { color: rune.color }]}>
                      {rune.text}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Live Real-Time Activity Feed of Every User */}
            <View style={styles.feedSection}>
              <View style={styles.feedHeaderRow}>
                <Ionicons name="radio-outline" size={14} color="#10B981" />
                <ThemedText style={styles.feedTitle}>LIVE ROOM TELEMETRY FEED</ThemedText>
              </View>

              <View style={styles.feedContainer}>
                {liveReactions.length === 0 ? (
                  <ThemedText style={styles.feedEmptyText}>
                    Sync room active. Tap reaction runes above to broadcast live encouragement to the shield wall!
                  </ThemedText>
                ) : (
                  liveReactions.map((rec, rIdx) => {
                    const isSelf = rec.user_id === String(user?.id || '');
                    return (
                      <View key={`${rec.created_at}-${rIdx}`} style={[styles.feedItem, isSelf && styles.feedItemSelf]}>
                        <View style={styles.feedDot} />
                        <View style={{ flex: 1 }}>
                          <View style={styles.feedMetaRow}>
                            <ThemedText style={styles.feedAuthorName}>
                              {rec.user_name || 'Warrior'} {isSelf ? '(You)' : ''}
                            </ThemedText>
                            <ThemedText style={styles.feedTime}>
                              {rec.created_at ? new Date(rec.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'Live'}
                            </ThemedText>
                          </View>
                          <ThemedText style={styles.feedRuneContent}>{rec.rune}</ThemedText>
                        </View>
                      </View>
                    );
                  })
                )}
              </View>
            </View>

            <View style={{ height: 40 }} />
          </ScrollView>
        )}

        {/* Victory Completion Modal Overlay */}
        {isCompleted && (
          <View style={styles.victoryOverlay}>
            <Animated.View style={[styles.victoryCard, { transform: [{ scale: victoryScale }] }]}>
              <View style={styles.victoryIconCircle}>
                <Ionicons name="shield-checkmark" size={38} color="#00E5FF" />
              </View>
              <ThemedText style={styles.victoryTitle}>URGE WAVE CONQUERED</ThemedText>
              <ThemedText style={styles.victoryBody}>
                The line held strong. You and your Spartan brothers stood united in synchronous breath.
              </ThemedText>
              <View style={styles.victoryRewardBadge}>
                <Ionicons name="flash" size={16} color="#F59E0B" style={{ marginRight: 6 }} />
                <ThemedText style={styles.victoryRewardText}>+25 Honor Points Added to Cohort Honor</ThemedText>
              </View>

              <TouchableOpacity
                style={styles.victoryBtn}
                activeOpacity={0.85}
                onPress={() => {
                  triggerHaptic('light');
                  router.back();
                }}
              >
                <ThemedText style={styles.victoryBtnText}>Return Victorious</ThemedText>
              </TouchableOpacity>
            </Animated.View>
          </View>
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
  liveBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#EF4444',
  },
  liveBadgeText: {
    fontSize: 9.5,
    fontWeight: '900',
    color: '#00E5FF',
    letterSpacing: 1.2,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.2,
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
    paddingTop: 12,
  },
  initiatorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 229, 255, 0.05)',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.25)',
    marginBottom: 12,
    gap: 10,
  },
  initiatorLeftGlow: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 229, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.3)',
  },
  initiatorTextWrapper: {
    flex: 1,
  },
  initiatorHeadline: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  initiatorSub: {
    fontSize: 11,
    color: '#94A3B8',
    lineHeight: 15,
  },
  centerStage: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    position: 'relative',
  },
  svgWrapper: {
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  timerCenterContent: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerNumberRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  timerBigNumber: {
    fontSize: 50,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -2,
    lineHeight: 56,
  },
  timerUnitText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#00E5FF',
    marginLeft: 2,
  },
  phasePill: {
    marginTop: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  phasePillText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  floatingRuneContainer: {
    position: 'absolute',
    bottom: 20,
    alignSelf: 'center',
  },
  floatingRuneBubble: {
    backgroundColor: 'rgba(7, 12, 22, 0.95)',
    borderWidth: 1.5,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    shadowColor: '#00E5FF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 8,
  },
  floatingRuneText: {
    fontSize: 12,
    fontWeight: '900',
  },
  guidanceBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.025)',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    marginBottom: 14,
  },
  guidanceTip: {
    fontSize: 11.5,
    color: 'rgba(255, 255, 255, 0.8)',
    flex: 1,
    lineHeight: 16,
    fontWeight: '500',
  },
  warriorsSection: {
    marginBottom: 14,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  sectionTitleText: {
    fontSize: 10,
    fontWeight: '900',
    color: 'rgba(255, 255, 255, 0.5)',
    letterSpacing: 0.8,
  },
  warriorScroll: {
    gap: 8,
  },
  warriorPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 14,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    width: 155,
  },
  warriorPillSelf: {
    borderColor: 'rgba(0, 229, 255, 0.4)',
    backgroundColor: 'rgba(0, 229, 255, 0.04)',
  },
  warriorTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  warriorAvatar: {
    width: 28,
    height: 28,
    borderRadius: 9,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  warriorAvatarText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#00E5FF',
  },
  onlineDot: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#10B981',
    borderWidth: 1,
    borderColor: '#000000',
  },
  warriorName: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  warriorStatusSub: {
    fontSize: 9.5,
    color: '#94A3B8',
    fontWeight: '500',
  },
  memberTimelineContainer: {
    marginTop: 2,
  },
  memberTimelineTrack: {
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 4,
  },
  memberTimelineFill: {
    height: '100%',
    backgroundColor: '#00E5FF',
    borderRadius: 2,
  },
  memberTimelineMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  memberTimelineTimeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#00E5FF',
  },
  memberTimelinePctText: {
    fontSize: 9,
    fontWeight: '600',
    color: '#64748B',
  },
  runesSection: {
    marginBottom: 14,
  },
  runesHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  runesTitle: {
    fontSize: 10,
    fontWeight: '900',
    color: 'rgba(255, 255, 255, 0.5)',
    letterSpacing: 0.8,
  },
  runesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  runeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    gap: 5,
  },
  runeButtonText: {
    fontSize: 11,
    fontWeight: '800',
  },
  feedSection: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    marginBottom: 14,
  },
  feedHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  feedTitle: {
    fontSize: 10,
    fontWeight: '900',
    color: 'rgba(255, 255, 255, 0.5)',
    letterSpacing: 0.8,
  },
  feedContainer: {
    gap: 6,
  },
  feedEmptyText: {
    fontSize: 11,
    color: '#64748B',
    lineHeight: 16,
    textAlign: 'center',
    paddingVertical: 8,
  },
  feedItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.025)',
    borderRadius: 10,
    padding: 8,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
  },
  feedItemSelf: {
    borderColor: 'rgba(0, 229, 255, 0.25)',
    backgroundColor: 'rgba(0, 229, 255, 0.03)',
  },
  feedDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#00E5FF',
    marginTop: 5,
  },
  feedMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  feedAuthorName: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  feedTime: {
    fontSize: 9.5,
    color: '#64748B',
    fontWeight: '600',
  },
  feedRuneContent: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '500',
  },
  victoryOverlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  victoryCard: {
    width: '100%',
    backgroundColor: '#0B1120',
    borderRadius: 22,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#00E5FF',
    shadowColor: '#00E5FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  victoryIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(0, 229, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(0, 229, 255, 0.4)',
  },
  victoryTitle: {
    fontSize: 19,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.5,
    marginBottom: 8,
    textAlign: 'center',
  },
  victoryBody: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 16,
    paddingHorizontal: 6,
  },
  victoryRewardBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.4)',
    marginBottom: 20,
  },
  victoryRewardText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#F59E0B',
  },
  victoryBtn: {
    width: '100%',
    backgroundColor: '#00E5FF',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  victoryBtnText: {
    fontSize: 13.5,
    fontWeight: '900',
    color: '#000000',
    letterSpacing: 0.3,
  },
});
