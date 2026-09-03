import api from './api';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface WorldChatMessage {
  id: string;
  user_id: string;
  author_name: string;
  author_rank: string;
  author_badge: string;
  author_streak: number;
  content: string;
  created_at: string;
  likes_count: number;
}

export interface CreateMessagePayload {
  user_id?: string;
  author_name: string;
  author_rank: string;
  author_badge: string;
  author_streak: number;
  content: string;
}

export interface CommunityRanking {
  rank_number: number;
  id: string;
  author_name: string;
  badge: string;
  rank_tier: string;
  streak_days: number;
  mind_strength: number;
  is_user?: boolean;
}

export interface DirectMessageItem {
  id: string;
  sender_id: string;
  sender_name: string;
  sender_username?: string;
  receiver_id: string;
  receiver_name: string;
  receiver_username?: string;
  content: string;
  message_type?: string;
  audio_duration?: string;
  is_read?: boolean;
  created_at: string;
}

export interface ConversationSummaryItem {
  other_user_id: string;
  other_user_name: string;
  other_user_username?: string;
  last_message: string;
  last_message_at: string;
  unread_count?: number;
}

export interface UserSearchResult {
  id: string;
  name: string;
  username: string;
  badge: string;
  rank?: string;
  streak?: number;
}

const STORAGE_CHAT_KEY = '@zenwill_world_group_chat_history_v1';
const STORAGE_DM_KEY = '@zenwill_dm_conversations_cache_v1';

let memoryCachedMessages: WorldChatMessage[] = [];
let memoryCachedDmConversations: ConversationSummaryItem[] = [];
let memoryDeletedConvIds: Set<string> = new Set();

const sanitizeWorldMessages = (msgs: any[]): WorldChatMessage[] => {
  if (!Array.isArray(msgs)) return [];
  return msgs.filter((m) => {
    if (!m) return false;
    const uid = String(m.user_id || '').toLowerCase();
    const name = String(m.author_name || '').toUpperCase();
    const content = String(m.content || '').toLowerCase();
    if (uid.startsWith('spartan_') || uid === 'system') return false;
    if (name.includes('BATTLE HORN') || name.includes('🚨') || name.includes('SHIELD')) return false;
    if (content.includes('90-second sync room active') || content.includes('nudged brother')) return false;
    return true;
  });
};

// Immediately hydrate cache from disk in background
AsyncStorage.getItem(STORAGE_CHAT_KEY).then((cached) => {
  if (cached && memoryCachedMessages.length === 0) {
    try {
      memoryCachedMessages = sanitizeWorldMessages(JSON.parse(cached));
    } catch (e) {}
  }
});

AsyncStorage.getItem(STORAGE_DM_KEY).then((cached) => {
  if (cached && memoryCachedDmConversations.length === 0) {
    try {
      memoryCachedDmConversations = JSON.parse(cached);
    } catch (e) {}
  }
});

export const getCachedMessages = (): WorldChatMessage[] => memoryCachedMessages;
export const setCachedMessages = (msgs: WorldChatMessage[]) => {
  memoryCachedMessages = sanitizeWorldMessages(msgs);
};

export const getCachedDmConversations = (): ConversationSummaryItem[] => memoryCachedDmConversations;
export const setCachedDmConversations = (convs: ConversationSummaryItem[]) => {
  memoryCachedDmConversations = convs;
};

export const getDeletedConvIds = (): Set<string> => memoryDeletedConvIds;

const memoryCachedDmHistories = new Map<string, DirectMessageItem[]>();

export const getCachedDmHistory = (targetUserId: string): DirectMessageItem[] => {
  return memoryCachedDmHistories.get(targetUserId) || [];
};

export const setCachedDmHistory = (targetUserId: string, msgs: DirectMessageItem[]) => {
  memoryCachedDmHistories.set(targetUserId, msgs);
  AsyncStorage.setItem(`@zenwill_dm_history_${targetUserId}`, JSON.stringify(msgs)).catch(() => {});
};

