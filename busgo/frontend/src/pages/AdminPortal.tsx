import { useState, useEffect } from "react";
import { Users, Bus, Map, DollarSign, Activity, Settings, TrendingUp, AlertCircle, Menu, X, Loader2, LogOut, ChevronDown, History, CreditCard } from "lucide-react";
import { apiClient } from "../api/client";
import { useAuthStore } from "../stores/authStore";
import { useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";

export function AdminPortal() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("Dashboard");
  const [loading, setLoading] = useState(true);
  const [tabLoading, setTabLoading] = useState(false);
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalBookings: 0,
    totalRevenue: 0,
    activeOperators: 0
  });

  const [operators, setOperators] = useState<any[]>([]);
  const [routes, setRoutes] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [userHistory, setUserHistory] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [transactionSummary, setTransactionSummary] = useState<any[]>([]);

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

  useEffect(() => {
    const fetchTabData = async () => {
      if (activeTab === "Dashboard" || activeTab === "Finance" || activeTab === "Settings") return;
      
      setTabLoading(true);
      try {
        if (activeTab === "User History") {
          const res = await apiClient.get('/api/admin/user-history');
          if (res.data.success) setUserHistory(res.data.data);
        } else if (activeTab === "Transactions") {
          const [transRes, sumRes] = await Promise.all([
            apiClient.get('/api/admin/transactions'),
            apiClient.get('/api/admin/transactions/summary')
          ]);
          if (transRes.data.success) setTransactions(transRes.data.data);
          if (sumRes.data.success) setTransactionSummary(sumRes.data.data);
        } else {
          const response = await apiClient.get(`/api/admin/${activeTab.toLowerCase()}`);
          if (response.data.success) {
            if (activeTab === "Operators") setOperators(response.data.data);
            if (activeTab === "Routes") setRoutes(response.data.data);
            if (activeTab === "Users") setUsers(response.data.data);
          }
        }
      } catch (error) {
        console.error(`Failed to fetch ${activeTab}:`, error);
      } finally {
        setTabLoading(false);
      }
    };
    fetchTabData();
  }, [activeTab]);

  const navItems = [
    { id: "Dashboard", icon: Activity, label: "Dashboard" },
    { id: "Operators", icon: Bus, label: "Operators" },
    { id: "Routes", icon: Map, label: "Routes" },
    { id: "Users", icon: Users, label: "Users" },
    { id: "User History", icon: History, label: "User History" },
    { id: "Transactions", icon: CreditCard, label: "Transactions" },
  ];

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
                onClick={() => { setActiveTab(item.id); setIsSidebarOpen(false); }}
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
              onClick={() => { setActiveTab("Settings"); setIsSidebarOpen(false); }}
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
              {activeTab !== "Finance" && activeTab !== "Settings" && (
                <div className="mb-6 flex justify-between items-center">
                  <div>
                    <h1 className="text-2xl font-bold text-surface-900">{activeTab} Management</h1>
                    <p className="text-sm text-surface-500 mt-1">Manage and view {activeTab.toLowerCase()} in the system.</p>
                  </div>
                </div>
              )}

              {tabLoading ? (
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
                            </tr>
                          ))}
                          {operators.length === 0 && (
                            <tr><td colSpan={4} className="py-8 text-center text-surface-500">No operators found.</td></tr>
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
                          {users.map((u, i) => (
                            <tr key={i} className="hover:bg-surface-50 transition-colors">
                              <td className="py-3 px-4 text-sm font-medium text-surface-900">{u.full_name}</td>
                              <td className="py-3 px-4 text-sm text-surface-500">{u.phone}<br/><span className="text-xs text-surface-400">{u.email}</span></td>
                              <td className="py-3 px-4">
                                <span className={`px-2 py-1 text-xs font-semibold rounded-full ${u.role === 'ADMIN' ? 'bg-purple-100 text-purple-700' : 'bg-surface-100 text-surface-700'}`}>
                                  {u.role}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-sm text-surface-500">
                                {new Date(u.created_at).toLocaleDateString()}
                              </td>
                              <td className="py-3 px-4 text-right">
                                {u.id !== userStore?.id && (
                                  <button 
                                    onClick={() => changeUserRole(u.id, u.role === 'ADMIN' ? 'CUSTOMER' : 'ADMIN')}
                                    className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-colors ${u.role === 'ADMIN' ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-brand-50 text-brand-600 hover:bg-brand-100'}`}
                                  >
                                    {u.role === 'ADMIN' ? 'Remove Admin' : 'Make Admin'}
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                          {users.length === 0 && (
                            <tr><td colSpan={5} className="py-8 text-center text-surface-500">No users found.</td></tr>
                          )}
                        </tbody>
                      </table>
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
                                  <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                                    t.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700' : 
                                    t.status === 'FAILED' ? 'bg-red-100 text-red-700' : 
                                    'bg-amber-100 text-amber-700'
                                  }`}>
                                    {t.status}
                                  </span>
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
