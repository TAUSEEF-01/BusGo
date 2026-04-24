import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, AlertTriangle, CheckCircle, Loader2 } from "lucide-react";
import { apiClient } from "../api/client";
import { toast } from "react-hot-toast";

export function Cancellation() {
  const { booking_id } = useParams();
  const navigate = useNavigate();
  const [booking, setBooking] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isCancelling, setIsCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const fetchBooking = async () => {
      try {
        const response = await apiClient.get(`/api/bookings/${booking_id}`);
        if (response.data.success) {
          setBooking(response.data.data);
        } else {
          setError("Failed to find booking");
        }
      } catch (err: any) {
        setError(err.response?.data?.detail || "Error loading booking");
      } finally {
        setLoading(false);
      }
    };
    if (booking_id) fetchBooking();
  }, [booking_id]);

  const handleCancel = async () => {
    setIsCancelling(true);
    try {
      const response = await apiClient.post(`/api/bookings/${booking_id}/cancel`);
      if (response.data.success) {
        setSuccess(true);
        toast.success("Booking cancelled successfully.");
      } else {
        toast.error("Cancellation failed");
      }
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "An error occurred");
    } finally {
      setIsCancelling(false);
    }
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
      <div className="min-h-screen bg-surface-50 flex flex-col items-center justify-center">
        <div className="text-red-500 mb-4">{error || "Booking not found"}</div>
        <button onClick={() => navigate("/my-bookings")} className="btn-primary">Return to My Bookings</button>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-surface-50 py-12 px-4">
        <div className="max-w-xl mx-auto card-premium p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="h-8 w-8 text-emerald-500" />
          </div>
          <h2 className="text-2xl font-bold text-surface-900 mb-2">Ticket Cancelled</h2>
          <p className="text-surface-500 mb-6">Your booking has been cancelled and a refund has been initiated according to the policy.</p>
          <button onClick={() => navigate("/my-bookings")} className="btn-primary w-full">View My Bookings</button>
        </div>
      </div>
    );
  }

  // Calculate a mock refund amount based on fare
  const refundAmount = booking.total_fare * 0.8;

  return (
    <div className="min-h-screen bg-surface-50 py-12 px-4" id="cancellation-page">
      <div className="max-w-2xl mx-auto space-y-6">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm font-medium text-surface-500 hover:text-brand-600 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        <div className="card-premium overflow-hidden">
          <div className="bg-red-50 border-b border-red-100 p-6 flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-red-900 mb-1">Cancel Booking</h2>
              <p className="text-sm text-red-700">Are you sure you want to cancel this booking? This action cannot be undone.</p>
            </div>
          </div>

          <div className="p-6 space-y-4 text-sm">
            <div className="flex justify-between pb-4 border-b border-surface-100">
              <span className="text-surface-500">Ticket ID</span>
              <span className="font-semibold text-surface-900">{booking.id.split('-')[0].toUpperCase()}</span>
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
              <span className="font-semibold text-surface-900">৳ {booking.total_fare}</span>
            </div>
            <div className="flex justify-between pt-2">
              <span className="font-bold text-surface-900">Estimated Refund</span>
              <span className="font-bold text-emerald-600">৳ {refundAmount}</span>
            </div>
            <p className="text-xs text-surface-400 text-right">* 20% cancellation fee applied</p>
          </div>

          <div className="p-6 bg-surface-50 border-t border-surface-100 flex gap-4">
            <button onClick={() => navigate(-1)} className="btn-secondary flex-1" disabled={isCancelling}>Keep Booking</button>
            <button onClick={handleCancel} disabled={isCancelling} className={`btn-primary !bg-red-600 !border-red-600 hover:!bg-red-700 hover:!border-red-700 flex-1 ${isCancelling ? 'opacity-50 cursor-not-allowed' : ''}`}>
              {isCancelling ? 'Processing...' : 'Confirm Cancellation'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
