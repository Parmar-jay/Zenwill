import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  View,
  Platform,
  TextInput,
  KeyboardAvoidingView,
  Image,
} from 'react-native';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { communityApi, DirectMessageItem } from '@/services/community-api';
import { useOnboardingStore } from '@/store/onboarding-store';
import { useAuthStore } from '@/store/auth-store';

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
    if (v.startsWith('user_') || v.startsWith('usr_') || v.startsWith('guest_')) {
      return 'Operative';
    }
    if (v.includes('@')) {
      return v.split('@')[0];
    }
    return v.split(' ')[0];
  };

  const [targetDisplayName, setTargetDisplayName] = useState<string>(getCleanName(rawTargetName));

  const currentUser = useAuthStore((state) => state.user);
  const currentUserId = currentUser?.id || currentUser?.email || 'user_current';
  const myName = useOnboardingStore((state) => state.firstName) || 'Operative';

  const [messages, setMessages] = useState<DirectMessageItem[]>([]);
  const [inputText, setInputText] = useState<string>('');
  const [inputHeight, setInputHeight] = useState<number>(40);
  const [isSending, setIsSending] = useState<boolean>(false);

  // Online status state
  const [isTargetOnline, setIsTargetOnline] = useState<boolean>(false);
  const [userStatusText, setUserStatusText] = useState<string>('Offline');

  // Load real DM Chat history & target online status from database
  useEffect(() => {
    loadChatHistory();
    fetchUserOnlineStatus();
    const interval = setInterval(() => {
      loadChatHistory(false);
      fetchUserOnlineStatus();
    }, 800);
    return () => clearInterval(interval);
  }, [targetUserId]);

  const fetchUserOnlineStatus = async () => {
    try {
      const status = await communityApi.getUserStatus(targetUserId);
      if (status) {
        setIsTargetOnline(status.is_online);
        setUserStatusText(status.last_seen || (status.is_online ? 'Online' : 'Offline'));
        if (status.name && status.name.length < 24 && !status.name.startsWith('user_')) {
          setTargetDisplayName(status.name.split(' ')[0]);
        }
      }
    } catch (e) {
      // Silent catch
    }
  };

  const loadChatHistory = async (shouldScroll = true) => {
    try {
      const history = await communityApi.getDmHistory(targetUserId);
      if (history) {
        setMessages(history);
      }
      if (shouldScroll) {
        setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 200);
      }
    } catch (e) {
      console.log('Error loading DM history:', e);
    }
  };

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
    setInputText(text);
    setInputHeight(getDynamicInputHeight(text));
  };

  const handleSend = async () => {
    if (!inputText.trim() || isSending) return;
    triggerHaptic(Haptics.ImpactFeedbackStyle.Light);

    const textToSend = inputText.trim();
    setInputText('');
    setInputHeight(40);
    setIsSending(true);

    const tempMsg: DirectMessageItem = {
      id: `temp-${Date.now()}`,
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
      await communityApi.sendDirectMessage(targetUserId, textToSend, 'text');
      await loadChatHistory(true);
    } catch (e) {
      console.log('Error sending DM:', e);
    } finally {
      setIsSending(false);
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

      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
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

            <View style={{ width: 32 }} />
          </View>

          {/* Scrollable Chat Area */}
          <ScrollView
            ref={scrollViewRef}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
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
                const isMe = (currentUserId !== 'user_current' && msg.sender_id === currentUserId) ||
                             (currentUser?.email ? msg.sender_id === currentUser.email : false) ||
                             (msg.sender_id === 'user_current' && msg.sender_name === myName) ||
                             (msg.sender_name && msg.sender_name.toLowerCase() === myName.toLowerCase());

                return (
                  <View
                    key={msg.id}
                    style={[
                      styles.msgRow,
                      isMe ? styles.msgRowMe : styles.msgRowOther,
                    ]}
                  >
                    {/* Standard Text Message Bubble */}
                    <View style={isMe ? styles.bubbleMe : styles.bubbleOther}>
                      <ThemedText style={styles.msgContentText}>{msg.content}</ThemedText>
                      <View style={styles.msgFooterRow}>
                        <ThemedText style={styles.msgTimeText}>
                          {formatTime(msg.created_at)}
                        </ThemedText>
                        {isMe && (
                          msg.is_read ? (
                            <Ionicons name="checkmark-done" size={15} color="#38BDF8" style={{ marginLeft: 3 }} />
                          ) : (
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
                      handleSend();
                    }
                  }
                }}
                blurOnSubmit={false}
                returnKeyType="send"
                onSubmitEditing={() => {
                  if (Platform.OS !== 'web') {
                    handleSend();
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
                onPress={handleSend}
              >
                <Ionicons name="arrow-up" size={18} color="#000000" />
              </TouchableOpacity>
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
    backgroundColor: 'rgba(10, 13, 20, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    borderBottomRightRadius: 14,
    borderBottomLeftRadius: 2,
    paddingHorizontal: 12,
    paddingVertical: 8,
    maxWidth: '78%',
  },
  bubbleMe: {
    backgroundColor: 'rgba(0, 229, 255, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.35)',
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 2,
    paddingHorizontal: 12,
    paddingVertical: 8,
    maxWidth: '78%',
  },
  msgContentText: {
    fontSize: 13,
    color: '#F8FAFC',
    lineHeight: 18,
    fontWeight: '400',
  },
  msgFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    marginTop: 4,
  },
  msgTimeText: {
    fontSize: 10,
    color: '#94A3B8',
  },

  /* Input Bar — Identical to World Chat */
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
});
