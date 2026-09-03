import { create } from 'zustand';
import { communityApi } from '../services/community-api';

interface UnreadState {
  unreadCount: number;
  latestSenderName: string | null;
  latestSenderId: string | null;
  latestMessage: string | null;
  latestCreatedAt: string | null;
  isPolling: boolean;

  fetchUnreadCount: () => Promise<number>;
  clearUnreadCount: () => void;
  startRealtimePolling: () => () => void;
}

let pollingInterval: any = null;
let pollSubscribersCount = 0;

export const useUnreadStore = create<UnreadState>((set, get) => ({
  unreadCount: 0,
  latestSenderName: null,
  latestSenderId: null,
  latestMessage: null,
  latestCreatedAt: null,
  isPolling: false,

  fetchUnreadCount: async () => {
    try {
      const data = await communityApi.getDmUnreadCount();
      const count = typeof data?.unread_count === 'number' ? data.unread_count : 0;
      set({
        unreadCount: count,
        latestSenderName: data?.latest_sender_name || null,
        latestSenderId: data?.latest_sender_id || null,
        latestMessage: data?.latest_message || null,
        latestCreatedAt: data?.latest_created_at || null,
      });
      return count;
    } catch {
      return get().unreadCount;
    }
  },

  clearUnreadCount: () => {
    set({
      unreadCount: 0,
      latestSenderName: null,
      latestSenderId: null,
      latestMessage: null,
    });
  },

  startRealtimePolling: () => {
    pollSubscribersCount++;
    get().fetchUnreadCount();

    if (!pollingInterval) {
      pollingInterval = setInterval(() => {
        get().fetchUnreadCount();
      }, 3000); // 3-second rapid background polling for zero-delay real-time notification
      set({ isPolling: true });
    }

    return () => {
      pollSubscribersCount = Math.max(0, pollSubscribersCount - 1);
      if (pollSubscribersCount === 0 && pollingInterval) {
        clearInterval(pollingInterval);
        pollingInterval = null;
        set({ isPolling: false });
      }
    };
  },
}));
