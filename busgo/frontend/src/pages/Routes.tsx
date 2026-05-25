import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight, Clock, Bus, Star, Wifi, Snowflake, Zap, Search,
  MapPin, Calendar, Users, Filter, X,
} from "lucide-react";
import { apiClient } from "../api/client";
import { toast } from "react-hot-toast";

interface Trip {
  trip_id: string;
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



export function Routes() {
  const navigate = useNavigate();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [filteredTrips, setFilteredTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterOperator, setFilterOperator] = useState("");
  const [filterOrigin, setFilterOrigin] = useState("");
  const [filterDestination, setFilterDestination] = useState("");
  const [filterBusType, setFilterBusType] = useState("");
  const [filterDate, setFilterDate] = useState("");

  useEffect(() => {
    fetchAllTrips();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [searchTerm, filterOperator, filterOrigin, filterDestination, filterBusType, filterDate, trips]);

  const fetchAllTrips = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get(`/api/operators/trips/?_t=${Date.now()}`);
      
      let dbTrips: Trip[] = [];
      if (response.data.success) {
        const allTrips = response.data.data || [];
        const now = new Date();
        // Filter only scheduled trips that haven't departed yet and safely map missing fields
        dbTrips = allTrips
          .filter((trip: any) => trip.status === 'SCHEDULED' && trip.departure_datetime && new Date(trip.departure_datetime) > now)
          .map((trip: any) => ({
          ...trip,
          trip_id: trip.trip_id || trip.id,
          operator_name: trip.operator_name || "Unknown Operator",
          bus_type: trip.bus_type || "Standard",
          origin_city: trip.origin_city || "Unknown Origin",
          destination_city: trip.destination_city || "Unknown Destination",
          available_seats: trip.available_seats || 0,
          fare_amount: trip.fare_amount || 0,
          amenities: trip.amenities || []
        }));
      }
      
      setTrips(dbTrips);
    } catch (err: any) {
      console.error("Error fetching trips:", err);
      toast.error("Failed to load available routes.");
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...trips];

    // Search filter (operator name, origin, destination)
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (trip) =>
          trip.operator_name.toLowerCase().includes(term) ||
          trip.origin_city.toLowerCase().includes(term) ||
          trip.destination_city.toLowerCase().includes(term)
      );
    }

    // Origin filter
    if (filterOrigin) {
      filtered = filtered.filter((trip) => trip.origin_city === filterOrigin);
    }

    // Destination filter
    if (filterDestination) {
      filtered = filtered.filter((trip) => trip.destination_city === filterDestination);
    }

    // Operator filter
    if (filterOperator) {
      filtered = filtered.filter((trip) => trip.operator_name === filterOperator);
    }

    // Bus type filter
    if (filterBusType) {
      filtered = filtered.filter((trip) => trip.bus_type === filterBusType);
    }

    // Date filter
    if (filterDate) {
      filtered = filtered.filter((trip) => {
        const tripDate = new Date(trip.departure_datetime).toISOString().split('T')[0];
        return tripDate === filterDate;
      });
    }

    setFilteredTrips(filtered);
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

  const formatDate = (datetime: string) => {
    try {
      return new Date(datetime).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
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

  const clearFilters = () => {
    setSearchTerm("");
    setFilterOperator("");
    setFilterOrigin("");
    setFilterDestination("");
    setFilterBusType("");
    setFilterDate("");
  };

  // Get unique values for filters
  const operators = Array.from(new Set(trips.map((t) => t.operator_name))).sort();
  const origins = Array.from(new Set(trips.map((t) => t.origin_city))).sort();
  const destinations = Array.from(new Set(trips.map((t) => t.destination_city))).sort();
  const busTypes = Array.from(new Set(trips.map((t) => t.bus_type))).sort();

  return (
    <div className="min-h-screen bg-surface-50" id="routes-page">
      {/* Header */}
      <div className="bg-white border-b border-surface-200 shadow-elevation-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <h1 className="text-2xl font-bold text-surface-900 mb-2">All Available Routes</h1>
          <p className="text-surface-600">Browse and search through all available bus trips</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Search and Filters */}
        <div className="card-premium p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-4">
            {/* Search */}
            <div className="lg:col-span-3">
              <label className="block text-sm font-semibold text-surface-700 mb-1.5">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-surface-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by operator, origin, or destination..."
                  className="input-premium !pl-10"
                  id="search-input"
                />
              </div>
            </div>

            {/* Operator Filter */}
            <div className="lg:col-span-2">
              <label className="block text-sm font-semibold text-surface-700 mb-1.5">Operator</label>
              <select
                value={filterOperator}
                onChange={(e) => setFilterOperator(e.target.value)}
                className="input-premium"
                id="filter-operator"
              >
                <option value="">All Operators</option>
                {operators.map((op) => (
                  <option key={op} value={op}>
                    {op}
                  </option>
                ))}
              </select>
            </div>

            {/* Origin Filter */}
            <div className="lg:col-span-2">
              <label className="block text-sm font-semibold text-surface-700 mb-1.5">From</label>
              <select
                value={filterOrigin}
                onChange={(e) => setFilterOrigin(e.target.value)}
                className="input-premium"
                id="filter-origin"
              >
                <option value="">All Origins</option>
                {origins.map((city) => (
                  <option key={city} value={city}>
                    {city}
                  </option>
                ))}
              </select>
            </div>

            {/* Destination Filter */}
            <div className="lg:col-span-2">
              <label className="block text-sm font-semibold text-surface-700 mb-1.5">To</label>
              <select
                value={filterDestination}
                onChange={(e) => setFilterDestination(e.target.value)}
                className="input-premium"
                id="filter-destination"
              >
                <option value="">All Destinations</option>
                {destinations.map((city) => (
                  <option key={city} value={city}>
                    {city}
                  </option>
                ))}
              </select>
            </div>

            {/* Date Filter */}
            <div className="lg:col-span-2">
              <label className="block text-sm font-semibold text-surface-700 mb-1.5">Date</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-surface-400 pointer-events-none" />
                <input
                  type="date"
                  value={filterDate}
                  onChange={(e) => setFilterDate(e.target.value)}
                  className="input-premium !pl-10"
                  id="filter-date"
                />
              </div>
            </div>

            {/* Bus Type Filter */}
            <div className="lg:col-span-1">
              <label className="block text-sm font-semibold text-surface-700 mb-1.5">Bus Type</label>
              <select
                value={filterBusType}
                onChange={(e) => setFilterBusType(e.target.value)}
                className="input-premium"
                id="filter-bus-type"
              >
                <option value="">All Types</option>
                {busTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Active Filters */}
          {(searchTerm || filterOperator || filterOrigin || filterDestination || filterBusType || filterDate) && (
            <div className="flex items-center gap-2 mt-4 pt-4 border-t border-surface-100">
              <span className="text-sm text-surface-600">Active filters:</span>
              {searchTerm && (
                <span className="badge badge-info flex items-center gap-1">
                  Search: {searchTerm}
                  <button onClick={() => setSearchTerm("")} className="hover:text-red-500">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
              {filterOperator && (
                <span className="badge badge-info flex items-center gap-1">
                  Operator: {filterOperator}
                  <button onClick={() => setFilterOperator("")} className="hover:text-red-500">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
              {filterOrigin && (
                <span className="badge badge-info flex items-center gap-1">
                  From: {filterOrigin}
                  <button onClick={() => setFilterOrigin("")} className="hover:text-red-500">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
              {filterDestination && (
                <span className="badge badge-info flex items-center gap-1">
                  To: {filterDestination}
                  <button onClick={() => setFilterDestination("")} className="hover:text-red-500">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
              {filterDate && (
                <span className="badge badge-info flex items-center gap-1">
                  Date: {new Date(filterDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  <button onClick={() => setFilterDate("")} className="hover:text-red-500">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
              {filterBusType && (
                <span className="badge badge-info flex items-center gap-1">
                  Type: {filterBusType}
                  <button onClick={() => setFilterBusType("")} className="hover:text-red-500">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
              <button
                onClick={clearFilters}
                className="text-sm text-red-600 hover:text-red-700 font-medium ml-auto"
              >
                Clear all
              </button>
            </div>
          )}
        </div>

        {/* Results Count */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-surface-500">
            <span className="font-bold text-surface-900">{filteredTrips.length}</span> trips found
          </p>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="w-12 h-12 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin mx-auto mb-4" />
              <p className="text-surface-500">Loading trips...</p>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!loading && filteredTrips.length === 0 && (
          <div className="card-premium p-12 text-center">
            <Bus className="h-16 w-16 text-surface-300 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-surface-900 mb-2">No trips found</h3>
            <p className="text-surface-600 mb-6">
              Try adjusting your filters or search criteria
            </p>
            <button onClick={clearFilters} className="btn-primary">
              Clear Filters
            </button>
          </div>
        )}

        {/* Trip Cards */}
        {!loading && filteredTrips.length > 0 && (
          <div className="space-y-4">
            {filteredTrips.map((trip, i) => {
              const departure = formatTime(trip.departure_datetime);
              const arrival = formatTime(trip.arrival_datetime);
              const date = formatDate(trip.departure_datetime);
              const duration = calculateDuration(trip.departure_datetime, trip.arrival_datetime);
              const amenities = trip.amenities || [];

              return (
                <div
                  key={trip.trip_id}
                  className="card-premium p-0 overflow-hidden animate-fade-in-up"
                  style={{ animationDelay: `${i * 50}ms` }}
                  id={`trip-card-${trip.trip_id}`}
                >
                  <div className="p-5 sm:p-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      {/* Left: Operator & Times */}
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-surface-800 to-surface-900 flex items-center justify-center text-white text-xs font-bold shadow-sm">
                            {trip.operator_name.split(" ").map((w) => w[0]).join("").slice(0, 2)}
                          </div>
                          <div>
                            <h3 className="font-bold text-surface-900 text-sm sm:text-base">
                              {trip.operator_name}
                            </h3>
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
                            <p className="text-[10px] text-surface-400">{date}</p>
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
                          onClick={() =>
                            navigate(`/booking/select-seats/${trip.trip_id}`, {
                              state: {
                                origin: trip.origin_city,
                                destination: trip.destination_city,
                                date: formatDate(trip.departure_datetime),
                                price: trip.fare_amount,
                                operator: trip.operator_name,
                                departureTime: departure,
                              },
                            })
                          }
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
                      <span
                        className={`flex items-center gap-1 text-xs font-semibold ${
                          trip.available_seats <= 10 ? "text-red-500" : "text-emerald-600"
                        }`}
                      >
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
  );
}
