import { useState, useEffect, useMemo } from "react";
import { apiClient } from "../api/client";
import { useAuthStore } from "../stores/authStore";
import {
  Bell, Bus, Users, Send, ChevronDown, ChevronUp,
  CheckSquare, Square, Search, AlertTriangle, Calendar,
  MapPin, Clock, Loader2, RefreshCw, X, CheckCircle,
} from "lucide-react";
import { toast } from "react-hot-toast";
import { sendNotificationToUsers } from "../notifications/notificationApi";
import type { NotificationType } from "../notifications/notificationApi";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Trip {
  id: string;
  route_name?: string;
  origin_city?: string;
  destination_city?: string;
  departure_datetime?: string;
  journey_date?: string;
  departure_time?: string;
  status: string;
  bus_name?: string;
  bus_number?: string;
}

interface Booking {
  id: string;
  user_id: string;
  trip_id: string;
  status: string;
  boarding_point: string;
  dropping_point: string;
  journey_date: string;
  departure_time: string;
  seat_numbers: string[];
  passenger_details: { name: string; age: number; gender: string; seat: string }[] | null;
  total_fare: number;
}

interface UserInfo {
  id: string;
  full_name: string;
  email: string;
  phone: string;
}

interface NotifTypeOption {
  value: NotificationType;
  label: string;
  icon: string;
  color: string;
  defaultTitle: string;
  hasDelay: boolean;
}

const NOTIF_TYPES: NotifTypeOption[] = [
  {
    value: "BUS_DELAYED",
    label: "Bus Delayed",
    icon: "🚌",
    color: "bg-yellow-50 border-yellow-200 text-yellow-800",
    defaultTitle: "Bus Delayed",
    hasDelay: true,
  },
  {
    value: "SCHEDULE_CHANGED",
    label: "Schedule Changed",
    icon: "📅",
    color: "bg-amber-50 border-amber-200 text-amber-800",
    defaultTitle: "Schedule Update",
    hasDelay: false,
  },
  {
    value: "OPERATOR_TO_USER",
    label: "General Announcement",
    icon: "📢",
    color: "bg-blue-50 border-blue-200 text-blue-800",
    defaultTitle: "Important Notice",
    hasDelay: false,
  },
];

// ─── Component ───────────────────────────────────────────────────────────────

