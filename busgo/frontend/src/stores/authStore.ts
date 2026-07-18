import { create } from "zustand";
import { persist } from "zustand/middleware";
import { signOutGoogle } from "../lib/supabase";

interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: "CUSTOMER" | "OPERATOR" | "ADMIN";
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  login: (user: User, accessToken: string, refreshToken: string) => void;
  logout: () => void;
  setTokens: (accessToken: string, refreshToken: string) => void;
  updateUser: (user: User) => void;
}

const setCookie = (name: string, value: string, days: number) => {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
};

const deleteCookie = (name: string) => {
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
};

const getCookie = (name: string) => {
  return document.cookie.split("; ").reduce((r, v) => {
    const parts = v.split("=");
    return parts[0] === name ? decodeURIComponent(parts[1]) : r;
  }, "");
};

// Initial state load fallback from cookies if localStorage gets cleared
const cookieAccess = getCookie("busgo_access_token");
const cookieRefresh = getCookie("busgo_refresh_token");

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: cookieAccess || null,
      refreshToken: cookieRefresh || null,
      isAuthenticated: !!cookieAccess,
      login: (user, accessToken, refreshToken) => {
        setCookie("busgo_access_token", accessToken, 30);
        setCookie("busgo_refresh_token", refreshToken, 30);
        set({ user, accessToken, refreshToken, isAuthenticated: true });
      },
      logout: () => {
        deleteCookie("busgo_access_token");
        deleteCookie("busgo_refresh_token");
        set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false });
        void signOutGoogle();
      },
      setTokens: (accessToken, refreshToken) => {
        setCookie("busgo_access_token", accessToken, 30);
        setCookie("busgo_refresh_token", refreshToken, 30);
        set({ accessToken, refreshToken });
      },
      updateUser: (user) =>
        set((state) => ({ user: state.user ? { ...state.user, ...user } : null })),
    }),
    {
      name: "busgo-auth",
    }
  )
);
