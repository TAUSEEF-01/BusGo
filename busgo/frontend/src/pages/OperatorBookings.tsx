import { useState, useEffect } from "react";
import { apiClient } from "../api/client";
import { useAuthStore } from "../stores/authStore";
import {
  Ticket, Search, Filter, ChevronDown, ChevronUp, X, Loader2,
  Calendar, MapPin, Clock, Users, Eye, ArrowRight
} from "lucide-react";
import { toast } from "react-hot-toast";

/* ─── Types ─────────────────────────────────────────── */
interface Booking {
  id: string;
  user_id: string;
  trip_id: string;
  operator_id: string;
  status: string;
  total_fare: number;
  discount_amount: number;
  seat_numbers: string[];
  passenger_details: { name: string; age: number; gender: string; seat: string }[] | null;
  boarding_point: string;
  dropping_point: string;
  journey_date: string;
  departure_time: string;
  expires_at: string;
  created_at: string;
}

interface SeatInfo {
  id: string;
  trip_id: string;
  seat_number: string;
  seat_type: string;
  status: string;
  locked_by_booking_id: string | null;
  booked_by_user_id: string | null;
}

/* ─── Seat Map Modal ────────────────────────────────── */
function SeatMapModal({
  tripId,
  tripLabel,
  onClose,
}: {
  tripId: string;
  tripLabel: string;
  onClose: () => void;
}) {
  const [seats, setSeats] = useState<SeatInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSeats = async () => {
      try {
        const res = await apiClient.get(`/api/inventory/inventory/trips/${tripId}/seats`);
        if (res.data.success) {
          setSeats(res.data.data);
        }
      } catch (err) {
        console.error("Failed to fetch seat data", err);
        toast.error("Failed to load seat map");
      } finally {
        setLoading(false);
      }
    };
    fetchSeats();
  }, [tripId]);

  // Group seats into rows (by first character)
  const seatsByRow: Record<string, SeatInfo[]> = {};
  seats.forEach((s) => {
    const row = s.seat_number.replace(/[0-9]/g, "");
    if (!seatsByRow[row]) seatsByRow[row] = [];
    seatsByRow[row].push(s);
  });

  // Sort rows alphabetically, and seats within rows numerically
  const sortedRows = Object.keys(seatsByRow).sort();
  sortedRows.forEach((row) => {
    seatsByRow[row].sort((a, b) => {
      const numA = parseInt(a.seat_number.replace(/\D/g, ""));
      const numB = parseInt(b.seat_number.replace(/\D/g, ""));
      return numA - numB;
    });
  });

  const totalSeats = seats.length;
  const bookedSeats = seats.filter((s) => s.status === "BOOKED").length;
  const lockedSeats = seats.filter((s) => s.status === "LOCKED").length;
  const availableSeats = seats.filter((s) => s.status === "AVAILABLE").length;

  return (
    <div className="fixed inset-0 z-50 bg-surface-900/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl w-full max-w-2xl overflow-hidden shadow-elevation-3 animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-surface-100 flex justify-between items-center bg-gradient-to-r from-brand-600 to-brand-700">
          <div>
            <h3 className="font-bold text-lg text-white">Seat Map</h3>
            <p className="text-brand-100 text-sm">{tripLabel}</p>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
          </div>
        ) : seats.length === 0 ? (
          <div className="p-8 text-center text-surface-500">No seat data available for this trip.</div>
        ) : (
          <div className="p-6">
            {/* Summary Stats */}
            <div className="grid grid-cols-4 gap-3 mb-6">
              <div className="text-center p-3 rounded-xl bg-surface-50 border border-surface-100">
                <p className="text-xl font-extrabold text-surface-900">{totalSeats}</p>
                <p className="text-[11px] font-semibold text-surface-500 uppercase tracking-wider">Total</p>
              </div>
              <div className="text-center p-3 rounded-xl bg-emerald-50 border border-emerald-100">
                <p className="text-xl font-extrabold text-emerald-700">{availableSeats}</p>
                <p className="text-[11px] font-semibold text-emerald-600 uppercase tracking-wider">Available</p>
              </div>
              <div className="text-center p-3 rounded-xl bg-red-50 border border-red-100">
                <p className="text-xl font-extrabold text-red-700">{bookedSeats}</p>
                <p className="text-[11px] font-semibold text-red-600 uppercase tracking-wider">Booked</p>
              </div>
              <div className="text-center p-3 rounded-xl bg-amber-50 border border-amber-100">
                <p className="text-xl font-extrabold text-amber-700">{lockedSeats}</p>
                <p className="text-[11px] font-semibold text-amber-600 uppercase tracking-wider">Locked</p>
              </div>
            </div>

            {/* Legend */}
            <div className="flex items-center gap-5 mb-4 text-xs font-semibold text-surface-600">
              <span className="flex items-center gap-1.5">
                <span className="w-4 h-4 rounded bg-emerald-100 border-2 border-emerald-400 inline-block"></span> Available
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-4 h-4 rounded bg-red-500 border-2 border-red-600 inline-block"></span> Booked
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-4 h-4 rounded bg-amber-400 border-2 border-amber-500 inline-block"></span> Locked
              </span>
            </div>

            {/* Seat Grid */}
            <div className="bg-surface-50 rounded-xl p-4 border border-surface-100 max-h-[400px] overflow-y-auto">
              <div className="flex flex-col gap-2">
                {sortedRows.map((row) => (
                  <div key={row} className="flex items-center gap-2">
                    <span className="w-6 text-xs font-bold text-surface-400 text-center">{row}</span>
                    <div className="flex gap-2 flex-wrap">
                      {seatsByRow[row].map((seat) => {
                        const isBooked = seat.status === "BOOKED";
                        const isLocked = seat.status === "LOCKED";
                        return (
                          <div
                            key={seat.id}
                            className={`
                              w-11 h-11 rounded-lg flex items-center justify-center text-xs font-bold
                              transition-all duration-200 cursor-default border-2
                              ${isBooked
                                ? "bg-red-500 border-red-600 text-white shadow-sm"
                                : isLocked
                                ? "bg-amber-400 border-amber-500 text-amber-900 shadow-sm"
                                : "bg-emerald-100 border-emerald-400 text-emerald-700 hover:bg-emerald-200"
                              }
                            `}
                            title={`${seat.seat_number} - ${seat.status}${seat.seat_type ? ` (${seat.seat_type})` : ""}`}
                          >
                            {seat.seat_number}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Main Bookings Page ────────────────────────────── */
export function OperatorBookings() {
  const user = useAuthStore((s) => s.user);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [seatMapTrip, setSeatMapTrip] = useState<{ tripId: string; label: string } | null>(null);

  useEffect(() => {
    const fetchBookings = async () => {
      try {
        if (user?.id) {
          const res = await apiClient.get(`/api/bookings/operator/${user.id}?limit=100`);
          if (res.data.success) {
            setBookings(res.data.data);
          }
        }
      } catch (err) {
        console.error("Failed to fetch bookings", err);
        toast.error("Failed to load bookings");
      } finally {
        setLoading(false);
      }
    };
    fetchBookings();
  }, [user]);

  // Filtered bookings
  const filtered = bookings.filter((b) => {
    const matchesStatus = statusFilter === "ALL" || b.status === statusFilter;
    const matchesSearch =
      !searchTerm ||
      b.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.boarding_point.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.dropping_point.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.seat_numbers.some((s) => s.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (b.passenger_details || []).some((p) => p.name.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesStatus && matchesSearch;
  });

  const statusOptions = ["ALL", "SEAT_LOCKED", "CONFIRMED", "COMPLETED", "CANCELLED", "EXPIRED", "REFUNDED"];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "CONFIRMED":
      case "COMPLETED":
        return "badge-success";
      case "CANCELLED":
      case "EXPIRED":
      case "REFUNDED":
        return "badge-error";
      case "SEAT_LOCKED":
        return "badge-warning";
      default:
        return "badge-info";
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-surface-900">All Bookings</h2>
          <p className="text-sm text-surface-500 mt-0.5">{bookings.length} total bookings</p>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="card-premium p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-400" />
            <input
              type="text"
              placeholder="Search by ticket ID, passenger, route, seat..."
              className="input-premium w-full pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              id="booking-search"
            />
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-400" />
            <select
              className="input-premium pl-10 pr-8 appearance-none"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              id="booking-status-filter"
            >
              {statusOptions.map((s) => (
                <option key={s} value={s}>
                  {s === "ALL" ? "All Status" : s.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Bookings Table */}
      <div className="card-premium overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-surface-50 text-left">
                <th className="px-5 py-3 text-xs font-bold text-surface-500 uppercase tracking-wider">Ticket ID</th>
                <th className="px-5 py-3 text-xs font-bold text-surface-500 uppercase tracking-wider">Passenger</th>
                <th className="px-5 py-3 text-xs font-bold text-surface-500 uppercase tracking-wider">Route</th>
                <th className="px-5 py-3 text-xs font-bold text-surface-500 uppercase tracking-wider">Date & Time</th>
                <th className="px-5 py-3 text-xs font-bold text-surface-500 uppercase tracking-wider">Seats</th>
                <th className="px-5 py-3 text-xs font-bold text-surface-500 uppercase tracking-wider">Amount</th>
                <th className="px-5 py-3 text-xs font-bold text-surface-500 uppercase tracking-wider">Status</th>
                <th className="px-5 py-3 text-xs font-bold text-surface-500 uppercase tracking-wider text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100">
              {filtered.length > 0 ? (
                filtered.map((b) => (
                  <BookingRow
                    key={b.id}
                    booking={b}
                    isExpanded={expandedId === b.id}
                    onToggle={() => setExpandedId(expandedId === b.id ? null : b.id)}
                    onViewSeats={() =>
                      setSeatMapTrip({
                        tripId: b.trip_id,
                        label: `${b.boarding_point} → ${b.dropping_point} | ${b.journey_date} at ${b.departure_time}`,
                      })
                    }
                    statusBadge={getStatusBadge(b.status)}
                  />
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <Ticket className="h-10 w-10 text-surface-300" />
                      <p className="text-surface-500 font-medium">No bookings found</p>
                      <p className="text-surface-400 text-sm">
                        {searchTerm || statusFilter !== "ALL"
                          ? "Try adjusting your search or filter"
                          : "Bookings will appear here when customers book trips"}
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Seat Map Modal */}
      {seatMapTrip && (
        <SeatMapModal
          tripId={seatMapTrip.tripId}
          tripLabel={seatMapTrip.label}
          onClose={() => setSeatMapTrip(null)}
        />
      )}
    </div>
  );
}

/* ─── Booking Row Component ─────────────────────────── */
function BookingRow({
  booking: b,
  isExpanded,
  onToggle,
  onViewSeats,
  statusBadge,
}: {
  booking: Booking;
  isExpanded: boolean;
  onToggle: () => void;
  onViewSeats: () => void;
  statusBadge: string;
}) {
  const passengerName = b.passenger_details?.[0]?.name || "N/A";
  const passengerCount = b.passenger_details?.length || b.seat_numbers.length;

  return (
    <>
      <tr className="hover:bg-surface-50/50 transition-colors group">
        <td className="px-5 py-3.5 text-sm font-mono font-semibold text-surface-900">
          {b.id.split("-")[0].toUpperCase()}
        </td>
        <td className="px-5 py-3.5">
          <div className="text-sm font-medium text-surface-800">{passengerName}</div>
          {passengerCount > 1 && (
            <span className="text-[10px] text-surface-400 font-medium">+{passengerCount - 1} more</span>
          )}
        </td>
        <td className="px-5 py-3.5">
          <div className="flex items-center gap-1 text-sm text-surface-600">
            <MapPin className="h-3 w-3 text-brand-500 flex-shrink-0" />
            <span>{b.boarding_point}</span>
            <ArrowRight className="h-3 w-3 text-surface-400 mx-0.5" />
            <span>{b.dropping_point}</span>
          </div>
        </td>
        <td className="px-5 py-3.5">
          <div className="text-sm text-surface-700 font-medium flex items-center gap-1">
            <Calendar className="h-3 w-3 text-surface-400" />
            {b.journey_date}
          </div>
          <div className="text-xs text-surface-400 flex items-center gap-1 mt-0.5">
            <Clock className="h-3 w-3" />
            {b.departure_time}
          </div>
        </td>
        <td className="px-5 py-3.5">
          <div className="flex flex-wrap gap-1">
            {b.seat_numbers.slice(0, 3).map((s) => (
              <span key={s} className="px-2 py-0.5 bg-brand-50 text-brand-700 rounded text-[11px] font-bold border border-brand-200">
                {s}
              </span>
            ))}
            {b.seat_numbers.length > 3 && (
              <span className="px-2 py-0.5 bg-surface-100 text-surface-500 rounded text-[11px] font-bold">
                +{b.seat_numbers.length - 3}
              </span>
            )}
          </div>
        </td>
        <td className="px-5 py-3.5 text-sm font-semibold text-surface-900">
          ৳ {b.total_fare}
        </td>
        <td className="px-5 py-3.5">
          <span className={`badge text-[10px] ${statusBadge}`}>{b.status}</span>
        </td>
        <td className="px-5 py-3.5">
          <div className="flex items-center justify-center gap-1">
            <button
              onClick={onViewSeats}
              className="p-2 text-surface-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors"
              title="View Seat Map"
              id={`view-seats-${b.id.split("-")[0]}`}
            >
              <Eye className="w-4 h-4" />
            </button>
            <button
              onClick={onToggle}
              className="p-2 text-surface-400 hover:text-surface-700 hover:bg-surface-100 rounded-lg transition-colors"
              title="Expand Details"
              id={`expand-${b.id.split("-")[0]}`}
            >
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </td>
      </tr>

      {/* Expanded Details Row */}
      {isExpanded && (
        <tr className="bg-surface-50/80">
          <td colSpan={8} className="px-5 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-in">
              {/* Passenger Details */}
              <div className="bg-white rounded-xl p-4 border border-surface-100">
                <h4 className="text-sm font-bold text-surface-700 flex items-center gap-2 mb-3">
                  <Users className="h-4 w-4 text-brand-500" />
                  Passenger Details
                </h4>
                {b.passenger_details && b.passenger_details.length > 0 ? (
                  <div className="space-y-2">
                    {b.passenger_details.map((p, i) => (
                      <div key={i} className="flex items-center justify-between text-sm py-1.5 border-b border-surface-50 last:border-0">
                        <div>
                          <span className="font-medium text-surface-800">{p.name}</span>
                          <span className="text-surface-400 ml-2 text-xs">({p.gender}, {p.age}y)</span>
                        </div>
                        <span className="px-2 py-0.5 bg-brand-50 text-brand-700 rounded text-[11px] font-bold border border-brand-200">
                          Seat {p.seat}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-surface-400">No passenger details available</p>
                )}
              </div>

              {/* Booking Meta */}
              <div className="bg-white rounded-xl p-4 border border-surface-100">
                <h4 className="text-sm font-bold text-surface-700 flex items-center gap-2 mb-3">
                  <Ticket className="h-4 w-4 text-brand-500" />
                  Booking Details
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-surface-500">Booking ID</span>
                    <span className="font-mono text-surface-800 text-xs">{b.id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-surface-500">Trip ID</span>
                    <span className="font-mono text-surface-800 text-xs">{b.trip_id.split("-")[0]}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-surface-500">Fare</span>
                    <span className="font-bold text-surface-900">৳ {b.total_fare}</span>
                  </div>
                  {b.discount_amount > 0 && (
                    <div className="flex justify-between">
                      <span className="text-surface-500">Discount</span>
                      <span className="font-bold text-emerald-600">-৳ {b.discount_amount}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-surface-500">Created</span>
                    <span className="text-surface-700">{new Date(b.created_at).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-surface-500">Expires</span>
                    <span className="text-surface-700">{new Date(b.expires_at).toLocaleString()}</span>
                  </div>
                </div>
                <button
                  onClick={onViewSeats}
                  className="mt-4 w-full btn-primary flex items-center justify-center gap-2 !py-2 !text-sm"
                >
                  <Eye className="w-4 h-4" />
                  View Seat Map for this Trip
                </button>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
