import { useState, useEffect } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import {
  CheckCircle, Download, Share2, Printer, Calendar, User, Bus, Home, Clock, X, Loader2
} from "lucide-react";
import QRCode from "react-qr-code";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { apiClient } from "../api/client";

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
  const { booking_id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state || {};

  const [showConfetti, setShowConfetti] = useState(false);
  const [checkVisible, setCheckVisible] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Save return_booking_id to sessionStorage as a fallback if present in state
  useEffect(() => {
    if (booking_id && state.return_booking_id) {
      sessionStorage.setItem(`return_booking_id_${booking_id}`, state.return_booking_id);
    }
  }, [booking_id, state.return_booking_id]);

  useEffect(() => {
    const fetchBookings = async () => {
      if (!booking_id) return;
      
      setLoading(true);
      setError(null);
      
      try {
        const resolvedReturnId = state.return_booking_id || sessionStorage.getItem(`return_booking_id_${booking_id}`);
        const fetchIds = [booking_id];
        if (resolvedReturnId) {
          fetchIds.push(resolvedReturnId);
        }
        
        const fetchedTickets = [];
        let isConfirmed = false;
        
        for (const id of fetchIds) {
          const response = await apiClient.get(`/api/bookings/${id}`);
          if (response.data.success) {
            const b = response.data.data;
            const seats = b.seat_numbers || [];
            
            // Format journey date: e.g. "2026-05-01" -> "May 1, 2026"
            let formattedDate = b.journey_date;
            try {
              const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };
              formattedDate = new Date(b.journey_date).toLocaleDateString('en-US', options);
            } catch (e) {}

            // Format departure time: e.g. "08:00:00" -> "08:00 AM"
            let formattedDep = b.departure_time;
            try {
              const [h, m] = b.departure_time.split(':');
              const hours = parseInt(h, 10);
              const modifier = hours >= 12 ? 'PM' : 'AM';
              const displayHours = hours % 12 || 12;
              formattedDep = `${displayHours.toString().padStart(2, '0')}:${m} ${modifier}`;
            } catch (e) {}

            // Format arrival time: departure + 5h 30m
            let formattedArr = "01:30 PM";
            try {
              const [h, m] = b.departure_time.split(':');
              let hours = parseInt(h, 10) + 5;
              let minutes = parseInt(m, 10) + 30;
              if (minutes >= 60) {
                hours += 1;
                minutes -= 60;
              }
              const modifier = hours >= 12 ? 'PM' : 'AM';
              const displayHours = hours % 12 || 12;
              formattedArr = `${displayHours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')} ${modifier}`;
            } catch (e) {}
            
            fetchedTickets.push({
              ticketId: b.id.split('-')[0].toUpperCase() + "-" + seats.join(''),
              rawId: b.id,
              operator: b.operator_name || "Greenline Paribahan",
              from: b.boarding_point,
              to: b.dropping_point,
              date: formattedDate,
              departure: formattedDep,
              arrival: formattedArr,
              seats: seats,
              passengers: Array(seats.length).fill("Passenger"),
              totalPaid: `৳ ${b.total_fare}`,
              status: b.status,
              busType: "AC",
            });
            
            if (b.status === "CONFIRMED") {
              isConfirmed = true;
            }
          } else {
            throw new Error(response.data.message || "Failed to load booking details");
          }
        }
        
        setTickets(fetchedTickets);
        
        if (isConfirmed) {
          setShowConfetti(true);
          const timer = setTimeout(() => setShowConfetti(false), 5000);
          return () => clearTimeout(timer);
        }
      } catch (err: any) {
        setError(err.message || err.response?.data?.detail || "Failed to load booking details");
      } finally {
        setLoading(false);
      }
    };
    
    fetchBookings();
    setTimeout(() => setCheckVisible(true), 300);
  }, [booking_id, state.return_booking_id]);

  const handleDownload = async () => {
    const ticketElement = document.getElementById("e-ticket");
    if (!ticketElement) return;
    
    setIsDownloading(true);
    try {
      const canvas = await html2canvas(ticketElement, { scale: 2, useCORS: true });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4"
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
      
      const fileId = tickets.map(t => t.ticketId).join('_');
      pdf.save(`ticket-${fileId || 'download'}.pdf`);
    } catch (err) {
      console.error("Failed to download PDF", err);
    } finally {
      setIsDownloading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
      </div>
    );
  }

  if (error || tickets.length === 0) {
    return (
      <div className="min-h-screen bg-surface-50 flex flex-col items-center justify-center">
        <div className="text-red-500 mb-4">{error || "Ticket not found"}</div>
        <button onClick={() => navigate("/")} className="btn-primary">Return Home</button>
      </div>
    );
  }

  const isCancelled = tickets.some((t) => t.status === "CANCELLED" || t.status === "REFUNDED");
  const isExpired = !isCancelled && tickets.some((t) => t.status === "EXPIRED");
  const hasMultiple = tickets.length > 1;

  return (
    <div className="min-h-screen bg-surface-50" id="confirmation-page">
      {showConfetti && <Confetti />}

      {/* Localized print media styles */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #e-ticket, #e-ticket * {
            visibility: visible;
          }
          #e-ticket {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 0;
            box-shadow: none !important;
            border: none !important;
          }
          .card-premium {
            box-shadow: none !important;
            border: 1px solid #e2e8f0 !important;
            margin-bottom: 24px !important;
            page-break-inside: avoid;
          }
        }
      `}</style>

      {/* Header */}
      <div className="bg-white border-b border-surface-200 shadow-elevation-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-2 text-sm">
            {["Seats", "Passengers", "Payment", "Confirmation"].map((s, i) => (
              <div key={s} className="flex items-center gap-2">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white ${
                  i < 3 || (!isCancelled && !isExpired) ? "bg-emerald-500" : isCancelled ? "bg-red-500" : "bg-surface-400"
                }`}>
                  {i < 3 || (!isCancelled && !isExpired) ? "✓" : "!"}
                </div>
                <span className="hidden sm:inline text-xs font-medium text-surface-900">{s}</span>
                {i < 3 && <div className={`w-8 h-px ${i < 3 ? "bg-emerald-500" : "bg-surface-200"}`} />}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {/* Status Header */}
        <div className={`text-center mb-10 transition-all duration-700 ${checkVisible ? "opacity-100 scale-100" : "opacity-0 scale-75"}`}>
          <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-5 animate-bounce-soft ${
            isCancelled 
              ? "bg-red-100" 
              : isExpired
                ? "bg-surface-200"
                : "bg-emerald-100"
          }`}>
            {isCancelled ? (
              <X className="h-12 w-12 text-red-500" />
            ) : isExpired ? (
              <Clock className="h-12 w-12 text-surface-500" />
            ) : (
              <CheckCircle className="h-12 w-12 text-emerald-500" />
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-surface-900 mb-2">
            {isCancelled 
              ? "Booking Cancelled" 
              : isExpired
                ? "Booking Expired"
                : hasMultiple
                  ? "Round Trip Confirmed! 🎉"
                  : "Booking Confirmed! 🎉"}
          </h1>
          <p className="text-surface-500 text-lg">
            {isCancelled
              ? "This booking is no longer valid for travel."
              : isExpired
                ? "The payment time for this booking has expired."
                : "Your e-tickets have been sent to your email and phone."}
          </p>
        </div>

        {/* E-Ticket Container */}
        <div className="space-y-6 mb-6" id="e-ticket">
          {tickets.map((ticket, idx) => {
            const ticketCancelled = ticket.status === "CANCELLED" || ticket.status === "REFUNDED";
            const ticketExpired = ticket.status === "EXPIRED";
            return (
              <div 
                key={ticket.rawId} 
                className="card-premium overflow-hidden animate-fade-in-up" 
                style={{ animationDelay: `${(idx + 1) * 150}ms` }}
              >
                {/* Ticket Header */}
                <div className={`px-6 py-5 text-white ${ticketCancelled ? "bg-surface-600" : ticketExpired ? "bg-surface-400" : "hero-gradient"}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Bus className="h-5 w-5" />
                      <span className="font-bold text-lg">{ticket.operator}</span>
                      {hasMultiple && (
                        <span className="ml-2 text-xs bg-white/20 border border-white/30 px-2 py-0.5 rounded-full uppercase font-semibold">
                          {idx === 0 ? "Outbound Trip" : "Return Trip"}
                        </span>
                      )}
                    </div>
                    <span className={`badge border text-xs ${
                      ticketCancelled ? "bg-red-500/20 border-red-500/30 text-red-100" : 
                      ticketExpired ? "bg-surface-500/20 border-surface-500/30 text-surface-100" : 
                      "bg-white/20 border-white/30 text-white"
                    }`}>
                      {ticket.status}
                    </span>
                  </div>
                </div>

                {/* Ticket Body */}
                <div className="p-6">
                  {/* Route */}
                  <div className="flex items-center justify-between mb-6">
                    <div className="text-center min-w-[70px]">
                      <p className="text-2xl font-extrabold text-surface-900">{ticket.departure.replace(" AM", "").replace(" PM", "")}</p>
                      <p className="text-xs text-surface-400 font-semibold">{ticket.departure.includes("AM") ? "AM" : "PM"}</p>
                      <p className="text-sm text-surface-500 mt-1 truncate max-w-[120px]" title={ticket.from}>{ticket.from}</p>
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
                      <span className="text-xs text-surface-400 mt-1.5">{ticket.busType}</span>
                    </div>
                    <div className="text-center min-w-[70px]">
                      <p className="text-2xl font-extrabold text-surface-900">{ticket.arrival.replace(" AM", "").replace(" PM", "")}</p>
                      <p className="text-xs text-surface-400 font-semibold">{ticket.arrival.includes("AM") ? "AM" : "PM"}</p>
                      <p className="text-sm text-surface-500 mt-1 truncate max-w-[120px]" title={ticket.to}>{ticket.to}</p>
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
                      <p className="font-bold text-surface-900 mt-1 font-mono">{ticket.ticketId}</p>
                    </div>
                    <div>
                      <p className="text-surface-400 text-xs uppercase tracking-wide font-medium">Date</p>
                      <p className="font-bold text-surface-900 mt-1 flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5 text-surface-500" /> {ticket.date}
                      </p>
                    </div>
                    <div>
                      <p className="text-surface-400 text-xs uppercase tracking-wide font-medium">Seats</p>
                      <p className="font-bold text-surface-900 mt-1">{ticket.seats.join(", ")}</p>
                    </div>
                    <div>
                      <p className="text-surface-400 text-xs uppercase tracking-wide font-medium">Total Paid</p>
                      <p className="font-extrabold text-brand-600 mt-1">{ticket.totalPaid}</p>
                    </div>
                  </div>

                  {/* Passengers */}
                  <div className="mt-6 pt-4 border-t border-surface-100">
                    <p className="text-surface-400 text-xs uppercase tracking-wide font-medium mb-2">Passengers</p>
                    <div className="space-y-2">
                      {ticket.passengers.map((name: string, i: number) => (
                        <div key={i} className="flex items-center gap-2 p-2 bg-surface-50 rounded-lg">
                          <User className="h-4 w-4 text-surface-400" />
                          <span className="text-sm font-medium text-surface-900">{name}</span>
                          <span className="badge badge-info text-[10px] ml-auto">Seat {ticket.seats[i]}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* QR Code */}
                  <div className="mt-6 flex items-center justify-center">
                    <div className="p-2 bg-white rounded-xl shadow-sm border border-surface-200">
                      <QRCode value={ticket.rawId} size={100} />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          <button 
            onClick={handleDownload}
            disabled={isDownloading}
            className={`card-premium p-4 flex flex-col items-center gap-2 text-center hover:!border-brand-200 ${isDownloading ? 'opacity-50 cursor-not-allowed' : ''}`} 
            id="download-ticket"
          >
            <Download className="h-5 w-5 text-brand-600" />
            <span className="text-xs font-semibold text-surface-700">
              {isDownloading ? 'Downloading...' : 'Download'}
            </span>
          </button>
          <button className="card-premium p-4 flex flex-col items-center gap-2 text-center hover:!border-brand-200" id="share-ticket">
            <Share2 className="h-5 w-5 text-brand-600" />
            <span className="text-xs font-semibold text-surface-700">Share</span>
          </button>
          <button onClick={handlePrint} className="card-premium p-4 flex flex-col items-center gap-2 text-center hover:!border-brand-200" id="print-ticket">
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
