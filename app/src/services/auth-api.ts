import api, { TokenStorage } from './api';

export interface RegisterPayload {
  email: string;
  password: string;
  name?: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface OtpRequestPayload {
  email: string;
}

export interface OtpVerifyPayload {
  email: string;
  code: string;
  name?: string;
}

export interface GoogleAuthPayload {
  email?: string;
  name?: string;
  id_token?: string;
  google_id?: string;
}

export interface ResetPasswordPayload {
  email: string;
  code: string;
  new_password: string;
}

// Let's make sure we use type-safe fields
export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user_id: string;
  name: string | null;
  email: string;
  is_onboarded: boolean;
  onboarding_step: number;
  streak: number;
  max_streak: number;
  total_points: number;
  mind_strength: number;
  last_checkin_date: string | null;
}

export const authApi = {
  async register(payload: RegisterPayload): Promise<{ message: string; email: string }> {
    return api.post<{ message: string; email: string }>('/auth/register', payload, false);
  },

  async login(payload: LoginPayload): Promise<AuthResponse> {
    const response = await api.post<AuthResponse>('/auth/login', payload, false);
    await TokenStorage.setTokens(response.access_token, response.refresh_token);
    return response;
  },

  async requestOtp(email: string): Promise<{ message: string; email: string }> {
    return api.post<{ message: string; email: string }>('/auth/request-otp', { email }, false);
  },

  async verifyOtp(payload: OtpVerifyPayload): Promise<AuthResponse> {
    const response = await api.post<AuthResponse>('/auth/verify-otp', payload, false);
    await TokenStorage.setTokens(response.access_token, response.refresh_token);
    return response;
  },

  async googleAuth(payload: GoogleAuthPayload): Promise<AuthResponse> {
    const response = await api.post<AuthResponse>('/auth/google', payload, false);
    await TokenStorage.setTokens(response.access_token, response.refresh_token);
    return response;
  },

  async forgotPasswordRequest(email: string): Promise<{ success: boolean; message: string }> {
    return api.post<{ success: boolean; message: string }>('/auth/forgot-password/request', { email }, false);
  },

  async forgotPasswordReset(payload: ResetPasswordPayload): Promise<{ success: boolean; message: string }> {
    return api.post<{ success: boolean; message: string }>('/auth/forgot-password/reset', payload, false);
  },

  async requestAccountDeletion(password: string, deletionReason: string): Promise<{ success: boolean; message: string; deletion_scheduled_at: string }> {
    return api.post<{ success: boolean; message: string; deletion_scheduled_at: string }>('/auth/delete-account-request', {
      password,
      deletion_reason: deletionReason,
    });
  },

  async logout(): Promise<void> {
    await TokenStorage.clearTokens();
  },
};
