import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  View,
  Platform,
  TextInput,
  KeyboardAvoidingView,
  Text,
  Modal,
  Image,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { useHabitStore } from '@/store/habit-store';
import { useOnboardingStore } from '@/store/onboarding-store';
import { useAuthStore } from '@/store/auth-store';
import { communityApi, WorldChatMessage, ConversationSummaryItem } from '@/services/community-api';

const triggerHaptic = (style = Haptics.ImpactFeedbackStyle.Light) => {
  try {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(style);
    }
  } catch (error) {
    // Silent catch
  }
};

export interface GamifiedRank {
  id: string;
  badge: string;
  name: string;
  minDays: number;
  maxDays: number;
  color: string;
}

export const GAMIFIED_RANKS: GamifiedRank[] = [
  { id: 'bronze-1', badge: '🥉', name: 'Bronze I', minDays: 1, maxDays: 7, color: '#D97706' },
  { id: 'bronze-2', badge: '🥉', name: 'Bronze II', minDays: 8, maxDays: 14, color: '#E58A35' },
  { id: 'bronze-3', badge: '🥉', name: 'Bronze III', minDays: 15, maxDays: 30, color: '#F59E0B' },
  { id: 'silver-1', badge: '🥈', name: 'Silver I', minDays: 31, maxDays: 45, color: '#CBD5E1' },
  { id: 'silver-2', badge: '🥈', name: 'Silver II', minDays: 46, maxDays: 60, color: '#E2E8F0' },
  { id: 'silver-3', badge: '🥈', name: 'Silver III', minDays: 61, maxDays: 90, color: '#F1F5F9' },
  { id: 'gold-1', badge: '🥇', name: 'Gold I', minDays: 91, maxDays: 120, color: '#FBBF24' },
  { id: 'gold-2', badge: '🥇', name: 'Gold II', minDays: 121, maxDays: 180, color: '#F59E0B' },
  { id: 'gold-3', badge: '🥇', name: 'Gold III', minDays: 181, maxDays: 270, color: '#FFD700' },
  { id: 'platinum', badge: '💎', name: 'Platinum', minDays: 271, maxDays: 365, color: '#00E5FF' },
  { id: 'diamond', badge: '⚔️', name: 'Diamond', minDays: 366, maxDays: 730, color: '#38BDF8' },
  { id: 'master', badge: '👑', name: 'Master', minDays: 731, maxDays: 1095, color: '#A855F7' },
  { id: 'grandmaster', badge: '🌟', name: 'Grandmaster', minDays: 1096, maxDays: 1825, color: '#EC4899' },
  { id: 'sage', badge: '🔱', name: 'Sage', minDays: 1826, maxDays: 3650, color: '#10B981' },
  { id: 'legend', badge: '☀️', name: 'Legend', minDays: 3651, maxDays: Infinity, color: '#FF5722' },
];

export const getGamifiedRank = (days: number): GamifiedRank => {
  const d = typeof days === 'number' && !isNaN(days) ? days : 0;
  if (d <= 0) return GAMIFIED_RANKS[0];
  const found = GAMIFIED_RANKS.find((r) => d >= r.minDays && d <= r.maxDays);
  return found || GAMIFIED_RANKS[GAMIFIED_RANKS.length - 1];
};

