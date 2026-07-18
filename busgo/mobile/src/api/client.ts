import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../config';

export const TOKEN_KEY = 'busgo.token';
export const REFRESH_TOKEN_KEY = 'busgo.refresh-token';
export const USER_KEY = 'busgo.user';

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

let unauthorizedHandler: (() => void) | null = null;

export function setUnauthorizedHandler(handler: (() => void) | null) {
  unauthorizedHandler = handler;
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = 20000): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

/** BaseResponse envelope used by (almost) every BusGo service. */
export interface Envelope<T = any> {
  success: boolean;
  data: T;
  message?: string;
  errors?: string[] | null;
}

let refreshPromise: Promise<string | null> | null = null;

async function performTokenRefresh(): Promise<string | null> {
  const refreshToken = await AsyncStorage.getItem(REFRESH_TOKEN_KEY);
  if (!refreshToken) return null;
  const res = await fetchWithTimeout(`${API_URL}/api/auth/refresh`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  if (!res.ok) return null;
  const json = await res.json();
  const tokens = json?.data;
  if (!tokens?.access_token || !tokens?.refresh_token) return null;
  await AsyncStorage.multiSet([
    [TOKEN_KEY, tokens.access_token],
    [REFRESH_TOKEN_KEY, tokens.refresh_token],
  ]);
  return tokens.access_token;
}

async function refreshAccessToken(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = performTokenRefresh().finally(() => { refreshPromise = null; });
  }
  return refreshPromise;
}

async function request<T = any>(method: string, path: string, body?: any, mayRetry = true): Promise<T> {
  const token = await AsyncStorage.getItem(TOKEN_KEY);
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers['Authorization'] = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetchWithTimeout(`${API_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (e: any) {
    throw new ApiError(0, `Cannot reach the BusGo server at ${API_URL}. Is the stack running and your phone on the same Wi-Fi?`);
  }

  const isAuthRequest = /\/api\/auth\/(google-login|login|refresh)$/.test(path);
  if (res.status === 401 && mayRetry && !isAuthRequest) {
    const refreshedToken = await refreshAccessToken();
    if (refreshedToken) return request<T>(method, path, body, false);
    await AsyncStorage.multiRemove([TOKEN_KEY, REFRESH_TOKEN_KEY, USER_KEY]);
    unauthorizedHandler?.();
  }

  let json: any = null;
  try {
    json = await res.json();
  } catch {
    /* non-JSON response */
  }

  if (!res.ok) {
    const detail =
      (typeof json?.detail === 'string' && json.detail) ||
      (Array.isArray(json?.detail) && json.detail.map((d: any) => d.msg).join(', ')) ||
      json?.message ||
      `Request failed (${res.status})`;
    throw new ApiError(res.status, detail);
  }
  return json as T;
}

export const api = {
  get: <T = Envelope>(path: string) => request<T>('GET', path),
  post: <T = Envelope>(path: string, body?: any) => request<T>('POST', path, body),
  put: <T = Envelope>(path: string, body?: any) => request<T>('PUT', path, body),
  patch: <T = Envelope>(path: string, body?: any) => request<T>('PATCH', path, body),
  del: <T = Envelope>(path: string) => request<T>('DELETE', path),
};
