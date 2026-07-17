import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, TOKEN_KEY, USER_KEY } from '../api/client';

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
  login: (phone: string, password: string) => Promise<void>;
  register: (fullName: string, phone: string, email: string, password: string) => Promise<void>;
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

  const login = async (phone: string, password: string) => {
    const res = await api.post('/api/auth/login', { phone, password });
    const token = res.data?.access_token;
    const u: User = res.data?.user;
    if (!token || !u) throw new Error('Unexpected login response');
    await AsyncStorage.setItem(TOKEN_KEY, token);
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(u));
    setUser(u);
  };

  const register = async (fullName: string, phone: string, email: string, password: string) => {
    await api.post('/api/auth/register', {
      full_name: fullName,
      phone,
      email,
      password,
    });
    // Accounts are auto-verified in dev; log straight in.
    await login(phone, password);
  };

  const logout = async () => {
    await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY]);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, ready, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
