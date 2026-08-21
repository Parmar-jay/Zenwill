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
  return d.toISOString().split('T')[0];
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

          const updatedHistory = { ...state.history };
          if (lastDate && !updatedHistory[lastDate]) {
            updatedHistory[lastDate] = {
              date: lastDate,
              tasks: lastTasks,
              allCompleted: lastAllCompleted,
              pointsEarned: completedCount * 20,
            };
          }

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
      },


      getWeeklyStats: () => {
        get().checkAndResetMidnight();
        const state = get();
        const todayObj = new Date();
        const stats = [];

        for (let i = 6; i >= 0; i--) {
          const d = new Date(todayObj);
          d.setDate(d.getDate() - i);
          const dateStr = d.toISOString().split('T')[0];
          const dayName = DAY_NAMES[d.getDay()];

          const isToday = dateStr === state.currentDate;
          const rec = isToday
            ? {
                tasks: state.todayTasks,
                allCompleted:
                  state.todayTasks.checkin &&
                  state.todayTasks.meditation &&
                  state.todayTasks.journal &&
                  state.todayTasks.coach &&
                  state.todayTasks.rescue,
                pointsEarned:
                  ((state.todayTasks.checkin ? 1 : 0) +
                    (state.todayTasks.meditation ? 1 : 0) +
                    (state.todayTasks.journal ? 1 : 0) +
                    (state.todayTasks.coach ? 1 : 0) +
                    (state.todayTasks.rescue ? 1 : 0)) * 20,
              }
            : state.history[dateStr];

          let completedCount = 0;
          if (rec?.tasks) {
            if (rec.tasks.checkin) completedCount++;
            if (rec.tasks.meditation) completedCount++;
            if (rec.tasks.journal) completedCount++;
            if (rec.tasks.coach) completedCount++;
            if (rec.tasks.rescue) completedCount++;
          }

          const percent = Math.round((completedCount / 5) * 100);
          const points = rec?.pointsEarned || completedCount * 20;

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
          const today = getTodayStr();
          const state = get();
          const updated = { ...state.todayTasks };
          let changed = false;

          // Fetch todays missions from backend DB to reconcile state
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

          // Check habitStore & authStore for real-time checkin completion status for today
          try {
            const { useHabitStore } = require('./habit-store');
            const { useAuthStore } = require('./auth-store');
            const habitState = useHabitStore.getState();
            const authUser = useAuthStore.getState().user;

            const isCheckinLoggedToday =
              habitState.lastLoggedDate === today ||
              habitState.latestCheckinSummary?.date === today ||
              authUser?.lastCheckinDate === today;

            if (isCheckinLoggedToday && !updated.checkin) {
              updated.checkin = true;
              changed = true;
            }
          } catch (err) {}

          if (changed) {
            set({ todayTasks: updated });
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
