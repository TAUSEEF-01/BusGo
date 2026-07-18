import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { api } from '../api/client';
import { useAuth } from './auth';

/**
 * P1.8: one shared unread counter so the Alerts tab badge stays correct from
 * anywhere — after read-all, deletes, and app resume.
 */
interface NotificationsState {
  unread: number;
  setUnread: (value: number) => void;
  refresh: () => Promise<void>;
}

const NotificationsContext = createContext<NotificationsState>({ unread: 0, setUnread: () => {}, refresh: async () => {} });

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [unread, setUnread] = useState(0);

  const refresh = useCallback(async () => {
    if (!user) { setUnread(0); return; }
    try {
      const response = await api.get('/api/notifications/?per_page=100');
      const items = response.data?.notifications || [];
      setUnread(items.filter((item: any) => !item.is_read).length);
    } catch { /* badge is best-effort */ }
  }, [user]);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => { if (state === 'active') refresh(); });
    return () => subscription.remove();
  }, [refresh]);

  return <NotificationsContext.Provider value={{ unread, setUnread, refresh }}>{children}</NotificationsContext.Provider>;
}

export const useNotifications = () => useContext(NotificationsContext);
