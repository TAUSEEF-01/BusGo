import { useState, useEffect, useMemo } from "react";
import { apiClient } from "../api/client";
import { useAuthStore } from "../stores/authStore";
import {
  DollarSign, Ticket, Bus, TrendingUp, TrendingDown, BarChart3, Calendar,
  MapPin, ArrowRight, AlertTriangle, Lightbulb, ChevronLeft, ChevronRight,
  Clock, Filter, Percent, XCircle, CheckCircle, Activity,
} from "lucide-react";

/* ═══════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════ */
interface Booking {
  id: string;
  status: string;
  total_fare: number;
  created_at: string;
  journey_date: string;
  seat_numbers: string[];
  boarding_point: string;
  dropping_point: string;
  departure_time?: string;
  trip_id?: string;
}

interface Trip {
  id?: string;
  trip_id?: string;
  status: string;
  departure_datetime: string;
  arrival_datetime: string;
  fare_amount: number;
  available_seats: number;
  origin_city: string;
  destination_city: string;
  bus_type: string;
  operator_name?: string;
  bus_id?: string;
}

type DatePreset = "today" | "week" | "month" | "custom";

/* ═══════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════ */
function getDateRange(preset: DatePreset, customFrom?: string, customTo?: string): [Date, Date] {
  const now = new Date();
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  switch (preset) {
    case "today": {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      return [start, endOfDay];
    }
    case "week": {
      const start = new Date(now);
      start.setDate(now.getDate() - 6);
      start.setHours(0, 0, 0, 0);
      return [start, endOfDay];
    }
    case "month": {
      const start = new Date(now);
      start.setDate(now.getDate() - 29);
      start.setHours(0, 0, 0, 0);
      return [start, endOfDay];
    }
    case "custom": {
      const from = customFrom ? new Date(customFrom + "T00:00:00") : new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
      const to = customTo ? new Date(customTo + "T23:59:59") : endOfDay;
      return [from, to];
    }
  }
}

function getPreviousPeriod(from: Date, to: Date): [Date, Date] {
  const duration = to.getTime() - from.getTime();
  const prevTo = new Date(from.getTime() - 1);
  const prevFrom = new Date(prevTo.getTime() - duration);
  return [prevFrom, prevTo];
}

function inRange(dateStr: string, from: Date, to: Date): boolean {
  const d = new Date(dateStr);
  return d >= from && d <= to;
}

function pctChange(current: number, previous: number): { text: string; up: boolean } {
  if (previous === 0 && current === 0) return { text: "0%", up: true };
  if (previous === 0) return { text: "+100%", up: true };
  const pct = ((current - previous) / previous) * 100;
  const sign = pct >= 0 ? "+" : "";
  return { text: `${sign}${pct.toFixed(1)}%`, up: pct >= 0 };
}

