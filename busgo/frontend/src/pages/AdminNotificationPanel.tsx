import { useState, useMemo, useEffect } from "react";
import {
  Bell, Send, Search, Users, Bus, CheckCircle, Square,
  CheckSquare, X, Loader2, AlertTriangle, Megaphone,
} from "lucide-react";
import { toast } from "react-hot-toast";
import { sendAdminBroadcast } from "../notifications/notificationApi";
import type { NotificationType } from "../notifications/notificationApi";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Person {
  id: string;
  full_name?: string;
  name?: string;
  email?: string;
  phone?: string;
  role: string;
}

interface NotifTypeOption {
  value: NotificationType;
  label: string;
  icon: string;
  targetRole: "CUSTOMER" | "OPERATOR";
}

// ─── Notification type options per target ─────────────────────────────────────

const USER_NOTIF_TYPES: NotifTypeOption[] = [
  { value: "ADMIN_BROADCAST",   label: "Platform Announcement", icon: "📣", targetRole: "CUSTOMER" },
  { value: "BUS_DELAYED",       label: "Bus Delayed Alert",     icon: "🚌", targetRole: "CUSTOMER" },
  { value: "SCHEDULE_CHANGED",  label: "Schedule Change",       icon: "📅", targetRole: "CUSTOMER" },
  { value: "SYSTEM_ALERT",      label: "System Alert",          icon: "⚠️", targetRole: "CUSTOMER" },
];

const OPERATOR_NOTIF_TYPES: NotifTypeOption[] = [
  { value: "ADMIN_BROADCAST",  label: "Platform Announcement",  icon: "📣", targetRole: "OPERATOR" },
  { value: "SYSTEM_ALERT",     label: "System Alert",           icon: "⚠️", targetRole: "OPERATOR" },
];

// ─── Component ───────────────────────────────────────────────────────────────

interface Props {
  allUsers: Person[];
}

