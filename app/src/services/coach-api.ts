import api from './api';

export interface CoachMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

export interface CoachMessageResponse {
  reply: string;
  session_id: string;
  emotional_context_detected: string | null;
  suggested_actions: string[] | null;
  created_at: string;
}

export const coachApi = {
  sendMessage(data: {
    message: string;
    session_id?: string;
    emotional_context?: string;
    local_time?: string;
    local_date?: string;
    timezone?: string;
    time_of_day?: string;
  }): Promise<CoachMessageResponse> {
    return api.post<CoachMessageResponse>('/coach/message', data);
  },

  getHistory(limit = 50): Promise<CoachMessage[]> {
    return api.get<CoachMessage[]>(`/coach/history?limit=${limit}`);
  },

  clearHistory(): Promise<{ status: string; message: string }> {
    return api.delete<{ status: string; message: string }>('/coach/history');
  },
};
