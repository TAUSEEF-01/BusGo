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

export function MyBookings() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>("upcoming");
  const [searchQuery, setSearchQuery] = useState("");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

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
              operator: b.operator_id === "84cd0cc6-ac4a-43f9-ade7-d982f7494077" ? "Greenline Paribahan" : "Hanif Enterprise",
              from: b.boarding_point || "Dhaka",
              to: b.dropping_point || "Destination",
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
            {filtered.map((booking, i) => (
              <div
                key={booking.id}
                className="card-premium p-0 overflow-hidden animate-fade-in-up"
                style={{ animationDelay: `${i * 80}ms` }}
                id={`booking-${booking.id}`}
              >
                <div className="p-5 sm:p-6">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="flex-1">
                      {/* Operator & Status */}
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-surface-800 to-surface-900 flex items-center justify-center text-white text-xs font-bold shadow-sm">
                          {booking.operator.split(" ").map((w) => w[0]).join("").slice(0,2)}
                        </div>
                        <div>
                          <h3 className="font-bold text-surface-900">{booking.operator}</h3>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className={`badge ${STATUS_STYLES[booking.status]} text-[10px]`}>
                              {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
                            </span>
                            <span className="text-xs text-surface-400">{booking.ticketId}</span>
                          </div>
                        </div>
                      </div>

                      {/* Route */}
                      <div className="flex items-center gap-4 sm:gap-8 mt-4">
                        <div className="text-center">
                          <p className="text-lg font-bold text-surface-900">{booking.departure}</p>
                          <p className="text-xs text-surface-500">{booking.from}</p>
                        </div>
                        <div className="flex-1 flex flex-col items-center">
                          <div className="w-full flex items-center gap-1">
                            <div className="w-2 h-2 rounded-full bg-brand-500" />
                            <div className="flex-1 h-px bg-surface-300" />
                            <div className="w-2 h-2 rounded-full bg-brand-500" />
                          </div>
                        </div>
                        <div className="text-center">
                          <p className="text-lg font-bold text-surface-900">{booking.arrival}</p>
                          <p className="text-xs text-surface-500">{booking.to}</p>
                        </div>
                      </div>
                    </div>

                    {/* Right Side */}
                    <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2 border-t sm:border-t-0 sm:border-l border-surface-100 pt-4 sm:pt-0 sm:pl-6 sm:min-w-[140px]">
                      <div className="text-right">
                        <div className="flex items-center gap-1 text-xs text-surface-500 mb-0.5">
                          <Calendar className="h-3 w-3" /> {booking.date}
                        </div>
                        <p className="text-xs text-surface-500">Seats: {booking.seats.join(", ")}</p>
                        <p className="text-lg font-extrabold text-brand-600 mt-1">{booking.total}</p>
                      </div>
                      <div className="flex gap-2 mt-2">
                        {booking.status === "upcoming" && (
                          <button 
                            onClick={() => navigate(`/booking/cancel/${booking.id}`)}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-50 text-red-600 text-xs font-semibold hover:bg-red-100 transition-colors"
                          >
                            <X className="h-3 w-3" /> Cancel
                          </button>
                        )}
                        <button
                          onClick={() => navigate(`/booking/confirmation/${booking.id}`)}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-brand-50 text-brand-600 text-xs font-semibold hover:bg-brand-100 transition-colors"
                        >
                          <Eye className="h-3 w-3" /> View
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Empty State */
          <div className="text-center py-20">
            <div className="w-16 h-16 rounded-2xl bg-surface-100 flex items-center justify-center mx-auto mb-4">
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
    </div>
  );
}
