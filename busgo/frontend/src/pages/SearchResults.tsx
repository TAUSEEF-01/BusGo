import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import {
  ArrowRight, Clock, Bus, Star, Wifi, Snowflake, Zap, Filter,
  SlidersHorizontal, MapPin, Calendar, ChevronDown, Users, X, AlertCircle,
} from "lucide-react";
import { apiClient } from "../api/client";
import { toast } from "react-hot-toast";

/* ─── Types ───────────────────────────────────────── */
interface Trip {
  trip_id: string;
  operator_id: string;
  operator_name: string;
  bus_type: string;
  departure_datetime: string;
  arrival_datetime: string;
  fare_amount: number;
  available_seats: number;
  origin_city: string;
  destination_city: string;
  amenities?: string[];
}

const AMENITY_MAP: Record<string, { icon: typeof Wifi; label: string }> = {
  ac: { icon: Snowflake, label: "AC" },
  wifi: { icon: Wifi, label: "WiFi" },
  usb: { icon: Zap, label: "USB" },
};

const SORT_OPTIONS = [
  { value: "price-asc", label: "Price: Low to High" },
  { value: "price-desc", label: "Price: High to Low" },
  { value: "departure", label: "Departure Time" },
  { value: "rating", label: "Rating" },
  { value: "duration", label: "Duration" },
];

