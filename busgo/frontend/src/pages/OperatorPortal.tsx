import { useState, useEffect } from "react";
import { apiClient } from "../api/client";
import { Routes, Route, Link, useLocation, useNavigate } from "react-router-dom";
import { useAuthStore } from "../stores/authStore";
import {
  LayoutDashboard, Bus, Ticket, BarChart3, Settings, LogOut,
  Users, TrendingUp, DollarSign, Star, ArrowUpRight, ArrowDownRight,
  Calendar, ChevronRight, Menu, X, Bell, MapPin, ArrowRight, Clock,
} from "lucide-react";
import { toast } from "react-hot-toast";

import { ManageTrips } from "./ManageTrips";
import { OperatorBookings } from "./OperatorBookings";
import { OperatorAnalytics } from "./OperatorAnalytics";

/* ─── Dashboard Stats ──────────────────────────────── */
const STATS = [
  { label: "Total Bookings", value: "2,847", change: "+12.5%", up: true, icon: Ticket, color: "from-brand-500 to-brand-600" },
  { label: "Revenue", value: "৳ 4.2M", change: "+8.3%", up: true, icon: DollarSign, color: "from-emerald-500 to-emerald-600" },
  { label: "Active Trips", value: "34", change: "+3", up: true, icon: Bus, color: "from-blue-500 to-blue-600" },
  { label: "Avg Rating", value: "4.8", change: "-0.1", up: false, icon: Star, color: "from-accent-500 to-accent-600" },
];



const NAV_ITEMS = [
  { to: "/operator", label: "Dashboard", icon: LayoutDashboard },
  { to: "/operator/trips", label: "Manage Trips", icon: Bus },
  { to: "/operator/bookings", label: "Bookings", icon: Ticket },
  { to: "/operator/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/operator/settings", label: "Settings", icon: Settings },
];

/* ─── Sidebar ──────────────────────────────────────── */
function Sidebar({ open, setOpen }: { open: boolean; setOpen: (o: boolean) => void }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div className="fixed inset-0 z-40 bg-surface-900/50 backdrop-blur-sm lg:hidden" onClick={() => setOpen(false)} />
      )}

      <aside className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-surface-900 flex flex-col transition-transform duration-300 lg:translate-x-0 ${
        open ? "translate-x-0" : "-translate-x-full"
      }`}>
        {/* Logo */}
        <div className="flex items-center justify-between p-5 border-b border-surface-800">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-brand-600">
              <Bus className="h-5 w-5 text-white" />
            </div>
            <div>
              <span className="text-lg font-extrabold text-white">BusGo</span>
              <span className="text-xs text-surface-400 block -mt-0.5">Operator Portal</span>
            </div>
          </div>
          <button onClick={() => setOpen(false)} className="lg:hidden p-1 text-surface-400 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const isActive = location.pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? "bg-brand-600 text-white shadow-brand"
                    : "text-surface-400 hover:text-white hover:bg-surface-800"
                }`}
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}

