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
  lastCheckinDate?: string | null;
  lastRetainDate?: string | null;
  lastRetainStatus?: string | null;
}

interface AuthState {
  isAuthenticated: boolean;
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

const syncUserStats = (response: AuthResponse) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const lastRetainDate = response.last_retain_date || null;
    const lastRetainStatus = response.last_retain_status || null;

    useHabitStore.setState({
      streak: typeof response.streak === 'number' ? response.streak : 0,
      mindStrength: typeof response.mind_strength === 'number' ? response.mind_strength : 50,
      lastLoggedDate: lastRetainDate === today ? today : null,
      lastLoggedStatus: lastRetainDate === today ? ((lastRetainStatus as any) || 'retained') : null,
    });
    if (typeof response.total_points === 'number' && response.total_points > 0) {
      useDailyMissionStore.setState({ totalPoints: response.total_points });
    }
    if (response.name) {
      useOnboardingStore.setState({ firstName: response.name });
    }

    // Immediately trigger full database sync for missions and habit history
    useDailyMissionStore.getState().syncWithBackend().catch(() => {});
    useHabitStore.getState().syncFromDatabase().catch(() => {});
  } catch (err) {
    // Fail-safe silent catch if stores are initializing
  }
};


export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      isAuthenticated: false,
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
          syncUserStats(response);
          set({
            isAuthenticated: true,
            isOnboarded: response.is_onboarded,
            onboardingStep: response.onboarding_step,
            user: {
              id: response.user_id,
              email: response.email,
              name: response.name ?? undefined,
              streak: response.streak,
              totalPoints: response.total_points,
              lastCheckinDate: response.last_checkin_date,
              lastRetainDate: response.last_retain_date,
              lastRetainStatus: response.last_retain_status,
            },
            isLoading: false,
          });
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
          syncUserStats(response);
          set({
            isAuthenticated: true,
            isOnboarded: response.is_onboarded,
            onboardingStep: response.onboarding_step,
            user: {
              id: response.user_id,
              email: response.email,
              name: response.name ?? undefined,
              streak: response.streak,
              totalPoints: response.total_points,
              lastCheckinDate: response.last_checkin_date,
              lastRetainDate: response.last_retain_date,
              lastRetainStatus: response.last_retain_status,
            },
            isLoading: false,
          });
        } catch (err: any) {
          set({ isLoading: false, error: err.detail || 'Invalid or expired OTP code' });
          throw err;
        }
      },

      loginWithGoogle: async (payload: { email?: string; name?: string; id_token?: string; google_id?: string }) => {
        set({ isLoading: true, error: null });
        try {
          const response: AuthResponse = await authApi.googleAuth(payload);
          syncUserStats(response);
          set({
            isAuthenticated: true,
            isOnboarded: response.is_onboarded,
            onboardingStep: response.onboarding_step,
            user: {
              id: response.user_id,
              email: response.email,
              name: response.name ?? undefined,
              streak: response.streak,
              totalPoints: response.total_points,
              lastCheckinDate: response.last_checkin_date,
              lastRetainDate: response.last_retain_date,
              lastRetainStatus: response.last_retain_status,
            },
            isLoading: false,
          });
        } catch (err: any) {
          set({ isLoading: false, error: err.detail || 'Google authentication failed' });
          throw err;
        }
      },

      logout: async () => {
        try {
          await authApi.logout();
        } catch (e) {
          // Ignore network failure on logout
        }

        try {
          await AsyncStorage.multiRemove([
            'zenwill-auth-storage',
            'zenwill-daily-missions-storage',
            'zenwill-habit-storage',
            'zenwill-onboarding-profile',
            'zenwill_access_token',
            'zenwill_refresh_token',
          ]);
        } catch (e) {
          // Ignore storage removal errors
        }

        try {
          useDailyMissionStore.getState().resetMissions();
        } catch (e) {}

        try {
          useHabitStore.getState().clearState();
        } catch (e) {}

        try {
          useOnboardingStore.getState().resetProfile();
        } catch (e) {}

        set({
          isAuthenticated: false,
          isOnboarded: false,
          onboardingStep: 0,
          user: null,
          isLoading: false,
          error: null,
          draftEmail: '',
          draftName: '',
          draftPassword: '',
        });
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
        if (state?.isAuthenticated) {
          useDailyMissionStore.getState().syncWithBackend().catch(() => {});
          useHabitStore.getState().syncFromDatabase().catch(() => {});
        }
      },
    }

  )
);
