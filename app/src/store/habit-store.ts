import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { profileApi } from '@/services/profile-api';

export interface HabitState {
  streak: number;
  maxStreak: number;
  mindStrength: number;
  lastLoggedDate: string | null; // format: YYYY-MM-DD
  lastLoggedStatus: 'retained' | 'relapsed' | null;
  history: Array<{ date: string; status: 'retained' | 'relapsed'; streakAfter: number; strengthAfter: number }>;
  aiMindsetAnalysis?: string;
  recentJournals?: Array<{ id: string; title: string; content: string; mood_tag: string; created_at: string }>;
  meditationsCount?: number;
  afternoonMeditationDone?: boolean;
  todayCheckinDone?: boolean;
  todayCheckinSummary?: {
    mood: string;
    mood_intensity: number;
    energy_score: number;
    stress_score: number;
    sleep_quality: number;
    focus_score: number;
    date: string;
    is_today?: boolean;
  } | null;
  latestCheckinSummary?: {
    mood: string;
    mood_intensity: number;
    energy_score: number;
    stress_score: number;
    sleep_quality: number;
    focus_score: number;
    date: string;
    is_today?: boolean;
  } | null;
  totalUrgesCount: number;
  todayUrgesCount: number;
  dailyUrgeCounts: Array<{ date: string; dayLabel: string; count: number; isToday?: boolean }>;

  // Actions
  logDay: (retained: boolean) => void;
  resetChallenge: () => void;
  clearState: () => void;
  incrementUrgeCount: () => void;
  syncFromDatabase: () => Promise<void>;
}

const getTodayDateString = () => {
  const date = new Date();
  return date.toISOString().split('T')[0];
};

