import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, AlertTriangle, CheckCircle, Loader2, Clock } from "lucide-react";
import { apiClient } from "../api/client";
import { toast } from "react-hot-toast";

export function Cancellation() {
  const { booking_id } = useParams();
  const navigate = useNavigate();
  const [booking, setBooking] = useState<any>(null);
  const [cancelInfo, setCancelInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isCancelling, setIsCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [bookingRes, infoRes] = await Promise.all([
          apiClient.get(`/api/bookings/${booking_id}`),
          apiClient.get(`/api/bookings/${booking_id}/cancellation-info`),
        ]);
        if (bookingRes.data.success) setBooking(bookingRes.data.data);
        else setError("Failed to find booking");
        if (infoRes.data.success) setCancelInfo(infoRes.data.data);
      } catch (err: any) {
        setError(err.response?.data?.detail || "Error loading booking");
      } finally {
        setLoading(false);
      }
    };
    if (booking_id) fetchData();
  }, [booking_id]);

  // Countdown timer until window expires
  useEffect(() => {
    if (!cancelInfo?.window_expires_at || !cancelInfo.cancellable) return;
    const update = () => {
      const diff = Math.floor((new Date(cancelInfo.window_expires_at).getTime() - Date.now()) / 1000);
      setTimeLeft(diff > 0 ? diff : 0);
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [cancelInfo]);

  const handleCancel = async () => {
    setIsCancelling(true);
    try {
      const response = await apiClient.post(`/api/bookings/${booking_id}/cancel`);
      if (response.data.success) {
        const data = response.data.data;
        toast.success(data?.message || "Booking cancelled successfully.");
        navigate(`/booking/confirmation/${booking_id}`);
      } else {
        toast.error("Cancellation failed");
      }
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      toast.error(typeof detail === "string" ? detail : "An error occurred");
    } finally {
      setIsCancelling(false);
    }
  };

  const formatCountdown = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div className="min-h-screen bg-surface-50 flex flex-col items-center justify-center gap-4">
        <div className="text-red-500">{error || "Booking not found"}</div>
        <button onClick={() => navigate("/my-bookings")} className="btn-primary">Return to My Bookings</button>
      </div>
    );
  }

  const cancellable = cancelInfo?.cancellable ?? false;
  const refundAmount = cancelInfo?.refund_amount ?? 0;
  const refundPct = cancelInfo?.refund_percentage ?? 80;
  const windowExpired = cancelInfo && !cancellable && cancelInfo.reason?.includes("expired");

  return (
    <div className="min-h-screen bg-surface-50 py-12 px-4" id="cancellation-page">
      <div className="max-w-2xl mx-auto space-y-6">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm font-medium text-surface-500 hover:text-brand-600 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        {/* Cancellation window notice */}
        {cancelInfo && (
          <div className={`flex items-start gap-3 p-4 rounded-xl border-2 ${
            cancellable
              ? timeLeft !== null && timeLeft < 300
                ? "bg-amber-50 border-amber-300"
                : "bg-blue-50 border-blue-300"
              : "bg-red-50 border-red-300"
          }`}>
            <Clock className={`h-5 w-5 mt-0.5 flex-shrink-0 ${
              cancellable ? timeLeft !== null && timeLeft < 300 ? "text-amber-600" : "text-blue-600" : "text-red-600"
            }`} />
            <div>
              {cancellable ? (
                <>
                  <p className={`font-bold text-sm ${timeLeft !== null && timeLeft < 300 ? "text-amber-900" : "text-blue-900"}`}>
                    Cancellation window closes in {timeLeft !== null ? formatCountdown(timeLeft) : "…"}
                  </p>
                  <p className={`text-xs mt-0.5 ${timeLeft !== null && timeLeft < 300 ? "text-amber-700" : "text-blue-700"}`}>
                    You have 1 hour after payment to cancel and receive a {refundPct}% refund.
                  </p>
                </>
              ) : (
                <>
                  <p className="font-bold text-sm text-red-900">
                    {windowExpired ? "Cancellation window has expired" : (cancelInfo.reason || "Cancellation not available")}
                  </p>
                  <p className="text-xs mt-0.5 text-red-700">
                    Tickets can only be cancelled within 1 hour of payment.
                  </p>
                </>
              )}
            </div>
          </div>
        )}

        <div className="card-premium overflow-hidden">
          <div className="bg-red-50 border-b border-red-100 p-6 flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-red-900 mb-1">Cancel Booking</h2>
              <p className="text-sm text-red-700">Are you sure you want to cancel? This action cannot be undone.</p>
            </div>
          </div>

          <div className="p-6 space-y-4 text-sm">
            <div className="flex justify-between pb-4 border-b border-surface-100">
              <span className="text-surface-500">Ticket ID</span>
              <span className="font-semibold text-surface-900">{booking.id.split("-")[0].toUpperCase()}</span>
            </div>
            <div className="flex justify-between pb-4 border-b border-surface-100">
              <span className="text-surface-500">Route</span>
              <span className="font-semibold text-surface-900">{booking.boarding_point} → {booking.dropping_point}</span>
            </div>
            <div className="flex justify-between pb-4 border-b border-surface-100">
              <span className="text-surface-500">Seats</span>
              <span className="font-semibold text-surface-900">{booking.seat_numbers.join(", ")}</span>
            </div>
            <div className="flex justify-between pb-4 border-b border-surface-100">
              <span className="text-surface-500">Amount Paid</span>
              <span className="font-semibold text-surface-900">৳ {Number(booking.total_fare).toLocaleString()}</span>
            </div>
            {cancellable ? (
              <>
                <div className="flex justify-between pb-3 border-b border-surface-100">
                  <span className="text-surface-500">Cancellation Fee ({100 - refundPct}%)</span>
                  <span className="font-semibold text-red-600">− ৳ {(Number(booking.total_fare) - refundAmount).toLocaleString()}</span>
                </div>
                <div className="flex justify-between pt-1">
                  <span className="font-bold text-surface-900">Refund to Account</span>
                  <span className="font-bold text-emerald-600">৳ {Number(refundAmount).toLocaleString()}</span>
                </div>
                <p className="text-xs text-surface-400 text-right">Refunded instantly to your payment account</p>
              </>
            ) : (
              <div className="flex justify-between pt-1">
                <span className="font-bold text-surface-900">Refund</span>
                <span className="font-bold text-red-500">Not eligible</span>
              </div>
            )}
          </div>

          <div className="p-6 bg-surface-50 border-t border-surface-100 flex gap-4">
            <button onClick={() => navigate(-1)} className="btn-secondary flex-1" disabled={isCancelling}>
              Keep Booking
            </button>
            <button
              onClick={handleCancel}
              disabled={isCancelling || !cancellable}
              className={`flex-1 btn-primary !bg-red-600 !border-red-600 hover:!bg-red-700 hover:!border-red-700 ${
                (!cancellable || isCancelling) ? "opacity-50 cursor-not-allowed" : ""
              }`}
            >
              {isCancelling ? (
                <span className="flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Processing...</span>
              ) : cancellable ? (
                "Confirm Cancellation"
              ) : (
                <span className="flex items-center justify-center gap-2"><CheckCircle className="w-4 h-4" /> Window Expired</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
