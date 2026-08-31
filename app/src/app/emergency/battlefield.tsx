import React, { useState, useEffect, useRef, useCallback } from 'react';
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
import Svg, { Circle, Defs, RadialGradient, Stop, LinearGradient as SvgLinearGradient } from 'react-native-svg';
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

  // Smooth Animations
  const victoryScale = useRef(new Animated.Value(0.8)).current;
  const timerRef = useRef<any>(null);
  const phaseTimerRef = useRef<any>(null);
  const pollRef = useRef<any>(null);

  const triggerHaptic = useCallback((style: 'light' | 'medium' | 'heavy' = 'light') => {
    try {
      if (Platform.OS !== 'web') {
        if (style === 'heavy') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        else if (style === 'medium') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        else Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch {}
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

    pollRef.current = setInterval(() => {
      fetchActiveBattle().catch(() => {});
    }, 2500);

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
  }, [activeBattle?.id]);

  // Synchronized Diaphragmatic Breath Phase Loop
  useEffect(() => {
    let isCancelled = false;

    function runBreathPhase(idx: number) {
      if (isCancelled || isCompleted) return;
      const phase = BREATH_PHASES[idx];
      setPhaseIndex(idx);
      const phaseDurationSec = Math.round(phase.duration / 1000);
      setPhaseSecondsRemaining(phaseDurationSec);
      triggerHaptic('light');

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
  }, [isCompleted]);

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

            {/* Simple, Clean, High-Contrast SVG Countdown Ring */}
            <View style={styles.centerStage}>
              <View style={styles.svgWrapper}>
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
              </View>

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

            {/* Shield Brothers Standing Live Strip */}
            <View style={styles.warriorsSection}>
              <View style={styles.sectionTitleRow}>
                <Ionicons name="shield-checkmark-outline" size={14} color="#00E5FF" />
                <ThemedText style={styles.sectionTitleText}>WARRIORS STANDING WITH YOU LIVE ({participantCount})</ThemedText>
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.warriorScroll}
              >
                {activeBattle?.participants?.map((p, idx) => {
                  const isCurrent = p.user_id === String(user?.id || '');
                  return (
                    <View key={`${p.user_id}-${idx}`} style={[styles.warriorPill, isCurrent && styles.warriorPillSelf]}>
                      <View style={[styles.warriorAvatar, isCurrent && { backgroundColor: 'rgba(0, 229, 255, 0.3)' }]}>
                        <ThemedText style={styles.warriorAvatarText}>
                          {p.name ? p.name.charAt(0).toUpperCase() : 'W'}
                        </ThemedText>
                        <View style={styles.onlineDot} />
                      </View>
                      <View style={{ flexShrink: 1 }}>
                        <ThemedText style={[styles.warriorName, isCurrent && { color: '#00E5FF', fontWeight: '800' }]} numberOfLines={1}>
                          {p.name || 'Spartan'} {isCurrent ? '(You)' : ''}
                        </ThemedText>
                        <ThemedText style={styles.warriorStatusSub}>
                          {isCurrent ? 'Active Shield' : 'Holding Line'}
                        </ThemedText>
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

            {/* Live Incoming Tactical War Room Feed */}
            {activeBattle?.reactions && activeBattle.reactions.length > 0 && (
              <View style={styles.streamSection}>
                <ThemedText style={styles.streamTitle}>TACTICAL WAR ROOM FEED</ThemedText>
                <View style={styles.streamList}>
                  {activeBattle.reactions.slice(-5).map((r, i) => (
                    <View key={i} style={styles.streamItem}>
                      <Ionicons name="flash" size={12} color="#F59E0B" style={{ marginRight: 6 }} />
                      <ThemedText style={styles.streamText}>
                        <ThemedText style={styles.streamAuthor}>{r.user_name}: </ThemedText>
                        {r.rune}
                      </ThemedText>
                    </View>
                  ))}
                </View>
              </View>
            )}

            <View style={{ height: 40 }} />
          </ScrollView>
        )}

        {/* Victory Completion Modal Overlay */}
        {isCompleted && (
          <View style={styles.victoryOverlay}>
            <Animated.View style={[styles.victoryCard, { transform: [{ scale: victoryScale }] }]}>
              <View style={styles.victoryTrophyCircle}>
                <ThemedText style={{ fontSize: 44 }}>🏆</ThemedText>
              </View>
              <ThemedText style={styles.victoryTitle}>THE SHIELD WALL HELD!</ThemedText>
              <ThemedText style={styles.victoryBody}>
                You stood shoulder-to-shoulder with your brothers for 90 full seconds. The urge wave is transmuted into pure sovereignty.
              </ThemedText>
              <View style={styles.victoryRewardBadge}>
                <Ionicons name="shield-checkmark" size={17} color="#F59E0B" style={{ marginRight: 6 }} />
                <ThemedText style={styles.victoryRewardText}>+25 Brotherhood Honor Points Awarded</ThemedText>
              </View>

              <TouchableOpacity
                style={styles.victoryBtn}
                activeOpacity={0.85}
                onPress={() => {
                  triggerHaptic('medium');
                  router.back();
                }}
              >
                <ThemedText style={styles.victoryBtnText}>Return to Headquarters</ThemedText>
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
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginBottom: 3,
    borderWidth: 0.5,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#EF4444',
    marginRight: 5,
  },
  liveBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#EF4444',
    letterSpacing: 0.8,
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
    fontSize: 14,
    color: '#94A3B8',
    marginTop: 14,
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
    backgroundColor: 'rgba(239, 68, 68, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
    gap: 12,
  },
  initiatorLeftGlow: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.35)',
  },
  initiatorTextWrapper: {
    flex: 1,
  },
  initiatorHeadline: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  initiatorSub: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.7)',
    lineHeight: 15,
  },
  centerStage: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 210,
    position: 'relative',
    marginVertical: 4,
  },
  svgWrapper: {
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerCenterContent: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '100%',
  },
  timerNumberRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    marginBottom: 4,
  },
  timerBigNumber: {
    fontSize: 52,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -1,
    lineHeight: 56,
  },
  timerUnitText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#00E5FF',
    marginLeft: 2,
    marginBottom: 6,
  },
  phasePill: {
    paddingHorizontal: 10,
    paddingVertical: 3.5,
    borderRadius: 10,
    borderWidth: 1,
  },
  phasePillText: {
    fontSize: 11.5,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  floatingRuneContainer: {
    position: 'absolute',
    bottom: 30,
    alignSelf: 'center',
    zIndex: 100,
  },
  floatingRuneBubble: {
    backgroundColor: 'rgba(10, 16, 28, 0.94)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 8,
  },
  floatingRuneText: {
    fontSize: 12.5,
    fontWeight: '900',
  },
  guidanceBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    marginBottom: 12,
  },
  guidanceTip: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.85)',
    fontWeight: '600',
    textAlign: 'center',
    flex: 1,
  },
  warriorsSection: {
    marginBottom: 14,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  sectionTitleText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#00E5FF',
    letterSpacing: 0.8,
  },
  warriorScroll: {
    gap: 8,
  },
  warriorPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.035)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 16,
    paddingVertical: 7,
    paddingHorizontal: 11,
    gap: 8,
  },
  warriorPillSelf: {
    borderColor: 'rgba(0, 229, 255, 0.4)',
    backgroundColor: 'rgba(0, 229, 255, 0.06)',
  },
  warriorAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0, 229, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  warriorAvatarText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#00E5FF',
  },
  onlineDot: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
    borderWidth: 1.5,
    borderColor: '#000',
  },
  warriorName: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#FFFFFF',
    maxWidth: 110,
  },
  warriorStatusSub: {
    fontSize: 9.5,
    color: '#94A3B8',
    fontWeight: '500',
  },
  runesSection: {
    marginBottom: 14,
  },
  runesHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 10,
  },
  runesTitle: {
    fontSize: 10.5,
    fontWeight: '800',
    color: 'rgba(255, 255, 255, 0.6)',
    letterSpacing: 0.8,
  },
  runesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  runeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1.2,
    gap: 6,
  },
  runeButtonText: {
    fontSize: 12,
    fontWeight: '800',
  },
  streamSection: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  streamTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: 'rgba(255, 255, 255, 0.45)',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  streamList: {
    gap: 6,
  },
  streamItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  streamText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    lineHeight: 16,
  },
  streamAuthor: {
    fontWeight: '800',
    color: '#00E5FF',
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
    backgroundColor: '#0C1220',
    borderRadius: 22,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#F59E0B',
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  victoryTrophyCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  victoryTitle: {
    fontSize: 20,
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
    fontSize: 14,
    fontWeight: '900',
    color: '#000000',
    letterSpacing: 0.3,
  },
});
