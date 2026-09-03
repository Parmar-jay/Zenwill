import api from './api';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface MeditationSessionLogPayload {
  technique_id: string;
  technique_title: string;
  category?: string;
  duration_seconds: number;
  duration_minutes?: number;
  rounds_completed?: number;
  completed?: boolean;
  started_at?: string;
  completed_at?: string;
  emotional_state?: string;
  rating?: number;
  steps_performed?: string[];
  metadata?: Record<string, any>;
}

export interface MeditationStats {
  total_sessions: number;
  total_minutes: number;
  total_days_meditated: number;
  favorite_technique: string;
  completed_today: boolean;
  today_sessions_count: number;
  today_minutes: number;
}

export interface MeditationSessionRecord {
  id: string;
  user_id: string;
  technique_id: string;
  technique_title: string;
  category: string;
  duration_seconds: number;
  duration_minutes: number;
  rounds_completed: number;
  completed: boolean;
  started_at: string;
  completed_at: string;
  emotional_state: string;
  rating: number;
  steps_performed: string[];
  created_at: string;
}

const STATS_CACHE_KEY = '@zenwill_meditation_stats';

export const meditationApi = {
  /**
   * Logs and persists a completed meditation session to MongoDB
   */
  async logSession(payload: MeditationSessionLogPayload): Promise<any> {
    try {
      const data = await api.post<any>('/meditation/sessions', payload);
      return data;
    } catch (error) {
      console.warn('[Meditation API] Log session error:', error);
      return { success: false };
    }
  },

  /**
   * Fetches user's lifetime and recent meditation statistics
   */
  async getStats(): Promise<MeditationStats> {
    try {
      const data = await api.get<MeditationStats>('/meditation/stats');
      if (data) {
        await AsyncStorage.setItem(STATS_CACHE_KEY, JSON.stringify(data));
        return data;
      }
    } catch (error) {
      // Graceful fallback for offline / pending deployment
    }

    // Try cache
    try {
      const cached = await AsyncStorage.getItem(STATS_CACHE_KEY);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (_) {}

    return {
      total_sessions: 0,
      total_minutes: 0,
      total_days_meditated: 0,
      favorite_technique: 'Nadi Shodhana',
      completed_today: false,
      today_sessions_count: 0,
      today_minutes: 0,
    };
  },

  /**
   * Retrieves past meditation session logs
   */
  async getHistory(limit: number = 20): Promise<MeditationSessionRecord[]> {
    try {
      const data = await api.get<MeditationSessionRecord[]>(`/meditation/history?limit=${limit}`);
      return data || [];
    } catch (error) {
      console.warn('[Meditation API] Get history error:', error);
      return [];
    }
  },
};
