import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Platform,
  ActivityIndicator,
  Dimensions,
  KeyboardAvoidingView,
  Keyboard,
  Animated,
  InteractionManager,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { ThemedText } from '../../components/themed-text';
import { useSpartanStore } from '../../store/spartan-store';
import { useAuthStore } from '../../store/auth-store';
import { OmSoundManager } from '../../utils/audio-player';
import { BattleMessageItem, BattleParticipant, spartanApi } from '../../services/spartan-api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const BATTLEFIELD_CHAT_CACHE_KEY = '@zenwill_battlefield_chat_cache_v3';
let memoryBattlefieldMessages: BattleMessageItem[] = [];

export const getCachedBattlefieldMessages = (): BattleMessageItem[] => memoryBattlefieldMessages;
export const setCachedBattlefieldMessages = (msgs: BattleMessageItem[]) => {
  memoryBattlefieldMessages = msgs;
  AsyncStorage.setItem(BATTLEFIELD_CHAT_CACHE_KEY, JSON.stringify(msgs.slice(-100))).catch(() => {});
};

// Immediate disk hydration
AsyncStorage.getItem(BATTLEFIELD_CHAT_CACHE_KEY).then((raw) => {
  if (raw && memoryBattlefieldMessages.length === 0) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        memoryBattlefieldMessages = parsed;
      }
    } catch {}
  }
});

const QUICK_TRANSMISSION_CHIPS = [
  'Hold the line ⚔️',
  'Breathe with me 🌊',
  'Stay strong brother 🔥',
  'You are sovereign 👑',
  'Stillness over impulse 🛡️',
  'Channel the surge ⚡',
  'Pure Ojas 💎',
  'Iron will 🦾',
];

