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
import Svg, { Circle, Defs, RadialGradient, Stop, LinearGradient as SvgLinearGradient, Rect } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { ThemedText } from '../../components/themed-text';
import { useSpartanStore } from '../../store/spartan-store';
import { useAuthStore } from '../../store/auth-store';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const REACTION_RUNES = [
  { id: 'rune-1', text: 'Hold the line ⚔️', icon: 'shield-outline', color: '#00E5FF', bg: 'rgba(0, 229, 255, 0.12)' },
  { id: 'rune-2', text: 'Transmute it 🔥', icon: 'flame-outline', color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.12)' },
  { id: 'rune-3', text: 'You are sovereign 👑', icon: 'ribbon-outline', color: '#10B981', bg: 'rgba(16, 185, 129, 0.12)' },
  { id: 'rune-4', text: 'Breathe with me 🛡️', icon: 'water-outline', color: '#38BDF8', bg: 'rgba(56, 189, 248, 0.12)' },
  { id: 'rune-5', text: 'Pure Ojas ⚡', icon: 'flash-outline', color: '#EAB308', bg: 'rgba(234, 179, 8, 0.12)' },
];

const BREATH_PHASES = [
  { label: 'INHALE', sub: 'Draw life-force inward', duration: 4000, targetScale: 1.28, color: '#00E5FF', tip: 'Slow, deep breath through the nose. Fill the diaphragm completely.' },
  { label: 'HOLD', sub: 'Transmute into sovereignty', duration: 4000, targetScale: 1.28, color: '#F59E0B', tip: 'Feel raw urge energy transforming into stillness and willpower.' },
  { label: 'EXHALE', sub: 'Release all tension', duration: 6000, targetScale: 0.92, color: '#10B981', tip: 'Smooth, controlled exhale through the mouth. Ground your energy.' },
];

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
  const [isCompleted, setIsCompleted] = useState<boolean>(false);
  const [isInitiating, setIsInitiating] = useState<boolean>(false);

  // Dynamic Animations
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const outerRingAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0.35)).current;
  const victoryScale = useRef(new Animated.Value(0.8)).current;
  const timerRef = useRef<any>(null);
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
    };
  }, []);

  // Countdown Timer
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

  // Synchronized Diaphragmatic Breath Resonance Loop
  useEffect(() => {
    let isCancelled = false;

    function runBreathPhase(idx: number) {
      if (isCancelled || isCompleted) return;
      const phase = BREATH_PHASES[idx];
      setPhaseIndex(idx);
      triggerHaptic('light');

      Animated.parallel([
        Animated.timing(pulseAnim, {
          toValue: phase.targetScale,
          duration: phase.duration,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(outerRingAnim, {
          toValue: phase.targetScale * 1.15,
          duration: phase.duration,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: idx === 1 ? 0.95 : 0.45,
          duration: phase.duration,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]).start(() => {
        if (!isCancelled && !isCompleted) {
          runBreathPhase((idx + 1) % BREATH_PHASES.length);
        }
      });
    }

    runBreathPhase(0);

    return () => {
      isCancelled = true;
    };
  }, [isCompleted]);

  const handleSendRune = async (runeText: string) => {
    triggerHaptic('medium');
    if (activeBattle?.id) {
      await sendReactionRune(activeBattle.id, runeText);
    }
  };

  const currentPhase = BREATH_PHASES[phaseIndex];
  const participantCount = activeBattle?.participant_count || 1;
  const initiatorName = activeBattle?.initiator_name || 'Brother Warrior';

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
              <ThemedText style={styles.liveBadgeText}>90s SHIELD ROOM ACTIVE</ThemedText>
            </View>
            <ThemedText style={styles.headerTitle}>Spartan Battlefield</ThemedText>
          </View>

          <View style={styles.honorBadge}>
            <Ionicons name="shield" size={13} color="#F59E0B" />
            <ThemedText style={styles.honorBadgeText}>+25 XP</ThemedText>
          </View>
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
            {/* Initiator Live Alert Card */}
            <View style={styles.initiatorCard}>
              <View style={styles.initiatorLeftGlow}>
                <ThemedText style={{ fontSize: 22 }}>⚔️</ThemedText>
              </View>
              <View style={styles.initiatorTextWrapper}>
                <ThemedText style={styles.initiatorHeadline}>
                  Brother {initiatorName} sounded the Horn
                </ThemedText>
                <ThemedText style={styles.initiatorSub}>
                  {participantCount} {participantCount === 1 ? 'Spartan stands' : 'Spartans stand'} locked in synchronous diaphragmatic breathing.
                </ThemedText>
              </View>
            </View>

            {/* Central Synchronized Resonance Core */}
            <View style={styles.centerStage}>
              {/* Outer Atmospheric Aura */}
              <Animated.View
                style={[
                  styles.outerAtmosphere,
                  {
                    opacity: glowAnim,
                    transform: [{ scale: outerRingAnim }],
                  },
                ]}
              />

              {/* Inner Breath Resonance Ring */}
              <Animated.View
                style={[
                  styles.breathCircle,
                  {
                    borderColor: currentPhase.color,
                    shadowColor: currentPhase.color,
                    transform: [{ scale: pulseAnim }],
                  },
                ]}
              >
                <ThemedText style={styles.timerNumber}>{secondsLeft}s</ThemedText>
                <ThemedText style={[styles.phaseLabelText, { color: currentPhase.color }]}>
                  {currentPhase.label}
                </ThemedText>
                <ThemedText style={styles.phaseSubText}>{currentPhase.sub}</ThemedText>
              </Animated.View>
            </View>

            {/* Dynamic Neuro-Reset Tip */}
            <View style={styles.guidanceBox}>
              <Ionicons name="sparkles" size={14} color={currentPhase.color} style={{ marginRight: 8 }} />
              <ThemedText style={styles.guidanceTip}>{currentPhase.tip}</ThemedText>
            </View>

            {/* Shield Brothers Online Strip with Full Names */}
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

            {/* 1-Tap Reaction Runes Grid */}
            <View style={styles.runesSection}>
              <ThemedText style={styles.runesTitle}>BROTHERHOOD REACTION RUNES (1-TAP)</ThemedText>
              <View style={styles.runesGrid}>
                {REACTION_RUNES.map((rune) => (
                  <TouchableOpacity
                    key={rune.id}
                    style={[styles.runeButton, { backgroundColor: rune.bg, borderColor: rune.color }]}
                    activeOpacity={0.7}
                    onPress={() => handleSendRune(rune.text)}
                  >
                    <Ionicons name={rune.icon as any} size={15} color={rune.color} />
                    <ThemedText style={[styles.runeButtonText, { color: rune.color }]}>
                      {rune.text}
                    </ThemedText>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Live Incoming War Room Log Stream */}
            {activeBattle?.reactions && activeBattle.reactions.length > 0 && (
              <View style={styles.streamSection}>
                <ThemedText style={styles.streamTitle}>TACTICAL WAR ROOM STREAM</ThemedText>
                <View style={styles.streamList}>
                  {activeBattle.reactions.slice(-4).map((r, i) => (
                    <View key={i} style={styles.streamItem}>
                      <Ionicons name="flash" size={13} color="#F59E0B" style={{ marginRight: 7 }} />
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
                <ThemedText style={{ fontSize: 42 }}>🏆</ThemedText>
              </View>
              <ThemedText style={styles.victoryTitle}>THE SHIELD WALL HELD!</ThemedText>
              <ThemedText style={styles.victoryBody}>
                You stood shoulder-to-shoulder with your brothers for 90 full seconds. The urge wave is conquered.
              </ThemedText>
              <View style={styles.victoryRewardBadge}>
                <Ionicons name="shield-checkmark" size={16} color="#F59E0B" style={{ marginRight: 6 }} />
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
  honorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.35)',
  },
  honorBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#F59E0B',
    marginLeft: 4,
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
    paddingTop: 14,
  },
  initiatorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
    borderRadius: 16,
    padding: 13,
    marginBottom: 16,
    gap: 12,
  },
  initiatorLeftGlow: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  initiatorTextWrapper: {
    flex: 1,
  },
  initiatorHeadline: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  initiatorSub: {
    fontSize: 11.5,
    color: 'rgba(255, 255, 255, 0.65)',
    lineHeight: 16,
  },
  centerStage: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 250,
    position: 'relative',
    marginVertical: 4,
  },
  outerAtmosphere: {
    position: 'absolute',
    width: 230,
    height: 230,
    borderRadius: 115,
    backgroundColor: 'rgba(0, 229, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.2)',
  },
  breathCircle: {
    width: 170,
    height: 170,
    borderRadius: 85,
    backgroundColor: '#070C16',
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 18,
    elevation: 8,
  },
  timerNumber: {
    fontSize: 42,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -1,
  },
  phaseLabelText: {
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1.2,
    marginTop: 2,
  },
  phaseSubText: {
    fontSize: 9.5,
    color: 'rgba(255, 255, 255, 0.5)',
    fontWeight: '600',
    marginTop: 2,
  },
  guidanceBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 16,
  },
  guidanceTip: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '500',
    textAlign: 'center',
  },
  warriorsSection: {
    marginBottom: 16,
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
    borderColor: 'rgba(0, 229, 255, 0.35)',
    backgroundColor: 'rgba(0, 229, 255, 0.05)',
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
    marginBottom: 16,
  },
  runesTitle: {
    fontSize: 10.5,
    fontWeight: '800',
    color: 'rgba(255, 255, 255, 0.5)',
    letterSpacing: 0.8,
    marginBottom: 10,
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
    borderWidth: 1,
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
    width: 72,
    height: 72,
    borderRadius: 36,
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
