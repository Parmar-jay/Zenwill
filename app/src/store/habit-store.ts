import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { profileApi } from '@/services/profile-api';

export interface HabitState {
  streak: number;
  mindStrength: number;
  lastLoggedDate: string | null; // format: YYYY-MM-DD
  lastLoggedStatus: 'retained' | 'relapsed' | null;
  history: Array<{ date: string; status: 'retained' | 'relapsed'; streakAfter: number; strengthAfter: number }>;
  aiMindsetAnalysis?: string;
  recentJournals?: Array<{ id: string; title: string; content: string; mood_tag: string; created_at: string }>;
  meditationsCount?: number;
  afternoonMeditationDone?: boolean;
  latestCheckinSummary?: {
    mood: string;
    mood_intensity: number;
    energy_score: number;
    stress_score: number;
    sleep_quality: number;
    focus_score: number;
    date: string;
  };
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
      mindStrength: 0,
      lastLoggedDate: null,
      lastLoggedStatus: null,
      history: [],
      aiMindsetAnalysis: '',
      recentJournals: [],
      meditationsCount: 0,
      afternoonMeditationDone: false,
      latestCheckinSummary: undefined,
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
          if (state.lastLoggedDate === today) {
            return {};
          }
          let nextStreak = state.streak;
          let nextStrength = state.mindStrength;

          if (retained) {
            nextStreak += 1;
            nextStrength = Math.min(nextStrength + 50, 1000);
          } else {
            nextStreak = 0;
            nextStrength = 0; // Start from scratch on relapse
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

          // Persist Retain/Relapse to backend database asynchronously
          profileApi
            .updateMe({
              streak: nextStreak,
              mind_strength: nextStrength,
              last_retain_date: today,
              last_retain_status: retained ? 'retained' : 'relapsed',
            })
            .catch(() => {});

          return {
            streak: nextStreak,
            mindStrength: nextStrength,
            lastLoggedDate: today,
            lastLoggedStatus: retained ? 'retained' : 'relapsed',
            history: newHistory,
          };
        });
      },

      resetChallenge: () => {
        profileApi.updateMe({ streak: 0, mind_strength: 0, last_retain_date: null, last_retain_status: null }).catch(() => {});
        set({
          streak: 0,
          mindStrength: 0,
          lastLoggedDate: null,
          lastLoggedStatus: null,
          history: [],
        });
      },

      clearState: () => {
        // Clears state locally without sending an API update (used for logout)
        set({
          streak: 0,
          mindStrength: 0,
          lastLoggedDate: null,
          lastLoggedStatus: null,
          history: [],
          recentJournals: [],
          meditationsCount: 0,
          totalUrgesCount: 0,
          todayUrgesCount: 0,
          dailyUrgeCounts: [],
        });
      },


      syncFromDatabase: async () => {
        try {
          const profile = await profileApi.getMe();
          if (profile) {
            const today = getTodayDateString();
            const lastRetainDate = profile.last_retain_date || null;
            const lastRetainStatus = profile.last_retain_status || null;
            const lastCheckin = profile.last_checkin_date || null;
            const liveStreak = typeof profile.streak === 'number' ? profile.streak : 0;
            const liveStrength = typeof profile.ai_mindset_score === 'number' ? profile.ai_mindset_score : (typeof profile.mind_strength === 'number' ? profile.mind_strength : 50);

            set((state) => {
              const todayHistory = state.history.find((h) => h.date === today);
              const currentStatus = state.lastLoggedDate === today ? state.lastLoggedStatus : null;

              let statusToKeep: 'retained' | 'relapsed' | null = null;
              let dateToKeep: string | null = null;

              if (state.lastLoggedDate === today && state.lastLoggedStatus) {
                dateToKeep = today;
                statusToKeep = state.lastLoggedStatus;
              } else if (lastRetainDate === today) {
                dateToKeep = today;
                statusToKeep = (lastRetainStatus as 'retained' | 'relapsed') || 'retained';
              } else if (state.lastLoggedDate === today) {
                dateToKeep = today;
                statusToKeep = currentStatus || (todayHistory ? (todayHistory.status as 'retained' | 'relapsed') : null);
              }

              // Hydrate history from database checkin_history if available
              let hydratedHistory = state.history;
              if (profile.checkin_history && Array.isArray(profile.checkin_history) && profile.checkin_history.length > 0) {
                hydratedHistory = profile.checkin_history.map((c: any) => ({
                  date: c.date,
                  status: (c.status === 'relapsed' ? 'relapsed' : 'retained') as 'retained' | 'relapsed',
                  streakAfter: typeof c.streakAfter === 'number' ? c.streakAfter : (c.status === 'relapsed' ? 0 : 1),
                  strengthAfter: typeof c.strengthAfter === 'number' ? c.strengthAfter : 50,
                }));
              }

              // Keep higher streak if locally logged today as retained
              const resolvedStreak = (dateToKeep === today && statusToKeep === 'retained')
                ? Math.max(liveStreak, state.streak)
                : (statusToKeep === 'relapsed' ? 0 : liveStreak);

              return {
                streak: resolvedStreak,
                mindStrength: liveStrength,
                lastLoggedDate: dateToKeep,
                lastLoggedStatus: statusToKeep,
                history: hydratedHistory,
                aiMindsetAnalysis: profile.ai_mindset_analysis || '',
                recentJournals: profile.recent_journals || [],
                meditationsCount: profile.meditations_count || 0,
                afternoonMeditationDone: profile.afternoon_meditation_done || false,
                latestCheckinSummary: profile.latest_checkin_summary,
                totalUrgesCount: typeof profile.total_urges_count === 'number' ? profile.total_urges_count : state.totalUrgesCount,
                todayUrgesCount: typeof profile.today_urges_count === 'number' ? profile.today_urges_count : state.todayUrgesCount,
                dailyUrgeCounts: profile.daily_urge_counts && profile.daily_urge_counts.length > 0 ? profile.daily_urge_counts : state.dailyUrgeCounts,
              };
            });


            // Sync authStore user object & dailyMissionStore checkin status
            try {
              const { useAuthStore } = require('./auth-store');
              const { useDailyMissionStore } = require('./daily-mission-store');
              const authState = useAuthStore.getState();
              if (authState.user) {
                authState.updateUser({
                  name: profile.name || authState.user.name,
                  streak: liveStreak,
                  totalPoints: profile.total_points ?? authState.user.totalPoints,
                });
              }
              if (lastCheckin === today || profile.latest_checkin_summary?.date === today) {
                useDailyMissionStore.getState().syncWithBackend().catch(() => {});
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
