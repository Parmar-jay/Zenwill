import api from './api';

export interface MindProfile {
  id: string;
  user_id: string;
  mind_strength: number;
  recovery_days: number;
  current_flow: number;
  longest_flow: number;
  avg_sleep_quality: number;
  avg_stress_level: number;
  avg_mood: number;
  avg_energy: number;
  avg_focus: number;
  avg_urge_intensity: number;
  risk_score_today: number;
  predicted_trigger_time: string | null;
  predicted_trigger_type: string | null;
  top_triggers: string[];
  top_coping_strategies: string[];
  high_risk_times: string[];
  urge_free_days: number;
  total_checkins: number;
  total_missions_completed: number;
  total_journal_entries: number;
  total_emergency_sessions: number;
  successful_emergency_sessions: number;
  last_relapse_at: string | null;
  last_checkin_at: string | null;
  updated_at: string;
}

export interface AISummary {
  emotional_condition: string;
  energy_level: string;
  stress_level: string;
  sleep_quality: string;
  urge_intensity: string;
  focus_score: string;
  overall_recovery_score: number;
  estimated_relapse_risk: string;
  relapse_risk_category: string;
  relapse_risk_percentage: number;
  key_behavioral_insight: string;
  personalized_recommendation: string;
  top_mission: string;
}

export interface CheckinPayload {
  date?: string;
  mood: string;
  mood_intensity: number;
  mood_factors?: string[];
  energy_score: number;
  energy_category: string;
  energy_factors?: string[];
  stress_score: number;
  stress_causes?: string[];
  sleep_duration: number;
  sleep_quality: number;
  rested_status: string;
  urge_intensity: number;
  primary_triggers?: string[];
  action_taken: string;
  relapse_occurred?: boolean;
  pornography_involved?: boolean;
  session_duration?: string;
  post_relapse_emotions?: string[];
  focus_score: number;
  focus_factors?: string[];
  reflection_question?: string;
  reflection_response?: string;
}

export interface CheckinResponse {
  id: string;
  date: string;
  mood: string;
  mood_intensity: number;
  mood_factors: string[];
  energy_score: number;
  energy_category: string;
  energy_factors: string[];
  stress_score: number;
  stress_causes: string[];
  sleep_duration: number;
  sleep_quality: number;
  rested_status: string;
  urge_intensity: number;
  primary_triggers: string[];
  action_taken: string;
  relapse_occurred: boolean;
  pornography_involved: boolean | null;
  session_duration: string | null;
  post_relapse_emotions: string[];
  focus_score: number;
  focus_factors: string[];
  reflection_question: string | null;
  reflection_response: string | null;
  ai_summary: AISummary | null;
  ai_risk_score: number | null;
  ai_insight: string | null;
  ai_mission_ids: string[];
  created_at: string;
}

export const mindApi = {
  getMindProfile(): Promise<MindProfile> {
    return api.get<MindProfile>('/mind-profile/');
  },

  submitCheckin(data: CheckinPayload): Promise<CheckinResponse> {
    return api.post<CheckinResponse>('/checkin/', data);
  },

  getTodayCheckin(): Promise<CheckinResponse | null> {
    return api.get<CheckinResponse | null>('/checkin/today');
  },

  getCheckinHistory(limit: number = 30): Promise<CheckinResponse[]> {
    return api.get<CheckinResponse[]>(`/checkin/history?limit=${limit}`);
  },
};
