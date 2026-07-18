import { useState, useEffect } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import {
  CheckCircle, Download, Share2, Printer, Calendar, User, Bus, Home, Clock, X, Loader2, MapPin, ArrowRight
} from "lucide-react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { apiClient } from "../api/client";
import { toast } from "react-hot-toast";

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

const formatTicketDate = (value: string) => {
  if (!value) return "Date to be confirmed";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

const formatTicketTime = (value?: string | null) => {
  if (!value) return "TBA";
  if (value.includes("T")) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  }
  const [hourValue, minute = "00"] = value.split(":");
  const hour = Number(hourValue);
  if (Number.isNaN(hour)) return value;
  return `${String(hour % 12 || 12).padStart(2, "0")}:${minute} ${hour >= 12 ? "PM" : "AM"}`;
};

const calculateTicketDuration = (departure?: string | null, arrival?: string | null) => {
  if (!departure || !arrival) return "Scheduled service";
  const start = new Date(departure).getTime();
  const end = new Date(arrival).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return "Scheduled service";
  const minutes = Math.round((end - start) / 60000);
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
};

const ticketAssetUrl = (path?: string | null) => {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  const base = String(apiClient.defaults.baseURL || window.location.origin).replace(/\/$/, "");
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
};

export function Confirmation() {
  const { booking_id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state || {};

  const [showConfetti, setShowConfetti] = useState(false);
  const [checkVisible, setCheckVisible] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [tickets, setTickets] = useState<any[]>([]);
  const [journey, setJourney] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Save return_booking_id to sessionStorage as a fallback if present in state
  useEffect(() => {
    if (booking_id && state.return_booking_id) {
      sessionStorage.setItem(`return_booking_id_${booking_id}`, state.return_booking_id);
    }
  }, [booking_id, state.return_booking_id]);

  useEffect(() => {
    let cancelled = false;

    const toTicket = (booking: any, transitJourney?: any) => {
      const seats: string[] = booking.seat_numbers || [];
      const passengerDetails = Array.isArray(booking.passenger_details) ? booking.passenger_details : [];
      const departureDateTime = booking.departure_datetime || (booking.journey_date && booking.departure_time ? `${booking.journey_date}T${booking.departure_time}` : null);
      return {
        ticketId: String(booking.id || booking.booking_id).split("-")[0].toUpperCase(),
        rawId: booking.id || booking.booking_id,
        operator: booking.operator_name || "BusGo operator",
        from: booking.origin_city || booking.boarding_point,
        to: booking.destination_city || booking.dropping_point,
        boardingPoint: booking.boarding_point,
        droppingPoint: booking.dropping_point,
        date: formatTicketDate(booking.journey_date || departureDateTime),
        departure: formatTicketTime(departureDateTime || booking.departure_time),
        arrival: formatTicketTime(booking.arrival_datetime),
        duration: calculateTicketDuration(departureDateTime, booking.arrival_datetime),
        seats,
        passengers: seats.map((seat, index) => ({
          name: passengerDetails[index]?.name || passengerDetails.find((passenger: any) => passenger.seat === seat)?.name || `Passenger ${index + 1}`,
          seat,
        })),
        fare: Number(booking.fare ?? booking.total_fare ?? 0),
        status: booking.status,
        busType: booking.bus_type || "Bus",
        busRegistration: booking.bus_registration_no || "Assigned coach",
        legNumber: booking.leg_number || null,
        legCount: transitJourney?.leg_count || null,
        qrCodeUrl: null,
        pdfUrl: null,
        artifactPending: booking.status === "CONFIRMED",
      };
    };

    const hydrateTicketArtifacts = async (bookingIds: string[]) => {
      await Promise.all(bookingIds.map(async (id) => {
        for (let attempt = 0; attempt < 6 && !cancelled; attempt += 1) {
          try {
            const response = await apiClient.get(`/api/tickets/booking/${id}`);
            const official = response.data?.data;
            if (official) {
              setTickets((current) => current.map((ticket) => ticket.rawId === id ? {
                ...ticket,
                ticketId: String(official.id).split("-")[0].toUpperCase(),
                qrCodeUrl: ticketAssetUrl(official.qr_code_url),
                pdfUrl: ticketAssetUrl(official.pdf_url),
                artifactPending: false,
              } : ticket));
              return;
            }
          } catch (reason: any) {
            if (reason.response?.status !== 404) break;
          }
          await new Promise((resolve) => setTimeout(resolve, 500 + attempt * 350));
        }
        if (!cancelled) setTickets((current) => current.map((ticket) => ticket.rawId === id ? { ...ticket, artifactPending: false } : ticket));
      }));
    };

    const fetchCurrentTickets = async () => {
      if (!booking_id) return;
      setLoading(true);
      setError(null);
      try {
        const queryJourneyId = new URLSearchParams(location.search).get("journeyId");
        let resolvedJourneyId = state.journeyId || queryJourneyId || sessionStorage.getItem(`journey_id_${booking_id}`);
        const resolvedReturnId = state.return_booking_id || sessionStorage.getItem(`return_booking_id_${booking_id}`);
        let firstBooking: any = null;

        if (!resolvedJourneyId) {
          const firstResponse = await apiClient.get(`/api/bookings/${booking_id}`);
          firstBooking = firstResponse.data?.data;
          resolvedJourneyId = firstBooking?.journey_id || null;
        }

        let fetchedTickets: any[] = [];
        if (resolvedJourneyId) {
          sessionStorage.setItem(`journey_id_${booking_id}`, resolvedJourneyId);
          const journeyResponse = await apiClient.get(`/api/bookings/journeys/${resolvedJourneyId}`);
          if (!journeyResponse.data?.success) throw new Error(journeyResponse.data?.message || "Failed to load transit journey");
          const journeyData = journeyResponse.data.data;
          if (!cancelled) setJourney(journeyData);
          fetchedTickets = (journeyData.legs || []).map((leg: any) => toTicket(leg, journeyData));
        } else {
          const fetchIds = [booking_id, ...(resolvedReturnId ? [resolvedReturnId] : [])];
          for (const id of fetchIds) {
            const booking = id === booking_id && firstBooking ? firstBooking : (await apiClient.get(`/api/bookings/${id}`)).data?.data;
            if (!booking) throw new Error("Failed to load booking details");
            fetchedTickets.push(toTicket(booking));
          }
        }

        if (!cancelled) {
          setTickets(fetchedTickets);
          void hydrateTicketArtifacts(fetchedTickets.filter((ticket) => ticket.status === "CONFIRMED").map((ticket) => ticket.rawId));
        }
        if (fetchedTickets.some((ticket) => ticket.status === "CONFIRMED")) {
          setShowConfetti(true);
          setTimeout(() => setShowConfetti(false), 5000);
        }
      } catch (err: any) {
        if (!cancelled) setError(err.message || err.response?.data?.detail || "Failed to load booking details");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void fetchCurrentTickets();
    const visibleTimer = setTimeout(() => setCheckVisible(true), 300);
    return () => { cancelled = true; clearTimeout(visibleTimer); };
  }, [booking_id, state.return_booking_id, state.journeyId, location.search]);

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
      const imageHeight = (canvas.height * pdfWidth) / canvas.width;
      const pageHeight = pdf.internal.pageSize.getHeight();
      let remainingHeight = imageHeight;
      let position = 0;
      pdf.addImage(imgData, "PNG", 0, position, pdfWidth, imageHeight);
      remainingHeight -= pageHeight;
      while (remainingHeight > 0) {
        position = remainingHeight - imageHeight;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, position, pdfWidth, imageHeight);
        remainingHeight -= pageHeight;
      }
      
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

  const handleShare = async () => {
    const shareData = { title: "My BusGo ticket", text: journey ? `${journey.origin} to ${journey.destination} transit journey` : "My BusGo ticket", url: window.location.href };
    try {
      if (navigator.share) await navigator.share(shareData);
      else {
        await navigator.clipboard.writeText(window.location.href);
        toast.success("Ticket link copied");
      }
    } catch (reason: any) {
      if (reason?.name !== "AbortError") toast.error("Could not share the ticket");
    }
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
  const isTransit = Boolean(journey);
  const isRoundTrip = hasMultiple && !isTransit;
  const ticketArtifactsPending = tickets.some((ticket) => ticket.artifactPending);

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
                : isTransit
                  ? "Transit Journey Confirmed! 🎉"
                  : isRoundTrip
                  ? "Round Trip Confirmed! 🎉"
                  : "Booking Confirmed! 🎉"}
          </h1>
          <p className="text-surface-500 text-lg">
            {isCancelled
              ? "This booking is no longer valid for travel."
              : isExpired
                ? "The payment time for this booking has expired."
                : isTransit
                  ? `All ${journey?.leg_count} buses are confirmed. Keep one ticket for each bus.`
                  : "Your e-tickets have been sent to your email and phone."}
          </p>
        </div>

        {/* E-Ticket Container */}
        <div className="space-y-6 mb-6" id="e-ticket">
          {isTransit && (
            <div className="card-premium p-6 border-brand-200 bg-gradient-to-br from-brand-50 to-white">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 text-brand-700 font-bold text-sm"><MapPin className="h-4 w-4" /> Transit journey · {journey.leg_count} buses · one payment</div>
                  <h2 className="text-xl font-extrabold text-surface-900 mt-2">{journey.origin} <ArrowRight className="inline h-4 w-4 mx-1 text-surface-400" /> {journey.destination}</h2>
                  <p className="text-sm text-surface-600 mt-2">Use the separate ticket and seat shown for each bus. You must change buses at the transfer locations below.</p>
                </div>
                <div className="sm:text-right shrink-0"><p className="text-xs uppercase font-semibold text-surface-400">Journey total paid</p><p className="text-2xl font-black text-brand-700">৳ {Number(journey.final_fare).toLocaleString()}</p></div>
              </div>
              <div className="grid gap-2 mt-5">
                {tickets.map((ticket, index) => <div key={ticket.rawId} className="flex flex-wrap items-center gap-2 rounded-xl bg-white border border-surface-200 px-3 py-2 text-xs"><span className="font-extrabold text-brand-700">Bus {ticket.legNumber}</span><span className="font-semibold text-surface-800">{ticket.from} → {ticket.to}</span><span className="text-surface-400">{ticket.operator} · {ticket.busRegistration}</span><span className="ml-auto font-bold text-surface-800">Seat {ticket.seats.join(", ")}</span>{index < tickets.length - 1 && <span className="w-full text-amber-700 font-semibold">Change bus at {ticket.to}{journey.transfers?.[index]?.wait_minutes != null ? ` · ${journey.transfers[index].wait_minutes} min transfer` : ""}</span>}</div>)}
              </div>
            </div>
          )}
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
                      {(isTransit || isRoundTrip) && (
                        <span className="ml-2 text-xs bg-white/20 border border-white/30 px-2 py-0.5 rounded-full uppercase font-semibold">
                          {isTransit ? `Bus ${ticket.legNumber} of ${ticket.legCount}` : idx === 0 ? "Outbound Trip" : "Return Trip"}
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
                      {(ticket.departure.includes("AM") || ticket.departure.includes("PM")) && <p className="text-xs text-surface-400 font-semibold">{ticket.departure.includes("AM") ? "AM" : "PM"}</p>}
                      <p className="text-sm text-surface-500 mt-1 truncate max-w-[120px]" title={ticket.from}>{ticket.from}</p>
                    </div>
                    <div className="flex-1 flex flex-col items-center px-4">
                      <span className="text-xs text-surface-400 mb-1.5">{ticket.duration}</span>
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
                      {(ticket.arrival.includes("AM") || ticket.arrival.includes("PM")) && <p className="text-xs text-surface-400 font-semibold">{ticket.arrival.includes("AM") ? "AM" : "PM"}</p>}
                      <p className="text-sm text-surface-500 mt-1 truncate max-w-[120px]" title={ticket.to}>{ticket.to}</p>
                    </div>
                  </div>

                  {/* Dashed divider */}
                  <div className="border-t-2 border-dashed border-surface-200 my-5 relative">
                    <div className="absolute -left-9 -top-3 w-6 h-6 rounded-full bg-surface-50" />
                    <div className="absolute -right-9 -top-3 w-6 h-6 rounded-full bg-surface-50" />
                  </div>

                  {/* Details Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 text-sm">
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
                      <p className="font-extrabold text-brand-700 mt-1">{ticket.seats.join(", ")}</p>
                    </div>
                    <div>
                      <p className="text-surface-400 text-xs uppercase tracking-wide font-medium">Coach / Bus</p>
                      <p className="font-bold text-surface-900 mt-1">{ticket.busRegistration}</p>
                    </div>
                    <div>
                      <p className="text-surface-400 text-xs uppercase tracking-wide font-medium">{isTransit ? "Leg Fare" : "Total Paid"}</p>
                      <p className="font-extrabold text-brand-600 mt-1">৳ {ticket.fare.toLocaleString()}</p>
                    </div>
                  </div>

                  {/* Passengers */}
                  <div className="mt-6 pt-4 border-t border-surface-100">
                    <p className="text-surface-400 text-xs uppercase tracking-wide font-medium mb-2">Passengers</p>
                    <div className="space-y-2">
                      {ticket.passengers.map((passenger: { name: string; seat: string }, i: number) => (
                        <div key={i} className="flex items-center gap-2 p-2 bg-surface-50 rounded-lg">
                          <User className="h-4 w-4 text-surface-400" />
                          <span className="text-sm font-medium text-surface-900">{passenger.name}</span>
                          <span className="badge badge-info text-[10px] ml-auto">Bus {ticket.legNumber || 1} · Seat {passenger.seat}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* QR Code */}
                  <div className="mt-6 flex items-center justify-center">
                    <div className="p-2 bg-white rounded-xl shadow-sm border border-surface-200">
                      {ticket.qrCodeUrl ? <img src={ticket.qrCodeUrl} alt={`Secure QR for ticket ${ticket.ticketId}`} className="w-[110px] h-[110px]" crossOrigin="anonymous" /> : ticket.artifactPending ? <div className="w-[110px] h-[110px] flex flex-col items-center justify-center text-center text-xs text-surface-500"><Loader2 className="h-5 w-5 animate-spin text-brand-500 mb-2" />Generating secure QR…</div> : <div className="w-[110px] h-[110px] flex items-center justify-center text-center text-xs text-amber-700 bg-amber-50 p-2">QR generation is delayed. Refresh before boarding.</div>}
                    </div>
                  </div>
                  {ticket.pdfUrl && <div className="text-center mt-3"><a href={ticket.pdfUrl} className="text-xs font-bold text-brand-600 hover:text-brand-700" target="_blank" rel="noreferrer">Download official Bus {ticket.legNumber || 1} PDF ticket</a></div>}
                </div>
              </div>
            );
          })}
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          <button 
            onClick={handleDownload}
            disabled={isDownloading || ticketArtifactsPending}
            className={`card-premium p-4 flex flex-col items-center gap-2 text-center hover:!border-brand-200 ${isDownloading || ticketArtifactsPending ? 'opacity-50 cursor-not-allowed' : ''}`}
            id="download-ticket"
          >
            <Download className="h-5 w-5 text-brand-600" />
            <span className="text-xs font-semibold text-surface-700">
              {isDownloading ? 'Downloading...' : ticketArtifactsPending ? 'Preparing tickets…' : 'Download all'}
            </span>
          </button>
          <button onClick={handleShare} className="card-premium p-4 flex flex-col items-center gap-2 text-center hover:!border-brand-200" id="share-ticket">
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
