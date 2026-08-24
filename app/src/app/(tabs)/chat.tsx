import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  View,
  Platform,
  TextInput,
  Modal,
  Image,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter, Stack, useFocusEffect } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KeyboardAvoidingView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { coachApi } from '@/services/coach-api';
import { useDailyMissionStore } from '@/store/daily-mission-store';
import { useOnboardingStore } from '@/store/onboarding-store';
import { useAuthStore } from '@/store/auth-store';
import { PageEntrance } from '@/components/ui/smooth-loader';

const STORAGE_CHAT_KEY = '@zenwill_coach_continuous_messages_v2';
const STORAGE_MEMORIES_KEY = '@zenwill_coach_memory_insights_v2';

const triggerHaptic = (style = Haptics.ImpactFeedbackStyle.Light) => {
  try {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(style);
    }
  } catch (error) {
    // Silent catch
  }
};

export interface Message {
  id: string;
  sender: 'ai' | 'user';
  text: string;
  timestamp: string;
  suggestedActions?: string[];
}

export interface MemoryItem {
  id: string;
  category: 'Trigger' | 'Protocol' | 'Goal' | 'Insight';
  text: string;
  dateAdded: string;
}

const DEFAULT_MEMORIES: MemoryItem[] = [
  { id: 'm-1', category: 'Trigger', text: 'Late afternoon screen fatigue (2 PM - 4 PM)', dateAdded: 'Auto-extracted' },
  { id: 'm-2', category: 'Protocol', text: '5-4-3-2-1 Sensory Grounding & Box Breathing', dateAdded: 'Auto-extracted' },
  { id: 'm-3', category: 'Goal', text: '90-Day Discipline & Mental Clarity Milestone', dateAdded: 'User Goal' },
];

