import api from './api';

export interface WeeklyInsights {
  week_start: string;
  week_end: string;
  mind_strength_start: number;
  mind_strength_end: number;
  mind_strength_change: number;
  total_checkins: number;
  total_missions: number;
  missions_completed: number;
  total_journal_entries: number;
  avg_sleep_hours: number;
  avg_stress: number;
  avg_mood: number;
  relapse_count: number;
  urge_free_days: number;
  top_trigger: string | null;
  best_coping_strategy: string | null;
  ai_summary: string;
  ai_predictions: string[];
  ai_recommendations: string[];
}

export interface CheckinHistoryItem {
  date: string;
  mood: number;
  energy: number;
  stress: number;
  sleep_hours: number;
  sleep_quality: number;
  urge_intensity: number | null;
  relapse_occurred: boolean;
  exercise_minutes: number;
  meditation_minutes: number;
  ai_risk_score: number | null;
}

export interface EmergencySession {
  session_id: string;
  ai_intervention_plan: string;
  techniques_offered: Array<{
    id: string;
    name: string;
    duration_seconds: number;
    description: string;
  }>;
  message: string;
}

export interface MindsetEvaluation {
  score: number;
  status_title: string;
  summary: string;
  transmutation_tip: string;
  checkin_score: number;
  journal_score: number;
  meditation_urge_score: number;
}

export interface ProgressIntelligence {
  score: number;
  status_title: string;
  status_color?: string;
  summary: string;
  transmutation_tip: string;
  checkin_score: number;
  journal_score: number;
  meditation_urge_score: number;
  metrics_breakdown?: {
    checkin_points: number;
    journal_points: number;
    meditation_points: number;
    urge_control_points: number;
  };
  weekly_stats?: {
    total_checkins: number;
    relapse_count: number;
    urge_free_days: number;
    avg_sleep_hours: number;
    avg_stress: number;
    avg_mood: number;
    total_missions: number;
    missions_completed: number;
    total_journals: number;
  };
  predictions?: string[];
  recommendations?: string[];
}

export interface RecommendationActionTask {
  id: string;
  action_type: string;
  title: string;
  description: string;
  route: string;
  time_window: string;
  xp_reward: number;
  color: string;
  icon: string;
  is_completed: boolean;
}

export interface UserRecommendations {
  recommended_meditation: {
    technique_id: string;
    title: string;
    subtitle: string;
    duration_text: string;
    difficulty: string;
    image_key: string;
    color: string;
    reason?: string;
  };
  ai_insight: {
    category: string;
    headline: string;
    subtitle: string;
    action_text: string;
    route: string;
    color: string;
    icon: string;
  };
  time_window?: {
    key: string;
    title: string;
    subtitle: string;
    icon: string;
    theme_color: string;
  };
  recommended_actions?: RecommendationActionTask[];
  progress_stats?: {
    completed_tasks: number;
    total_tasks: number;
    completion_percentage: number;
  };
  streak_context?: {
    streak: number;
    mind_strength: number;
    has_checked_in: boolean;
    has_meditated: boolean;
    has_journaled: boolean;
  };
}

export interface RelapseAutopsyPayload {
  first_compromise_domino: string;
  emotional_precursor: string;
  physical_environment: string;
  device_involved: string;
  approximate_time_window?: string;
  user_reflection_note?: string;
}

