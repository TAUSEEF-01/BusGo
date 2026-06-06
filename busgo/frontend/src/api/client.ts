import axios from "axios";
import { supabase } from "../lib/supabase";
import { useAuthStore } from "../stores/authStore";

const baseURL = (import.meta as any).env?.VITE_API_BASE_URL || "https://busgo-nhbi.onrender.com";

export const apiClient = axios.create({
  baseURL,
  headers: {
    "Content-Type": "application/json",
  },
});

apiClient.interceptors.request.use(
  async (config) => {
    try {
      // Try to get token from Supabase first
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.access_token && config.headers) {
        config.headers.Authorization = `Bearer ${session.access_token}`;
      } else {
        // Fallback to Zustand store
        const { accessToken } = useAuthStore.getState();
        if (accessToken && config.headers) {
          config.headers.Authorization = `Bearer ${accessToken}`;
        }
      }
    } catch (e) {
      console.warn("Supabase session get failed, using fallback Zustand store", e);
      const { accessToken } = useAuthStore.getState();
      if (accessToken && config.headers) {
        config.headers.Authorization = `Bearer ${accessToken}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

let isRefreshing = false;
let failedQueue: Array<any> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return apiClient(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Try to refresh Supabase session first
        const { data: { session }, error: refreshError } = await supabase.auth.refreshSession();
        
        if (session?.access_token && !refreshError) {
          processQueue(null, session.access_token);
          originalRequest.headers.Authorization = `Bearer ${session.access_token}`;
          return apiClient(originalRequest);
        }
        
        // Fallback to custom refresh token logic
        const { refreshToken } = useAuthStore.getState();
        const response = await axios.post(`${baseURL}/api/auth/refresh`, {
          refresh_token: refreshToken,
        });

        const tokenData = response.data?.data;
        if (!tokenData || !tokenData.access_token) {
          throw new Error("Invalid token refresh response structure");
        }

        useAuthStore.getState().setTokens(tokenData.access_token, tokenData.refresh_token);
        
        processQueue(null, tokenData.access_token);
        
        originalRequest.headers.Authorization = `Bearer ${tokenData.access_token}`;
        return apiClient(originalRequest);
      } catch (err) {
        processQueue(err, null);
        useAuthStore.getState().logout();
        await supabase.auth.signOut();
        window.location.href = "/login";
        return Promise.reject(err);
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(error);
  }
);
