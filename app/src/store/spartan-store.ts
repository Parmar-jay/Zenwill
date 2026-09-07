import { create } from 'zustand';
import {
  spartanApi,
  SpartanCellData,
  BattleSessionData,
} from '../services/spartan-api';

interface SpartanState {
  myCell: SpartanCellData | null;
  activeBattle: BattleSessionData | null;
  cellLeaderboard: SpartanCellData[];
  publicCells: SpartanCellData[];
  myPendingRequests: string[]; // List of cell_id / join_code strings
  isLoadingCell: boolean;
  isLoadingBattle: boolean;
  isNudging: boolean;

  updateLocalMemberStreak: (userIdOrEmail: string, newStreak: number) => void;
  fetchMyCell: () => Promise<SpartanCellData | null>;
  fetchActiveBattle: () => Promise<BattleSessionData | null>;
  fetchCellLeaderboard: () => Promise<void>;
  fetchPublicCells: () => Promise<void>;
  fetchMyJoinRequests: () => Promise<void>;
  createCell: (name: string, motto?: string, isPublic?: boolean) => Promise<SpartanCellData>;
  joinCell: (code: string) => Promise<SpartanCellData>;
  requestJoinCell: (code: string) => Promise<{ status: string; message: string; cell_id: string; join_code: string }>;
  cancelJoinRequest: (codeOrCellId: string) => Promise<void>;
  respondJoinRequest: (cellId: string, requestId: string, action: 'approve' | 'reject') => Promise<any>;
  promoteCoLeader: (targetUserId: string) => Promise<SpartanCellData>;
  demoteCoLeader: (targetUserId: string) => Promise<SpartanCellData>;
  kickMember: (targetUserId: string) => Promise<SpartanCellData>;
  leaveCell: () => Promise<void>;
  deleteCell: () => Promise<void>;
  nudgeMember: (userId: string, userName: string) => Promise<string>;
  sendStrength: (userId: string, userName: string, customMessage?: string) => Promise<string>;
  triggerBattleHorn: (location?: string) => Promise<BattleSessionData>;
  joinActiveBattle: (sessionId: string) => Promise<BattleSessionData>;
  sendReactionRune: (sessionId: string, rune: string) => Promise<void>;
  sendBattleMessage: (text: string) => Promise<BattleSessionData | null>;
  battleHeartbeat: () => Promise<BattleSessionData | null>;
  startNewBattleSession: () => Promise<BattleSessionData | null>;
  completeBattle: (sessionId: string) => Promise<void>;
  resetSpartanStore: () => void;
}

let myCellFetchSeq = 0;

