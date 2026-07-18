import React, { createContext, useContext, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { makeRedirectUri } from 'expo-auth-session';
import * as QueryParams from 'expo-auth-session/build/QueryParams';
import * as WebBrowser from 'expo-web-browser';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { api, REFRESH_TOKEN_KEY, setUnauthorizedHandler, TOKEN_KEY, USER_KEY } from '../api/client';
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
  signInWithGoogle: () => Promise<void>;
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
          AsyncStorage.getItem(TOKEN_KEY),
          AsyncStorage.getItem(USER_KEY),
        ]);
        if (token && rawUser) {
          const cachedUser = JSON.parse(rawUser) as User;
          setUser(cachedUser);
          try {
            const response = await api.get('/api/auth/me');
            if (response.data) {
              await AsyncStorage.setItem(USER_KEY, JSON.stringify(response.data));
              setUser(response.data);
            }
          } catch (error: any) {
            if (error?.status === 401) setUser(null);
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
      : makeRedirectUri({ scheme: 'busgo', path: 'auth/callback', native: 'busgo://auth/callback' });
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

    const browserResult = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (__DEV__) console.info(`[BusGo Auth] Browser result: ${JSON.stringify(browserResult)}`);
    if (browserResult.type !== 'success') {
      if (isExpoGo) throw new Error(`Google could not return to Expo Go. Add exp://** to the Supabase redirect allow list, restart Expo, and try again. Callback: ${redirectTo}`);
      throw new Error('Google login was cancelled.');
    }

    const { params, errorCode } = QueryParams.getQueryParams(browserResult.url);
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
      role: 'CUSTOMER',
    });
    const payload = response.data;
    const busgoToken = payload?.access_token;
    const busgoRefreshToken = payload?.refresh_token;
    const nextUser: User = payload?.user;
    if (!busgoToken || !busgoRefreshToken || !nextUser) {
      throw new Error('BusGo returned an invalid Google login response.');
    }

    await AsyncStorage.multiSet([
      [TOKEN_KEY, busgoToken],
      [REFRESH_TOKEN_KEY, busgoRefreshToken],
      [USER_KEY, JSON.stringify(nextUser)],
    ]);
    setUser(nextUser);
  };

  const logout = async () => {
    const refreshToken = await AsyncStorage.getItem(REFRESH_TOKEN_KEY);
    if (refreshToken) {
      try {
        await api.post('/api/auth/logout', { refresh_token: refreshToken });
      } catch {
        // Local logout must still succeed if the server is unavailable.
      }
    }
    if (supabase) await supabase.auth.signOut();
    await AsyncStorage.multiRemove([TOKEN_KEY, REFRESH_TOKEN_KEY, USER_KEY]);
    setUser(null);
  };

  const updateProfile = async (fullName: string, phone: string) => {
    const response = await api.put('/api/auth/me', { full_name: fullName, phone: phone.trim() || null });
    const nextUser: User = response.data;
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(nextUser));
    setUser(nextUser);
  };

  return (
    <AuthContext.Provider value={{ user, ready, signInWithGoogle, updateProfile, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
