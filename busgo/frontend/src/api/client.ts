import axios from "axios";
import { useAuthStore } from "../stores/authStore";

const baseURL = (import.meta as any).env?.VITE_API_BASE_URL || "https://busgo-nhbi.onrender.com";

export const apiClient = axios.create({
  baseURL,
  headers: {
    "Content-Type": "application/json",
  },
});

apiClient.interceptors.request.use(
  (config) => {
    const { accessToken } = useAuthStore.getState();
    if (accessToken && config.headers) {
      config.headers.Authorization = `Bearer ${accessToken}`;
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
    const isSessionEndpoint = /\/api\/auth\/(google-login|login|refresh)$/.test(originalRequest?.url || "");
    if (error.response?.status === 401 && !originalRequest._retry && !isSessionEndpoint) {
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
        const { refreshToken } = useAuthStore.getState();
        if (!refreshToken) throw new Error("No refresh token is available");
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
        const refreshTokenExists = Boolean(useAuthStore.getState().refreshToken);
        const refreshStatus = axios.isAxiosError(err) ? err.response?.status : undefined;
        const sessionIsInvalid = !refreshTokenExists || refreshStatus === 400 || refreshStatus === 401 || refreshStatus === 403;

        // Network problems and 5xx responses are temporary. Preserve the
        // cached session so the user can retry instead of being logged out.
        if (sessionIsInvalid) {
          useAuthStore.getState().logout();
          window.location.href = "/login";
        }
        return Promise.reject(err);
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(error);
  }
);
