import { useState, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import {
  ArrowRight, CreditCard, Lock, Shield, CheckCircle, Clock, MapPin, Smartphone, Wallet, Landmark,
} from "lucide-react";
import { apiClient } from "../api/client";
import { toast } from "react-hot-toast";

type PaymentMethod = "bkash" | "nagad" | "card" | "banking";

// Which bank account type funds each payment method (mirrors backend mapping).
const METHOD_ACCOUNT_TYPE: Record<PaymentMethod, "MOBILE" | "BANK"> = {
  bkash: "MOBILE",
  nagad: "MOBILE",
  card: "BANK",
  banking: "BANK",
};

// PaymentMethod enum value sent to the backend.
const METHOD_ENUM: Record<PaymentMethod, string> = {
  bkash: "BKASH",
  nagad: "NAGAD",
  card: "CARD",
  banking: "INTERNET_BANKING",
};

interface BankAccount {
  id: string;
  account_type: "MOBILE" | "BANK";
  provider: string;
  account_number: string;
  balance: number;
  currency: string;
}

const METHODS: { id: PaymentMethod; label: string; desc: string; color: string; logo: string }[] = [
  { id: "bkash", label: "bKash", desc: "Pay with bKash mobile wallet", color: "from-pink-500 to-pink-600", logo: "b" },
  { id: "nagad", label: "Nagad", desc: "Pay with Nagad mobile wallet", color: "from-orange-500 to-orange-600", logo: "N" },
  { id: "card", label: "Credit / Debit Card", desc: "Visa, Mastercard, AMEX", color: "from-blue-500 to-indigo-600", logo: "💳" },
  { id: "banking", label: "Internet Banking", desc: "Pay via your bank account", color: "from-emerald-500 to-teal-600", logo: "🏦" },
];

export function Payment() {
  const { booking_id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state || {};
  const [method, setMethod] = useState<PaymentMethod>("bkash");
  const [loading, setLoading] = useState(false);
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");
  const [cardName, setCardName] = useState("");
  const [timeLeft, setTimeLeft] = useState(600); // 10 minutes in seconds
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [tripId, setTripId] = useState<string | null>(state.trip_id || null);
  const [total, setTotal] = useState<number>(state.totalFare || 0);
  const [returnBookingData, setReturnBookingData] = useState<any>(null);

  const returnBookingId = state.return_booking_id;
  const outboundTotalVal = Number(state.outboundTotal || total);
  const returnTotalVal = Number(state.returnTotal || (returnBookingData?.total_fare || 0));
  const combinedTotal = state.isRoundTrip ? (outboundTotalVal + returnTotalVal) : total;

  // Account that funds the currently selected method.
  const activeAccount = accounts.find((a) => a.account_type === METHOD_ACCOUNT_TYPE[method]);
  const insufficient = !!activeAccount && Number(activeAccount.balance) < combinedTotal;

  // Fetch the user's bank/mobile accounts and balances.
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await apiClient.get("/api/bank/accounts/my");
        if (mounted && res.data.success) {
          setAccounts(res.data.data.map((a: any) => ({ ...a, balance: Number(a.balance) })));
        }
      } catch (err) {
        console.error("Failed to load bank accounts", err);
      } finally {
        if (mounted) setAccountsLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  // Ensure we have trip_id + accurate total from the booking record.
  useEffect(() => {
    if (!booking_id) return;
    (async () => {
      try {
        const res = await apiClient.get(`/api/bookings/${booking_id}`);
        if (res.data.success) {
          const b = res.data.data;
          if (b.trip_id) setTripId(b.trip_id);
          if (!state.isRoundTrip && b.total_fare) setTotal(Number(b.total_fare));
        }
      } catch (err) {
        console.error("Failed to load booking", err);
      }
    })();
  }, [booking_id]);

  useEffect(() => {
    const returnId = state.return_booking_id;
    if (!returnId) return;
    (async () => {
      try {
        const res = await apiClient.get(`/api/bookings/${returnId}`);
        if (res.data.success) {
          setReturnBookingData(res.data.data);
        }
      } catch (err) {
        console.error("Failed to load return booking", err);
      }
    })();
  }, [state.return_booking_id]);

  // Timer countdown
  useEffect(() => {
    if (timeLeft <= 0) {
      toast.error("Booking expired! Seats have been released.");
      navigate("/");
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, navigate]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!booking_id) {
      toast.error("Booking ID is missing");
      return;
    }
    
    // Validate payment method specific fields
    if ((method === "bkash" || method === "nagad") && (!phone || !pin)) {
      toast.error("Please enter your phone number and PIN");
      return;
    }
    
    if (method === "card" && (!cardNumber || !expiry || !cvv || !cardName)) {
      toast.error("Please fill in all card details");
      return;
    }
    
    if (!tripId) {
      toast.error("Could not load booking details. Please refresh and try again.");
      return;
    }

    // Pre-flight balance check for a friendly message before hitting the server.
    if (insufficient) {
      toast.error(`Insufficient balance in your ${activeAccount?.provider} account.`);
      return;
    }

    setLoading(true);
    try {
      if (state.isRoundTrip && returnBookingId) {
        // Sequential Payment
        
        // 1) Outbound Payment Initiate
        const initResOutbound = await apiClient.post("/api/payments/initiate", {
          booking_id,
          trip_id: tripId,
          amount: outboundTotalVal,
          method: METHOD_ENUM[method],
        });

        if (!initResOutbound.data.success) {
          toast.error(initResOutbound.data.message || "Outbound payment was declined.");
          setLoading(false);
          return;
        }

        const paymentIdOutbound = initResOutbound.data.data.payment_id;

        // 2) Outbound Booking Confirm
        const confirmResOutbound = await apiClient.post(`/api/bookings/${booking_id}/confirm-payment`, null, {
          params: { payment_id: paymentIdOutbound },
        });

        if (!confirmResOutbound.data.success) {
          toast.error(confirmResOutbound.data.message || "Outbound payment confirmation failed.");
          setLoading(false);
          return;
        }

        // 3) Return Payment Initiate
        const returnTripId = returnBookingData?.trip_id || state.returnTrip?.trip_id || state.returnTrip?.id;
        const initResReturn = await apiClient.post("/api/payments/initiate", {
          booking_id: returnBookingId,
          trip_id: returnTripId,
          amount: returnTotalVal,
          method: METHOD_ENUM[method],
        });

        if (!initResReturn.data.success) {
          toast.error(initResReturn.data.message || "Return payment was declined.");
          setLoading(false);
          return;
        }

        const paymentIdReturn = initResReturn.data.data.payment_id;

        // 4) Return Booking Confirm
        const confirmResReturn = await apiClient.post(`/api/bookings/${returnBookingId}/confirm-payment`, null, {
          params: { payment_id: paymentIdReturn },
        });

        if (confirmResReturn.data.success) {
          toast.success("Payment successful! Both journeys are now confirmed.");
          navigate(`/booking/confirmation/${booking_id}`, {
            state: {
              return_booking_id: returnBookingId,
              isRoundTrip: true
            }
          });
        } else {
          toast.error(confirmResReturn.data.message || "Return payment confirmation failed. Please contact support.");
        }
      } else {
        // One way payment
        const initRes = await apiClient.post("/api/payments/initiate", {
          booking_id,
          trip_id: tripId,
          amount: total,
          method: METHOD_ENUM[method],
        });

        if (!initRes.data.success) {
          toast.error(initRes.data.message || "Payment was declined.");
          setLoading(false);
          return;
        }

        const payment_id = initRes.data.data.payment_id;

        const response = await apiClient.post(`/api/bookings/${booking_id}/confirm-payment`, null, {
          params: { payment_id },
        });

        if (response.data.success) {
          toast.success("Payment successful! Your seats are now confirmed.");
          navigate(`/booking/confirmation/${booking_id}`);
        } else {
          toast.error(response.data.message || "Payment confirmation failed. Please contact support.");
        }
      }
    } catch (err: any) {
      console.error("Payment error:", err);
      const status = err.response?.status;
      const detail = err.response?.data?.detail;

      let errMsg = "Payment processing failed. Please try again.";

      if (status === 402) {
        errMsg = typeof detail === "string" ? detail : "Insufficient balance to complete this payment.";
        apiClient.get("/api/bank/accounts/my").then((r) => {
          if (r.data.success) setAccounts(r.data.data.map((a: any) => ({ ...a, balance: Number(a.balance) })));
        }).catch(() => {});
      } else if (status === 400) {
        errMsg = typeof detail === "string" ? detail : "Invalid payment request. Please try again.";
      } else if (status === 403) {
        errMsg = "Too many payment attempts. Please contact support.";
      } else if (status && status >= 500) {
        errMsg = typeof detail === "string" && detail.length < 125 && !detail.includes("sqlalchemy") && !detail.includes("asyncpg")
          ? detail
          : "Something went wrong on our end. Please try again in a moment.";
      }

      toast.error(errMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface-50" id="payment-page">
      {/* Header */}
      <div className="bg-white border-b border-surface-200 shadow-elevation-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-2 text-sm">
            {["Seats", "Passengers", "Payment", "Confirmation"].map((s, i) => (
              <div key={s} className="flex items-center gap-2">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                  i < 2 ? "bg-emerald-500 text-white" : i === 2 ? "bg-brand-600 text-white shadow-brand" : "bg-surface-200 text-surface-400"
                }`}>
                  {i < 2 ? "✓" : i + 1}
                </div>
                <span className={`hidden sm:inline text-xs font-medium ${i <= 2 ? "text-surface-900" : "text-surface-400"}`}>{s}</span>
                {i < 3 && <div className={`w-8 h-px ${i < 2 ? "bg-emerald-500" : "bg-surface-200"}`} />}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Payment Methods */}
          <div className="flex-1 space-y-6">
            {/* Timer Warning */}
            <div className={`flex items-center gap-3 p-4 rounded-xl border-2 ${
              timeLeft < 120 
                ? "bg-red-50 border-red-300" 
                : timeLeft < 300 
                  ? "bg-amber-50 border-amber-300" 
                  : "bg-blue-50 border-blue-300"
            }`}>
              <Clock className={`h-5 w-5 ${
                timeLeft < 120 
                  ? "text-red-600" 
                  : timeLeft < 300 
                    ? "text-amber-600" 
                    : "text-blue-600"
              }`} />
              <div className="flex-1">
                <p className={`font-bold ${
                  timeLeft < 120 
                    ? "text-red-900" 
                    : timeLeft < 300 
                      ? "text-amber-900" 
                      : "text-blue-900"
                }`}>
                  Complete payment in {formatTime(timeLeft)}
                </p>
                <p className={`text-sm ${
                  timeLeft < 120 
                    ? "text-red-700" 
                    : timeLeft < 300 
                      ? "text-amber-700" 
                      : "text-blue-700"
                }`}>
                  {timeLeft < 120 
                    ? "Hurry! Your booking will expire soon." 
                    : "Your seats are temporarily held for you."}
                </p>
              </div>
            </div>

            {/* Account Balances */}
            <div className="card-premium p-6">
              <h2 className="text-lg font-bold text-surface-900 mb-1">Your Accounts</h2>
              <p className="text-sm text-surface-500 mb-4">Your balance is checked before payment is processed.</p>
              {accountsLoading ? (
                <div className="flex justify-center py-6">
                  <div className="w-7 h-7 border-2 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
                </div>
              ) : accounts.length === 0 ? (
                <p className="text-sm text-surface-500">No linked accounts found.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {accounts.map((a) => {
                    const isActive = a.account_type === METHOD_ACCOUNT_TYPE[method];
                    const low = isActive && Number(a.balance) < total;
                    return (
                      <div
                        key={a.id}
                        className={`p-4 rounded-xl border-2 transition-all ${
                          isActive
                            ? low
                              ? "border-red-300 bg-red-50"
                              : "border-brand-400 bg-brand-50"
                            : "border-surface-200 bg-white"
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-8 h-8 rounded-lg bg-white border border-surface-200 flex items-center justify-center">
                            {a.account_type === "MOBILE" ? (
                              <Wallet className="h-4 w-4 text-pink-500" />
                            ) : (
                              <Landmark className="h-4 w-4 text-emerald-600" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-surface-900 truncate">{a.provider}</p>
                            <p className="text-xs text-surface-500 truncate">{a.account_number}</p>
                          </div>
                        </div>
                        <p className={`text-lg font-extrabold ${low ? "text-red-600" : "text-surface-900"}`}>
                          ৳ {Number(a.balance).toLocaleString()}
                        </p>
                        {isActive && (
                          <p className={`text-xs font-medium mt-0.5 ${low ? "text-red-600" : "text-brand-600"}`}>
                            {low ? "Insufficient for this payment" : "Selected for this payment"}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="card-premium p-6">
              <h2 className="text-lg font-bold text-surface-900 mb-1">Payment Method</h2>
              <p className="text-sm text-surface-500 mb-6">Choose your preferred payment method</p>

              {/* Method Selection */}
              <div className="grid grid-cols-2 gap-3 mb-8">
                {METHODS.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMethod(m.id)}
                    className={`p-4 rounded-xl border-2 text-left transition-all duration-300 ${
                      method === m.id
                        ? "border-brand-500 bg-brand-50 shadow-brand/10 shadow-md"
                        : "border-surface-200 hover:border-surface-300 bg-white hover:bg-surface-50"
                    }`}
                    id={`method-${m.id}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${m.color} flex items-center justify-center text-white font-bold text-lg shadow-sm`}>
                        {m.logo}
                      </div>
                      <div>
                        <p className="font-bold text-surface-900 text-sm">{m.label}</p>
                        <p className="text-xs text-surface-500 hidden sm:block">{m.desc}</p>
                      </div>
                    </div>
                    {method === m.id && (
                      <div className="mt-2 flex justify-end">
                        <CheckCircle className="h-5 w-5 text-brand-500" />
                      </div>
                    )}
                  </button>
                ))}
              </div>

              {/* Payment Form */}
              <form onSubmit={handlePay} className="space-y-5">
                {(method === "bkash" || method === "nagad") && (
                  <div className="space-y-4 animate-fade-in">
                    <div>
                      <label className="block text-sm font-semibold text-surface-700 mb-1.5">
                        {method === "bkash" ? "bKash" : "Nagad"} Number
                      </label>
                      <div className="relative">
                        <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-surface-400" />
                        <input
                          type="tel"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder="01XXX XXXXXX"
                          className="input-premium !pl-10"
                          required
                          id="mfs-phone"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-surface-700 mb-1.5">PIN</label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-surface-400" />
                        <input
                          type="password"
                          value={pin}
                          onChange={(e) => setPin(e.target.value)}
                          placeholder="Enter your PIN"
                          maxLength={5}
                          className="input-premium !pl-10"
                          required
                          id="mfs-pin"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {method === "card" && (
                  <div className="space-y-4 animate-fade-in">
                    <div>
                      <label className="block text-sm font-semibold text-surface-700 mb-1.5">Cardholder Name</label>
                      <input type="text" value={cardName} onChange={(e) => setCardName(e.target.value)} placeholder="Name on card" className="input-premium" required id="card-name" />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-surface-700 mb-1.5">Card Number</label>
                      <div className="relative">
                        <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-surface-400" />
                        <input type="text" value={cardNumber} onChange={(e) => setCardNumber(e.target.value)} placeholder="1234 5678 9012 3456" maxLength={19} className="input-premium !pl-10" required id="card-number" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-surface-700 mb-1.5">Expiry</label>
                        <input type="text" value={expiry} onChange={(e) => setExpiry(e.target.value)} placeholder="MM/YY" maxLength={5} className="input-premium" required id="card-expiry" />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-surface-700 mb-1.5">CVV</label>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-surface-400" />
                          <input type="password" value={cvv} onChange={(e) => setCvv(e.target.value)} placeholder="•••" maxLength={4} className="input-premium !pl-10" required id="card-cvv" />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {method === "banking" && (
                  <div className="animate-fade-in p-6 bg-surface-50 rounded-xl text-center">
                    <p className="text-surface-600 text-sm">You will be redirected to your bank's secure portal to complete the payment.</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || insufficient}
                  className="btn-primary w-full flex items-center justify-center gap-2 !py-3.5 text-base disabled:opacity-60 disabled:cursor-not-allowed"
                  id="pay-now"
                >
                  {loading ? (
                    <div className="flex items-center gap-3">
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Processing...
                    </div>
                  ) : insufficient ? (
                    <>Insufficient Balance</>
                  ) : (
                    <>
                      <Lock className="h-4 w-4" />
                      Pay ৳ {combinedTotal.toLocaleString()}
                    </>
                  )}
                </button>

                {/* Trust indicators */}
                <div className="flex items-center justify-center gap-4 pt-2">
                  <span className="flex items-center gap-1 text-xs text-surface-400">
                    <Shield className="h-3.5 w-3.5" /> SSL Encrypted
                  </span>
                  <span className="flex items-center gap-1 text-xs text-surface-400">
                    <Lock className="h-3.5 w-3.5" /> PCI Compliant
                  </span>
                </div>
              </form>
            </div>
          </div>

          {/* Order Summary */}
          <div className="lg:w-80">
            <div className="lg:sticky lg:top-24">
              <div className="card-premium p-6">
                <h3 className="font-bold text-surface-900 mb-4">Order Summary</h3>

                {state.isRoundTrip && state.outboundTrip ? (
                  <div className="space-y-4">
                    {/* Outbound Leg */}
                    <div className="border-b border-surface-100 pb-3">
                      <span className="text-[10px] font-bold text-brand-600 uppercase tracking-wider block mb-1">Outbound Journey</span>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-surface-100 flex items-center justify-center flex-shrink-0"><MapPin className="h-3.5 w-3.5 text-surface-500" /></div>
                          <div>
                            <p className="font-semibold text-surface-900">{state.originalOrigin || "Dhaka"} → {state.originalDestination || "Chittagong"}</p>
                            <p className="text-xs text-surface-500">{state.outboundTrip.operator_name || state.outboundTrip.operator}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-surface-100 flex items-center justify-center flex-shrink-0"><Clock className="h-3.5 w-3.5 text-surface-500" /></div>
                          <div>
                            <p className="font-semibold text-surface-900">{state.outboundTrip.departure_time || (state.outboundTrip.departure_datetime ? new Date(state.outboundTrip.departure_datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }) : "08:00 AM")}</p>
                            <p className="text-xs text-surface-500">{state.outboundDate}</p>
                          </div>
                        </div>
                        <div className="flex justify-between text-xs mt-1.5 pt-1.5 border-t border-dashed border-surface-100">
                          <span className="text-surface-500">Seats ({state.outboundSeats?.length}):</span>
                          <span className="font-mono font-bold text-surface-900">{state.outboundSeats?.join(", ")}</span>
                        </div>
                      </div>
                    </div>

                    {/* Return Leg */}
                    <div className="pb-2">
                      <span className="text-[10px] font-bold text-brand-600 uppercase tracking-wider block mb-1">Return Journey</span>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-surface-100 flex items-center justify-center flex-shrink-0"><MapPin className="h-3.5 w-3.5 text-surface-500" /></div>
                          <div>
                            <p className="font-semibold text-surface-900">{state.returnTrip?.origin_city || "Chittagong"} → {state.returnTrip?.destination_city || "Dhaka"}</p>
                            <p className="text-xs text-surface-500">{state.returnTrip?.operator_name || state.returnTrip?.operator || "Greenline Paribahan"}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-surface-100 flex items-center justify-center flex-shrink-0"><Clock className="h-3.5 w-3.5 text-surface-500" /></div>
                          <div>
                            <p className="font-semibold text-surface-900">{state.returnTrip?.departure_time || "08:00 AM"}</p>
                            <p className="text-xs text-surface-500">{state.returnDate}</p>
                          </div>
                        </div>
                        <div className="flex justify-between text-xs mt-1.5 pt-1.5 border-t border-dashed border-surface-100">
                          <span className="text-surface-500">Seats ({state.returnSeats?.length}):</span>
                          <span className="font-mono font-bold text-surface-900">{state.returnSeats?.join(", ")}</span>
                        </div>
                      </div>
                    </div>

                    {/* Price Breakdown */}
                    <div className="border-t border-surface-200 pt-3.5 space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-surface-500">Outbound Total</span>
                        <span className="font-medium text-surface-900">৳ {state.outboundTotal}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-surface-500">Return Total</span>
                        <span className="font-medium text-surface-900">৳ {state.returnTotal || returnBookingData?.total_fare}</span>
                      </div>
                      <div className="flex justify-between pt-3 border-t border-surface-200 text-base">
                        <span className="font-bold text-surface-900">Total</span>
                        <span className="font-extrabold text-brand-600 text-lg">৳ {combinedTotal.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="space-y-3 text-sm mb-4">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-surface-100 flex items-center justify-center"><MapPin className="h-4 w-4 text-surface-500" /></div>
                        <div>
                          <p className="font-semibold text-surface-900">Dhaka → Chittagong</p>
                          <p className="text-xs text-surface-500">Greenline Paribahan</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-surface-100 flex items-center justify-center"><Clock className="h-4 w-4 text-surface-500" /></div>
                        <div>
                          <p className="font-semibold text-surface-900">08:00 AM — 1:30 PM</p>
                          <p className="text-xs text-surface-500">May 1, 2026</p>
                        </div>
                      </div>
                    </div>

                    <div className="border-t border-surface-200 pt-4 space-y-2 text-sm">
                      <div className="flex justify-between"><span className="text-surface-500">Seats</span><span className="font-medium">৳ {(total - 20) || 0}</span></div>
                      <div className="flex justify-between"><span className="text-surface-500">Service fee</span><span className="font-medium">৳ 20</span></div>
                      <div className="flex justify-between pt-3 border-t border-surface-200 text-base">
                        <span className="font-bold text-surface-900">Total</span>
                        <span className="font-extrabold text-brand-600">৳ {total.toLocaleString()}</span>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
