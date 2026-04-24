import { useState, useEffect } from "react";
import { Users, Bus, Map, DollarSign, Activity, Settings, TrendingUp, AlertCircle, Menu, X } from "lucide-react";
import { apiClient } from "../api/client";

export function AdminPortal() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [stats, setStats] = useState({
    totalUsers: 1420,
    totalBookings: 8430,
    totalRevenue: 2450000,
    activeOperators: 24
  });

  // Mocking stats for now since admin-service is not fully connected
  // useEffect(() => { ... fetch stats ... }, [])

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
            <a href="#" className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-brand-600 text-white font-medium">
              <Activity className="w-5 h-5" /> Dashboard
            </a>
            <a href="#" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-surface-300 hover:bg-surface-800 hover:text-white font-medium transition-colors">
              <Bus className="w-5 h-5" /> Operators
            </a>
            <a href="#" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-surface-300 hover:bg-surface-800 hover:text-white font-medium transition-colors">
              <Map className="w-5 h-5" /> Routes
            </a>
            <a href="#" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-surface-300 hover:bg-surface-800 hover:text-white font-medium transition-colors">
              <Users className="w-5 h-5" /> Users
            </a>
            <a href="#" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-surface-300 hover:bg-surface-800 hover:text-white font-medium transition-colors">
              <DollarSign className="w-5 h-5" /> Finance
            </a>
          </nav>
          
          <div className="p-4 border-t border-surface-800">
            <a href="#" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-surface-300 hover:bg-surface-800 hover:text-white font-medium transition-colors">
              <Settings className="w-5 h-5" /> Settings
            </a>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-surface-200 flex items-center px-4 sm:px-6 lg:px-8">
          <button className="lg:hidden p-2 -ml-2 text-surface-500 hover:bg-surface-100 rounded-lg" onClick={() => setIsSidebarOpen(true)}>
            <Menu className="w-5 h-5" />
          </button>
          <div className="ml-auto flex items-center gap-4">
            <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center font-bold text-xs border border-brand-200">
              AD
            </div>
          </div>
        </header>

        <div className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-surface-900">Platform Overview</h1>
            <p className="text-sm text-surface-500 mt-1">Monitor key metrics and system health.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="card-premium p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Users className="w-6 h-6" />
                </div>
                <span className="text-sm font-medium text-emerald-600 flex items-center gap-1"><TrendingUp className="w-3 h-3" /> +12%</span>
              </div>
              <p className="text-sm font-semibold text-surface-500 mb-1">Total Users</p>
              <h3 className="text-2xl font-extrabold text-surface-900">{stats.totalUsers.toLocaleString()}</h3>
            </div>

            <div className="card-premium p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <Activity className="w-6 h-6" />
                </div>
                <span className="text-sm font-medium text-emerald-600 flex items-center gap-1"><TrendingUp className="w-3 h-3" /> +8%</span>
              </div>
              <p className="text-sm font-semibold text-surface-500 mb-1">Total Bookings</p>
              <h3 className="text-2xl font-extrabold text-surface-900">{stats.totalBookings.toLocaleString()}</h3>
            </div>

            <div className="card-premium p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                  <DollarSign className="w-6 h-6" />
                </div>
                <span className="text-sm font-medium text-emerald-600 flex items-center gap-1"><TrendingUp className="w-3 h-3" /> +15%</span>
              </div>
              <p className="text-sm font-semibold text-surface-500 mb-1">Total Revenue</p>
              <h3 className="text-2xl font-extrabold text-surface-900">৳ {(stats.totalRevenue).toLocaleString()}</h3>
            </div>

            <div className="card-premium p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                  <Bus className="w-6 h-6" />
                </div>
              </div>
              <p className="text-sm font-semibold text-surface-500 mb-1">Active Operators</p>
              <h3 className="text-2xl font-extrabold text-surface-900">{stats.activeOperators}</h3>
            </div>
          </div>

          <div className="card-premium p-6">
            <h3 className="font-bold text-surface-900 mb-4">Recent System Alerts</h3>
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-4 rounded-xl bg-surface-50 border border-surface-100">
                <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-bold text-surface-900">High traffic detected</h4>
                  <p className="text-sm text-surface-500 mt-1">Traffic on the booking service has increased by 40% in the last hour. Auto-scaling triggered.</p>
                </div>
                <span className="text-xs text-surface-400 ml-auto flex-shrink-0">10 mins ago</span>
              </div>
              <div className="flex items-start gap-3 p-4 rounded-xl bg-surface-50 border border-surface-100">
                <AlertCircle className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-bold text-surface-900">Database Backup Successful</h4>
                  <p className="text-sm text-surface-500 mt-1">Daily automated backup of user and booking databases completed without errors.</p>
                </div>
                <span className="text-xs text-surface-400 ml-auto flex-shrink-0">3 hours ago</span>
              </div>
            </div>
          </div>

        </div>
      </main>
      
      {/* Mobile Overlay */}
      {isSidebarOpen && (
        <div className="fixed inset-0 bg-surface-900/50 z-30 lg:hidden" onClick={() => setIsSidebarOpen(false)} />
      )}
    </div>
  );
}
