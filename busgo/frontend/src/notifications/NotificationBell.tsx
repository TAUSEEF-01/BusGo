/**
 * notifications/NotificationBell.tsx
 * ─────────────────────────────────────
 * Bell icon with unread badge for the Navbar.
 * Clicking it opens a dropdown with the 5 most recent notifications.
 *
 * Usage (in MainLayout Navbar):
 *   import { NotificationBell } from "../notifications/NotificationBell";
 *   <NotificationBell scrolled={scrolled} isHome={isHome} />
 */

import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Bell, CheckCheck, ArrowRight } from "lucide-react";
import { useNotificationStore } from "./notificationStore";
import { NotificationCard } from "./NotificationCard";
import { useAuthStore } from "../stores/authStore";

/** Route to the notification hub appropriate for the current role. */
function notificationsPathForRole(role?: string): string {
  const r = role?.toUpperCase();
  if (r === "OPERATOR") return "/operator/notifications";
  if (r === "ADMIN") return "/admin#Notifications";
  return "/notifications";
}

interface NotificationBellProps {
  /** Whether the navbar has scrolled (affects color scheme) */
  scrolled: boolean;
  isHome: boolean;
}

export function NotificationBell({ scrolled, isHome }: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const role = useAuthStore((s) => s.user?.role);
  const viewAllPath = notificationsPathForRole(role);

  const {
    notifications,
    unreadCount,
    loading,
    fetchAll,
    markRead,
    markAllRead,
    startPolling,
    stopPolling,
  } = useNotificationStore();

  // Start polling when this component mounts (user is authenticated)
  useEffect(() => {
    startPolling();
    return () => stopPolling();
  }, [startPolling, stopPolling]);

  // Fetch full list when dropdown opens
  useEffect(() => {
    if (open) {
      fetchAll(1);
    }
  }, [open, fetchAll]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const isLight = scrolled || !isHome;
  const buttonColor = isLight
    ? "text-surface-700 hover:bg-surface-100"
    : "text-white hover:bg-white/10";

  const recentFive = notifications.slice(0, 5);

  return (
    <div ref={ref} className="relative">
      {/* ── Bell button ────────────────────────────────────────────────────── */}
      <button
        id="notification-bell-button"
        onClick={() => setOpen((v) => !v)}
        className={`relative p-2 rounded-xl transition-all duration-300 ${buttonColor}`}
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5" />

        {/* Unread badge */}
        {unreadCount > 0 && (
          <span
            className="
              absolute -top-0.5 -right-0.5
              min-w-[18px] h-[18px] px-1
              flex items-center justify-center
              text-[10px] font-bold text-white
              bg-red-500 rounded-full
              ring-2 ring-white
              animate-pulse
            "
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* ── Dropdown ───────────────────────────────────────────────────────── */}
      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />

          <div
            className="
              absolute right-0 mt-3 w-80 z-50
              bg-white rounded-2xl shadow-glass-lg
              border border-surface-200
              overflow-hidden
              animate-scale-in origin-top-right
            "
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-surface-100 bg-surface-50">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-brand-600" />
                <span className="text-sm font-bold text-surface-900">Notifications</span>
                {unreadCount > 0 && (
                  <span className="text-xs font-bold px-1.5 py-0.5 rounded-full bg-brand-100 text-brand-700">
                    {unreadCount} new
                  </span>
                )}
              </div>
              {unreadCount > 0 && (
                <button
                  onClick={(e) => { e.stopPropagation(); markAllRead(); }}
                  className="flex items-center gap-1 text-xs text-brand-600 hover:text-brand-800 font-medium transition-colors"
                  title="Mark all as read"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  All read
                </button>
              )}
            </div>

            {/* List */}
            <div className="max-h-[360px] overflow-y-auto">
              {loading && recentFive.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-surface-400">
                  <div className="w-6 h-6 border-2 border-brand-400 border-t-transparent rounded-full animate-spin mb-2" />
                  <p className="text-xs">Loading notifications…</p>
                </div>
              ) : recentFive.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-surface-400">
                  <Bell className="w-8 h-8 mb-2 opacity-30" />
                  <p className="text-sm font-medium">All caught up!</p>
                  <p className="text-xs mt-0.5">No notifications yet.</p>
                </div>
              ) : (
                recentFive.map((n) => (
                  <NotificationCard
                    key={n.id}
                    notification={n}
                    onMarkRead={markRead}
                    compact
                  />
                ))
              )}
            </div>

            {/* Footer */}
            <Link
              to={viewAllPath}
              onClick={() => setOpen(false)}
              className="
                flex items-center justify-center gap-1.5
                px-4 py-3
                text-sm font-semibold text-brand-600
                hover:bg-brand-50
                border-t border-surface-100
                transition-colors duration-200
              "
            >
              View all notifications
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
