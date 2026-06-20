import { useState, useEffect, useCallback } from "react";
import { Users, Bus, Map, DollarSign, Activity, Settings, TrendingUp, AlertCircle, Menu, X, Loader2, LogOut, ChevronDown, History, CreditCard, ChevronLeft, ArrowRight, Clock, MapPin, Calendar, Ticket, Landmark, Wallet, Search, Check, RefreshCw, Megaphone, Plus, Pencil, Trash2, Eye, EyeOff, Bell } from "lucide-react";
import { apiClient } from "../api/client";
import { useAuthStore } from "../stores/authStore";
import { useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";
import { NotificationBell } from "../notifications/NotificationBell";
import { AdminNotifications } from "./AdminNotifications";

export function AdminPortal() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const validTabs = ["Dashboard", "Operators", "Routes", "Users", "User History", "Transactions", "Bank", "Notices", "Notifications", "Settings"];
  const hashTab = decodeURIComponent(window.location.hash.replace("#", ""));
  const [activeTab, setActiveTab] = useState(validTabs.includes(hashTab) ? hashTab : "Dashboard");
  const [loading, setLoading] = useState(true);
  const [tabLoading, setTabLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalBookings: 0,
    totalRevenue: 0,
    activeOperators: 0
  });

  const [operators, setOperators] = useState<any[]>([]);
  const [routes, setRoutes] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [userRoleTab, setUserRoleTab] = useState<"CUSTOMER" | "ADMIN" | "OPERATOR">("CUSTOMER");
  const [userHistory, setUserHistory] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [transactionSummary, setTransactionSummary] = useState<any[]>([]);
  const [trips, setTrips] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [selectedOperator, setSelectedOperator] = useState<any | null>(null);
  const [detailTab, setDetailTab] = useState<"history" | "payments">("history");
  const [opDetailTab, setOpDetailTab] = useState<"trips" | "routes">("trips");

  // Bank section state
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [bankSearch, setBankSearch] = useState("");
  const [bankUsers, setBankUsers] = useState<any[]>([]);
  const [editBalances, setEditBalances] = useState<Record<string, string>>({});
  const [savingAccount, setSavingAccount] = useState<string | null>(null);

  // Notices state
  const [adminNotices, setAdminNotices] = useState<any[]>([]);
  const [noticeForm, setNoticeForm] = useState({ title: "", body: "", is_active: true });
  const [editingNotice, setEditingNotice] = useState<any | null>(null);
  const [savingNotice, setSavingNotice] = useState(false);

  const userStore = useAuthStore(state => state.user);
  const logout = useAuthStore(state => state.logout);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const changeUserRole = async (userId: string, newRole: string) => {
    try {
      const res = await apiClient.patch(`/api/admin/users/${userId}/role`, { role: newRole });
      if (res.data.success) {
        toast.success(res.data.message);
        setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u));
      }
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Failed to update role");
    }
  };

  const saveBalance = async (accountId: string) => {
    const raw = editBalances[accountId];
    if (raw === undefined || raw === "") {
      toast.error("Enter a balance");
      return;
    }
    const balance = Number(raw);
    if (isNaN(balance) || balance < 0) {
      toast.error("Invalid balance");
      return;
    }
    setSavingAccount(accountId);
    try {
      const res = await apiClient.post(`/api/bank/admin/accounts/${accountId}/set-balance`, { balance });
      if (res.data.success) {
        toast.success("Balance updated");
        setBankAccounts((prev) => prev.map((a) => a.id === accountId ? { ...a, balance: res.data.data.balance } : a));
        setEditBalances((prev) => {
          const next = { ...prev };
          delete next[accountId];
          return next;
        });
      }
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Failed to update balance");
    } finally {
      setSavingAccount(null);
    }
  };

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await apiClient.get('/api/admin/dashboard-stats');
        if (response.data.success) {
          setStats(response.data.data);
        }
      } catch (error) {
        console.error("Failed to fetch admin stats:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  // Keep URL hash in sync so refresh restores the active tab.
  useEffect(() => {
    window.location.hash = encodeURIComponent(activeTab);
  }, [activeTab]);

  // React to hash changes (e.g. the notification bell links to #Notifications
  // while the admin portal is already mounted).
  useEffect(() => {
    const onHashChange = () => {
      const tab = decodeURIComponent(window.location.hash.replace("#", ""));
      if (validTabs.includes(tab)) setActiveTab(tab);
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchTabData = useCallback(async (tab: string) => {
    if (tab === "Dashboard" || tab === "Finance" || tab === "Settings") return;
    setTabLoading(true);
    try {
      if (tab === "User History") {
        const res = await apiClient.get('/api/admin/user-history');
        if (res.data.success) setUserHistory(res.data.data);
      } else if (tab === "Transactions") {
        const [transRes, sumRes] = await Promise.all([
          apiClient.get('/api/admin/transactions'),
          apiClient.get('/api/admin/transactions/summary')
        ]);
        if (transRes.data.success) setTransactions(transRes.data.data);
        if (sumRes.data.success) setTransactionSummary(sumRes.data.data);
      } else if (tab === "Users") {
        const [usersRes, historyRes, transRes] = await Promise.all([
          apiClient.get('/api/admin/users'),
          apiClient.get('/api/admin/user-history'),
          apiClient.get('/api/admin/transactions')
        ]);
        if (usersRes.data.success) setUsers(usersRes.data.data);
        if (historyRes.data.success) setUserHistory(historyRes.data.data);
        if (transRes.data.success) setTransactions(transRes.data.data);
      } else if (tab === "Bank") {
        const [acctRes, usersRes] = await Promise.all([
          apiClient.get('/api/bank/admin/accounts'),
          apiClient.get('/api/admin/users'),
        ]);
        if (acctRes.data.success) setBankAccounts(acctRes.data.data);
        if (usersRes.data.success) setBankUsers(usersRes.data.data);
      } else if (tab === "Operators") {
        const [operatorsRes, tripsRes, routesRes, historyRes] = await Promise.all([
          apiClient.get('/api/admin/operators'),
          apiClient.get('/api/admin/trips'),
          apiClient.get('/api/admin/routes'),
          apiClient.get('/api/admin/user-history')
        ]);
        if (operatorsRes.data.success) setOperators(operatorsRes.data.data);
        if (tripsRes.data.success) setTrips(tripsRes.data.data);
        if (routesRes.data.success) setRoutes(routesRes.data.data);
        if (historyRes.data.success) setUserHistory(historyRes.data.data);
      } else if (tab === "Routes") {
        const response = await apiClient.get('/api/admin/routes');
        if (response.data.success) setRoutes(response.data.data);
      } else if (tab === "Notices") {
        const res = await apiClient.get('/api/admin/notices');
        if (res.data.success) setAdminNotices(res.data.data);
      } else if (tab === "Notifications") {
        const usersRes = await apiClient.get('/api/admin/users');
        if (usersRes.data.success) setUsers(usersRes.data.data);
      }
    } catch (error) {
      console.error(`Failed to fetch ${tab}:`, error);
    } finally {
      setTabLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTabData(activeTab);
  }, [activeTab, fetchTabData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    if (activeTab === "Dashboard") {
      try {
        const response = await apiClient.get('/api/admin/dashboard-stats');
        if (response.data.success) setStats(response.data.data);
      } catch (e) { console.error(e); }
    } else {
      await fetchTabData(activeTab);
    }
    setRefreshing(false);
  };


  const navItems = [
    { id: "Dashboard", icon: Activity, label: "Dashboard" },
    { id: "Operators", icon: Bus, label: "Operators" },
    { id: "Routes", icon: Map, label: "Routes" },
    { id: "Users", icon: Users, label: "Users" },
    { id: "User History", icon: History, label: "User History" },
    { id: "Transactions", icon: CreditCard, label: "Transactions" },
    { id: "Bank", icon: Landmark, label: "Bank" },
    { id: "Notices", icon: Megaphone, label: "Notices" },
    { id: "Notifications", icon: Bell, label: "Notifications" },
  ];

  const renderUserDetails = () => {
    const u = selectedUser;
    if (!u) return null;
    const userBookings = userHistory.filter((uh) => uh.user_id === u.id);
    const userPayments = transactions.filter((t) => t.user_id === u.id);

    const totalBookings = userBookings.length;
    const totalSpent = userBookings
      .filter((b) => b.status === "CONFIRMED" || b.status === "COMPLETED")
      .reduce((sum, b) => sum + (b.total_fare || 0), 0);
    
    const completedBookings = userBookings.filter(
      (b) => b.status === "COMPLETED" || (b.status === "CONFIRMED" && new Date(b.journey_date) <= new Date())
    ).length;

    const cancelledBookings = userBookings.filter(
      (b) => b.status === "CANCELLED" || b.status === "REFUNDED" || b.status === "EXPIRED"
    ).length;

    return (
      <div className="space-y-6">
        {/* Header with back button */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-surface-200 shadow-elevation-1">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setSelectedUser(null)}
              className="p-2 hover:bg-surface-100 rounded-xl transition-colors border border-surface-200 text-surface-600 hover:text-surface-900"
              title="Back to Users"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-bold text-surface-900">{u.full_name}</h2>
                <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full border ${
                  u.role === 'ADMIN' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                  u.role === 'OPERATOR' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                  'bg-emerald-50 text-emerald-700 border-emerald-200'
                }`}>
                  {u.role}
                </span>
              </div>
              <p className="text-sm text-surface-500 mt-1">{u.email || "No Email"} • {u.phone}</p>
            </div>
          </div>
          <div className="text-sm text-surface-500 font-semibold border-t sm:border-t-0 sm:border-l border-surface-200 pt-4 sm:pt-0 sm:pl-6">
            Joined: <span className="text-surface-900 font-bold">{new Date(u.created_at).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}</span>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="card-premium p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
              <Ticket className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-bold text-surface-500 uppercase tracking-wider">Total Bookings</p>
              <h3 className="text-2xl font-extrabold text-surface-900 mt-1">{totalBookings}</h3>
            </div>
          </div>

          <div className="card-premium p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
              <DollarSign className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-bold text-surface-500 uppercase tracking-wider">Spent Fares</p>
              <h3 className="text-2xl font-extrabold text-surface-900 mt-1">৳ {totalSpent.toLocaleString()}</h3>
            </div>
          </div>

          <div className="card-premium p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center flex-shrink-0">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-bold text-surface-500 uppercase tracking-wider">Completed Journeys</p>
              <h3 className="text-2xl font-extrabold text-surface-900 mt-1">{completedBookings}</h3>
            </div>
          </div>

          <div className="card-premium p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-red-50 text-red-600 flex items-center justify-center flex-shrink-0">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-bold text-surface-500 uppercase tracking-wider">Cancelled / Expired</p>
              <h3 className="text-2xl font-extrabold text-surface-900 mt-1">{cancelledBookings}</h3>
            </div>
          </div>
        </div>

        {/* Tabs list & content wrapper */}
        <div className="card-premium overflow-hidden">
          <div className="flex border-b border-surface-200 bg-surface-50 p-2 gap-2">
            <button
              onClick={() => setDetailTab("history")}
              className={`px-4 py-2 text-sm font-bold rounded-lg transition-all flex items-center gap-2 ${
                detailTab === "history"
                  ? "bg-white text-brand-600 shadow-sm border border-surface-200 font-extrabold"
                  : "text-surface-500 hover:text-surface-800 hover:bg-white/50"
              }`}
            >
              <Clock className="w-4 h-4" /> Travel & History
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold transition-all ${
                detailTab === "history" ? "bg-brand-50 text-brand-700 font-extrabold" : "bg-surface-200 text-surface-600"
              }`}>
                {userBookings.length}
              </span>
            </button>
            <button
              onClick={() => setDetailTab("payments")}
              className={`px-4 py-2 text-sm font-bold rounded-lg transition-all flex items-center gap-2 ${
                detailTab === "payments"
                  ? "bg-white text-brand-600 shadow-sm border border-surface-200 font-extrabold"
                  : "text-surface-500 hover:text-surface-800 hover:bg-white/50"
              }`}
            >
              <CreditCard className="w-4 h-4" /> Transaction History
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold transition-all ${
                detailTab === "payments" ? "bg-brand-50 text-brand-700 font-extrabold" : "bg-surface-200 text-surface-600"
              }`}>
                {userPayments.length}
              </span>
            </button>
          </div>

          {detailTab === "history" && (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-50 border-b border-surface-200">
                    <th className="py-3 px-4 text-xs font-bold text-surface-500 uppercase tracking-wider">Booking ID</th>
                    <th className="py-3 px-4 text-xs font-bold text-surface-500 uppercase tracking-wider">Journey Date</th>
                    <th className="py-3 px-4 text-xs font-bold text-surface-500 uppercase tracking-wider">Trip ID</th>
                    <th className="py-3 px-4 text-xs font-bold text-surface-500 uppercase tracking-wider">Total Fare</th>
                    <th className="py-3 px-4 text-xs font-bold text-surface-500 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-200">
                  {userBookings.map((uh, i) => (
                    <tr key={i} className="hover:bg-surface-50 transition-colors">
                      <td className="py-3 px-4 text-sm font-mono text-surface-700">{uh.id.substring(0, 8)}...</td>
                      <td className="py-3 px-4 text-sm text-surface-950 font-medium">
                        {new Date(uh.journey_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                      </td>
                      <td className="py-3 px-4 text-sm font-mono text-surface-500">{uh.trip_id.substring(0, 8)}...</td>
                      <td className="py-3 px-4 text-sm font-bold text-surface-900">৳ {uh.total_fare}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                          uh.status === 'CONFIRMED' || uh.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700' : 
                          uh.status === 'CANCELLED' || uh.status === 'REFUNDED' || uh.status === 'EXPIRED' ? 'bg-red-100 text-red-700' : 
                          'bg-amber-100 text-amber-700'
                        }`}>
                          {uh.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {userBookings.length === 0 && (
                    <tr><td colSpan={5} className="py-8 text-center text-surface-500">No booking history found for this user.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {detailTab === "payments" && (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-50 border-b border-surface-200">
                    <th className="py-3 px-4 text-xs font-bold text-surface-500 uppercase tracking-wider">Transaction ID</th>
                    <th className="py-3 px-4 text-xs font-bold text-surface-500 uppercase tracking-wider">Date & Time</th>
                    <th className="py-3 px-4 text-xs font-bold text-surface-500 uppercase tracking-wider">Method</th>
                    <th className="py-3 px-4 text-xs font-bold text-surface-500 uppercase tracking-wider">Amount</th>
                    <th className="py-3 px-4 text-xs font-bold text-surface-500 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-200">
                  {userPayments.map((t, i) => (
                    <tr key={i} className="hover:bg-surface-50 transition-colors">
                      <td className="py-3 px-4 text-sm font-mono text-surface-700">{t.id.substring(0, 8)}...</td>
                      <td className="py-3 px-4 text-sm text-surface-500">{new Date(t.initiated_at).toLocaleString()}</td>
                      <td className="py-3 px-4 text-sm font-semibold text-surface-800">{t.method}</td>
                      <td className="py-3 px-4 text-sm font-bold text-surface-900">৳ {t.amount}</td>
                      <td className="py-3 px-4">
                        {t.status !== 'PENDING' && (
                          <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                            t.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700' :
                            t.status === 'FAILED' ? 'bg-red-100 text-red-700' :
                            'bg-amber-100 text-amber-700'
                          }`}>
                            {t.status}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {userPayments.length === 0 && (
                    <tr><td colSpan={5} className="py-8 text-center text-surface-500">No transactions recorded for this user.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderOperatorDetails = () => {
    const op = selectedOperator;
    if (!op) return null;
    
    const opTrips = trips.filter((t) => t.operator_id === op.id);
    const opRoutes = routes.filter((r) => r.operator_id === op.id);

    const opBookings = userHistory.filter((uh) => {
      const trip = trips.find(t => t.id === uh.trip_id);
      return trip && trip.operator_id === op.id;
    });

    const totalTrips = opTrips.length;
    const totalRoutes = opRoutes.length;
    const totalRevenue = opBookings
      .filter((b) => b.status === "CONFIRMED" || b.status === "COMPLETED")
      .reduce((sum, b) => sum + (b.total_fare || 0), 0);

    const seatsRemaining = opTrips
      .filter((t) => t.status === "SCHEDULED" || new Date(t.departure_datetime) > new Date())
      .reduce((sum, t) => sum + (t.available_seats || 0), 0);

    return (
      <div className="space-y-6">
        {/* Header with back button */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-surface-200 shadow-elevation-1">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setSelectedOperator(null)}
              className="p-2 hover:bg-surface-100 rounded-xl transition-colors border border-surface-200 text-surface-600 hover:text-surface-900"
              title="Back to Operators"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-bold text-surface-900">{op.name}</h2>
                <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full ${op.is_active ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                  {op.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
              <p className="text-sm text-surface-500 mt-1">{op.contact_email} • {op.contact_phone}</p>
            </div>
          </div>
          <div className="text-sm text-surface-500 font-semibold border-t sm:border-t-0 sm:border-l border-surface-200 pt-4 sm:pt-0 sm:pl-6">
            Address: <span className="text-surface-900 font-bold">{op.address || "N/A"}</span><br/>
            License No: <span className="text-surface-900 font-bold">{op.license_no}</span>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="card-premium p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
              <Bus className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-bold text-surface-500 uppercase tracking-wider">Trips Operated</p>
              <h3 className="text-2xl font-extrabold text-surface-900 mt-1">{totalTrips}</h3>
            </div>
          </div>

          <div className="card-premium p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
              <Map className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-bold text-surface-500 uppercase tracking-wider">Active Routes</p>
              <h3 className="text-2xl font-extrabold text-surface-900 mt-1">{totalRoutes}</h3>
            </div>
          </div>

          <div className="card-premium p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center flex-shrink-0">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-bold text-surface-500 uppercase tracking-wider">Seats Remaining</p>
              <h3 className="text-2xl font-extrabold text-surface-900 mt-1">{seatsRemaining}</h3>
            </div>
          </div>

          <div className="card-premium p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0">
              <DollarSign className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-bold text-surface-500 uppercase tracking-wider">Operated Revenue</p>
              <h3 className="text-2xl font-extrabold text-surface-900 mt-1">৳ {totalRevenue.toLocaleString()}</h3>
            </div>
          </div>
        </div>

        {/* Tabs list & content wrapper */}
        <div className="card-premium overflow-hidden">
          <div className="flex border-b border-surface-200 bg-surface-50 p-2 gap-2">
            <button
              onClick={() => setOpDetailTab("trips")}
              className={`px-4 py-2 text-sm font-bold rounded-lg transition-all flex items-center gap-2 ${
                opDetailTab === "trips"
                  ? "bg-white text-brand-600 shadow-sm border border-surface-200 font-extrabold"
                  : "text-surface-500 hover:text-surface-800 hover:bg-white/50"
              }`}
            >
              <Clock className="w-4 h-4" /> Operated Trips
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold transition-all ${
                opDetailTab === "trips" ? "bg-brand-50 text-brand-700 font-extrabold" : "bg-surface-200 text-surface-600"
              }`}>
                {opTrips.length}
              </span>
            </button>
            <button
              onClick={() => setOpDetailTab("routes")}
              className={`px-4 py-2 text-sm font-bold rounded-lg transition-all flex items-center gap-2 ${
                opDetailTab === "routes"
                  ? "bg-white text-brand-600 shadow-sm border border-surface-200 font-extrabold"
                  : "text-surface-500 hover:text-surface-800 hover:bg-white/50"
              }`}
            >
              <MapPin className="w-4 h-4" /> Managed Routes
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold transition-all ${
                opDetailTab === "routes" ? "bg-brand-50 text-brand-700 font-extrabold" : "bg-surface-200 text-surface-600"
              }`}>
                {opRoutes.length}
              </span>
            </button>
          </div>

          {opDetailTab === "trips" && (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-50 border-b border-surface-200">
                    <th className="py-3 px-4 text-xs font-bold text-surface-500 uppercase tracking-wider">Trip ID</th>
                    <th className="py-3 px-4 text-xs font-bold text-surface-500 uppercase tracking-wider">Route</th>
                    <th className="py-3 px-4 text-xs font-bold text-surface-500 uppercase tracking-wider">Departure</th>
                    <th className="py-3 px-4 text-xs font-bold text-surface-500 uppercase tracking-wider">Fare</th>
                    <th className="py-3 px-4 text-xs font-bold text-surface-500 uppercase tracking-wider">Available Seats</th>
                    <th className="py-3 px-4 text-xs font-bold text-surface-500 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-200">
                  {opTrips.map((t, i) => {
                    const route = opRoutes.find(r => r.id === t.route_id);
                    const routeLabel = route ? `${route.origin_city} → ${route.destination_city}` : "Unknown Route";
                    return (
                      <tr key={i} className="hover:bg-surface-50 transition-colors">
                        <td className="py-3 px-4 text-sm font-mono text-surface-700">{t.id.substring(0, 8)}...</td>
                        <td className="py-3 px-4 text-sm text-surface-950 font-bold">{routeLabel}</td>
                        <td className="py-3 px-4 text-sm text-surface-500">{new Date(t.departure_datetime).toLocaleString()}</td>
                        <td className="py-3 px-4 text-sm font-bold text-surface-900">৳ {t.fare_amount}</td>
                        <td className="py-3 px-4 text-sm font-medium text-surface-800">{t.available_seats} remaining</td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                            t.status === 'COMPLETED' || (t.status === 'SCHEDULED' && new Date(t.departure_datetime) <= new Date()) ? 'bg-emerald-100 text-emerald-700' : 
                            t.status === 'CANCELLED' ? 'bg-red-100 text-red-700' : 
                            'bg-amber-100 text-amber-700'
                          }`}>
                            {t.status === 'SCHEDULED' && new Date(t.departure_datetime) <= new Date() ? 'COMPLETED' : t.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {opTrips.length === 0 && (
                    <tr><td colSpan={6} className="py-8 text-center text-surface-500">No trips recorded for this operator.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {opDetailTab === "routes" && (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-50 border-b border-surface-200">
                    <th className="py-3 px-4 text-xs font-bold text-surface-500 uppercase tracking-wider">Origin</th>
                    <th className="py-3 px-4 text-xs font-bold text-surface-500 uppercase tracking-wider">Destination</th>
                    <th className="py-3 px-4 text-xs font-bold text-surface-500 uppercase tracking-wider">Distance</th>
                    <th className="py-3 px-4 text-xs font-bold text-surface-500 uppercase tracking-wider">Est. Duration</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-200">
                  {opRoutes.map((r, i) => (
                    <tr key={i} className="hover:bg-surface-50 transition-colors">
                      <td className="py-3 px-4 text-sm font-bold text-surface-900">{r.origin_city}</td>
                      <td className="py-3 px-4 text-sm font-bold text-surface-900">{r.destination_city}</td>
                      <td className="py-3 px-4 text-sm text-surface-500">{r.distance_km} km</td>
                      <td className="py-3 px-4 text-sm text-surface-500">{r.estimated_duration_hours} hrs</td>
                    </tr>
                  ))}
                  {opRoutes.length === 0 && (
                    <tr><td colSpan={4} className="py-8 text-center text-surface-500">No routes registered for this operator.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-surface-50 flex" id="admin-portal">
      {/* Sidebar - Desktop */}
      <aside className={`fixed lg:sticky top-0 left-0 z-40 h-screen w-64 bg-surface-900 text-white transition-transform duration-300 transform ${isSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
        <div className="flex flex-col h-full">
          <div className="h-16 flex items-center px-6 border-b border-surface-800">
            <span className="text-xl font-bold font-heading">BusGo <span className="text-brand-400">Admin</span></span>
            <button className="ml-auto lg:hidden" onClick={() => setIsSidebarOpen(false)}>
              <X className="w-5 h-5 text-surface-400" />
            </button>
          </div>
          
          <nav className="flex-1 py-6 px-3 space-y-1 overflow-y-auto">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => { 
                  setActiveTab(item.id); 
                  setIsSidebarOpen(false); 
                  setSelectedUser(null);
                  setSelectedOperator(null);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium transition-colors ${
                  activeTab === item.id 
                    ? "bg-brand-600 text-white" 
                    : "text-surface-300 hover:bg-surface-800 hover:text-white"
                }`}
              >
                <item.icon className="w-5 h-5" /> {item.label}
              </button>
            ))}
          </nav>
          
          <div className="p-4 border-t border-surface-800">
            <button
              onClick={() => { 
                setActiveTab("Settings"); 
                setIsSidebarOpen(false); 
                setSelectedUser(null);
                setSelectedOperator(null);
              }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium transition-colors ${
                activeTab === "Settings" 
                  ? "bg-brand-600 text-white" 
                  : "text-surface-300 hover:bg-surface-800 hover:text-white"
              }`}
            >
              <Settings className="w-5 h-5" /> Settings
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-surface-200 flex items-center px-4 sm:px-6 lg:px-8">
          <button className="lg:hidden p-2 -ml-2 text-surface-500 hover:bg-surface-100 rounded-lg" onClick={() => setIsSidebarOpen(true)}>
            <Menu className="w-5 h-5" />
          </button>


          <div className="ml-auto flex items-center gap-4 relative">
            <NotificationBell scrolled={true} isHome={false} />
            <button
              onClick={handleRefresh}
              disabled={refreshing || tabLoading}
              title={`Refresh ${activeTab}`}
              className="p-2 rounded-lg text-surface-500 hover:text-brand-600 hover:bg-surface-100 transition-colors disabled:opacity-40"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
            </button>
            
            <button 
              onClick={() => setIsProfileOpen(!isProfileOpen)}
              className="flex items-center gap-2 hover:bg-surface-50 p-1 pr-2 rounded-full transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center font-bold text-xs border border-brand-200">
                {userStore?.name?.substring(0, 2).toUpperCase() || 'AD'}
              </div>
              <ChevronDown className="w-4 h-4 text-surface-500" />
            </button>

            {isProfileOpen && (
              <div className="absolute top-full right-0 mt-2 w-48 bg-white rounded-xl shadow-elevation-2 border border-surface-200 py-1 z-50">
                <div className="px-4 py-2 border-b border-surface-100 mb-1">
                  <p className="text-sm font-bold text-surface-900 truncate">{userStore?.name || 'Admin User'}</p>
                  <p className="text-xs text-surface-500 truncate">{userStore?.email || userStore?.phone}</p>
                </div>
                <button 
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                >
                  <LogOut className="w-4 h-4" /> Logout
                </button>
              </div>
            )}
          </div>
        </header>

        <div className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
          {activeTab === "Dashboard" && (
            <>
              <div className="mb-8">
                <h1 className="text-2xl font-bold text-surface-900">Platform Overview</h1>
                <p className="text-sm text-surface-500 mt-1">Monitor key metrics and system health.</p>
              </div>

              {loading ? (
                <div className="flex justify-center items-center py-20">
                  <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8 animate-fade-in">
                  <div className="card-premium p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                        <Users className="w-6 h-6" />
                      </div>
                      <span className="text-sm font-medium text-emerald-600 flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Live</span>
                    </div>
                    <p className="text-sm font-semibold text-surface-500 mb-1">Total Users</p>
                    <h3 className="text-2xl font-extrabold text-surface-900">{stats.totalUsers.toLocaleString()}</h3>
                  </div>

                  <div className="card-premium p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                        <Activity className="w-6 h-6" />
                      </div>
                      <span className="text-sm font-medium text-emerald-600 flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Live</span>
                    </div>
                    <p className="text-sm font-semibold text-surface-500 mb-1">Total Bookings</p>
                    <h3 className="text-2xl font-extrabold text-surface-900">{stats.totalBookings.toLocaleString()}</h3>
                  </div>

                  <div className="card-premium p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                        <DollarSign className="w-6 h-6" />
                      </div>
                      <span className="text-sm font-medium text-emerald-600 flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Live</span>
                    </div>
                    <p className="text-sm font-semibold text-surface-500 mb-1">Total Revenue</p>
                    <h3 className="text-2xl font-extrabold text-surface-900">৳ {(stats.totalRevenue).toLocaleString()}</h3>
                  </div>

                  <div className="card-premium p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                        <Bus className="w-6 h-6" />
                      </div>
                      <span className="text-sm font-medium text-emerald-600 flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Live</span>
                    </div>
                    <p className="text-sm font-semibold text-surface-500 mb-1">Active Operators</p>
                    <h3 className="text-2xl font-extrabold text-surface-900">{stats.activeOperators}</h3>
                  </div>
                </div>
              )}

              <div className="card-premium p-6">
                <h3 className="font-bold text-surface-900 mb-4">Recent System Alerts</h3>
                <div className="space-y-4">
                  <div className="flex items-start gap-3 p-4 rounded-xl bg-surface-50 border border-surface-100">
                    <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-bold text-surface-900">Platform operational</h4>
                      <p className="text-sm text-surface-500 mt-1">All services are currently running smoothly without any interruptions.</p>
                    </div>
                    <span className="text-xs text-surface-400 ml-auto flex-shrink-0">Just now</span>
                  </div>
                  <div className="flex items-start gap-3 p-4 rounded-xl bg-surface-50 border border-surface-100">
                    <AlertCircle className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-bold text-surface-900">Database Connection Active</h4>
                      <p className="text-sm text-surface-500 mt-1">Cross-database queries across microservices have successfully resolved.</p>
                    </div>
                    <span className="text-xs text-surface-400 ml-auto flex-shrink-0">3 mins ago</span>
                  </div>
                </div>
              </div>
            </>
          )}

          {activeTab !== "Dashboard" && (
            <div className="animate-fade-in">
              {activeTab === "Users" && selectedUser ? (
                renderUserDetails()
              ) : activeTab === "Operators" && selectedOperator ? (
                renderOperatorDetails()
              ) : (
                <>
                  {activeTab !== "Finance" && activeTab !== "Settings" && activeTab !== "Notifications" && (
                    <div className="mb-6 flex justify-between items-center">
                      <div>
                        <h1 className="text-2xl font-bold text-surface-900">{activeTab} Management</h1>
                        <p className="text-sm text-surface-500 mt-1">Manage and view {activeTab.toLowerCase()} in the system.</p>
                      </div>
                    </div>
                  )}

                  {activeTab === "Notifications" ? (
                    tabLoading ? (
                      <div className="flex justify-center items-center py-20">
                        <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
                      </div>
                    ) : (
                      <AdminNotifications allUsers={users} />
                    )
                  ) : tabLoading ? (
                    <div className="flex justify-center items-center py-20">
                      <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
                    </div>
                  ) : (
                    <div className="card-premium overflow-hidden">
                  {activeTab === "Operators" && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-surface-50 border-b border-surface-200">
                            <th className="py-3 px-4 text-xs font-bold text-surface-500 uppercase tracking-wider">Name</th>
                            <th className="py-3 px-4 text-xs font-bold text-surface-500 uppercase tracking-wider">Contact</th>
                            <th className="py-3 px-4 text-xs font-bold text-surface-500 uppercase tracking-wider">License</th>
                            <th className="py-3 px-4 text-xs font-bold text-surface-500 uppercase tracking-wider">Status</th>
                            <th className="py-3 px-4 text-xs font-bold text-surface-500 uppercase tracking-wider text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-surface-200">
                          {operators.map((op, i) => (
                            <tr key={i} className="hover:bg-surface-50 transition-colors">
                              <td className="py-3 px-4 text-sm font-medium text-surface-900">{op.name}</td>
                              <td className="py-3 px-4 text-sm text-surface-500">{op.contact_phone}<br/><span className="text-xs text-surface-400">{op.contact_email}</span></td>
                              <td className="py-3 px-4 text-sm text-surface-500">{op.license_no}</td>
                              <td className="py-3 px-4">
                                <span className={`px-2 py-1 text-xs font-semibold rounded-full ${op.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                  {op.is_active ? 'Active' : 'Inactive'}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-right">
                                <button 
                                  onClick={() => setSelectedOperator(op)}
                                  className="text-xs font-bold px-3 py-1.5 rounded-lg bg-brand-50 text-brand-600 hover:bg-brand-100 transition-colors"
                                >
                                  View Activity
                                </button>
                              </td>
                            </tr>
                          ))}
                          {operators.length === 0 && (
                            <tr><td colSpan={5} className="py-8 text-center text-surface-500">No operators found.</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {activeTab === "Routes" && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-surface-50 border-b border-surface-200">
                            <th className="py-3 px-4 text-xs font-bold text-surface-500 uppercase tracking-wider">Origin</th>
                            <th className="py-3 px-4 text-xs font-bold text-surface-500 uppercase tracking-wider">Destination</th>
                            <th className="py-3 px-4 text-xs font-bold text-surface-500 uppercase tracking-wider">Distance</th>
                            <th className="py-3 px-4 text-xs font-bold text-surface-500 uppercase tracking-wider">Duration</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-surface-200">
                          {routes.map((rt, i) => (
                            <tr key={i} className="hover:bg-surface-50 transition-colors">
                              <td className="py-3 px-4 text-sm font-medium text-surface-900">{rt.origin_city}</td>
                              <td className="py-3 px-4 text-sm font-medium text-surface-900">{rt.destination_city}</td>
                              <td className="py-3 px-4 text-sm text-surface-500">{rt.distance_km} km</td>
                              <td className="py-3 px-4 text-sm text-surface-500">{rt.estimated_duration_hours} hrs</td>
                            </tr>
                          ))}
                          {routes.length === 0 && (
                            <tr><td colSpan={4} className="py-8 text-center text-surface-500">No routes found.</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {activeTab === "Users" && (
                    <div className="flex flex-col">
                      {/* Premium Tabs Header */}
                      <div className="flex border-b border-surface-200 bg-surface-50 p-2 gap-2">
                        {[
                          { id: "CUSTOMER", label: "Customers", activeBadge: "bg-brand-50 text-brand-700" },
                          { id: "OPERATOR", label: "Operators", activeBadge: "bg-blue-50 text-blue-700" },
                          { id: "ADMIN", label: "Admins", activeBadge: "bg-purple-50 text-purple-700" },
                        ].map((t) => {
                          const count = users.filter((u) => u.role === t.id).length;
                          const isActive = userRoleTab === t.id;
                          return (
                            <button
                              key={t.id}
                              onClick={() => setUserRoleTab(t.id as any)}
                              className={`px-4 py-2 text-sm font-bold rounded-lg transition-all flex items-center gap-2 ${
                                isActive
                                  ? "bg-white text-brand-600 shadow-sm border border-surface-200 font-extrabold"
                                  : "text-surface-500 hover:text-surface-800 hover:bg-white/50"
                              }`}
                            >
                              {t.label}
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold transition-all ${
                                isActive
                                  ? t.activeBadge + " font-extrabold"
                                  : "bg-surface-200 text-surface-600"
                              }`}>
                                {count}
                              </span>
                            </button>
                          );
                        })}
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-surface-50 border-b border-surface-200">
                              <th className="py-3 px-4 text-xs font-bold text-surface-500 uppercase tracking-wider">Name</th>
                              <th className="py-3 px-4 text-xs font-bold text-surface-500 uppercase tracking-wider">Contact</th>
                              <th className="py-3 px-4 text-xs font-bold text-surface-500 uppercase tracking-wider">Role</th>
                              <th className="py-3 px-4 text-xs font-bold text-surface-500 uppercase tracking-wider">Joined</th>
                              <th className="py-3 px-4 text-xs font-bold text-surface-500 uppercase tracking-wider text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-surface-200">
                            {users.filter((u) => u.role === userRoleTab).map((u, i) => (
                              <tr key={i} className="hover:bg-surface-50 transition-colors">
                                <td className="py-3 px-4 text-sm font-medium text-surface-900">{u.full_name}</td>
                                <td className="py-3 px-4 text-sm text-surface-500">{u.phone}<br/><span className="text-xs text-surface-400">{u.email}</span></td>
                                <td className="py-3 px-4">
                                  <span className={`px-2.5 py-1 text-xs font-semibold rounded-full border ${
                                    u.role === 'ADMIN' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                                    u.role === 'OPERATOR' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                    'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  }`}>
                                    {u.role}
                                  </span>
                                </td>
                                <td className="py-3 px-4 text-sm text-surface-500">
                                  {new Date(u.created_at).toLocaleDateString()}
                                </td>
                                <td className="py-3 px-4 text-right flex justify-end gap-2">
                                  <button 
                                    onClick={() => setSelectedUser(u)}
                                    className="text-xs font-bold px-3 py-1.5 rounded-lg bg-surface-100 text-surface-700 hover:bg-surface-200 transition-colors"
                                  >
                                    View Activity
                                  </button>
                                  {u.id !== userStore?.id && (
                                    <button 
                                      onClick={() => changeUserRole(u.id, u.role === 'ADMIN' ? 'CUSTOMER' : 'ADMIN')}
                                      className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-colors ${
                                        u.role === 'ADMIN' 
                                          ? 'bg-red-50 text-red-600 hover:bg-red-100' 
                                          : 'bg-brand-50 text-brand-600 hover:bg-brand-100'
                                      }`}
                                    >
                                      {u.role === 'ADMIN' ? 'Remove Admin' : 'Make Admin'}
                                    </button>
                                  )}
                                </td>
                              </tr>
                            ))}
                            {users.filter((u) => u.role === userRoleTab).length === 0 && (
                              <tr>
                                <td colSpan={5} className="py-8 text-center text-surface-500">
                                  No {userRoleTab.toLowerCase()}s found.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {activeTab === "User History" && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-surface-50 border-b border-surface-200">
                            <th className="py-3 px-4 text-xs font-bold text-surface-500 uppercase tracking-wider">User</th>
                            <th className="py-3 px-4 text-xs font-bold text-surface-500 uppercase tracking-wider">Trip ID</th>
                            <th className="py-3 px-4 text-xs font-bold text-surface-500 uppercase tracking-wider">Date</th>
                            <th className="py-3 px-4 text-xs font-bold text-surface-500 uppercase tracking-wider">Amount</th>
                            <th className="py-3 px-4 text-xs font-bold text-surface-500 uppercase tracking-wider">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-surface-200">
                          {userHistory.map((uh, i) => (
                            <tr key={i} className="hover:bg-surface-50 transition-colors">
                              <td className="py-3 px-4 text-sm font-medium text-surface-900">
                                {uh.user?.full_name}
                                <br/>
                                <span className="text-xs text-surface-400 font-normal">{uh.user?.phone}</span>
                              </td>
                              <td className="py-3 px-4 text-sm font-mono text-surface-500">{uh.trip_id.split('-')[0]}...</td>
                              <td className="py-3 px-4 text-sm text-surface-500">{new Date(uh.created_at).toLocaleString()}</td>
                              <td className="py-3 px-4 text-sm font-medium text-surface-900">৳ {uh.total_fare}</td>
                              <td className="py-3 px-4">
                                <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                                  uh.status === 'CONFIRMED' ? 'bg-emerald-100 text-emerald-700' : 
                                  uh.status === 'CANCELLED' ? 'bg-red-100 text-red-700' : 
                                  'bg-amber-100 text-amber-700'
                                }`}>
                                  {uh.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                          {userHistory.length === 0 && (
                            <tr><td colSpan={5} className="py-8 text-center text-surface-500">No booking history found.</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {activeTab === "Transactions" && (
                    <div className="flex flex-col">
                      <div className="p-6 border-b border-surface-200 bg-surface-50">
                        <h2 className="text-lg font-bold text-surface-900 mb-4">Datewise Transaction Summary</h2>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                          {transactionSummary.map((sum, i) => (
                            <div key={i} className="bg-white p-4 rounded-xl border border-surface-200 shadow-sm">
                              <p className="text-xs font-bold text-surface-500 mb-1 uppercase">{new Date(sum.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric'})}</p>
                              <p className="text-xl font-extrabold text-brand-600">৳ {sum.total}</p>
                            </div>
                          ))}
                          {transactionSummary.length === 0 && (
                            <div className="col-span-full py-4 text-center text-surface-500">No transaction summaries available.</div>
                          )}
                        </div>
                      </div>
                      
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-white border-b border-surface-200">
                              <th className="py-3 px-4 text-xs font-bold text-surface-500 uppercase tracking-wider">Transaction ID</th>
                              <th className="py-3 px-4 text-xs font-bold text-surface-500 uppercase tracking-wider">User</th>
                              <th className="py-3 px-4 text-xs font-bold text-surface-500 uppercase tracking-wider">Date & Time</th>
                              <th className="py-3 px-4 text-xs font-bold text-surface-500 uppercase tracking-wider">Method</th>
                              <th className="py-3 px-4 text-xs font-bold text-surface-500 uppercase tracking-wider">Amount</th>
                              <th className="py-3 px-4 text-xs font-bold text-surface-500 uppercase tracking-wider">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-surface-200">
                            {transactions.map((t, i) => (
                              <tr key={i} className="hover:bg-surface-50 transition-colors">
                                <td className="py-3 px-4 text-sm font-mono text-surface-500">{t.id.split('-')[0]}...</td>
                                <td className="py-3 px-4 text-sm font-medium text-surface-900">
                                  {t.user?.full_name}
                                  <br/>
                                  <span className="text-xs text-surface-400 font-normal">{t.user?.phone}</span>
                                </td>
                                <td className="py-3 px-4 text-sm text-surface-500">{new Date(t.initiated_at).toLocaleString()}</td>
                                <td className="py-3 px-4 text-sm font-medium text-surface-900">{t.method}</td>
                                <td className="py-3 px-4 text-sm font-bold text-surface-900">৳ {t.amount}</td>
                                <td className="py-3 px-4">
                                  {t.status !== 'PENDING' && (
                                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                                      t.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700' :
                                      t.status === 'FAILED' ? 'bg-red-100 text-red-700' :
                                      'bg-amber-100 text-amber-700'
                                    }`}>
                                      {t.status}
                                    </span>
                                  )}
                                </td>
                              </tr>
                            ))}
                            {transactions.length === 0 && (
                              <tr><td colSpan={6} className="py-8 text-center text-surface-500">No transactions found.</td></tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {activeTab === "Bank" && (() => {
                    const userMap: Record<string, any> = {};
                    bankUsers.forEach((u) => { userMap[u.id] = u; });
                    const q = bankSearch.trim().toLowerCase();
                    const filtered = bankAccounts.filter((a) => {
                      if (!q) return true;
                      const u = userMap[a.user_id];
                      return (
                        a.account_number.toLowerCase().includes(q) ||
                        a.provider.toLowerCase().includes(q) ||
                        (u && (u.full_name?.toLowerCase().includes(q) || u.phone?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q)))
                      );
                    });
                    return (
                      <div className="flex flex-col">
                        <div className="p-4 border-b border-surface-200 bg-surface-50">
                          <div className="relative max-w-md">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-400" />
                            <input
                              type="text"
                              value={bankSearch}
                              onChange={(e) => setBankSearch(e.target.value)}
                              placeholder="Search by user, phone, provider or account number"
                              className="input-premium !pl-9 !py-2 text-sm"
                            />
                          </div>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="bg-surface-50 border-b border-surface-200">
                                <th className="py-3 px-4 text-xs font-bold text-surface-500 uppercase tracking-wider">User</th>
                                <th className="py-3 px-4 text-xs font-bold text-surface-500 uppercase tracking-wider">Account</th>
                                <th className="py-3 px-4 text-xs font-bold text-surface-500 uppercase tracking-wider">Number</th>
                                <th className="py-3 px-4 text-xs font-bold text-surface-500 uppercase tracking-wider">Balance</th>
                                <th className="py-3 px-4 text-xs font-bold text-surface-500 uppercase tracking-wider text-right">Set Balance</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-surface-200">
                              {filtered.map((a) => {
                                const u = userMap[a.user_id];
                                const editing = editBalances[a.id];
                                return (
                                  <tr key={a.id} className="hover:bg-surface-50 transition-colors">
                                    <td className="py-3 px-4 text-sm font-medium text-surface-900">
                                      {u?.full_name || "Unknown"}
                                      <br/>
                                      <span className="text-xs text-surface-400 font-normal">{u?.phone || a.user_id.substring(0, 8)}</span>
                                    </td>
                                    <td className="py-3 px-4">
                                      <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-surface-800">
                                        {a.account_type === "MOBILE" ? <Wallet className="h-4 w-4 text-pink-500" /> : <Landmark className="h-4 w-4 text-emerald-600" />}
                                        {a.provider}
                                      </span>
                                    </td>
                                    <td className="py-3 px-4 text-sm font-mono text-surface-500">{a.account_number}</td>
                                    <td className="py-3 px-4 text-sm font-extrabold text-surface-900">৳ {Number(a.balance).toLocaleString()}</td>
                                    <td className="py-3 px-4">
                                      <div className="flex items-center justify-end gap-2">
                                        <input
                                          type="number"
                                          value={editing ?? ""}
                                          onChange={(e) => setEditBalances((prev) => ({ ...prev, [a.id]: e.target.value }))}
                                          placeholder={String(Number(a.balance))}
                                          className="w-28 px-2 py-1.5 text-sm rounded-lg border border-surface-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
                                        />
                                        <button
                                          onClick={() => saveBalance(a.id)}
                                          disabled={savingAccount === a.id || editing === undefined || editing === ""}
                                          className="text-xs font-bold px-3 py-1.5 rounded-lg bg-brand-50 text-brand-600 hover:bg-brand-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
                                        >
                                          {savingAccount === a.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                                          Save
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                              {filtered.length === 0 && (
                                <tr><td colSpan={5} className="py-8 text-center text-surface-500">No bank accounts found.</td></tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })()}

                  {activeTab === "Notices" && (
                    <div className="p-6 space-y-6">
                      {/* Create / Edit form */}
                      <div className="bg-white border border-surface-200 rounded-2xl p-6 shadow-elevation-1">
                        <h3 className="text-base font-bold text-surface-900 mb-4 flex items-center gap-2">
                          {editingNotice ? <><Pencil className="h-4 w-4 text-brand-600" /> Edit Notice</> : <><Plus className="h-4 w-4 text-brand-600" /> New Notice</>}
                        </h3>
                        <div className="space-y-3">
                          <input
                            type="text"
                            value={noticeForm.title}
                            onChange={(e) => setNoticeForm((f) => ({ ...f, title: e.target.value }))}
                            placeholder="Notice title (e.g. Eid Trip Notice)"
                            className="input-premium w-full"
                          />
                          <textarea
                            value={noticeForm.body}
                            onChange={(e) => setNoticeForm((f) => ({ ...f, body: e.target.value }))}
                            placeholder="Notice body — supports line breaks"
                            rows={4}
                            className="input-premium w-full resize-none"
                          />
                          <div className="flex items-center gap-3">
                            <label className="flex items-center gap-2 cursor-pointer select-none">
                              <input
                                type="checkbox"
                                checked={noticeForm.is_active}
                                onChange={(e) => setNoticeForm((f) => ({ ...f, is_active: e.target.checked }))}
                                className="w-4 h-4 accent-brand-600"
                              />
                              <span className="text-sm text-surface-700 font-medium">Publish immediately (visible to users)</span>
                            </label>
                          </div>
                          <div className="flex gap-2 pt-1">
                            <button
                              disabled={savingNotice || !noticeForm.title.trim() || !noticeForm.body.trim()}
                              onClick={async () => {
                                setSavingNotice(true);
                                try {
                                  if (editingNotice) {
                                    const res = await apiClient.patch(`/api/admin/notices/${editingNotice.id}`, noticeForm);
                                    if (res.data.success) {
                                      setAdminNotices((prev) => prev.map((n) => n.id === editingNotice.id ? res.data.data : n));
                                      toast.success("Notice updated");
                                    }
                                  } else {
                                    const res = await apiClient.post('/api/admin/notices', noticeForm);
                                    if (res.data.success) {
                                      setAdminNotices((prev) => [res.data.data, ...prev]);
                                      toast.success("Notice published");
                                    }
                                  }
                                  setNoticeForm({ title: "", body: "", is_active: true });
                                  setEditingNotice(null);
                                } catch (err: any) {
                                  toast.error(err.response?.data?.detail || "Failed to save notice");
                                } finally {
                                  setSavingNotice(false);
                                }
                              }}
                              className="btn-primary !py-2 !px-5 text-sm flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {savingNotice ? <Loader2 className="h-4 w-4 animate-spin" /> : editingNotice ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                              {editingNotice ? "Save Changes" : "Publish Notice"}
                            </button>
                            {editingNotice && (
                              <button
                                onClick={() => { setEditingNotice(null); setNoticeForm({ title: "", body: "", is_active: true }); }}
                                className="btn-secondary !py-2 !px-5 text-sm"
                              >
                                Cancel
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Existing notices list */}
                      <div className="space-y-3">
                        {adminNotices.length === 0 && (
                          <div className="text-center py-12 text-surface-400 italic">No notices yet. Create one above.</div>
                        )}
                        {adminNotices.map((n) => (
                          <div key={n.id} className={`bg-white border rounded-2xl p-5 shadow-elevation-1 ${n.is_active ? "border-amber-200" : "border-surface-200 opacity-60"}`}>
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex items-start gap-3 min-w-0">
                                <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 ${n.is_active ? "bg-amber-100" : "bg-surface-100"}`}>
                                  <Megaphone className={`h-4 w-4 ${n.is_active ? "text-amber-600" : "text-surface-400"}`} />
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <p className="font-bold text-surface-900">{n.title}</p>
                                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${n.is_active ? "bg-emerald-50 text-emerald-700" : "bg-surface-100 text-surface-500"}`}>
                                      {n.is_active ? "Live" : "Hidden"}
                                    </span>
                                  </div>
                                  <p className="text-surface-600 text-sm mt-1 whitespace-pre-line">{n.body}</p>
                                  <p className="text-surface-400 text-xs mt-2">
                                    {new Date(n.created_at).toLocaleString()}
                                    {n.updated_at !== n.created_at && ` · edited ${new Date(n.updated_at).toLocaleString()}`}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-1 flex-shrink-0">
                                <button
                                  title={n.is_active ? "Hide notice" : "Publish notice"}
                                  onClick={async () => {
                                    try {
                                      const res = await apiClient.patch(`/api/admin/notices/${n.id}`, { is_active: !n.is_active });
                                      if (res.data.success) setAdminNotices((prev) => prev.map((x) => x.id === n.id ? res.data.data : x));
                                      toast.success(n.is_active ? "Notice hidden" : "Notice published");
                                    } catch { toast.error("Failed to update notice"); }
                                  }}
                                  className="p-2 rounded-lg hover:bg-surface-100 text-surface-400 hover:text-surface-700 transition-colors"
                                >
                                  {n.is_active ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                                <button
                                  title="Edit"
                                  onClick={() => { setEditingNotice(n); setNoticeForm({ title: n.title, body: n.body, is_active: n.is_active }); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                                  className="p-2 rounded-lg hover:bg-brand-50 text-surface-400 hover:text-brand-600 transition-colors"
                                >
                                  <Pencil className="h-4 w-4" />
                                </button>
                                <button
                                  title="Delete"
                                  onClick={async () => {
                                    if (!confirm(`Delete notice "${n.title}"?`)) return;
                                    try {
                                      await apiClient.delete(`/api/admin/notices/${n.id}`);
                                      setAdminNotices((prev) => prev.filter((x) => x.id !== n.id));
                                      toast.success("Notice deleted");
                                    } catch { toast.error("Failed to delete notice"); }
                                  }}
                                  className="p-2 rounded-lg hover:bg-red-50 text-surface-400 hover:text-red-600 transition-colors"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {(activeTab === "Settings") && (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                      <div className="w-20 h-20 bg-surface-100 rounded-full flex items-center justify-center mb-4">
                        <Settings className="w-10 h-10 text-surface-400" />
                      </div>
                      <h2 className="text-2xl font-bold text-surface-900 mb-2">Settings Management</h2>
                      <p className="text-surface-500 max-w-md mx-auto">
                        The settings interface is coming soon.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  </main>
      
      {/* Mobile Overlay */}
      {isSidebarOpen && (
        <div className="fixed inset-0 bg-surface-900/50 z-30 lg:hidden" onClick={() => setIsSidebarOpen(false)} />
      )}
    </div>
  );
}
