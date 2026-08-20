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

const STORAGE_CHAT_KEY = '@zenwill_world_group_chat_history_v1';

export const communityApi = {
  async getMessages(limit = 100): Promise<WorldChatMessage[]> {
    try {
      const messages = await api.get<WorldChatMessage[]>(`/community/messages?limit=${limit}`);
      if (messages && messages.length > 0) {
        await AsyncStorage.setItem(STORAGE_CHAT_KEY, JSON.stringify(messages));
        return messages;
      }
    } catch (e) {
      console.log('[Community API] getMessages backend notice:', e);
    }

    try {
      const cached = await AsyncStorage.getItem(STORAGE_CHAT_KEY);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (e) {
      // Silent catch
    }
    return [];
  },

  async sendMessage(payload: CreateMessagePayload): Promise<WorldChatMessage> {
    try {
      const res = await api.post<WorldChatMessage>('/community/messages', payload, false);
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
      return await api.get<ConversationSummaryItem[]>('/community/dm/conversations');
    } catch (e) {
      console.log('[Community API] getDmConversations notice:', e);
      return [];
    }
  },

  async getDmHistory(targetUserIdentifier: string): Promise<DirectMessageItem[]> {
    try {
      return await api.get<DirectMessageItem[]>(`/community/dm/${encodeURIComponent(targetUserIdentifier)}`);
    } catch (e) {
      console.log('[Community API] getDmHistory notice:', e);
      return [];
    }
  },

  async sendDirectMessage(
    targetUserIdentifier: string,
    content: string,
    messageType: string = 'text',
    audioDuration?: string,
  ): Promise<DirectMessageItem> {
    try {
      return await api.post<DirectMessageItem>(`/community/dm/${encodeURIComponent(targetUserIdentifier)}`, {
        receiver_id: targetUserIdentifier,
        content,
        message_type: messageType,
        audio_duration: audioDuration,
      });
    } catch (e) {
      console.log('[Community API] sendDirectMessage notice:', e);
      return {
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
    }
  },

  async searchOperatives(query: string): Promise<Array<{ id: string; name: string; username: string; badge: string }>> {
    try {
      return await api.get(`/community/users/search?q=${encodeURIComponent(query)}`);
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
};
