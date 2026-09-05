import { api } from './api';

export interface CellMemberItem {
  user_id: string;
  name: string;
  streak: number;
  xp?: number;
  rank_tier: string;
  badge: string;
  last_checkin_date: string | null;
  last_retain_date?: string | null;
  last_retain_status?: 'retained' | 'relapsed' | 'pending' | null;
  status?: 'retained' | 'relapsed' | 'pending';
  today_checked_in: boolean;
  is_leader: boolean;
  is_online: boolean;
  joined_at: string;
}

export interface CellBroadcastItem {
  id: string;
  type: string;
  user_id: string;
  user_name: string;
  message: string;
  created_at: string;
}

export interface SpartanCellData {
  id: string;
  name: string;
  motto: string;
  join_code: string;
  leader_id: string;
  leader_name: string;
  member_count: number;
  max_members: number;
  total_streak: number;
  collective_xp: number;
  shield_status: 'gold' | 'active' | 'cracked';
  is_public: boolean;
  created_at: string;
  broadcasts?: CellBroadcastItem[];
  members: CellMemberItem[];
}

export interface BattleParticipant {
  user_id: string;
  name: string;
  streak?: number;
  badge: string;
  joined_at: string;
  last_active_at?: string;
}

export interface BattleMessageItem {
  id: string;
  user_id: string;
  user_name: string;
  user_streak: number;
  text: string;
  is_system?: boolean;
  created_at: string;
}

export interface BattleReaction {
  user_id: string;
  user_name: string;
  rune: string;
  created_at: string;
}

export interface BattleSessionData {
  id: string;
  session_number?: number;
  initiator_id: string;
  initiator_name: string;
  initiator_streak: number;
  initiator_location: string;
  duration_seconds: number;
  status: 'active' | 'completed' | 'expired';
  participant_count: number;
  participants: BattleParticipant[];
  messages: BattleMessageItem[];
  reactions: BattleReaction[];
  started_at: string;
  expires_at: string;
  time_remaining_seconds: number;
  is_joined: boolean;
}

export const spartanApi = {
  // ── Spartan Cell Hub ──────────────────────────────────────────────────────
  async createCell(name: string, motto: string = 'We hold the line together.', isPublic: boolean = true): Promise<SpartanCellData> {
    return api.post<SpartanCellData>('/spartan-cells/create', { name, motto, is_public: isPublic });
  },

  async joinCell(joinCode: string): Promise<SpartanCellData> {
    return api.post<SpartanCellData>('/spartan-cells/join', { join_code: joinCode });
  },

  async getMyCell(): Promise<SpartanCellData | null> {
    return api.get<SpartanCellData | null>('/spartan-cells/my-cell');
  },

  async leaveCell(): Promise<{ status: string; message: string }> {
    return api.post<{ status: string; message: string }>('/spartan-cells/leave');
  },

  async deleteCell(): Promise<{ status: string; message: string }> {
    return api.post<{ status: string; message: string }>('/spartan-cells/delete');
  },

  async getCellLeaderboard(limit: number = 50): Promise<SpartanCellData[]> {
    return api.get<SpartanCellData[]>(`/spartan-cells/leaderboard?limit=${limit}`);
  },

  async getPublicCells(limit: number = 20): Promise<SpartanCellData[]> {
    return api.get<SpartanCellData[]>(`/spartan-cells/public-cells?limit=${limit}`);
  },

  async nudgeMember(targetUserId: string, targetUserName: string): Promise<{ status: string; message: string }> {
    return api.post<{ status: string; message: string }>('/spartan-cells/nudge', {
      target_user_id: targetUserId,
      target_user_name: targetUserName,
    });
  },

  async sendStrength(targetUserId: string, targetUserName: string, customMessage?: string): Promise<{ status: string; message: string }> {
    return api.post<{ status: string; message: string }>('/spartan-cells/send-strength', {
      target_user_id: targetUserId,
      target_user_name: targetUserName,
      custom_message: customMessage,
    });
  },

  // ── Spartan Battlefield (Live Chat & 15-Min Urge Rescue) ──────────────────
  async triggerBattleHornSOS(location: string = 'Global Sanctum'): Promise<BattleSessionData> {
    return api.post<BattleSessionData>('/battlefield/sos', { location });
  },

  async getActiveBattleSession(): Promise<BattleSessionData | null> {
    return api.get<BattleSessionData | null>('/battlefield/active');
  },

  async joinBattleSession(sessionId: string): Promise<BattleSessionData> {
    return api.post<BattleSessionData>(`/battlefield/join/${sessionId}`);
  },

  async sendBattleMessage(text: string, sessionId?: string): Promise<BattleSessionData> {
    try {
      return await api.post<BattleSessionData>('/battlefield/message', { text });
    } catch (err: any) {
      if (sessionId) {
        try {
          return await api.post<BattleSessionData>(`/battlefield/react/${sessionId}`, { rune: text });
        } catch (_) {}
      }
      throw err;
    }
  },

  async battleHeartbeat(): Promise<BattleSessionData> {
    return api.post<BattleSessionData>('/battlefield/heartbeat');
  },

  async startNewBattleSession(): Promise<BattleSessionData> {
    return api.post<BattleSessionData>('/battlefield/new-session');
  },

  async sendBattleReactionRune(sessionId: string, rune: string): Promise<BattleSessionData> {
    return api.post<BattleSessionData>(`/battlefield/react/${sessionId}`, { rune });
  },

  async completeBattleSession(sessionId: string): Promise<{ status: string; message: string; honor_awarded: number }> {
    return api.post<{ status: string; message: string; honor_awarded: number }>(`/battlefield/complete/${sessionId}`);
  },

  async leaveBattleSession(): Promise<{ status: string; message: string }> {
    try {
      return await api.post<{ status: string; message: string }>('/battlefield/leave');
    } catch {
      return { status: 'success', message: 'Left local session' };
    }
  },
};
