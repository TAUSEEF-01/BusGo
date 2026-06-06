import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  User, Mail, Phone, Calendar, Shield, CreditCard, Ticket,
  Clock, ArrowRight, ChevronRight, Loader2, Wallet, Award, CheckCircle2, AlertCircle, XCircle
} from "lucide-react";
import { useAuthStore } from "../stores/authStore";
import { apiClient } from "../api/client";

type Tab = "travel" | "transactions";

interface Booking {
  id: string;
  operator: string;
  from: string;
  to: string;
  date: string;
  departure: string;
  seats: string[];
  total: number;
  status: "upcoming" | "completed" | "cancelled";
  ticketId: string;
}

interface Payment {
  id: string;
  bookingId: string;
  amount: number;
  method: string;
  status: "PENDING" | "COMPLETED" | "FAILED" | "REFUNDED";
  initiatedAt: string;
  completedAt: string | null;
  gatewayTxnId: string | null;
}

const METHOD_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  BKASH: { bg: "bg-pink-50 text-pink-600 border border-pink-200", text: "text-pink-600", label: "bKash" },
  NAGAD: { bg: "bg-orange-50 text-orange-600 border border-orange-200", text: "text-orange-600", label: "Nagad" },
  ROCKET: { bg: "bg-purple-50 text-purple-600 border border-purple-200", text: "text-purple-600", label: "Rocket" },
  VISA: { bg: "bg-blue-50 text-blue-600 border border-blue-200", text: "text-blue-600", label: "Visa Card" },
  MASTERCARD: { bg: "bg-red-50 text-red-500 border border-red-200", text: "text-red-500", label: "Mastercard" },
};

const PAYMENT_STATUS_STYLES: Record<string, string> = {
  PENDING: "badge-warning",
  COMPLETED: "badge-success",
  FAILED: "badge-error",
  REFUNDED: "badge-neutral",
};

const getMethodStyle = (method: string) => {
  const norm = method.toUpperCase();
  return METHOD_STYLES[norm] || { bg: "bg-surface-50 text-surface-600 border border-surface-200", text: "text-surface-600", label: method };
};

const formatDate = (dateStr: string) => {
  if (!dateStr) return "N/A";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
};

const formatTime = (timeStr: string) => {
  if (!timeStr || timeStr === "N/A") return "N/A";
  try {
    if (timeStr.includes("AM") || timeStr.includes("PM")) return timeStr;
    const parts = timeStr.split(":");
    let hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12 || 12;
    const strMins = minutes < 10 ? "0" + minutes : minutes;
    const strHours = hours < 10 ? "0" + hours : hours;
    return `${strHours}:${strMins} ${ampm}`;
  } catch {
    return timeStr;
  }
};

