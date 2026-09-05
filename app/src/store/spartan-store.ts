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
  isLoadingCell: boolean;
  isLoadingBattle: boolean;
  isNudging: boolean;

  updateLocalMemberStreak: (userIdOrEmail: string, newStreak: number) => void;
  fetchMyCell: () => Promise<SpartanCellData | null>;
  fetchActiveBattle: () => Promise<BattleSessionData | null>;
  fetchCellLeaderboard: () => Promise<void>;
  fetchPublicCells: () => Promise<void>;
  createCell: (name: string, motto?: string, isPublic?: boolean) => Promise<SpartanCellData>;
  joinCell: (code: string) => Promise<SpartanCellData>;
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
}

export const useSpartanStore = create<SpartanState>((set, get) => ({
  myCell: null,
  activeBattle: null,
  cellLeaderboard: [],
  publicCells: [],
  isLoadingCell: false,
  isLoadingBattle: false,
  isNudging: false,

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
    try {
      if (!get().myCell) {
        set({ isLoadingCell: true });
      }
      const cell = await spartanApi.getMyCell();
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
      return cell;
    } catch {
      set({ isLoadingCell: false });
      return null;
    }
  },

  fetchActiveBattle: async () => {
    try {
      const battle = await spartanApi.getActiveBattleSession();
      set({ activeBattle: battle });
      return battle;
    } catch {
      return null;
    }
  },

  fetchCellLeaderboard: async () => {
    try {
      const list = await spartanApi.getCellLeaderboard(50);
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

  createCell: async (name: string, motto: string = 'We hold the line together.', isPublic: boolean = true) => {
    set({ isLoadingCell: true });
    try {
      const cell = await spartanApi.createCell(name, motto, isPublic);
      set({ myCell: cell, isLoadingCell: false });
      return cell;
    } catch (err) {
      set({ isLoadingCell: false });
      throw err;
    }
  },

  joinCell: async (code: string) => {
    set({ isLoadingCell: true });
    try {
      const cell = await spartanApi.joinCell(code);
      set({ myCell: cell, isLoadingCell: false });
      return cell;
    } catch (err) {
      set({ isLoadingCell: false });
      throw err;
    }
  },

  leaveCell: async () => {
    set({ isLoadingCell: true });
    try {
      await spartanApi.leaveCell();
      set({ myCell: null, isLoadingCell: false });
    } catch (err) {
      set({ isLoadingCell: false });
      throw err;
    }
  },

  deleteCell: async () => {
    set({ isLoadingCell: true });
    try {
      await spartanApi.deleteCell();
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
