import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { api } from '../api/client';
import { useAuth } from './auth';
import { navigationRef } from '../lib/navigationRef';
import type { NotificationItem } from '../types/api';

/**
 * One shared unread counter (Alerts tab badge) + phone-tray notifications:
 * whenever the app learns about a NEW unread alert, it surfaces it in the
 * system notification shade via expo-notifications. The app polls while in
 * the foreground and on resume, so alerts reach the tray without a push
 * backend. (True remote push with the app killed needs FCM device-token
 * registration in notification-service — a later phase.)
 */

const SEEN_KEY = 'busgo.notified-ids';
const POLL_MS = 30000;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

async function ensureNotificationSetup(): Promise<boolean> {
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('busgo-alerts', {
        name: 'BusGo alerts',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#dc2626',
      });
    }
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    if (!current.canAskAgain) return false;
    const requested = await Notifications.requestPermissionsAsync();
    return requested.granted;
  } catch {
    return false;
  }
}

interface NotificationsState {
  unread: number;
  setUnread: (value: number) => void;
  refresh: () => Promise<void>;
}

const NotificationsContext = createContext<NotificationsState>({ unread: 0, setUnread: () => {}, refresh: async () => {} });

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [unread, setUnread] = useState(0);
  const permissionReady = useRef<Promise<boolean> | null>(null);

  const surfaceNewAlerts = useCallback(async (items: NotificationItem[]) => {
    if (!permissionReady.current) permissionReady.current = ensureNotificationSetup();
    const allowed = await permissionReady.current;
    if (!allowed) return;
    let seen: string[] = [];
    try { seen = JSON.parse((await AsyncStorage.getItem(SEEN_KEY)) || '[]'); } catch { /* fresh start */ }
    const seenSet = new Set(seen);
    const fresh = items.filter((item) => !item.is_read && !seenSet.has(item.id));
    // First run on a device: remember the backlog without spamming the tray.
    const firstRun = seen.length === 0 && items.length > 0;
    if (!firstRun) {
      for (const item of fresh.slice(0, 5)) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: item.title || 'BusGo',
            body: item.message,
            data: { notificationId: item.id, ...(item.metadata || {}) },
            sound: true,
          },
          trigger: Platform.OS === 'android' ? { channelId: 'busgo-alerts' } : null,
        }).catch(() => {});
      }
    }
    if (fresh.length || firstRun) {
      const nextSeen = [...new Set([...items.map((item) => item.id), ...seen])].slice(0, 300);
      await AsyncStorage.setItem(SEEN_KEY, JSON.stringify(nextSeen)).catch(() => {});
    }
  }, []);

  const refresh = useCallback(async () => {
    if (!user) { setUnread(0); return; }
    try {
      const response = await api.get('/api/notifications/?per_page=100');
      const items: NotificationItem[] = response.data?.notifications || [];
      setUnread(items.filter((item) => !item.is_read).length);
      await surfaceNewAlerts(items);
    } catch { /* badge and tray are best-effort */ }
  }, [user, surfaceNewAlerts]);

  useEffect(() => { refresh(); }, [refresh]);

  // Poll while the app is in the foreground; refresh immediately on resume.
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(() => { if (AppState.currentState === 'active') refresh(); }, POLL_MS);
    const subscription = AppState.addEventListener('change', (state) => { if (state === 'active') refresh(); });
    return () => { clearInterval(interval); subscription.remove(); };
  }, [user, refresh]);

  // Tapping a tray notification opens the relevant screen.
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as Record<string, any>;
      if (!navigationRef.isReady()) return;
      const ticketId = data?.ticket_id || data?.ticketId;
      const bookingId = data?.booking_id || data?.bookingId;
      if (ticketId) navigationRef.navigate('TicketDetail', { ticketId: String(ticketId) });
      else if (bookingId) navigationRef.navigate('BookingDetail', { bookingId: String(bookingId), journeyId: data?.journey_id ? String(data.journey_id) : undefined });
      else (navigationRef as any).navigate('Tabs', { screen: 'Alerts' });
    });
    return () => subscription.remove();
  }, []);

  return <NotificationsContext.Provider value={{ unread, setUnread, refresh }}>{children}</NotificationsContext.Provider>;
}

export const useNotifications = () => useContext(NotificationsContext);