export function AdminNotificationPanel({ allUsers }: Props) {
  // Target audience
  const [targetAudience, setTargetAudience] = useState<"users" | "operators">("users");
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Compose
  const [notifType, setNotifType] = useState<NotifTypeOption>(USER_NOTIF_TYPES[0]);
  const [title, setTitle] = useState(USER_NOTIF_TYPES[0].label);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  // Split users by role
  const customers = allUsers.filter(
    (u) => (u.role || "").toUpperCase() === "CUSTOMER"
  );
  const operatorUsers = allUsers.filter(
    (u) => (u.role || "").toUpperCase() === "OPERATOR"
  );

  // Reset selections when target audience changes
  const handleAudienceChange = (aud: "users" | "operators") => {
    setTargetAudience(aud);
    setSelectedIds(new Set());
    setSearch("");
    const types = aud === "users" ? USER_NOTIF_TYPES : OPERATOR_NOTIF_TYPES;
    setNotifType(types[0]);
    setTitle(types[0].label);
    setMessage("");
  };

  const currentList = targetAudience === "users" ? customers : operatorUsers;

  const filteredList = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return currentList;
    return currentList.filter((p) => {
      const name = (p.full_name || p.name || "").toLowerCase();
      const email = (p.email || "").toLowerCase();
      return name.includes(q) || email.includes(q);
    });
  }, [currentList, search]);

  const allSelected =
    filteredList.length > 0 &&
    filteredList.every((p) => selectedIds.has(p.id));

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        filteredList.forEach((p) => next.delete(p.id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        filteredList.forEach((p) => next.add(p.id));
        return next;
      });
    }
  };

  const toggle = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleTypeChange = (opt: NotifTypeOption) => {
    setNotifType(opt);
    setTitle(opt.label);
    setMessage("");
  };

  const handleSend = async () => {
    if (selectedIds.size === 0) {
      toast.error("Select at least one recipient");
      return;
    }
    if (!message.trim()) {
      toast.error("Please write a message");
      return;
    }
    if (!title.trim()) {
      toast.error("Please provide a title");
      return;
    }

    setSending(true);
    try {
      const result = await sendAdminBroadcast({
        user_ids: Array.from(selectedIds),
        target_role: targetAudience === "users" ? "CUSTOMER" : "OPERATOR",
        type: notifType.value,
        title,
        message,
        metadata: { broadcast: true },
      });
      toast.success(`Notification sent to ${result.sent_count} recipient${result.sent_count !== 1 ? "s" : ""}!`);
      setSelectedIds(new Set());
      setMessage("");
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Failed to send notification");
    } finally {
      setSending(false);
    }
  };

  const notifTypes = targetAudience === "users" ? USER_NOTIF_TYPES : OPERATOR_NOTIF_TYPES;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-extrabold text-surface-900 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center">
              <Megaphone className="w-5 h-5 text-white" />
            </div>
            Send Notifications
          </h2>
          <p className="text-sm text-surface-500 mt-1">
            Broadcast messages to users or operators on the platform.
          </p>
        </div>
      </div>

      {/* Target Audience Toggle */}
      <div className="flex items-center gap-2 p-1 bg-surface-100 rounded-xl w-fit">
        <button
          onClick={() => handleAudienceChange("users")}
          className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
            targetAudience === "users"
              ? "bg-white text-brand-700 shadow-sm"
              : "text-surface-500 hover:text-surface-700"
          }`}
        >
          <Users className="w-4 h-4" />
          Users
          <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${targetAudience === "users" ? "bg-brand-100 text-brand-700" : "bg-surface-200 text-surface-500"}`}>
            {customers.length}
          </span>
        </button>
        <button
          onClick={() => handleAudienceChange("operators")}
          className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
            targetAudience === "operators"
              ? "bg-white text-brand-700 shadow-sm"
              : "text-surface-500 hover:text-surface-700"
          }`}
        >
          <Bus className="w-4 h-4" />
          Operators
          <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${targetAudience === "operators" ? "bg-brand-100 text-brand-700" : "bg-surface-200 text-surface-500"}`}>
            {operatorUsers.length}
          </span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

        {/* ── LEFT: Recipient Selector ── */}
        <div className="lg:col-span-3">
          <div className="card-premium overflow-hidden">
            <div className="p-4 border-b border-surface-100 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                {targetAudience === "users"
                  ? <Users className="w-5 h-5 text-surface-500" />
                  : <Bus className="w-5 h-5 text-surface-500" />
                }
                <div>
                  <p className="text-sm font-bold text-surface-900">
                    {targetAudience === "users" ? "Users" : "Operators"}
                  </p>
                  <p className="text-xs text-surface-500">
                    {selectedIds.size} of {filteredList.length} selected
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {selectedIds.size > 0 && (
                  <button
                    onClick={() => setSelectedIds(new Set())}
                    className="text-xs text-surface-400 hover:text-surface-600 flex items-center gap-1"
                  >
                    <X className="w-3 h-3" /> Clear
                  </button>
                )}
                {filteredList.length > 0 && (
                  <button
                    onClick={toggleAll}
                    className="text-xs font-semibold text-brand-600 hover:text-brand-700 flex items-center gap-1.5"
                  >
                    {allSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                    {allSelected ? "Deselect all" : "Select all"}
                  </button>
                )}
              </div>
            </div>

            <div className="p-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={`Search ${targetAudience}…`}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-surface-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
            </div>

            <div className="max-h-96 overflow-y-auto divide-y divide-surface-50">
              {filteredList.length === 0 ? (
                <div className="py-12 text-center">
                  <Users className="w-10 h-10 text-surface-200 mx-auto mb-3" />
                  <p className="text-sm text-surface-400">
                    {currentList.length === 0 ? `No ${targetAudience} found` : "No matches"}
                  </p>
                </div>
              ) : (
                filteredList.map((p) => {
                  const checked = selectedIds.has(p.id);
                  const displayName = p.full_name || p.name || "Unknown";
                  return (
                    <button
                      key={p.id}
                      onClick={() => toggle(p.id)}
                      className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-50 transition-colors text-left ${checked ? "bg-brand-50/50" : ""}`}
                    >
                      <div className={`w-5 h-5 rounded flex-shrink-0 flex items-center justify-center border-2 transition-colors ${checked ? "bg-brand-600 border-brand-600" : "border-surface-300"}`}>
                        {checked && <CheckCircle className="w-3.5 h-3.5 text-white" />}
                      </div>
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                        {displayName.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-surface-800 truncate">{displayName}</p>
                        <p className="text-xs text-surface-500 truncate">{p.email || p.phone || ""}</p>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${
                        p.role === "ADMIN" ? "bg-red-100 text-red-700" :
                        p.role === "OPERATOR" || p.role === "operator" ? "bg-blue-100 text-blue-700" :
                        "bg-emerald-100 text-emerald-700"
                      }`}>
                        {(p.role || "").toUpperCase()}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* ── RIGHT: Compose ── */}
        <div className="lg:col-span-2 space-y-4">

          {/* Notification Type */}
          <div className="card-premium p-4 space-y-3">
            <p className="text-sm font-bold text-surface-900 flex items-center gap-2">
              <Bell className="w-4 h-4 text-brand-500" />
              Notification Type
            </p>
            <div className="space-y-2">
              {notifTypes.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => handleTypeChange(opt)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all ${
                    notifType.value === opt.value
                      ? "border-brand-500 bg-brand-50 text-brand-700"
                      : "border-surface-200 text-surface-600 hover:border-surface-300 hover:bg-surface-50"
                  }`}
                >
                  <span className="text-lg">{opt.icon}</span>
                  {opt.label}
                  {notifType.value === opt.value && (
                    <span className="ml-auto w-2 h-2 rounded-full bg-brand-500" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Compose */}
          <div className="card-premium p-4 space-y-3">
            <p className="text-sm font-bold text-surface-900">Compose</p>

            <div>
              <label className="block text-xs font-semibold text-surface-600 mb-1">Title</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full input-premium text-sm"
                placeholder="Notification title"
                maxLength={100}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-surface-600 mb-1">Message</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="w-full input-premium text-sm min-h-[120px] resize-none"
                placeholder={`Write your message to ${targetAudience}…`}
                maxLength={500}
              />
              <p className="text-right text-[10px] text-surface-400 mt-0.5">{message.length}/500</p>
            </div>

            {selectedIds.size === 0 && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200">
                <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                <p className="text-xs text-amber-700">Select at least one recipient.</p>
              </div>
            )}

            <button
              onClick={handleSend}
              disabled={sending || selectedIds.size === 0 || !message.trim() || !title.trim()}
              className="w-full btn-primary flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Sending…
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Send to {selectedIds.size} {targetAudience === "users" ? "user" : "operator"}{selectedIds.size !== 1 ? "s" : ""}
                </>
              )}
            </button>
          </div>

          <div className="p-4 rounded-xl bg-surface-50 border border-surface-200 text-xs text-surface-500 space-y-1">
            <p className="font-semibold text-surface-600">Admin Tips</p>
            <p>• Recipients see notifications in their bell icon instantly.</p>
            <p>• Use "Platform Announcement" for general platform news.</p>
            <p>• Use "System Alert" for critical issues requiring immediate attention.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
