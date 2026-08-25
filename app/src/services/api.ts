/**
 * ZenWill API Client
 * Axios-based HTTP client with JWT auth, auto-refresh, and typed responses.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// --- Backend Server URL (Comment line 1 & uncomment line 2 to switch to Localhost) ---
export const BASE_URL = 'https://zenwill.onrender.com/api/v1';
// export const BASE_URL = Platform.OS === 'android' ? 'http://10.0.2.2:8000/api/v1' : 'http://localhost:8000/api/v1';

// ── Types ──────────────────────────────────────────────────────────────────

export interface ApiResponse<T = any> {
    data: T;
    status: number;
}

export interface ApiError {
    detail: string;
    status: number;
}

// ── Token Storage ─────────────────────────────────────────────────────────

const TOKEN_KEY = 'zenwill_access_token';
const REFRESH_KEY = 'zenwill_refresh_token';

let memoryAccessToken: string | null = null;
let memoryRefreshToken: string | null = null;

// Pre-hydrate memory tokens from AsyncStorage immediately
AsyncStorage.getItem(TOKEN_KEY).then((token) => {
    if (token) memoryAccessToken = token;
}).catch(() => {});
AsyncStorage.getItem(REFRESH_KEY).then((token) => {
    if (token) memoryRefreshToken = token;
}).catch(() => {});

export const TokenStorage = {
    async getAccessToken(): Promise<string | null> {
        if (memoryAccessToken) return memoryAccessToken;
        const token = await AsyncStorage.getItem(TOKEN_KEY);
        if (token) memoryAccessToken = token;
        return token;
    },
    async getRefreshToken(): Promise<string | null> {
        if (memoryRefreshToken) return memoryRefreshToken;
        const token = await AsyncStorage.getItem(REFRESH_KEY);
        if (token) memoryRefreshToken = token;
        return token;
    },
    async setTokens(access: string, refresh: string): Promise<void> {
        memoryAccessToken = access;
        memoryRefreshToken = refresh;
        await AsyncStorage.multiSet([
            [TOKEN_KEY, access],
            [REFRESH_KEY, refresh],
        ]);
    },
    async setAccessToken(access: string): Promise<void> {
        memoryAccessToken = access;
        await AsyncStorage.setItem(TOKEN_KEY, access);
    },
    async clearTokens(): Promise<void> {
        memoryAccessToken = null;
        memoryRefreshToken = null;
        await AsyncStorage.multiRemove([TOKEN_KEY, REFRESH_KEY]);
    },
};

// ── Core Fetch Wrapper ─────────────────────────────────────────────────────

let isRefreshing = false;
let refreshQueue: Array<(token: string) => void> = [];

async function refreshAccessToken(): Promise<string | null> {
    const refreshToken = await TokenStorage.getRefreshToken();
    if (!refreshToken) return null;

    try {
        const response = await fetch(`${BASE_URL}/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh_token: refreshToken }),
        });
        if (!response.ok) {
            await TokenStorage.clearTokens();
            return null;
        }
        const data = await response.json();
        await TokenStorage.setAccessToken(data.access_token);
        return data.access_token;
    } catch {
        return null;
    }
}

async function request<T>(
    method: string,
    path: string,
    body?: any,
    requiresAuth: boolean = true,
): Promise<T> {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    const url = `${BASE_URL}${normalizedPath}`;
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
    };

    if (requiresAuth) {
        const token = await TokenStorage.getAccessToken();
        if (token) headers['Authorization'] = `Bearer ${token}`;
    }

    const options: RequestInit = {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
    };

    let response = await fetch(url, options);

    // Auto-refresh on 401
    if (response.status === 401 && requiresAuth) {
        if (!isRefreshing) {
            isRefreshing = true;
            const newToken = await refreshAccessToken();
            isRefreshing = false;

            if (newToken) {
                refreshQueue.forEach((cb) => cb(newToken));
                refreshQueue = [];
                headers['Authorization'] = `Bearer ${newToken}`;
                options.headers = headers;
                response = await fetch(url, options);
            } else {
                import('@/store/auth-store')
                    .then(({ useAuthStore }) => {
                        useAuthStore.getState().logout();
                    })
                    .catch(() => { });
            }
        }
    }

    const responseText = await response.text();
    let data: any;
    try {
        data = responseText ? JSON.parse(responseText) : null;
    } catch {
        data = { detail: responseText };
    }

    if (!response.ok) {
        const error: ApiError = {
            detail: data?.detail || `Request failed with status ${response.status}`,
            status: response.status,
        };
        throw error;
    }

    return data as T;
}

// ── HTTP Methods ──────────────────────────────────────────────────────────

export const api = {
    get: <T>(path: string) => request<T>('GET', path),
    post: <T>(path: string, body?: any, auth = true) => request<T>('POST', path, body, auth),
    patch: <T>(path: string, body?: any) => request<T>('PATCH', path, body),
    put: <T>(path: string, body?: any) => request<T>('PUT', path, body),
    delete: <T>(path: string) => request<T>('DELETE', path),
    BASE_URL,
};

export default api;