export function Profile() {
  const { user, updateUser } = useAuthStore();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>("travel");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalTrips: 0,
    activeTrips: 0,
    totalSpent: 0,
  });

  // Profile Edit State
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(user?.name || "");
  const [editEmail, setEditEmail] = useState(user?.email || "");
  const [editPhone, setEditPhone] = useState(user?.phone || "");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Sync edits if user changes
  useEffect(() => {
    if (user) {
      setEditName(user.name);
      setEditEmail(user.email);
      setEditPhone(user.phone);
    }
  }, [user]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setSubmitting(true);

    try {
      const res = await apiClient.put("/api/auth/me", {
        full_name: editName,
        email: editEmail,
        phone: editPhone,
      });

      if (res.data?.success) {
        const updatedUser = res.data.data;
        updateUser({
          ...user!,
          name: updatedUser.full_name,
          email: updatedUser.email,
          phone: updatedUser.phone,
        });
        setSuccessMsg("Profile updated successfully!");
        setIsEditing(false);
        setTimeout(() => setSuccessMsg(null), 3000);
      } else {
        setErrorMsg(res.data?.message || "Failed to update profile");
      }
    } catch (err: any) {
      console.error("Profile update failed:", err);
      setErrorMsg(err.response?.data?.detail || err.message || "Failed to update profile");
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Fetch Bookings
        const bookingsRes = await apiClient.get("/api/bookings/my");
        let fetchedBookings: Booking[] = [];
        if (bookingsRes.data?.success && Array.isArray(bookingsRes.data.data)) {
          fetchedBookings = bookingsRes.data.data.map((b: any) => {
            let mappedStatus: "upcoming" | "completed" | "cancelled" = "upcoming";
            if (b.status === "COMPLETED") mappedStatus = "completed";
            else if (b.status === "CANCELLED" || b.status === "REFUNDED") mappedStatus = "cancelled";
            else if (new Date(b.journey_date) < new Date() && b.status === "CONFIRMED") mappedStatus = "completed";
            else if (b.status === "CONFIRMED" || b.status === "INITIATED" || b.status === "SEAT_LOCKED") mappedStatus = "upcoming";

            return {
              id: b.id,
              operator: b.operator_name || "Unknown Operator",
              from: b.boarding_point || "Dhaka",
              to: b.dropping_point || "Destination",
              date: b.journey_date || "N/A",
              departure: b.departure_time || "N/A",
              seats: b.seat_numbers || [],
              total: b.total_fare || 0,
              status: mappedStatus,
              ticketId: b.id.split("-")[0].toUpperCase(),
            };
          });
          setBookings(fetchedBookings);
        }

        // Fetch Payments
        let fetchedPayments: Payment[] = [];
        try {
          const paymentsRes = await apiClient.get("/api/payments/my");
          if (paymentsRes.data?.success && Array.isArray(paymentsRes.data.data)) {
            fetchedPayments = paymentsRes.data.data.map((p: any) => ({
              id: p.id,
              bookingId: p.booking_id,
              amount: p.amount,
              method: p.method,
              status: p.status,
              initiatedAt: p.initiated_at,
              completedAt: p.completed_at,
              gatewayTxnId: p.gateway_transaction_id,
            }));
            setPayments(fetchedPayments);
          }
        } catch (payErr) {
          console.warn("Failed to fetch payments, using mock data mapping from bookings:", payErr);
          // Fallback transaction mapping for user experiences if payment service fails or has no payments yet
          fetchedPayments = fetchedBookings.map((b) => ({
            id: `pay-${b.id.substring(0, 8)}`,
            bookingId: b.id,
            amount: b.total,
            method: "BKASH", // Mock default method
            status: b.status === "cancelled" ? "REFUNDED" : "COMPLETED",
            initiatedAt: b.date,
            completedAt: b.date,
            gatewayTxnId: `TXN${b.id.substring(0, 8).toUpperCase()}`,
          }));
          setPayments(fetchedPayments);
        }

        // Compute stats
        const completedCount = fetchedBookings.filter(b => b.status === "completed").length;
        const upcomingCount = fetchedBookings.filter(b => b.status === "upcoming").length;
        const spent = fetchedPayments
          .filter(p => p.status === "COMPLETED")
          .reduce((sum, p) => sum + Number(p.amount), 0);

        setStats({
          totalTrips: completedCount,
          activeTrips: upcomingCount,
          totalSpent: spent,
        });

      } catch (err) {
        console.error("Error fetching profile details:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-50 pb-12 animate-fade-in" id="user-profile-page">
      {/* Dynamic Header Banner */}
      <div className="relative h-48 bg-gradient-to-r from-brand-700 via-brand-600 to-accent-600 overflow-hidden shadow-inner">
        <div className="absolute inset-0 bg-surface-900/10" />
        <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-white/10 rounded-full blur-2xl animate-pulse-soft" />
        <div className="absolute -top-10 right-20 w-60 h-60 bg-accent-500/20 rounded-full blur-3xl animate-float" />
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 -mt-20 relative z-10">
        {/* User Card */}
        <div className="bg-white rounded-2xl border border-surface-200 shadow-elevation-2 p-6 md:p-8 mb-8">
          {successMsg && (
            <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-sm font-semibold flex items-center gap-2 animate-scale-in">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              {successMsg}
            </div>
          )}
          {errorMsg && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm font-semibold flex items-center gap-2 animate-scale-in">
              <AlertCircle className="h-5 w-5 text-red-600" />
              {errorMsg}
            </div>
          )}

          {!isEditing ? (
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex items-center gap-4 sm:gap-6">
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-gradient-to-br from-brand-500 via-brand-600 to-accent-600 flex items-center justify-center text-white text-3xl font-black shadow-brand-lg select-none shrink-0">
                  {user?.name?.charAt(0).toUpperCase() || "U"}
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-xl sm:text-2xl font-extrabold text-surface-900">
                      {user?.name || "BusGo Traveler"}
                    </h1>
                    <span className="badge badge-info uppercase text-[10px] tracking-wider font-bold">
                      {user?.role || "CUSTOMER"}
                    </span>
                  </div>
                  <p className="text-surface-500 text-sm mt-1 flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5 text-surface-400" /> {user?.email}
                  </p>
                  <p className="text-surface-500 text-sm mt-1 flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5 text-surface-400" /> {user?.phone || "No phone added"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 self-start md:self-center">
                <button
                  onClick={() => setIsEditing(true)}
                  className="btn-secondary !py-2 !px-4 text-xs font-bold cursor-pointer"
                  id="profile-edit-button"
                >
                  Edit Profile
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSaveProfile} className="space-y-4 animate-scale-in">
              <h2 className="text-lg font-bold text-surface-900 mb-2">Edit Profile Information</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-surface-500 uppercase tracking-wider mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="input-premium"
                    placeholder="Enter full name"
                    id="profile-edit-name"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-surface-500 uppercase tracking-wider mb-1">Email Address</label>
                  <input
                    type="email"
                    required
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    className="input-premium"
                    placeholder="Enter email address"
                    id="profile-edit-email"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-surface-500 uppercase tracking-wider mb-1">Phone Number</label>
                  <input
                    type="tel"
                    required
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    className="input-premium"
                    placeholder="Enter phone number"
                    id="profile-edit-phone"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditing(false);
                    setEditName(user?.name || "");
                    setEditEmail(user?.email || "");
                    setEditPhone(user?.phone || "");
                    setErrorMsg(null);
                  }}
                  className="btn-secondary !py-2 !px-5 text-xs font-bold cursor-pointer"
                  disabled={submitting}
                  id="profile-edit-cancel"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary !py-2 !px-5 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  disabled={submitting}
                  id="profile-edit-save"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving...
                    </>
                  ) : (
                    "Save Changes"
                  )}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-xl border border-surface-200 shadow-elevation-1 p-5 flex items-center justify-between group hover:border-brand-500/30 transition-all duration-300">
            <div>
              <p className="text-xs font-semibold text-surface-400 uppercase tracking-wider">Trips Completed</p>
              <h3 className="text-2xl font-black text-surface-900 mt-1">{stats.totalTrips}</h3>
            </div>
            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <CheckCircle2 className="h-6 w-6" />
            </div>
          </div>
          <div className="bg-white rounded-xl border border-surface-200 shadow-elevation-1 p-5 flex items-center justify-between group hover:border-brand-500/30 transition-all duration-300">
            <div>
              <p className="text-xs font-semibold text-surface-400 uppercase tracking-wider">Active Bookings</p>
              <h3 className="text-2xl font-black text-surface-900 mt-1">{stats.activeTrips}</h3>
            </div>
            <div className="w-12 h-12 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
              <Clock className="h-6 w-6" />
            </div>
          </div>
          <div className="bg-white rounded-xl border border-surface-200 shadow-elevation-1 p-5 flex items-center justify-between group hover:border-brand-500/30 transition-all duration-300">
            <div>
              <p className="text-xs font-semibold text-surface-400 uppercase tracking-wider">Total Invested</p>
              <h3 className="text-2xl font-black text-brand-700 mt-1">৳ {stats.totalSpent}</h3>
            </div>
            <div className="w-12 h-12 rounded-xl bg-accent-50 text-accent-600 flex items-center justify-center shrink-0">
              <CreditCard className="h-6 w-6" />
            </div>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="flex gap-2 border-b border-surface-200 mb-6 bg-white p-1 rounded-lg shadow-elevation-1">
          <button
            onClick={() => setActiveTab("travel")}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-md text-sm font-semibold transition-all duration-200 ${
              activeTab === "travel"
                ? "bg-brand-600 text-white shadow-md"
                : "text-surface-500 hover:text-surface-800 hover:bg-surface-50"
            }`}
            id="profile-tab-travel"
          >
            <Ticket className="h-4 w-4" />
            Travel History ({bookings.length})
          </button>
          <button
            onClick={() => setActiveTab("transactions")}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-md text-sm font-semibold transition-all duration-200 ${
              activeTab === "transactions"
                ? "bg-brand-600 text-white shadow-md"
                : "text-surface-500 hover:text-surface-800 hover:bg-surface-50"
            }`}
            id="profile-tab-transactions"
          >
            <CreditCard className="h-4 w-4" />
            Transaction History ({payments.length})
          </button>
        </div>

        {/* Tab Content Panel */}
        <div>
          {/* Travel History Panel */}
          {activeTab === "travel" && (
            <div className="space-y-4">
              {bookings.length > 0 ? (
                <div className="bg-white rounded-xl border border-surface-200 shadow-elevation-1 overflow-hidden">
                  <div className="hidden md:grid grid-cols-12 gap-4 bg-surface-50 border-b border-surface-200 py-3.5 px-6 text-xs font-bold text-surface-500 uppercase tracking-wider">
                    <div className="col-span-3">Trip / Operator</div>
                    <div className="col-span-4">Route Info</div>
                    <div className="col-span-2">Seats</div>
                    <div className="col-span-1.5 text-right font-bold">Total Fare</div>
                    <div className="col-span-1.5 text-right">Action</div>
                  </div>

                  <div className="divide-y divide-surface-200">
                    {bookings.map((booking, idx) => (
                      <div
                        key={booking.id}
                        className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center py-4 px-6 hover:bg-surface-50/50 transition-colors"
                        id={`profile-booking-row-${booking.id}`}
                      >
                        {/* Trip / Operator column */}
                        <div className="col-span-12 md:col-span-3">
                          <h4 className="font-bold text-surface-900 text-sm">{booking.operator}</h4>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`badge ${
                              booking.status === "upcoming" ? "badge-info" : booking.status === "completed" ? "badge-success" : "badge-error"
                            } text-[10px]`}>
                              {booking.status}
                            </span>
                            <span className="text-xs text-surface-400 font-semibold">{booking.ticketId}</span>
                          </div>
                        </div>

                        {/* Route Info */}
                        <div className="col-span-12 md:col-span-4 flex items-center gap-2.5">
                          <div>
                            <p className="text-xs text-surface-500 font-medium">Boarding: <span className="font-bold text-surface-800">{booking.from}</span></p>
                            <p className="text-xs text-surface-500 font-medium mt-0.5">Dropping: <span className="font-bold text-surface-800">{booking.to}</span></p>
                            <p className="text-[10px] text-brand-600 font-bold mt-1 bg-brand-50 px-1.5 py-0.5 rounded inline-block">
                              {formatDate(booking.date)} • {formatTime(booking.departure)}
                            </p>
                          </div>
                        </div>

                        {/* Seats */}
                        <div className="col-span-12 md:col-span-2">
                          <p className="text-sm font-bold text-surface-800">{booking.seats.join(", ")}</p>
                          <p className="text-[10px] text-surface-400 font-medium uppercase">{booking.seats.length} {booking.seats.length === 1 ? "Seat" : "Seats"}</p>
                        </div>

                        {/* Fare */}
                        <div className="col-span-12 md:col-span-1.5 flex md:flex-col justify-between md:justify-end text-right">
                          <span className="md:hidden text-xs text-surface-400 font-semibold uppercase">Total Fare</span>
                          <span className="text-sm font-black text-brand-700">৳ {booking.total}</span>
                        </div>

                        {/* Action */}
                        <div className="col-span-12 md:col-span-1.5 flex justify-end">
                          <button
                            onClick={() => navigate(`/booking/confirmation/${booking.id}`)}
                            className="bg-brand-600 hover:bg-brand-700 text-white font-bold py-1.5 px-3 rounded-lg text-xs flex items-center gap-1 transition-all active:scale-95 shadow-sm hover:shadow cursor-pointer"
                          >
                            Ticket <ChevronRight className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-16 bg-white rounded-xl border border-surface-200">
                  <Ticket className="h-12 w-12 text-surface-300 mx-auto mb-3" />
                  <p className="text-surface-700 font-bold">No travel history found</p>
                  <p className="text-surface-400 text-xs mt-1">Book your next journey and it will show up here.</p>
                  <button onClick={() => navigate("/")} className="btn-primary mt-4 !py-2 !px-4 text-xs">Book a Trip</button>
                </div>
              )}
            </div>
          )}

          {/* Transaction History Panel */}
          {activeTab === "transactions" && (
            <div className="space-y-4">
              {payments.length > 0 ? (
                <div className="bg-white rounded-xl border border-surface-200 shadow-elevation-1 overflow-hidden">
                  <div className="hidden md:grid grid-cols-12 gap-4 bg-surface-50 border-b border-surface-200 py-3.5 px-6 text-xs font-bold text-surface-500 uppercase tracking-wider">
                    <div className="col-span-3">Transaction ID / Ref</div>
                    <div className="col-span-2">Method</div>
                    <div className="col-span-3">Date & Time</div>
                    <div className="col-span-2">Status</div>
                    <div className="col-span-2 text-right">Amount</div>
                  </div>

                  <div className="divide-y divide-surface-200">
                    {payments.map((payment) => {
                      const mStyle = getMethodStyle(payment.method);
                      return (
                        <div
                          key={payment.id}
                          className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center py-4 px-6 hover:bg-surface-50/50 transition-colors"
                          id={`profile-txn-row-${payment.id}`}
                        >
                          {/* Transaction ID / Booking reference */}
                          <div className="col-span-12 md:col-span-3">
                            <p className="text-sm font-bold text-surface-900 font-mono">
                              {payment.gatewayTxnId || "Pending Gateway"}
                            </p>
                            <p className="text-[10px] text-surface-400 font-semibold mt-0.5">
                              Booking Ref: {payment.bookingId.substring(0, 8).toUpperCase()}...
                            </p>
                          </div>

                          {/* Method */}
                          <div className="col-span-12 md:col-span-2">
                            <span className={`px-2.5 py-1 text-[10px] rounded-lg font-extrabold tracking-wider ${mStyle.bg}`}>
                              {mStyle.label}
                            </span>
                          </div>

                          {/* Date & Time */}
                          <div className="col-span-12 md:col-span-3 text-xs text-surface-600">
                            {formatDate(payment.initiatedAt)} • {formatTime(payment.initiatedAt.split("T")[1]?.substring(0, 5) || "N/A")}
                          </div>

                          {/* Status */}
                          <div className="col-span-12 md:col-span-2">
                            <span className={`badge ${PAYMENT_STATUS_STYLES[payment.status]}`}>
                              {payment.status}
                            </span>
                          </div>

                          {/* Amount */}
                          <div className="col-span-12 md:col-span-2 flex md:flex-col justify-between md:justify-end text-right">
                            <span className="md:hidden text-xs text-surface-400 font-semibold uppercase">Paid Amount</span>
                            <span className="text-base font-black text-brand-700">৳ {payment.amount}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="text-center py-16 bg-white rounded-xl border border-surface-200">
                  <CreditCard className="h-12 w-12 text-surface-300 mx-auto mb-3" />
                  <p className="text-surface-700 font-bold">No transactions found</p>
                  <p className="text-surface-400 text-xs mt-1">Your payment invoices will be displayed here.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
