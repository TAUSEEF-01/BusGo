import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, useLocation } from "react-router-dom";
import {
  ArrowRight, Clock, Bus, Star, Wifi, Snowflake, Zap, Search,
  MapPin, Calendar, Users, Filter, X, SlidersHorizontal, ChevronDown,
} from "lucide-react";
import { apiClient } from "../api/client";
import { toast } from "react-hot-toast";

const RECENT_SEARCHES_KEY = "busgo_recent_searches";
const MAX_RECENT_SEARCHES = 4;

function saveRecentSearch(origin: string, destination: string, date: string) {
  if (!origin || !destination) return;
  const existing = JSON.parse(localStorage.getItem(RECENT_SEARCHES_KEY) || "[]");
  const filtered = existing.filter(
    (s: any) => !(s.origin === origin && s.destination === destination)
  );
  const updated = [{ origin, destination, date, tripType: "One Way", savedAt: Date.now() }, ...filtered].slice(0, MAX_RECENT_SEARCHES);
  localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
}

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
  const [params] = useSearchParams();
  const location = useLocation();
  const state = location.state || {};

  const initialOrigin = params.get("origin") || "";
  const initialDestination = params.get("destination") || "";
  const initialDate = params.get("date") || "";
  const initialTripType = params.get("tripType") || state.tripType || "one-way";
  const initialReturnDate = params.get("returnDate") || state.returnDate || "";
  const isReturnStep = params.get("isReturnStep") === "true" || !!state.outboundSeats;

  const [trips, setTrips] = useState<Trip[]>([]);
  const [filteredTrips, setFilteredTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedOperators, setSelectedOperators] = useState<string[]>([]);
  const [filterOrigin, setFilterOrigin] = useState(initialOrigin);
  const [filterDestination, setFilterDestination] = useState(initialDestination);
  const [selectedBusTypes, setSelectedBusTypes] = useState<string[]>([]);
  const [filterDate, setFilterDate] = useState(initialDate);
  const [tripType, setTripType] = useState<"one-way" | "round-way">(initialTripType as "one-way" | "round-way");
  const [filterReturnDate, setFilterReturnDate] = useState(initialReturnDate);
  
  // Price boundaries
  const [maxPrice, setMaxPrice] = useState<number>(3000);
  const [priceRange, setPriceRange] = useState<number>(3000);
  const [sortBy, setSortBy] = useState<string>("price-asc");
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    fetchAllTrips();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [searchTerm, selectedOperators, filterOrigin, filterDestination, selectedBusTypes, filterDate, priceRange, sortBy, trips, tripType, filterReturnDate]);

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
      
      // Compute range boundaries dynamically
      if (dbTrips.length > 0) {
        const prices = dbTrips.map(t => t.fare_amount);
        const max = Math.max(...prices);
        setMaxPrice(max);
        setPriceRange(max);
      }
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

    // Operator filter (Multiple)
    if (selectedOperators.length > 0) {
      filtered = filtered.filter((trip) => selectedOperators.includes(trip.operator_name));
    }

    // Bus type filter (Multiple)
    if (selectedBusTypes.length > 0) {
      filtered = filtered.filter((trip) => selectedBusTypes.includes(trip.bus_type));
    }

    // Date filter
    if (filterDate) {
      filtered = filtered.filter((trip) => {
        const tripDate = new Date(trip.departure_datetime).toISOString().split('T')[0];
        return tripDate === filterDate;
      });
    }

    // Price range filter
    filtered = filtered.filter((trip) => trip.fare_amount <= priceRange);

    // Sorting logic
    if (sortBy === "price-asc") {
      filtered.sort((a, b) => a.fare_amount - b.fare_amount);
    } else if (sortBy === "price-desc") {
      filtered.sort((a, b) => b.fare_amount - a.fare_amount);
    } else if (sortBy === "time-asc") {
      filtered.sort((a, b) => new Date(a.departure_datetime).getTime() - new Date(b.departure_datetime).getTime());
    } else if (sortBy === "time-desc") {
      filtered.sort((a, b) => new Date(b.departure_datetime).getTime() - new Date(a.departure_datetime).getTime());
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
    setSelectedOperators([]);
    setSelectedBusTypes([]);
    setFilterOrigin("");
    setFilterDestination("");
    setFilterDate("");
    setPriceRange(maxPrice);
    setSortBy("price-asc");
  };

  const toggleOperator = (op: string) => {
    setSelectedOperators(prev => 
      prev.includes(op) ? prev.filter(x => x !== op) : [...prev, op]
    );
  };

  const toggleBusType = (bt: string) => {
    setSelectedBusTypes(prev => 
      prev.includes(bt) ? prev.filter(x => x !== bt) : [...prev, bt]
    );
  };

  const getFacetedCount = (type: "operator" | "bus_type", value: string) => {
    return trips.filter((trip) => {
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        if (!trip.operator_name.toLowerCase().includes(term) &&
            !trip.origin_city.toLowerCase().includes(term) &&
            !trip.destination_city.toLowerCase().includes(term)) {
          return false;
        }
      }
      if (filterOrigin && trip.origin_city !== filterOrigin) return false;
      if (filterDestination && trip.destination_city !== filterDestination) return false;
      if (filterDate) {
        const tripDate = new Date(trip.departure_datetime).toISOString().split('T')[0];
        if (tripDate !== filterDate) return false;
      }
      return type === "operator" ? trip.operator_name === value : trip.bus_type === value;
    }).length;
  };

  // Get unique values for filters
  const operators = Array.from(new Set(trips.map((t) => t.operator_name))).sort();
  const origins = Array.from(new Set(trips.map((t) => t.origin_city))).sort();
  const destinations = Array.from(new Set(trips.map((t) => t.destination_city))).sort();
  const busTypes = Array.from(new Set(trips.map((t) => t.bus_type))).sort();
  const minPriceInTrips = trips.length > 0 ? Math.min(...trips.map(t => t.fare_amount)) : 0;


  return (
    <div className="min-h-screen bg-surface-50" id="routes-page">
      {/* Search Bar Panel */}
      <div className="bg-white border-b border-surface-200 py-4 px-6 shadow-elevation-1">
        {/* Trip type toggle */}
        <div className="max-w-7xl mx-auto flex gap-2 mb-3.5">
          <button
            type="button"
            onClick={() => setTripType("one-way")}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${tripType === "one-way" ? "bg-brand-600 text-white shadow-sm" : "bg-surface-100 text-surface-600 hover:bg-surface-200"}`}
          >
            One Way
          </button>
          <button
            type="button"
            onClick={() => setTripType("round-way")}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${tripType === "round-way" ? "bg-brand-600 text-white shadow-sm" : "bg-surface-100 text-surface-600 hover:bg-surface-200"}`}
          >
            Round Way
          </button>
        </div>

        <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-4">
          {/* Search Input */}
          <div className={tripType === "round-way" ? "lg:col-span-3" : "lg:col-span-4"}>
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

          {/* From Dropdown */}
          <div className={tripType === "round-way" ? "lg:col-span-2" : "lg:col-span-3"}>
            <label className="block text-xs font-bold text-surface-700 mb-1">From</label>
            <select
              value={filterOrigin}
              onChange={(e) => setFilterOrigin(e.target.value)}
              className="w-full px-3 py-2 border border-surface-200 rounded-lg text-sm bg-white focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 appearance-none cursor-pointer"
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
          <div className={tripType === "round-way" ? "lg:col-span-2" : "lg:col-span-3"}>
            <label className="block text-xs font-bold text-surface-700 mb-1">To</label>
            <select
              value={filterDestination}
              onChange={(e) => setFilterDestination(e.target.value)}
              className="w-full px-3 py-2 border border-surface-200 rounded-lg text-sm bg-white focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 appearance-none cursor-pointer"
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
            <label className="block text-xs font-bold text-surface-700 mb-1">{tripType === "round-way" ? "Journey Date" : "Date"}</label>
            <div className="relative">
              <input
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className="w-full pl-4 pr-3 py-2 border border-surface-200 rounded-lg text-sm bg-white focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 cursor-pointer"
                id="filter-date"
              />
            </div>
          </div>

          {/* Return Date Input */}
          {tripType === "round-way" && (
            <div className="lg:col-span-3">
              <label className="block text-xs font-bold text-surface-700 mb-1">Return Date</label>
              <div className="relative">
                <input
                  type="date"
                  value={filterReturnDate}
                  min={filterDate || new Date().toISOString().split("T")[0]}
                  onChange={(e) => setFilterReturnDate(e.target.value)}
                  className="w-full pl-4 pr-3 py-2 border border-surface-200 rounded-lg text-sm bg-white focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 cursor-pointer"
                  id="filter-return-date"
                />
              </div>
            </div>
          )}
        </div>

        {/* Active Filters Display */}
        {(searchTerm || selectedOperators.length > 0 || filterOrigin || filterDestination || selectedBusTypes.length > 0 || filterDate || priceRange < maxPrice) && (
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
            {selectedOperators.map((op) => (
              <span key={op} className="badge badge-info flex items-center gap-1 text-[11px] py-0.5 px-2">
                Operator: {op}
                <button onClick={() => toggleOperator(op)} className="hover:text-red-500 cursor-pointer">
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
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
            {selectedBusTypes.map((bt) => (
              <span key={bt} className="badge badge-info flex items-center gap-1 text-[11px] py-0.5 px-2">
                Type: {bt}
                <button onClick={() => toggleBusType(bt)} className="hover:text-red-500 cursor-pointer">
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
            {priceRange < maxPrice && (
              <span className="badge badge-info flex items-center gap-1 text-[11px] py-0.5 px-2">
                Max Price: ৳{priceRange.toLocaleString()}
                <button onClick={() => setPriceRange(maxPrice)} className="hover:text-red-500 cursor-pointer">
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

      {/* Round Trip Steps Banner */}
      {tripType === "round-way" && (
        <div className="bg-brand-50 border-b border-brand-100 py-3 px-6 shadow-sm animate-fade-in">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="flex items-center justify-center bg-brand-600 text-white font-extrabold rounded-full w-6 h-6 text-xs">
                {isReturnStep ? "2" : "1"}
              </span>
              <span className="font-bold text-brand-900 text-sm md:text-base">
                {isReturnStep
                  ? `Select Return Bus: ${filterOrigin || "Origin"} → ${filterDestination || "Destination"} (${filterDate ? formatDate(filterDate) : "set date"})`
                  : `Select Outbound Bus: ${filterOrigin || "Origin"} → ${filterDestination || "Destination"} (${filterDate ? formatDate(filterDate) : "set date"})`
                }
              </span>
            </div>
            {isReturnStep && state.outboundTrip && (
              <div className="flex flex-wrap items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-brand-200 text-xs text-brand-850 shadow-sm animate-scale-in">
                <span className="font-bold text-brand-700">Outbound Bus:</span>
                <span className="font-semibold text-surface-900">{state.outboundTrip.operator_name || state.outboundTrip.operator}</span>
                <span className="text-surface-300">|</span>
                <span>Seats: <strong className="font-mono text-brand-600">{state.outboundSeats?.join(", ")}</strong></span>
                <span className="text-surface-300">|</span>
                <span>Date: <strong>{state.outboundDate}</strong></span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main Grid Section */}
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

              {/* Bus Type Box Filter */}
              <div className="card-premium p-5 mb-4">
                <h3 className="font-bold text-surface-700 text-sm mb-3">Bus Type</h3>
                <div className="space-y-2">
                  {busTypes.map((type) => {
                    const count = getFacetedCount("bus_type", type);
                    const checked = selectedBusTypes.includes(type);
                    return (
                      <label key={type} className="flex items-center justify-between text-sm cursor-pointer group select-none">
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleBusType(type)}
                            className="w-4 h-4 rounded text-brand-600 border-surface-300 focus:ring-brand-500 focus:ring-offset-0 cursor-pointer accent-brand-600"
                          />
                          <span className={`font-medium ${checked ? "text-brand-600 font-bold" : "text-surface-600 group-hover:text-surface-950"}`}>
                            {type}
                          </span>
                        </div>
                        <span className="text-xs text-surface-400 font-semibold">({count})</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Operator Checkbox Filter */}
              <div className="card-premium p-5 mb-4">
                <h3 className="font-bold text-surface-700 text-sm mb-3">Operator</h3>
                <div className="space-y-2">
                  {operators.map((op) => {
                    const count = getFacetedCount("operator", op);
                    const checked = selectedOperators.includes(op);
                    return (
                      <label key={op} className="flex items-center justify-between text-sm cursor-pointer group select-none">
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleOperator(op)}
                            className="w-4 h-4 rounded text-brand-600 border-surface-300 focus:ring-brand-500 focus:ring-offset-0 cursor-pointer accent-brand-600"
                          />
                          <span className={`font-medium ${checked ? "text-brand-600 font-bold" : "text-surface-600 group-hover:text-surface-950"}`}>
                            {op}
                          </span>
                        </div>
                        <span className="text-xs text-surface-400 font-semibold">({count})</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Price Range Slider Filter */}
              <div className="card-premium p-5">
                <h3 className="font-bold text-surface-700 text-sm mb-3">Price Range</h3>
                <div className="flex justify-between text-xs text-surface-500 font-semibold mb-2">
                  <span>৳ {minPriceInTrips.toLocaleString()}</span>
                  <span>৳ {priceRange.toLocaleString()}</span>
                </div>
                <div className="pt-2">
                  <input
                    type="range"
                    min={minPriceInTrips}
                    max={maxPrice}
                    value={priceRange}
                    onChange={(e) => setPriceRange(Number(e.target.value))}
                    className="w-full accent-brand-600 cursor-pointer focus:outline-none"
                    style={{
                      background: `linear-gradient(to right, #DC2626 0%, #DC2626 ${
                        maxPrice > minPriceInTrips
                          ? ((priceRange - minPriceInTrips) / (maxPrice - minPriceInTrips)) * 100
                          : 100
                      }%, #E2E8F0 ${
                        maxPrice > minPriceInTrips
                          ? ((priceRange - minPriceInTrips) / (maxPrice - minPriceInTrips)) * 100
                          : 100
                      }%, #E2E8F0 100%)`,
                    }}
                  />
                </div>
              </div>
            </div>
          </aside>

          {/* ── Results Area ── */}
          <div className="flex-1 space-y-4">
            
            {/* Sort & filter bar */}
            <div className="flex items-center justify-between mb-5">
              <p className="text-sm text-surface-500">
                <span className="font-bold text-surface-900 text-base">{filteredTrips.length}</span> trips found
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
                  >
                    <option value="price-asc">Price: Low to High</option>
                    <option value="price-desc">Price: High to Low</option>
                    <option value="time-asc">Departure: Earliest</option>
                    <option value="time-desc">Departure: Latest</option>
                  </select>
                  <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-400 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Loading State */}
            {loading && (
              <div className="flex items-center justify-center py-20 bg-white rounded-2xl border border-surface-200 shadow-elevation-1 animate-fade-in">
                <div className="text-center">
                  <div className="w-12 h-12 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin mx-auto mb-4" />
                  <p className="text-surface-500 font-medium">Loading available routes...</p>
                </div>
              </div>
            )}

            {/* Empty State */}
            {!loading && filteredTrips.length === 0 && (
              <div className="card-premium p-12 text-center animate-fade-in">
                <Bus className="h-16 w-16 text-surface-300 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-surface-900 mb-2">No trips found</h3>
                <p className="text-surface-600 mb-6 font-medium">
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
                  const logo = getOperatorLogo(trip.operator_name);
                  const rating = getOperatorRating(trip.operator_name);

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
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${logo.bgClass}`}>
                                {logo.text}
                              </div>
                              <div>
                                <h3 className="font-bold text-surface-900 text-sm sm:text-base">{trip.operator_name}</h3>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className="badge badge-neutral text-[10px]">{trip.bus_type}</span>
                                  <div className="flex items-center gap-0.5">
                                    <Star className="h-3 w-3 text-accent-500 fill-accent-500" />
                                    <span className="text-xs font-semibold text-surface-600">{rating}</span>
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-4 sm:gap-8">
                              <div className="text-center">
                                <p className="text-lg font-bold text-surface-900">{departure}</p>
                                <p className="text-xs text-surface-500 font-medium">{trip.origin_city}</p>
                                <span className="text-[10px] text-brand-700 font-bold mt-1.5 bg-brand-50 px-1.5 py-0.5 rounded inline-block">
                                  {date}
                                </span>
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
                                <p className="text-xs text-surface-500 font-medium">{trip.destination_city}</p>
                                <span className="text-[10px] py-0.5 mt-1.5 opacity-0 select-none block">placeholder</span>
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
                              onClick={() => {
                                const isoDate = new Date(trip.departure_datetime).toISOString().split("T")[0];
                                saveRecentSearch(trip.origin_city, trip.destination_city, isoDate);
                                navigate(`/booking/select-seats/${trip.trip_id}`, {
                                  state: {
                                    origin: trip.origin_city,
                                    destination: trip.destination_city,
                                    date: isoDate,
                                    price: trip.fare_amount,
                                    operator: trip.operator_name,
                                    operator_id: (trip as any).operator_id,
                                    departureTime: departure,
                                    tripType,
                                    returnDate: filterReturnDate,
                                    isReturnStep,
                                    ...(isReturnStep && {
                                      outboundTrip: state.outboundTrip,
                                      outboundSeats: state.outboundSeats,
                                      outboundBoardingPoint: state.outboundBoardingPoint,
                                      outboundDroppingPoint: state.outboundDroppingPoint,
                                      outboundDate: state.outboundDate,
                                      outboundTotal: state.outboundTotal,
                                      originalOrigin: state.originalOrigin,
                                      originalDestination: state.originalDestination,
                                    }),
                                  },
                                });
                              }}
                              className="btn-primary !py-2.5 !px-5 !text-sm flex items-center gap-1.5 cursor-pointer"
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
                          <span className={`flex items-center gap-1 text-xs font-semibold ${
                            trip.available_seats <= 10
                              ? "text-red-600"
                              : trip.available_seats <= 20
                              ? "text-amber-600"
                              : "text-emerald-600"
                          }`}>
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