export default function SpartanBattlefieldScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const {
    activeBattle,
    myCell,
    fetchMyCell,
    triggerBattleHorn,
    sendBattleMessage,
    battleHeartbeat,
    startNewBattleSession,
    completeBattle,
  } = useSpartanStore();

  const currentUserId = user?.id ? String(user.id).trim().toLowerCase() : (user?.email || '').trim().toLowerCase();
  const currentUserName = user?.name || 'Brother Warrior';
  const currentUserStreak = user?.streak || 0;

  // Local Chat and Presence State
  const [inputText, setInputText] = useState<string>('');
  const [localMessages, setLocalMessages] = useState<BattleMessageItem[]>(() => getCachedBattlefieldMessages());
  const [isSending, setIsSending] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isResettingSession, setIsResettingSession] = useState<boolean>(false);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(900);
  const [keyboardHeight, setKeyboardHeight] = useState<number>(0);
  const [isInputFocused, setIsInputFocused] = useState<boolean>(false);

  const scrollViewRef = useRef<ScrollView>(null);
  const pollTimerRef = useRef<any>(null);
  const countdownTimerRef = useRef<any>(null);
  const soundManagerRef = useRef<OmSoundManager | null>(null);

  // GPU-Accelerated Hypnotic Tactical Pulse (Runs on Native Thread, 0% JS Thread overhead)
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.15,
          duration: 3200,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 3200,
          useNativeDriver: true,
        }),
      ])
    );
    pulseLoop.start();
    return () => pulseLoop.stop();
  }, [pulseAnim]);

  const triggerHaptic = useCallback((style: 'light' | 'medium' | 'heavy' = 'light') => {
    try {
      if (Platform.OS !== 'web') {
        if (style === 'heavy') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        else if (style === 'medium') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        else Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch { }
  }, []);

  // ── 1. Deferred Background Audio & Network Sync (Ensures 60fps Silk Navigation) ──
  useEffect(() => {
    let isMounted = true;
    const soundMgr = OmSoundManager.getInstance();
    soundManagerRef.current = soundMgr;

    // Defer heavy audio loading and network calls until AFTER the screen slide transition completes
    const interactionTask = InteractionManager.runAfterInteractions(() => {
      if (!isMounted) return;

      // 1. Play emergency audio smoothly
      soundMgr
        .setTune(soundMgr.getTuneForTechnique('emergency-sos'))
        .then(() => {
          if (isMounted) {
            soundMgr.play().catch(() => {});
            setIsMuted(soundMgr.getIsMuted());
          }
        })
        .catch(() => {});

      // 2. Initialize battlefield session in background
      const initBattlefield = async () => {
        try {
          fetchMyCell().catch(() => {});
          let battle = await spartanApi.getActiveBattleSession();
          if (!battle || battle.status !== 'active') {
            battle = await triggerBattleHorn('Global Sanctum');
          }
          if (isMounted && battle) {
            useSpartanStore.setState({ activeBattle: battle });
            setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: false }), 200);
          }
        } catch (err) {
          try {
            const fallbackBattle = await triggerBattleHorn('Global Sanctum');
            if (isMounted && fallbackBattle) {
              useSpartanStore.setState({ activeBattle: fallbackBattle });
            }
          } catch (_) {}
        }
      };

      initBattlefield();

      // 3. Heartbeat every 3s to sync warriors presence and real messages
      pollTimerRef.current = setInterval(async () => {
        if (!isMounted) return;
        try {
          await battleHeartbeat();
        } catch (e) {}
      }, 3000);
    });

    // Loop keeper
    const loopInterval = setInterval(() => {
      if (
        soundManagerRef.current &&
        !soundManagerRef.current.getIsMuted() &&
        !soundManagerRef.current.getIsPlaying()
      ) {
        soundManagerRef.current.play().catch(() => {});
      }
    }, 3000);

    return () => {
      isMounted = false;
      interactionTask.cancel();
      clearInterval(loopInterval);
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
      if (soundManagerRef.current) {
        soundManagerRef.current.stopAndUnload().catch(() => {});
      }
    };
  }, [triggerBattleHorn, battleHeartbeat, fetchMyCell]);

  const handleToggleMute = useCallback(() => {
    triggerHaptic('light');
    if (soundManagerRef.current) {
      const nextMute = soundManagerRef.current.toggleMute();
      setIsMuted(nextMute);
    }
  }, [triggerHaptic]);

  // ── 2. Keyboard Listeners ────────────────────────────────────────────────
  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        setKeyboardHeight(e.endCoordinates.height);
        setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
      }
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardHeight(0)
    );

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // ── 3. Clean Exit Handler (Back Button, Done Button, Screen Exit) ─────────
  const handleExitBattlefield = useCallback(async () => {
    triggerHaptic('medium');
    // Immediately stop polling so no heartbeat re-registers the user
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    // Stop audio
    if (soundManagerRef.current) {
      soundManagerRef.current.stopAndUnload().catch(() => {});
    }
    // Clear active presence from local store
    useSpartanStore.setState({ activeBattle: null });

    // Tell server to drop presence
    try {
      await spartanApi.leaveBattleSession();
    } catch (_) {}

    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/home' as any);
    }
  }, [router, triggerHaptic]);

  useEffect(() => {
    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
      spartanApi.leaveBattleSession().catch(() => {});
      useSpartanStore.setState({ activeBattle: null });
    };
  }, []);

  // ── 4. Global 15-Minute Background Countdown Synchronization ─────────────
  const calculateGlobalRemaining = useCallback(() => {
    const nowTs = Math.floor(Date.now() / 1000);
    const secondsIntoEpoch = nowTs % 900;
    return 900 - secondsIntoEpoch;
  }, []);

  // Global 15-Minute Wall-Clock Countdown Timer
  useEffect(() => {
    setSecondsRemaining(calculateGlobalRemaining());

    countdownTimerRef.current = setInterval(() => {
      const rem = calculateGlobalRemaining();
      setSecondsRemaining(rem);

      if (rem >= 899) {
        setLocalMessages([]);
        battleHeartbeat().catch(() => {});
      }
    }, 1000);

    return () => {
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    };
  }, [calculateGlobalRemaining, battleHeartbeat]);

  // Format MM:SS
  const formattedCountdown = useMemo(() => {
    const mins = Math.floor(Math.max(0, secondsRemaining) / 60);
    const secs = Math.max(0, secondsRemaining) % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, [secondsRemaining]);

  const timerProgress = useMemo(() => {
    const total = (activeBattle?.duration_seconds && activeBattle.duration_seconds > 100) ? activeBattle.duration_seconds : 900;
    return Math.max(0, Math.min(1, secondsRemaining / total));
  }, [secondsRemaining, activeBattle?.duration_seconds]);

  const timerColor = useMemo(() => {
    if (secondsRemaining <= 120) return '#EF4444'; // Red under 2m
    if (secondsRemaining <= 300) return '#F59E0B'; // Amber under 5m
    return '#00E5FF'; // Cyan default
  }, [secondsRemaining]);

  // ── 5. Send Message (Instant Optimistic + Resilient Unique Tracking) ──────
  const handleSendMessage = useCallback(async (customText?: string) => {
    const textToSend = (customText || inputText).trim();
    if (!textToSend) return;

    triggerHaptic('medium');
    if (!customText) {
      setInputText('');
    }

    // 1. Optimistic instant local append: 0ms delay with unique ID so messages NEVER disappear
    const uniqueId = `local-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const optimisticMsg: BattleMessageItem = {
      id: uniqueId,
      user_id: currentUserId,
      user_name: currentUserName,
      user_streak: currentUserStreak,
      text: textToSend,
      is_system: false,
      created_at: new Date().toISOString(),
    };

    setLocalMessages((prev) => {
      const next = [...prev, optimisticMsg];
      setCachedBattlefieldMessages(next);
      return next;
    });
    setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 40);

    // 2. Dispatch to backend API
    try {
      await sendBattleMessage(textToSend);
      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 80);
    } catch (err) {
      console.log('Error dispatching battle message:', err);
    }
  }, [inputText, currentUserId, currentUserName, currentUserStreak, sendBattleMessage, triggerHaptic]);

  // ── 6. Real Active Warriors Roster ───────────────────────────────────────
  const activeParticipants: BattleParticipant[] = useMemo(() => {
    const map = new Map<string, BattleParticipant>();

    // Current user
    map.set(currentUserId || 'me', {
      user_id: currentUserId || 'me',
      name: currentUserName,
      streak: currentUserStreak,
      badge: '🛡️',
      joined_at: new Date().toISOString(),
    });

    // Real server participants currently in the room
    const serverList = activeBattle?.participants || [];
    serverList.forEach((p) => {
      const key = (p.user_id || p.name || '').trim().toLowerCase();
      if (key) {
        map.set(key, p);
      }
    });

    return Array.from(map.values());
  }, [activeBattle?.participants, currentUserId, currentUserName, currentUserStreak]);

  // ── 7. Merged Clean Messages Stream (No Disappearing, Instant Cache) ─────
  const allMessages: BattleMessageItem[] = useMemo(() => {
    const map = new Map<string, BattleMessageItem>();

    // 1. Local / cached messages
    localMessages.forEach((lm) => {
      if (lm && lm.id) {
        map.set(lm.id, lm);
      }
    });

    // 2. Server messages from active session
    if (activeBattle?.messages && Array.isArray(activeBattle.messages)) {
      activeBattle.messages.forEach((m) => {
        if (!m || !m.text) return;
        if (m.text.includes('🚨 SESSION #')) return;
        const key = m.id || `${m.user_id}-${m.created_at}`;
        map.set(key, m);
      });
    }

    const list = Array.from(map.values());
    list.sort((a, b) => {
      const tA = new Date(a.created_at || 0).getTime();
      const tB = new Date(b.created_at || 0).getTime();
      return tA - tB;
    });

    if (list.length > 0) {
      setCachedBattlefieldMessages(list);
    }

    return list;
  }, [activeBattle?.messages, localMessages]);

  const sessionNumber = activeBattle?.session_number || 1;

  // Auto-scroll when messages update
  useEffect(() => {
    if (allMessages.length > 0) {
      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 150);
    }
  }, [allMessages.length]);

  return (
    <View style={styles.container}>
      {/* ── BACKGROUND: GPU-Accelerated Hypnotic Tactical Energy Core (0% JS Thread overhead) ── */}
      <View style={styles.particlesLayer} pointerEvents="none">
        <Animated.View
          style={[
            styles.tacticalGlowCore,
            {
              transform: [{ scale: pulseAnim }],
            },
          ]}
        >
          <LinearGradient
            colors={['rgba(0, 229, 255, 0.18)', 'rgba(0, 229, 255, 0.04)', 'transparent']}
            style={styles.tacticalGlowCircle}
          />
        </Animated.View>
        <LinearGradient
          colors={['rgba(5, 7, 14, 0.75)', 'rgba(5, 7, 14, 0.4)', 'rgba(5, 7, 14, 0.92)']}
          style={StyleSheet.absoluteFill}
        />
      </View>

      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        {/* ── 1. TACTICAL HUD HEADER ── */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backBtn}
            activeOpacity={0.75}
            onPress={handleExitBattlefield}
          >
            <Ionicons name="chevron-back" size={22} color="#00E5FF" />
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <View style={styles.headerLiveRow}>
              <View style={styles.livePulseBeacon} />
              <ThemedText style={styles.headerTitle}>SPARTAN BATTLEFIELD</ThemedText>
            </View>
            <View style={styles.sessionPill}>
              <Ionicons name="shield-half" size={10} color="#00E5FF" style={{ marginRight: 4 }} />
              <ThemedText style={styles.sessionPillText}>
                SESSION #{sessionNumber} • LIVE TAC-COMM
              </ThemedText>
            </View>
          </View>

          {/* Right Controls: Audio Mute & Conclude Room */}
          <View style={styles.headerRightActions}>
            <TouchableOpacity
              style={[styles.muteBtn, isMuted && styles.muteBtnActive]}
              activeOpacity={0.8}
              onPress={handleToggleMute}
            >
              <Ionicons
                name={isMuted ? 'volume-mute' : 'volume-high'}
                size={16}
                color={isMuted ? '#94A3B8' : '#00E5FF'}
              />
              <ThemedText style={[styles.muteLabelText, isMuted && styles.muteLabelTextMuted]}>
                {isMuted ? 'MUTED' : '396Hz'}
              </ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.concludeBtn}
              activeOpacity={0.8}
              onPress={handleExitBattlefield}
            >
              <Ionicons name="checkmark-done" size={16} color="#10B981" />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── 2. 15-MINUTE TELEMETRY COUNTDOWN BAR ── */}
        <View style={styles.timerHudStrip}>
          <View style={styles.timerHudContent}>
            <View style={styles.timerHudLeft}>
              <View style={[styles.timerIconCircle, { borderColor: timerColor + '50' }]}>
                <Ionicons name="timer-outline" size={13} color={timerColor} />
              </View>
              <View>
                <ThemedText style={styles.timerHudLabel}>15-MIN SESSION PURGE IN:</ThemedText>
                <ThemedText style={styles.timerHudSub}>Auto-wipes chat & renews tactical session</ThemedText>
              </View>
            </View>

            <View style={[styles.timerBadge, { borderColor: timerColor + '55', backgroundColor: timerColor + '15' }]}>
              <ThemedText style={[styles.timerText, { color: timerColor }]}>
                {formattedCountdown}
              </ThemedText>
            </View>
          </View>

          {/* Glowing Animated Progress Line */}
          <View style={styles.timerProgressBar}>
            <View
              style={[
                styles.timerProgressFill,
                { width: `${timerProgress * 100}%`, backgroundColor: timerColor },
              ]}
            />
          </View>
        </View>

        {/* ── 3. ACTIVE MEMBERS PRESENCE STRIP (TAP ANY BROTHER TO DM) ── */}
        <View style={styles.activeMembersSection}>
          <View style={styles.activeMembersHeader}>
            <View style={styles.activeMemberDot} />
            <ThemedText style={styles.activeMembersTitle}>
              ACTIVE SHIELD WALL ({activeParticipants.length} WARRIORS)
            </ThemedText>
            <ThemedText style={{ fontSize: 9.5, color: '#64748B', marginLeft: 'auto' }}>
              Tap user to DM
            </ThemedText>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.activeMembersScroll}
          >
            {activeParticipants.map((member, idx) => {
              const isMe = (member.user_id || '').trim().toLowerCase() === currentUserId || member.name === currentUserName;
              const displayName = isMe ? `${member.name} (You)` : member.name;
              const initials = (member.name || 'W').substring(0, 2).toUpperCase();

              return (
                <TouchableOpacity
                  key={member.user_id || idx}
                  style={[styles.memberChip, isMe && styles.memberChipMe]}
                  activeOpacity={isMe ? 1 : 0.75}
                  onPress={() => {
                    if (isMe) return;
                    triggerHaptic('light');
                    router.push({
                      pathname: '/community/dm',
                      params: {
                        user_id: member.user_id,
                        user_name: member.name,
                        username: (member.name || '').toLowerCase().replace(/\s+/g, '_'),
                      },
                    });
                  }}
                >
                  <View style={[styles.memberAvatarCircle, isMe && styles.memberAvatarCircleMe]}>
                    <ThemedText style={styles.memberAvatarText}>{initials}</ThemedText>
                    <View style={styles.memberOnlineBeacon} />
                  </View>
                  <View style={styles.memberInfoCol}>
                    <ThemedText style={[styles.memberNameText, isMe && styles.memberNameTextMe]} numberOfLines={1}>
                      {displayName}
                    </ThemedText>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <ThemedText style={styles.memberStreakText}>🔥 {member.streak ?? 0}d</ThemedText>
                      {!isMe && (
                        <Ionicons name="chatbubble-ellipses" size={10} color="#00E5FF" />
                      )}
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* ── 4. CHAT STREAM & MESSAGES ── */}
        <KeyboardAvoidingView
          style={styles.keyboardAvoid}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={0}
        >
          <View style={styles.chatContainer}>
            <ScrollView
              ref={scrollViewRef}
              contentContainerStyle={styles.chatScrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="interactive"
            >

              {allMessages.length === 0 ? (
                <View style={styles.emptyStateContainer}>
                  <View style={styles.emptyIconCircle}>
                    <Ionicons name="chatbubble-ellipses-outline" size={32} color="#00E5FF" />
                  </View>
                  <ThemedText style={styles.emptyStateTitle}>Shield Wall Assembled</ThemedText>
                  <ThemedText style={styles.emptyStateSub}>
                    Brothers stand united. Send the first brotherhood transmission or tap a tactical rune below!
                  </ThemedText>
                </View>
              ) : (
                allMessages.map((msg, idx) => {
                  const isUser =
                    (msg.user_id || '').trim().toLowerCase() === currentUserId ||
                    (msg.user_name || '').trim().toLowerCase() === currentUserName.trim().toLowerCase();

                  if (msg.is_system) {
                    return (
                      <View key={msg.id || idx} style={styles.systemMsgPill}>
                        <Ionicons name="sparkles" size={11} color="#00E5FF" style={{ marginRight: 6 }} />
                        <ThemedText style={styles.systemMsgText}>{msg.text}</ThemedText>
                      </View>
                    );
                  }

                  return (
                    <View
                      key={msg.id || idx}
                      style={[styles.messageRow, isUser ? styles.messageRowUser : styles.messageRowOther]}
                    >
                      <View
                        style={[
                          styles.messageBubble,
                          isUser ? styles.messageBubbleUser : styles.messageBubbleOther,
                        ]}
                      >
                        {!isUser && (
                          <TouchableOpacity
                            style={styles.msgHeaderRow}
                            activeOpacity={0.7}
                            onPress={() => {
                              triggerHaptic('light');
                              router.push({
                                pathname: '/community/dm',
                                params: {
                                  user_id: msg.user_id,
                                  user_name: msg.user_name || 'Brother',
                                  username: (msg.user_name || 'brother').toLowerCase().replace(/\s+/g, '_'),
                                },
                              });
                            }}
                          >
                            <ThemedText style={styles.otherSenderName}>
                              {msg.user_name || 'Brother'}
                            </ThemedText>
                            <View style={styles.otherStreakPill}>
                              <ThemedText style={styles.otherStreakText}>
                                🔥 {msg.user_streak ?? 0}d
                              </ThemedText>
                            </View>
                            <Ionicons name="chatbubble-ellipses" size={11} color="#00E5FF" style={{ marginLeft: 4 }} />
                          </TouchableOpacity>
                        )}
                        <ThemedText style={[styles.messageBodyText, isUser && styles.messageBodyTextUser]}>
                          {msg.text}
                        </ThemedText>
                        <ThemedText style={[styles.msgTimeText, isUser && styles.msgTimeTextUser]}>
                          {formatMsgTime(msg.created_at)}
                        </ThemedText>
                      </View>
                    </View>
                  );
                })
              )}
            </ScrollView>

            {/* ── 5. QUICK TACTICAL TRANSMISSION CHIPS ── */}
            <View style={styles.quickChipsContainer}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.quickChipsScroll}
              >
                {QUICK_TRANSMISSION_CHIPS.map((chip, idx) => (
                  <TouchableOpacity
                    key={idx}
                    style={styles.quickChipBtn}
                    activeOpacity={0.75}
                    onPress={() => handleSendMessage(chip)}
                  >
                    <ThemedText style={styles.quickChipText}>{chip}</ThemedText>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* ── 6. COMMUNITY-STYLE FLOATING MESSAGE INPUT BAR ── */}
            <View
              style={[
                styles.inputBarWrapper,
                {
                  paddingBottom: Platform.OS === 'ios' && keyboardHeight > 0 ? 8 : Math.max(8, insets.bottom),
                },
              ]}
            >
              <View style={[styles.inputInnerPill, isInputFocused && styles.inputInnerPillFocused]}>
                <TextInput
                  style={styles.textInput}
                  placeholder="Transmit to your brothers..."
                  placeholderTextColor="rgba(255, 255, 255, 0.42)"
                  value={inputText}
                  onChangeText={setInputText}
                  onFocus={() => {
                    setIsInputFocused(true);
                    setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 250);
                  }}
                  onBlur={() => setIsInputFocused(false)}
                  multiline={false}
                  returnKeyType="send"
                  onSubmitEditing={() => handleSendMessage()}
                  blurOnSubmit={false}
                  maxLength={1000}
                  cursorColor="#00E5FF"
                  selectionColor="rgba(0, 229, 255, 0.35)"
                  underlineColorAndroid="transparent"
                />

                <TouchableOpacity
                  style={[styles.sendBtn, (!inputText.trim() || isSending) && styles.sendBtnDisabled]}
                  activeOpacity={0.7}
                  disabled={!inputText.trim() || isSending}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  onPress={() => handleSendMessage()}
                >
                  {isSending ? (
                    <ActivityIndicator size="small" color="#000000" />
                  ) : (
                    <Ionicons name="arrow-up" size={19} color="#000000" />
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

function formatMsgTime(isoStr?: string): string {
  if (!isoStr) return '';
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#04060B',
  },
  particlesLayer: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 0,
  },
  tacticalGlowCore: {
    width: Math.min(SCREEN_WIDTH * 1.1, 420),
    height: Math.min(SCREEN_WIDTH * 1.1, 420),
    alignItems: 'center',
    justifyContent: 'center',
  },
  tacticalGlowCircle: {
    width: '100%',
    height: '100%',
    borderRadius: 210,
  },
  safeArea: {
    flex: 1,
    zIndex: 1,
  },

  /* ── 1. Header ── */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: 'rgba(4, 6, 11, 0.85)',
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 229, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.28)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    alignItems: 'center',
  },
  headerLiveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  livePulseBeacon: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#10B981',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 4,
  },
  headerTitle: {
    fontSize: 13.5,
    fontWeight: '900',
    color: '#00E5FF',
    letterSpacing: 1.1,
  },
  sessionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 229, 255, 0.08)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginTop: 3,
    borderWidth: 0.5,
    borderColor: 'rgba(0, 229, 255, 0.2)',
  },
  sessionPillText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.7,
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  muteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 34,
    paddingHorizontal: 9,
    borderRadius: 17,
    backgroundColor: 'rgba(0, 229, 255, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.28)',
    justifyContent: 'center',
  },
  muteBtnActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderColor: 'rgba(255, 255, 255, 0.14)',
  },
  muteLabelText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#00E5FF',
  },
  muteLabelTextMuted: {
    color: '#94A3B8',
  },
  concludeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  /* ── 2. Telemetry Timer HUD Strip ── */
  timerHudStrip: {
    backgroundColor: 'rgba(10, 15, 29, 0.75)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.07)',
    paddingTop: 8,
  },
  timerHudContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingBottom: 7,
  },
  timerHudLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timerIconCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  timerHudLabel: {
    fontSize: 10.5,
    fontWeight: '900',
    color: '#E2E8F0',
    letterSpacing: 0.6,
  },
  timerHudSub: {
    fontSize: 9,
    color: '#64748B',
    fontWeight: '500',
  },
  timerBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  timerText: {
    fontSize: 13,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
    letterSpacing: 1,
  },
  timerProgressBar: {
    height: 2.5,
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  timerProgressFill: {
    height: 2.5,
    borderRadius: 1.5,
  },

  /* ── 3. Active Members Presence Strip ── */
  activeMembersSection: {
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
    backgroundColor: 'rgba(6, 10, 20, 0.65)',
  },
  activeMembersHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    marginBottom: 5,
    gap: 6,
  },
  activeMemberDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#00E5FF',
    shadowColor: '#00E5FF',
    shadowOpacity: 0.8,
    shadowRadius: 3,
  },
  activeMembersTitle: {
    fontSize: 9,
    fontWeight: '900',
    color: '#94A3B8',
    letterSpacing: 0.9,
  },
  activeMembersScroll: {
    paddingHorizontal: 12,
    gap: 8,
  },
  memberChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 7,
  },
  memberChipMe: {
    borderColor: 'rgba(0, 229, 255, 0.45)',
    backgroundColor: 'rgba(0, 229, 255, 0.12)',
  },
  memberAvatarCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#1E293B',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  memberAvatarCircleMe: {
    backgroundColor: '#00E5FF',
  },
  memberAvatarText: {
    fontSize: 9.5,
    fontWeight: '900',
    color: '#000000',
  },
  memberOnlineBeacon: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
    position: 'absolute',
    bottom: -1,
    right: -1,
    borderWidth: 1,
    borderColor: '#04060B',
  },
  memberInfoCol: {
    justifyContent: 'center',
  },
  memberNameText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#E2E8F0',
    maxWidth: 90,
  },
  memberNameTextMe: {
    color: '#00E5FF',
    fontWeight: '900',
  },
  memberStreakText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#F59E0B',
  },

  /* ── 4. Chat Container ── */
  keyboardAvoid: {
    flex: 1,
  },
  chatContainer: {
    flex: 1,
    justifyContent: 'space-between',
  },
  chatScrollContent: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 16,
    gap: 8,
  },
  sessionBannerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    backgroundColor: 'rgba(0, 229, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.25)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
    marginBottom: 6,
  },
  sessionBannerText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#00E5FF',
    letterSpacing: 0.8,
  },
  emptyStateContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 45,
    gap: 8,
  },
  emptyIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(0, 229, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  emptyStateTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#F1F5F9',
  },
  emptyStateSub: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    paddingHorizontal: 28,
    lineHeight: 18,
  },

  /* ── Message Bubbles ── */
  messageRow: {
    marginVertical: 2,
    flexDirection: 'row',
  },
  messageRowUser: {
    justifyContent: 'flex-end',
  },
  messageRowOther: {
    justifyContent: 'flex-start',
  },
  messageBubble: {
    maxWidth: '82%',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 15,
  },
  messageBubbleUser: {
    backgroundColor: 'rgba(0, 229, 255, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.4)',
    borderBottomRightRadius: 3,
  },
  messageBubbleOther: {
    backgroundColor: 'rgba(15, 23, 42, 0.88)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderBottomLeftRadius: 3,
  },
  msgHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 3,
  },
  otherSenderName: {
    fontSize: 11,
    fontWeight: '800',
    color: '#93C5FD',
  },
  otherStreakPill: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  otherStreakText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#F59E0B',
  },
  messageBodyText: {
    fontSize: 13.5,
    color: '#F1F5F9',
    lineHeight: 19,
    fontWeight: '400',
  },
  messageBodyTextUser: {
    color: '#FFFFFF',
    fontWeight: '500',
  },
  msgTimeText: {
    fontSize: 9.5,
    color: '#64748B',
    marginTop: 3,
    alignSelf: 'flex-end',
  },
  msgTimeTextUser: {
    color: 'rgba(255, 255, 255, 0.6)',
  },

  /* ── System Messages ── */
  systemMsgPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginVertical: 3,
  },
  systemMsgText: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: '600',
  },

  /* ── 5. Quick Transmission Chips ── */
  quickChipsContainer: {
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
    backgroundColor: 'rgba(4, 6, 11, 0.85)',
  },
  quickChipsScroll: {
    paddingHorizontal: 12,
    gap: 8,
  },
  quickChipBtn: {
    backgroundColor: 'rgba(0, 229, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.25)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
  },
  quickChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#00E5FF',
  },

  /* ── 6. Community-Style Floating Message Input Bar ── */
  inputBarWrapper: {
    paddingHorizontal: 12,
    paddingTop: 6,
    backgroundColor: 'rgba(4, 6, 11, 0.96)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  inputInnerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 24,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 6 : 2,
  },
  inputInnerPillFocused: {
    borderColor: '#00E5FF',
    shadowColor: '#00E5FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 5,
  },
  textInput: {
    flex: 1,
    fontSize: 13.5,
    color: '#FFFFFF',
    paddingVertical: 6,
    paddingRight: 8,
    maxHeight: 90,
  },
  sendBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#00E5FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
});
