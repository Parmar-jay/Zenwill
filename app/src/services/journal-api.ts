import api from './api';

export interface JournalEntry {
  id: string;
  user_id?: string;
  author_name?: string;
  title?: string | null;
  content: string;
  prompt_used?: string | null;
  mood_tag?: string | null;
  energy_tag?: string | null;
  emotional_tags?: string[];
  ai_themes?: string[];
  ai_insight?: string | null;
  is_private?: boolean;
  created_at: string;
  updated_at: string;
}

export interface JournalEntryCreatePayload {
  title?: string;
  content: string;
  prompt_used?: string;
  mood_tag?: string;
  energy_tag?: string;
  emotional_tags?: string[];
  is_private?: boolean;
}

export const journalApi = {
  createEntry(data: JournalEntryCreatePayload): Promise<JournalEntry> {
    return api.post<JournalEntry>('/journal/', data);
  },

  getEntries(limit = 20, offset = 0): Promise<JournalEntry[]> {
    return api.get<JournalEntry[]>(`/journal/?limit=${limit}&offset=${offset}`);
  },

  getCommunityRecent(limit = 5): Promise<JournalEntry[]> {
    return api.get<JournalEntry[]>(`/journal/community/recent?limit=${limit}`);
  },

  getEntry(id: string): Promise<JournalEntry> {
    return api.get<JournalEntry>(`/journal/${id}`);
  },

  updateEntry(id: string, data: Partial<JournalEntryCreatePayload>): Promise<JournalEntry> {
    return api.patch<JournalEntry>(`/journal/${id}`, data);
  },

  deleteEntry(id: string): Promise<void> {
    return api.delete(`/journal/${id}`);
  },
};
