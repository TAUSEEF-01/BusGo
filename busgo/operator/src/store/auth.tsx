import React, { createContext, useContext, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { makeRedirectUri } from 'expo-auth-session';
import * as QueryParams from 'expo-auth-session/build/QueryParams';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { api, setUnauthorizedHandler, USER_KEY } from '../api/client';
import { clearTokens, getAccessToken, getRefreshToken, setTokens } from '../lib/tokenStore';
import { requireSupabase, supabase } from '../lib/supabase';

WebBrowser.maybeCompleteAuthSession();

export interface User {
  id: string;
  full_name?: string;
  phone?: string;
  email?: string;
  role?: string;
}

interface AuthState {
  user: User | null;
  ready: boolean;
  signInWithGoogle: () => Promise<User>;
  updateProfile: (fullName: string, phone: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState>(null as any);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [token, rawUser] = await Promise.all([
          getAccessToken(),
          AsyncStorage.getItem(USER_KEY),
        ]);
        if (token && rawUser) {
          const cachedUser = JSON.parse(rawUser) as User;
          if (cachedUser.role !== 'OPERATOR' && cachedUser.role !== 'ADMIN') {
            await clearTokens();
          } else {
            setUser(cachedUser);
            try {
              const response = await api.get('/api/auth/me');
              const freshUser = response.data as User | undefined;
              if (freshUser && freshUser.role !== 'OPERATOR' && freshUser.role !== 'ADMIN') {
                // The account lost operator access since last launch.
                await clearTokens();
                setUser(null);
              } else if (freshUser) {
                await AsyncStorage.setItem(USER_KEY, JSON.stringify(freshUser));
                setUser(freshUser);
              }
            } catch (error: any) {
              if (error?.status === 401) setUser(null);
            }
          }
        }
      } finally {
        setReady(true);
      }
    })();
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => setUser(null));
    return () => setUnauthorizedHandler(null);
  }, []);

  useEffect(() => {
    const client = supabase;
    if (!client) return;
    if (AppState.currentState === 'active') client.auth.startAutoRefresh();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') client.auth.startAutoRefresh();
      else client.auth.stopAutoRefresh();
    });
    return () => {
      subscription.remove();
      client.auth.stopAutoRefresh();
    };
  }, []);

  const signInWithGoogle = async () => {
    const client = requireSupabase();
    const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
    const redirectTo = isExpoGo
      ? makeRedirectUri({ path: 'auth/callback' })
      : makeRedirectUri({ scheme: 'busgo-operator', path: 'auth/callback', native: 'busgo-operator://auth/callback' });
    if (__DEV__) console.info(`[BusGo Auth] OAuth callback: ${redirectTo}`);
    const { data, error } = await client.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo, skipBrowserRedirect: true },
    });
    if (error) {
      if (/provider.+not enabled|validation failed/i.test(error.message)) {
        throw new Error('Google sign-in is not enabled in the BusGo Supabase project.');
      }
      throw error;
    }
    if (!data.url) throw new Error('Google did not return a login URL.');
    if (__DEV__) console.info(`[BusGo Auth] OAuth URL: ${data.url}`);

    // On Android the auth browser can report "dismiss" even though the
    // redirect reached the app, so listen for the deep link as well.
    let deepLinkSubscription: { remove: () => void } | undefined;
    const deepLinkUrl = new Promise<string | null>((resolve) => {
      deepLinkSubscription = Linking.addEventListener('url', (event) => {
        if (event.url.startsWith(redirectTo)) resolve(event.url);
      });
    });

    let callbackUrl: string | null = null;
    try {
      const browserResult = await WebBrowser.openAuthSessionAsync(data.url, redirectTo, { showInRecents: true });
      if (__DEV__) console.info(`[BusGo Auth] Browser result: ${JSON.stringify(browserResult)}`);
      if (browserResult.type === 'success') {
        callbackUrl = browserResult.url;
      } else {
        // Some launchers (notably MIUI) deliver the deep link several seconds
        // after the auth browser reports "dismiss" — wait generously.
        callbackUrl = await Promise.race([
          deepLinkUrl,
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 8000)),
        ]);
        if (__DEV__) console.info(`[BusGo Auth] Deep link fallback: ${callbackUrl}`);
      }
    } finally {
      deepLinkSubscription?.remove();
    }

    if (!callbackUrl) {
      if (isExpoGo) throw new Error(`Google could not return to Expo Go. If the browser showed the BusGo website at the end, the Supabase redirect allow list is blocking exp:// URLs. If the browser simply closed, your phone may be blocking Expo Go from opening — on Xiaomi/MIUI enable "Display pop-up windows while running in the background" for Expo Go. Callback: ${redirectTo}`);
      throw new Error('Google login was cancelled.');
    }

    const { params, errorCode } = QueryParams.getQueryParams(callbackUrl);
    if (errorCode) throw new Error(String(errorCode));

    // PKCE (the supabase-js v2 default) returns ?code=...; the implicit flow
    // returns the tokens directly in the fragment. Support both.
    const code = typeof params.code === 'string' ? params.code : null;
    const accessToken = typeof params.access_token === 'string' ? params.access_token : null;
    const supabaseRefreshToken = typeof params.refresh_token === 'string' ? params.refresh_token : null;

    let sessionData;
    if (code) {
      const { data, error: exchangeError } = await client.auth.exchangeCodeForSession(code);
      if (exchangeError) throw exchangeError;
      sessionData = data;
    } else if (accessToken && supabaseRefreshToken) {
      const { data, error: sessionError } = await client.auth.setSession({
        access_token: accessToken,
        refresh_token: supabaseRefreshToken,
      });
      if (sessionError) throw sessionError;
      sessionData = data;
    } else {
      throw new Error('Google returned an incomplete session.');
    }

    const supabaseAccessToken = sessionData.session?.access_token || accessToken;
    if (!supabaseAccessToken) throw new Error('Google returned an incomplete session.');

    const response = await api.post('/api/auth/google-login', {
      token: supabaseAccessToken,
      role: 'OPERATOR',
    });
    const payload = response.data;
    const busgoToken = payload?.access_token;
    const busgoRefreshToken = payload?.refresh_token;
    const nextUser: User = payload?.user;
    if (!busgoToken || !busgoRefreshToken || !nextUser) {
      throw new Error('BusGo returned an invalid Google login response.');
    }
    // This app is exclusively for operators (admins may inspect too).
    if (nextUser.role !== 'OPERATOR' && nextUser.role !== 'ADMIN') {
      await client.auth.signOut().catch(() => {});
      throw new Error('This account is not an operator account. Use the BusGo passenger app instead, or register as an operator on the web portal.');
    }

    await setTokens(busgoToken, busgoRefreshToken);
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(nextUser));
    setUser(nextUser);
    return nextUser;
  };

  const logout = async () => {
    const refreshToken = await getRefreshToken();
    if (refreshToken) {
      try {
        await api.post('/api/auth/logout', { refresh_token: refreshToken });
      } catch {
        // Local logout must still succeed if the server is unavailable.
      }
    }
    if (supabase) await supabase.auth.signOut();
    await clearTokens();
    setUser(null);
  };

  const updateProfile = async (fullName: string, phone: string) => {
    const digits = phone.replace(/\D/g, '');
    const normalizedPhone = digits.startsWith('880') && digits.length === 13 ? `0${digits.slice(3)}` : digits;
    const response = await api.put<{ success: boolean; data: User; access_token?: string }>('/api/auth/me', { full_name: fullName, phone: normalizedPhone });
    const nextUser: User = response.data;
    if (response.access_token) await setTokens(response.access_token);
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(nextUser));
    setUser(nextUser);
    await api.get('/api/bank/accounts/my');
  };

  return (
    <AuthContext.Provider value={{ user, ready, signInWithGoogle, updateProfile, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
