/**
 * notifications/notificationStore.ts
 * ────────────────────────────────────
 * Zustand store for in-app notifications.
 *
 * • Polls every POLL_INTERVAL_MS (default 30 s) when the user is authenticated.
 * • Exposes: notifications[], unreadCount, loading, fetchAll, markRead,
 *            markAllRead, remove, clearAll, startPolling, stopPolling.
 */

import { create } from "zustand";
import {
  Notification,
  NotificationStats,
  fetchNotifications,
  fetchNotificationStats,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  clearAllNotifications,
} from "./notificationApi";

const POLL_INTERVAL_MS = 30_000; // 30 seconds

interface NotificationState {
  // Data
  notifications: Notification[];
  unreadCount: number;
  stats: NotificationStats | null;
  total: number;
  currentPage: number;
  totalPages: number;

  // UI state
  loading: boolean;
  error: string | null;
  lastFetched: Date | null;

  // Actions
  fetchAll: (page?: number, unreadOnly?: boolean) => Promise<void>;
  fetchStats: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  remove: (id: string) => Promise<void>;
  clearAll: () => Promise<void>;

  // Polling
  startPolling: () => void;
  stopPolling: () => void;
  _pollTimer: ReturnType<typeof setInterval> | null;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  // ── Initial state ──────────────────────────────────────────────────────────
  notifications: [],
  unreadCount: 0,
  stats: null,
  total: 0,
  currentPage: 1,
  totalPages: 1,
  loading: false,
  error: null,
  lastFetched: null,
  _pollTimer: null,

  // ── fetchAll ───────────────────────────────────────────────────────────────
  fetchAll: async (page = 1, unreadOnly = false) => {
    set({ loading: true, error: null });
    try {
      const [listRes, statsRes] = await Promise.all([
        fetchNotifications(page, 20, unreadOnly),
        fetchNotificationStats(),
      ]);
      const shouldAppend = page > 1;
      set({
        notifications: shouldAppend
          ? Array.from(
              new Map(
                [...get().notifications, ...listRes.notifications].map((n) => [n.id, n])
              ).values()
            )
          : listRes.notifications,
        total: listRes.total,
        currentPage: listRes.page,
        totalPages: listRes.total_pages,
        unreadCount: statsRes.unread_count,
        stats: statsRes,
        loading: false,
        lastFetched: new Date(),
      });
    } catch (err: any) {
      set({ loading: false, error: err?.message ?? "Failed to fetch notifications" });
    }
  },

  // ── fetchStats (lightweight — for the bell badge) ─────────────────────────
  fetchStats: async () => {
    try {
      const statsRes = await fetchNotificationStats();
      set({ unreadCount: statsRes.unread_count, stats: statsRes });
    } catch {
      // Silently fail — badge just won't update
    }
  },

  // ── markRead ──────────────────────────────────────────────────────────────
  markRead: async (id: string) => {
    try {
      const updated = await markNotificationRead(id);
      set((state) => ({
        notifications: state.notifications.map((n) =>
          n.id === id ? { ...n, is_read: true, read_at: updated.read_at } : n
        ),
        unreadCount: Math.max(0, state.unreadCount - 1),
      }));
    } catch (err: any) {
      set({ error: err?.message ?? "Failed to mark as read" });
    }
  },

  // ── markAllRead ────────────────────────────────────────────────────────────
  markAllRead: async () => {
    try {
      await markAllNotificationsRead();
      set((state) => ({
        notifications: state.notifications.map((n) => ({
          ...n,
          is_read: true,
          read_at: n.read_at ?? new Date().toISOString(),
        })),
        unreadCount: 0,
      }));
    } catch (err: any) {
      set({ error: err?.message ?? "Failed to mark all as read" });
    }
  },

  // ── remove ────────────────────────────────────────────────────────────────
  remove: async (id: string) => {
    const { notifications } = get();
    const target = notifications.find((n) => n.id === id);
    try {
      await deleteNotification(id);
      set((state) => ({
        notifications: state.notifications.filter((n) => n.id !== id),
        unreadCount: target && !target.is_read
          ? Math.max(0, state.unreadCount - 1)
          : state.unreadCount,
        total: Math.max(0, state.total - 1),
      }));
    } catch (err: any) {
      set({ error: err?.message ?? "Failed to delete notification" });
    }
  },

  // ── clearAll ──────────────────────────────────────────────────────────────
  clearAll: async () => {
    try {
      await clearAllNotifications();
      set({ notifications: [], unreadCount: 0, total: 0, totalPages: 1, currentPage: 1, stats: null });
    } catch (err: any) {
      set({ error: err?.message ?? "Failed to clear notifications" });
    }
  },

  // ── startPolling ──────────────────────────────────────────────────────────
  startPolling: () => {
    const existing = get()._pollTimer;
    if (existing) return; // already polling

    // Fetch immediately, then schedule
    get().fetchStats();

    const timer = setInterval(() => {
      get().fetchStats();
    }, POLL_INTERVAL_MS);

    set({ _pollTimer: timer });
  },

  // ── stopPolling ───────────────────────────────────────────────────────────
  stopPolling: () => {
    const timer = get()._pollTimer;
    if (timer) {
      clearInterval(timer);
      set({ _pollTimer: null });
    }
  },
}));
