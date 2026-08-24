import api from './api';

export interface UserProfile {
  id: string;
  email: string;
  name: string | null;
  is_onboarded: boolean;
  onboarding_step: number;
  created_at: string;
  streak?: number;
  max_streak?: number;
  total_points?: number;
  mind_strength?: number;
  last_checkin_date?: string | null;
  last_retain_date?: string | null;
  last_retain_status?: 'retained' | 'relapsed' | null;
  ai_mindset_score?: number;
  ai_mindset_analysis?: string;
  journals_count?: number;
  recent_journals?: Array<{ id: string; title: string; content: string; mood_tag: string; created_at: string }>;
  meditations_count?: number;
  afternoon_meditation_done?: boolean;
  latest_checkin_summary?: {
    mood: string;
    mood_intensity: number;
    energy_score: number;
    stress_score: number;
    sleep_quality: number;
    focus_score: number;
    date: string;
  };
  total_urges_count?: number;
  today_urges_count?: number;
  daily_urge_counts?: Array<{ date: string; dayLabel: string; count: number; isToday?: boolean }>;
  checkin_history?: Array<{
    date: string;
    status: string;
    streakAfter?: number;
    strengthAfter?: number;
    mood?: string;
    urge_intensity?: number;
  }>;
  bio?: string | null;
  primary_outcome?: string | null;
  occupation?: string | null;
  daily_schedule?: string | null;
  self_control?: string | null;
}


export const profileApi = {
  getMe(): Promise<UserProfile> {
    return api.get<UserProfile>('/profile/me');
  },

  updateMe(data: {
    name?: string;
    bio?: string;
    personal_statement?: string;
    primary_outcome?: string;
    occupation?: string;
    daily_schedule?: string;
    self_control?: string;
    onboarding_step?: number;
    streak?: number;
    max_streak?: number;
    mind_strength?: number;
    total_points?: number;
    last_checkin_date?: string | null;
    last_retain_date?: string | null;
    last_retain_status?: 'retained' | 'relapsed' | null;
  }): Promise<UserProfile> {
    return api.patch<UserProfile>('/profile/me', data);
  },

  submitOnboarding(onboardingData: Record<string, any>): Promise<{
    success: boolean;
    message: string;
    mind_strength: number;
    risk_score_today: number;
  }> {
    return api.post('/profile/onboarding', onboardingData);
  },
};
