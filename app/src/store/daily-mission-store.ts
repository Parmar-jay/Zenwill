import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { missionsApi } from '@/services/missions-api';

export interface DailyTasks {
  checkin: boolean;
  meditation: boolean;
  journal: boolean;
  coach: boolean;
  rescue: boolean;
}

export interface DayRecord {
  date: string; // YYYY-MM-DD
  tasks: DailyTasks;
  allCompleted: boolean;
  pointsEarned: number;
}

export interface DailyMissionState {
  currentDate: string; // YYYY-MM-DD
  todayTasks: DailyTasks;
  totalPoints: number; // Non-reversible total streak points
  history: Record<string, DayRecord>; // Key: YYYY-MM-DD

  // Actions
  completeTask: (taskKey: keyof DailyTasks) => void;
  checkAndResetMidnight: () => void;
  getWeeklyStats: () => Array<{ dayName: string; dateStr: string; percent: number; points: number }>;
  syncWithBackend: () => Promise<void>;
  resetMissions: () => void;
}

const getTodayStr = (): string => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const useDailyMissionStore = create<DailyMissionState>()(
  persist(
    (set, get) => ({
      currentDate: getTodayStr(),
      todayTasks: {
        checkin: false,
        meditation: false,
        journal: false,
        coach: false,
        rescue: false,
      },
      totalPoints: 0,
      history: {},

      checkAndResetMidnight: () => {
        const today = getTodayStr();
        const state = get();
        if (state.currentDate !== today) {
          const lastDate = state.currentDate;
          const lastTasks = state.todayTasks;
          const completedCount =
            (lastTasks.checkin ? 1 : 0) +
            (lastTasks.meditation ? 1 : 0) +
            (lastTasks.journal ? 1 : 0) +
            (lastTasks.coach ? 1 : 0) +
            (lastTasks.rescue ? 1 : 0);

          const lastAllCompleted = completedCount === 5;

          const updatedHistory = {
            ...state.history,
            [lastDate]: {
              date: lastDate,
              tasks: { ...lastTasks },
              allCompleted: lastAllCompleted,
              pointsEarned: completedCount * 20,
            },
          };

          set({
            currentDate: today,
            todayTasks: {
              checkin: false,
              meditation: false,
              journal: false,
              coach: false,
              rescue: false,
            },
            history: updatedHistory,
          });
        }
      },

      completeTask: (taskKey: keyof DailyTasks) => {
        get().checkAndResetMidnight();
        const today = getTodayStr();

        set((state) => {
          const alreadyDone = state.todayTasks[taskKey];
          const updatedTasks = {
            ...state.todayTasks,
            [taskKey]: true,
          };

          const completedCount =
            (updatedTasks.checkin ? 1 : 0) +
            (updatedTasks.meditation ? 1 : 0) +
            (updatedTasks.journal ? 1 : 0) +
            (updatedTasks.coach ? 1 : 0) +
            (updatedTasks.rescue ? 1 : 0);

          const isNowAllCompleted = completedCount === 5;
          const addedPoints = alreadyDone ? 0 : 20;

          const nextTotalPoints = state.totalPoints + addedPoints;

          const dayRecord: DayRecord = {
            date: today,
            tasks: updatedTasks,
            allCompleted: isNowAllCompleted,
            pointsEarned: (state.history[today]?.pointsEarned || 0) + addedPoints,
          };

          return {
            currentDate: today,
            todayTasks: updatedTasks,
            totalPoints: nextTotalPoints,
            history: {
              ...state.history,
              [today]: dayRecord,
            },
          };
        });

        // Persist to backend database atomically
        missionsApi.completeCategory(taskKey).catch(() => {
          // Fallback to sync
          missionsApi.syncMissions({ ...get().todayTasks }).catch(() => {});
        });

        // Additional sync for checkin
        if (taskKey === 'checkin') {
          try {
            const { useAuthStore } = require('./auth-store');
            const authUser = useAuthStore.getState().user;
            if (authUser) {
              useAuthStore.setState({
                user: {
                  ...authUser,
                  lastCheckinDate: today,
                },
              });
            }
          } catch (e) {}
        }
      },

      getWeeklyStats: () => {
        get().checkAndResetMidnight();
        const state = get();
        const today = new Date();
        const stats = [];

        for (let i = 6; i >= 0; i--) {
          const d = new Date();
          d.setDate(today.getDate() - i);
          const year = d.getFullYear();
          const month = String(d.getMonth() + 1).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          const dateStr = `${year}-${month}-${day}`;
          const dayName = DAY_NAMES[d.getDay()];

          const isToday = i === 0;
          let completed = 0;

          if (isToday) {
            if (state.todayTasks.checkin) completed++;
            if (state.todayTasks.meditation) completed++;
            if (state.todayTasks.journal) completed++;
            if (state.todayTasks.coach) completed++;
            if (state.todayTasks.rescue) completed++;
          } else {
            const hist = state.history[dateStr];
            if (hist && hist.tasks) {
              if (hist.tasks.checkin) completed++;
              if (hist.tasks.meditation) completed++;
              if (hist.tasks.journal) completed++;
              if (hist.tasks.coach) completed++;
              if (hist.tasks.rescue) completed++;
            }
          }

          const percent = Math.round((completed / 5) * 100);
          const points = completed * 20;

          stats.push({
            dayName,
            dateStr,
            percent,
            points,
          });
        }

        return stats;
      },

      syncWithBackend: async () => {
        try {
          get().checkAndResetMidnight();
          const today = getTodayStr();
          const state = get();
          const updated = { ...state.todayTasks };
          let changed = false;

          // 1. Direct authoritative status from backend database (cross-verifying all collections)
          const statusRes = await missionsApi.getTodayTasksStatus().catch(() => null);
          if (statusRes && statusRes.tasks) {
            if (statusRes.tasks.checkin !== undefined && statusRes.tasks.checkin !== updated.checkin) {
              updated.checkin = Boolean(statusRes.tasks.checkin);
              changed = true;
            }
            if (statusRes.tasks.meditation !== undefined && statusRes.tasks.meditation !== updated.meditation) {
              updated.meditation = Boolean(statusRes.tasks.meditation);
              changed = true;
            }
            if (statusRes.tasks.journal !== undefined && statusRes.tasks.journal !== updated.journal) {
              updated.journal = Boolean(statusRes.tasks.journal);
              changed = true;
            }
            if (statusRes.tasks.coach !== undefined && statusRes.tasks.coach !== updated.coach) {
              updated.coach = Boolean(statusRes.tasks.coach);
              changed = true;
            }
            if (statusRes.tasks.rescue !== undefined && statusRes.tasks.rescue !== updated.rescue) {
              updated.rescue = Boolean(statusRes.tasks.rescue);
              changed = true;
            }
          }

          // 2. Fetch todays missions from backend DB to reconcile category states
          const backendMissions = await missionsApi.getTodaysMissions().catch(() => null);
          if (backendMissions && Array.isArray(backendMissions)) {
            const checkinCats = ['checkin', 'morning'];
            const calmCats = ['calm', 'meditation', 'sleep'];
            const focusCats = ['focus', 'journal', 'reflection'];
            const purposeCats = ['purpose', 'coach', 'connection'];
            const rescueCats = ['exercise', 'rescue', 'emergency'];

            backendMissions.forEach((bm) => {
              if (bm.is_completed) {
                const c = (bm.category || '').toLowerCase();
                if (checkinCats.includes(c) && !updated.checkin) { updated.checkin = true; changed = true; }
                if (calmCats.includes(c) && !updated.meditation) { updated.meditation = true; changed = true; }
                if (focusCats.includes(c) && !updated.journal) { updated.journal = true; changed = true; }
                if (purposeCats.includes(c) && !updated.coach) { updated.coach = true; changed = true; }
                if (rescueCats.includes(c) && !updated.rescue) { updated.rescue = true; changed = true; }
              }
            });
          }

          // 3. Check authStore for verified daily checkin submission for today
          try {
            const { useAuthStore } = require('./auth-store');
            const authUser = useAuthStore.getState().user;
            const isCheckinSubmittedToday = authUser?.lastCheckinDate === today;
            if (isCheckinSubmittedToday && !updated.checkin) {
              updated.checkin = true;
              changed = true;
            }
          } catch (err) {}

          if (changed) {
            set({ todayTasks: updated });
          }

          // 4. Fetch verified user history from database and merge into local history state
          const historyResponse = await missionsApi.getMissionsHistory(14).catch(() => null);
          if (historyResponse && Array.isArray(historyResponse.days)) {
            const mergedHistory = { ...get().history };
            historyResponse.days.forEach((d) => {
              if (d.date) {
                const isToday = d.date === today;
                if (isToday && d.tasks) {
                  let todayChanged = false;
                  if (d.tasks.checkin && !updated.checkin) { updated.checkin = true; todayChanged = true; }
                  if (d.tasks.meditation && !updated.meditation) { updated.meditation = true; todayChanged = true; }
                  if (d.tasks.journal && !updated.journal) { updated.journal = true; todayChanged = true; }
                  if (d.tasks.coach && !updated.coach) { updated.coach = true; todayChanged = true; }
                  if (d.tasks.rescue && !updated.rescue) { updated.rescue = true; todayChanged = true; }
                  if (todayChanged) {
                    set({ todayTasks: updated });
                  }
                }

                const tasksObj = isToday
                  ? updated
                  : {
                      checkin: Boolean(d.tasks?.checkin),
                      meditation: Boolean(d.tasks?.meditation),
                      journal: Boolean(d.tasks?.journal),
                      coach: Boolean(d.tasks?.coach),
                      rescue: Boolean(d.tasks?.rescue),
                    };

                const completedCount =
                  (tasksObj.checkin ? 1 : 0) +
                  (tasksObj.meditation ? 1 : 0) +
                  (tasksObj.journal ? 1 : 0) +
                  (tasksObj.coach ? 1 : 0) +
                  (tasksObj.rescue ? 1 : 0);

                mergedHistory[d.date] = {
                  date: d.date,
                  tasks: tasksObj,
                  allCompleted: completedCount === 5,
                  pointsEarned: completedCount * 20,
                };
              }
            });
            set({ history: mergedHistory });
          }

          // 5. Also push any locally completed tasks to backend DB to ensure complete persistence
          const hasAnyCompleted = Object.values(updated).some(Boolean);
          if (hasAnyCompleted) {
            missionsApi.syncMissions(updated).catch(() => {});
          }
        } catch (e) {
          // Silent fallback to local storage state if offline
        }
      },

      resetMissions: () => {
        set({
          currentDate: getTodayStr(),
          todayTasks: {
            checkin: false,
            meditation: false,
            journal: false,
            coach: false,
            rescue: false,
          },
          totalPoints: 0,
          history: {},
        });
      },

    }),
    {
      name: 'zenwill-daily-missions-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
