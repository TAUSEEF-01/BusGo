import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../stores/authStore";
import { apiClient } from "../api/client";
import {
  Calendar,
  MapPin,
  Search,
  ArrowRight,
  Shield,
  Clock,
  Headphones,
  Star,
  TrendingDown,
  Bus,
  Wifi,
  Snowflake,
  Zap,
  Users,
  Quote,
  ChevronLeft,
  ChevronRight,
  Megaphone,
  X,
  RotateCcw,
  ArrowLeftRight,
  Tag,
} from "lucide-react";

const RECENT_SEARCHES_KEY = "busgo_recent_searches";
const MAX_RECENT_SEARCHES = 4;

interface RecentSearch {
  origin: string;
  destination: string;
  date: string;
  tripType: string;
  returnDate?: string;
  savedAt: number;
}

function saveRecentSearch(search: RecentSearch) {
  const existing: RecentSearch[] = JSON.parse(localStorage.getItem(RECENT_SEARCHES_KEY) || "[]");
  // Remove duplicate (same origin+dest)
  const filtered = existing.filter(
    (s) => !(s.origin === search.origin && s.destination === search.destination)
  );
  const updated = [search, ...filtered].slice(0, MAX_RECENT_SEARCHES);
  localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
}

function getRecentSearches(): RecentSearch[] {
  return JSON.parse(localStorage.getItem(RECENT_SEARCHES_KEY) || "[]");
}

/* ─── Scroll-triggered fade-in hook ────────────────── */
function useScrollFade() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add("visible");
        }
      },
      { threshold: 0.15 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return ref;
}

/* ─── Animated Counter ─────────────────────────────── */
function AnimatedCounter({ target, suffix = "" }: { target: number; suffix?: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const triggered = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !triggered.current) {
          triggered.current = true;
          const duration = 2000;
          const start = performance.now();
          const animate = (now: number) => {
            const progress = Math.min((now - start) / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setCount(Math.floor(eased * target));
            if (progress < 1) requestAnimationFrame(animate);
          };
          requestAnimationFrame(animate);
        }
      },
      { threshold: 0.5 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [target]);

  return <span ref={ref}>{count.toLocaleString()}{suffix}</span>;
}

const CITIES = [
  "Dhaka", "Chittagong", "Sylhet", "Cox's Bazar", 
  "Rajshahi", "Khulna", "Barisal", "Rangpur", 
  "Comilla", "Mymensingh", "Bogra", "Jessore"
];

/* ════════════════════════════════════════════════════
   HOME PAGE
   ════════════════════════════════════════════════════ */