export function OperatorSendNotification() {
  const { user } = useAuthStore();

  // Data state
  const [trips, setTrips] = useState<Trip[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [userMap, setUserMap] = useState<Record<string, UserInfo>>({});
  const [loadingData, setLoadingData] = useState(true);

  // Selection state
  const [selectedTripId, setSelectedTripId] = useState<string>("all");
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [passengerSearch, setPassengerSearch] = useState("");
  const [tripSearch, setTripSearch] = useState("");

  // Compose state
  const [notifType, setNotifType] = useState<NotifTypeOption>(NOTIF_TYPES[0]);
  const [title, setTitle] = useState(NOTIF_TYPES[0].defaultTitle);
  const [message, setMessage] = useState("");
  const [delayMinutes, setDelayMinutes] = useState("30");
  const [sending, setSending] = useState(false);

  // UI
  const [tripListOpen, setTripListOpen] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!user?.id) return;
      setLoadingData(true);
      try {
        const [tripsRes, bookingsRes] = await Promise.all([
          apiClient.get(`/api/operators/trips/?operator_id=${user.id}`),
          apiClient.get(`/api/bookings/operator/${user.id}?limit=500`),
        ]);
        if (tripsRes.data.success) setTrips(tripsRes.data.data || []);
        const fetchedBookings: Booking[] = bookingsRes.data.success ? (bookingsRes.data.data || []) : [];
        setBookings(fetchedBookings);

        // Fetch account info (email, full_name) for all unique user_ids
        const uniqueIds = [...new Set(fetchedBookings.map((b) => b.user_id).filter(Boolean))];
        if (uniqueIds.length > 0) {
          try {
            const usersRes = await apiClient.post(`/api/auth/users/lookup`, { user_ids: uniqueIds });
            if (usersRes.data.success) {
              const map: Record<string, UserInfo> = {};
              for (const u of usersRes.data.data as UserInfo[]) map[u.id] = u;
              setUserMap(map);
            }
          } catch {
            // non-fatal — fall back to user_id display
          }
        }
      } catch (err) {
        toast.error("Failed to load trips and bookings");
      } finally {
        setLoadingData(false);
      }
    };
    load();
  }, [user?.id]);

  // Bookings for the selected trip
  const filteredBookings = useMemo(() => {
    const active = bookings.filter(
      (b) => b.status === "CONFIRMED" || b.status === "SEAT_LOCKED" || b.status === "COMPLETED"
    );
    if (selectedTripId === "all") return active;
    return active.filter((b) => b.trip_id === selectedTripId);
  }, [bookings, selectedTripId]);

  // Unique passengers (by user_id) in filtered bookings — exclude the operator's own account
  const passengers = useMemo(() => {
    const seen = new Map<string, { userId: string; email: string; seats: string[]; route: string; booking: Booking }>();
    for (const b of filteredBookings) {
      if (!b.user_id) continue;
      if (b.user_id === user?.id) continue; // skip operator's own bookings
      if (seen.has(b.user_id)) {
        seen.get(b.user_id)!.seats.push(...(b.seat_numbers || []));
      } else {
        const info = userMap[b.user_id];
        const email = info?.email || "";
        const route = `${b.boarding_point} → ${b.dropping_point}`;
        seen.set(b.user_id, { userId: b.user_id, email, seats: [...(b.seat_numbers || [])], route, booking: b });
      }
    }
    return Array.from(seen.values());
  }, [filteredBookings, userMap, user?.id]);

  const filteredPassengers = useMemo(() => {
    if (!passengerSearch.trim()) return passengers;
    const q = passengerSearch.toLowerCase();
    return passengers.filter(
      (p) => p.email.toLowerCase().includes(q) || p.userId.toLowerCase().includes(q) || p.route.toLowerCase().includes(q)
    );
  }, [passengers, passengerSearch]);

  // Group bookings by trip for "all trips" view
  const tripPassengerCount = useMemo(() => {
    const counts: Record<string, number> = {};
    const activeBookings = bookings.filter(
      (b) => b.status === "CONFIRMED" || b.status === "SEAT_LOCKED" || b.status === "COMPLETED"
    );
    for (const b of activeBookings) {
      counts[b.trip_id] = (counts[b.trip_id] || 0) + 1;
    }
    return counts;
  }, [bookings]);

  const filteredTrips = useMemo(() => {
    if (!tripSearch.trim()) return trips;
    const q = tripSearch.toLowerCase();
    return trips.filter((t) => {
      const label = getTripLabel(t).toLowerCase();
      return label.includes(q);
    });
  }, [trips, tripSearch]);

  function getTripLabel(t: Trip): string {
    const route = t.route_name || `${t.origin_city || "?"} → ${t.destination_city || "?"}`;
    const date = t.departure_datetime
      ? new Date(t.departure_datetime).toLocaleDateString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
      : t.journey_date || "";
    return `${route} · ${date}`;
  }

  const allSelected =
    filteredPassengers.length > 0 &&
    filteredPassengers.every((p) => selectedUserIds.has(p.userId));

  const toggleAll = () => {
    if (allSelected) {
      setSelectedUserIds((prev) => {
        const next = new Set(prev);
        filteredPassengers.forEach((p) => next.delete(p.userId));
        return next;
      });
    } else {
      setSelectedUserIds((prev) => {
        const next = new Set(prev);
        filteredPassengers.forEach((p) => next.add(p.userId));
        return next;
      });
    }
  };

  const toggleUser = (userId: string) => {
    setSelectedUserIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const selectTripPassengers = (tripId: string) => {
    const tripBookings = bookings.filter(
      (b) =>
        b.trip_id === tripId &&
        (b.status === "CONFIRMED" || b.status === "SEAT_LOCKED" || b.status === "COMPLETED")
    );
    setSelectedUserIds((prev) => {
      const next = new Set(prev);
      tripBookings.forEach((b) => { if (b.user_id) next.add(b.user_id); });
      return next;
    });
    setSelectedTripId(tripId);
    setTripListOpen(false);
  };

  const handleTypeChange = (opt: NotifTypeOption) => {
    setNotifType(opt);
    setTitle(opt.defaultTitle);
    if (opt.hasDelay) {
      setMessage(`Your bus is delayed by ${delayMinutes} minutes. We apologise for the inconvenience.`);
    } else {
      setMessage("");
    }
  };

  const buildMessage = () => {
    if (notifType.value === "BUS_DELAYED") {
      return message || `Your bus is delayed by ${delayMinutes} minutes. We apologise for the inconvenience.`;
    }
    return message;
  };

  const handleSend = async () => {
    if (selectedUserIds.size === 0) {
      toast.error("Select at least one passenger");
      return;
    }
    if (!buildMessage().trim()) {
      toast.error("Please write a message");
      return;
    }

    setSending(true);
    try {
      const metadata: Record<string, any> = { trip_id: selectedTripId !== "all" ? selectedTripId : undefined };
      if (notifType.value === "BUS_DELAYED") {
        metadata.delay_minutes = Number(delayMinutes) || 30;
      }

      const result = await sendNotificationToUsers({
        user_ids: Array.from(selectedUserIds),
        type: notifType.value,
        title,
        message: buildMessage(),
        metadata,
      });

      toast.success(`Notification sent to ${result.sent_count} passenger${result.sent_count !== 1 ? "s" : ""}!`);
      setSelectedUserIds(new Set());
      setMessage("");
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Failed to send notification");
    } finally {
      setSending(false);
    }
  };

  if (loadingData) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <Loader2 className="w-10 h-10 text-brand-500 animate-spin" />
        <p className="text-sm text-surface-500">Loading trips and passengers…</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto animate-fade-in space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-extrabold text-surface-900 tracking-tight flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center shadow-sm">
            <Bell className="w-5 h-5 text-white" />
          </div>
          Send Notification
        </h2>
        <p className="text-sm text-surface-500 mt-1">
          Notify passengers about delays, schedule changes, or general announcements.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

        {/* ── LEFT: Trip + Passenger Selector ── */}
        <div className="lg:col-span-3 space-y-4">

          {/* Trip Selector */}
          <div className="card-premium overflow-hidden">
            <button
              onClick={() => setTripListOpen((v) => !v)}
              className="w-full flex items-center justify-between p-4 hover:bg-surface-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Bus className="w-5 h-5 text-brand-600" />
                <div className="text-left">
                  <p className="text-sm font-bold text-surface-900">
                    {selectedTripId === "all"
                      ? "All Trips"
                      : getTripLabel(trips.find((t) => t.id === selectedTripId) || {} as Trip)}
                  </p>
                  <p className="text-xs text-surface-500">
                    {passengers.length} passenger{passengers.length !== 1 ? "s" : ""} eligible
                  </p>
                </div>
              </div>
              {tripListOpen ? <ChevronUp className="w-4 h-4 text-surface-400" /> : <ChevronDown className="w-4 h-4 text-surface-400" />}
            </button>

            {tripListOpen && (
              <div className="border-t border-surface-100">
                <div className="p-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
                    <input
                      value={tripSearch}
                      onChange={(e) => setTripSearch(e.target.value)}
                      placeholder="Search trips…"
                      className="w-full pl-9 pr-3 py-2 text-sm border border-surface-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                </div>
                <div className="max-h-56 overflow-y-auto divide-y divide-surface-50">
                  <button
                    onClick={() => { setSelectedTripId("all"); setTripListOpen(false); }}
                    className={`w-full flex items-center justify-between px-4 py-3 text-sm hover:bg-surface-50 transition-colors ${selectedTripId === "all" ? "bg-brand-50" : ""}`}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${selectedTripId === "all" ? "bg-brand-500" : "bg-surface-300"}`} />
                      <span className="font-medium text-surface-800">All Trips</span>
                    </div>
                    <span className="text-xs text-surface-500 font-semibold">
                      {passengers.length} passengers
                    </span>
                  </button>
                  {filteredTrips.map((t) => {
                    const count = tripPassengerCount[t.id] || 0;
                    const isActive = selectedTripId === t.id;
                    return (
                      <button
                        key={t.id}
                        onClick={() => selectTripPassengers(t.id)}
                        className={`w-full flex items-center justify-between px-4 py-3 text-sm hover:bg-surface-50 transition-colors ${isActive ? "bg-brand-50" : ""}`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isActive ? "bg-brand-500" : "bg-surface-300"}`} />
                          <div className="min-w-0 text-left">
                            <p className="text-sm font-semibold text-surface-800 truncate">
                              {t.route_name || `${t.origin_city || "?"} → ${t.destination_city || "?"}`}
                            </p>
                            <p className="text-xs text-surface-500 flex items-center gap-1 mt-0.5">
                              <Calendar className="w-3 h-3" />
                              {t.departure_datetime
                                ? new Date(t.departure_datetime).toLocaleDateString("en-GB", { day: "numeric", month: "short" })
                                : t.journey_date || ""}
                              {(t.departure_datetime || t.departure_time) && (
                                <>
                                  <Clock className="w-3 h-3 ml-1" />
                                  {t.departure_datetime
                                    ? new Date(t.departure_datetime).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
                                    : t.departure_time}
                                </>
                              )}
                            </p>
                          </div>
                        </div>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${count > 0 ? "bg-brand-100 text-brand-700" : "bg-surface-100 text-surface-500"}`}>
                          {count} pax
                        </span>
                      </button>
                    );
                  })}
                  {filteredTrips.length === 0 && (
                    <p className="px-4 py-6 text-sm text-center text-surface-400">No trips found</p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Passenger List */}
          <div className="card-premium overflow-hidden">
            <div className="p-4 border-b border-surface-100 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Users className="w-5 h-5 text-surface-500" />
                <div>
                  <p className="text-sm font-bold text-surface-900">Passengers</p>
                  <p className="text-xs text-surface-500">
                    {selectedUserIds.size} of {passengers.length} selected
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {selectedUserIds.size > 0 && (
                  <button
                    onClick={() => setSelectedUserIds(new Set())}
                    className="text-xs text-surface-500 hover:text-surface-700 flex items-center gap-1"
                  >
                    <X className="w-3 h-3" /> Clear
                  </button>
                )}
                {passengers.length > 0 && (
                  <button
                    onClick={toggleAll}
                    className="text-xs font-semibold text-brand-600 hover:text-brand-700 flex items-center gap-1"
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
                  value={passengerSearch}
                  onChange={(e) => setPassengerSearch(e.target.value)}
                  placeholder="Search passengers…"
                  className="w-full pl-9 pr-3 py-2 text-sm border border-surface-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
            </div>

            <div className="max-h-72 overflow-y-auto divide-y divide-surface-50">
              {filteredPassengers.length === 0 ? (
                <div className="px-4 py-10 text-center">
                  <Users className="w-10 h-10 text-surface-200 mx-auto mb-3" />
                  <p className="text-sm text-surface-400">
                    {passengers.length === 0
                      ? "No confirmed passengers on this trip"
                      : "No passengers match your search"}
                  </p>
                </div>
              ) : (
                filteredPassengers.map((p) => {
                  const checked = selectedUserIds.has(p.userId);
                  return (
                    <button
                      key={p.userId}
                      onClick={() => toggleUser(p.userId)}
                      className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-50 transition-colors text-left ${checked ? "bg-brand-50/50" : ""}`}
                    >
                      <div className={`w-5 h-5 rounded flex-shrink-0 flex items-center justify-center border-2 transition-colors ${checked ? "bg-brand-600 border-brand-600" : "border-surface-300"}`}>
                        {checked && <CheckCircle className="w-3.5 h-3.5 text-white" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-mono text-surface-500 truncate">
                          ID: {p.userId.split("-")[0]}…
                        </p>
                        <p className="text-sm font-semibold text-surface-800 truncate">
                          {p.email || <span className="italic text-surface-400">no email</span>}
                        </p>
                      </div>
                      {p.seats.length > 0 && (
                        <div className="flex gap-1 flex-shrink-0">
                          {p.seats.slice(0, 3).map((s) => (
                            <span key={s} className="px-1.5 py-0.5 bg-surface-100 text-surface-600 rounded text-[10px] font-bold">{s}</span>
                          ))}
                          {p.seats.length > 3 && (
                            <span className="px-1.5 py-0.5 bg-surface-100 text-surface-500 rounded text-[10px]">+{p.seats.length - 3}</span>
                          )}
                        </div>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* ── RIGHT: Compose Notification ── */}
        <div className="lg:col-span-2 space-y-4">

          {/* Notification Type */}
          <div className="card-premium p-4 space-y-3">
            <p className="text-sm font-bold text-surface-900 flex items-center gap-2">
              <Bell className="w-4 h-4 text-brand-500" />
              Notification Type
            </p>
            <div className="space-y-2">
              {NOTIF_TYPES.map((opt) => (
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
            <p className="text-sm font-bold text-surface-900">Compose Message</p>

            {notifType.value === "BUS_DELAYED" && (
              <div>
                <label className="block text-xs font-semibold text-surface-600 mb-1">
                  Delay Duration (minutes)
                </label>
                <div className="flex items-center gap-2">
                  {[15, 30, 45, 60].map((m) => (
                    <button
                      key={m}
                      onClick={() => {
                        setDelayMinutes(String(m));
                        setMessage(`Your bus is delayed by ${m} minutes. We apologise for the inconvenience.`);
                      }}
                      className={`flex-1 py-1.5 text-xs font-bold rounded-lg border transition-colors ${
                        delayMinutes === String(m)
                          ? "bg-yellow-500 text-white border-yellow-500"
                          : "border-surface-200 text-surface-600 hover:bg-surface-50"
                      }`}
                    >
                      {m}m
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  value={delayMinutes}
                  onChange={(e) => {
                    setDelayMinutes(e.target.value);
                    setMessage(`Your bus is delayed by ${e.target.value} minutes. We apologise for the inconvenience.`);
                  }}
                  min="1"
                  max="480"
                  className="mt-2 w-full input-premium text-sm"
                  placeholder="Custom minutes"
                />
              </div>
            )}

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
                className="w-full input-premium text-sm min-h-[100px] resize-none"
                placeholder="Write your message to passengers…"
                maxLength={500}
              />
              <p className="text-right text-[10px] text-surface-400 mt-0.5">{message.length}/500</p>
            </div>

            {/* Warning if nothing selected */}
            {selectedUserIds.size === 0 && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200">
                <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                <p className="text-xs text-amber-700">Select at least one passenger to send.</p>
              </div>
            )}

            <button
              onClick={handleSend}
              disabled={sending || selectedUserIds.size === 0 || !buildMessage().trim() || !title.trim()}
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
                  Send to {selectedUserIds.size || 0} passenger{selectedUserIds.size !== 1 ? "s" : ""}
                </>
              )}
            </button>
          </div>

          {/* Info card */}
          <div className="p-4 rounded-xl bg-surface-50 border border-surface-200 text-xs text-surface-500 space-y-1">
            <p className="font-semibold text-surface-600">Tips</p>
            <p>• Only confirmed/active passengers appear.</p>
            <p>• Passengers see notifications in their bell icon.</p>
            <p>• You can select a specific trip or notify all passengers.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
