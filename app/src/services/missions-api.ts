import api from './api';

export interface Mission {
  id: string;
  title: string;
  description: string | null;
  category: string;
  difficulty: string;
  duration_minutes: number;
  xp_reward: number;
  mind_strength_reward: number;
  is_completed: boolean;
  is_ai_generated: boolean;
  date_assigned: string | null;
  date_completed: string | null;
  why_assigned: string | null;
  tags: string[];
}

export interface MissionCompleteResponse {
  success: boolean;
  xp_earned: number;
  mind_strength_gained: number;
  new_mind_strength: number;
  message: string;
}

export interface MissionHistoryDay {
  date: string;
  day_name: string;
  tasks: {
    checkin: boolean;
    meditation: boolean;
    journal: boolean;
    coach: boolean;
    rescue: boolean;
  };
  completed_count: number;
  percent: number;
  points_earned: number;
  all_completed: boolean;
}

export interface MissionHistoryResponse {
  days: MissionHistoryDay[];
  summary: {
    total_points_week: number;
    average_percent: number;
    active_days: number;
    current_streak: number;
  };
}

export const missionsApi = {
  getTodaysMissions(): Promise<Mission[]> {
    return api.get<Mission[]>('/missions/today');
  },

  getAllMissions(completed?: boolean): Promise<Mission[]> {
    const query = completed !== undefined ? `?completed=${completed}` : '';
    return api.get<Mission[]>(`/missions/${query}`);
  },

  getMissionsHistory(days: number = 7): Promise<MissionHistoryResponse> {
    return api.get<MissionHistoryResponse>(`/missions/history?days=${days}`);
  },

  completeMission(missionId: string, data?: { duration_actual_minutes?: number; feedback?: string }): Promise<MissionCompleteResponse> {
    return api.post<MissionCompleteResponse>(`/missions/${missionId}/complete`, data || {});
  },

  completeCategory(category: string, data?: { duration_actual_minutes?: number; feedback?: string }): Promise<MissionCompleteResponse> {
    return api.post<MissionCompleteResponse>('/missions/complete-category', {
      category,
      duration_actual_minutes: data?.duration_actual_minutes,
      feedback: data?.feedback,
    });
  },

  syncMissions(tasks: Record<string, boolean> | { [key: string]: boolean }): Promise<Mission[]> {
    return api.post<Mission[]>('/missions/sync', { tasks });
  },
};


