import { useState, useEffect } from "react";
import { apiClient } from "../api/client";
import { useAuthStore } from "../stores/authStore";
import { toast } from "react-hot-toast";
import {
  Users, MapPin, Clock, Sparkles, Send, RefreshCw, TrendingUp,
  CheckCircle2, Circle, Ticket, Target,
} from "lucide-react";

interface Trip {
  id: string;
  origin_city: string;
  destination_city: string;
  departure_datetime: string;
  available_seats: number;
  status: string;
  operator_id: string;
}

interface Candidate {
  user_id: string;
  name: string;
  phone?: string;
  score: number;
  total_trips: number;
  trips_on_route: number;
  last_travelled: string | null;
  reasons: string[];
}

interface Occupancy {
  total?: number;
  booked?: number;
  locked?: number;
  available?: number;
}

export function FillEmptySeats() {
  const { user } = useAuthStore();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loadingTrips, setLoadingTrips] = useState(true);
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);

  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [occupancy, setOccupancy] = useState<Occupancy>({});
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [discount, setDiscount] = useState<number>(15);
  const [message, setMessage] = useState<string>("");
  const [sending, setSending] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // Load this operator's upcoming trips.
  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      setLoadingTrips(true);
      try {
        const res = await apiClient.get(`/api/operators/trips/?operator_id=${user.id}`);
        if (res.data.success) {
          const now = new Date();
          const upcoming = (res.data.data || [])
            .filter((t: Trip) => t.status === "SCHEDULED" && new Date(t.departure_datetime) > now)
            .sort((a: Trip, b: Trip) => +new Date(a.departure_datetime) - +new Date(b.departure_datetime));
          setTrips(upcoming);
        }
      } catch {
        toast.error("Could not load your trips");
      } finally {
        setLoadingTrips(false);
      }
    })();
  }, [user?.id]);

  const findInterested = async (trip: Trip) => {
    setSelectedTrip(trip);
    setCandidates([]);
    setSelected(new Set());
    setOccupancy({});
    setLoadingCandidates(true);
    try {
      const res = await apiClient.post(`/api/bookings/trips/${trip.id}/interested-passengers`, {
        origin: trip.origin_city,
        destination: trip.destination_city,
        operator_id: trip.operator_id || user?.id,
        limit: 30,
      });
      if (res.data.success) {
        setCandidates(res.data.data.candidates || []);
        setOccupancy(res.data.data.occupancy || {});
        // Pre-select everyone with a positive score.
        setSelected(new Set((res.data.data.candidates || []).map((c: Candidate) => c.user_id)));
      } else {
        toast.error(res.data.message || "No candidates found");
      }
    } catch (e: any) {
      toast.error(e.response?.data?.detail || "Failed to find interested passengers");
    } finally {
      setLoadingCandidates(false);
    }
  };

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const syncRecords = async () => {
    setSyncing(true);
    try {
      const res = await apiClient.post(`/api/bookings/travel-records/sync`, {});
      if (res.data.success) {
        toast.success(`Travel records synced (${res.data.data.total_records} total)`);
        if (selectedTrip) findInterested(selectedTrip);
      }
    } catch {
      toast.error("Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  const sendOffers = async () => {
    if (!selectedTrip) return;
    if (selected.size === 0) {
      toast.error("Select at least one passenger");
      return;
    }
    setSending(true);
    try {
      const res = await apiClient.post(`/api/bookings/trips/${selectedTrip.id}/notify-interested`, {
        user_ids: Array.from(selected),
        origin: selectedTrip.origin_city,
        destination: selectedTrip.destination_city,
        discount_pct: discount,
        message: message.trim() || undefined,
        journey_date: selectedTrip.departure_datetime,
      });
      if (res.data.success) {
        const code = res.data.data.promo_code;
        toast.success(
          `Offer sent to ${res.data.data.notified} passenger(s)${code ? ` — code ${code}` : ""}`,
          { duration: 6000 }
        );
      } else {
        toast.error(res.data.message || "Failed to send offers");
      }
    } catch (e: any) {
      toast.error(e.response?.data?.detail || "Failed to send offers");
    } finally {
      setSending(false);
    }
  };

  const emptySeats = occupancy.total != null ? (occupancy.total - (occupancy.booked || 0) - (occupancy.locked || 0)) : null;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-extrabold text-surface-900 flex items-center gap-2">
            <Target className="h-6 w-6 text-brand-600" /> Fill Empty Seats
          </h1>
          <p className="text-surface-500 text-sm mt-1 max-w-2xl">
            Find past travellers whose travel record matches an under-filled trip and send them a
            targeted discount offer to book.
          </p>
        </div>
        <button
          onClick={syncRecords}
          disabled={syncing}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-surface-200 text-sm font-semibold text-surface-700 hover:bg-surface-50 disabled:opacity-50"
          title="Rebuild travel records from confirmed bookings"
        >
          <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} /> Sync travel records
        </button>
      </div>

      <div className="grid lg:grid-cols-[340px_1fr] gap-6">
        {/* Trip list */}
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-surface-700 uppercase tracking-wide">Your upcoming trips</h2>
          {loadingTrips ? (
            <div className="flex justify-center py-10"><div className="w-6 h-6 border-2 border-brand-200 border-t-brand-600 rounded-full animate-spin" /></div>
          ) : trips.length === 0 ? (
            <p className="text-sm text-surface-500 py-6">No upcoming scheduled trips.</p>
          ) : (
            trips.map((t) => {
              const active = selectedTrip?.id === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => findInterested(t)}
                  className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                    active ? "border-brand-500 bg-brand-50" : "border-surface-200 bg-white hover:border-surface-300"
                  }`}
                >
                  <div className="flex items-center gap-2 font-bold text-surface-900">
                    <MapPin className="h-4 w-4 text-surface-400" />
                    {t.origin_city} → {t.destination_city}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-surface-500 mt-1.5">
                    <Clock className="h-3.5 w-3.5" />
                    {new Date(t.departure_datetime).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}
                  </div>
                  <div className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                    <Ticket className="h-3 w-3" /> {t.available_seats} seats capacity
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Candidates + offer */}
        <div>
          {!selectedTrip ? (
            <div className="flex flex-col items-center justify-center text-center py-20 border-2 border-dashed border-surface-200 rounded-2xl">
              <Users className="h-10 w-10 text-surface-300 mb-3" />
              <p className="text-surface-500 font-medium">Pick a trip to find interested passengers</p>
            </div>
          ) : (
            <>
              {/* Occupancy banner */}
              <div className="card-premium p-5 mb-4">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <p className="text-xs font-bold text-brand-600 uppercase tracking-wide">Selected trip</p>
                    <p className="font-extrabold text-surface-900 text-lg">
                      {selectedTrip.origin_city} → {selectedTrip.destination_city}
                    </p>
                  </div>
                  {emptySeats != null && (
                    <div className="text-right">
                      <p className="text-2xl font-extrabold text-amber-600">{emptySeats}</p>
                      <p className="text-xs text-surface-500">empty of {occupancy.total} seats</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Offer controls */}
              <div className="card-premium p-5 mb-4">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="h-4 w-4 text-brand-600" />
                  <h3 className="font-bold text-surface-900">Craft the offer</h3>
                </div>
                <div className="flex flex-wrap gap-4 items-end">
                  <div>
                    <label className="block text-xs font-semibold text-surface-600 mb-1">Discount %</label>
                    <input
                      type="number" min={0} max={90} value={discount}
                      onChange={(e) => setDiscount(Number(e.target.value))}
                      className="input-premium !w-28 !py-2"
                    />
                  </div>
                  <div className="flex-1 min-w-[220px]">
                    <label className="block text-xs font-semibold text-surface-600 mb-1">Message (optional)</label>
                    <input
                      type="text" value={message} placeholder="Leave blank for an auto-written message"
                      onChange={(e) => setMessage(e.target.value)}
                      className="input-premium !py-2"
                    />
                  </div>
                  <button
                    onClick={sendOffers}
                    disabled={sending || selected.size === 0}
                    className="btn-primary flex items-center gap-2 !py-2.5 disabled:opacity-50"
                  >
                    <Send className="h-4 w-4" />
                    {sending ? "Sending..." : `Send to ${selected.size}`}
                  </button>
                </div>
              </div>

              {/* Candidate list */}
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-bold text-surface-900 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-brand-600" /> Ranked interested passengers
                </h3>
                {candidates.length > 0 && (
                  <button
                    onClick={() => setSelected(selected.size === candidates.length ? new Set() : new Set(candidates.map((c) => c.user_id)))}
                    className="text-xs font-semibold text-brand-600 hover:text-brand-700"
                  >
                    {selected.size === candidates.length ? "Deselect all" : "Select all"}
                  </button>
                )}
              </div>

              {loadingCandidates ? (
                <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-brand-200 border-t-brand-600 rounded-full animate-spin" /></div>
              ) : candidates.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed border-surface-200 rounded-2xl">
                  <p className="text-surface-500 font-medium">No matching travellers yet.</p>
                  <p className="text-surface-400 text-sm mt-1">Try “Sync travel records”, or this route has no history.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {candidates.map((c) => {
                    const on = selected.has(c.user_id);
                    return (
                      <div
                        key={c.user_id}
                        onClick={() => toggle(c.user_id)}
                        className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                          on ? "border-brand-400 bg-brand-50/50" : "border-surface-200 bg-white hover:border-surface-300"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          {on ? <CheckCircle2 className="h-5 w-5 text-brand-600 flex-shrink-0 mt-0.5" /> : <Circle className="h-5 w-5 text-surface-300 flex-shrink-0 mt-0.5" />}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <p className="font-bold text-surface-900 truncate">
                                {c.name} {c.phone && <span className="text-surface-400 font-normal text-sm">· {c.phone}</span>}
                              </p>
                              <span className="flex items-center gap-1 text-xs font-bold text-brand-700 bg-brand-100 px-2 py-0.5 rounded-full flex-shrink-0">
                                <Target className="h-3 w-3" /> {c.score}
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-1.5 mt-1.5">
                              {c.reasons.map((r, i) => (
                                <span key={i} className="text-[11px] text-surface-600 bg-surface-100 px-2 py-0.5 rounded-full">{r}</span>
                              ))}
                            </div>
                            <p className="text-xs text-surface-400 mt-1.5">
                              {c.total_trips} past trip(s){c.last_travelled ? ` · last on ${new Date(c.last_travelled).toLocaleDateString()}` : ""}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