/* ─── Dashboard Content ────────────────────────────── */
function DashboardHome() {
  const { user } = useAuthStore();
  const [timeframe, setTimeframe] = useState<"7" | "30">("7");
  const [recentBookings, setRecentBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any[]>([
    { label: "Total Bookings", value: "0", change: "+0%", up: true, icon: Ticket, color: "from-brand-500 to-brand-600" },
    { label: "Revenue", value: "৳ 0", change: "+0%", up: true, icon: DollarSign, color: "from-emerald-500 to-emerald-600" },
    { label: "Active Trips", value: "0", change: "+0", up: true, icon: Bus, color: "from-blue-500 to-blue-600" },
    { label: "Avg Rating", value: "4.8", change: "0.0", up: true, icon: Star, color: "from-accent-500 to-accent-600" },
  ]);
  const [revenueData, setRevenueData] = useState<any[]>([
    { height: 15, value: 0 },
    { height: 15, value: 0 },
    { height: 15, value: 0 },
    { height: 15, value: 0 },
    { height: 15, value: 0 },
    { height: 15, value: 0 },
    { height: 15, value: 0 },
  ]);
  const [yAxisLabels, setYAxisLabels] = useState<string[]>(["৳ 10K", "৳ 5K", "৳ 2.5K"]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        console.log("DashboardHome: useEffect triggered. User ID:", user?.id, "Timeframe:", timeframe);
        if (user?.id) {
          setLoading(true);
          
          // 1. Fetch bookings of the operator (limit=1000 to get a large set of bookings to calculate statistics)
          console.log(`DashboardHome: Fetching bookings from /api/bookings/operator/${user.id}?limit=1000`);
          const bookingsRes = await apiClient.get(`/api/bookings/operator/${user.id}?limit=1000`);
          console.log("DashboardHome: Bookings response raw data:", bookingsRes.data);
          let allBookings: any[] = [];
          if (bookingsRes.data.success) {
            allBookings = bookingsRes.data.data || [];
            setRecentBookings(allBookings.slice(0, 5));
          }

          // 2. Fetch trips filtered by this operator to calculate active trips
          console.log(`DashboardHome: Fetching trips from /api/operators/trips/?operator_id=${user.id}`);
          const tripsRes = await apiClient.get(`/api/operators/trips/?operator_id=${user.id}`);
          console.log("DashboardHome: Trips response raw data:", tripsRes.data);
          let allTrips: any[] = [];
          if (tripsRes.data.success) {
            allTrips = tripsRes.data.data || [];
          }

          // 3. Compute stats
          const totalBookings = allBookings.length;
          
          // Sum revenue of confirmed and completed bookings
          const totalRevenue = allBookings
            .filter((b: any) => b.status === "CONFIRMED" || b.status === "COMPLETED")
            .reduce((sum: number, b: any) => sum + parseFloat(b.total_fare || 0), 0);

          // Active trips = scheduled trips belonging to this operator that have not passed the departure datetime (due date)
          const activeTrips = allTrips.filter((t: any) => t.status === "SCHEDULED" && t.departure_datetime && new Date(t.departure_datetime) > new Date()).length;

          // Format revenue value nicely
          let revenueStr = `৳ ${totalRevenue.toLocaleString()}`;
          if (totalRevenue >= 1000000) {
            revenueStr = `৳ ${(totalRevenue / 1000000).toFixed(1)}M`;
          } else if (totalRevenue >= 1000) {
            revenueStr = `৳ ${(totalRevenue / 1000).toFixed(1)}K`;
          }

          // Generate dynamic calendar days based on timeframe selection (7 days or 30 days)
          const daysToGenerate = timeframe === "30" ? 30 : 7;
          const chartDays: any[] = [];
          for (let i = daysToGenerate - 1; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            chartDays.push({
              dateStr: d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }), // "25 May"
              dayLabel: d.toLocaleDateString('en-GB', { weekday: 'short' }), // "Mon"
              rawDate: d,
              revenue: 0
            });
          }

          // Populate daily revenues from bookings
          allBookings.forEach((b: any) => {
            if (b.status === "CONFIRMED" || b.status === "COMPLETED") {
              const bDate = new Date(b.created_at || b.journey_date);
              const matchedIndex = chartDays.findIndex(item => 
                item.rawDate.getFullYear() === bDate.getFullYear() &&
                item.rawDate.getMonth() === bDate.getMonth() &&
                item.rawDate.getDate() === bDate.getDate()
              );
              if (matchedIndex !== -1) {
                chartDays[matchedIndex].revenue += parseFloat(b.total_fare || 0);
              }
            }
          });

          // Scale heights for display
          const maxVal = Math.max(...chartDays.map(item => item.revenue));
          const chartHeights = chartDays.map(item => maxVal > 0 ? (item.revenue / maxVal) * 75 + 15 : 15);
          console.log("DashboardHome: Calculated stats - bookings:", totalBookings, "revenue:", totalRevenue, "active trips:", activeTrips);
          console.log(`DashboardHome: Generated last ${daysToGenerate} days chart data:`, chartDays);
          
          const chartData = chartDays.map((item, i) => ({
            height: chartHeights[i],
            value: item.revenue,
            dayLabel: item.dayLabel,
            dateStr: item.dateStr
          }));
          setRevenueData(chartData);

          // Compute Y-axis labels
          const tempMax = maxVal > 0 ? maxVal : 10000;
          const label1 = tempMax;
          const label2 = tempMax * 0.67;
          const label3 = tempMax * 0.33;
          
          const formatLabel = (val: number) => {
            if (val === 0) return "৳ 0";
            if (val >= 1000000) return `৳ ${(val / 1000000).toFixed(1)}M`;
            if (val >= 1000) return `৳ ${(val / 1000).toFixed(1)}K`;
            return `৳ ${Math.round(val)}`;
          };
          
          setYAxisLabels([formatLabel(label1), formatLabel(label2), formatLabel(label3)]);

          setStats([
            { label: "Total Bookings", value: totalBookings.toLocaleString(), change: totalBookings > 0 ? "+100%" : "+0%", up: true, icon: Ticket, color: "from-brand-500 to-brand-600" },
            { label: "Revenue", value: revenueStr, change: totalRevenue > 0 ? "+100%" : "+0%", up: true, icon: DollarSign, color: "from-emerald-500 to-emerald-600" },
            { label: "Active Trips", value: activeTrips.toString(), change: activeTrips > 0 ? `+${activeTrips}` : "+0", up: true, icon: Bus, color: "from-blue-500 to-blue-600" },
            { label: "Avg Rating", value: "4.8", change: "0.0", up: true, icon: Star, color: "from-accent-500 to-accent-600" },
          ]);
        }
      } catch (err) {
        console.error("DashboardHome: Failed to fetch dashboard metrics", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user, timeframe]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <div key={i} className="card-premium p-5" id={`stat-${i}`}>
            <div className="flex items-start justify-between mb-3">
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center text-white shadow-sm`}>
                <stat.icon className="h-5 w-5" />
              </div>
              <span className={`flex items-center gap-0.5 text-xs font-semibold ${stat.up ? "text-emerald-600" : "text-red-500"}`}>
                {stat.up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                {stat.change}
              </span>
            </div>
            <p className="text-2xl font-extrabold text-surface-900">{stat.value}</p>
            <p className="text-sm text-surface-500 mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Revenue Chart Placeholder */}
      <div className="card-premium p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-bold text-surface-900">Revenue Overview</h3>
          <select 
            value={timeframe}
            onChange={(e) => setTimeframe(e.target.value as "7" | "30")}
            className="text-sm border border-surface-200 rounded-lg px-3 py-1.5 text-surface-600 focus:outline-none focus:ring-2 focus:ring-brand-500"
            id="timeframe-select"
          >
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
          </select>
        </div>
        
        {/* Chart Layout Container */}
        <div className="flex gap-4 h-48 mt-4">
          {/* Y-axis Labels Column */}
          <div className="flex flex-col justify-between h-[158px] text-[10px] text-surface-400 font-bold text-right w-14 pr-2 select-none">
            <span>{yAxisLabels[0]}</span>
            <span>{yAxisLabels[1]}</span>
            <span>{yAxisLabels[2]}</span>
            <span>৳ 0</span>
          </div>

          {/* Chart Content Area */}
          <div className="flex-1 h-full relative">
            {/* Background Gridlines */}
            <div className="absolute inset-x-0 top-0 bottom-[34px] flex flex-col justify-between pointer-events-none">
              <div className="border-b border-dashed border-surface-100 w-full h-0" />
              <div className="border-b border-dashed border-surface-100 w-full h-0" />
              <div className="border-b border-dashed border-surface-100 w-full h-0" />
              <div className="border-b border-solid border-surface-200 w-full h-0" />
            </div>

            {/* Bars Overlay */}
            <div className={`absolute inset-0 flex items-end px-2 z-10 ${
              timeframe === "30" ? "gap-0.5 sm:gap-1" : "gap-3"
            }`}>
              {revenueData.map((item, i) => (
                <div key={i} className="flex-1 h-full flex flex-col items-center gap-1.5 group relative">
                  {/* Bar Container that takes all remaining height and aligns the bar to the bottom */}
                  <div className={`flex-1 w-full flex items-end justify-center ${
                    timeframe === "30" ? "px-px sm:px-0.5" : "px-1"
                  }`}>
                    <div
                      className="w-full bg-gradient-to-t from-brand-600 to-brand-400 rounded-t-lg transition-all duration-500 hover:from-brand-500 hover:to-brand-300 shadow-sm cursor-pointer relative"
                      style={{ height: `${item.height}%`, animationDelay: `${i * 50}ms` }}
                    >
                      {/* Ride-along Tooltip */}
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-surface-900 text-white text-[10px] py-1 px-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap shadow-elevation-2 z-30 font-bold">
                        ৳ {item.value.toLocaleString()}
                        {/* Little tooltip arrow */}
                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-surface-900 w-0 h-0" />
                      </div>
                    </div>
                  </div>
                  {/* Two-line Date and Day Label */}
                  <div className="flex flex-col items-center select-none text-center h-[28px] justify-center mt-1">
                    {(timeframe === "7" || i % 5 === 0 || i === revenueData.length - 1) ? (
                      <>
                        <span className="text-[9px] sm:text-[10px] text-surface-400 font-bold uppercase tracking-wider leading-none">
                          {item.dayLabel}
                        </span>
                        <span className="text-[8px] sm:text-[9px] text-surface-400 font-semibold mt-0.5 whitespace-nowrap leading-none">
                          {item.dateStr}
                        </span>
                      </>
                    ) : (
                      // Just a tiny dot spacer to keep columns clean and aligned on dense views
                      <span className="text-[8px] text-surface-300 font-extrabold leading-none select-none">•</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Recent Bookings */}
      <div className="card-premium overflow-hidden">
        <div className="p-5 border-b border-surface-100 flex items-center justify-between">
          <h3 className="font-bold text-surface-900">Recent Bookings</h3>
          <Link to="/operator/bookings" className="text-sm text-brand-600 font-semibold flex items-center gap-1 hover:text-brand-700">
            View all <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-8 text-center text-surface-500">Loading bookings...</div>
          ) : (
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
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100">
                {recentBookings.length > 0 ? recentBookings.map((b) => (
                  <tr key={b.id} className="hover:bg-surface-50 transition-colors">
                    <td className="px-5 py-3.5 text-sm font-mono font-semibold text-surface-900">{b.id.split('-')[0].toUpperCase()}</td>
                    <td className="px-5 py-3.5 text-sm text-surface-700 font-medium">{b.passenger_details?.[0]?.name || "N/A"}</td>
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
                        {(b.seat_numbers || []).slice(0, 2).map((s: string) => (
                          <span key={s} className="px-1.5 py-0.5 bg-brand-50 text-brand-700 rounded text-[10px] font-bold border border-brand-200">{s}</span>
                        ))}
                        {(b.seat_numbers || []).length > 2 && (
                          <span className="px-1.5 py-0.5 bg-surface-100 text-surface-500 rounded text-[10px] font-bold">+{b.seat_numbers.length - 2}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-sm font-semibold text-surface-900">৳ {b.total_fare}</td>
                    <td className="px-5 py-3.5">
                      <span className={`badge text-[10px] ${
                        b.status === "CONFIRMED" || b.status === "COMPLETED" ? "badge-success" :
                        b.status === "CANCELLED" || b.status === "EXPIRED" || b.status === "REFUNDED" ? "badge-error" :
                        b.status === "SEAT_LOCKED" ? "badge-warning" :
                        "badge-info"
                      }`}>
                        {b.status}
                      </span>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={7} className="px-5 py-8 text-center text-surface-500">No recent bookings found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Operator Settings ────────────────────────────── */
function OperatorSettings() {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState(user?.name || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [email, setEmail] = useState(user?.email || "");
  const [address, setAddress] = useState("");
  const [license, setLicense] = useState("");

  useEffect(() => {
    const fetchOperator = async () => {
      try {
        if (user?.id) {
          const res = await apiClient.get(`/api/operators/operators/${user.id}`);
          if (res.data.success) {
            const data = res.data.data;
            setName(data.name || user?.name || "");
            setPhone(data.contact_phone || user?.phone || "");
            setEmail(data.contact_email || user?.email || "");
            setAddress(data.address || "");
            setLicense(data.license_no || "");
          }
        }
      } catch (err) {
        console.error("Failed to fetch operator details, using fallbacks:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchOperator();
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Operator name cannot be empty.");
      return;
    }
    setSaving(true);
    try {
      const res = await apiClient.put(`/api/operators/operators/${user?.id}`, {
        name,
        contact_phone: phone,
        contact_email: email,
        address,
        license_no: license,
      });
      if (res.data.success) {
        toast.success("Operator settings updated successfully!");
      }
    } catch (err: any) {
      console.error("Failed to update operator details", err);
      toast.error(err.response?.data?.message || "Failed to update operator details.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 animate-fade-in">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-surface-500 text-sm">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto animate-fade-in space-y-6">
      <div>
        <h2 className="text-2xl font-extrabold text-surface-900 tracking-tight">Settings</h2>
        <p className="text-sm text-surface-500 mt-1">
          Manage your business information and public operator profile.
        </p>
      </div>

      <div className="card-premium p-6 sm:p-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Public Profile Section */}
          <div>
            <h3 className="text-base font-bold text-surface-950 border-b border-surface-100 pb-2 mb-4">
              Public Profile
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-surface-700 mb-1.5">
                  Operator Name (Visible to Customers)
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Greenline Paribahan"
                  className="input-premium w-full"
                  required
                />
                <span className="text-[10px] text-surface-400 mt-1 block">
                  This name will be displayed in all search results, routes, and tickets.
                </span>
              </div>

              <div>
                <label className="block text-sm font-semibold text-surface-700 mb-1.5">
                  License Number
                </label>
                <input
                  type="text"
                  value={license}
                  onChange={(e) => setLicense(e.target.value)}
                  placeholder="e.g. GL-1234"
                  className="input-premium w-full"
                  required
                />
              </div>
            </div>
          </div>

          {/* Contact Details Section */}
          <div>
            <h3 className="text-base font-bold text-surface-950 border-b border-surface-100 pb-2 mb-4">
              Contact & Business Details
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-surface-700 mb-1.5">
                  Contact Phone
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. 01711111111"
                  className="input-premium w-full"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-surface-700 mb-1.5">
                  Contact Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. info@greenline.com"
                  className="input-premium w-full"
                  required
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-surface-700 mb-1.5">
                  Business Address
                </label>
                <textarea
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="e.g. Dhaka, Bangladesh"
                  className="input-premium w-full min-h-[80px]"
                  required
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-surface-100">
            <button
              type="submit"
              disabled={saving}
              className="btn-primary !px-8 flex items-center gap-2"
            >
              {saving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─── Placeholder Pages ────────────────────────────── */
function PlaceholderPage({ title, icon: Icon }: { title: string; icon: typeof Bus }) {
  return (
    <div className="flex items-center justify-center h-[60vh]">
      <div className="text-center">
        <div className="w-16 h-16 rounded-2xl bg-surface-100 flex items-center justify-center mx-auto mb-4">
          <Icon className="h-8 w-8 text-surface-400" />
        </div>
        <h2 className="text-xl font-bold text-surface-900 mb-1">{title}</h2>
        <p className="text-surface-500 text-sm">This section is coming soon.</p>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   OPERATOR PORTAL — Main Layout
   ═══════════════════════════════════════════════════ */
export function OperatorPortal() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="flex min-h-screen bg-surface-50" id="operator-portal">
      <Sidebar open={sidebarOpen} setOpen={setSidebarOpen} />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="bg-white border-b border-surface-200 sticky top-0 z-30 px-4 sm:px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 hover:bg-surface-100 rounded-lg text-surface-600"
                id="operator-menu-toggle"
              >
                <Menu className="h-5 w-5" />
              </button>
              <div>
                <h1 className="text-lg font-bold text-surface-900">Dashboard</h1>
                <p className="text-xs text-surface-500">Welcome back, {user?.name || "Operator"}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* <button className="relative p-2 hover:bg-surface-100 rounded-lg text-surface-500" id="notifications">
                <Bell className="h-5 w-5" />
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-brand-500" />
              </button> */}
              
              {/* Profile Dropdown */}
              <div className="relative">
                <button 
                  onClick={() => setProfileOpen(!profileOpen)}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl hover:bg-surface-50 active:scale-95 transition-all cursor-pointer"
                  id="profile-button"
                >
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white text-xs font-bold shadow-sm">
                    {user?.name?.charAt(0).toUpperCase() || "O"}
                  </div>
                  <span className="text-sm font-bold text-surface-700 truncate max-w-[120px]">
                    {user?.name || "Operator"}
                  </span>
                  <ChevronRight className="h-4 w-4 text-surface-400" />
                </button>
                
                {profileOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setProfileOpen(false)} />
                    <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-elevation-3 border border-surface-200 py-2 z-50 animate-fade-in">
                      <div className="px-4 py-3 border-b border-surface-100">
                        <p className="text-sm font-semibold text-surface-900">{user?.name || "Operator"}</p>
                        <p className="text-xs text-surface-500">{user?.email || "operator@busgo.com"}</p>
                      </div>
                      <div className="py-1">
                        <Link
                          to="/operator/settings"
                          onClick={() => setProfileOpen(false)}
                          className="flex items-center gap-2 px-4 py-2 text-sm text-surface-700 hover:bg-surface-50 transition-colors"
                        >
                          <Settings className="h-4 w-4" />
                          Settings
                        </Link>
                        <Link
                          to="/operator"
                          onClick={() => setProfileOpen(false)}
                          className="flex items-center gap-2 px-4 py-2 text-sm text-surface-700 hover:bg-surface-50 transition-colors"
                        >
                          <Users className="h-4 w-4" />
                          Profile
                        </Link>
                      </div>
                      <div className="border-t border-surface-100 pt-1">
                        <button
                          onClick={handleLogout}
                          className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                        >
                          <LogOut className="h-4 w-4" />
                          Sign out
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <Routes>
            <Route path="/" element={<DashboardHome />} />
            <Route path="/trips" element={<ManageTrips />} />
            <Route path="/bookings" element={<OperatorBookings />} />
            <Route path="/analytics" element={<OperatorAnalytics />} />
            <Route path="/settings" element={<OperatorSettings />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