export default function CommunityWorldChatScreen() {
  const router = useRouter();
  const scrollViewRef = useRef<ScrollView>(null);

  const currentUser = useAuthStore((state) => state.user);
  const habitStreak = useHabitStore((state) => state.streak);

  const userStreak = useMemo(() => {
    if (typeof currentUser?.streak === 'number' && !isNaN(currentUser.streak) && currentUser.streak >= 0) {
      return currentUser.streak;
    }
    if (typeof habitStreak === 'number' && !isNaN(habitStreak)) {
      return habitStreak;
    }
    return 0;
  }, [currentUser?.streak, habitStreak]);

  const currentUserId = currentUser?.id || currentUser?.email || 'user_guest';
  const firstName = currentUser?.name || useOnboardingStore((state) => state.firstName) || 'Operative';
  const userRankInfo = useMemo(() => getGamifiedRank(userStreak), [userStreak]);

  // Tab View Mode: 'world' or 'dms'
  const [activeTab, setActiveTab] = useState<'world' | 'dms'>('world');

  // Messages State fetched from Database
  const [messages, setMessages] = useState<WorldChatMessage[]>([]);
  const [inputText, setInputText] = useState<string>('');
  const [inputHeight, setInputHeight] = useState<number>(40);
  const [isSending, setIsSending] = useState<boolean>(false);

  const formatDmTime = (timeStr: string) => {
    if (!timeStr || timeStr === 'Invalid Date' || timeStr === 'null' || timeStr === 'undefined') return '';
    if (timeStr.includes('AM') || timeStr.includes('PM')) {
      return timeStr;
    }
    try {
      const date = new Date(timeStr);
      if (isNaN(date.getTime())) {
        return '';
      }
      return date.toLocaleTimeString('en-IN', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
    } catch (e) {
      return '';
    }
  };

  const isInvalidName = (name: string) => {
    if (!name || !name.trim()) return true;
    const v = name.trim();
    if (v.startsWith('user_') || v.startsWith('usr_') || v.startsWith('guest_')) {
      return true;
    }
    return false;
  };

  const getCleanUserName = (name: string) => {
    if (isInvalidName(name)) {
      return 'Operative';
    }
    if (name.includes('@')) {
      return name.split('@')[0];
    }
    return name.split(' ')[0];
  };

  // Helper for dynamic input height calculation (ensures 100% clean collapse on backspace)
  const getDynamicInputHeight = (text: string, measuredHeight?: number) => {
    if (!text || text.trim() === '') return 40;
    const numLines = text.split('\n').length;
    if (numLines === 1 && text.length < 45) {
      return 40;
    }
    if (measuredHeight && measuredHeight > 0 && numLines > 1) {
      return Math.min(110, Math.max(40, measuredHeight));
    }
    const estimatedLines = Math.max(numLines, Math.ceil(text.length / 45));
    if (estimatedLines <= 1) return 40;
    return Math.min(110, Math.max(40, 20 + estimatedLines * 18));
  };

  // One-Click DM Action Modal state
  const [selectedUserForDm, setSelectedUserForDm] = useState<WorldChatMessage | null>(null);

  // DM Conversations & Username Search State
  const [dmConversations, setDmConversations] = useState<ConversationSummaryItem[]>([]);
  const [searchUsername, setSearchUsername] = useState<string>('');
  const [searchResults, setSearchResults] = useState<Array<{ id: string; name: string; username: string; badge: string }>>([]);

  // Fetch World Chat & DM conversations on mount
  useEffect(() => {
    fetchMessages();
    fetchDmConversations();

    const interval = setInterval(() => {
      fetchMessages(false);
      fetchDmConversations();
    }, 800);
    return () => clearInterval(interval);
  }, []);

  const fetchMessages = async (shouldScroll = true) => {
    try {
      const fetched = await communityApi.getMessages(50);
      if (fetched && fetched.length > 0) {
        setMessages(fetched);
        if (shouldScroll && activeTab === 'world') {
          setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 200);
        }
      }
    } catch (error) {
      console.log('Error fetching chat messages from database:', error);
    }
  };

  const fetchDmConversations = async () => {
    try {
      const convs = await communityApi.getDmConversations();
      if (convs) {
        setDmConversations(convs);
      }
    } catch (e) {
      console.log('Error fetching DM conversations:', e);
    }
  };

  const handleSearchUsername = async (val: string) => {
    setSearchUsername(val);
    if (!val.trim()) {
      setSearchResults([]);
      return;
    }
    try {
      const res = await communityApi.searchOperatives(val.trim());
      setSearchResults(res || []);
    } catch (e) {
      console.log('Error searching operatives:', e);
    }
  };

  const handleInputChange = (text: string) => {
    setInputText(text);
    setInputHeight(getDynamicInputHeight(text));
  };

  const handleSendMessage = async () => {
    if (!inputText.trim() || isSending) return;
    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);

    const messageText = inputText.trim();
    setInputText('');
    setInputHeight(40);
    setIsSending(true);

    const tempId = `temp-${Date.now()}`;
    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const newMsg: WorldChatMessage = {
      id: tempId,
      user_id: currentUserId,
      author_name: firstName,
      author_rank: userRankInfo.name,
      author_badge: userRankInfo.badge,
      author_streak: userStreak,
      content: messageText,
      created_at: nowTime,
      likes_count: 0,
    };

    setMessages((prev) => [...prev, newMsg]);
    setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);

    try {
      await communityApi.sendMessage({
        user_id: currentUserId,
        author_name: firstName,
        author_rank: userRankInfo.name,
        author_badge: userRankInfo.badge,
        author_streak: userStreak,
        content: messageText,
      });
      fetchMessages(true);
    } catch (error) {
      console.log('SendMessage handled:', error);
    } finally {
      setIsSending(false);
    }
  };

  const handleOpenUserDm = (targetUserId: string, targetUserName: string) => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedUserForDm(null);
    router.push({
      pathname: '/community/dm',
      params: {
        user_id: targetUserId,
        user_name: targetUserName,
        username: targetUserName.toLowerCase().replace(/\s+/g, '_'),
      },
    });
  };

  return (
    <View style={styles.fixedBgContainer}>
      {/* Fixed Non-Zoomable Device Width Fit Spartan Cosmic Wallpaper */}
      <Image
        source={require('@/assets/images/chat_bg_spartan.png')}
        style={styles.fixedBgImage}
        resizeMode="cover"
      />

      {/* Dark Overlay Mask */}
      <View style={styles.darkMask} />

      <Stack.Screen options={{ headerShown: false }} />

      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
        {/* Header Bar with Centered Tab Toggle */}
        <View style={styles.headerBar}>
          <TouchableOpacity
            style={styles.backBtn}
            activeOpacity={0.7}
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

          <View style={styles.tabToggleRow}>
            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'world' && styles.tabBtnActive]}
              onPress={() => {
                triggerHaptic();
                setActiveTab('world');
              }}
            >
              <ThemedText style={[styles.tabBtnText, activeTab === 'world' && styles.tabBtnTextActive]}>
                World Chat
              </ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'dms' && styles.tabBtnActive]}
              onPress={() => {
                triggerHaptic();
                setActiveTab('dms');
              }}
            >
              <ThemedText style={[styles.tabBtnText, activeTab === 'dms' && styles.tabBtnTextActive]}>
                Direct Messages
              </ThemedText>
            </TouchableOpacity>
          </View>

          {/* Clean spacer on right */}
          <View style={{ width: 28 }} />
        </View>

        {/* ============================================================================== */}
        {/* WORLD CHAT VIEW */}
        {/* ============================================================================== */}
        {activeTab === 'world' ? (
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            <View style={styles.chatStreamContainer}>
              <ScrollView
                ref={scrollViewRef}
                contentContainerStyle={styles.chatScrollContent}
                showsVerticalScrollIndicator={false}
              >
                {messages.length === 0 ? (
                  <View style={styles.emptyChatState}>
                    <Ionicons name="chatbubbles-outline" size={36} color="#00E5FF" />
                    <ThemedText style={styles.emptyChatTitle}>World Chat Active</ThemedText>
                    <ThemedText style={styles.emptyChatSub}>
                      Be the first operative to post a message in the World Chat!
                    </ThemedText>
                  </View>
                ) : (
                  messages.map((msg) => {
                    const isUserMsg = (currentUserId !== 'user_guest' && msg.user_id === currentUserId) ||
                                      (currentUser?.email ? msg.user_id === currentUser.email : false) ||
                                      (msg.user_id === 'user_current' && msg.author_name === firstName);
                    const streakDays = isUserMsg ? userStreak : (msg.author_streak ?? 0);
                    const rankDetails = getGamifiedRank(streakDays);

                    let medalIcon = rankDetails.badge;
                    if (msg.author_badge && msg.author_badge.trim() !== '' && msg.author_badge !== '🛡️') {
                      medalIcon = msg.author_badge;
                    }

                    const displayName = isUserMsg
                      ? `${firstName.split(' ')[0]} (You)`
                      : (msg.author_name ? msg.author_name.split(' ')[0] : 'Operative');

                    return (
                      <View
                        key={msg.id}
                        style={[styles.chatBubbleRow, isUserMsg ? styles.chatBubbleRowUser : styles.chatBubbleRowOther]}
                      >
                        {/* Tap message card to open One-Click DM modal */}
                        <TouchableOpacity
                          activeOpacity={0.88}
                          onPress={() => {
                            if (!isUserMsg) {
                              triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
                              setSelectedUserForDm(msg);
                            }
                          }}
                          style={[styles.chatBubbleCard, isUserMsg ? styles.userBubbleCard : styles.otherBubbleCard]}
                        >
                          <View style={styles.chatAuthorHeader}>
                            <ThemedText style={styles.chatAuthorName} numberOfLines={1}>
                              {displayName}
                            </ThemedText>

                            <View style={[styles.streakMedalPill, { backgroundColor: `${rankDetails.color}1E`, borderColor: `${rankDetails.color}50` }]}>
                              <Text style={[styles.rankBadgeText, { color: rankDetails.color }]}>{msg.author_rank || rankDetails.name}</Text>
                              <Text style={styles.dotSeparator}>•</Text>
                              <Text style={styles.streakFlameText}>🔥 {streakDays}d</Text>
                              <Text style={styles.dotSeparator}>•</Text>
                              <Text style={styles.medalIconText}>{medalIcon}</Text>
                            </View>
                          </View>

                          <Text style={[styles.chatMessageText, isUserMsg && styles.userMessageText]} selectable={true}>
                            {msg.content}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    );
                  })
                )}
              </ScrollView>

              {/* Floating Pill Message Input Bar matching reference design */}
              <View style={styles.inputContainer}>
                <View style={styles.inputWrapper}>
                  <TextInput
                    style={[
                      styles.textInput,
                      { height: inputHeight }
                    ]}
                    placeholder="Type a message..."
                    placeholderTextColor="rgba(255, 255, 255, 0.45)"
                    value={inputText}
                    onChangeText={handleInputChange}
                    multiline={true}
                    onKeyPress={(e: any) => {
                      if (Platform.OS === 'web') {
                        if (e.nativeEvent.key === 'Enter' && !e.nativeEvent.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }
                    }}
                    blurOnSubmit={false}
                    returnKeyType="send"
                    onSubmitEditing={() => {
                      if (Platform.OS !== 'web') {
                        handleSendMessage();
                      }
                    }}
                    onContentSizeChange={(e) => {
                      const measured = e.nativeEvent.contentSize.height;
                      const numLines = inputText.split('\n').length;
                      if (!inputText || inputText.trim() === '' || (numLines === 1 && inputText.length < 45)) {
                        setInputHeight(40);
                      } else {
                        setInputHeight(getDynamicInputHeight(inputText, measured));
                      }
                    }}
                    maxLength={1000}
                    selectionColor="#00E5FF"
                    underlineColorAndroid="transparent"
                  />

                  <TouchableOpacity
                    style={[styles.sendBtn, !inputText.trim() && styles.sendBtnDisabled]}
                    activeOpacity={0.8}
                    disabled={!inputText.trim() || isSending}
                    onPress={handleSendMessage}
                  >
                    <Ionicons name="arrow-up" size={18} color="#000000" />
                  </TouchableOpacity>
                </View>
              </View>

            </View>
          </KeyboardAvoidingView>
        ) : (
          /* ============================================================================== */
          /* DIRECT MESSAGES (DM) LIST & USERNAME SEARCH VIEW */
          /* ============================================================================== */
          <View style={styles.dmListContainer}>
            {/* Search Bar for DM by Username */}
            <View style={styles.dmSearchWrapper}>
              <Ionicons name="search-outline" size={16} color="#00E5FF" />
              <TextInput
                style={styles.dmSearchInput}
                placeholder="Search operative by username..."
                placeholderTextColor="#64748B"
                value={searchUsername}
                onChangeText={handleSearchUsername}
              />
              {searchUsername !== '' && (
                <TouchableOpacity onPress={() => handleSearchUsername('')}>
                  <Ionicons name="close-circle" size={16} color="#64748B" />
                </TouchableOpacity>
              )}
            </View>

            <ScrollView contentContainerStyle={{ padding: 12, gap: 10 }} showsVerticalScrollIndicator={false}>
              {/* Search Results */}
              {searchUsername.trim() !== '' && (
                <View style={{ gap: 8 }}>
                  <ThemedText style={styles.sectionHeaderTitle}>SEARCH RESULTS</ThemedText>
                  {searchResults.length === 0 ? (
                    <ThemedText style={styles.emptySearchText}>No operatives found matching "{searchUsername}"</ThemedText>
                  ) : (
                    searchResults.map((user) => (
                      <TouchableOpacity
                        key={user.id}
                        style={styles.dmUserCard}
                        onPress={() => handleOpenUserDm(user.id, user.name)}
                      >
                        <View style={styles.dmAvatarCircle}>
                          <Text style={{ fontSize: 16 }}>{user.badge}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <ThemedText style={styles.dmUserName}>{user.name}</ThemedText>
                          <ThemedText style={styles.dmUserSub}>@{user.username}</ThemedText>
                        </View>
                        <Ionicons name="paper-plane-outline" size={16} color="#00E5FF" />
                      </TouchableOpacity>
                    ))
                  )}
                </View>
              )}

              {/* Active DM Conversations (Only real database DMs, no hardcoded dummy contacts) */}
              <View style={{ gap: 8, marginTop: searchUsername.trim() ? 12 : 0 }}>
                <ThemedText style={styles.sectionHeaderTitle}>ACTIVE DIRECT MESSAGES</ThemedText>

                {dmConversations.length === 0 ? (
                  <View style={styles.emptyDmListCard}>
                    <Ionicons name="chatbubbles-outline" size={28} color="#00E5FF" />
                    <ThemedText style={styles.emptyDmListTitle}>No Direct Messages Yet</ThemedText>
                    <ThemedText style={styles.emptyDmListSub}>
                      Search an operative by username above or tap any message in World Chat to start a conversation!
                    </ThemedText>
                  </View>
                ) : (
                  dmConversations.map((conv) => (
                    <TouchableOpacity
                      key={conv.other_user_id}
                      style={styles.dmUserCard}
                      onPress={() => handleOpenUserDm(conv.other_user_id, conv.other_user_name)}
                    >
                      <View style={styles.dmAvatarCircle}>
                        <Ionicons name="person" size={16} color="#00E5FF" />
                        <View style={styles.dmOnlineDot} />
                      </View>
                      <View style={{ flex: 1, gap: 2 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <ThemedText style={styles.dmUserName}>{getCleanUserName(conv.other_user_name)}</ThemedText>
                          <ThemedText style={styles.dmTimeText}>
                            {formatDmTime(conv.last_message_at)}
                          </ThemedText>
                        </View>
                        <ThemedText style={styles.dmLastMsg} numberOfLines={1}>
                          {conv.last_message}
                        </ThemedText>
                      </View>
                    </TouchableOpacity>
                  ))
                )}
              </View>
            </ScrollView>
          </View>
        )}

      </SafeAreaView>

      {/* ONE-CLICK DM ACTION MODAL FROM WORLD CHAT */}
      <Modal
        visible={selectedUserForDm !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedUserForDm(null)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setSelectedUserForDm(null)}
        >
          <View style={styles.dmActionCard} onStartShouldSetResponder={() => true}>
            <View style={styles.drawerHandle} />

            {selectedUserForDm && (
              <>
                <View style={styles.dmUserHeader}>
                  <View style={styles.dmModalAvatar}>
                    <Ionicons name="person" size={24} color="#00E5FF" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <ThemedText style={styles.dmModalName}>{selectedUserForDm.author_name}</ThemedText>
                    <ThemedText style={styles.dmModalRank}>
                      {selectedUserForDm.author_badge} {selectedUserForDm.author_rank} • 🔥 {selectedUserForDm.author_streak}d Streak
                    </ThemedText>
                  </View>
                </View>

                <View style={styles.quotedMsgBox}>
                  <ThemedText style={styles.quotedMsgText} numberOfLines={2}>
                    "{selectedUserForDm.content}"
                  </ThemedText>
                </View>

                <TouchableOpacity
                  style={styles.startDmActionBtn}
                  onPress={() => {
                    const targetId = (selectedUserForDm.user_id && selectedUserForDm.user_id !== 'user_current' && selectedUserForDm.user_id !== 'user_guest')
                      ? selectedUserForDm.user_id
                      : selectedUserForDm.author_name;
                    handleOpenUserDm(targetId, selectedUserForDm.author_name);
                  }}
                >
                  <Ionicons name="paper-plane" size={16} color="#000000" />
                  <ThemedText style={styles.startDmActionBtnText}>
                    Send Direct Message (DM)
                  </ThemedText>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.cancelActionBtn}
                  onPress={() => setSelectedUserForDm(null)}
                >
                  <ThemedText style={styles.cancelActionBtnText}>Cancel</ThemedText>
                </TouchableOpacity>
              </>
            )}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  fixedBgContainer: {
    flex: 1,
    backgroundColor: '#000000',
    position: 'relative',
  },
  fixedBgImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },
  darkMask: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(3, 7, 18, 0.78)',
  },
  safeArea: {
    flex: 1,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 229, 255, 0.15)',
    backgroundColor: '#030712',
  },
  backBtn: {
    backgroundColor: 'transparent',
    padding: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    borderRadius: 8,
    padding: 2,
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.25)',
  },
  tabBtn: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 6,
  },
  tabBtnActive: {
    backgroundColor: '#00E5FF',
  },
  tabBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 0.2,
  },
  tabBtnTextActive: {
    color: '#000000',
    fontWeight: '800',
  },

  /* World Chat Stream */
  chatStreamContainer: {
    flex: 1,
  },
  chatScrollContent: {
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 24,
    gap: 10,
  },
  emptyChatState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
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
    color: '#71717A',
    textAlign: 'center',
    paddingHorizontal: 30,
  },
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
    maxWidth: '82%',
    minWidth: 70,
    borderWidth: 1,
    gap: 4,
  },
  userBubbleCard: {
    backgroundColor: 'rgba(0, 229, 255, 0.14)',
    borderColor: 'rgba(0, 229, 255, 0.35)',
    borderBottomRightRadius: 2,
    alignSelf: 'flex-end',
  },
  otherBubbleCard: {
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderBottomLeftRadius: 2,
    alignSelf: 'flex-start',
  },
  chatAuthorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  chatAuthorName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
    flex: 1,
  },
  streakMedalPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
  },
  rankBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  streakFlameText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#F59E0B',
  },
  dotSeparator: {
    fontSize: 9,
    color: 'rgba(255,255,255,0.4)',
  },
  medalIconText: {
    fontSize: 10,
  },
  chatMessageText: {
    fontSize: 13.5,
    color: '#E2E8F0',
    lineHeight: 19,
  },
  userMessageText: {
    color: '#FFFFFF',
  },
  dmHintPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0, 229, 255, 0.1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginTop: 2,
  },
  dmHintText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#00E5FF',
  },
  inputContainer: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: 'rgba(6, 6, 10, 0.95)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(20, 24, 33, 0.92)',
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: 'rgba(0, 229, 255, 0.35)',
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 4 : 4,
  },
  textInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 14,
    lineHeight: 20,
    textAlignVertical: 'center',
    paddingVertical: Platform.OS === 'web' ? 8 : 6,
    paddingRight: 8,
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {}),
  },
  sendBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#00E5FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
    alignSelf: 'center',
  },
  sendBtnDisabled: {
    opacity: 0.35,
  },

  /* DM List View */
  dmListContainer: {
    flex: 1,
  },
  dmSearchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.25)',
    borderRadius: 12,
    marginHorizontal: 12,
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  dmSearchInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 12.5,
    textAlignVertical: 'center',
    alignSelf: 'center',
    paddingVertical: 0,
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {}),
  },
  sectionHeaderTitle: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#00E5FF',
    letterSpacing: 1.2,
  },
  emptySearchText: {
    fontSize: 11.5,
    color: '#71717A',
    fontStyle: 'italic',
    paddingVertical: 6,
  },
  emptyDmListCard: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 8,
    backgroundColor: 'rgba(10, 13, 20, 0.6)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  emptyDmListTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  emptyDmListSub: {
    fontSize: 11.5,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 16,
  },
  dmUserCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(10, 13, 20, 0.85)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 12,
  },
  dmAvatarCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 229, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  dmOnlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22C55E',
    borderWidth: 1,
    borderColor: '#0A0D14',
  },
  dmUserName: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  dmUserSub: {
    fontSize: 11,
    color: '#71717A',
  },
  dmLastMsg: {
    fontSize: 11.5,
    color: '#94A3B8',
  },
  dmTimeText: {
    fontSize: 10,
    color: '#64748B',
  },

  /* One-Click Action Modal */
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'flex-end',
  },
  dmActionCard: {
    backgroundColor: '#0A0D14',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.3)',
    padding: 16,
    gap: 12,
  },
  drawerHandle: {
    width: 32,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignSelf: 'center',
  },
  dmUserHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dmModalAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(0, 229, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dmModalName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  dmModalRank: {
    fontSize: 11,
    color: '#00E5FF',
    marginTop: 2,
  },
  quotedMsgBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderLeftWidth: 3,
    borderLeftColor: '#00E5FF',
    borderRadius: 6,
    padding: 10,
  },
  quotedMsgText: {
    fontSize: 12,
    color: '#CBD5E1',
    fontStyle: 'italic',
  },
  startDmActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#00E5FF',
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 4,
  },
  startDmActionBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#000000',
  },
  cancelActionBtn: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  cancelActionBtnText: {
    fontSize: 12,
    color: '#71717A',
    fontWeight: '600',
  },
});
