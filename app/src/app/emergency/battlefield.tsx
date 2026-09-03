import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  View,
  Platform,
  TextInput,
  KeyboardAvoidingView,
  Keyboard,
  Dimensions,
  ActivityIndicator,
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
import { BreathingParticles } from '../../components/BreathingParticles';
import { OmSoundManager } from '../../utils/audio-player';
import { BattleMessageItem, BattleParticipant, spartanApi } from '../../services/spartan-api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const triggerHaptic = (style = Haptics.ImpactFeedbackStyle.Light) => {
  try {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(style);
    }
  } catch {
    // Silent catch
  }
};

const MemoizedBackgroundParticles = React.memo(() => (
  <View style={styles.particlesLayer} pointerEvents="none">
    <BreathingParticles
      isRunning={true}
      color="#A855F7"
      size={Math.min(SCREEN_WIDTH * 1.15, 420)}
      showText={false}
    />
    <LinearGradient
      colors={['rgba(0, 0, 0, 0.72)', 'rgba(0, 0, 0, 0.4)', 'rgba(0, 0, 0, 0.88)']}
      style={StyleSheet.absoluteFill}
    />
  </View>
));


// Immediately purge any legacy chat caches from disk so no stale or "hello" messages ever persist
const STALE_CACHE_KEYS = [
  '@zenwill_battlefield_chat_cache',
  '@zenwill_battlefield_chat_cache_v1',
  '@zenwill_battlefield_chat_cache_v2',
  '@zenwill_battlefield_chat_cache_v3',
  '@zenwill_battlefield_chat_cache_v4',
  '@zenwill_battlefield_chat_cache_v5',
];
STALE_CACHE_KEYS.forEach((k) => {
  AsyncStorage.removeItem(k).catch(() => {});
});

