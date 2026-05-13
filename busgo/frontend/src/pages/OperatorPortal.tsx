import { useState, useEffect } from "react";
import { apiClient } from "../api/client";
import { Routes, Route, Link, useLocation, useNavigate } from "react-router-dom";
import { useAuthStore } from "../stores/authStore";
import {
  LayoutDashboard, Bus, Ticket, BarChart3, Settings, LogOut,
  Users, TrendingUp, DollarSign, Star, ArrowUpRight, ArrowDownRight,
  Calendar, ChevronRight, Menu, X, Bell, MapPin, ArrowRight, Clock,
} from "lucide-react";

import { ManageTrips } from "./ManageTrips";
import { OperatorBookings } from "./OperatorBookings";

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

        {/* User */}
        <div className="p-4 border-t border-surface-800">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white text-sm font-bold">
              {user?.name?.charAt(0).toUpperCase() || "O"}
            </div>
            <div>
              <p className="text-sm font-semibold text-white truncate w-32">{user?.name || "Operator"}</p>
              <p className="text-xs text-surface-500">Operator</p>
            </div>
          </div>
          <button onClick={handleLogout} className="w-full flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-red-400 hover:text-white hover:bg-red-500/20 transition-colors">
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      </aside>
    </>
  );
}

/* ─── Dashboard Content ────────────────────────────── */
function DashboardHome() {
  const { user } = useAuthStore();
  const [recentBookings, setRecentBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBookings = async () => {
      try {
        if (user?.id) {
          const res = await apiClient.get(`/api/bookings/operator/${user.id}?limit=5`);
          if (res.data.success) {
            setRecentBookings(res.data.data);
          }
        }
      } catch (err) {
        console.error("Failed to fetch bookings", err);
      } finally {
        setLoading(false);
      }
    };
    fetchBookings();
  }, [user]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {STATS.map((stat, i) => (
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
          <select className="text-sm border border-surface-200 rounded-lg px-3 py-1.5 text-surface-600 focus:outline-none focus:ring-2 focus:ring-brand-500">
            <option>Last 7 days</option>
            <option>Last 30 days</option>
            <option>Last 90 days</option>
          </select>
        </div>
        {/* Chart visualization */}
        <div className="flex items-end gap-2 h-48">
          {[40, 65, 45, 80, 55, 90, 70].map((h, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div
                className="w-full bg-gradient-to-t from-brand-600 to-brand-400 rounded-t-lg transition-all duration-500 hover:from-brand-500 hover:to-brand-300"
                style={{ height: `${h}%`, animationDelay: `${i * 100}ms` }}
              />
              <span className="text-[10px] text-surface-400 font-medium">
                {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][i]}
              </span>
            </div>
          ))}
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
              <button className="relative p-2 hover:bg-surface-100 rounded-lg text-surface-500" id="notifications">
                <Bell className="h-5 w-5" />
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-brand-500" />
              </button>
              
              {/* Profile Dropdown */}
              <div className="relative">
                <button 
                  onClick={() => setProfileOpen(!profileOpen)}
                  className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white text-xs font-bold hover:shadow-lg transition-shadow"
                  id="profile-button"
                >
                  {user?.name?.charAt(0).toUpperCase() || "G"}
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
            <Route path="/analytics" element={<PlaceholderPage title="Analytics" icon={BarChart3} />} />
            <Route path="/settings" element={<PlaceholderPage title="Settings" icon={Settings} />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
