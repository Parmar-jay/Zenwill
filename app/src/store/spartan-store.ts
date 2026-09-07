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
  hasLoadedInitialCell: boolean;
  isLoadingBattle: boolean;
  isNudging: boolean;

  updateLocalMemberStreak: (userIdOrEmail: string, newStreak: number) => void;
  fetchMyCell: (options?: { showLoading?: boolean }) => Promise<SpartanCellData | null>;
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
  hasLoadedInitialCell: false,
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
      hasLoadedInitialCell: false,
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

  fetchMyCell: async (options?: { showLoading?: boolean }) => {
    const seq = ++myCellFetchSeq;
    try {
      const { TokenStorage } = require('../services/api');
      const token = await TokenStorage.getAccessToken();
      if (!token) {
        if (seq === myCellFetchSeq) {
          set({ isLoadingCell: false, hasLoadedInitialCell: true });
        }
        return null;
      }

      // ONLY set isLoadingCell: true if explicitly requested AND initial load hasn't completed yet
      if (options?.showLoading && !get().hasLoadedInitialCell) {
        set({ isLoadingCell: true });
      }
      const cell = await spartanApi.getMyCell();
      // If a newer join/leave/create took place while this fetch was in flight, discard this result!
      if (seq !== myCellFetchSeq) {
        return get().myCell;
      }

      if (!cell) {
        set({ myCell: null, isLoadingCell: false, hasLoadedInitialCell: true });
        return null;
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
      set({ myCell: cell, isLoadingCell: false, hasLoadedInitialCell: true });

      return cell;
    } catch {
      if (seq === myCellFetchSeq) {
        set({ isLoadingCell: false, hasLoadedInitialCell: true });
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
      const data = await spartanApi.getCellLeaderboard();
      set({ cellLeaderboard: Array.isArray(data) ? data : [] });
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
      const keys = (list || []).flatMap((r) => {
        const rawCode = (r.join_code || '').trim();
        const cleanCode = rawCode.toUpperCase();
        const pureCode = cleanCode.replace('SP-', '').replace('SP ', '').replace('SP', '').trim();
        const cellId = (r.cell_id || '').trim();
        return [
          cellId,
          cellId.toLowerCase(),
          rawCode,
          cleanCode,
          cleanCode.toLowerCase(),
          pureCode,
          pureCode.toLowerCase(),
          `SP-${pureCode}`,
          `sp-${pureCode.toLowerCase()}`,
        ].filter(Boolean);
      });
      set({ myPendingRequests: Array.from(new Set(keys as string[])) });
    } catch {
      // keep existing
    }
  },

  createCell: async (name: string, motto: string = 'We hold the line together.', isPublic: boolean = true) => {
    const seq = ++myCellFetchSeq;
    try {
      const cell = await spartanApi.createCell(name, motto, isPublic);
      myCellFetchSeq = Math.max(myCellFetchSeq, seq + 1);
      set({ myCell: cell, isLoadingCell: false, myPendingRequests: [] });
      get().fetchPublicCells().catch(() => { });
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
      myCellFetchSeq = Math.max(myCellFetchSeq, seq + 1);
      set({ myCell: cell, isLoadingCell: false, myPendingRequests: [] });
      get().fetchPublicCells().catch(() => { });
      return cell;
    } catch (err) {
      set({ isLoadingCell: false });
      throw err;
    }
  },

  requestJoinCell: async (code: string) => {
    const raw = (code || '').trim();
    const clean = raw.toUpperCase();
    const pure = clean.replace('SP-', '').replace('SP ', '').replace('SP', '').trim();
    const fullSp = `SP-${pure}`;

    const { useAuthStore } = require('./auth-store');
    const authUser = useAuthStore.getState().user;
    const authUid = String(authUser?.id || '').trim();
    const authEmail = (authUser?.email || '').trim().toLowerCase();
    const authName = authUser?.name || 'Warrior';
    const authStreak = authUser?.streak || 0;
    const authXp = authUser?.total_points || 100;

    // 1. Instantly mark as pending in local state before the network call finishes
    set((state) => {
      const nextPending = Array.from(new Set([
        ...state.myPendingRequests,
        raw,
        clean,
        clean.toLowerCase(),
        pure,
        pure.toLowerCase(),
        fullSp,
        fullSp.toLowerCase(),
      ].filter(Boolean)));

      const nextPublic = state.publicCells.map((c) => {
        const cCode = (c.join_code || '').trim().toUpperCase();
        const cPure = cCode.replace('SP-', '').replace('SP ', '').replace('SP', '').trim();
        const matches = (
          cCode === clean ||
          cPure === pure ||
          c.id === raw ||
          c.id === clean
        );
        if (matches) {
          const reqs = c.join_requests || [];
          const alreadyInReqs = reqs.some(
            (r: any) =>
              (authUid && String(r.user_id || '').trim().toLowerCase() === authUid.toLowerCase()) ||
              (authEmail && String(r.user_email || r.email || '').trim().toLowerCase() === authEmail)
          );
          if (!alreadyInReqs) {
            return {
              ...c,
              join_requests: [
                ...reqs,
                {
                  id: `temp-${Date.now()}`,
                  user_id: authUid,
                  user_name: authName,
                  user_email: authEmail,
                  streak: authStreak,
                  xp: authXp,
                  badge: '🛡️',
                  rank_tier: 'Warrior',
                  created_at: new Date().toISOString(),
                },
              ],
            };
          }
        }
        return c;
      });

      return {
        myPendingRequests: nextPending,
        publicCells: nextPublic,
      };
    });

    try {
      const res = await spartanApi.requestJoinCell(code);
      const resClean = (res.join_code || '').trim().toUpperCase();
      const resPure = resClean.replace('SP-', '').replace('SP ', '').replace('SP', '').trim();
      const resCellId = (res.cell_id || '').trim();

      set((state) => ({
        myPendingRequests: Array.from(new Set([
          ...state.myPendingRequests,
          clean,
          pure,
          fullSp,
          resClean,
          resClean.toLowerCase(),
          resPure,
          resPure.toLowerCase(),
          `SP-${resPure}`,
          `sp-${resPure.toLowerCase()}`,
          resCellId,
          resCellId.toLowerCase(),
        ].filter(Boolean))),
      }));

      // Background quiet sync without flickering UI
      get().fetchPublicCells().catch(() => { });
      get().fetchMyJoinRequests().catch(() => { });

      return res;
    } catch (err) {
      // Revert if failed
      get().fetchMyJoinRequests().catch(() => { });
      get().fetchPublicCells().catch(() => { });
      throw err;
    }
  },

  cancelJoinRequest: async (codeOrCellId: string) => {
    const raw = (codeOrCellId || '').trim();
    const clean = raw.toUpperCase();
    const pure = clean.replace('SP-', '').replace('SP ', '').replace('SP', '').trim();
    const fullSp = `SP-${pure}`;

    const { useAuthStore } = require('./auth-store');
    const authUser = useAuthStore.getState().user;
    const authUid = String(authUser?.id || '').trim().toLowerCase();
    const authEmail = (authUser?.email || '').trim().toLowerCase();

    // 1. Instantly remove from local pending set AND publicCells in memory
    set((state) => {
      const nextPending = state.myPendingRequests.filter(
        (k) =>
          k !== raw &&
          k !== clean &&
          k !== clean.toLowerCase() &&
          k !== pure &&
          k !== pure.toLowerCase() &&
          k !== fullSp &&
          k !== fullSp.toLowerCase() &&
          k !== codeOrCellId &&
          k !== String(codeOrCellId).toLowerCase()
      );

      const nextPublic = state.publicCells.map((c) => {
        const cCode = (c.join_code || '').trim().toUpperCase();
        const cPure = cCode.replace('SP-', '').replace('SP ', '').replace('SP', '').trim();
        const matches = (
          cCode === clean ||
          cPure === pure ||
          c.id === raw ||
          c.id === clean ||
          c.id === codeOrCellId
        );
        if (matches) {
          return {
            ...c,
            join_requests: (c.join_requests || []).filter(
              (r: any) =>
                (authUid && String(r.user_id || '').trim().toLowerCase() !== authUid) &&
                (authEmail && String(r.user_email || r.email || '').trim().toLowerCase() !== authEmail)
            ),
          };
        }
        return c;
      });

      return {
        myPendingRequests: nextPending,
        publicCells: nextPublic,
      };
    });

    try {
      await spartanApi.cancelJoinRequest(codeOrCellId);
      get().fetchPublicCells().catch(() => { });
      get().fetchMyJoinRequests().catch(() => { });
    } catch (err) {
      get().fetchMyJoinRequests().catch(() => { });
      get().fetchPublicCells().catch(() => { });
      throw err;
    }
  },

  respondJoinRequest: async (cellId: string, requestId: string, action: 'approve' | 'reject') => {
    // 1. Optimistically remove the petition and update members immediately
    const currentCell = get().myCell;
    let targetApplicant: any = null;
    if (currentCell && Array.isArray(currentCell.join_requests)) {
      targetApplicant = currentCell.join_requests.find(
        (r) => r.id === requestId || r.user_id === requestId
      );

      let updatedMembers = currentCell.members || [];
      let updatedTotalStreak = currentCell.total_streak || 0;
      let updatedMemberCount = currentCell.member_count || updatedMembers.length;

      if (action === 'approve' && targetApplicant) {
        const newMember = {
          user_id: targetApplicant.user_id,
          name: targetApplicant.user_name || 'Warrior',
          streak: targetApplicant.streak || 0,
          xp: targetApplicant.xp || 100,
          badge: targetApplicant.badge || '🥉',
          rank_tier: targetApplicant.rank_tier || 'Bronze I',
          status: 'retained',
          last_retain_status: 'retained',
          today_checked_in: true,
          is_leader: false,
          is_co_leader: false,
        };
        const seen = new Set(updatedMembers.map((m) => m.user_id));
        if (!seen.has(newMember.user_id)) {
          updatedMembers = [...updatedMembers, newMember as any];
          updatedMemberCount = updatedMembers.length;
          updatedTotalStreak += (targetApplicant.streak || 0);
        }
      }

      set({
        myCell: {
          ...currentCell,
          members: updatedMembers,
          member_count: updatedMemberCount,
          total_streak: updatedTotalStreak,
          join_requests: currentCell.join_requests.filter(
            (r) => r.id !== requestId && r.user_id !== requestId
          ),
        },
      });
    }

    try {
      const res = await spartanApi.respondJoinRequest(cellId, requestId, action);
      if (res?.data) {
        set({ myCell: res.data });
      }
      get().fetchPublicCells().catch(() => { });
      return res;
    } catch (err) {
      get().fetchMyCell({ showLoading: false }).catch(() => { });
      throw err;
    }
  },

  promoteCoLeader: async (targetUserId: string) => {
    const current = get().myCell;
    if (current) {
      const coLeaders = new Set(current.co_leader_ids || []);
      coLeaders.add(targetUserId);
      const updatedMembers = (current.members || []).map((m) =>
        m.user_id === targetUserId ? { ...m, is_co_leader: true } : m
      );
      set({
        myCell: {
          ...current,
          co_leader_ids: Array.from(coLeaders),
          members: updatedMembers,
        },
      });
    }
    try {
      const cell = await spartanApi.promoteCoLeader(targetUserId);
      if (cell) set({ myCell: cell });
      return cell;
    } catch (err) {
      get().fetchMyCell({ showLoading: false }).catch(() => { });
      throw err;
    }
  },

  demoteCoLeader: async (targetUserId: string) => {
    const current = get().myCell;
    if (current) {
      const coLeaders = (current.co_leader_ids || []).filter((id) => id !== targetUserId);
      const updatedMembers = (current.members || []).map((m) =>
        m.user_id === targetUserId ? { ...m, is_co_leader: false } : m
      );
      set({
        myCell: {
          ...current,
          co_leader_ids: coLeaders,
          members: updatedMembers,
        },
      });
    }
    try {
      const cell = await spartanApi.demoteCoLeader(targetUserId);
      if (cell) set({ myCell: cell });
      return cell;
    } catch (err) {
      get().fetchMyCell({ showLoading: false }).catch(() => { });
      throw err;
    }
  },

  kickMember: async (targetUserId: string) => {
    const current = get().myCell;
    if (current) {
      const kicked = (current.members || []).find((m) => m.user_id === targetUserId);
      const kickedStreak = kicked?.streak || 0;
      const updatedMembers = (current.members || []).filter((m) => m.user_id !== targetUserId);
      set({
        myCell: {
          ...current,
          members: updatedMembers,
          member_count: updatedMembers.length,
          total_streak: Math.max(0, (current.total_streak || 0) - kickedStreak),
        },
      });
    }
    try {
      const cell = await spartanApi.kickMember(targetUserId);
      if (cell) set({ myCell: cell });
      return cell;
    } catch (err) {
      get().fetchMyCell({ showLoading: false }).catch(() => { });
      throw err;
    }
  },

  leaveCell: async () => {
    const seq = ++myCellFetchSeq;
    set({ myCell: null, isLoadingCell: false });
    try {
      await spartanApi.leaveCell();
      myCellFetchSeq = Math.max(myCellFetchSeq, seq + 1);
      set({ myCell: null, isLoadingCell: false });
    } catch (err) {
      myCellFetchSeq = Math.max(myCellFetchSeq, seq + 1);
      set({ myCell: null, isLoadingCell: false });
      throw err;
    }
  },

  deleteCell: async () => {
    const seq = ++myCellFetchSeq;
    set({ myCell: null, isLoadingCell: false });
    try {
      await spartanApi.deleteCell();
      myCellFetchSeq = Math.max(myCellFetchSeq, seq + 1);
      set({ myCell: null, isLoadingCell: false });
    } catch (err) {
      myCellFetchSeq = Math.max(myCellFetchSeq, seq + 1);
      set({ myCell: null, isLoadingCell: false });
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