export default function CoachChatScreen() {
  const router = useRouter();
  const scrollViewRef = useRef<ScrollView>(null);
  const currentUser = useAuthStore((state) => state.user);
  const firstName = currentUser?.name?.split(' ')[0] || useOnboardingStore((state) => state.firstName) || 'Brother';

  const userChatStorageKey = currentUser?.id
    ? `@zenwill_coach_msgs_${currentUser.id}`
    : `@zenwill_coach_msgs_${currentUser?.email || 'guest'}`;

  const [messages, setMessages] = useState<Message[]>([]);
  const [memories, setMemories] = useState<MemoryItem[]>(DEFAULT_MEMORIES);
  const [inputMessage, setInputMessage] = useState('');
  const [inputHeight, setInputHeight] = useState(40);
  const [isStreaming, setIsStreaming] = useState(false);
  const [memoryModalVisible, setMemoryModalVisible] = useState(false);
  const [newMemoryInput, setNewMemoryInput] = useState('');

  // Dynamic input height calculation ensuring clean collapse on backspace or reset
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

  const handleInputChange = (text: string) => {
    setInputMessage(text);
    const nextHeight = getDynamicInputHeight(text);
    setInputHeight(nextHeight);
  };

  const getInitialAiMessage = (name: string): Message => ({
    id: 'init-ai-greeting',
    sender: 'ai',
    text: `Hello ${name}, I am your AI Coach. How can I help you master your mind and energy today?`,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  });

  // Load persistent chat history from MongoDB database & local cache
  useEffect(() => {
    loadChatHistory();

    AsyncStorage.getItem(STORAGE_MEMORIES_KEY).then((saved) => {
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setMemories(parsed);
          }
        } catch (e) {
          // Fallback default
        }
      }
    });
  }, [currentUser?.id, firstName]);

  useFocusEffect(
    useCallback(() => {
      loadChatHistory();
    }, [currentUser?.id])
  );

  const loadChatHistory = async () => {
    try {
      // 1. Read local cache for instant load
      const cached = await AsyncStorage.getItem(userChatStorageKey);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setMessages(parsed);
          }
        } catch (e) {}
      }

      // 2. Fetch real conversation history from MongoDB backend
      const dbHistory = await coachApi.getHistory(50);
      if (dbHistory && dbHistory.length > 0) {
        const formattedMsgs: Message[] = dbHistory.map((m) => {
          let timeFormatted = '';
          try {
            timeFormatted = new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          } catch (e) {
            timeFormatted = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          }
          return {
            id: m.id || String(Date.now()),
            sender: m.role === 'assistant' ? 'ai' : 'user',
            text: m.content,
            timestamp: timeFormatted,
          };
        });
        setMessages(formattedMsgs);
        await AsyncStorage.setItem(userChatStorageKey, JSON.stringify(formattedMsgs));
      } else if (!cached) {
        setMessages([getInitialAiMessage(firstName)]);
      }
    } catch (err) {
      console.log('Error loading coach chat history from database:', err);
      if (messages.length === 0) {
        setMessages([getInitialAiMessage(firstName)]);
      }
    }
  };

  // Save messages to user-specific AsyncStorage whenever updated
  const saveMessages = async (newMsgs: Message[]) => {
    setMessages(newMsgs);
    try {
      await AsyncStorage.setItem(userChatStorageKey, JSON.stringify(newMsgs));
    } catch (e) {
      // Silent catch
    }
  };

  // Save memories to AsyncStorage
  const saveMemories = async (newMems: MemoryItem[]) => {
    setMemories(newMems);
    try {
      await AsyncStorage.setItem(STORAGE_MEMORIES_KEY, JSON.stringify(newMems));
    } catch (e) {
      // Silent catch
    }
  };

  const handleSendMessage = async (textToSend?: string) => {
    const text = textToSend || inputMessage;
    if (!text.trim() || isStreaming) return;

    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);

    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const userMsg: Message = {
      id: Date.now().toString(),
      sender: 'user',
      text: text.trim(),
      timestamp: nowTime,
    };

    const updatedWithUser = [...messages, userMsg];
    saveMessages(updatedWithUser);
    setInputMessage('');
    setInputHeight(40);
    setIsStreaming(true);

    // Complete AI Coach daily mission task
    useDailyMissionStore.getState().completeTask('coach');

    try {
      const response = await coachApi.sendMessage({
        message: text.trim(),
      });

      let aiTime = nowTime;
      try {
        if (response.created_at) {
          aiTime = new Date(response.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
      } catch (e) {}

      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        sender: 'ai',
        text: response.reply,
        timestamp: aiTime,
      };

      saveMessages([...updatedWithUser, aiMsg]);
      triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
    } catch (err) {
      // Fallback offline response
      const offlineResponses = [
        `Stay present, ${firstName}. An urge is temporary energy — not a command. Choose one deliberate physical action right now to channel your vitality.`,
        `Every urge you defeat builds permanent neuro-pathways of self-mastery. What is the real emotion behind this moment?`,
        `You are in full control of your driver seat. Take a deep breath and lock in your daily focus.`,
      ];
      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        sender: 'ai',
        text: offlineResponses[Math.floor(Math.random() * offlineResponses.length)],
        timestamp: nowTime,
      };
      saveMessages([...updatedWithUser, aiMsg]);
    } finally {
      setIsStreaming(false);
    }
  };

  const handleAddMemory = () => {
    if (!newMemoryInput.trim()) return;
    triggerHaptic();
    const newMem: MemoryItem = {
      id: Date.now().toString(),
      category: 'Insight',
      text: newMemoryInput.trim(),
      dateAdded: 'Added Today',
    };
    saveMemories([newMem, ...memories]);
    setNewMemoryInput('');
  };

  const handleClearChat = async () => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Heavy);
    try {
      await coachApi.clearHistory();
    } catch (e) {}
    const resetList = [getInitialAiMessage(firstName)];
    saveMessages(resetList);
    setMemoryModalVisible(false);
  };

  useEffect(() => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
  }, [messages, isStreaming]);

  return (
    <View style={styles.fixedBgContainer}>
      {/* Spartan Cosmic Wallpaper Background */}
      <Image
        source={require('@/assets/images/chat_bg_spartan.png')}
        style={styles.fixedBgImage}
        resizeMode="cover"
      />

      {/* Dark Overlay Mask */}
      <View style={styles.darkMask} />

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
                router.navigate('/(tabs)/home' as any);
              }
            }}
          >
            <Ionicons name="chevron-back" size={24} color="#00E5FF" />
          </TouchableOpacity>

          <View style={styles.headerTitleBox}>
            <View style={styles.badgeRow}>
              <View style={styles.livePulseDot} />
              <ThemedText style={styles.moduleBadge}>AI MINDSET STRATEGIST</ThemedText>
            </View>
            <ThemedText style={styles.headerTitle}>AI Coach</ThemedText>
          </View>

          <View style={{ width: 36 }} />
        </View>

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        >
          {/* Messages Stream */}
          <PageEntrance style={{ flex: 1 }}>
            <ScrollView
              ref={scrollViewRef}
              contentContainerStyle={styles.messagesContainer}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="interactive"
              automaticallyAdjustKeyboardInsets={true}
            >
              {/* Continuous Message Stream */}
              {messages.map((item) => (
                <View
                  key={item.id}
                  style={[
                    styles.messageRow,
                    item.sender === 'user' ? styles.userRow : styles.aiRow,
                  ]}
                >
                  {item.sender === 'ai' && (
                    <View style={styles.aiAvatarCircle}>
                      <Ionicons name="sparkles" size={13} color="#00E5FF" />
                    </View>
                  )}

                  <View style={{ flex: 1, alignItems: item.sender === 'user' ? 'flex-end' : 'flex-start' }}>
                    <View
                      style={[
                        styles.messageBubble,
                        item.sender === 'user' ? styles.userBubble : styles.aiBubble,
                      ]}
                    >
                      <ThemedText style={styles.messageText}>{item.text}</ThemedText>
                    </View>
                  </View>
                </View>
              ))}

              {isStreaming && (
                <View style={[styles.messageRow, styles.aiRow]}>
                  <View style={styles.aiAvatarCircle}>
                    <Ionicons name="sparkles" size={13} color="#00E5FF" />
                  </View>
                  <View style={[styles.messageBubble, styles.aiBubble, { paddingVertical: 10 }]}>
                    <ThemedText style={styles.streamingText}>Synthesizing insight...</ThemedText>
                  </View>
                </View>
              )}
            </ScrollView>
          </PageEntrance>

          {/* Input Bar — Matching Community Floating Pill Bar */}
          <View style={styles.inputArea}>
            <View style={styles.inputWrapper}>
              <TextInput
                style={[
                  styles.textInput,
                  { height: inputHeight }
                ]}
                placeholder="Type a message..."
                placeholderTextColor="rgba(255, 255, 255, 0.45)"
                value={inputMessage}
                onChangeText={handleInputChange}
                onContentSizeChange={(e) => {
                  const measuredHeight = e.nativeEvent.contentSize.height;
                  setInputHeight(getDynamicInputHeight(inputMessage, measuredHeight));
                }}
                onFocus={() => {
                  setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 250);
                }}
                multiline={true}
                maxLength={1500}
                cursorColor="#00E5FF"
                selectionColor="rgba(0, 229, 255, 0.35)"
                underlineColorAndroid="transparent"
              />
              <TouchableOpacity
                style={[styles.sendBtn, !inputMessage.trim() && styles.sendBtnDisabled]}
                disabled={!inputMessage.trim() || isStreaming}
                onPress={() => handleSendMessage()}
              >
                <Ionicons name="arrow-up" size={18} color="#000000" />
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>

      {/* AI Memory Bank & Context Modal */}
      <Modal
        visible={memoryModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setMemoryModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="hardware-chip-outline" size={20} color="#6366F1" />
                <View>
                  <ThemedText style={styles.modalTitle}>AI Mindset Memory</ThemedText>
                  <ThemedText style={styles.modalSub}>Injected triggers & long-term preferences</ThemedText>
                </View>
              </View>
              <TouchableOpacity onPress={() => setMemoryModalVisible(false)}>
                <Ionicons name="close-circle-outline" size={24} color="rgba(255,255,255,0.6)" />
              </TouchableOpacity>
            </View>

            {/* Add Custom Memory Input */}
            <View style={styles.addMemRow}>
              <TextInput
                style={styles.addMemInput}
                placeholder="Add custom preference or trigger..."
                placeholderTextColor="rgba(255,255,255,0.3)"
                value={newMemoryInput}
                onChangeText={setNewMemoryInput}
              />
              <TouchableOpacity style={styles.addMemBtn} onPress={handleAddMemory}>
                <Ionicons name="add" size={18} color="#ffffff" />
              </TouchableOpacity>
            </View>

            {/* Memories List */}
            <ScrollView style={{ maxHeight: 280, marginVertical: 10 }} showsVerticalScrollIndicator={false}>
              <View style={{ gap: 8 }}>
                {memories.map((mem) => (
                  <View key={mem.id} style={styles.memoryCard}>
                    <View style={styles.memoryCardHeader}>
                      <View style={styles.categoryBadge}>
                        <ThemedText style={styles.categoryBadgeText}>{mem.category.toUpperCase()}</ThemedText>
                      </View>
                      <ThemedText style={styles.memoryDate}>{mem.dateAdded}</ThemedText>
                    </View>
                    <ThemedText style={styles.memoryText}>{mem.text}</ThemedText>
                  </View>
                ))}
              </View>
            </ScrollView>

            {/* Modal Footer Controls */}
            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.clearChatBtn} onPress={handleClearChat}>
                <Ionicons name="trash-outline" size={14} color="#EF4444" />
                <ThemedText style={styles.clearChatText}>Clear Chat Thread</ThemedText>
              </TouchableOpacity>

              <TouchableOpacity style={styles.doneBtn} onPress={() => setMemoryModalVisible(false)}>
                <ThemedText style={styles.doneBtnText}>Close</ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const webNoOutline = Platform.OS === 'web'
  ? ({ outlineStyle: 'none', outlineWidth: 0, webkitTapHighlightColor: 'transparent' } as any)
  : {};

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
  safeArea: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 229, 255, 0.15)',
    backgroundColor: '#030712',
  },
  backBtn: {
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
    ...webNoOutline,
  },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    ...webNoOutline,
  },
  memoryPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    ...webNoOutline,
  },
  memoryPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#818CF8',
  },
  headerTitleBox: {
    flex: 1,
    alignItems: 'center',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  livePulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  moduleBadge: {
    fontSize: 9,
    fontWeight: '800',
    color: '#00E5FF',
    letterSpacing: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  chatStream: { flex: 1 },
  messagesContainer: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 14,
  },
  messageRow: {
    flexDirection: 'row',
    gap: 8,
    width: '100%',
  },
  userRow: {
    justifyContent: 'flex-end',
  },
  aiRow: {
    justifyContent: 'flex-start',
  },
  aiAvatarCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0, 229, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  messageBubble: {
    maxWidth: '85%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    overflow: 'hidden',
    ...webNoOutline,
  },
  userBubble: {
    backgroundColor: 'rgba(0, 229, 255, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.35)',
    borderBottomRightRadius: 2,
    alignSelf: 'flex-end',
    ...webNoOutline,
  },
  aiBubble: {
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderBottomLeftRadius: 2,
    alignSelf: 'flex-start',
    ...webNoOutline,
  },
  messageText: {
    fontSize: 13.5,
    color: '#F8FAFC',
    lineHeight: 20,
    flexShrink: 1,
    ...(Platform.OS === 'web' ? { wordBreak: 'break-word', overflowWrap: 'anywhere' } : {}),
  },
  streamingText: {
    fontSize: 12,
    color: '#94A3B8',
    fontStyle: 'italic',
  },
  timestampText: {
    fontSize: 9.5,
    color: 'rgba(255, 255, 255, 0.35)',
    marginTop: 3,
    marginHorizontal: 4,
  },
  actionChipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  chipButton: {
    backgroundColor: 'rgba(99, 102, 241, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.25)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    ...webNoOutline,
  },
  chipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#818CF8',
  },
  inputArea: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 10 : 8,
    backgroundColor: '#030712',
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 229, 255, 0.15)',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0C1322',
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: 'rgba(0, 229, 255, 0.4)',
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 4 : 2,
    minHeight: 44,
    ...webNoOutline,
  },
  textInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 14,
    lineHeight: 20,
    minHeight: 38,
    maxHeight: 110,
    textAlignVertical: 'center',
    paddingVertical: Platform.OS === 'web' ? 8 : (Platform.OS === 'ios' ? 8 : 4),
    paddingRight: 8,
    ...webNoOutline,
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
    ...webNoOutline,
  },
  sendBtnDisabled: {
    opacity: 0.35,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#090D16',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    padding: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
  },
  modalSub: {
    fontSize: 10.5,
    color: '#94A3B8',
  },
  addMemRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  addMemInput: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    color: '#ffffff',
    fontSize: 12,
  },
  addMemBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#6366F1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  memoryCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    padding: 10,
    gap: 4,
  },
  memoryCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  categoryBadge: {
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  categoryBadgeText: {
    fontSize: 8.5,
    fontWeight: '800',
    color: '#818CF8',
  },
  memoryDate: {
    fontSize: 9.5,
    color: '#64748B',
  },
  memoryText: {
    fontSize: 12,
    color: '#E2E8F0',
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
    paddingTop: 10,
  },
  clearChatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  clearChatText: {
    fontSize: 11,
    color: '#EF4444',
  },
  doneBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 10,
  },
  doneBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
  },
});
