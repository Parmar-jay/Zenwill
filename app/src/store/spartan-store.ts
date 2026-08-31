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

  fetchMyCell: () => Promise<SpartanCellData | null>;
  fetchActiveBattle: () => Promise<BattleSessionData | null>;
  fetchCellLeaderboard: () => Promise<void>;
  fetchPublicCells: () => Promise<void>;
  createCell: (name: string, motto?: string, isPublic?: boolean) => Promise<SpartanCellData>;
  joinCell: (code: string) => Promise<SpartanCellData>;
  leaveCell: () => Promise<void>;
  nudgeMember: (userId: string, userName: string) => Promise<string>;
  triggerBattleHorn: (location?: string) => Promise<BattleSessionData>;
  joinActiveBattle: (sessionId: string) => Promise<BattleSessionData>;
  sendReactionRune: (sessionId: string, rune: string) => Promise<void>;
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

  fetchMyCell: async () => {
    try {
      set({ isLoadingCell: true });
      const cell = await spartanApi.getMyCell();
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

  completeBattle: async (sessionId: string) => {
    try {
      await spartanApi.completeBattleSession(sessionId);
      set({ activeBattle: null });
    } catch {
      set({ activeBattle: null });
    }
  },
}));
