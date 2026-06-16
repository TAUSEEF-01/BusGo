/**
 * notifications/NotificationCard.tsx
 * ────────────────────────────────────
 * Reusable card component for a single notification.
 * Used both in the bell dropdown and the full notifications page.
 */

import { Trash2, Eye } from "lucide-react";
import {
  Notification,
  getNotificationMeta,
  getNotificationHighlights,
  getNotificationPriority,
  getNotificationSummary,
  timeAgo,
} from "./notificationApi";

interface NotificationCardProps {
  notification: Notification;
  onMarkRead?: (id: string) => void;
  onDelete?: (id: string) => void;
  /** compact = used inside the bell dropdown (smaller, no delete button) */
  compact?: boolean;
}

export function NotificationCard({
  notification,
  onMarkRead,
  onDelete,
  compact = false,
}: NotificationCardProps) {
  const meta = getNotificationMeta(notification.type);
  const priority = getNotificationPriority(notification.type);
  const highlights = getNotificationHighlights(notification);
  const summary = getNotificationSummary(notification);
  const isUnread = !notification.is_read;

  const handleClick = () => {
    if (isUnread && onMarkRead) {
      onMarkRead(notification.id);
    }
  };

  if (compact) {
    return (
      <div
        onClick={handleClick}
        className={`
          flex items-start gap-3 px-4 py-3 cursor-pointer transition-all duration-200
          hover:bg-surface-50 border-b border-surface-100 last:border-0
          ${isUnread ? "bg-brand-50/40" : "bg-white"}
        `}
      >
        {/* Unread dot */}
        {isUnread && (
          <span className="mt-1.5 flex-shrink-0 w-2 h-2 rounded-full bg-brand-500" />
        )}

        {/* Icon badge */}
        <span
          className={`
            flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-base
            ${meta.bg} border ${meta.border}
            ${isUnread ? "" : "opacity-70"}
          `}
        >
          {meta.icon}
        </span>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <p className={`text-xs font-semibold truncate ${isUnread ? "text-surface-900" : "text-surface-600"}`}>
            {notification.title}
          </p>
          <p className="text-xs text-surface-500 mt-0.5 line-clamp-2 leading-relaxed">
            {summary || notification.message}
          </p>
          <p className="text-[10px] text-surface-400 mt-1">
            {timeAgo(notification.created_at)}
          </p>
        </div>
      </div>
    );
  }

  // ── Full card (used on /notifications page) ─────────────────────────────────
  return (
    <div
      className={`
        group relative flex items-start gap-4 p-4 rounded-xl border transition-all duration-200
        hover:shadow-md cursor-pointer
        ${isUnread
          ? "bg-brand-50/30 border-brand-200/60 shadow-sm"
          : "bg-white border-surface-200 hover:border-surface-300"
        }
      `}
      onClick={handleClick}
    >
      {/* Unread indicator bar */}
      {isUnread && (
        <div className="absolute left-0 top-3 bottom-3 w-0.5 rounded-r-full bg-brand-500" />
      )}

      {/* Icon */}
      <span
        className={`
          flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center text-xl
          ${meta.bg} border ${meta.border}
          ${isUnread ? "shadow-sm" : "opacity-75"}
        `}
      >
        {meta.icon}
      </span>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className={`text-sm font-semibold ${isUnread ? "text-surface-900" : "text-surface-700"}`}>
                {notification.title}
              </p>
              <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${meta.bg} ${meta.color} border ${meta.border}`}>
                {meta.label}
              </span>
              <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${
                priority === "critical"
                  ? "bg-red-100 text-red-700 border-red-200"
                  : priority === "high"
                    ? "bg-amber-100 text-amber-700 border-amber-200"
                    : priority === "medium"
                      ? "bg-surface-100 text-surface-700 border-surface-200"
                      : "bg-emerald-50 text-emerald-700 border-emerald-200"
              }`}>
                {priority}
              </span>
              {isUnread && (
                <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-brand-100 text-brand-700 border border-brand-200">
                  New
                </span>
              )}
            </div>
            <p className="text-sm text-surface-600 mt-1 leading-relaxed">
              {notification.message}
            </p>
            {highlights.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {highlights.map((item) => (
                  <span key={item} className="inline-flex items-center rounded-full border border-surface-200 bg-surface-50 px-2.5 py-1 text-[11px] font-medium text-surface-600">
                    {item}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            {isUnread && onMarkRead && (
              <button
                onClick={(e) => { e.stopPropagation(); onMarkRead(notification.id); }}
                className="p-1.5 rounded-lg hover:bg-brand-100 text-brand-600 transition-colors"
                title="Mark as read"
              >
                <Eye className="w-4 h-4" />
              </button>
            )}
            {onDelete && (
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(notification.id); }}
                className="p-1.5 rounded-lg hover:bg-red-100 text-red-500 transition-colors"
                title="Delete notification"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Footer: time */}
        <p className="text-xs text-surface-400 mt-2">
          {timeAgo(notification.created_at)}
          {notification.read_at && !isUnread && (
            <span className="ml-2 text-surface-300">· Read {timeAgo(notification.read_at)}</span>
          )}
        </p>
      </div>
    </div>
  );
}
