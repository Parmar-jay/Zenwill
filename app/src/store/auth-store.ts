import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authApi, AuthResponse } from '@/services/auth-api';
import { useHabitStore } from '@/store/habit-store';
import { useDailyMissionStore } from '@/store/daily-mission-store';
import { useOnboardingStore } from '@/store/onboarding-store';

interface User {
  id: string;
  email: string;
  name?: string;
  streak?: number;
  totalPoints?: number;
  emailVerified?: boolean;
  lastCheckinDate?: string | null;
  lastRetainDate?: string | null;
  lastRetainStatus?: string | null;
}

interface AuthState {
  isAuthenticated: boolean;
  isEmailVerified: boolean;
  isOnboarded: boolean;
  onboardingStep: number;
  user: User | null;
  isLoading: boolean;
  error: string | null;
  isHydrated: boolean;

  // Form draft state
  draftEmail?: string;
  draftName?: string;
  draftPassword?: string;

  // Actions
  setHydrated: (hydrated: boolean) => void;
  setAuthDraft: (draft: Partial<{ draftEmail: string; draftName: string; draftPassword: string }>) => void;
  clearAuthDraft: () => void;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name?: string) => Promise<void>;
  requestOtp: (email: string) => Promise<void>;
  verifyOtp: (email: string, code: string, name?: string) => Promise<void>;
  loginWithGoogle: (payload: { email?: string; name?: string; id_token?: string; google_id?: string }) => Promise<void>;
  logout: () => Promise<void>;
  completeOnboarding: () => void;
  setOnboardingStep: (step: number) => void;
  clearError: () => void;
  updateUser: (fields: Partial<User>) => void;

  // Legacy helpers
  loginLocal: (email: string) => void;
  registerLocal: (email: string) => void;
}

const syncUserStats = async (response: AuthResponse) => {
  try {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const today = `${year}-${month}-${day}`;
    const lastRetainDate = response.last_retain_date || null;
    const lastRetainStatus = response.last_retain_status || null;
    const dbStreak = typeof response.streak === 'number' ? response.streak : 0;
    const dbMax = typeof response.max_streak === 'number' ? response.max_streak : dbStreak;

    useHabitStore.setState((state) => ({
      streak: dbStreak,
      maxStreak: Math.max(state.maxStreak || 0, dbMax, dbStreak),
      mindStrength: typeof response.mind_strength === 'number' ? response.mind_strength : 50,
      lastLoggedDate: lastRetainDate === today ? today : null,
      lastLoggedStatus: lastRetainDate === today ? ((lastRetainStatus as any) || 'retained') : null,
    }));
    if (typeof response.total_points === 'number' && response.total_points > 0) {
      useDailyMissionStore.setState({ totalPoints: response.total_points });
    }
    if (response.name) {
      useOnboardingStore.setState({ firstName: response.name });
    }

    // Immediately trigger and await full database sync for missions and habit history
    await Promise.allSettled([
      useDailyMissionStore.getState().syncWithBackend(),
      useHabitStore.getState().syncFromDatabase(),
    ]);
  } catch (err) {
    // Fail-safe silent catch if stores are initializing
  }
};


