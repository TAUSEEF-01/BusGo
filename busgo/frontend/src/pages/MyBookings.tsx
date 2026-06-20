import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Clock, MapPin, Bus, Calendar, ArrowRight, Search,
  Ticket, X, Eye, FileText, ChevronRight, Loader2
} from "lucide-react";
import { apiClient } from "../api/client";

type BookingStatus = "upcoming" | "completed" | "cancelled";
type Tab = "upcoming" | "completed" | "cancelled";

interface Booking {
  id: string;
  operator: string;
  from: string;
  to: string;
  origin_city: string;
  destination_city: string;
  date: string;
  departure: string;
  arrival: string;
  seats: string[];
  total: string;
  status: BookingStatus;
  ticketId: string;
}

const TAB_CONFIG: { id: Tab; label: string; icon: typeof Ticket; emptyTitle: string; emptyDesc: string }[] = [
  { id: "upcoming", label: "Upcoming", icon: Clock, emptyTitle: "No upcoming trips", emptyDesc: "Book your next adventure and it'll appear here." },
  { id: "completed", label: "Completed", icon: Ticket, emptyTitle: "No completed trips", emptyDesc: "Your travel history will show up here." },
  { id: "cancelled", label: "Cancelled", icon: X, emptyTitle: "No cancelled bookings", emptyDesc: "Cancelled bookings will be listed here." },
];

const STATUS_STYLES: Record<BookingStatus, string> = {
  upcoming: "badge-info",
  completed: "badge-success",
  cancelled: "badge-error",
};

const getOperatorLogo = (name: string) => {
  const normalized = name.toLowerCase();
  if (normalized.includes("greenline") || normalized.includes("green line")) {
    return {
      text: "GP",
      bgClass: "bg-surface-900 text-white font-bold text-sm",
    };
  }
  if (normalized.includes("shohagh")) {
    return {
      text: "S",
      bgClass: "bg-red-600 text-white font-black font-serif text-sm",
    };
  }
  if (normalized.includes("hanif")) {
    return {
      text: "HF",
      bgClass: "bg-amber-950 text-amber-400 font-extrabold border border-amber-500/20 text-xs",
    };
  }
  // Default fallback
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
  return {
    text: initials || "B",
    bgClass: "bg-gradient-to-br from-brand-600 to-brand-800 text-white text-xs",
  };
};

const formatTimeString = (timeStr: string) => {
  if (!timeStr || timeStr === "N/A") return "N/A";
  try {
    if (timeStr.includes("AM") || timeStr.includes("PM")) {
      return timeStr;
    }
    const parts = timeStr.split(":");
    let hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12;
    hours = hours ? hours : 12;
    const strMinutes = minutes < 10 ? "0" + minutes : minutes;
    const strHours = hours < 10 ? "0" + hours : hours;
    return `${strHours}:${strMinutes} ${ampm}`;
  } catch (e) {
    return timeStr;
  }
};

const formatDateString = (dateStr: string) => {
  if (!dateStr || dateStr === "N/A") return "N/A";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
};

