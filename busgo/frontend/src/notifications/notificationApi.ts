/**
 * notifications/notificationApi.ts
 * ─────────────────────────────────
 * All API calls related to in-app notifications.
 * Uses the shared apiClient so auth headers are injected automatically.
 *
 * Base path: /api/notifications   (notification-service)
 */

import { apiClient } from "../api/client";

// ─── Types ───────────────────────────────────────────────────────────────────

export type NotificationRole = "CUSTOMER" | "OPERATOR" | "ADMIN";

export type NotificationType =
  // Customer
  | "BOOKING_CONFIRMED"
  | "BOOKING_CANCELLED"
  | "TICKET_ISSUED"
  | "DEPARTURE_REMINDER"
  | "SCHEDULE_CHANGED"
  | "BUS_DELAYED"
  | "REFUND_INITIATED"
  | "REFUND_COMPLETED"
  // Operator
  | "NEW_BOOKING_ALERT"
  | "DAILY_BOOKING_SUMMARY"
  | "REVENUE_SUMMARY"
  | "ROUTE_UPDATE_CONFIRMED"
  // Admin
  | "NEW_OPERATOR_REGISTERED"
  | "NEW_USER_REGISTERED"
  | "SYSTEM_ALERT"
  | "DAILY_PLATFORM_SUMMARY"
  | "WEEKLY_REVENUE_REPORT"
  | "USER_COMPLAINT"
  | "BOOKING_ANOMALY";

export interface Notification {
  id: string;
  user_id: string;
  role: NotificationRole;
  type: NotificationType;
  title: string;
  message: string;
  metadata: Record<string, any>;
  is_read: boolean;
  created_at: string;
  read_at: string | null;
}

export type NotificationPriority = "critical" | "high" | "medium" | "low";

