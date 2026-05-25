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

const getOperatorRating = (name: string) => {
  const normalized = name.toLowerCase();
  if (normalized.includes("greenline")) return "4.5";
  if (normalized.includes("shohagh")) return "4.2";
  if (normalized.includes("hanif")) return "4.0";
  return "4.3";
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
      {/* Search and Filters Bar */}
      <div className="bg-white border-b border-surface-200 py-4 px-6 shadow-elevation-1">
        <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-4">
          {/* Search */}
          <div className="lg:col-span-3">
            <label className="block text-xs font-bold text-surface-700 mb-1">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by operator, origin, or de..."
                className="w-full pl-9 pr-3 py-2 border border-surface-200 rounded-lg text-sm bg-white focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                id="search-input"
              />
            </div>
          </div>

          {/* Operator Dropdown */}
          <div className="lg:col-span-2">
            <label className="block text-xs font-bold text-surface-700 mb-1">Operator</label>
            <select
              value={filterOperator}
              onChange={(e) => setFilterOperator(e.target.value)}
              className="w-full px-3 py-2 border border-surface-200 rounded-lg text-sm bg-white focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 appearance-none"
              style={{ backgroundImage: 'url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 20 20\'%3E%3Cpath stroke=\'%236b7280\' stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'1.5\' d=\'m6 8 4 4 4-4\'/%3E%3C/svg%3E")', backgroundPosition: 'right 0.5rem center', backgroundSize: '1.25rem', backgroundRepeat: 'no-repeat' }}
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

          {/* From Dropdown */}
          <div className="lg:col-span-2">
            <label className="block text-xs font-bold text-surface-700 mb-1">From</label>
            <select
              value={filterOrigin}
              onChange={(e) => setFilterOrigin(e.target.value)}
              className="w-full px-3 py-2 border border-surface-200 rounded-lg text-sm bg-white focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 appearance-none"
              style={{ backgroundImage: 'url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 20 20\'%3E%3Cpath stroke=\'%236b7280\' stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'1.5\' d=\'m6 8 4 4 4-4\'/%3E%3C/svg%3E")', backgroundPosition: 'right 0.5rem center', backgroundSize: '1.25rem', backgroundRepeat: 'no-repeat' }}
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

          {/* To Dropdown */}
          <div className="lg:col-span-2">
            <label className="block text-xs font-bold text-surface-700 mb-1">To</label>
            <select
              value={filterDestination}
              onChange={(e) => setFilterDestination(e.target.value)}
              className="w-full px-3 py-2 border border-surface-200 rounded-lg text-sm bg-white focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 appearance-none"
              style={{ backgroundImage: 'url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 20 20\'%3E%3Cpath stroke=\'%236b7280\' stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'1.5\' d=\'m6 8 4 4 4-4\'/%3E%3C/svg%3E")', backgroundPosition: 'right 0.5rem center', backgroundSize: '1.25rem', backgroundRepeat: 'no-repeat' }}
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

          {/* Date Input */}
          <div className="lg:col-span-2">
            <label className="block text-xs font-bold text-surface-700 mb-1">Date</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-400 pointer-events-none" />
              <input
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-surface-200 rounded-lg text-sm bg-white focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                id="filter-date"
              />
            </div>
          </div>

          {/* Bus Type Dropdown */}
          <div className="lg:col-span-1">
            <label className="block text-xs font-bold text-surface-700 mb-1">Bus Type</label>
            <select
              value={filterBusType}
              onChange={(e) => setFilterBusType(e.target.value)}
              className="w-full px-3 py-2 border border-surface-200 rounded-lg text-sm bg-white focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 appearance-none"
              style={{ backgroundImage: 'url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 20 20\'%3E%3Cpath stroke=\'%236b7280\' stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'1.5\' d=\'m6 8 4 4 4-4\'/%3E%3C/svg%3E")', backgroundPosition: 'right 0.5rem center', backgroundSize: '1.25rem', backgroundRepeat: 'no-repeat' }}
              id="filter-bus-type"
            >
              <option value="">All Type</option>
              {busTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Active Filters inside search/filters bar */}
        {(searchTerm || filterOperator || filterOrigin || filterDestination || filterBusType || filterDate) && (
          <div className="max-w-7xl mx-auto flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-surface-100">
            <span className="text-xs text-surface-500 font-medium">Active filters:</span>
            {searchTerm && (
              <span className="badge badge-info flex items-center gap-1 text-[11px] py-0.5 px-2">
                Search: {searchTerm}
                <button onClick={() => setSearchTerm("")} className="hover:text-red-500 cursor-pointer">
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
            {filterOperator && (
              <span className="badge badge-info flex items-center gap-1 text-[11px] py-0.5 px-2">
                Operator: {filterOperator}
                <button onClick={() => setFilterOperator("")} className="hover:text-red-500 cursor-pointer">
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
            {filterOrigin && (
              <span className="badge badge-info flex items-center gap-1 text-[11px] py-0.5 px-2">
                From: {filterOrigin}
                <button onClick={() => setFilterOrigin("")} className="hover:text-red-500 cursor-pointer">
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
            {filterDestination && (
              <span className="badge badge-info flex items-center gap-1 text-[11px] py-0.5 px-2">
                To: {filterDestination}
                <button onClick={() => setFilterDestination("")} className="hover:text-red-500 cursor-pointer">
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
            {filterDate && (
              <span className="badge badge-info flex items-center gap-1 text-[11px] py-0.5 px-2">
                Date: {new Date(filterDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                <button onClick={() => setFilterDate("")} className="hover:text-red-500 cursor-pointer">
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
            {filterBusType && (
              <span className="badge badge-info flex items-center gap-1 text-[11px] py-0.5 px-2">
                Type: {filterBusType}
                <button onClick={() => setFilterBusType("")} className="hover:text-red-500 cursor-pointer">
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
            <button
              onClick={clearFilters}
              className="text-xs text-red-600 hover:text-red-700 font-bold ml-auto cursor-pointer"
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Results Count */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-surface-500 font-medium">
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
          <div className="bg-white rounded-xl border border-surface-200 p-12 text-center shadow-elevation-1">
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

        {/* Trip Table Layout */}
        {!loading && filteredTrips.length > 0 && (
          <div className="bg-white rounded-xl border border-surface-200 shadow-elevation-1 overflow-hidden">
            {/* Table Header */}
            <div className="hidden md:grid grid-cols-12 gap-4 bg-surface-50 border-b border-surface-200 py-3.5 px-6 text-xs font-bold text-surface-500 uppercase tracking-wider">
              <div className="col-span-3">Operator</div>
              <div className="col-span-3">Departure/Arrival</div>
              <div className="col-span-2 text-center">Duration</div>
              <div className="col-span-2">Amenities</div>
              <div className="col-span-2 text-right">Price/Action</div>
            </div>

            {/* Table Body */}
            <div className="divide-y divide-surface-200">
              {filteredTrips.map((trip, i) => {
                const departure = formatTime(trip.departure_datetime);
                const arrival = formatTime(trip.arrival_datetime);
                const date = formatDate(trip.departure_datetime);
                const duration = calculateDuration(trip.departure_datetime, trip.arrival_datetime);
                const amenities = trip.amenities || [];
                const logo = getOperatorLogo(trip.operator_name);
                const rating = getOperatorRating(trip.operator_name);

                return (
                  <div
                    key={trip.trip_id}
                    className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center py-4 px-6 hover:bg-surface-50/50 transition-colors duration-150"
                    id={`trip-row-${trip.trip_id}`}
                  >
                    {/* Operator column */}
                    <div className="col-span-12 md:col-span-3 flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 shadow-sm ${logo.bgClass}`}>
                        {logo.text}
                      </div>
                      <div>
                        <h4 className="font-bold text-surface-900 text-sm">
                          {trip.operator_name}
                        </h4>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="bg-surface-100 text-surface-600 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">
                            {trip.bus_type}
                          </span>
                          <div className="flex items-center gap-0.5 text-xs text-surface-500 font-semibold">
                            <Star className="h-3 w-3 text-accent-500 fill-accent-500" />
                            <span>{rating}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Departure/Arrival column */}
                    <div className="col-span-12 md:col-span-3 flex items-start gap-4 py-1">
                      <div className="flex flex-col">
                        <p className="text-sm font-bold text-surface-950">{departure}</p>
                        <p className="text-xs text-surface-500 font-medium">{trip.origin_city}</p>
                        <span className="text-[10px] text-brand-700 font-bold mt-1.5 bg-brand-50 px-1.5 py-0.5 rounded self-start">
                          {date}
                        </span>
                      </div>
                      <div className="text-surface-300 font-light text-base select-none shrink-0 pt-0.5">→</div>
                      <div className="flex flex-col">
                        <p className="text-sm font-bold text-surface-950">{arrival}</p>
                        <p className="text-xs text-surface-500 font-medium">{trip.destination_city}</p>
                        {/* Hidden placeholder to perfectly align the left and right column heights */}
                        <span className="text-[10px] py-0.5 mt-1.5 opacity-0 select-none">placeholder</span>
                      </div>
                    </div>

                    {/* Duration column */}
                    <div className="col-span-12 md:col-span-2 flex justify-start md:justify-center items-center gap-2">
                      <Bus className="h-4 w-4 text-brand-600 shrink-0" />
                      <span className="text-sm font-medium text-surface-800">{duration}</span>
                    </div>

                    {/* Amenities & Seats left column */}
                    <div className="col-span-12 md:col-span-2 flex flex-row md:flex-col justify-between md:justify-center gap-2 md:gap-1.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {amenities.map((a) => {
                          const lower = a.toLowerCase();
                          if (lower === "wifi") {
                            return (
                              <span key={a} className="flex items-center gap-0.5 text-xs text-surface-500 font-semibold" title="WiFi">
                                <Wifi className="h-3.5 w-3.5 text-surface-400" />
                                WiFi
                              </span>
                            );
                          }
                          if (lower === "ac") {
                            return (
                              <span key={a} className="bg-surface-100 text-surface-600 px-1 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider" title="Air Conditioning">
                                AC
                              </span>
                            );
                          }
                          if (lower === "usb") {
                            return (
                              <span key={a} className="bg-surface-100 text-surface-600 px-1 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider" title="USB Port">
                                USB
                              </span>
                            );
                          }
                          return null;
                        })}
                        {amenities.length === 0 && (
                          <span className="text-xs text-surface-400 font-medium">Standard</span>
                        )}
                      </div>
                      <div className={`flex items-center gap-1 text-xs font-semibold ${
                        trip.available_seats <= 10
                          ? "text-red-600"
                          : trip.available_seats <= 20
                          ? "text-amber-600"
                          : "text-emerald-600"
                      }`}>
                        <Users className="h-3.5 w-3.5" />
                        <span>{trip.available_seats} seats left</span>
                      </div>
                    </div>

                    {/* Price/Action column */}
                    <div className="col-span-12 md:col-span-2 flex md:flex-row items-center justify-between md:justify-end gap-4 border-t md:border-t-0 border-surface-100 pt-3 md:pt-0">
                      <div className="text-left md:text-right">
                        <p className="text-lg font-black text-brand-700">৳{trip.fare_amount}</p>
                        <p className="text-[10px] text-surface-400 font-semibold uppercase tracking-wider">per seat</p>
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
                        className="bg-brand-600 hover:bg-brand-700 active:scale-95 text-white font-bold py-2 px-4 rounded-lg text-xs flex items-center gap-1 transition-all shadow-md shadow-brand/10 hover:shadow-brand/20 shrink-0 cursor-pointer"
                        id={`select-${trip.trip_id}`}
                      >
                        Select Seat <ArrowRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