export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      isAuthenticated: false,
      isEmailVerified: false,
      isOnboarded: false,
      onboardingStep: 0,
      user: null,
      isLoading: false,
      error: null,
      isHydrated: false,
      draftEmail: '',
      draftName: '',
      draftPassword: '',

      setHydrated: (hydrated: boolean) => set({ isHydrated: hydrated }),
      setAuthDraft: (draft) => set((state) => ({ ...state, ...draft })),
      clearAuthDraft: () => set({ draftEmail: '', draftName: '', draftPassword: '' }),

      login: async (email: string, password: string) => {
        set({ isLoading: true, error: null });
        try {
          const response: AuthResponse = await authApi.login({ email, password });
          await syncUserStats(response);
          const verified = response.email_verified !== false;
          set({
            isAuthenticated: true,
            isEmailVerified: verified,
            isOnboarded: response.is_onboarded,
            onboardingStep: response.onboarding_step,
            user: {
              id: response.user_id,
              email: response.email,
              name: response.name ?? undefined,
              streak: response.streak,
              totalPoints: response.total_points,
              emailVerified: verified,
              lastCheckinDate: response.last_checkin_date,
              lastRetainDate: response.last_retain_date,
              lastRetainStatus: response.last_retain_status,
            },
            isLoading: false,
          });
          useDailyMissionStore.getState().initUser(response.user_id);
        } catch (err: any) {
          set({ isLoading: false, error: err.detail || 'Login failed' });
          throw err;
        }
      },

      register: async (email: string, password: string, name?: string) => {
        set({ isLoading: true, error: null });
        try {
          await authApi.register({ email, password, name });
          set({ isLoading: false });
        } catch (err: any) {
          set({ isLoading: false, error: err.detail || 'Registration failed' });
          throw err;
        }
      },

      requestOtp: async (email: string) => {
        set({ isLoading: true, error: null });
        try {
          await authApi.requestOtp(email);
          set({ isLoading: false });
        } catch (err: any) {
          set({ isLoading: false, error: err.detail || 'Failed to send OTP code' });
          throw err;
        }
      },

      verifyOtp: async (email: string, code: string, name?: string) => {
        set({ isLoading: true, error: null });
        try {
          const response: AuthResponse = await authApi.verifyOtp({ email, code, name });
          await syncUserStats(response);
          set({
            isAuthenticated: true,
            isEmailVerified: true,
            isOnboarded: response.is_onboarded,
            onboardingStep: response.onboarding_step,
            user: {
              id: response.user_id,
              email: response.email,
              name: response.name ?? undefined,
              streak: response.streak,
              totalPoints: response.total_points,
              emailVerified: true,
              lastCheckinDate: response.last_checkin_date,
              lastRetainDate: response.last_retain_date,
              lastRetainStatus: response.last_retain_status,
            },
            isLoading: false,
          });
          useDailyMissionStore.getState().initUser(response.user_id);
        } catch (err: any) {
          set({ isLoading: false, error: err.detail || 'Invalid or expired OTP code' });
          throw err;
        }
      },

      loginWithGoogle: async (payload: { email?: string; name?: string; id_token?: string; google_id?: string }) => {
        set({ isLoading: true, error: null });
        try {
          const response: AuthResponse = await authApi.googleAuth(payload);
          await syncUserStats(response);
          set({
            isAuthenticated: true,
            isEmailVerified: true,
            isOnboarded: response.is_onboarded,
            onboardingStep: response.onboarding_step,
            user: {
              id: response.user_id,
              email: response.email,
              name: response.name ?? undefined,
              streak: response.streak,
              totalPoints: response.total_points,
              emailVerified: true,
              lastCheckinDate: response.last_checkin_date,
              lastRetainDate: response.last_retain_date,
              lastRetainStatus: response.last_retain_status,
            },
            isLoading: false,
          });
          useDailyMissionStore.getState().initUser(response.user_id);
        } catch (err: any) {
          set({ isLoading: false, error: err.detail || 'Google authentication failed' });
          throw err;
        }
      },

      logout: async () => {
        // 1. Flag API client as signing out to immediately suppress any background fetches
        try {
          const { api } = require('@/services/api');
          api.setLoggingOut(true);
        } catch (e) {}

        // 2. Clear auth tokens from memory and storage
        try {
          await authApi.logout();
        } catch (e) {}

        // 4. Reset all domain stores
        try {
          const { useSpartanStore } = require('@/store/spartan-store');
          useSpartanStore.getState().resetSpartanStore();
        } catch (e) {}

        try {
          const { useUnreadStore } = require('@/store/unread-store');
          useUnreadStore.getState().resetUnreadStore();
        } catch (e) {}

        try {
          useDailyMissionStore.getState().resetMissions();
        } catch (e) {}

        try {
          useHabitStore.getState().clearState();
        } catch (e) {}

        try {
          useOnboardingStore.getState().resetProfile();
        } catch (e) {}

        // 5. Clear all in-memory domain caches
        try {
          const { clearCommunityCache } = require('@/services/community-api');
          clearCommunityCache();
        } catch (e) {}

        try {
          const { clearAnalyticsCache } = require('@/services/analytics-api');
          clearAnalyticsCache();
        } catch (e) {}

        try {
          const { meditationApi } = require('@/services/meditation-api');
          await meditationApi.clearCache();
        } catch (e) {}

        try {
          const { api } = require('@/services/api');
          api.clearAll();
        } catch (e) {}

        // 6. Thoroughly wipe all local storage persistence so zero user data/metadata remains
        try {
          await AsyncStorage.clear();
        } catch (e) {}

        // 7. Reset auth store state to pristine unauthenticated
        set({
          isAuthenticated: false,
          isEmailVerified: false,
          isOnboarded: false,
          onboardingStep: 0,
          user: null,
          isLoading: false,
          error: null,
          draftEmail: '',
          draftName: '',
          draftPassword: '',
        });

        // 8. Restore API loggingOut state
        try {
          const { api } = require('@/services/api');
          api.setLoggingOut(false);
        } catch (e) {}
      },

      completeOnboarding: () => {
        set({
          isOnboarded: true,
          onboardingStep: 6,
          draftEmail: '',
          draftName: '',
          draftPassword: '',
        });
        try {
          useOnboardingStore.getState().resetProfile();
        } catch (e) {}
      },
      setOnboardingStep: (step: number) => set({ onboardingStep: step }),
      clearError: () => set({ error: null }),
      updateUser: (fields: Partial<User>) => set((state) => ({
        user: state.user ? { ...state.user, ...fields } : null,
      })),

      loginLocal: (email: string) => set({
        isAuthenticated: true,
        isOnboarded: true,
        user: { id: 'local', email, name: email.split('@')[0] },
      }),
      registerLocal: (email: string) => set({
        isAuthenticated: true,
        isOnboarded: false,
        user: { id: 'local', email, name: email.split('@')[0] },
      }),
    }),
    {
      name: 'zenwill-auth-storage',
      storage: createJSONStorage(() => AsyncStorage),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true);
        if (state?.isAuthenticated && state?.user?.id) {
          useDailyMissionStore.getState().initUser(state.user.id);
          useHabitStore.getState().syncFromDatabase().catch(() => {});
        } else if (!state?.isAuthenticated) {
          useDailyMissionStore.getState().resetMissions();
        }
      },
    }

  )
);
