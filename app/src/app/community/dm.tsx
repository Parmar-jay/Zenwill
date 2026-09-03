import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  View,
  Platform,
  TextInput,
  KeyboardAvoidingView,
  Image,
  Keyboard,
  StatusBar,
  Alert,
  Modal,
} from 'react-native';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { communityApi, DirectMessageItem } from '@/services/community-api';
import { useOnboardingStore } from '@/store/onboarding-store';
import { useAuthStore } from '@/store/auth-store';
import { useUnreadStore } from '@/store/unread-store';

const triggerHaptic = (style = Haptics.ImpactFeedbackStyle.Light) => {
  try {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(style);
    }
  } catch (error) {
    // Silent catch
  }
};

const DEFAULT_AVATAR = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80';

export default function DirectMessageScreen() {
  const router = useRouter();
  const searchParams = useLocalSearchParams();
  const scrollViewRef = useRef<ScrollView>(null);

  // Target user params
  const targetUserId = (searchParams.user_id as string) || 'operative';
  const rawTargetName = (searchParams.user_name as string) || (searchParams.username as string) || '';

  const getCleanName = (raw: string) => {
    if (!raw || !raw.trim()) return 'Operative';
    const v = raw.trim();
    if (v.includes('@')) {
      return v.split('@')[0];
    }
    return v;
  };

  const [targetDisplayName, setTargetDisplayName] = useState<string>(getCleanName(rawTargetName));

  const currentUser = useAuthStore((state) => state.user);
  const currentUserId = currentUser?.id ? String(currentUser.id) : (currentUser?.email || '');
  const myName = useOnboardingStore((state) => state.firstName) || currentUser?.name || 'You';

  const myUserIds = useMemo(() => {
    const ids = new Set<string>();
    if (currentUser?.id) ids.add(String(currentUser.id).trim().toLowerCase());
    if (currentUser?.email) ids.add(currentUser.email.trim().toLowerCase());
    return ids;
  }, [currentUser?.id, currentUser?.email]);

  const [messages, setMessages] = useState<DirectMessageItem[]>([]);
  const [inputText, setInputText] = useState<string>('');
  const [inputHeight, setInputHeight] = useState<number>(40);
  const [isSending, setIsSending] = useState<boolean>(false);

  // Online status state
  const [isTargetOnline, setIsTargetOnline] = useState<boolean>(false);
  const [userStatusText, setUserStatusText] = useState<string>('Offline');

  const insets = useSafeAreaInsets();
  const [keyboardHeight, setKeyboardHeight] = useState<number>(0);
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Load real DM Chat history & target user status every 3s
  useEffect(() => {
    loadChatHistory(true);
    fetchUserOnlineStatus();

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

    const interval = setInterval(() => {
      loadChatHistory(false);
      fetchUserOnlineStatus();
    }, 3000);

    return () => {
      clearInterval(interval);
      showSub.remove();
      hideSub.remove();
    };
  }, [targetUserId]);

  const fetchUserOnlineStatus = async () => {
    try {
      const status = await communityApi.getUserStatus(targetUserId);
      if (status) {
        setIsTargetOnline(status.is_online);
        setUserStatusText(status.last_seen || (status.is_online ? 'Online' : 'Offline'));
        if (status.name && status.name.length < 24 && !status.name.startsWith('user_') && status.name.toLowerCase() !== 'operative') {
          setTargetDisplayName(status.name.split(' ')[0]);
        }
      }
    } catch (e) {
      // Silent catch
    }
  };

  const loadChatHistory = async (shouldScroll = false) => {
    try {
      const history = await communityApi.getDmHistory(targetUserId);
      if (history && Array.isArray(history)) {
        setMessages((prev) => {
          const historyIds = new Set(history.map((h) => h.id));
          // Preserve any in-flight or unconfirmed message that is not yet in history
          const unconfirmedPrev = prev.filter((p) => {
            if (historyIds.has(p.id)) return false;
            const alreadyInHistory = history.some(
              (h) => h.content === p.content && h.sender_id === p.sender_id
            );
            return !alreadyInHistory;
          });
          return [...history, ...unconfirmedPrev];
        });
      }
      if (shouldScroll) {
        requestAnimationFrame(() => {
          scrollViewRef.current?.scrollToEnd({ animated: true });
        });
      }
      useUnreadStore.getState().fetchUnreadCount().catch(() => {});
    } catch (e) {
      console.log('Error loading DM history:', e);
    }
  };

  const handleInputChange = (text: string) => {
    setInputText(text);
  };

  const handleSend = async () => {
    if (!inputText.trim() || isSending) return;
    triggerHaptic(Haptics.ImpactFeedbackStyle.Light);

    const textToSend = inputText.trim();
    setInputText('');
    setInputHeight(40);
    setIsSending(true);

    const tempId = `temp-${Date.now()}`;
    const tempMsg: DirectMessageItem = {
      id: tempId,
      sender_id: currentUserId,
      sender_name: myName,
      receiver_id: targetUserId,
      receiver_name: targetDisplayName,
      content: textToSend,
      message_type: 'text',
      is_read: false,
      created_at: new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true }),
    };

    setMessages((prev) => [...prev, tempMsg]);
    requestAnimationFrame(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    });

    try {
      const res = await communityApi.sendDirectMessage(targetUserId, textToSend, 'text');
      if (res && res.id) {
        setMessages((prev) =>
          prev.map((m) => (m.id === tempId ? res : m))
        );
      }
    } catch (e) {
      console.log('Error sending DM:', e);
    } finally {
      setIsSending(false);
    }
  };

  const handlePromptDeleteChat = () => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Heavy);
    setShowDeleteModal(true);
  };

  const handleConfirmDeleteChat = async () => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Heavy);
    setIsDeleting(true);
    setShowDeleteModal(false);
    setMessages([]);
    try {
      await communityApi.deleteDmConversation(targetUserId);
      if (router.canGoBack()) {
        router.back();
      } else {
        router.navigate('/community' as any);
      }
    } catch (e) {
      console.log('Error deleting chat:', e);
    } finally {
      setIsDeleting(false);
    }
  };

  const formatTime = (isoString: string) => {
    try {
      if (!isoString || isoString === 'Invalid Date' || isoString === 'null' || isoString === 'undefined') {
        return '';
      }
      if (isoString.includes('AM') || isoString.includes('PM')) {
        return isoString;
      }
      const d = new Date(isoString);
      if (isNaN(d.getTime())) {
        return '';
      }
      return d.toLocaleTimeString('en-IN', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
    } catch (e) {
      return '';
    }
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

      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={0}
        >
          <View style={{ flex: 1, paddingBottom: Platform.OS === 'android' ? keyboardHeight : 0 }}>
            {/* Header Bar — Clean, displaying display name and online status */}
            <View style={styles.headerBar}>
              <TouchableOpacity
                style={styles.backBtn}
                onPress={() => {
                  triggerHaptic();
                  if (router.canGoBack()) {
                    router.back();
                  } else {
                    router.navigate('/community' as any);
                  }
                }}
              >
                <Ionicons name="chevron-back" size={24} color="#00E5FF" />
              </TouchableOpacity>

              <View style={styles.userInfoBox}>
                <View style={styles.avatarWrapper}>
                  <ThemedText style={{ fontSize: 13, fontWeight: '800', color: '#00E5FF' }}>
                    {targetDisplayName.charAt(0).toUpperCase()}
                  </ThemedText>
                  <View style={[styles.onlineDot, { backgroundColor: isTargetOnline ? '#22C55E' : '#64748B' }]} />
                </View>
                <View>
                  <ThemedText style={styles.userNameText}>{targetDisplayName}</ThemedText>
                  <ThemedText style={[styles.userStatusText, { color: isTargetOnline ? '#22C55E' : '#94A3B8' }]}>
                    {userStatusText}
                  </ThemedText>
                </View>
              </View>

              <TouchableOpacity
                style={styles.headerTrashBtn}
                onPress={handlePromptDeleteChat}
                activeOpacity={0.7}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="trash-outline" size={16} color="rgba(248, 113, 113, 0.85)" />
              </TouchableOpacity>
            </View>

            {/* Scrollable Chat Area */}
            <ScrollView
              ref={scrollViewRef}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="interactive"
            >
              {/* End-to-End Encrypted Banner */}
              <View style={styles.encryptedBanner}>
                <View style={styles.encryptedHeader}>
                  <Ionicons name="lock-closed" size={13} color="#F59E0B" />
                  <ThemedText style={styles.encryptedTitle}>Messages are end-to-end encrypted</ThemedText>
                </View>
                <ThemedText style={styles.encryptedSub}>
                  No one outside of this chat can read or listen to them.
                </ThemedText>
              </View>

              {/* Empty Messages State */}
              {messages.length === 0 ? (
                <View style={styles.emptyDmState}>
                  <Ionicons name="chatbubbles-outline" size={32} color="#00E5FF" />
                  <ThemedText style={styles.emptyDmText}>
                    Direct Message conversation with {targetDisplayName}. Send a message to start!
                  </ThemedText>
                </View>
              ) : (
                messages.map((msg) => {
                  const senderId = (msg.sender_id || '').trim().toLowerCase();
                  const isMe = (msg.id && typeof msg.id === 'string' && msg.id.startsWith('temp-')) ||
                               (myUserIds.size > 0 && myUserIds.has(senderId));

                  return (
                    <View
                      key={msg.id}
                      style={[
                        styles.msgRow,
                        isMe ? styles.msgRowMe : styles.msgRowOther,
                      ]}
                    >
                      {/* Standard Text Message Bubble matching WhatsApp style */}
                      <View style={isMe ? styles.bubbleMe : styles.bubbleOther}>
                        <ThemedText style={styles.msgContentText}>{msg.content}</ThemedText>
                        <View style={styles.msgFooterRow}>
                          <ThemedText style={styles.msgTimeText}>
                            {formatTime(msg.created_at)}
                          </ThemedText>
                          {isMe && (
                            msg.is_read ? (
                              // 1. User has seen/read the message -> Double Blue Tick
                              <Ionicons name="checkmark-done" size={15} color="#53BDEB" style={{ marginLeft: 3 }} />
                            ) : isTargetOnline ? (
                              // 2. User is online (delivered) -> Double Gray Tick
                              <Ionicons name="checkmark-done" size={15} color="#94A3B8" style={{ marginLeft: 3 }} />
                            ) : (
                              // 3. User is offline (sent) -> Single Gray Tick
                              <Ionicons name="checkmark" size={14} color="#94A3B8" style={{ marginLeft: 3 }} />
                            )
                          )}
                        </View>
                      </View>
                    </View>
                  );
                })
              )}
            </ScrollView>

            {/* Floating Pill Message Input Bar matching reference design */}
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
                  placeholder="Type a message..."
                  placeholderTextColor="rgba(255, 255, 255, 0.45)"
                  value={inputText}
                  onChangeText={handleInputChange}
                  onFocus={() => {
                    setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 250);
                  }}
                  multiline={true}
                  maxLength={1000}
                  cursorColor="#00E5FF"
                  selectionColor="rgba(0, 229, 255, 0.35)"
                  underlineColorAndroid="transparent"
                />

                <TouchableOpacity
                  style={[styles.sendBtn, !inputText.trim() && styles.sendBtnDisabled]}
                  activeOpacity={0.8}
                  disabled={!inputText.trim() || isSending}
                  onPress={handleSend}
                >
                  <Ionicons name="arrow-up" size={18} color="#000000" />
                </TouchableOpacity>
              </View>
          </View>
        </View>
      </KeyboardAvoidingView>
      </SafeAreaView>

      {/* CONFIRM DELETE CONVERSATION MODAL */}
      <Modal
        visible={showDeleteModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDeleteModal(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setShowDeleteModal(false)}
        >
          <View style={styles.deleteModalCard} onStartShouldSetResponder={() => true}>
            <View style={styles.deleteModalIconCircle}>
              <Ionicons name="trash-outline" size={22} color="#F87171" />
            </View>

            <ThemedText style={styles.deleteModalTitle}>DELETE CONVERSATION</ThemedText>
            <ThemedText style={styles.deleteModalDesc}>
              Delete all direct messages with{' '}
              <ThemedText style={{ color: '#00E5FF', fontWeight: '700' }}>
                {targetDisplayName}
              </ThemedText>
              ? This action is permanent.
            </ThemedText>

            <View style={styles.deleteModalActionsRow}>
              <TouchableOpacity
                style={styles.deleteModalCancelBtn}
                activeOpacity={0.75}
                onPress={() => setShowDeleteModal(false)}
              >
                <ThemedText style={styles.deleteModalCancelText}>Cancel</ThemedText>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.deleteModalConfirmBtn}
                activeOpacity={0.75}
                onPress={handleConfirmDeleteChat}
              >
                <ThemedText style={styles.deleteModalConfirmText}>Delete Chat</ThemedText>
              </TouchableOpacity>
            </View>
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
  safeArea: { flex: 1 },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 229, 255, 0.15)',
    backgroundColor: 'rgba(6, 6, 10, 0.88)',
  },
  backBtn: {
    padding: 4,
    backgroundColor: 'transparent',
  },
  headerTrashBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userInfoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    flex: 1,
  },
  avatarWrapper: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 229, 255, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  onlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: '#22C55E',
    borderWidth: 1.5,
    borderColor: '#06060A',
  },
  userNameText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  userStatusText: {
    fontSize: 10.5,
    fontWeight: '600',
    color: '#22C55E',
  },
  scrollContent: {
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 20,
    gap: 10,
  },
  encryptedBanner: {
    backgroundColor: 'rgba(12, 16, 26, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.25)',
    borderRadius: 12,
    padding: 10,
    gap: 3,
    marginBottom: 10,
    alignItems: 'center',
  },
  encryptedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  encryptedTitle: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#F59E0B',
  },
  encryptedSub: {
    fontSize: 10.5,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 14,
  },
  emptyDmState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 50,
    gap: 10,
  },
  emptyDmText: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  msgRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    marginVertical: 2,
  },
  msgRowMe: {
    justifyContent: 'flex-end',
  },
  msgRowOther: {
    justifyContent: 'flex-start',
  },
  msgAvatarWrapper: {
    position: 'relative',
    marginBottom: 2,
  },
  msgAvatarImg: {
    width: 26,
    height: 26,
    borderRadius: 13,
  },
  msgOnlineDot: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#22C55E',
    borderWidth: 1,
    borderColor: '#090C14',
  },
  bubbleOther: {
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderBottomRightRadius: 16,
    borderBottomLeftRadius: 3,
    paddingHorizontal: 13,
    paddingVertical: 9,
    maxWidth: '80%',
  },
  bubbleMe: {
    backgroundColor: '#004D40',
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.35)',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 3,
    paddingHorizontal: 13,
    paddingVertical: 9,
    maxWidth: '80%',
  },
  msgContentText: {
    fontSize: 13.5,
    color: '#F8FAFC',
    lineHeight: 19,
    fontWeight: '400',
  },
  msgFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    marginTop: 2,
  },
  msgTimeText: {
    fontSize: 9.5,
    color: 'rgba(255, 255, 255, 0.55)',
  },

  /* Input Bar — Matching WhatsApp style */
  inputContainer: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 10 : 8,
    backgroundColor: '#04070F',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#0C1322',
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: 'rgba(0, 229, 255, 0.45)',
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 6 : 4,
    minHeight: 46,
  },
  textInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 14.5,
    lineHeight: 20,
    minHeight: 34,
    maxHeight: 110,
    textAlignVertical: 'center',
    paddingVertical: Platform.OS === 'web' ? 6 : (Platform.OS === 'ios' ? 6 : 4),
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
    marginBottom: Platform.OS === 'ios' ? 2 : 3,
  },
  sendBtnDisabled: {
    opacity: 0.35,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  deleteModalCard: {
    width: '86%',
    maxWidth: 330,
    backgroundColor: '#090E1A',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(248, 113, 113, 0.25)',
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 18,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 25,
  },
  deleteModalIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  deleteModalTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 6,
    textAlign: 'center',
  },
  deleteModalDesc: {
    fontSize: 12.5,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
  },
  deleteModalActionsRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  deleteModalCancelBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteModalCancelText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#94A3B8',
  },
  deleteModalConfirmBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteModalConfirmText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#F87171',
  },
});
