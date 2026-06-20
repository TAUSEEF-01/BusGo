/**
 * notifications/NotificationsPage.tsx
 * ─────────────────────────────────────
 * Full-page notification centre accessible via /notifications.
 *
 * Features:
 * • Role-aware tabs  — Customer / Operator / Admin see different categories
 * • Filter: All | Unread | by type category
 * • Mark all read, clear all, per-notification delete
 * • Infinite-scroll-style "Load more" pagination
 * • Beautiful empty state with onboarding tip per role
 */

import { useEffect, useState, useMemo } from "react";
import {
  Bell,
  CheckCheck,
  Trash2,
  RefreshCw,
  Filter,
  ChevronDown,
  Package,
  TrendingUp,
  Shield,
  Bus,
} from "lucide-react";
import { useNotificationStore } from "./notificationStore";
import { NotificationCard } from "./NotificationCard";
import {
  Notification,
  NotificationType,
  getNotificationPriority,
  getNotificationSummary,
} from "./notificationApi";
import { useAuthStore } from "../stores/authStore";

// ─── Tab definitions per role ─────────────────────────────────────────────────

type Tab = { id: string; label: string; icon: React.FC<any>; types: NotificationType[] | "all" | "unread" };

const CUSTOMER_TABS: Tab[] = [
  { id: "all",       label: "All",             icon: Bell,      types: "all" },
  { id: "unread",    label: "Unread",          icon: Bell,      types: "unread" },
  { id: "bookings",  label: "Bookings",        icon: Package,   types: ["BOOKING_CONFIRMED", "BOOKING_CANCELLED", "TICKET_ISSUED"] },
  { id: "travel",    label: "Travel Updates",  icon: Bus,       types: ["SCHEDULE_CHANGED", "BUS_DELAYED", "DEPARTURE_REMINDER", "OPERATOR_TO_USER"] },
  { id: "payments",  label: "Payments",        icon: TrendingUp,types: ["REFUND_INITIATED", "REFUND_COMPLETED"] },
  { id: "platform",  label: "Announcements",   icon: Shield,    types: ["ADMIN_BROADCAST"] },
];

const OPERATOR_TABS: Tab[] = [
  { id: "all",       label: "All",             icon: Bell,      types: "all" },
  { id: "unread",    label: "Unread",          icon: Bell,      types: "unread" },
  { id: "bookings",  label: "Bookings",        icon: Package,   types: ["NEW_BOOKING_ALERT", "BOOKING_CANCELLED"] },
  { id: "summaries", label: "Summaries",       icon: TrendingUp,types: ["DAILY_BOOKING_SUMMARY", "REVENUE_SUMMARY"] },
];

const ADMIN_TABS: Tab[] = [
  { id: "all",       label: "All",             icon: Bell,      types: "all" },
  { id: "unread",    label: "Unread",          icon: Bell,      types: "unread" },
  { id: "users",     label: "Users",           icon: Package,   types: ["NEW_OPERATOR_REGISTERED", "NEW_USER_REGISTERED"] },
  { id: "platform",  label: "Platform",        icon: TrendingUp,types: ["DAILY_PLATFORM_SUMMARY", "WEEKLY_REVENUE_REPORT"] },
  { id: "system",    label: "System",          icon: Shield,    types: ["SYSTEM_ALERT"] },
];

function getTabsForRole(role: string): Tab[] {
  if (role === "OPERATOR") return OPERATOR_TABS;
  if (role === "ADMIN")    return ADMIN_TABS;
  return CUSTOMER_TABS;
}

// ─── Empty state per role ─────────────────────────────────────────────────────

function EmptyState({ role, tabId }: { role: string; tabId: string }) {
  const tips: Record<string, string> = {
    CUSTOMER: "Book a bus ticket and your booking confirmation will appear here.",
    OPERATOR: "When customers book your buses, you'll see alerts here.",
    ADMIN:    "Platform activity and system events will appear here.",
  };
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-brand-100 to-brand-200 flex items-center justify-center mb-6 shadow-brand/20 shadow-lg">
        <Bell className="w-10 h-10 text-brand-500" />
      </div>
      <h3 className="text-lg font-bold text-surface-800 mb-2">
        {tabId === "unread" ? "No unread notifications" : "No notifications yet"}
      </h3>
      <p className="text-sm text-surface-500 max-w-xs leading-relaxed">
        {tabId === "unread"
          ? "You're all caught up! Check back later."
          : tips[role] ?? "Notifications will appear here as activity happens."}
      </p>
    </div>
  );
}

// ─── Main page component ──────────────────────────────────────────────────────