export default function SpartanBattlefieldScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const {
    activeBattle,
    fetchMyCell,
    triggerBattleHorn,
    sendBattleMessage,
    battleHeartbeat,
  } = useSpartanStore();

  const currentUserId = user?.id ? String(user.id).trim().toLowerCase() : (user?.email || '').trim().toLowerCase();
  const currentUserName = user?.name || 'Brother Warrior';
  const currentUserStreak = user?.streak || 0;

  // Local Chat and Presence State: Strictly starts empty, populated only by real live user messages
  const [inputText, setInputText] = useState<string>('');
  const [messages, setMessages] = useState<BattleMessageItem[]>(() => {
    const active = useSpartanStore.getState().activeBattle?.messages;
    if (active && Array.isArray(active)) {
      return active.filter((m) => m && m.text && !m.text.includes('🚨 SESSION #'));
    }
    return [];
  });
  const [isSending, setIsSending] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(900);
  const [keyboardHeight, setKeyboardHeight] = useState<number>(0);

  const scrollViewRef = useRef<ScrollView>(null);
  const soundManagerRef = useRef<OmSoundManager | null>(null);

  // ── 1. Smooth Fluid Keyboard Listeners ──
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
      () => {
        setKeyboardHeight(0);
      }
    );

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // ── 2. Background Audio & Real-Time Sync ──
  useEffect(() => {
    let isMounted = true;
    const soundMgr = OmSoundManager.getInstance();
    soundManagerRef.current = soundMgr;

    // 1. Play emergency ambient audio
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
          setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: false }), 150);
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

    // 3. Heartbeat every 3s to sync active warriors and live incoming messages
    const pollInterval = setInterval(async () => {
      if (!isMounted) return;
      try {
        await battleHeartbeat();
      } catch (e) {}
    }, 3000);

    // 4. Sound loop keeper
    const soundInterval = setInterval(() => {
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
      clearInterval(pollInterval);
      clearInterval(soundInterval);
      if (soundManagerRef.current) {
        soundManagerRef.current.stopAndUnload().catch(() => {});
      }
    };
  }, [triggerBattleHorn, battleHeartbeat, fetchMyCell]);

  const handleToggleMute = useCallback(() => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
    if (soundManagerRef.current) {
      const nextMute = soundManagerRef.current.toggleMute();
      setIsMuted(nextMute);
    }
  }, []);

  // ── 3. Clean Exit Handler (Back Button, Done Button) ──
  const handleExitBattlefield = useCallback(async () => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
    Keyboard.dismiss();

    if (soundManagerRef.current) {
      soundManagerRef.current.stopAndUnload().catch(() => {});
    }
    useSpartanStore.setState({ activeBattle: null });
    setMessages([]);

    try {
      await spartanApi.leaveBattleSession();
    } catch (_) {}

    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/home' as any);
    }
  }, [router]);

  useEffect(() => {
    return () => {
      spartanApi.leaveBattleSession().catch(() => {});
      useSpartanStore.setState({ activeBattle: null });
      setMessages([]);
    };
  }, []);

  // ── 4. Global 15-Minute Background Countdown Synchronization ──
  const calculateGlobalRemaining = useCallback(() => {
    const nowTs = Math.floor(Date.now() / 1000);
    const secondsIntoEpoch = nowTs % 900;
    return 900 - secondsIntoEpoch;
  }, []);

  useEffect(() => {
    setSecondsRemaining(calculateGlobalRemaining());

    const countdownInterval = setInterval(() => {
      const rem = calculateGlobalRemaining();
      setSecondsRemaining(rem);

      if (rem >= 899) {
        setMessages([]);
        battleHeartbeat().catch(() => {});
      }
    }, 1000);

    return () => {
      clearInterval(countdownInterval);
    };
  }, [calculateGlobalRemaining, battleHeartbeat]);

  const formattedCountdown = useMemo(() => {
    const mins = Math.floor(Math.max(0, secondsRemaining) / 60);
    const secs = Math.max(0, secondsRemaining) % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, [secondsRemaining]);

  const timerColor = useMemo(() => {
    if (secondsRemaining <= 120) return '#EF4444'; // Red under 2m
    if (secondsRemaining <= 300) return '#F59E0B'; // Amber under 5m
    return '#A855F7'; // Royal Purple default
  }, [secondsRemaining]);

  const handleInputChange = (text: string) => {
    setInputText(text);
  };

  // ── 5. Merge Server Messages in Strict Chronological Order ──
  const mergeServerMessages = useCallback((serverMsgs: BattleMessageItem[]) => {
    if (!serverMsgs || !Array.isArray(serverMsgs)) return;
    const cleanServer = serverMsgs.filter((m) => m && m.text && !m.text.includes('🚨 SESSION #'));

    setMessages((prev) => {
      const now = Date.now();
      // Only keep in-flight messages that were sent in the active screen session within the last 15 seconds
      const inFlight = prev.filter((p) => {
        if (!p || typeof p.id !== 'string' || !p.id.startsWith('temp-')) return false;
        const parts = p.id.split('-');
        const createdTimestamp = Number(parts[1]) || 0;
        const isRecent = now - createdTimestamp < 15000;
        const isAlreadyInServer = cleanServer.some(
          (sm) =>
            sm.text === p.text &&
            ((sm.user_id && p.user_id && sm.user_id === p.user_id) ||
             (sm.user_name && p.user_name && sm.user_name.toLowerCase() === p.user_name.toLowerCase()))
        );
        return isRecent && !isAlreadyInServer;
      });

      const seen = new Set<string>();
      const combined: BattleMessageItem[] = [];

      for (const sm of cleanServer) {
        const key = sm.id || `${sm.user_id}-${sm.text}-${sm.created_at}`;
        if (!seen.has(key)) {
          seen.add(key);
          combined.push(sm);
        }
      }

      for (const ifm of inFlight) {
        const key = ifm.id || `${ifm.user_id}-${ifm.text}-${ifm.created_at}`;
        if (!seen.has(key)) {
          seen.add(key);
          combined.push(ifm);
        }
      }

      return combined;
    });
  }, []);

  // Sync with activeBattle in store
  useEffect(() => {
    if (activeBattle?.messages && Array.isArray(activeBattle.messages)) {
      mergeServerMessages(activeBattle.messages);
    }
  }, [activeBattle?.messages, mergeServerMessages]);

  // ── 6. Send Message (Instant Optimistic + Smooth Multi-User Integration) ──
  const handleSendMessage = useCallback(async (customText?: string) => {
    const textToSend = (customText || inputText).trim();
    if (!textToSend || isSending) return;

    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
    if (!customText) {
      setInputText('');
    }

    const tempId = `temp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const optimisticMsg: BattleMessageItem = {
      id: tempId,
      user_id: currentUserId,
      user_name: currentUserName,
      user_streak: currentUserStreak,
      text: textToSend,
      is_system: false,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, optimisticMsg]);

    requestAnimationFrame(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    });

    try {
      setIsSending(true);
      const res = await sendBattleMessage(textToSend);
      if (res && res.messages && Array.isArray(res.messages)) {
        mergeServerMessages(res.messages);
      }
      requestAnimationFrame(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      });
    } catch (err) {
      console.log('Error dispatching battle message:', err);
    } finally {
      setIsSending(false);
    }
  }, [inputText, isSending, currentUserId, currentUserName, currentUserStreak, sendBattleMessage, mergeServerMessages]);

  // ── 7. Real Active Warriors Presence ──
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

    // Real server participants
    const serverList = activeBattle?.participants || [];
    serverList.forEach((p) => {
      const key = (p.user_id || p.name || '').trim().toLowerCase();
      if (key) {
        map.set(key, p);
      }
    });

    return Array.from(map.values());
  }, [activeBattle?.participants, currentUserId, currentUserName, currentUserStreak]);

  const myUserIdentifiers = useMemo(() => {
    const ids = new Set<string>();
    if (user?.id) ids.add(String(user.id).trim().toLowerCase());
    if (user?.email) ids.add(user.email.trim().toLowerCase());
    if (user?.name) ids.add(user.name.trim().toLowerCase());
    return ids;
  }, [user?.id, user?.email, user?.name]);

  const checkIsUser = useCallback(
    (msg: BattleMessageItem): boolean => {
      if (!msg) return false;
      if (typeof msg.id === 'string' && (msg.id.startsWith('temp-') || msg.id.startsWith('local-'))) {
        return true;
      }
      const uid = (msg.user_id || '').trim().toLowerCase();
      const uname = (msg.user_name || '').trim().toLowerCase();
      if (uid && myUserIdentifiers.has(uid)) return true;
      if (uname && myUserIdentifiers.has(uname)) return true;
      return false;
    },
    [myUserIdentifiers]
  );

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages.length]);

  return (
    <View style={styles.fixedBgContainer}>
      {/* Purple Breathing Particles Background */}
      <MemoizedBackgroundParticles />

      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        {/* Header Bar */}
        <View style={styles.headerBar}>
          <TouchableOpacity
            style={styles.backBtn}
            activeOpacity={0.7}
            onPress={handleExitBattlefield}
          >
            <Ionicons name="chevron-back" size={24} color="#C084FC" />
          </TouchableOpacity>

          <View style={styles.headerTitleBox}>
            <View style={styles.headerLiveRow}>
              <View style={styles.livePulseBeacon} />
              <ThemedText style={styles.headerTitle}>SPARTAN BATTLEFIELD</ThemedText>
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
                size={14}
                color={isMuted ? '#94A3B8' : '#C084FC'}
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

        {/* Active Members Presence Strip */}
        <View style={styles.activeMembersSection}>
          <View style={styles.activeMembersHeader}>
            <View style={styles.activeMemberDot} />
            <ThemedText style={styles.activeMembersTitle}>
              ACTIVE SHIELD WALL ({activeParticipants.length} WARRIORS)
            </ThemedText>
            <View style={[styles.shieldWallTimerBadge, { borderColor: timerColor + '55', backgroundColor: timerColor + '18' }]}>
              <Ionicons name="timer-outline" size={10} color={timerColor} style={{ marginRight: 3 }} />
              <ThemedText style={[styles.shieldWallTimerText, { color: timerColor }]}>
                {formattedCountdown}
              </ThemedText>
            </View>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.activeMembersScroll}
            keyboardShouldPersistTaps="handled"
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
                    triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
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
                        <Ionicons name="chatbubble-ellipses" size={10} color="#C084FC" />
                      )}
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Purpose Banner below Shield Wall */}
        <View style={styles.urgencyNoticeBanner}>
          <Ionicons name="shield-checkmark" size={13} color="#C084FC" style={{ marginRight: 6 }} />
          <ThemedText style={styles.urgencyNoticeText}>
            This chat is used when the urge hits so high and you have to talk with someone.
          </ThemedText>
        </View>

        {/* Live Chat Stream */}
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={0}
        >
          <View style={[styles.chatStreamContainer, { paddingBottom: Platform.OS === 'android' ? keyboardHeight : 0 }]}>
            <ScrollView
              ref={scrollViewRef}
              contentContainerStyle={styles.chatScrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="interactive"
              removeClippedSubviews={false}
            >
              {messages.length === 0 ? (
                <View style={styles.emptyChatState}>
                  <Ionicons name="chatbubbles-outline" size={36} color="#A855F7" />
                  <ThemedText style={styles.emptyChatTitle}>Shield Wall Assembled</ThemedText>
                  <ThemedText style={styles.emptyChatSub}>
                    Brothers stand united. Type a message below to talk with your brothers and conquer the urge.
                  </ThemedText>
                </View>
              ) : (
                messages.map((msg, index) => {
                  const isUserMsg = checkIsUser(msg);

                  if (msg.is_system) {
                    return (
                      <View key={msg.id || index} style={styles.systemMsgPill}>
                        <Ionicons name="sparkles" size={11} color="#C084FC" style={{ marginRight: 6 }} />
                        <ThemedText style={styles.systemMsgText}>{msg.text}</ThemedText>
                      </View>
                    );
                  }

                  return (
                    <View
                      key={msg.id || index}
                      style={[styles.chatBubbleRow, isUserMsg ? styles.chatBubbleRowUser : styles.chatBubbleRowOther]}
                    >
                      <View
                        style={[
                          styles.chatBubbleCard,
                          isUserMsg ? styles.userBubbleCard : styles.otherBubbleCard,
                        ]}
                      >
                        {!isUserMsg && (
                          <TouchableOpacity
                            style={styles.chatAuthorHeader}
                            activeOpacity={0.7}
                            onPress={() => {
                              triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
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
                            <ThemedText style={styles.chatAuthorName}>
                              {msg.user_name || 'Brother'}
                            </ThemedText>
                            <View style={styles.streakMedalPill}>
                              <ThemedText style={styles.streakFlameText}>
                                🔥 {msg.user_streak ?? 0}d
                              </ThemedText>
                            </View>
                          </TouchableOpacity>
                        )}
                        <ThemedText style={[styles.chatMessageText, isUserMsg && styles.userMessageText]}>
                          {msg.text}
                        </ThemedText>
                      </View>
                    </View>
                  );
                })
              )}
            </ScrollView>

            {/* Floating Message Input Bar */}
            <View
              style={[
                styles.inputContainer,
                {
                  paddingBottom: keyboardHeight > 0
                    ? 8
                    : Math.max(8, insets.bottom),
                },
              ]}
            >
              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.textInput}
                  placeholder="Transmit to your brothers..."
                  placeholderTextColor="rgba(255, 255, 255, 0.45)"
                  value={inputText}
                  onChangeText={handleInputChange}
                  onFocus={() => {
                    setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 250);
                  }}
                  multiline={true}
                  blurOnSubmit={false}
                  maxLength={1000}
                  cursorColor="#A855F7"
                  selectionColor="rgba(168, 85, 247, 0.35)"
                  underlineColorAndroid="transparent"
                />

                <TouchableOpacity
                  style={[styles.sendBtn, (!inputText.trim() || isSending) && styles.sendBtnDisabled]}
                  activeOpacity={0.8}
                  disabled={!inputText.trim() || isSending}
                  onPress={() => handleSendMessage()}
                >
                  {isSending ? (
                    <ActivityIndicator size="small" color="#000000" />
                  ) : (
                    <Ionicons name="arrow-up" size={18} color="#000000" />
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

const styles = StyleSheet.create({
  fixedBgContainer: {
    flex: 1,
    backgroundColor: '#000000',
  },
  particlesLayer: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 0,
  },
  safeArea: {
    flex: 1,
    zIndex: 1,
  },

  /* Header Bar */
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: '#000000',
  },
  backBtn: {
    backgroundColor: 'transparent',
    padding: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitleBox: {
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
    color: '#C084FC',
    letterSpacing: 1.1,
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
    height: 32,
    paddingHorizontal: 8,
    borderRadius: 16,
    backgroundColor: 'rgba(168, 85, 247, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.32)',
    justifyContent: 'center',
  },
  muteBtnActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderColor: 'rgba(255, 255, 255, 0.14)',
  },
  muteLabelText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#C084FC',
  },
  muteLabelTextMuted: {
    color: '#94A3B8',
  },
  concludeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  activeMembersSection: {
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: '#000000',
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
    backgroundColor: '#A855F7',
  },
  activeMembersTitle: {
    fontSize: 9,
    fontWeight: '900',
    color: '#C084FC',
    letterSpacing: 0.9,
  },
  shieldWallTimerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 'auto',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 0.8,
  },
  shieldWallTimerText: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.8,
    fontVariant: ['tabular-nums'],
  },
  activeMembersScroll: {
    paddingHorizontal: 12,
    gap: 8,
  },
  memberChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(24, 12, 44, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.2)',
    borderRadius: 16,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 7,
  },
  memberChipMe: {
    borderColor: 'rgba(168, 85, 247, 0.6)',
    backgroundColor: 'rgba(168, 85, 247, 0.18)',
  },
  memberAvatarCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#2A1448',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  memberAvatarCircleMe: {
    backgroundColor: '#A855F7',
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
    color: '#D8B4FE',
    fontWeight: '900',
  },
  memberStreakText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#F59E0B',
  },

  /* World Chat Stream Container */
  chatStreamContainer: {
    flex: 1,
  },
  chatScrollContent: {
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 20,
    gap: 8,
  },
  emptyChatState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 50,
    gap: 10,
  },
  emptyChatTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  emptyChatSub: {
    fontSize: 12,
    color: '#A1A1AA',
    textAlign: 'center',
    paddingHorizontal: 30,
  },

  /* Message Bubbles */
  chatBubbleRow: {
    flexDirection: 'row',
    marginVertical: 2,
  },
  chatBubbleRowUser: {
    justifyContent: 'flex-end',
  },
  chatBubbleRowOther: {
    justifyContent: 'flex-start',
  },
  chatBubbleCard: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    maxWidth: '85%',
    minWidth: 120,
    borderWidth: 1,
    gap: 4,
  },
  userBubbleCard: {
    backgroundColor: 'rgba(38, 14, 68, 0.88)',
    borderColor: 'rgba(168, 85, 247, 0.45)',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 3,
    alignSelf: 'flex-end',
  },
  otherBubbleCard: {
    backgroundColor: 'rgba(15, 8, 28, 0.8)',
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderBottomRightRadius: 16,
    borderBottomLeftRadius: 3,
    alignSelf: 'flex-start',
  },
  chatAuthorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 2,
  },
  chatAuthorName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#C084FC',
    flexShrink: 1,
  },
  streakMedalPill: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  streakFlameText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#F59E0B',
  },
  chatMessageText: {
    fontSize: 13.5,
    color: '#F1F5F9',
    lineHeight: 19,
    textAlign: 'left',
  },
  userMessageText: {
    color: '#FFFFFF',
  },

  /* System Messages */
  systemMsgPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: 'rgba(168, 85, 247, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.2)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginVertical: 3,
  },
  systemMsgText: {
    fontSize: 10,
    color: '#D8B4FE',
    fontWeight: '600',
  },

  /* Urgency Notice Banner below Shield Wall */
  urgencyNoticeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 7,
    backgroundColor: 'rgba(168, 85, 247, 0.1)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(168, 85, 247, 0.22)',
  },
  urgencyNoticeText: {
    fontSize: 11,
    color: '#D8B4FE',
    fontWeight: '700',
    flex: 1,
    lineHeight: 15,
  },

  /* Floating Message Input Bar */
  inputContainer: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 10 : 8,
    backgroundColor: '#000000',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0A0A0A',
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: 'rgba(168, 85, 247, 0.5)',
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 4 : 2,
    minHeight: 46,
  },
  textInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 14.5,
    lineHeight: 20,
    minHeight: 38,
    maxHeight: 120,
    textAlignVertical: 'center',
    paddingVertical: Platform.OS === 'web' ? 8 : (Platform.OS === 'ios' ? 8 : 4),
    paddingRight: 8,
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {}),
  },
  sendBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#A855F7',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
    alignSelf: 'center',
  },
  sendBtnDisabled: {
    opacity: 0.35,
  },
});