export interface RelapseAutopsyResult {
  success: boolean;
  autopsy_id?: string;
  retained_percentage: number;
  clean_days_count: number;
  streak_before: number;
  domino_title: string;
  generated_golden_rule: string;
  rule_category: string;
  reframing_message: string;
  date_str?: string;
  pledge_signed?: boolean;
}
export interface TriggerIntelligence {
  peak_risk_window: string;
  primary_vulnerability: string;
  tactical_defense: string;
  vitality_boost_quote: string;
  purpose_alignment_quote?: string;
  risk_level?: string;
  risk_score?: number;
  active_triggers?: string[];
  first_sign_action?: string;
  environmental_rule?: string;
  highest_risk_day?: string;
  effectiveness_rate?: number;
  total_urges_defeated?: number;
  today_urges_count?: number;
  triggers?: Array<{
    id: string;
    name: string;
    category: 'Circadian' | 'Emotional' | 'Environmental' | 'Physical' | string;
    frequency: number;
    riskScore: number;
    color: string;
    peakTime: string;
    recommendation: string;
  }>;
  timeline_events?: Array<{
    id: string;
    time: string;
    triggerName: string;
    status: 'Resolved' | 'Interrupted' | 'Flagged';
    resolutionAction: string;
  }>;
}

export const analyticsApi = {
  getWeeklyInsights(): Promise<WeeklyInsights> {
    return api.get<WeeklyInsights>('/analytics/weekly');
  },

  getCheckinHistory(days = 30): Promise<CheckinHistoryItem[]> {
    return api.get<CheckinHistoryItem[]>(`/analytics/history?days=${days}`);
  },

  getTodayMindsetEval(): Promise<MindsetEvaluation> {
    return api.get<MindsetEvaluation>('/analytics/mindset-eval/today');
  },

  runMindsetEval(): Promise<MindsetEvaluation> {
    return api.post<MindsetEvaluation>('/analytics/mindset-eval/run', {});
  },

  getTriggerIntelligence(): Promise<TriggerIntelligence> {
    return api.get<TriggerIntelligence>('/analytics/trigger-intelligence');
  },

  getProgressIntelligence(): Promise<ProgressIntelligence> {
    return api.get<ProgressIntelligence>('/analytics/progress-intelligence');
  },

  getRecommendations(): Promise<UserRecommendations> {
    return api.get<UserRecommendations>('/analytics/recommendations');
  },

  completeRecommendationTask(
    taskId: string,
    actionType: string = 'general',
    title: string = 'Completed Task'
  ): Promise<{ success: boolean; message: string; points_earned: number; mind_strength: number }> {
    return api.post('/analytics/recommendations/complete', {
      task_id: taskId,
      action_type: actionType,
      title: title,
    });
  },

  submitRelapseAutopsy(payload: RelapseAutopsyPayload): Promise<RelapseAutopsyResult> {
    return api.post<RelapseAutopsyResult>('/analytics/relapse-autopsy/submit', payload);
  },

  getLatestRelapseAutopsy(): Promise<RelapseAutopsyResult | null> {
    return api.get<RelapseAutopsyResult | null>('/analytics/relapse-autopsy/latest');
  },

  startEmergency(data: {
    urge_intensity: number;
    trigger_type?: string;
    emotional_state?: string;
    environment?: string;
  }): Promise<EmergencySession> {
    return api.post<EmergencySession>('/emergency/start', data);
  },

  completeEmergency(data: {
    session_id?: string;
    techniques_used?: string[];
    outcome?: 'resisted' | 'relapsed' | 'incomplete';
    was_effective?: boolean;
    main_influence?: string;
    trigger_reason?: string;
    urge_intensity_before?: number;
    urge_intensity_after?: number;
    duration_minutes?: number;
    most_helpful_technique?: string;
    user_feedback?: string;
    thought_note?: string;
  }): Promise<{
    success: boolean;
    outcome: string;
    message: string;
    mind_strength: number;
    total_urges_count?: number;
    today_urges_count?: number;
  }> {
    return api.post('/emergency/complete', data);
  },

  logEvent(data: {
    event_type: string;
    screen_name?: string;
    feature_name?: string;
    duration_seconds?: number;
    emotional_state?: string;
    trigger_context?: string;
    outcome?: string;
    intensity?: number;
    metadata?: Record<string, any>;
  }): Promise<{ success: boolean; event_id: string }> {
    return api.post('/events/', data);
  },
};

