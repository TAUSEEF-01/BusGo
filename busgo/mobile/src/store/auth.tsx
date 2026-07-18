import React, { createContext, useContext, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { makeRedirectUri } from 'expo-auth-session';
import * as QueryParams from 'expo-auth-session/build/QueryParams';
import * as WebBrowser from 'expo-web-browser';
import { api, REFRESH_TOKEN_KEY, TOKEN_KEY, USER_KEY } from '../api/client';
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
        if (token && rawUser) setUser(JSON.parse(rawUser));
      } finally {
        setReady(true);
      }
    })();
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
    const redirectTo = makeRedirectUri({ scheme: 'busgo', path: 'auth/callback' });
    const { data, error } = await client.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo, skipBrowserRedirect: true },
    });
    if (error) throw error;
    if (!data.url) throw new Error('Google did not return a login URL.');

    const browserResult = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (browserResult.type !== 'success') throw new Error('Google login was cancelled.');

    const { params, errorCode } = QueryParams.getQueryParams(browserResult.url);
    if (errorCode) throw new Error(String(errorCode));
    const accessToken = typeof params.access_token === 'string' ? params.access_token : null;
    const supabaseRefreshToken = typeof params.refresh_token === 'string' ? params.refresh_token : null;
    if (!accessToken || !supabaseRefreshToken) throw new Error('Google returned an incomplete session.');

    const { data: sessionData, error: sessionError } = await client.auth.setSession({
      access_token: accessToken,
      refresh_token: supabaseRefreshToken,
    });
    if (sessionError) throw sessionError;

    const response = await api.post('/api/auth/google-login', {
      token: sessionData.session?.access_token || accessToken,
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

  return (
    <AuthContext.Provider value={{ user, ready, signInWithGoogle, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
