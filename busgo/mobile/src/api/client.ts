import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../config';

export const TOKEN_KEY = 'busgo.token';
export const USER_KEY = 'busgo.user';

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** BaseResponse envelope used by (almost) every BusGo service. */
export interface Envelope<T = any> {
  success: boolean;
  data: T;
  message?: string;
  errors?: string[] | null;
}

async function request<T = any>(method: string, path: string, body?: any): Promise<T> {
  const token = await AsyncStorage.getItem(TOKEN_KEY);
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers['Authorization'] = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (e: any) {
    throw new ApiError(0, `Cannot reach the BusGo server at ${API_URL}. Is the stack running and your phone on the same Wi-Fi?`);
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