export function Home() {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuthStore();

  // All hooks must be declared before any conditional return
  const [tripType, setTripType] = useState<"one-way" | "round-way">("one-way");
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [date, setDate] = useState("");
  const [returnDate, setReturnDate] = useState("");
  const [originQuery, setOriginQuery] = useState("");
  const [destQuery, setDestQuery] = useState("");
  const [showOriginDropdown, setShowOriginDropdown] = useState(false);
  const [showDestDropdown, setShowDestDropdown] = useState(false);
  const [allCities, setAllCities] = useState<string[]>([]);
  const originRef = useRef<HTMLDivElement>(null);
  const destRef = useRef<HTMLDivElement>(null);
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>(() => getRecentSearches());
  const [notices, setNotices] = useState<any[]>([]);
  const [dismissedNotices, setDismissedNotices] = useState<Set<string>>(new Set());
  const [popularTrips, setPopularTrips] = useState<any[]>([]);
  const [loadingPopular, setLoadingPopular] = useState(true);
  const stats = useScrollFade();
  const routes = useScrollFade();
  const howItWorks = useScrollFade();
  const features = useScrollFade();
  const testimonials = useScrollFade();

  useEffect(() => {
    if (isAuthenticated && user) {
      const role = user.role?.toUpperCase();
      if (role === "OPERATOR") {
        navigate("/operator", { replace: true });
      } else if (role === "ADMIN") {
        navigate("/admin", { replace: true });
      }
    }
  }, [isAuthenticated, user, navigate]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "visible") setRecentSearches(getRecentSearches());
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  // Fetch city list for autocomplete
  useEffect(() => {
    apiClient.get("/api/operators/trips/").then((res) => {
      if (res.data.success) {
        const trips = res.data.data || [];
        const cities = Array.from(new Set([
          ...trips.map((t: any) => t.origin_city),
          ...trips.map((t: any) => t.destination_city),
        ].filter(Boolean))) as string[];
        setAllCities(cities.sort());
      }
    }).catch(() => setAllCities(CITIES));
  }, []);

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (originRef.current && !originRef.current.contains(e.target as Node)) setShowOriginDropdown(false);
      if (destRef.current && !destRef.current.contains(e.target as Node)) setShowDestDropdown(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    apiClient.get("/api/admin/notices/active").then((res) => {
      if (res.data.success) setNotices(res.data.data);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const fetchPopular = async () => {
      try {
        const res = await apiClient.get("/api/operators/trips/");
        if (res.data.success) {
          const now = new Date();
          // Deduplicate by origin+destination, keep cheapest fare per route
          const seen = new Map<string, any>();
          for (const trip of (res.data.data || [])) {
            if (trip.status !== 'SCHEDULED' || !trip.departure_datetime || new Date(trip.departure_datetime) <= now) continue;
            const key = `${trip.origin_city}|${trip.destination_city}`;
            if (!seen.has(key) || trip.fare_amount < seen.get(key).fare_amount) {
              seen.set(key, trip);
            }
          }
          setPopularTrips(Array.from(seen.values()).slice(0, 6));
        }
      } catch (err) {
        console.error("Failed to fetch popular routes", err);
      } finally {
        setLoadingPopular(false);
      }
    };
    fetchPopular();
  }, []);

  if (isAuthenticated && user && (user.role?.toUpperCase() === "OPERATOR" || user.role?.toUpperCase() === "ADMIN")) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-50">
        <div className="w-12 h-12 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
      </div>
    );
  }

  const filteredOriginCities = allCities.filter(
    (c) => c.toLowerCase().includes(originQuery.toLowerCase()) && c !== destination
  );
  const filteredDestCities = allCities.filter(
    (c) => c.toLowerCase().includes(destQuery.toLowerCase()) && c !== origin
  );

  const selectOrigin = (city: string) => {
    setOrigin(city);
    setOriginQuery(city);
    setShowOriginDropdown(false);
  };
  const selectDest = (city: string) => {
    setDestination(city);
    setDestQuery(city);
    setShowDestDropdown(false);
  };
  const swapCities = () => {
    setOrigin(destination);
    setOriginQuery(destination);
    setDestination(origin);
    setDestQuery(origin);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (origin && destination && date) {
      const search: RecentSearch = { 
        origin, 
        destination, 
        date, 
        tripType: tripType === "round-way" ? "Round Way" : "One Way", 
        returnDate: tripType === "round-way" ? returnDate : undefined,
        savedAt: Date.now() 
      };
      saveRecentSearch(search);
      setRecentSearches(getRecentSearches());
      const returnParam = tripType === "round-way" && returnDate ? `&returnDate=${returnDate}&tripType=round-way` : "";
      navigate(`/search?origin=${origin}&destination=${destination}&date=${date}${returnParam}`);
    }
  };

  const handleRecentClick = (s: RecentSearch) => {
    const returnParam = s.returnDate && s.tripType === "Round Way" ? `&returnDate=${s.returnDate}&tripType=round-way` : "";
    navigate(`/search?origin=${s.origin}&destination=${s.destination}&date=${s.date}${returnParam}`);
  };

  const dismissNotice = (id: string) => {
    setDismissedNotices((prev) => new Set(prev).add(id));
  };

  const visibleNotices = notices.filter((n) => !dismissedNotices.has(n.id));

  const getGradient = (i: number) => {
    const gradients = [
      "from-red-500 to-orange-500",
      "from-blue-500 to-cyan-500",
      "from-emerald-500 to-teal-500",
      "from-purple-500 to-pink-500",
      "from-amber-500 to-orange-500",
      "from-indigo-500 to-blue-500",
    ];
    return gradients[i % gradients.length];
  };

  return (
    <div className="flex flex-col">
      {/* ──── HERO SECTION ──── */}
      <section className="relative min-h-[85vh] flex items-center hero-gradient" id="hero-section">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-20 -right-20 w-96 h-96 bg-white/5 rounded-full blur-3xl floating" />
          <div className="absolute top-1/3 -left-32 w-80 h-80 bg-white/5 rounded-full blur-3xl floating-delayed" />
          <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
        </div>

        <div className="relative z-10 w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-24 mt-8">
          {/* Headline */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 text-white/90 text-sm font-medium mb-6 animate-fade-in-down">
              <Zap className="h-4 w-4 text-accent-400" />
              <span>Bangladesh's Largest Online Bus Ticket Platform</span>
            </div>
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-white tracking-tight leading-tight animate-fade-in-up" id="hero-heading">
              Book Bus Tickets
              <span className="block text-accent-400">Anywhere in Bangladesh</span>
            </h1>

            {/* Bus Animation */}
            <div className="mt-8 mb-2 flex flex-col items-center justify-center animate-fade-in-up animate-delay-200">
              <div className="relative inline-block">
                {/* Animated Bus */}
                <div className="bus-animation">
                  <Bus className="h-16 w-16 sm:h-20 sm:w-20 text-white drop-shadow-lg" />
                </div>
                {/* Road line */}
                <div className="mt-2 h-0.5 w-36 sm:w-44 bg-white/20 rounded-full overflow-hidden">
                  <div className="h-full w-1/3 bg-white/60 rounded-full animate-road-line" />
                </div>
              </div>
            </div>
          </div>

          {/* ── Search Card ── */}
          <form onSubmit={handleSearch} className="bg-white rounded-2xl shadow-2xl p-6 animate-fade-in-up animate-delay-200" id="hero-search-form">
            {/* Trip type toggle */}
            <div className="flex gap-2 mb-5">
              <button
                type="button"
                onClick={() => setTripType("one-way")}
                className={`px-5 py-2 rounded-full text-sm font-bold transition-all ${tripType === "one-way" ? "bg-brand-600 text-white shadow-sm" : "bg-surface-100 text-surface-600 hover:bg-surface-200"}`}
              >
                One Way
              </button>
              <button
                type="button"
                onClick={() => setTripType("round-way")}
                className={`px-5 py-2 rounded-full text-sm font-bold transition-all ${tripType === "round-way" ? "bg-brand-600 text-white shadow-sm" : "bg-surface-100 text-surface-600 hover:bg-surface-200"}`}
              >
                Round Way
              </button>
            </div>

            {/* Inputs row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-end">
              {/* From */}
              <div className="lg:col-span-3 relative" ref={originRef}>
                <label className="block text-xs font-bold text-surface-500 uppercase tracking-wider mb-1.5">From</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-brand-500 pointer-events-none" />
                  <input
                    id="origin-input"
                    type="text"
                    value={originQuery}
                    onChange={(e) => { setOriginQuery(e.target.value); setOrigin(""); setShowOriginDropdown(true); }}
                    onFocus={() => setShowOriginDropdown(true)}
                    placeholder="Departure city"
                    className="w-full pl-9 pr-3 py-3 border-2 border-surface-200 rounded-xl text-sm font-medium text-surface-900 focus:outline-none focus:border-brand-500 transition-colors placeholder:text-surface-400"
                    autoComplete="off"
                  />
                </div>
                {showOriginDropdown && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-surface-200 rounded-xl shadow-xl z-50 max-h-60 overflow-y-auto">
                    {recentSearches.length > 0 && !originQuery && (
                      <div>
                        <p className="px-3 pt-2 pb-1 text-[10px] font-bold text-surface-400 uppercase tracking-wider">Recent</p>
                        {recentSearches.map((s, i) => (
                          <button key={i} type="button" onClick={() => selectOrigin(s.origin)}
                            className="w-full flex items-center gap-2 px-3 py-2 hover:bg-brand-50 text-left text-sm text-surface-700 transition-colors">
                            <RotateCcw className="h-3.5 w-3.5 text-surface-400 flex-shrink-0" />
                            <span className="font-medium">{s.origin}</span>
                            <span className="text-surface-400 text-xs ml-auto">→ {s.destination}</span>
                          </button>
                        ))}
                        {filteredOriginCities.length > 0 && <hr className="border-surface-100 my-1" />}
                      </div>
                    )}
                    {filteredOriginCities.map((city) => (
                      <button key={city} type="button" onClick={() => selectOrigin(city)}
                        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-brand-50 text-left text-sm text-surface-700 transition-colors">
                        <MapPin className="h-3.5 w-3.5 text-surface-400 flex-shrink-0" />
                        {city}
                      </button>
                    ))}
                    {filteredOriginCities.length === 0 && originQuery && (
                      <p className="px-3 py-3 text-sm text-surface-400 text-center">No cities found</p>
                    )}
                  </div>
                )}
              </div>

              {/* Swap button */}
              <div className="lg:col-span-1 flex items-end justify-center pb-0.5">
                <button type="button" onClick={swapCities}
                  className="w-10 h-10 rounded-full border-2 border-surface-200 bg-white hover:border-brand-400 hover:bg-brand-50 flex items-center justify-center transition-all group">
                  <ArrowLeftRight className="h-4 w-4 text-surface-400 group-hover:text-brand-600 transition-colors" />
                </button>
              </div>

              {/* To */}
              <div className="lg:col-span-3 relative" ref={destRef}>
                <label className="block text-xs font-bold text-surface-500 uppercase tracking-wider mb-1.5">To</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-red-500 pointer-events-none" />
                  <input
                    type="text"
                    value={destQuery}
                    onChange={(e) => { setDestQuery(e.target.value); setDestination(""); setShowDestDropdown(true); }}
                    onFocus={() => setShowDestDropdown(true)}
                    placeholder="Destination city"
                    className="w-full pl-9 pr-3 py-3 border-2 border-surface-200 rounded-xl text-sm font-medium text-surface-900 focus:outline-none focus:border-brand-500 transition-colors placeholder:text-surface-400"
                    autoComplete="off"
                  />
                </div>
                {showDestDropdown && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-surface-200 rounded-xl shadow-xl z-50 max-h-60 overflow-y-auto">
                    {recentSearches.length > 0 && !destQuery && (
                      <div>
                        <p className="px-3 pt-2 pb-1 text-[10px] font-bold text-surface-400 uppercase tracking-wider">Recent</p>
                        {recentSearches.map((s, i) => (
                          <button key={i} type="button" onClick={() => selectDest(s.destination)}
                            className="w-full flex items-center gap-2 px-3 py-2 hover:bg-brand-50 text-left text-sm text-surface-700 transition-colors">
                            <RotateCcw className="h-3.5 w-3.5 text-surface-400 flex-shrink-0" />
                            <span className="font-medium">{s.destination}</span>
                            <span className="text-surface-400 text-xs ml-auto">{s.origin} →</span>
                          </button>
                        ))}
                        {filteredDestCities.length > 0 && <hr className="border-surface-100 my-1" />}
                      </div>
                    )}
                    {filteredDestCities.map((city) => (
                      <button key={city} type="button" onClick={() => selectDest(city)}
                        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-brand-50 text-left text-sm text-surface-700 transition-colors">
                        <MapPin className="h-3.5 w-3.5 text-surface-400 flex-shrink-0" />
                        {city}
                      </button>
                    ))}
                    {filteredDestCities.length === 0 && destQuery && (
                      <p className="px-3 py-3 text-sm text-surface-400 text-center">No cities found</p>
                    )}
                  </div>
                )}
              </div>

              {/* Journey date */}
              <div className={tripType === "round-way" ? "lg:col-span-2" : "lg:col-span-3"}>
                <label className="block text-xs font-bold text-surface-500 uppercase tracking-wider mb-1.5">Journey Date</label>
                <div className="relative">
                  <input
                    type="date"
                    value={date}
                    min={new Date().toISOString().split("T")[0]}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full pl-4 pr-3 py-3 border-2 border-surface-200 rounded-xl text-sm font-medium text-surface-900 focus:outline-none focus:border-brand-500 transition-colors cursor-pointer"
                  />
                </div>
              </div>

              {/* Return date (round-way only) */}
              {tripType === "round-way" && (
                <div className="lg:col-span-2">
                  <label className="block text-xs font-bold text-surface-500 uppercase tracking-wider mb-1.5">Return Date</label>
                  <div className="relative">
                    <input
                      type="date"
                      value={returnDate}
                      min={date || new Date().toISOString().split("T")[0]}
                      onChange={(e) => setReturnDate(e.target.value)}
                      className="w-full pl-4 pr-3 py-3 border-2 border-surface-200 rounded-xl text-sm font-medium text-surface-900 focus:outline-none focus:border-brand-500 transition-colors cursor-pointer"
                    />
                  </div>
                </div>
              )}

              {/* Search button */}
              <div className={tripType === "round-way" ? "lg:col-span-1" : "lg:col-span-2"}>
                <label className="block text-xs font-bold text-transparent uppercase tracking-wider mb-1.5 select-none">.</label>
                <button
                  type="submit"
                  disabled={!origin || !destination || !date}
                  className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg hover:shadow-brand text-sm"
                  id="hero-search-btn"
                >
                  <Search className="h-4 w-4" />
                  Search
                </button>
              </div>
            </div>
          </form>

          {/* Trust pills */}
          <div className="flex flex-wrap items-center justify-center gap-6 mt-8 text-white/70 text-sm">
            {[
              { icon: Zap, label: "Instant Booking" },
              { icon: Shield, label: "Secure Payment" },
              { icon: Star, label: "Best Prices" },
              { icon: Tag, label: "Exclusive Deals" },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center">
                  <Icon className="h-3.5 w-3.5 text-accent-400" />
                </div>
                <span>{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom wave */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 120" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full">
            <path d="M0 120L60 110C120 100 240 80 360 70C480 60 600 60 720 65C840 70 960 80 1080 85C1200 90 1320 90 1380 90L1440 90V120H1380C1320 120 1200 120 1080 120C960 120 840 120 720 120C600 120 480 120 360 120C240 120 120 120 60 120H0Z" fill="#F8FAFC"/>
          </svg>
        </div>
      </section>

      {/* ──── STATS SECTION ──── */}
      <section className="py-16 bg-surface-50" id="stats-section">
        <div ref={stats} className="scroll-fade max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { icon: Users, value: 10, suffix: "M+", label: "Happy Travelers", color: "brand" },
              { icon: Bus, value: 50, suffix: "K+", label: "Bus Operators", color: "accent" },
              { icon: MapPin, value: 500, suffix: "+", label: "Routes Covered", color: "brand" },
              { icon: Star, value: 4, suffix: ".9", label: "User Rating", color: "accent" },
            ].map((stat, i) => (
              <div
                key={stat.label}
                className="card-premium p-6 text-center group"
                style={{ animationDelay: `${i * 100}ms` }}
              >
                <div className={`w-12 h-12 rounded-xl mx-auto mb-3 flex items-center justify-center ${
                  stat.color === "brand" ? "bg-brand-50 text-brand-600" : "bg-accent-50 text-accent-600"
                } group-hover:scale-110 transition-transform duration-300`}>
                  <stat.icon className="h-6 w-6" />
                </div>
                <p className="text-3xl sm:text-4xl font-extrabold text-surface-900 font-display">
                  <AnimatedCounter target={stat.value} suffix={stat.suffix} />
                </p>
                <p className="text-surface-500 text-sm font-medium mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ──── NOTICES ──── */}
      {visibleNotices.length > 0 && (
        <section className="bg-gradient-to-b from-amber-50/70 to-surface-50 border-y border-amber-100/80 py-6" id="notices-section">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-4">
            {visibleNotices.map((notice) => (
              <div
                key={notice.id}
                className="relative overflow-hidden bg-gradient-to-r from-amber-500/[0.03] to-orange-500/[0.03] hover:from-amber-500/[0.06] hover:to-orange-500/[0.06] border border-amber-500/20 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all duration-300 flex items-start gap-4 animate-fade-in-up"
              >
                {/* Left Accent Bar */}
                <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-amber-500 to-orange-500" />
                
                {/* Speaker icon with wobble animation */}
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 text-white flex items-center justify-center flex-shrink-0 shadow-md shadow-amber-500/20">
                  <Megaphone className="h-5 w-5 animate-wobble" />
                </div>

                {/* Text Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="bg-amber-500/10 text-amber-800 text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md tracking-wider border border-amber-500/20">
                      Announcement
                    </span>
                    <h4 className="font-extrabold text-surface-900 text-sm sm:text-base tracking-tight">
                      {notice.title}
                    </h4>
                  </div>
                  <p className="text-surface-600 text-sm mt-2 whitespace-pre-line leading-relaxed font-medium">
                    {notice.body}
                  </p>
                </div>

                {/* Dismiss button */}
                <button
                  onClick={() => dismissNotice(notice.id)}
                  className="p-2 rounded-xl bg-surface-100/50 hover:bg-amber-500/10 hover:text-amber-800 text-surface-400 transition-colors flex-shrink-0 cursor-pointer"
                  title="Dismiss"
                  id={`dismiss-notice-${notice.id}`}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ──── RECENT SEARCHES ──── */}
      {recentSearches.length > 0 && (
        <section className="py-10 bg-surface-50" id="recent-searches">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-xl font-bold text-surface-900 mb-5">Your Recent Searches</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {recentSearches.map((s, i) => {
                const from = new Date(s.date);
                const fmtDate = from.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).replace(/ /g, "-");
                return (
                  <button
                    key={i}
                    onClick={() => handleRecentClick(s)}
                    className="group bg-white border border-surface-200 rounded-2xl p-5 text-left hover:border-brand-300 hover:shadow-elevation-2 transition-all duration-200"
                  >
                    <div className="w-9 h-9 rounded-xl bg-brand-50 flex items-center justify-center mb-3 group-hover:bg-brand-100 transition-colors">
                      <RotateCcw className="h-4 w-4 text-brand-600" />
                    </div>
                    <div className="flex items-center gap-1.5 font-bold text-surface-900 text-base">
                      {s.origin}
                      <ArrowRight className="h-3.5 w-3.5 text-surface-400 flex-shrink-0" />
                      {s.destination}
                    </div>
                    <p className="text-surface-500 text-xs mt-1">{fmtDate}</p>
                    <p className="text-surface-400 text-xs">{s.tripType}</p>
                    <p className="text-brand-600 text-xs font-semibold mt-3 group-hover:underline">Check Prices &rsaquo;</p>
                  </button>
                );
              })}
              {/* Start a new search card */}
              <button
                onClick={() => document.getElementById("origin-input")?.focus()}
                className="bg-surface-100 border border-dashed border-surface-300 rounded-2xl p-5 flex flex-col items-center justify-center gap-2 hover:bg-surface-200 transition-colors"
              >
                <div className="w-10 h-10 rounded-full bg-surface-200 flex items-center justify-center">
                  <Search className="h-5 w-5 text-surface-400" />
                </div>
                <p className="text-surface-500 text-sm font-medium">Start a new search</p>
              </button>
            </div>
          </div>
        </section>
      )}

      {/* ──── POPULAR ROUTES ──── */}
      <section className="py-20 bg-white" id="popular-routes">
        <div ref={routes} className="scroll-fade max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <span className="inline-block px-3 py-1 rounded-full bg-brand-50 text-brand-600 text-xs font-bold uppercase tracking-wider mb-3">
              Popular Routes
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-surface-900">
              Top destinations travelers love
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {loadingPopular ? (
              <div className="col-span-full py-12 text-center text-surface-400">Loading routes...</div>
            ) : popularTrips.length > 0 ? (
              popularTrips.map((route, i) => (
                <button
                  key={route.id}
                  onClick={() => {
                    const d = route.departure_datetime.split('T')[0];
                    saveRecentSearch({ origin: route.origin_city, destination: route.destination_city, date: d, tripType: "Round Way", savedAt: Date.now() });
                    setRecentSearches(getRecentSearches());
                    navigate(`/search?origin=${route.origin_city}&destination=${route.destination_city}&date=${d}`);
                  }}
                  className="group card-premium p-0 overflow-hidden text-left"
                  id={`route-card-${i}`}
                >
                  {/* Colored header */}
                  <div className={`h-2 bg-gradient-to-r ${getGradient(i)}`} />
                  <div className="p-5">
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${getGradient(i)} flex items-center justify-center text-white shadow-lg`}>
                        <Bus className="h-5 w-5" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 text-surface-900 font-bold text-lg">
                          {route.origin_city}
                          <ArrowRight className="h-4 w-4 text-surface-400 group-hover:text-brand-500 group-hover:translate-x-0.5 transition-all" />
                          {route.destination_city}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-4">
                      <div className="flex items-center gap-4 text-sm text-surface-500">
                        <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {route.operator_name}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-xs text-surface-400">from</span>
                        <p className="text-lg font-bold text-brand-600">৳ {route.fare_amount}</p>
                      </div>
                    </div>
                  </div>
                </button>
              ))
            ) : (
              <div className="col-span-full py-12 text-center text-surface-400 italic">No live routes currently available.</div>
            )}
          </div>
        </div>
      </section>

      {/* ──── HOW IT WORKS ──── */}
      <section className="py-20 bg-surface-50" id="how-it-works">
        <div ref={howItWorks} className="scroll-fade max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <span className="inline-block px-3 py-1 rounded-full bg-brand-50 text-brand-600 text-xs font-bold uppercase tracking-wider mb-3">
              How It Works
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-surface-900">
              Book your ticket in 3 simple steps
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            {/* Connecting line */}
            <div className="hidden md:block absolute top-16 left-[20%] right-[20%] h-0.5 bg-gradient-to-r from-brand-200 via-brand-400 to-brand-200" />

            {[
              { step: 1, title: "Search", desc: "Enter your origin, destination, and travel date to browse available buses from top operators.", icon: Search, color: "from-brand-500 to-brand-600" },
              { step: 2, title: "Select & Book", desc: "Choose your preferred bus, pick your favorite seat, and enter passenger details securely.", icon: Zap, color: "from-accent-500 to-accent-600" },
              { step: 3, title: "Pay & Travel", desc: "Complete payment via bKash, Nagad, or card. Get your e-ticket instantly on your phone.", icon: Shield, color: "from-emerald-500 to-emerald-600" },
            ].map((item) => (
              <div key={item.step} className="relative flex flex-col items-center text-center">
                <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${item.color} flex items-center justify-center text-white shadow-lg z-10 mb-6`}>
                  <item.icon className="h-7 w-7" />
                </div>
                <span className="text-xs font-bold text-surface-400 uppercase tracking-widest mb-2">Step {item.step}</span>
                <h3 className="text-xl font-bold text-surface-900 mb-2">{item.title}</h3>
                <p className="text-surface-500 leading-relaxed text-sm max-w-xs">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ──── WHY BUSGO ──── */}
      <section className="py-20 bg-white" id="why-busgo">
        <div ref={features} className="scroll-fade max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <span className="inline-block px-3 py-1 rounded-full bg-brand-50 text-brand-600 text-xs font-bold uppercase tracking-wider mb-3">
              Why BusGo
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-surface-900">
              The smarter way to book bus tickets
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: TrendingDown, title: "Best Prices", desc: "We compare prices across operators so you always get the best deal.", color: "bg-emerald-50 text-emerald-600" },
              { icon: Shield, title: "Secure Payments", desc: "Bank-grade encryption protects every transaction you make.", color: "bg-blue-50 text-blue-600" },
              { icon: Headphones, title: "24/7 Support", desc: "Our support team is always available to help with any issues.", color: "bg-purple-50 text-purple-600" },
              { icon: Clock, title: "Instant Booking", desc: "Confirm your seat in seconds. No waiting, no hassle.", color: "bg-amber-50 text-amber-600" },
              { icon: Wifi, title: "Live Tracking", desc: "Track your bus in real-time and share your location with loved ones.", color: "bg-cyan-50 text-cyan-600" },
              { icon: Star, title: "Verified Reviews", desc: "Read genuine reviews from real travelers before you book.", color: "bg-pink-50 text-pink-600" },
              { icon: Snowflake, title: "AC & Non-AC", desc: "Choose from a wide range of AC and Non-AC buses to suit your budget.", color: "bg-indigo-50 text-indigo-600" },
              { icon: Zap, title: "E-Ticket", desc: "Paperless travel with QR-code tickets delivered straight to your phone.", color: "bg-orange-50 text-orange-600" },
            ].map((feature, i) => (
              <div key={i} className="card-premium p-6 group" id={`feature-${i}`}>
                <div className={`w-12 h-12 rounded-xl ${feature.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}>
                  <feature.icon className="h-6 w-6" />
                </div>
                <h3 className="text-base font-bold text-surface-900 mb-1.5">{feature.title}</h3>
                <p className="text-surface-500 text-sm leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ──── TESTIMONIALS ──── */}
      <TestimonialsSection sectionRef={testimonials} />

      {/* ──── CTA BANNER ──── */}
      <section className="py-20 bg-white" id="cta-section">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative hero-gradient rounded-3xl overflow-hidden px-8 py-16 sm:px-16 text-center">
            {/* Background decorations */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <div className="absolute -top-10 -right-10 w-60 h-60 bg-white/5 rounded-full blur-2xl" />
              <div className="absolute -bottom-10 -left-10 w-48 h-48 bg-white/5 rounded-full blur-2xl" />
            </div>

            <div className="relative z-10">
              <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-4">
                Ready to start your journey?
              </h2>
              <p className="text-white/70 text-lg mb-8 max-w-xl mx-auto">
                Join millions of travelers who trust BusGo for their daily commute and long-distance travel.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <button
                  onClick={() => document.getElementById('origin-input')?.focus()}
                  className="bg-white text-brand-600 font-bold px-8 py-3.5 rounded-xl hover:bg-white/90 transition-all shadow-xl hover:shadow-2xl hover:-translate-y-0.5 flex items-center gap-2"
                  id="cta-book-now"
                >
                  <Search className="h-5 w-5" />
                  Book Now
                </button>
                <button className="text-white/90 font-semibold px-8 py-3.5 rounded-xl border-2 border-white/30 hover:bg-white/10 transition-all flex items-center gap-2">
                  Learn More
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

/* ─── Testimonials Carousel ────────────────────────── */
function TestimonialsSection({ sectionRef }: { sectionRef: React.RefObject<HTMLDivElement | null> }) {
  const [active, setActive] = useState(0);

  const testimonials = [
    {
      name: "Rashida Akter",
      role: "Frequent Traveler",
      text: "BusGo has completely changed how I book bus tickets. The seat selection feature is amazing — I can pick my favorite window seat every time!",
      rating: 5,
      initial: "R",
      color: "from-brand-500 to-pink-500",
    },
    {
      name: "Kamal Hossain",
      role: "Business Professional",
      text: "I travel Dhaka to Chittagong every week. BusGo saves me at least 15 minutes per booking compared to buying at the counter. Highly recommended!",
      rating: 5,
      initial: "K",
      color: "from-blue-500 to-indigo-500",
    },
    {
      name: "Nusrat Jahan",
      role: "Student",
      text: "The prices are always competitive, and I love that I can compare different operators side by side. The e-ticket feature means no more paper hassle!",
      rating: 4,
      initial: "N",
      color: "from-emerald-500 to-teal-500",
    },
  ];

  const next = () => setActive((a) => (a + 1) % testimonials.length);
  const prev = () => setActive((a) => (a - 1 + testimonials.length) % testimonials.length);

  useEffect(() => {
    const timer = setInterval(next, 6000);
    return () => clearInterval(timer);
  }, []);

  const t = testimonials[active];

  return (
    <section className="py-20 bg-surface-50" id="testimonials">
      <div ref={sectionRef} className="scroll-fade max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14">
          <span className="inline-block px-3 py-1 rounded-full bg-brand-50 text-brand-600 text-xs font-bold uppercase tracking-wider mb-3">
            Testimonials
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-surface-900">
            Loved by travelers everywhere
          </h2>
        </div>

        <div className="max-w-3xl mx-auto">
          <div className="card-premium p-8 sm:p-12 text-center relative" id="testimonial-card">
            <Quote className="h-10 w-10 text-brand-100 mx-auto mb-6" />

            <p className="text-lg sm:text-xl text-surface-700 leading-relaxed mb-8 font-body min-h-[80px]">
              "{t.text}"
            </p>

            <div className="flex items-center justify-center gap-3 mb-4">
              <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${t.color} flex items-center justify-center text-white font-bold text-lg shadow-lg`}>
                {t.initial}
              </div>
              <div className="text-left">
                <p className="font-bold text-surface-900">{t.name}</p>
                <p className="text-sm text-surface-500">{t.role}</p>
              </div>
            </div>

            <div className="flex items-center justify-center gap-0.5 mb-6">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  className={`h-4 w-4 ${i < t.rating ? "text-accent-400 fill-accent-400" : "text-surface-300"}`}
                />
              ))}
            </div>

            {/* Navigation */}
            <div className="flex items-center justify-center gap-4">
              <button onClick={prev} className="p-2 rounded-full hover:bg-surface-100 text-surface-400 hover:text-surface-700 transition-colors" id="testimonial-prev">
                <ChevronLeft className="h-5 w-5" />
              </button>
              <div className="flex gap-2">
                {testimonials.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setActive(i)}
                    className={`w-2 h-2 rounded-full transition-all duration-300 ${
                      i === active ? "w-6 bg-brand-500" : "bg-surface-300 hover:bg-surface-400"
                    }`}
                  />
                ))}
              </div>
              <button onClick={next} className="p-2 rounded-full hover:bg-surface-100 text-surface-400 hover:text-surface-700 transition-colors" id="testimonial-next">
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}