function formatCurrency(val: number): string {
  if (val >= 1_000_000) return `৳ ${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `৳ ${(val / 1_000).toFixed(1)}K`;
  return `৳ ${Math.round(val).toLocaleString()}`;
}

function formatShortDate(d: Date): string {
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

/* ═══════════════════════════════════════════════════
   SVG LINE CHART COMPONENT
   ═══════════════════════════════════════════════════ */
function DualLineChart({
  data,
}: {
  data: { date: string; revenue: number; bookings: number }[];
}) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-surface-400 text-sm">
        No data available for this period
      </div>
    );
  }

  const W = 720;
  const H = 260;
  const PL = 60; // padding left
  const PR = 60; // padding right
  const PT = 20; // padding top
  const PB = 50; // padding bottom
  const chartW = W - PL - PR;
  const chartH = H - PT - PB;

  const maxRev = Math.max(...data.map((d) => d.revenue), 1);
  const maxBook = Math.max(...data.map((d) => d.bookings), 1);

  const xStep = data.length > 1 ? chartW / (data.length - 1) : chartW;

  const revenuePoints = data.map((d, i) => ({
    x: PL + i * xStep,
    y: PT + chartH - (d.revenue / maxRev) * chartH,
  }));

  const bookingPoints = data.map((d, i) => ({
    x: PL + i * xStep,
    y: PT + chartH - (d.bookings / maxBook) * chartH,
  }));

  const makePathD = (points: { x: number; y: number }[]) =>
    points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");

  const revAreaD =
    makePathD(revenuePoints) +
    ` L ${revenuePoints[revenuePoints.length - 1].x} ${PT + chartH} L ${revenuePoints[0].x} ${PT + chartH} Z`;

  // Y-axis ticks (revenue)
  const revTicks = [0, 0.25, 0.5, 0.75, 1].map((frac) => ({
    y: PT + chartH - frac * chartH,
    label: formatCurrency(frac * maxRev),
  }));

  // Y-axis ticks (bookings)
  const bookTicks = [0, 0.25, 0.5, 0.75, 1].map((frac) => ({
    y: PT + chartH - frac * chartH,
    label: Math.round(frac * maxBook).toString(),
  }));

  // X-axis labels — show every Nth label to avoid overlap
  const labelEvery = data.length > 14 ? Math.ceil(data.length / 7) : data.length > 7 ? 2 : 1;

  return (
    <div className="relative w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full min-w-[500px]"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <linearGradient id="revAreaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#EF4444" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#EF4444" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* Gridlines */}
        {revTicks.map((t, i) => (
          <line
            key={i}
            x1={PL}
            x2={W - PR}
            y1={t.y}
            y2={t.y}
            stroke="#E2E8F0"
            strokeWidth="0.5"
            strokeDasharray={i === 0 ? "0" : "4 3"}
          />
        ))}

        {/* Revenue area fill */}
        <path d={revAreaD} fill="url(#revAreaGrad)" />

        {/* Revenue line */}
        <path d={makePathD(revenuePoints)} fill="none" stroke="#DC2626" strokeWidth="2.5" strokeLinejoin="round" />

        {/* Bookings line */}
        <path d={makePathD(bookingPoints)} fill="none" stroke="#3B82F6" strokeWidth="2" strokeDasharray="6 3" strokeLinejoin="round" />

        {/* Revenue dots */}
        {revenuePoints.map((p, i) => (
          <circle key={`rv-${i}`} cx={p.x} cy={p.y} r={hoveredIdx === i ? 5 : 3} fill="#DC2626" className="transition-all duration-150" />
        ))}

        {/* Booking dots */}
        {bookingPoints.map((p, i) => (
          <circle key={`bk-${i}`} cx={p.x} cy={p.y} r={hoveredIdx === i ? 5 : 3} fill="#3B82F6" className="transition-all duration-150" />
        ))}

        {/* Left Y-axis labels (revenue) */}
        {revTicks.map((t, i) => (
          <text key={`yl-${i}`} x={PL - 6} y={t.y + 4} textAnchor="end" fontSize="9" fill="#94A3B8" fontWeight="600">
            {t.label}
          </text>
        ))}

        {/* Right Y-axis labels (bookings) */}
        {bookTicks.map((t, i) => (
          <text key={`yr-${i}`} x={W - PR + 6} y={t.y + 4} textAnchor="start" fontSize="9" fill="#3B82F6" fontWeight="600">
            {t.label}
          </text>
        ))}

        {/* X-axis labels */}
        {data.map((d, i) => {
          if (i % labelEvery !== 0 && i !== data.length - 1) return null;
          return (
            <text key={`xl-${i}`} x={PL + i * xStep} y={H - PB + 18} textAnchor="middle" fontSize="9" fill="#94A3B8" fontWeight="600">
              {d.date}
            </text>
          );
        })}

        {/* Invisible hover zones */}
        {data.map((d, i) => (
          <rect
            key={`hz-${i}`}
            x={PL + i * xStep - (xStep > 10 ? xStep / 2 : 5)}
            y={PT}
            width={xStep > 10 ? xStep : 10}
            height={chartH}
            fill="transparent"
            onMouseEnter={() => setHoveredIdx(i)}
            onMouseLeave={() => setHoveredIdx(null)}
            className="cursor-crosshair"
          />
        ))}

        {/* Hover crosshair + tooltip */}
        {hoveredIdx !== null && (
          <>
            <line
              x1={PL + hoveredIdx * xStep}
              x2={PL + hoveredIdx * xStep}
              y1={PT}
              y2={PT + chartH}
              stroke="#94A3B8"
              strokeWidth="1"
              strokeDasharray="3 3"
              opacity="0.6"
            />
            {/* Tooltip background */}
            <rect
              x={Math.min(PL + hoveredIdx * xStep - 70, W - PR - 140)}
              y={PT - 2}
              width="140"
              height="48"
              rx="8"
              fill="#0F172A"
              opacity="0.95"
            />
            <text
              x={Math.min(PL + hoveredIdx * xStep - 60, W - PR - 130)}
              y={PT + 14}
              fontSize="10"
              fill="#F8FAFC"
              fontWeight="700"
            >
              {data[hoveredIdx].date}
            </text>
            <text
              x={Math.min(PL + hoveredIdx * xStep - 60, W - PR - 130)}
              y={PT + 28}
              fontSize="9"
              fill="#FCA5A5"
              fontWeight="600"
            >
              Revenue: ৳ {data[hoveredIdx].revenue.toLocaleString()}
            </text>
            <text
              x={Math.min(PL + hoveredIdx * xStep - 60, W - PR - 130)}
              y={PT + 40}
              fontSize="9"
              fill="#93C5FD"
              fontWeight="600"
            >
              Bookings: {data[hoveredIdx].bookings}
            </text>
          </>
        )}
      </svg>

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 mt-3 text-xs font-semibold">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-0.5 bg-brand-600 rounded" />
          <span className="text-surface-500">Revenue (৳)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-0.5 bg-blue-500 rounded border-dashed" style={{ borderTop: "2px dashed #3B82F6", height: 0 }} />
          <span className="text-surface-500">Bookings</span>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   TOP 5 ROUTES BAR CHART
   ═══════════════════════════════════════════════════ */
function TopRoutesChart({
  routes,
  mode,
}: {
  routes: { route: string; revenue: number; count: number }[];
  mode: "revenue" | "volume";
}) {
  if (routes.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-surface-400 text-sm">
        No route data available
      </div>
    );
  }

  const maxVal = Math.max(...routes.map((r) => (mode === "revenue" ? r.revenue : r.count)), 1);
  const colors = [
    "from-brand-500 to-brand-600",
    "from-blue-500 to-blue-600",
    "from-emerald-500 to-emerald-600",
    "from-accent-500 to-accent-600",
    "from-purple-500 to-purple-600",
  ];

  return (
    <div className="space-y-3">
      {routes.map((r, i) => {
        const val = mode === "revenue" ? r.revenue : r.count;
        const pct = (val / maxVal) * 100;
        return (
          <div key={i} className="group">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5 text-sm font-semibold text-surface-700 truncate max-w-[65%]">
                <MapPin className="h-3 w-3 text-brand-500 flex-shrink-0" />
                <span className="truncate">{r.route}</span>
              </div>
              <span className="text-sm font-bold text-surface-900">
                {mode === "revenue" ? formatCurrency(r.revenue) : `${r.count} trips`}
              </span>
            </div>
            <div className="w-full h-7 bg-surface-100 rounded-lg overflow-hidden relative">
              <div
                className={`h-full bg-gradient-to-r ${colors[i % colors.length]} rounded-lg transition-all duration-700 ease-out flex items-center justify-end pr-2`}
                style={{ width: `${Math.max(pct, 4)}%` }}
              >
                {pct > 20 && (
                  <span className="text-[10px] font-bold text-white/90">
                    {mode === "revenue" ? formatCurrency(r.revenue) : r.count}
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   OCCUPANCY HEATMAP
   ═══════════════════════════════════════════════════ */
function OccupancyHeatmap({
  data,
}: {
  data: number[][]; // 7 rows (Mon-Sun) x 24 cols (hours)
}) {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  // Group into 6 time blocks: 00-04, 04-08, 08-12, 12-16, 16-20, 20-24
  const blocks = ["12am-4am", "4am-8am", "8am-12pm", "12pm-4pm", "4pm-8pm", "8pm-12am"];

  const blockData = data.map((dayRow) =>
    [0, 1, 2, 3, 4, 5].map((blockIdx) => {
      const start = blockIdx * 4;
      return dayRow.slice(start, start + 4).reduce((a, b) => a + b, 0);
    })
  );

  const maxVal = Math.max(...blockData.flat(), 1);

  const getColor = (val: number) => {
    if (val === 0) return "bg-surface-100";
    const intensity = val / maxVal;
    if (intensity < 0.2) return "bg-brand-100";
    if (intensity < 0.4) return "bg-brand-200";
    if (intensity < 0.6) return "bg-brand-300";
    if (intensity < 0.8) return "bg-brand-400";
    return "bg-brand-600";
  };

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[420px]">
        {/* Header row */}
        <div className="grid grid-cols-7 gap-1 mb-1.5">
          <div className="col-span-1" />
          {blocks.map((b) => (
            <div key={b} className="text-[9px] font-bold text-surface-400 text-center uppercase tracking-wider">
              {b}
            </div>
          ))}
        </div>

        {/* Data rows */}
        {days.map((day, di) => (
          <div key={day} className="grid grid-cols-7 gap-1 mb-1">
            <div className="text-[10px] font-bold text-surface-500 flex items-center justify-end pr-1">
              {day}
            </div>
            {blockData[di].map((val, bi) => (
              <div
                key={bi}
                className={`h-8 rounded-md ${getColor(val)} transition-all duration-300 hover:scale-105 hover:shadow-sm cursor-default relative group flex items-center justify-center`}
                title={`${day} ${blocks[bi]}: ${val} departures`}
              >
                {val > 0 && (
                  <span className="text-[9px] font-bold text-surface-700/70">{val}</span>
                )}
                {/* Tooltip */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 bg-surface-900 text-white text-[10px] py-1 px-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap shadow-lg z-30 font-bold">
                  {val} departure{val !== 1 ? "s" : ""}
                  <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-surface-900 w-0 h-0" />
                </div>
              </div>
            ))}
          </div>
        ))}

        {/* Color legend */}
        <div className="flex items-center justify-end gap-1.5 mt-3">
          <span className="text-[9px] text-surface-400 font-semibold">Less</span>
          {["bg-surface-100", "bg-brand-100", "bg-brand-200", "bg-brand-400", "bg-brand-600"].map((c) => (
            <div key={c} className={`w-4 h-4 rounded ${c}`} />
          ))}
          <span className="text-[9px] text-surface-400 font-semibold">More</span>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   MAIN ANALYTICS COMPONENT
   ═══════════════════════════════════════════════════ */
export function OperatorAnalytics() {
  const { user } = useAuthStore();

  // --- Date filter state ---
  const [preset, setPreset] = useState<DatePreset>("month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  // --- Raw data ---
  const [allBookings, setAllBookings] = useState<Booking[]>([]);
  const [allTrips, setAllTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);

  // --- Table state ---
  const [tablePage, setTablePage] = useState(0);
  const TABLE_PAGE_SIZE = 10;

  // --- Top routes toggle ---
  const [routeMode, setRouteMode] = useState<"revenue" | "volume">("revenue");

  // ─── Fetch data ──────────────────────────────────
  useEffect(() => {
    const fetchAll = async () => {
      if (!user?.id) return;
      setLoading(true);
      try {
        const [bookingsRes, tripsRes] = await Promise.all([
          apiClient.get(`/api/bookings/operator/${user.id}?limit=1000`),
          apiClient.get(`/api/operators/trips/?operator_id=${user.id}`),
        ]);
        if (bookingsRes.data.success) setAllBookings(bookingsRes.data.data || []);
        if (tripsRes.data.success) setAllTrips(tripsRes.data.data || []);
      } catch (err) {
        console.error("Analytics: failed to fetch data", err);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, [user]);

  // ─── Computed date range ──────────────────────────
  const [rangeFrom, rangeTo] = useMemo(() => getDateRange(preset, customFrom, customTo), [preset, customFrom, customTo]);
  const [prevFrom, prevTo] = useMemo(() => getPreviousPeriod(rangeFrom, rangeTo), [rangeFrom, rangeTo]);

  // ─── Filtered data ───────────────────────────────
  const filteredBookings = useMemo(
    () => allBookings.filter((b) => inRange(b.created_at || b.journey_date, rangeFrom, rangeTo)),
    [allBookings, rangeFrom, rangeTo]
  );
  const prevBookings = useMemo(
    () => allBookings.filter((b) => inRange(b.created_at || b.journey_date, prevFrom, prevTo)),
    [allBookings, prevFrom, prevTo]
  );
  const filteredTrips = useMemo(
    () => allTrips.filter((t) => inRange(t.departure_datetime, rangeFrom, rangeTo)),
    [allTrips, rangeFrom, rangeTo]
  );
  const prevTrips = useMemo(
    () => allTrips.filter((t) => inRange(t.departure_datetime, prevFrom, prevTo)),
    [allTrips, prevFrom, prevTo]
  );

  // ─── KPI calculations ────────────────────────────
  const kpis = useMemo(() => {
    const confirmedStatuses = ["CONFIRMED", "COMPLETED"];

    // Revenue
    const currentRevenue = filteredBookings
      .filter((b) => confirmedStatuses.includes(b.status))
      .reduce((s, b) => s + parseFloat(String(b.total_fare || 0)), 0);
    const prevRevenue = prevBookings
      .filter((b) => confirmedStatuses.includes(b.status))
      .reduce((s, b) => s + parseFloat(String(b.total_fare || 0)), 0);

    // Bookings (seats sold)
    const currentBookingCount = filteredBookings.filter((b) => confirmedStatuses.includes(b.status)).length;
    const prevBookingCount = prevBookings.filter((b) => confirmedStatuses.includes(b.status)).length;

    // Occupancy rate
    const calcOccupancy = (trips: Trip[]) => {
      if (trips.length === 0) return 0;
      const totalCapacity = trips.reduce((s, t) => {
        // available_seats is the remaining seats. We need total_seats.
        // For enriched trips, we don't have total_seats directly, so we
        // estimate: total = available_seats + seats_sold. We approximate from fare/bookings.
        // Simpler: use available_seats as a proxy for remaining capacity
        return s + (t.available_seats || 0);
      }, 0);
      // Estimate total seats: each bus typically 40-45, but use available_seats as "remaining"
      // Better approach: count bookings per trip
      const totalSeats = trips.length * 40; // reasonable default
      const soldSeats = totalSeats - totalCapacity;
      return totalSeats > 0 ? Math.min((soldSeats / totalSeats) * 100, 100) : 0;
    };
    const currentOccupancy = calcOccupancy(filteredTrips);
    const prevOccupancy = calcOccupancy(prevTrips);

    // Cancellation rate
    const currentCancelled = filteredBookings.filter((b) => b.status === "CANCELLED").length;
    const currentTotalBookings = filteredBookings.length;
    const currentCancelRate = currentTotalBookings > 0 ? (currentCancelled / currentTotalBookings) * 100 : 0;

    const prevCancelled = prevBookings.filter((b) => b.status === "CANCELLED").length;
    const prevTotalBookings = prevBookings.length;
    const prevCancelRate = prevTotalBookings > 0 ? (prevCancelled / prevTotalBookings) * 100 : 0;

    // Trips completed
    const currentCompleted = filteredTrips.filter((t) => t.status === "COMPLETED").length;
    const prevCompleted = prevTrips.filter((t) => t.status === "COMPLETED").length;

    return [
      {
        label: "Total Revenue",
        value: formatCurrency(currentRevenue),
        ...pctChange(currentRevenue, prevRevenue),
        icon: DollarSign,
        color: "from-emerald-500 to-emerald-600",
        bgLight: "bg-emerald-50",
      },
      {
        label: "Total Bookings",
        value: currentBookingCount.toLocaleString(),
        ...pctChange(currentBookingCount, prevBookingCount),
        icon: Ticket,
        color: "from-brand-500 to-brand-600",
        bgLight: "bg-brand-50",
      },
      {
        label: "Avg Occupancy",
        value: `${currentOccupancy.toFixed(1)}%`,
        ...pctChange(currentOccupancy, prevOccupancy),
        icon: Activity,
        color: "from-blue-500 to-blue-600",
        bgLight: "bg-blue-50",
      },
      {
        label: "Cancellation Rate",
        value: `${currentCancelRate.toFixed(1)}%`,
        // For cancellation rate, DOWN is good
        text: pctChange(currentCancelRate, prevCancelRate).text,
        up: currentCancelRate <= prevCancelRate,
        icon: XCircle,
        color: "from-red-400 to-red-500",
        bgLight: "bg-red-50",
      },
      {
        label: "Trips Completed",
        value: currentCompleted.toLocaleString(),
        ...pctChange(currentCompleted, prevCompleted),
        icon: CheckCircle,
        color: "from-purple-500 to-purple-600",
        bgLight: "bg-purple-50",
      },
    ];
  }, [filteredBookings, prevBookings, filteredTrips, prevTrips]);

  // ─── Revenue & Bookings trend data ────────────────
  const trendData = useMemo(() => {
    const confirmedStatuses = ["CONFIRMED", "COMPLETED"];
    const dayCount = Math.max(Math.ceil((rangeTo.getTime() - rangeFrom.getTime()) / (1000 * 60 * 60 * 24)), 1);
    const days: { date: string; revenue: number; bookings: number }[] = [];

    for (let i = 0; i < dayCount; i++) {
      const d = new Date(rangeFrom);
      d.setDate(d.getDate() + i);
      const dateStr = formatShortDate(d);

      const dayBookings = filteredBookings.filter((b) => {
        const bDate = new Date(b.created_at || b.journey_date);
        return (
          bDate.getFullYear() === d.getFullYear() &&
          bDate.getMonth() === d.getMonth() &&
          bDate.getDate() === d.getDate() &&
          confirmedStatuses.includes(b.status)
        );
      });

      days.push({
        date: dateStr,
        revenue: dayBookings.reduce((s, b) => s + parseFloat(String(b.total_fare || 0)), 0),
        bookings: dayBookings.length,
      });
    }

    return days;
  }, [filteredBookings, rangeFrom, rangeTo]);

  // ─── Top 5 routes ────────────────────────────────
  const topRoutes = useMemo(() => {
    const confirmedStatuses = ["CONFIRMED", "COMPLETED"];
    const routeMap: Record<string, { revenue: number; count: number }> = {};

    // Use trips + match bookings
    filteredTrips.forEach((t) => {
      const key = `${t.origin_city} → ${t.destination_city}`;
      if (!routeMap[key]) routeMap[key] = { revenue: 0, count: 0 };
      routeMap[key].count++;
    });

    filteredBookings
      .filter((b) => confirmedStatuses.includes(b.status))
      .forEach((b) => {
        const key = `${b.boarding_point} → ${b.dropping_point}`;
        if (!routeMap[key]) routeMap[key] = { revenue: 0, count: 0 };
        routeMap[key].revenue += parseFloat(String(b.total_fare || 0));
      });

    const arr = Object.entries(routeMap).map(([route, data]) => ({ route, ...data }));
    arr.sort((a, b) => (routeMode === "revenue" ? b.revenue - a.revenue : b.count - a.count));
    return arr.slice(0, 5);
  }, [filteredBookings, filteredTrips, routeMode]);

  // ─── Occupancy heatmap ───────────────────────────
  const heatmapData = useMemo(() => {
    // 7 days x 24 hours
    const grid: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
    filteredTrips.forEach((t) => {
      const d = new Date(t.departure_datetime);
      const dayIdx = (d.getDay() + 6) % 7; // Monday = 0
      const hour = d.getHours();
      grid[dayIdx][hour]++;
    });
    return grid;
  }, [filteredTrips]);

  // ─── Trip-by-trip performance table ──────────────
  const tripTableData = useMemo(() => {
    // Merge trips with booking counts
    const tripBookingCounts: Record<string, number> = {};
    filteredBookings.forEach((b) => {
      const tid = b.trip_id || "";
      if (tid) {
        tripBookingCounts[tid] = (tripBookingCounts[tid] || 0) + (b.seat_numbers?.length || 1);
      }
    });

    return filteredTrips
      .map((t) => {
        const tid = t.trip_id || t.id || "";
        const seatsSold = tripBookingCounts[tid] || 0;
        const totalCapacity = t.available_seats + seatsSold; // Estimate
        return {
          ...t,
          tripId: tid,
          seatsSold,
          totalCapacity: totalCapacity > 0 ? totalCapacity : 40,
          occupancyPct: totalCapacity > 0 ? (seatsSold / totalCapacity) * 100 : 0,
        };
      })
      .sort((a, b) => new Date(b.departure_datetime).getTime() - new Date(a.departure_datetime).getTime());
  }, [filteredTrips, filteredBookings]);

  const tripTablePages = Math.ceil(tripTableData.length / TABLE_PAGE_SIZE);
  const tripTableSlice = tripTableData.slice(tablePage * TABLE_PAGE_SIZE, (tablePage + 1) * TABLE_PAGE_SIZE);

  // ─── Actionable Insights ─────────────────────────
  const insights = useMemo(() => {
    const warnings: { message: string; type: "warning" | "suggestion" }[] = [];

    // Low occupancy upcoming trips (< 30%)
    const upcomingTrips = allTrips.filter((t) => {
      const dep = new Date(t.departure_datetime);
      return dep > new Date() && t.status === "SCHEDULED";
    });

    upcomingTrips.forEach((t) => {
      const tid = t.trip_id || t.id || "";
      const bookingsForTrip = allBookings.filter((b) => b.trip_id === tid && ["CONFIRMED", "COMPLETED"].includes(b.status));
      const seatsSold = bookingsForTrip.reduce((s, b) => s + (b.seat_numbers?.length || 1), 0);
      const totalCap = t.available_seats + seatsSold;
      const occ = totalCap > 0 ? (seatsSold / totalCap) * 100 : 0;

      if (occ < 30 && totalCap > 0) {
        const dep = new Date(t.departure_datetime);
        warnings.push({
          message: `Low occupancy (${occ.toFixed(0)}%) on ${t.origin_city} → ${t.destination_city} departing ${dep.toLocaleDateString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}`,
          type: "warning",
        });
      }

      if (occ >= 90) {
        warnings.push({
          message: `Near sold-out (${occ.toFixed(0)}%) on ${t.origin_city} → ${t.destination_city}. Consider adding an extra bus.`,
          type: "suggestion",
        });
      }
    });

    return warnings.slice(0, 6); // limit to 6
  }, [allTrips, allBookings]);

  // ─── Loading state ───────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 animate-fade-in">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-surface-500 text-sm font-medium">Loading analytics...</p>
        </div>
      </div>
    );
  }

  const presetButtons: { key: DatePreset; label: string }[] = [
    { key: "today", label: "Today" },
    { key: "week", label: "This Week" },
    { key: "month", label: "This Month" },
    { key: "custom", label: "Custom" },
  ];

  return (
    <div className="space-y-6 animate-fade-in" id="operator-analytics">
      {/* ─── Header + Global Date Filter ─────────── */}
      <div className="card-premium p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-brand-600 flex items-center justify-center text-white shadow-sm">
              <BarChart3 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-surface-900 tracking-tight">Analytics</h2>
              <p className="text-xs text-surface-500 mt-0.5">
                {formatShortDate(rangeFrom)} – {formatShortDate(rangeTo)}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {presetButtons.map((p) => (
              <button
                key={p.key}
                onClick={() => setPreset(p.key)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 ${
                  preset === p.key
                    ? "bg-brand-600 text-white shadow-brand"
                    : "bg-surface-100 text-surface-600 hover:bg-surface-200"
                }`}
                id={`filter-${p.key}`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Custom date inputs */}
        {preset === "custom" && (
          <div className="flex flex-wrap items-center gap-3 mt-4 pt-4 border-t border-surface-100 animate-fade-in">
            <Filter className="h-4 w-4 text-surface-400" />
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-surface-500">From</label>
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="input-premium text-sm !py-1.5 !px-2.5 w-36"
                id="custom-date-from"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-surface-500">To</label>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="input-premium text-sm !py-1.5 !px-2.5 w-36"
                id="custom-date-to"
              />
            </div>
          </div>
        )}
      </div>

      {/* ─── KPI Cards ───────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {kpis.map((kpi, i) => (
          <div
            key={i}
            className="card-premium p-5 hover:shadow-elevation-2 transition-all duration-300"
            style={{ animationDelay: `${i * 80}ms` }}
            id={`kpi-${i}`}
          >
            <div className="flex items-start justify-between mb-3">
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${kpi.color} flex items-center justify-center text-white shadow-sm`}>
                <kpi.icon className="h-5 w-5" />
              </div>
              <span className={`flex items-center gap-0.5 text-xs font-bold px-2 py-0.5 rounded-full ${
                kpi.up ? "text-emerald-700 bg-emerald-50" : "text-red-600 bg-red-50"
              }`}>
                {kpi.up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {kpi.text}
              </span>
            </div>
            <p className="text-2xl font-extrabold text-surface-900 tracking-tight">{kpi.value}</p>
            <p className="text-xs text-surface-500 mt-1 font-medium">{kpi.label}</p>
          </div>
        ))}
      </div>

      {/* ─── Charts Row ──────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Revenue & Bookings Trend — spans 2 cols */}
        <div className="xl:col-span-2 card-premium p-5 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-surface-900 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-brand-500" />
              Revenue & Bookings Trend
            </h3>
          </div>
          <DualLineChart data={trendData} />
        </div>

        {/* Top 5 Routes */}
        <div className="card-premium p-5 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-surface-900 flex items-center gap-2">
              <MapPin className="h-4 w-4 text-brand-500" />
              Top 5 Routes
            </h3>
            <div className="flex bg-surface-100 rounded-lg p-0.5">
              <button
                onClick={() => setRouteMode("revenue")}
                className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-all ${
                  routeMode === "revenue" ? "bg-white text-surface-900 shadow-sm" : "text-surface-500"
                }`}
                id="route-mode-revenue"
              >
                Revenue
              </button>
              <button
                onClick={() => setRouteMode("volume")}
                className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-all ${
                  routeMode === "volume" ? "bg-white text-surface-900 shadow-sm" : "text-surface-500"
                }`}
                id="route-mode-volume"
              >
                Volume
              </button>
            </div>
          </div>
          <TopRoutesChart routes={topRoutes} mode={routeMode} />
        </div>
      </div>

      {/* ─── Heatmap ─────────────────────────────── */}
      <div className="card-premium p-5 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-surface-900 flex items-center gap-2">
            <Calendar className="h-4 w-4 text-brand-500" />
            Departure Heatmap
          </h3>
          <span className="text-[10px] font-semibold text-surface-400 uppercase tracking-wider">Day × Time Block</span>
        </div>
        <OccupancyHeatmap data={heatmapData} />
      </div>

      {/* ─── Trip Performance Table ──────────────── */}
      <div className="card-premium overflow-hidden">
        <div className="p-5 border-b border-surface-100 flex items-center justify-between">
          <h3 className="font-bold text-surface-900 flex items-center gap-2">
            <Bus className="h-4 w-4 text-brand-500" />
            Trip-by-Trip Performance
          </h3>
          <span className="text-xs text-surface-400 font-semibold">{tripTableData.length} trips</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full" id="trip-performance-table">
            <thead>
              <tr className="bg-surface-50 text-left">
                <th className="px-5 py-3 text-xs font-bold text-surface-500 uppercase tracking-wider">Trip ID</th>
                <th className="px-5 py-3 text-xs font-bold text-surface-500 uppercase tracking-wider">Route</th>
                <th className="px-5 py-3 text-xs font-bold text-surface-500 uppercase tracking-wider">Departure</th>
                <th className="px-5 py-3 text-xs font-bold text-surface-500 uppercase tracking-wider">Bus Type</th>
                <th className="px-5 py-3 text-xs font-bold text-surface-500 uppercase tracking-wider">Seats Sold</th>
                <th className="px-5 py-3 text-xs font-bold text-surface-500 uppercase tracking-wider">Occupancy</th>
                <th className="px-5 py-3 text-xs font-bold text-surface-500 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100">
              {tripTableSlice.length > 0 ? (
                tripTableSlice.map((t) => {
                  const dep = new Date(t.departure_datetime);
                  return (
                    <tr key={t.tripId} className="hover:bg-surface-50 transition-colors">
                      <td className="px-5 py-3.5 text-sm font-mono font-semibold text-surface-900">
                        {t.tripId.split("-")[0].toUpperCase()}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1 text-sm text-surface-700 font-medium">
                          <MapPin className="h-3 w-3 text-brand-500 flex-shrink-0" />
                          <span>{t.origin_city}</span>
                          <ArrowRight className="h-3 w-3 text-surface-400 mx-0.5" />
                          <span>{t.destination_city}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="text-sm text-surface-700 font-medium flex items-center gap-1">
                          <Calendar className="h-3 w-3 text-surface-400" />
                          {dep.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                        </div>
                        <div className="text-xs text-surface-400 flex items-center gap-1 mt-0.5">
                          <Clock className="h-3 w-3" />
                          {dep.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="px-2 py-0.5 bg-surface-100 text-surface-700 rounded-md text-[10px] font-bold uppercase">
                          {t.bus_type}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-sm font-semibold text-surface-900">
                        {t.seatsSold} / {t.totalCapacity}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-surface-100 rounded-full overflow-hidden max-w-[80px]">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${
                                t.occupancyPct >= 80 ? "bg-emerald-500" : t.occupancyPct >= 40 ? "bg-blue-500" : "bg-red-400"
                              }`}
                              style={{ width: `${Math.min(t.occupancyPct, 100)}%` }}
                            />
                          </div>
                          <span className="text-xs font-bold text-surface-600 w-10 text-right">{t.occupancyPct.toFixed(0)}%</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`badge text-[10px] ${
                          t.status === "COMPLETED" ? "badge-success" :
                          t.status === "CANCELLED" ? "badge-error" :
                          "badge-info"
                        }`}>
                          {t.status}
                        </span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-surface-500">
                    No trips found for this period.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {/* Pagination */}
        {tripTablePages > 1 && (
          <div className="p-4 border-t border-surface-100 flex items-center justify-between">
            <span className="text-xs text-surface-400 font-semibold">
              Page {tablePage + 1} of {tripTablePages}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setTablePage(Math.max(0, tablePage - 1))}
                disabled={tablePage === 0}
                className="p-1.5 rounded-lg hover:bg-surface-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                id="table-prev"
              >
                <ChevronLeft className="h-4 w-4 text-surface-600" />
              </button>
              {Array.from({ length: Math.min(tripTablePages, 5) }).map((_, i) => {
                const pageIdx = tripTablePages <= 5 ? i : Math.max(0, Math.min(tablePage - 2, tripTablePages - 5)) + i;
                return (
                  <button
                    key={pageIdx}
                    onClick={() => setTablePage(pageIdx)}
                    className={`w-7 h-7 rounded-lg text-xs font-bold transition-all ${
                      tablePage === pageIdx
                        ? "bg-brand-600 text-white shadow-sm"
                        : "text-surface-600 hover:bg-surface-100"
                    }`}
                  >
                    {pageIdx + 1}
                  </button>
                );
              })}
              <button
                onClick={() => setTablePage(Math.min(tripTablePages - 1, tablePage + 1))}
                disabled={tablePage === tripTablePages - 1}
                className="p-1.5 rounded-lg hover:bg-surface-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                id="table-next"
              >
                <ChevronRight className="h-4 w-4 text-surface-600" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ─── Actionable Insights ─────────────────── */}
      <div className="card-premium p-5 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-surface-900 flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-accent-500" />
            Insights & Alerts
          </h3>
          {insights.length > 0 && (
            <span className="px-2 py-0.5 bg-accent-50 text-accent-700 rounded-full text-[10px] font-bold">
              {insights.length} alert{insights.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {insights.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {insights.map((ins, i) => (
              <div
                key={i}
                className={`flex items-start gap-3 p-4 rounded-xl border transition-all duration-200 hover:shadow-sm ${
                  ins.type === "warning"
                    ? "bg-amber-50/60 border-amber-200/60"
                    : "bg-blue-50/60 border-blue-200/60"
                }`}
              >
                {ins.type === "warning" ? (
                  <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
                ) : (
                  <Lightbulb className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" />
                )}
                <p className={`text-xs font-medium leading-relaxed ${
                  ins.type === "warning" ? "text-amber-800" : "text-blue-800"
                }`}>
                  {ins.message}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center mb-3">
              <CheckCircle className="h-6 w-6 text-emerald-500" />
            </div>
            <p className="text-sm font-semibold text-surface-700">All looking good!</p>
            <p className="text-xs text-surface-400 mt-1">No low-occupancy or sold-out alerts at the moment.</p>
          </div>
        )}
      </div>
    </div>
  );
}
