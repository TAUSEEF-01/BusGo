import { useState, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import {
  ArrowRight, CreditCard, Phone, Lock, Shield, CheckCircle, Clock, MapPin, Smartphone,
} from "lucide-react";
import { apiClient } from "../api/client";
import { toast } from "react-hot-toast";

type PaymentMethod = "bkash" | "nagad" | "card" | "banking";

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

  const total = state.totalFare || 1720;

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
    
    setLoading(true);
    try {
      // Simulate payment processing delay (in real app, this would call payment gateway)
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Mock payment validation - in production, this would verify with payment gateway
      const paymentSuccessful = true; // Simulate successful payment
      
      if (!paymentSuccessful) {
        toast.error("Payment was declined. Please try again or use a different payment method.");
        setLoading(false);
        return;
      }
      
      // Generate payment transaction ID
      const payment_id = crypto.randomUUID();
      
      // Confirm payment with booking service
      const response = await apiClient.post(`/api/bookings/${booking_id}/confirm-payment`, null, {
        params: { payment_id }
      });
      
      if (response.data.success) {
        toast.success("Payment successful! Your seats are now confirmed.");
        // Navigate to confirmation page
        navigate(`/booking/confirmation/${booking_id}`);
      } else {
        toast.error(response.data.message || "Payment confirmation failed. Please contact support.");
      }
    } catch (err: any) {
      console.error("Payment error:", err);
      let errMsg = "Payment processing failed. Your seats have not been booked.";
      const detail = err.response?.data?.detail;
      if (typeof detail === "string") {
        errMsg = detail;
      } else if (Array.isArray(detail)) {
        errMsg = detail.map((d: any) => d.msg).join(", ");
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
                  disabled={loading}
                  className="btn-primary w-full flex items-center justify-center gap-2 !py-3.5 text-base disabled:opacity-60"
                  id="pay-now"
                >
                  {loading ? (
                    <div className="flex items-center gap-3">
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Processing...
                    </div>
                  ) : (
                    <>
                      <Lock className="h-4 w-4" />
                      Pay ৳ {total.toLocaleString()}
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
                  <div className="flex justify-between"><span className="text-surface-500">Seats (A3, A4)</span><span className="font-medium">৳ 1,700</span></div>
                  <div className="flex justify-between"><span className="text-surface-500">Service fee</span><span className="font-medium">৳ 20</span></div>
                  <div className="flex justify-between pt-3 border-t border-surface-200 text-base">
                    <span className="font-bold text-surface-900">Total</span>
                    <span className="font-extrabold text-brand-600">৳ {total.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