export const warmUpDmCacheFromDisk = async (targetUserId: string): Promise<DirectMessageItem[]> => {
  if (memoryCachedDmHistories.has(targetUserId) && (memoryCachedDmHistories.get(targetUserId)?.length || 0) > 0) {
    return memoryCachedDmHistories.get(targetUserId)!;
  }
  try {
    const cached = await AsyncStorage.getItem(`@zenwill_dm_history_${targetUserId}`);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed)) {
        memoryCachedDmHistories.set(targetUserId, parsed);
        return parsed;
      }
    }
  } catch {}
  return [];
};

export const communityApi = {
  async getMessages(limit = 100): Promise<WorldChatMessage[]> {
    try {
      const messages = await api.get<WorldChatMessage[]>(`/community/messages?limit=${limit}`);
      if (messages && messages.length > 0) {
        const clean = sanitizeWorldMessages(messages);
        memoryCachedMessages = clean;
        AsyncStorage.setItem(STORAGE_CHAT_KEY, JSON.stringify(clean)).catch(() => {});
        return clean;
      }
    } catch (e) {
      console.log('[Community API] getMessages backend notice:', e);
    }

    if (memoryCachedMessages.length > 0) {
      return memoryCachedMessages;
    }

    try {
      const cached = await AsyncStorage.getItem(STORAGE_CHAT_KEY);
      if (cached) {
        memoryCachedMessages = sanitizeWorldMessages(JSON.parse(cached));
        return memoryCachedMessages;
      }
    } catch (e) {
      // Silent catch
    }
    return [];
  },

  async sendMessage(payload: CreateMessagePayload): Promise<WorldChatMessage> {
    try {
      const res = await api.post<WorldChatMessage>('/community/messages', payload, false);
      if (res && res.id) {
        memoryCachedMessages = [...memoryCachedMessages, res];
      }
      return res;
    } catch (e) {
      console.log('[Community API] sendMessage backend notice (handled locally):', e);
      const fallbackMsg: WorldChatMessage = {
        id: `local-${Date.now()}`,
        user_id: payload.user_id || 'user_guest',
        author_name: payload.author_name,
        author_rank: payload.author_rank,
        author_badge: payload.author_badge,
        author_streak: payload.author_streak,
        content: payload.content,
        created_at: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        likes_count: 0,
      };
      memoryCachedMessages = [...memoryCachedMessages, fallbackMsg];
      return fallbackMsg;
    }
  },

  async getRankings(): Promise<CommunityRanking[]> {
    try {
      return await api.get<CommunityRanking[]>('/community/rankings');
    } catch (e) {
      console.log('[Community API] getRankings backend notice:', e);
      return [];
    }
  },

  async likeMessage(messageId: string): Promise<any> {
    try {
      return await api.post(`/community/messages/${messageId}/like`, {}, false);
    } catch (e) {
      return { status: 'success', likes_count: 1 };
    }
  },

  // ── Direct Messaging (DM) Services ──────────────────────────────────────────
  async getDmConversations(): Promise<ConversationSummaryItem[]> {
    try {
      const convs = await api.get<ConversationSummaryItem[]>('/community/dm/conversations');
      if (convs && Array.isArray(convs)) {
        memoryCachedDmConversations = convs;
        AsyncStorage.setItem(STORAGE_DM_KEY, JSON.stringify(convs)).catch(() => {});
        return convs;
      }
    } catch (e) {
      console.log('[Community API] getDmConversations notice:', e);
    }
    return memoryCachedDmConversations;
  },

  async getDmHistory(targetUserIdentifier: string): Promise<DirectMessageItem[]> {
    try {
      const messages = await api.get<DirectMessageItem[]>(`/community/dm/${encodeURIComponent(targetUserIdentifier)}`);
      if (Array.isArray(messages)) {
        setCachedDmHistory(targetUserIdentifier, messages);
        return messages;
      }
    } catch (e) {
      console.log('[Community API] getDmHistory notice:', e);
    }
    const mem = getCachedDmHistory(targetUserIdentifier);
    if (mem.length > 0) return mem;
    try {
      const disk = await AsyncStorage.getItem(`@zenwill_dm_history_${targetUserIdentifier}`);
      if (disk) {
        const parsed = JSON.parse(disk);
        if (Array.isArray(parsed)) {
          memoryCachedDmHistories.set(targetUserIdentifier, parsed);
          return parsed;
        }
      }
    } catch {}
    return [];
  },

  async sendDirectMessage(
    targetUserIdentifier: string,
    content: string,
    messageType: string = 'text',
    audioDuration?: string,
  ): Promise<DirectMessageItem> {
    try {
      const res = await api.post<DirectMessageItem>(`/community/dm/${encodeURIComponent(targetUserIdentifier)}`, {
        receiver_id: targetUserIdentifier,
        content,
        message_type: messageType,
        audio_duration: audioDuration,
      });
      if (res && res.id) {
        const current = getCachedDmHistory(targetUserIdentifier);
        if (!current.some((m) => m.id === res.id)) {
          setCachedDmHistory(targetUserIdentifier, [...current, res]);
        }
      }
      return res;
    } catch (e) {
      console.log('[Community API] sendDirectMessage notice:', e);
      const fallbackMsg: DirectMessageItem = {
        id: `dm-local-${Date.now()}`,
        sender_id: 'user_current',
        sender_name: 'You',
        receiver_id: targetUserIdentifier,
        receiver_name: targetUserIdentifier,
        content,
        message_type: messageType,
        audio_duration: audioDuration,
        is_read: true,
        created_at: new Date().toISOString(),
      };
      const current = getCachedDmHistory(targetUserIdentifier);
      setCachedDmHistory(targetUserIdentifier, [...current, fallbackMsg]);
      return fallbackMsg;
    }
  },

  async searchOperatives(query: string): Promise<UserSearchResult[]> {
    try {
      const res = await api.get<UserSearchResult[]>(`/community/users/search?q=${encodeURIComponent(query)}`);
      return res || [];
    } catch (e) {
      console.log('[Community API] searchOperatives notice:', e);
      return [];
    }
  },

  async getUserStatus(targetIdentifier: string): Promise<{ user_id: string; name: string; is_online: boolean; last_seen: string }> {
    try {
      return await api.get(`/community/users/status/${encodeURIComponent(targetIdentifier)}`);
    } catch (e) {
      return { user_id: targetIdentifier, name: targetIdentifier.split(' ')[0], is_online: false, last_seen: 'Offline' };
    }
  },

  async getDmUnreadCount(): Promise<DirectMessageUnreadInfo> {
    try {
      return await api.get<DirectMessageUnreadInfo>('/community/dm/unread-count');
    } catch {
      try {
        const convs = await this.getDmConversations();
        const unreadSum = convs.reduce((acc, c) => acc + (c.unread_count || 0), 0);
        const latestWithUnread = convs.find((c) => (c.unread_count || 0) > 0);
        return {
          unread_count: unreadSum,
          latest_sender_name: latestWithUnread?.other_user_name || null,
          latest_sender_id: latestWithUnread?.other_user_id || null,
          latest_message: latestWithUnread?.last_message || null,
        };
      } catch {
        return { unread_count: 0 };
      }
    }
  },

  async deleteDmConversation(targetIdentifier: string): Promise<{ status: string; message: string }> {
    try {
      return await api.delete(`/community/dm/${encodeURIComponent(targetIdentifier)}`);
    } catch (e) {
      console.log('[Community API] deleteDmConversation notice:', e);
      return { status: 'success', message: 'Deleted locally' };
    }
  },
};

export interface DirectMessageUnreadInfo {
  unread_count: number;
  latest_sender_name?: string | null;
  latest_sender_id?: string | null;
  latest_message?: string | null;
  latest_created_at?: string | null;
}