export const useHabitStore = create<HabitState>()(
  persist(
    (set, get) => ({
      streak: 0,
      maxStreak: 0,
      mindStrength: 0,
      lastLoggedDate: null,
      lastLoggedStatus: null,
      history: [],
      aiMindsetAnalysis: '',
      recentJournals: [],
      meditationsCount: 0,
      afternoonMeditationDone: false,
      todayCheckinDone: false,
      todayCheckinSummary: null,
      latestCheckinSummary: null,
      totalUrgesCount: 0,
      todayUrgesCount: 0,
      dailyUrgeCounts: [],

      incrementUrgeCount: () => {
        const todayStr = getTodayDateString();
        set((state) => {
          const nextTotal = (state.totalUrgesCount || 0) + 1;
          const nextToday = (state.todayUrgesCount || 0) + 1;

          let updatedDaily = [...(state.dailyUrgeCounts || [])];
          if (updatedDaily.length === 0) {
            // Seed 7 days if empty
            const now = new Date();
            for (let i = 6; i >= 0; i--) {
              const d = new Date(now);
              d.setDate(now.getDate() - i);
              const dateStr = d.toISOString().split('T')[0];
              const dayLabel = d.toLocaleDateString('en-US', { weekday: 'narrow' });
              updatedDaily.push({
                date: dateStr,
                dayLabel,
                count: i === 0 ? 1 : 0,
                isToday: i === 0,
              });
            }
          } else {
            updatedDaily = updatedDaily.map((item) => {
              if (item.date === todayStr || item.isToday) {
                return { ...item, count: item.count + 1 };
              }
              return item;
            });
          }

          return {
            totalUrgesCount: nextTotal,
            todayUrgesCount: nextToday,
            dailyUrgeCounts: updatedDaily,
          };
        });
      },

      logDay: (retained: boolean) => {
        const today = getTodayDateString();
        set((state) => {
          // If already logged today with the exact same status, do nothing
          if (state.lastLoggedDate === today && state.lastLoggedStatus === (retained ? 'retained' : 'relapsed')) {
            return {};
          }
          let nextStreak = state.streak;
          let nextStrength = state.mindStrength;
          let nextMaxStreak = Math.max(state.maxStreak || 0, state.streak);

          if (retained) {
            // Only increment streak if not already logged today
            if (state.lastLoggedDate !== today) {
              nextStreak += 1;
              nextStrength = Math.min(nextStrength + 50, 1000);
              nextMaxStreak = Math.max(nextMaxStreak, nextStreak);
            }
          } else {
            // Locking previous streak before resetting to 0
            nextMaxStreak = Math.max(nextMaxStreak, state.streak);
            nextStreak = 0;
            nextStrength = 0; // Reset streak immediately on relapse
          }

          const newHistory = [
            {
              date: today,
              status: retained ? ('retained' as const) : ('relapsed' as const),
              streakAfter: nextStreak,
              strengthAfter: nextStrength,
            },
            ...state.history.filter((h) => h.date !== today),
          ];

          // 1. Immediately update AuthStore & SpartanStore in 0 milliseconds
          try {
            const { useAuthStore } = require('./auth-store');
            const authState = useAuthStore.getState();
            authState.updateUser({
              streak: nextStreak,
              maxStreak: nextMaxStreak,
              mindStrength: nextStrength,
              lastRetainDate: today,
              lastRetainStatus: retained ? 'retained' : 'relapsed',
            });
            const userIdentifier = authState.user?.id || authState.user?.email || authState.user?.name || '';
            if (userIdentifier) {
              const { useSpartanStore } = require('./spartan-store');
              useSpartanStore.getState().updateLocalMemberStreak(userIdentifier, nextStreak);
            }
          } catch (e) {}

          // 2. Invalidate API caches immediately
          try {
            const { api } = require('../services/api');
            api.invalidateCache('/spartan-cells');
            api.invalidateCache('/profile');
            api.invalidateCache('/community');
          } catch (e) {}

          // 3. Persist to backend database asynchronously in background
          profileApi
            .updateMe({
              streak: nextStreak,
              max_streak: nextMaxStreak,
              mind_strength: nextStrength,
              last_retain_date: today,
              last_retain_status: retained ? 'retained' : 'relapsed',
            })
            .then(() => {
              try {
                const { useSpartanStore } = require('./spartan-store');
                useSpartanStore.getState().fetchMyCell().catch(() => {});
                useSpartanStore.getState().fetchCellLeaderboard().catch(() => {});
              } catch (e) {}
            })
            .catch(() => {});

          return {
            streak: nextStreak,
            maxStreak: nextMaxStreak,
            mindStrength: nextStrength,
            lastLoggedDate: today,
            lastLoggedStatus: retained ? 'retained' : 'relapsed',
            history: newHistory,
          };
        });
      },

      resetChallenge: () => {
        const today = getTodayDateString();
        const currentMax = get().maxStreak || get().streak || 0;

        // 1. Immediately update AuthStore & SpartanStore in 0 milliseconds
        try {
          const { useAuthStore } = require('./auth-store');
          const authState = useAuthStore.getState();
          authState.updateUser({
            streak: 0,
            maxStreak: currentMax,
            mindStrength: 0,
            lastRetainDate: today,
            lastRetainStatus: 'relapsed',
          });
          const userIdentifier = authState.user?.id || authState.user?.email || authState.user?.name || '';
          if (userIdentifier) {
            const { useSpartanStore } = require('./spartan-store');
            useSpartanStore.getState().updateLocalMemberStreak(userIdentifier, 0);
          }
        } catch (e) {}

        // 2. Invalidate API caches
        try {
          const { api } = require('../services/api');
          api.invalidateCache('/spartan-cells');
          api.invalidateCache('/profile');
          api.invalidateCache('/community');
        } catch (e) {}

        // 3. Persist to backend database asynchronously
        profileApi
          .updateMe({
            streak: 0,
            max_streak: currentMax,
            mind_strength: 0,
            last_retain_date: today,
            last_retain_status: 'relapsed',
          })
          .then(() => {
            try {
              const { useSpartanStore } = require('./spartan-store');
              useSpartanStore.getState().fetchMyCell().catch(() => {});
              useSpartanStore.getState().fetchCellLeaderboard().catch(() => {});
            } catch (e) {}
          })
          .catch(() => {});

        set({
          streak: 0,
          maxStreak: currentMax,
          mindStrength: 0,
          lastLoggedDate: today,
          lastLoggedStatus: 'relapsed',
          history: [],
        });
      },

      clearState: () => {
        // Clears state locally without sending an API update (used for logout)
        set({
          streak: 0,
          maxStreak: 0,
          mindStrength: 0,
          lastLoggedDate: null,
          lastLoggedStatus: null,
          history: [],
          aiMindsetAnalysis: '',
          recentJournals: [],
          meditationsCount: 0,
          afternoonMeditationDone: false,
          todayCheckinDone: false,
          todayCheckinSummary: null,
          latestCheckinSummary: null,
          totalUrgesCount: 0,
          todayUrgesCount: 0,
          dailyUrgeCounts: [],
        });
      },


      syncFromDatabase: async () => {
        try {
          const today = getTodayDateString();
          const profile = await profileApi.getMe();
          if (profile) {
            const lastRetainDate = profile.last_retain_date || null;
            const lastRetainStatus = profile.last_retain_status || null;
            const liveStreak = typeof profile.streak === 'number' ? profile.streak : 0;
            const dbMaxStreak = typeof profile.max_streak === 'number' ? profile.max_streak : 0;
            const liveStrength = typeof profile.ai_mindset_score === 'number' ? profile.ai_mindset_score : (typeof profile.mind_strength === 'number' ? profile.mind_strength : 50);

            set((state) => {
              let dateToKeep: string | null = null;
              let statusToKeep: 'retained' | 'relapsed' | null = null;

              if (lastRetainDate === today && lastRetainStatus) {
                dateToKeep = today;
                statusToKeep = lastRetainStatus as 'retained' | 'relapsed';
              } else if (state.lastLoggedDate === today && state.lastLoggedStatus) {
                dateToKeep = today;
                statusToKeep = state.lastLoggedStatus;
              }

              const resolvedStreak = (dateToKeep === today && statusToKeep === 'retained')
                ? Math.max(liveStreak, state.streak)
                : (statusToKeep === 'relapsed' ? 0 : liveStreak);

              const resolvedMaxStreak = Math.max(dbMaxStreak, state.maxStreak || 0, liveStreak, resolvedStreak);

              const isToday = profile.today_checkin_done === true 
                || (profile.today_checkin_summary && profile.today_checkin_summary.date === today)
                || (profile.latest_checkin_summary && profile.latest_checkin_summary.date === today && profile.latest_checkin_summary.is_today === true);

              const activeTodaySummary = isToday
                ? (profile.today_checkin_summary || (profile.latest_checkin_summary?.date === today ? profile.latest_checkin_summary : null))
                : null;

              return {
                streak: resolvedStreak,
                maxStreak: resolvedMaxStreak,
                mindStrength: liveStrength,
                lastLoggedDate: dateToKeep,
                lastLoggedStatus: statusToKeep,
                aiMindsetAnalysis: profile.ai_mindset_analysis || '',
                recentJournals: profile.recent_journals || [],
                meditationsCount: profile.meditations_count || 0,
                afternoonMeditationDone: profile.afternoon_meditation_done || false,
                todayCheckinDone: Boolean(isToday),
                todayCheckinSummary: activeTodaySummary,
                latestCheckinSummary: profile.latest_checkin_summary || null,
                totalUrgesCount: typeof profile.total_urges_count === 'number' ? profile.total_urges_count : state.totalUrgesCount,
                todayUrgesCount: typeof profile.today_urges_count === 'number' ? profile.today_urges_count : state.todayUrgesCount,
                dailyUrgeCounts: profile.daily_urge_counts && profile.daily_urge_counts.length > 0 ? profile.daily_urge_counts : state.dailyUrgeCounts,
              };
            });

            // Sync authStore user streak & points only (strictly isolated from daily checkin missions)
            try {
              const { useAuthStore } = require('./auth-store');
              const authState = useAuthStore.getState();
              if (authState.user) {
                authState.updateUser({
                  name: profile.name || authState.user.name,
                  streak: liveStreak,
                  totalPoints: profile.total_points ?? authState.user.totalPoints,
                });
                const userIdentifier = authState.user.id || authState.user.email || authState.user.name || '';
                if (userIdentifier) {
                  const { useSpartanStore } = require('./spartan-store');
                  useSpartanStore.getState().updateLocalMemberStreak(userIdentifier, liveStreak);
                }
              }
            } catch (e) {}
          }
        } catch (error) {
          // Silent catch on offline
        }
      },
    }),
    {
      name: 'zenwill-habit-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