export function SearchResults() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const origin = params.get("origin") || "Dhaka";
  const destination = params.get("destination") || "Chittagong";
  const date = params.get("date") || "2026-05-01";

  const [sortBy, setSortBy] = useState("price-asc");
  const [busType, setBusType] = useState<string[]>([]);
  const [selectedOperators, setSelectedOperators] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchTrips();
  }, [origin, destination, date]);

  const fetchTrips = async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch real trips from database
      const response = await apiClient.get("/api/operators/trips/", {
        params: {
          origin,
          destination,
          date: date + 'T00:00:00',
        },
      });
      
      if (response.data.success) {
        const now = new Date();
        const activeTrips = (response.data.data || []).filter(
          (trip: any) => trip.status === 'SCHEDULED' && trip.departure_datetime && new Date(trip.departure_datetime) > now
        );
        setTrips(activeTrips);
      } else {
        setTrips([]);
      }
      
    } catch (err: any) {
      console.error("Error fetching trips:", err);
      setTrips([]);
      toast.error("Failed to load trips");
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (datetime: string) => {
    try {
      return new Date(datetime).toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
    } catch {
      return datetime;
    }
  };

  const calculateDuration = (departure: string, arrival: string) => {
    try {
      const dep = new Date(departure);
      const arr = new Date(arrival);
      const diff = arr.getTime() - dep.getTime();
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      return `${hours}h ${minutes}m`;
    } catch {
      return "N/A";
    }
  };

  const operators = Array.from(new Set(trips.map((t) => t.operator_name))).sort();

  const filteredTrips = trips
    .filter((t) => busType.length === 0 || busType.includes(t.bus_type))
    .filter((t) => selectedOperators.length === 0 || selectedOperators.includes(t.operator_name))
    .sort((a, b) => {
      if (sortBy === "price-asc") return a.fare_amount - b.fare_amount;
      if (sortBy === "price-desc") return b.fare_amount - a.fare_amount;
      if (sortBy === "departure") return new Date(a.departure_datetime).getTime() - new Date(b.departure_datetime).getTime();
      return 0;
    });

  const toggleType = (type: string) => {
    setBusType((prev) => prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]);
  };

  const toggleOperator = (op: string) => {
    setSelectedOperators((prev) => prev.includes(op) ? prev.filter((o) => o !== op) : [...prev, op]);
  };

  const formatDate = (d: string) => {
    try { return new Date(d).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" }); }
    catch { return d; }
  };

  return (
    <div className="min-h-screen bg-surface-50" id="search-results-page">
      {/* Search Summary Bar */}
      <div className="bg-white border-b border-surface-200 shadow-elevation-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-surface-900 font-bold text-lg">
                <MapPin className="h-5 w-5 text-brand-500" />
                {origin}
                <ArrowRight className="h-4 w-4 text-surface-400" />
                {destination}
              </div>
              <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-surface-100 text-surface-600 text-sm">
                <Calendar className="h-3.5 w-3.5" />
                {formatDate(date)}
              </div>
            </div>
            <button onClick={() => navigate("/")} className="btn-secondary !py-2 !px-4 !text-sm" id="modify-search">
              Modify Search
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex gap-6">
          {/* ── Filter Sidebar (Desktop) ── */}
          <aside className={`${showFilters ? "fixed inset-0 z-50 bg-white p-6 overflow-y-auto md:relative md:inset-auto md:z-auto md:bg-transparent md:p-0" : "hidden"} md:block w-full md:w-64 flex-shrink-0`}>
            <div className="md:sticky md:top-24">
              <div className="flex items-center justify-between mb-6 md:mb-4">
                <h3 className="font-bold text-surface-900 flex items-center gap-2">
                  <SlidersHorizontal className="h-5 w-5 text-brand-500" /> Filters
                </h3>
                <button onClick={() => setShowFilters(false)} className="md:hidden p-1 hover:bg-surface-100 rounded">
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Bus Type */}
              <div className="card-premium p-5 mb-4">
                <h4 className="text-sm font-bold text-surface-700 mb-3">Bus Type</h4>
                <div className="space-y-2">
                  {["AC", "Non-AC", "AC Sleeper"].map((type) => (
                    <label key={type} className="flex items-center gap-2 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={busType.includes(type)}
                        onChange={() => toggleType(type)}
                        className="w-4 h-4 rounded border-surface-300 text-brand-600 focus:ring-brand-500"
                      />
                      <span className="text-sm text-surface-700 group-hover:text-surface-900">{type}</span>
                      <span className="ml-auto text-xs text-surface-400">
                        ({trips.filter((t) => t.bus_type === type).length})
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Operator */}
              {operators.length > 0 && (
                <div className="card-premium p-5 mb-4 animate-fade-in">
                  <h4 className="text-sm font-bold text-surface-700 mb-3">Operator</h4>
                  <div className="space-y-2">
                    {operators.map((op) => (
                      <label key={op} className="flex items-center gap-2 cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={selectedOperators.includes(op)}
                          onChange={() => toggleOperator(op)}
                          className="w-4 h-4 rounded border-surface-300 text-brand-600 focus:ring-brand-500"
                        />
                        <span className="text-sm text-surface-700 group-hover:text-surface-900">{op}</span>
                        <span className="ml-auto text-xs text-surface-400">
                          ({trips.filter((t) => t.operator_name === op).length})
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Price Range */}
              <div className="card-premium p-5">
                <h4 className="text-sm font-bold text-surface-700 mb-3">Price Range</h4>
                <div className="flex items-center justify-between text-xs text-surface-500 mb-2">
                  <span>৳ 500</span>
                  <span>৳ 1,500</span>
                </div>
                <input type="range" min="500" max="1500" defaultValue="1500" className="w-full accent-brand-600" />
              </div>
            </div>
          </aside>

          {/* ── Results ── */}
          <div className="flex-1">
            {/* Sort & filter bar */}
            <div className="flex items-center justify-between mb-5">
              <p className="text-sm text-surface-500">
                <span className="font-bold text-surface-900">{filteredTrips.length}</span> buses found
              </p>
              <div className="flex items-center gap-3">
                <button onClick={() => setShowFilters(true)} className="md:hidden flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white border border-surface-200 text-sm font-medium text-surface-700 hover:bg-surface-50" id="show-filters-mobile">
                  <Filter className="h-4 w-4" /> Filters
                </button>
                <div className="relative">
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="appearance-none bg-white border border-surface-200 rounded-lg px-4 py-2 pr-8 text-sm font-medium text-surface-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 cursor-pointer"
                    id="sort-select"
                  >
                    {SORT_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-400 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Loading State */}
            {loading && (
              <div className="flex items-center justify-center py-20">
                <div className="text-center">
                  <div className="w-12 h-12 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin mx-auto mb-4" />
                  <p className="text-surface-500">Searching for buses...</p>
                </div>
              </div>
            )}

            {/* Empty State */}
            {!loading && filteredTrips.length === 0 && (
              <div className="card-premium p-12 text-center">
                <Bus className="h-16 w-16 text-surface-300 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-surface-900 mb-2">No buses found</h3>
                <p className="text-surface-600 mb-6">
                  We couldn't find any buses for this route on the selected date.
                  <br />
                  Try adjusting your filters or search for a different date.
                </p>
                <button onClick={() => navigate("/")} className="btn-primary">
                  Modify Search
                </button>
              </div>
            )}

            {/* Trip Cards */}
            {!loading && filteredTrips.length > 0 && (
              <div className="space-y-4">
                {filteredTrips.map((trip, i) => {
                  const departure = formatTime(trip.departure_datetime);
                  const arrival = formatTime(trip.arrival_datetime);
                  const duration = calculateDuration(trip.departure_datetime, trip.arrival_datetime);
                  const amenities = trip.amenities || [];
                  
                  return (
                    <div
                      key={trip.trip_id}
                      className="card-premium p-0 overflow-hidden animate-fade-in-up relative"
                      style={{ animationDelay: `${i * 80}ms` }}
                      id={`trip-card-${trip.trip_id}`}
                    >
                      <div className="p-5 sm:p-6">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          {/* Left: Operator & Times */}
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-3">
                              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-surface-800 to-surface-900 flex items-center justify-center text-white text-xs font-bold shadow-sm">
                                {trip.operator_name.split(" ").map((w) => w[0]).join("").slice(0,2)}
                              </div>
                              <div>
                                <h3 className="font-bold text-surface-900 text-sm sm:text-base">{trip.operator_name}</h3>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className="badge badge-neutral text-[10px]">{trip.bus_type}</span>
                                  <div className="flex items-center gap-0.5">
                                    <Star className="h-3 w-3 text-accent-400 fill-accent-400" />
                                    <span className="text-xs font-semibold text-surface-600">4.5</span>
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-4 sm:gap-8">
                              <div className="text-center">
                                <p className="text-lg font-bold text-surface-900">{departure}</p>
                                <p className="text-xs text-surface-500">{trip.origin_city}</p>
                              </div>
                              <div className="flex-1 flex flex-col items-center">
                                <span className="text-xs text-surface-400 mb-1">{duration}</span>
                                <div className="w-full flex items-center gap-1">
                                  <div className="w-2 h-2 rounded-full bg-brand-500" />
                                  <div className="flex-1 h-px bg-surface-300 relative">
                                    <Bus className="absolute left-1/2 -translate-x-1/2 -top-2 h-4 w-4 text-brand-500" />
                                  </div>
                                  <div className="w-2 h-2 rounded-full bg-brand-500" />
                                </div>
                              </div>
                              <div className="text-center">
                                <p className="text-lg font-bold text-surface-900">{arrival}</p>
                                <p className="text-xs text-surface-500">{trip.destination_city}</p>
                              </div>
                            </div>
                          </div>

                          {/* Right: Price & CTA */}
                          <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 sm:gap-3 sm:min-w-[140px] border-t sm:border-t-0 sm:border-l border-surface-100 pt-4 sm:pt-0 sm:pl-6">
                            <div className="text-right">
                              <p className="text-2xl font-extrabold text-brand-600">৳ {trip.fare_amount}</p>
                              <p className="text-xs text-surface-400">per seat</p>
                            </div>
                            <button
                              onClick={() => navigate(`/booking/select-seats/${trip.trip_id}`, {
                                state: {
                                  origin: trip.origin_city,
                                  destination: trip.destination_city,
                                  date,
                                  price: trip.fare_amount,
                                  operator: trip.operator_name,
                                  operator_id: trip.operator_id,
                                  departureTime: departure
                                }
                              })}
                              className="btn-primary !py-2.5 !px-5 !text-sm flex items-center gap-1.5"
                              id={`select-${trip.trip_id}`}
                            >
                              Select Seat <ArrowRight className="h-4 w-4" />
                            </button>
                          </div>
                        </div>

                        {/* Amenities & Seats */}
                        <div className="flex items-center justify-between mt-4 pt-4 border-t border-surface-100">
                          <div className="flex items-center gap-3">
                            {amenities.map((a) => {
                              const am = AMENITY_MAP[a.toLowerCase()];
                              if (!am) return null;
                              return (
                                <span key={a} className="flex items-center gap-1 text-xs text-surface-500">
                                  <am.icon className="h-3.5 w-3.5" /> {am.label}
                                </span>
                              );
                            })}
                            {amenities.length === 0 && (
                              <span className="text-xs text-surface-400">Standard amenities</span>
                            )}
                          </div>
                          <span className={`flex items-center gap-1 text-xs font-semibold ${trip.available_seats <= 10 ? "text-red-500" : "text-emerald-600"}`}>
                            <Users className="h-3.5 w-3.5" />
                            {trip.available_seats} seats left
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