export const useSpartanStore = create<SpartanState>((set, get) => ({
  myCell: null,
  activeBattle: null,
  cellLeaderboard: [],
  publicCells: [],
  myPendingRequests: [],
  isLoadingCell: false,
  isLoadingBattle: false,
  isNudging: false,

  resetSpartanStore: () => {
    set({
      myCell: null,
      activeBattle: null,
      cellLeaderboard: [],
      publicCells: [],
      myPendingRequests: [],
      isLoadingCell: false,
      isLoadingBattle: false,
      isNudging: false,
    });
  },

  updateLocalMemberStreak: (userIdOrEmail: string, newStreak: number) => {
    set((state) => {
      if (!state.myCell) return {};
      let streakDiff = 0;
      const today = new Date().toISOString().split('T')[0];
      const isRelapse = newStreak === 0;

      const seen = new Set<string>();
      const cleanMembers = state.myCell.members.filter((m) => {
        const uid = (m.user_id || '').trim().toLowerCase();
        const key = uid || (m.name || '').trim().toLowerCase();
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      const updatedMembers = cleanMembers.map((m) => {
        const targetClean = (userIdOrEmail || '').trim().toLowerCase();
        const mUid = (m.user_id || '').trim().toLowerCase();
        if (mUid && (mUid === targetClean || m.user_id === userIdOrEmail)) {
          streakDiff = newStreak - (m.streak || 0);
          return {
            ...m,
            streak: newStreak,
            today_checked_in: true,
            status: isRelapse ? ('relapsed' as const) : ('retained' as const),
            last_retain_status: isRelapse ? ('relapsed' as const) : ('retained' as const),
            last_retain_date: today,
            last_checkin_date: today,
          };
        }
        return m;
      });

      const updatedTotalStreak = Math.max(0, (state.myCell.total_streak || 0) + streakDiff);
      const hasRelapse = updatedMembers.some(
        (m) => m.status === 'relapsed' || m.last_retain_status === 'relapsed' || m.streak === 0
      );
      const allRetained = !hasRelapse && updatedMembers.every((m) => m.today_checked_in && m.status === 'retained');
      const shieldStatus = allRetained ? 'gold' : hasRelapse ? 'cracked' : 'active';

      const updatedCell: SpartanCellData = {
        ...state.myCell,
        members: updatedMembers,
        total_streak: updatedTotalStreak,
        shield_status: shieldStatus,
      };

      const updatedLeaderboard = state.cellLeaderboard.map((c) =>
        c.id === updatedCell.id ? updatedCell : c
      );

      return {
        myCell: updatedCell,
        cellLeaderboard: updatedLeaderboard,
      };
    });
  },

  fetchMyCell: async () => {
    const seq = ++myCellFetchSeq;
    try {
      const { TokenStorage } = require('../services/api');
      const token = await TokenStorage.getAccessToken();
      if (!token) {
        if (seq === myCellFetchSeq) {
          set({ isLoadingCell: false });
        }
        return null;
      }

      if (!get().myCell && !get().isLoadingCell) {
        set({ isLoadingCell: true });
      }
      const cell = await spartanApi.getMyCell();
      // If a newer join/leave/create took place while this fetch was in flight, discard this result!
      if (seq !== myCellFetchSeq) {
        return get().myCell;
      }

      if (cell && Array.isArray(cell.members)) {
        const seen = new Set<string>();
        cell.members = cell.members.filter((m) => {
          const uid = (m.user_id || '').trim().toLowerCase();
          const key = uid || (m.name || '').trim().toLowerCase();
          if (!key || seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        // Enforce exact streak & retention consistency
        const hasRelapse = cell.members.some(
          (m) => m.status === 'relapsed' || m.last_retain_status === 'relapsed' || m.streak === 0
        );
        if (hasRelapse && cell.shield_status === 'gold') {
          cell.shield_status = 'cracked';
        }
      }
      set({ myCell: cell, isLoadingCell: false });

      // Automatically register real-time channel subscription for live updates
      if (cell?.id) {
        try {
          const { realtimeClient } = require('../services/realtime-client');
          realtimeClient.subscribe(`cell:${cell.id}`);
        } catch {}
      }

      return cell;
    } catch {
      if (seq === myCellFetchSeq) {
        set({ isLoadingCell: false });
      }
      return null;
    }
  },

  fetchActiveBattle: async () => {
    try {
      const { TokenStorage } = require('../services/api');
      const token = await TokenStorage.getAccessToken();
      if (!token) return null;

      const session = await spartanApi.getActiveBattleSession();
      set({ activeBattle: session });
      return session;
    } catch {
      return null;
    }
  },

  fetchCellLeaderboard: async () => {
    try {
      const list = await spartanApi.getCellLeaderboard();
      set({ cellLeaderboard: list });
    } catch {
      // Keep existing
    }
  },

  fetchPublicCells: async () => {
    try {
      const list = await spartanApi.getPublicCells(20);
      set({ publicCells: list });
    } catch {
      // Keep existing
    }
  },

  fetchMyJoinRequests: async () => {
    try {
      const list = await spartanApi.getMyJoinRequests();
      const keys = list.map((r) => r.join_code || r.cell_id).filter(Boolean);
      set({ myPendingRequests: keys });
    } catch {
      // keep existing
    }
  },

  createCell: async (name: string, motto: string = 'We hold the line together.', isPublic: boolean = true) => {
    const seq = ++myCellFetchSeq;
    try {
      const cell = await spartanApi.createCell(name, motto, isPublic);
      myCellFetchSeq = Math.max(myCellFetchSeq, seq + 1);
      set({ myCell: cell, isLoadingCell: false });
      if (cell?.id) {
        try {
          const { realtimeClient } = require('../services/realtime-client');
          realtimeClient.subscribe(`cell:${cell.id}`);
        } catch {}
      }
      return cell;
    } catch (err) {
      set({ isLoadingCell: false });
      throw err;
    }
  },

  joinCell: async (code: string) => {
    const seq = ++myCellFetchSeq;
    try {
      const cell = await spartanApi.joinCell(code);
      // Bump sequence so background polls cannot overwrite with stale data
      myCellFetchSeq = Math.max(myCellFetchSeq, seq + 1);
      set({ myCell: cell, isLoadingCell: false });
      if (cell?.id) {
        try {
          const { realtimeClient } = require('../services/realtime-client');
          realtimeClient.subscribe(`cell:${cell.id}`);
        } catch {}
      }
      return cell;
    } catch (err) {
      set({ isLoadingCell: false });
      throw err;
    }
  },

  requestJoinCell: async (code: string) => {
    try {
      const res = await spartanApi.requestJoinCell(code);
      const clean = code.trim().toUpperCase();
      set((state) => ({
        myPendingRequests: Array.from(new Set([...state.myPendingRequests, clean, res.join_code, res.cell_id])),
      }));
      return res;
    } catch (err) {
      throw err;
    }
  },

  cancelJoinRequest: async (codeOrCellId: string) => {
    try {
      await spartanApi.cancelJoinRequest(codeOrCellId);
      const clean = codeOrCellId.trim().toUpperCase();
      set((state) => ({
        myPendingRequests: state.myPendingRequests.filter((k) => k !== clean && k !== codeOrCellId),
      }));
    } catch (err) {
      throw err;
    }
  },

  respondJoinRequest: async (cellId: string, requestId: string, action: 'approve' | 'reject') => {
    try {
      const res = await spartanApi.respondJoinRequest(cellId, requestId, action);
      if (res?.data) {
        set({ myCell: res.data });
      }
      return res;
    } catch (err) {
      throw err;
    }
  },

  promoteCoLeader: async (targetUserId: string) => {
    try {
      const cell = await spartanApi.promoteCoLeader(targetUserId);
      set({ myCell: cell });
      return cell;
    } catch (err) {
      throw err;
    }
  },

  demoteCoLeader: async (targetUserId: string) => {
    try {
      const cell = await spartanApi.demoteCoLeader(targetUserId);
      set({ myCell: cell });
      return cell;
    } catch (err) {
      throw err;
    }
  },

  kickMember: async (targetUserId: string) => {
    try {
      const cell = await spartanApi.kickMember(targetUserId);
      set({ myCell: cell });
      return cell;
    } catch (err) {
      throw err;
    }
  },

  leaveCell: async () => {
    const seq = ++myCellFetchSeq;
    const priorId = get().myCell?.id;
    try {
      await spartanApi.leaveCell();
      if (priorId) {
        try {
          const { realtimeClient } = require('../services/realtime-client');
          realtimeClient.unsubscribe(`cell:${priorId}`);
        } catch {}
      }
      myCellFetchSeq = Math.max(myCellFetchSeq, seq + 1);
      set({ myCell: null, isLoadingCell: false });
    } catch (err) {
      set({ isLoadingCell: false });
      throw err;
    }
  },

  deleteCell: async () => {
    const seq = ++myCellFetchSeq;
    const priorId = get().myCell?.id;
    try {
      await spartanApi.deleteCell();
      if (priorId) {
        try {
          const { realtimeClient } = require('../services/realtime-client');
          realtimeClient.unsubscribe(`cell:${priorId}`);
        } catch {}
      }
      myCellFetchSeq = Math.max(myCellFetchSeq, seq + 1);
      set({ myCell: null, isLoadingCell: false });
    } catch (err) {
      set({ isLoadingCell: false });
      throw err;
    }
  },

  nudgeMember: async (userId: string, userName: string) => {
    set({ isNudging: true });
    try {
      const res = await spartanApi.nudgeMember(userId, userName);
      set({ isNudging: false });
      return res.message;
    } catch (err) {
      set({ isNudging: false });
      throw err;
    }
  },

  sendStrength: async (userId: string, userName: string, customMessage?: string) => {
    try {
      const res = await spartanApi.sendStrength(userId, userName, customMessage);
      return res.message;
    } catch (err) {
      throw err;
    }
  },

  triggerBattleHorn: async (location: string = 'Global Sanctum') => {
    set({ isLoadingBattle: true });
    try {
      const battle = await spartanApi.triggerBattleHornSOS(location);
      set({ activeBattle: battle, isLoadingBattle: false });
      return battle;
    } catch (err) {
      set({ isLoadingBattle: false });
      throw err;
    }
  },

  joinActiveBattle: async (sessionId: string) => {
    try {
      const battle = await spartanApi.joinBattleSession(sessionId);
      set({ activeBattle: battle });
      return battle;
    } catch (err) {
      throw err;
    }
  },

  sendReactionRune: async (sessionId: string, rune: string) => {
    try {
      const updated = await spartanApi.sendBattleReactionRune(sessionId, rune);
      set({ activeBattle: updated });
    } catch {
      // Silent catch
    }
  },

  sendBattleMessage: async (text: string) => {
    try {
      const sessionId = get().activeBattle?.id;
      const updated = await spartanApi.sendBattleMessage(text, sessionId);
      set({ activeBattle: updated });
      return updated;
    } catch (err) {
      return null;
    }
  },

  battleHeartbeat: async () => {
    try {
      const updated = await spartanApi.battleHeartbeat();
      set({ activeBattle: updated });
      return updated;
    } catch {
      return null;
    }
  },

  startNewBattleSession: async () => {
    try {
      const fresh = await spartanApi.startNewBattleSession();
      set({ activeBattle: fresh });
      return fresh;
    } catch {
      return null;
    }
  },

  completeBattle: async (sessionId: string) => {
    try {
      await spartanApi.completeBattleSession(sessionId);
      set({ activeBattle: null });
    } catch {
      set({ activeBattle: null });
    }
  },
}));