export function NotificationsPage({ embedded = false }: { embedded?: boolean } = {}) {
  const user = useAuthStore((s) => s.user);
  const role = user?.role?.toUpperCase() ?? "CUSTOMER";

  const tabs = getTabsForRole(role);
  const [activeTab, setActiveTab] = useState(tabs[0].id);
  const [filterOpen, setFilterOpen] = useState(false);

  const {
    notifications,
    unreadCount,
    stats,
    loading,
    total,
    currentPage,
    totalPages,
    fetchAll,
    markRead,
    markAllRead,
    remove,
    clearAll,
  } = useNotificationStore();

  // Initial load
  useEffect(() => {
    const isUnread = activeTab === "unread";
    fetchAll(1, isUnread);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // ── Filter notifications by the active tab's types ──────────────────────────
  const filtered = useMemo<Notification[]>(() => {
    const tab = tabs.find((t) => t.id === activeTab);
    if (!tab || tab.types === "all")    return notifications;
    if (tab.types === "unread")         return notifications.filter((n) => !n.is_read);
    return notifications.filter((n) => (tab.types as NotificationType[]).includes(n.type));
  }, [notifications, activeTab, tabs]);

  const handleLoadMore = () => {
    if (currentPage < totalPages) {
      fetchAll(currentPage + 1, activeTab === "unread");
    }
  };

  // ── Role badge styling ────────────────────────────────────────────────────
  const roleBadge: Record<string, string> = {
    CUSTOMER: "bg-emerald-100 text-emerald-700",
    OPERATOR: "bg-blue-100 text-blue-700",
    ADMIN:    "bg-red-100 text-red-700",
  };

  const breakdown = stats?.type_breakdown ?? {};
  const roleSignals = role === "OPERATOR"
    ? [
        { label: "Bookings", value: (breakdown.NEW_BOOKING_ALERT ?? 0) + (breakdown.BOOKING_CANCELLED ?? 0), hint: "booking flow" },
        { label: "Revenue", value: breakdown.REVENUE_SUMMARY ?? 0, hint: "earnings" },
        { label: "Summaries", value: breakdown.DAILY_BOOKING_SUMMARY ?? 0, hint: "daily digest" },
      ]
    : role === "ADMIN"
      ? [
          { label: "System alerts", value: breakdown.SYSTEM_ALERT ?? 0, hint: "critical issues" },
          { label: "Platform summaries", value: (breakdown.DAILY_PLATFORM_SUMMARY ?? 0) + (breakdown.WEEKLY_REVENUE_REPORT ?? 0), hint: "oversight" },
          { label: "User events", value: (breakdown.NEW_USER_REGISTERED ?? 0) + (breakdown.NEW_OPERATOR_REGISTERED ?? 0), hint: "account activity" },
        ]
      : [
          { label: "Trip alerts", value: (breakdown.BUS_DELAYED ?? 0) + (breakdown.SCHEDULE_CHANGED ?? 0) + (breakdown.DEPARTURE_REMINDER ?? 0) + (breakdown.OPERATOR_TO_USER ?? 0), hint: "timing changes" },
          { label: "Bookings", value: (breakdown.BOOKING_CONFIRMED ?? 0) + (breakdown.BOOKING_CANCELLED ?? 0) + (breakdown.TICKET_ISSUED ?? 0), hint: "ticket flow" },
          { label: "Payments", value: (breakdown.REFUND_INITIATED ?? 0) + (breakdown.REFUND_COMPLETED ?? 0), hint: "refunds" },
        ];

  const highPriorityCount = notifications.filter((n) => getNotificationPriority(n.type) === "critical" || getNotificationPriority(n.type) === "high").length;
  const recentImportant = notifications.find((n) => getNotificationPriority(n.type) === "critical" || getNotificationPriority(n.type) === "high");

  return (
    <div className={embedded ? "" : "min-h-screen bg-gradient-to-br from-surface-50 via-white to-brand-50/20"}>
      <div className={embedded ? "max-w-3xl mx-auto" : "max-w-3xl mx-auto px-4 sm:px-6 py-8"}>

        {/* ── Page header ──────────────────────────────────────────────────── */}
        <div className="mb-8">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center shadow-brand">
                  <Bell className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-extrabold text-surface-900 leading-tight">
                    Notifications
                  </h1>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded-full ${roleBadge[role] ?? "bg-surface-100 text-surface-600"}`}>
                      {role}
                    </span>
                    {unreadCount > 0 && (
                      <span className="text-xs text-surface-500">
                        {unreadCount} unread
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => fetchAll(1, activeTab === "unread")}
                className="flex items-center gap-1.5 px-3 py-2 text-sm text-surface-600 hover:text-surface-800 hover:bg-surface-100 rounded-lg transition-colors"
                title="Refresh"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                <span className="hidden sm:inline">Refresh</span>
              </button>

              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-brand-600 hover:bg-brand-50 border border-brand-200 rounded-lg transition-colors"
                >
                  <CheckCheck className="w-4 h-4" />
                  <span>Mark all read</span>
                </button>
              )}

              {notifications.length > 0 && (
                <button
                  onClick={clearAll}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 border border-red-200 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  <span className="hidden sm:inline">Clear all</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── Stats row ────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { label: "Total",  value: total,        color: "text-surface-700", bg: "bg-surface-100" },
            { label: "Unread", value: unreadCount,  color: "text-brand-700",   bg: "bg-brand-100"   },
            { label: "Read",   value: total - unreadCount, color: "text-emerald-700", bg: "bg-emerald-100" },
          ].map(({ label, value, color, bg }) => (
            <div key={label} className={`${bg} rounded-xl px-4 py-3 text-center`}>
              <p className={`text-xl font-extrabold ${color}`}>{value}</p>
              <p className="text-xs text-surface-500 font-medium mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* ── Live role snapshot ─────────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
          {roleSignals.map((signal) => (
            <div key={signal.label} className="rounded-2xl border border-surface-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-wider text-surface-500">{signal.label}</p>
              <div className="mt-2 flex items-end justify-between gap-3">
                <p className="text-2xl font-extrabold text-surface-900">{signal.value}</p>
                <p className="text-[11px] text-surface-500 text-right">{signal.hint}</p>
              </div>
            </div>
          ))}
        </div>

        {recentImportant && (
          <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50/80 p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-amber-700">Priority alert</p>
            <p className="mt-1 text-sm font-semibold text-surface-900">{recentImportant.title}</p>
            <p className="mt-1 text-sm text-surface-600">{getNotificationSummary(recentImportant) || recentImportant.message}</p>
          </div>
        )}

        {/* ── Tabs ─────────────────────────────────────────────────────────── */}
        <div className="flex gap-1 overflow-x-auto pb-1 mb-6 scrollbar-hide">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold
                  whitespace-nowrap transition-all duration-200 flex-shrink-0
                  ${isActive
                    ? "bg-brand-600 text-white shadow-brand/30 shadow-md"
                    : "bg-white text-surface-600 hover:bg-surface-100 border border-surface-200"
                  }
                `}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
                {tab.id === "unread" && unreadCount > 0 && (
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${isActive ? "bg-white/20 text-white" : "bg-brand-100 text-brand-700"}`}>
                    {unreadCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* ── Notification list ─────────────────────────────────────────────── */}
        {loading && filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-10 h-10 border-3 border-brand-500 border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-sm text-surface-500">Loading notifications…</p>
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState role={role} tabId={activeTab} />
        ) : (
          <div className="space-y-3">
            {filtered.map((n) => (
              <NotificationCard
                key={n.id}
                notification={n}
                onMarkRead={markRead}
                onDelete={remove}
                compact={false}
              />
            ))}

            {/* Load more */}
            {currentPage < totalPages && (
              <button
                onClick={handleLoadMore}
                disabled={loading}
                className="
                  w-full py-3 flex items-center justify-center gap-2
                  text-sm font-semibold text-brand-600
                  bg-white hover:bg-brand-50
                  border border-brand-200 rounded-xl
                  transition-all duration-200
                  disabled:opacity-60 disabled:cursor-not-allowed
                "
              >
                {loading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
                {loading ? "Loading…" : `Load more (${total - filtered.length} remaining)`}
              </button>
            )}
          </div>
        )}

        {/* ── Role-specific tip card ────────────────────────────────────────── */}
        {notifications.length > 0 && (
          <div className="mt-8 p-4 rounded-xl bg-gradient-to-r from-brand-50 to-blue-50 border border-brand-100">
            <p className="text-xs text-brand-700 font-medium">
              {role === "OPERATOR" && (
                <>📊 <strong>Operator tip:</strong> You receive daily summaries at 11 PM and weekly revenue reports every Sunday.</>
              )}
              {role === "ADMIN" && (
                <>🔐 <strong>Admin tip:</strong> System alerts and platform summaries are sent automatically. Check daily for new operator registrations.</>
              )}
              {role === "CUSTOMER" && (
                <>🚌 <strong>Tip:</strong> You'll be notified about any schedule changes or delays for your upcoming trips automatically.</>
              )}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