export function MyBookings() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>("upcoming");
  const [searchQuery, setSearchQuery] = useState("");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSeatBooking, setActiveSeatBooking] = useState<Booking | null>(null);

  useEffect(() => {
    const fetchBookings = async () => {
      try {
        const response = await apiClient.get('/api/bookings/my');
        if (response.data?.success) {
          const backendBookings = response.data.data;
          const mappedBookings: Booking[] = backendBookings.map((b: any) => {
            // Map the backend status to frontend tab status
            let mappedStatus: BookingStatus = "upcoming";
            if (b.status === "COMPLETED") mappedStatus = "completed";
            else if (b.status === "CANCELLED" || b.status === "REFUNDED") mappedStatus = "cancelled";
            else if (new Date(b.journey_date) < new Date() && b.status === "CONFIRMED") mappedStatus = "completed";
            else if (b.status === "CONFIRMED" || b.status === "INITIATED" || b.status === "SEAT_LOCKED") mappedStatus = "upcoming";

            // Simple arrival time mock since it's not in DB
            const arrTime = b.departure_time ? `${parseInt(b.departure_time.split(':')[0]) + 4}:00` : "1:30 PM";

            return {
              id: b.id,
              operator: b.operator_name || "Unknown Operator",
              from: b.boarding_point || "Dhaka",
              to: b.dropping_point || "Destination",
              origin_city: b.origin_city || "Dhaka",
              destination_city: b.destination_city || "Destination",
              date: b.journey_date || "N/A",
              departure: b.departure_time || "N/A",
              arrival: arrTime,
              seats: b.seat_numbers || [],
              total: `৳ ${b.total_fare}`,
              status: mappedStatus,
              ticketId: b.id.split('-')[0].toUpperCase()
            };
          });
          setBookings(mappedBookings);
        }
      } catch (error) {
        console.error("Failed to fetch bookings:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchBookings();
  }, []);

  const filtered = bookings
    .filter((b) => b.status === activeTab)
    .filter((b) => !searchQuery || b.operator.toLowerCase().includes(searchQuery.toLowerCase()) || b.ticketId.toLowerCase().includes(searchQuery.toLowerCase()));

  const activeConfig = TAB_CONFIG.find((t) => t.id === activeTab)!;

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-50" id="my-bookings-page">
      {/* Header */}
      <div className="bg-white border-b border-surface-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-0">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-surface-900 mb-1">My Bookings</h1>
          <p className="text-surface-500 mb-6">Manage your bus tickets and travel history</p>

          {/* Tabs */}
          <div className="flex gap-1 border-b border-surface-200 -mb-px">
            {TAB_CONFIG.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-all duration-300 ${
                  activeTab === tab.id
                    ? "border-brand-600 text-brand-600"
                    : "border-transparent text-surface-500 hover:text-surface-700 hover:border-surface-300"
                }`}
                id={`tab-${tab.id}`}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
                <span className={`ml-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                  activeTab === tab.id ? "bg-brand-100 text-brand-700" : "bg-surface-100 text-surface-500"
                }`}>
                  {bookings.filter((b) => b.status === tab.id).length}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-surface-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by operator or ticket ID..."
            className="input-premium !pl-10 max-w-md"
            id="booking-search"
          />
        </div>

        {/* Bookings */}
        {filtered.length > 0 ? (
          <div className="space-y-4">
            {filtered.map((booking, i) => {
              const logo = getOperatorLogo(booking.operator);
              const formattedDep = formatTimeString(booking.departure);
              const formattedArr = formatTimeString(booking.arrival);
              const formattedDate = formatDateString(booking.date);

              return (
                <div
                  key={booking.id}
                  className="card-premium p-0 overflow-hidden animate-fade-in-up relative"
                  style={{ animationDelay: `${i * 80}ms` }}
                  id={`booking-card-${booking.id}`}
                >
                  <div className="p-5 sm:p-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                      {/* Left Content: Operator & Route Info */}
                      <div className="flex-1">
                        {/* Operator Details Header */}
                        <div className="flex items-center justify-between md:justify-start gap-4 mb-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${logo.bgClass}`}>
                              {logo.text}
                            </div>
                            <div>
                              <h3 className="font-bold text-surface-900 text-sm sm:text-base">
                                {booking.operator}
                              </h3>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className={`badge ${STATUS_STYLES[booking.status]} text-[10px]`}>
                                  {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
                                </span>
                                <span className="text-xs text-surface-400 font-semibold">{booking.ticketId}</span>
                              </div>
                            </div>
                          </div>

                          {/* Clickable Seat badge on mobile/tablet */}
                          <div 
                            onClick={() => setActiveSeatBooking(booking)}
                            className="md:hidden flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-50 border border-brand-100 cursor-pointer hover:bg-brand-100 transition-colors"
                            title="Click to view visual seat map"
                          >
                            <Ticket className="h-3.5 w-3.5 text-brand-600" />
                            <span className="text-xs font-bold text-brand-700 font-mono">
                              {booking.seats.join(", ")}
                            </span>
                          </div>
                        </div>

                        {/* Route Timeline */}
                        <div className="flex items-center gap-4 sm:gap-8">
                          <div className="text-center min-w-[90px] sm:min-w-[120px]">
                            <p className="text-base sm:text-lg font-extrabold text-surface-900">{formattedDep}</p>
                            <p className="text-sm font-bold text-surface-800">{booking.origin_city}</p>
                            <p className="text-[11px] text-surface-500 font-medium leading-tight mt-0.5 line-clamp-1" title={booking.from}>
                              {booking.from}
                            </p>
                            <span className="text-[10px] text-brand-700 font-bold mt-1.5 bg-brand-50 px-1.5 py-0.5 rounded inline-block">
                              {formattedDate}
                            </span>
                          </div>

                          <div className="flex-1 flex flex-col items-center">
                            <span className="text-xs text-surface-400 mb-1 select-none font-medium">Trip Timeline</span>
                            <div className="w-full flex items-center gap-1">
                              <div className="w-2 h-2 rounded-full bg-brand-500" />
                              <div className="flex-1 h-px bg-surface-300 relative">
                                <Bus className="absolute left-1/2 -translate-x-1/2 -top-2 h-4 w-4 text-brand-500" />
                              </div>
                              <div className="w-2 h-2 rounded-full bg-brand-500" />
                            </div>
                          </div>

                          <div className="text-center min-w-[90px] sm:min-w-[120px]">
                            <p className="text-base sm:text-lg font-extrabold text-surface-900">{formattedArr}</p>
                            <p className="text-sm font-bold text-surface-800">{booking.destination_city}</p>
                            <p className="text-[11px] text-surface-500 font-medium leading-tight mt-0.5 line-clamp-1" title={booking.to}>
                              {booking.to}
                            </p>
                            <span className="text-[10px] py-0.5 mt-1.5 opacity-0 select-none block">placeholder</span>
                          </div>
                        </div>
                      </div>

                      {/* Mid Section: Seats display (Desktop/tablet view) */}
                      <div className="hidden md:flex flex-col items-center justify-center px-4 border-l border-surface-100 min-h-[80px]">
                        <span className="text-xs text-surface-400 font-semibold uppercase tracking-wider mb-2">Seats Booked</span>
                        <button
                          onClick={() => setActiveSeatBooking(booking)}
                          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-50 border border-brand-100 hover:bg-brand-100 transition-all group cursor-pointer"
                          title="Click to view visual seat map"
                        >
                          <Ticket className="h-4 w-4 text-brand-600 group-hover:scale-110 transition-transform" />
                          <span className="text-sm font-extrabold text-brand-700 font-mono border-b border-dashed border-brand-400 group-hover:border-brand-700">
                            {booking.seats.join(", ")}
                          </span>
                        </button>
                        <span className="text-[10px] text-surface-400 mt-1.5 font-semibold">
                          {booking.seats.length} {booking.seats.length === 1 ? "seat" : "seats"} • View Layout
                        </span>
                      </div>

                      {/* Right Section: Price & Actions */}
                      <div className="flex flex-row md:flex-col items-center md:items-end justify-between md:justify-center gap-3 md:min-w-[160px] border-t md:border-t-0 md:border-l border-surface-100 pt-4 md:pt-0 md:pl-6">
                        <div className="text-left md:text-right">
                          <p className="text-xl sm:text-2xl font-black text-brand-600">{booking.total}</p>
                          <p className="text-xs text-surface-400 font-bold uppercase tracking-wider">PAID</p>
                        </div>
                        
                        <div className="flex gap-2">
                          {booking.status === "upcoming" && (
                            <button
                              onClick={() => navigate(`/booking/cancel/${booking.id}`)}
                              className="bg-red-50 hover:bg-red-100 text-red-600 font-bold py-2 px-4 rounded-xl text-xs flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer shadow-sm"
                            >
                              <X className="h-3.5 w-3.5" /> Cancel
                            </button>
                          )}
                          <button
                            onClick={() => navigate(`/booking/confirmation/${booking.id}`)}
                            className="bg-brand-600 hover:bg-brand-700 active:scale-95 text-white font-bold py-2 px-4 rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-md shadow-brand/10 hover:shadow-brand/20 cursor-pointer"
                          >
                            <Eye className="h-3.5 w-3.5" /> View Ticket
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Empty State */
          <div className="text-center py-20 bg-white rounded-xl border border-surface-200 shadow-elevation-1">
            <div className="w-16 h-16 rounded-2xl bg-surface-100 flex items-center justify-center mx-auto mb-4 animate-bounce">
              <FileText className="h-8 w-8 text-surface-400" />
            </div>
            <h3 className="text-lg font-bold text-surface-900 mb-1">{activeConfig.emptyTitle}</h3>
            <p className="text-surface-500 text-sm mb-6">{activeConfig.emptyDesc}</p>
            <button onClick={() => navigate("/")} className="btn-primary inline-flex items-center gap-2 !py-2.5">
              <Search className="h-4 w-4" /> Book a Trip
            </button>
          </div>
        )}
      </div>

      {/* Visual Seat Map Modal */}
      {activeSeatBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-surface-950/40 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-sm bg-white rounded-2xl border border-surface-200 shadow-elevation-4 overflow-hidden animate-scale-in">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-surface-100 px-6 py-4 bg-surface-50">
              <div>
                <h3 className="font-extrabold text-surface-900 text-base">Seat Layout Map</h3>
                <p className="text-xs text-surface-500 font-medium">Ticket: {activeSeatBooking.ticketId} • {activeSeatBooking.operator}</p>
              </div>
              <button 
                onClick={() => setActiveSeatBooking(null)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-surface-400 hover:text-surface-700 hover:bg-surface-100 transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6">
              {/* Legend */}
              <div className="flex items-center justify-center gap-4 mb-6 p-2 bg-surface-50 rounded-xl">
                <div className="flex items-center gap-1.5">
                  <div className="w-4 h-4 rounded bg-surface-100 border border-surface-200" />
                  <span className="text-[10px] font-bold text-surface-500 uppercase">Other Seats</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-4 h-4 rounded bg-gradient-to-br from-emerald-500 to-emerald-600 border border-emerald-700 shadow-sm shadow-emerald-500/10" />
                  <span className="text-[10px] font-bold text-emerald-600 uppercase">Your Seats ({activeSeatBooking.seats.join(", ")})</span>
                </div>
              </div>

              {/* Bus Grid Layout */}
              <div className="max-w-[240px] mx-auto">
                {/* Front Notice & Steering Wheel / Driver Area */}
                <div className="flex items-center justify-between mb-3 px-2">
                  <span className="text-[10px] text-surface-400 font-bold uppercase tracking-wider">FRONT</span>
                  <div className="w-8 h-8 rounded-lg bg-surface-100 flex items-center justify-center border border-surface-200">
                    <Bus className="h-4 w-4 text-surface-400" />
                  </div>
                </div>

                {/* Seat Matrix */}
                <div className="border border-surface-200 rounded-xl p-3 bg-surface-50/50 space-y-1.5 shadow-inner">
                  {Array.from({ length: 10 }).map((_, row) => {
                    const rowLetter = String.fromCharCode(65 + row);
                    return (
                      <div key={row} className="flex items-center justify-center gap-1.5">
                        {/* Column 1 & 2 */}
                        <div className="flex gap-1.5">
                          {[1, 2].map((col) => {
                            const seatId = `${rowLetter}${col}`;
                            const isBookedByUser = activeSeatBooking.seats.includes(seatId);
                            return (
                              <div
                                key={seatId}
                                className={`w-8 h-8 rounded flex items-center justify-center text-[10px] font-bold select-none transition-all duration-300 ${
                                  isBookedByUser
                                    ? "bg-gradient-to-br from-emerald-500 to-emerald-600 border border-emerald-700 text-white shadow-sm shadow-emerald-500/20 scale-105"
                                    : "bg-surface-100 border border-surface-200 text-surface-400"
                                }`}
                                title={seatId}
                              >
                                {seatId}
                              </div>
                            );
                          })}
                        </div>

                        {/* Aisle */}
                        <div className="w-6" />

                        {/* Column 3 & 4 */}
                        <div className="flex gap-1.5">
                          {[3, 4].map((col) => {
                            const seatId = `${rowLetter}${col}`;
                            const isBookedByUser = activeSeatBooking.seats.includes(seatId);
                            return (
                              <div
                                key={seatId}
                                className={`w-8 h-8 rounded flex items-center justify-center text-[10px] font-bold select-none transition-all duration-300 ${
                                  isBookedByUser
                                    ? "bg-gradient-to-br from-emerald-500 to-emerald-600 border border-emerald-700 text-white shadow-sm shadow-emerald-500/20 scale-105"
                                    : "bg-surface-100 border border-surface-200 text-surface-400"
                                }`}
                                title={seatId}
                              >
                                {seatId}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Rear Notice */}
                <div className="text-center mt-2.5">
                  <span className="text-[10px] text-surface-400 font-bold uppercase tracking-wider">REAR</span>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="border-t border-surface-100 px-6 py-4 bg-surface-50 flex justify-end">
              <button
                onClick={() => setActiveSeatBooking(null)}
                className="bg-brand-600 hover:bg-brand-700 active:scale-95 text-white font-bold py-2 px-5 rounded-lg text-xs transition-all shadow-md shadow-brand/10 hover:shadow-brand/20 cursor-pointer"
              >
                Close Map
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