export interface NotificationListResponse {
  notifications: Notification[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

export interface NotificationStats {
  total: number;
  unread_count: number;
  type_breakdown: Record<string, number>;
}

// ─── API calls ────────────────────────────────────────────────────────────────

const BASE = "/api/notifications";

/** Fetch paginated notifications for the current user. */
export async function fetchNotifications(
  page = 1,
  perPage = 20,
  unreadOnly = false
): Promise<NotificationListResponse> {
  const res = await apiClient.get(BASE, {
    params: { page, per_page: perPage, unread_only: unreadOnly },
  });
  return res.data.data as NotificationListResponse;
}

/** Fetch unread count and type breakdown. */
export async function fetchNotificationStats(): Promise<NotificationStats> {
  const res = await apiClient.get(`${BASE}/stats`);
  return res.data.data as NotificationStats;
}

/** Mark a single notification as read. */
export async function markNotificationRead(id: string): Promise<Notification> {
  const res = await apiClient.patch(`${BASE}/${id}/read`);
  return res.data.data as Notification;
}

/** Mark all notifications as read for the current user. */
export async function markAllNotificationsRead(): Promise<{ updated_count: number }> {
  const res = await apiClient.patch(`${BASE}/read-all`);
  return res.data.data;
}

/** Delete a single notification. */
export async function deleteNotification(id: string): Promise<void> {
  await apiClient.delete(`${BASE}/${id}`);
}

/** Delete all notifications for the current user. */
export async function clearAllNotifications(): Promise<{ deleted_count: number }> {
  const res = await apiClient.delete(`${BASE}/clear-all`);
  return res.data.data;
}

// ─── Metadata helpers (mirrors backend notification_types.py) ─────────────────

export interface NotificationMeta {
  label: string;
  icon: string;
  color: string;
  bg: string;
  border: string;
}

const ROLE_PRIORITY_MAP: Record<NotificationType, NotificationPriority> = {
  BOOKING_CONFIRMED: "medium",
  BOOKING_CANCELLED: "medium",
  TICKET_ISSUED: "medium",
  DEPARTURE_REMINDER: "high",
  SCHEDULE_CHANGED: "high",
  BUS_DELAYED: "critical",
  REFUND_INITIATED: "medium",
  REFUND_COMPLETED: "low",
  NEW_BOOKING_ALERT: "high",
  DAILY_BOOKING_SUMMARY: "low",
  REVENUE_SUMMARY: "low",
  ROUTE_UPDATE_CONFIRMED: "medium",
  NEW_OPERATOR_REGISTERED: "medium",
  NEW_USER_REGISTERED: "low",
  SYSTEM_ALERT: "critical",
  DAILY_PLATFORM_SUMMARY: "low",
  WEEKLY_REVENUE_REPORT: "low",
  USER_COMPLAINT: "high",
  BOOKING_ANOMALY: "critical",
};

export const NOTIFICATION_META: Record<NotificationType, NotificationMeta> = {
  // Customer
  BOOKING_CONFIRMED:    { label: "Booking Confirmed",    icon: "✅", color: "text-emerald-700", bg: "bg-emerald-50",  border: "border-emerald-200" },
  BOOKING_CANCELLED:    { label: "Booking Cancelled",    icon: "❌", color: "text-red-700",     bg: "bg-red-50",      border: "border-red-200"     },
  TICKET_ISSUED:        { label: "E-Ticket Issued",      icon: "🎫", color: "text-blue-700",    bg: "bg-blue-50",     border: "border-blue-200"    },
  DEPARTURE_REMINDER:   { label: "Departure Reminder",   icon: "⏰", color: "text-orange-700",  bg: "bg-orange-50",   border: "border-orange-200"  },
  SCHEDULE_CHANGED:     { label: "Schedule Updated",     icon: "📅", color: "text-amber-700",   bg: "bg-amber-50",    border: "border-amber-200"   },
  BUS_DELAYED:          { label: "Bus Delayed",          icon: "🚌", color: "text-yellow-700",  bg: "bg-yellow-50",   border: "border-yellow-200"  },
  REFUND_INITIATED:     { label: "Refund Initiated",     icon: "🔄", color: "text-teal-700",    bg: "bg-teal-50",     border: "border-teal-200"    },
  REFUND_COMPLETED:     { label: "Refund Completed",     icon: "💰", color: "text-emerald-700", bg: "bg-emerald-50",  border: "border-emerald-200" },

  // Operator
  NEW_BOOKING_ALERT:    { label: "New Booking",          icon: "📥", color: "text-blue-700",    bg: "bg-blue-50",     border: "border-blue-200"    },
  DAILY_BOOKING_SUMMARY:{ label: "Daily Summary",        icon: "📊", color: "text-indigo-700",  bg: "bg-indigo-50",   border: "border-indigo-200"  },
  REVENUE_SUMMARY:      { label: "Revenue Summary",      icon: "💹", color: "text-emerald-700", bg: "bg-emerald-50",  border: "border-emerald-200" },
  ROUTE_UPDATE_CONFIRMED:{ label: "Route Confirmed",     icon: "🗺️", color: "text-purple-700",  bg: "bg-purple-50",   border: "border-purple-200"  },

  // Admin
  NEW_OPERATOR_REGISTERED:{ label: "New Operator",       icon: "🏢", color: "text-brand-700",   bg: "bg-brand-50",    border: "border-brand-200"   },
  NEW_USER_REGISTERED:  { label: "New User",             icon: "👤", color: "text-brand-700",   bg: "bg-brand-50",    border: "border-brand-200"   },
  SYSTEM_ALERT:         { label: "System Alert",         icon: "⚠️", color: "text-red-700",     bg: "bg-red-50",      border: "border-red-200"     },
  DAILY_PLATFORM_SUMMARY:{ label: "Platform Summary",    icon: "📈", color: "text-indigo-700",  bg: "bg-indigo-50",   border: "border-indigo-200"  },
  WEEKLY_REVENUE_REPORT:{ label: "Revenue Report",       icon: "💰", color: "text-emerald-700", bg: "bg-emerald-50",  border: "border-emerald-200" },
  USER_COMPLAINT:       { label: "User Complaint",       icon: "📋", color: "text-red-700",     bg: "bg-red-50",      border: "border-red-200"     },
  BOOKING_ANOMALY:      { label: "Booking Anomaly",      icon: "⚡", color: "text-yellow-700",  bg: "bg-yellow-50",   border: "border-yellow-200"  },
};

export function getNotificationMeta(type: NotificationType): NotificationMeta {
  return (
    NOTIFICATION_META[type] ?? {
      label: type,
      icon: "🔔",
      color: "text-surface-700",
      bg: "bg-surface-50",
      border: "border-surface-200",
    }
  );
}

export function getNotificationPriority(type: NotificationType): NotificationPriority {
  return ROLE_PRIORITY_MAP[type] ?? "low";
}

function formatCurrency(value: unknown): string | null {
  const amount = typeof value === "string" ? Number(value) : typeof value === "number" ? value : NaN;
  if (!Number.isFinite(amount)) return null;
  return `৳ ${amount.toLocaleString("en-GB")}`;
}

function formatTime(value: unknown): string | null {
  if (typeof value !== "string" || !value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function getNotificationHighlights(notification: Notification): string[] {
  const metadata = notification.metadata ?? {};
  const highlights: string[] = [];

  const origin = metadata.origin || metadata.from;
  const destination = metadata.destination || metadata.dest || metadata.to;
  if (origin && destination) {
    highlights.push(`${origin} → ${destination}`);
  }

  const delayMinutes = metadata.delay_minutes ?? metadata.delayMinutes;
  if (typeof delayMinutes !== "undefined" && delayMinutes !== null) {
    highlights.push(`Delayed by ${delayMinutes} min`);
  }

  const boardingPoint = metadata.boarding_point || metadata.boardingPoint;
  if (boardingPoint) {
    highlights.push(`Boarding: ${boardingPoint}`);
  }

  const tripTime = metadata.new_departure_time || metadata.departure_time || metadata.time || metadata.trip_time;
  const formattedTime = formatTime(tripTime);
  if (formattedTime) {
    highlights.push(`Departs ${formattedTime}`);
  }

  const oldTime = metadata.old_departure_time;
  if (oldTime && formattedTime && oldTime !== tripTime) {
    highlights.push(`Rescheduled from ${formatTime(oldTime) ?? oldTime}`);
  }

  const seats = metadata.seats_booked ?? metadata.seats;
  if (typeof seats !== "undefined" && seats !== null) {
    highlights.push(`${seats} seat${Number(seats) === 1 ? "" : "s"}`);
  }

  const bookingId = metadata.booking_id || metadata.bookingId;
  if (bookingId) {
    highlights.push(`Booking ${bookingId}`);
  }

  const amount = formatCurrency(metadata.total_fare ?? metadata.amount ?? metadata.week_revenue ?? metadata.total_revenue);
  if (amount) {
    highlights.push(amount);
  }

  const totalBookings = metadata.total_bookings;
  if (typeof totalBookings !== "undefined" && totalBookings !== null) {
    highlights.push(`${totalBookings} bookings`);
  }

  const activeUsers = metadata.active_users;
  if (typeof activeUsers !== "undefined" && activeUsers !== null) {
    highlights.push(`${activeUsers} active users`);
  }

  const routeName = metadata.route_name || metadata.route || metadata.trip_name;
  if (routeName) {
    highlights.push(String(routeName));
  }

  return Array.from(new Set(highlights)).slice(0, 3);
}

export function getNotificationSummary(notification: Notification): string {
  return getNotificationHighlights(notification).join(" · ");
}

/** Human-readable relative time (e.g. "2 hours ago") */
export function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(mins / 60);
  const days  = Math.floor(hours / 24);
  if (mins < 1)   return "Just now";
  if (mins < 60)  return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7)   return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}
