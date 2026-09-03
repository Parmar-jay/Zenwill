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

// ── In-Memory Fast Cache & Request Deduplication ────────────────────────────

interface CacheEntry<T> {
    data: T;
    timestamp: number;
    ttl: number;
}

const memoryCache = new Map<string, CacheEntry<any>>();
const inFlightRequests = new Map<string, Promise<any>>();

export interface RequestOptions {
    ttl?: number; // Cache TTL in ms (default 15000ms for GET)
    noCache?: boolean; // Bypass cache
    timeoutMs?: number; // Request timeout in ms (default 12000ms)
}

export function invalidateApiCache(pathPrefix?: string) {
    if (!pathPrefix) {
        memoryCache.clear();
        return;
    }
    const normalized = pathPrefix.startsWith('/') ? pathPrefix : `/${pathPrefix}`;
    for (const key of memoryCache.keys()) {
        if (key.startsWith(normalized)) {
            memoryCache.delete(key);
        }
    }
}

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

async function executeFetch<T>(
    method: string,
    path: string,
    body?: any,
    requiresAuth: boolean = true,
    timeoutMs: number = 12000
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

    const controller = new AbortController();
    const timeoutTimer = setTimeout(() => controller.abort(), timeoutMs);

    const options: RequestInit = {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
    };

    let response: Response;
    try {
        response = await fetch(url, options);
    } catch (err: any) {
        clearTimeout(timeoutTimer);
        const errMsg = err?.message || '';
        if (err.name === 'AbortError' || errMsg.includes('canceled') || errMsg.includes('cancelled') || errMsg.includes('aborted')) {
            throw { detail: 'Request timed out or cancelled.', status: 408 };
        }
        throw { detail: errMsg || 'Network request failed', status: 0 };
    } finally {
        clearTimeout(timeoutTimer);
    }

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
                try {
                    const { useAuthStore } = require('../store/auth-store');
                    useAuthStore.getState().logout();
                } catch {}
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

async function request<T>(
    method: string,
    path: string,
    body?: any,
    requiresAuth: boolean = true,
    options?: RequestOptions
): Promise<T> {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;

    // For write operations: execute and invalidate cache for relevant domain
    if (method !== 'GET') {
        const domainPrefix = normalizedPath.split('/')[1];
        if (domainPrefix) {
            invalidateApiCache(`/${domainPrefix}`);
        }
        return executeFetch<T>(method, path, body, requiresAuth, options?.timeoutMs || 15000);
    }

    // For GET requests: check memory cache first for instant 0ms retrieval
    const cacheKey = normalizedPath;
    const now = Date.now();
    const ttl = options?.ttl ?? 30000; // 30s default TTL for instant screen loads

    if (!options?.noCache) {
        const cached = memoryCache.get(cacheKey);
        if (cached && (now - cached.timestamp) < cached.ttl) {
            return cached.data as T;
        }
    }

    // Deduplicate in-flight concurrent requests for the exact same endpoint
    if (inFlightRequests.has(cacheKey)) {
        return inFlightRequests.get(cacheKey) as Promise<T>;
    }

    const fetchPromise = executeFetch<T>(method, path, body, requiresAuth, options?.timeoutMs || 12000)
        .then((data) => {
            if (!options?.noCache && ttl > 0) {
                memoryCache.set(cacheKey, { data, timestamp: Date.now(), ttl });
            }
            return data;
        })
        .catch((err) => {
            // Stale-if-error: If network failed or timed out, gracefully return stale cached data if available
            const fallback = memoryCache.get(cacheKey);
            if (fallback && fallback.data) {
                return fallback.data as T;
            }
            throw err;
        })
        .finally(() => {
            inFlightRequests.delete(cacheKey);
        });

    inFlightRequests.set(cacheKey, fetchPromise);
    return fetchPromise;
}

// ── HTTP Methods ──────────────────────────────────────────────────────────

export const api = {
    get: <T>(path: string, options?: RequestOptions) => request<T>('GET', path, undefined, true, options),
    post: <T>(path: string, body?: any, auth = true, options?: RequestOptions) => request<T>('POST', path, body, auth, options),
    patch: <T>(path: string, body?: any, options?: RequestOptions) => request<T>('PATCH', path, body, true, options),
    put: <T>(path: string, body?: any, options?: RequestOptions) => request<T>('PUT', path, body, true, options),
    delete: <T>(path: string, options?: RequestOptions) => request<T>('DELETE', path, undefined, true, options),
    invalidateCache: invalidateApiCache,
    BASE_URL,
};

export default api;