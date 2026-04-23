import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  CheckCircle, Download, Share2, Printer, MapPin, Clock,
  Calendar, User, Bus, ArrowRight, Home, QrCode,
} from "lucide-react";

/* ─── Confetti Particle ────────────────────────────── */
function Confetti() {
  const [particles] = useState(() =>
    Array.from({ length: 40 }).map((_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 2,
      duration: 2 + Math.random() * 3,
      color: ["#DC2626", "#F59E0B", "#10B981", "#3B82F6", "#8B5CF6", "#EC4899"][
        Math.floor(Math.random() * 6)
      ],
      size: 4 + Math.random() * 8,
    }))
  );

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute rounded-sm"
          style={{
            left: `${p.left}%`,
            top: "-20px",
            width: `${p.size}px`,
            height: `${p.size}px`,
            backgroundColor: p.color,
            animation: `confetti-fall ${p.duration}s ease-in ${p.delay}s forwards`,
          }}
        />
      ))}
    </div>
  );
}

export function Confirmation() {
  const navigate = useNavigate();
  const [showConfetti, setShowConfetti] = useState(true);
  const [checkVisible, setCheckVisible] = useState(false);

  useEffect(() => {
    setTimeout(() => setCheckVisible(true), 300);
    const timer = setTimeout(() => setShowConfetti(false), 5000);
    return () => clearTimeout(timer);
  }, []);

  const ticketData = {
    ticketId: "BG-20260501-A3A4",
    operator: "Greenline Paribahan",
    from: "Dhaka (Kalyanpur)",
    to: "Chittagong (Dampara)",
    date: "May 1, 2026",
    departure: "08:00 AM",
    arrival: "1:30 PM",
    seats: ["A3", "A4"],
    passengers: ["Tauseef Rahman", "Kamal Hossain"],
    totalPaid: "৳ 1,720",
    status: "CONFIRMED",
    busType: "AC",
  };

  return (
    <div className="min-h-screen bg-surface-50" id="confirmation-page">
      {showConfetti && <Confetti />}

      {/* Header */}
      <div className="bg-white border-b border-surface-200 shadow-elevation-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-2 text-sm">
            {["Seats", "Passengers", "Payment", "Confirmation"].map((s, i) => (
              <div key={s} className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold bg-emerald-500 text-white">✓</div>
                <span className="hidden sm:inline text-xs font-medium text-surface-900">{s}</span>
                {i < 3 && <div className="w-8 h-px bg-emerald-500" />}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {/* Success Animation */}
        <div className={`text-center mb-10 transition-all duration-700 ${checkVisible ? "opacity-100 scale-100" : "opacity-0 scale-75"}`}>
          <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-5 animate-bounce-soft">
            <CheckCircle className="h-12 w-12 text-emerald-500" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-surface-900 mb-2">
            Booking Confirmed! 🎉
          </h1>
          <p className="text-surface-500 text-lg">
            Your e-ticket has been sent to your email and phone.
          </p>
        </div>

        {/* E-Ticket Card */}
        <div className="card-premium overflow-hidden mb-6 animate-fade-in-up animate-delay-300" id="e-ticket">
          {/* Ticket Header */}
          <div className="hero-gradient px-6 py-5 text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bus className="h-5 w-5" />
                <span className="font-bold text-lg">{ticketData.operator}</span>
              </div>
              <span className="badge bg-white/20 text-white border border-white/30 text-xs">
                {ticketData.status}
              </span>
            </div>
          </div>

          {/* Ticket Body */}
          <div className="p-6">
            {/* Route */}
            <div className="flex items-center justify-between mb-6">
              <div className="text-center">
                <p className="text-2xl font-extrabold text-surface-900">08:00</p>
                <p className="text-sm text-surface-500 mt-1">{ticketData.from}</p>
              </div>
              <div className="flex-1 flex flex-col items-center px-4">
                <span className="text-xs text-surface-400 mb-1.5">5h 30m</span>
                <div className="w-full flex items-center">
                  <div className="w-3 h-3 rounded-full border-2 border-brand-500 bg-white" />
                  <div className="flex-1 h-px bg-surface-300 mx-1 relative">
                    <div className="absolute inset-0 bg-gradient-to-r from-brand-500 to-brand-300 h-px" />
                    <Bus className="absolute left-1/2 -translate-x-1/2 -top-2.5 h-5 w-5 text-brand-500" />
                  </div>
                  <div className="w-3 h-3 rounded-full bg-brand-500" />
                </div>
                <span className="text-xs text-surface-400 mt-1.5">{ticketData.busType}</span>
              </div>
              <div className="text-center">
                <p className="text-2xl font-extrabold text-surface-900">13:30</p>
                <p className="text-sm text-surface-500 mt-1">{ticketData.to}</p>
              </div>
            </div>

            {/* Dashed divider */}
            <div className="border-t-2 border-dashed border-surface-200 my-5 relative">
              <div className="absolute -left-9 -top-3 w-6 h-6 rounded-full bg-surface-50" />
              <div className="absolute -right-9 -top-3 w-6 h-6 rounded-full bg-surface-50" />
            </div>

            {/* Details Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-surface-400 text-xs uppercase tracking-wide font-medium">Ticket ID</p>
                <p className="font-bold text-surface-900 mt-1">{ticketData.ticketId}</p>
              </div>
              <div>
                <p className="text-surface-400 text-xs uppercase tracking-wide font-medium">Date</p>
                <p className="font-bold text-surface-900 mt-1 flex items-center gap-1"><Calendar className="h-3.5 w-3.5 text-surface-500" /> {ticketData.date}</p>
              </div>
              <div>
                <p className="text-surface-400 text-xs uppercase tracking-wide font-medium">Seats</p>
                <p className="font-bold text-surface-900 mt-1">{ticketData.seats.join(", ")}</p>
              </div>
              <div>
                <p className="text-surface-400 text-xs uppercase tracking-wide font-medium">Total Paid</p>
                <p className="font-extrabold text-brand-600 mt-1">{ticketData.totalPaid}</p>
              </div>
            </div>

            {/* Passengers */}
            <div className="mt-6 pt-4 border-t border-surface-100">
              <p className="text-surface-400 text-xs uppercase tracking-wide font-medium mb-2">Passengers</p>
              <div className="space-y-2">
                {ticketData.passengers.map((name, i) => (
                  <div key={i} className="flex items-center gap-2 p-2 bg-surface-50 rounded-lg">
                    <User className="h-4 w-4 text-surface-400" />
                    <span className="text-sm font-medium text-surface-900">{name}</span>
                    <span className="badge badge-info text-[10px] ml-auto">Seat {ticketData.seats[i]}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* QR Code placeholder */}
            <div className="mt-6 flex items-center justify-center">
              <div className="w-32 h-32 bg-surface-100 rounded-xl flex flex-col items-center justify-center border-2 border-dashed border-surface-300">
                <QrCode className="h-12 w-12 text-surface-400 mb-1" />
                <span className="text-[10px] text-surface-400 font-medium">QR Code</span>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          <button className="card-premium p-4 flex flex-col items-center gap-2 text-center hover:!border-brand-200" id="download-ticket">
            <Download className="h-5 w-5 text-brand-600" />
            <span className="text-xs font-semibold text-surface-700">Download</span>
          </button>
          <button className="card-premium p-4 flex flex-col items-center gap-2 text-center hover:!border-brand-200" id="share-ticket">
            <Share2 className="h-5 w-5 text-brand-600" />
            <span className="text-xs font-semibold text-surface-700">Share</span>
          </button>
          <button className="card-premium p-4 flex flex-col items-center gap-2 text-center hover:!border-brand-200" id="print-ticket">
            <Printer className="h-5 w-5 text-brand-600" />
            <span className="text-xs font-semibold text-surface-700">Print</span>
          </button>
        </div>

        {/* Back to Home */}
        <button
          onClick={() => navigate("/")}
          className="btn-primary w-full flex items-center justify-center gap-2 !py-3"
          id="back-to-home"
        >
          <Home className="h-4 w-4" />
          Back to Home
        </button>
      </div>
    </div>
  );
}
