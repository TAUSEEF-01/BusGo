import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { ArrowRight, User, Phone, Mail, MapPin, Clock, AlertCircle } from "lucide-react";
import { apiClient } from "../api/client";
import { toast } from "react-hot-toast";

export function PassengerDetails() {
  const navigate = useNavigate();
  const location = useLocation();

  // Use a combined state from location and sessionStorage
  const [state, setState] = useState(() => {
    const locState = location.state;
    if (locState && locState.trip_id) {
      // Save to sessionStorage for refresh recovery
      sessionStorage.setItem("pending_booking", JSON.stringify(locState));
      return locState;
    }

    // Try to recover from sessionStorage
    const saved = sessionStorage.getItem("pending_booking");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return {};
      }
    }
    return {};
  });

  useEffect(() => {
    if (location.state && location.state.trip_id) {
      setState(location.state);
      sessionStorage.setItem("pending_booking", JSON.stringify(location.state));
    }
  }, [location.state]);

  const [contactInfo, setContactInfo] = useState({ email: "", phone: "" });
  const [passengers, setPassengers] = useState(
    state.seats ? state.seats.map((seat: string) => ({ seat, name: "", phone: "", gender: "male" }))
    : [{ seat: "A3", name: "", phone: "", gender: "male" }]
  );

  useEffect(() => {
    if (state.seats && passengers.length !== state.seats.length) {
      setPassengers(state.seats.map((seat: string) => ({ seat, name: "", phone: "", gender: "male" })));
    }
  }, [state.seats]);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const updatePassenger = (index: number, field: string, value: string) => {    setPassengers((prev: any[]) => prev.map((p: any, i: number) => (i === index ? { ...p, [field]: value } : p)));
    setErrors((e: Record<string, string>) => ({ ...e, [`p${index}_${field}`]: "" }));
  };

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!contactInfo.email) errs.contact_email = "Email is required";
    if (!contactInfo.phone) errs.contact_phone = "Phone is required";
    passengers.forEach((p: any, i: number) => {
      if (!p.name) errs[`p${i}_name`] = "Name is required";
    });
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    
    // Check if we have required trip data
    if (!state.trip_id || !state.operator_id) {
      toast.error("Session expired. Please search for trips again.");
      navigate("/");
      return;
    }
    
    setIsSubmitting(true);
    try {
      // Convert "08:00 AM" to "08:00:00"
      let depTime = "08:00:00";
      try {
        const timeStr = state.departureTime || "08:00 AM";
        const [time, modifier] = timeStr.split(' ');
        let [hours, minutes] = time.split(':');
        if (hours === '12') {
          hours = '00';
        }
        if (modifier === 'PM') {
          hours = parseInt(hours, 10) + 12;
        }
        depTime = `${hours.toString().padStart(2, '0')}:${minutes}:00`;
      } catch (e) {
        // Fallback
      }

      // Convert "May 1, 2026" to "2026-05-01"
      let jDate = "2026-05-01";
      try {
        const d = new Date(state.date || "May 1, 2026");
        jDate = d.toISOString().split('T')[0];
      } catch(e) {
        // Fallback
      }

      const requestData = {
        trip_id: state.trip_id,
        operator_id: state.operator_id,
        operator_name: state.operator || "Unknown Operator",
        seat_numbers: passengers.map((p: any) => p.seat),
        passenger_details: passengers.map((p: any) => ({
          name: p.name,
          age: 30, // Mock age
          gender: p.gender,
          seat: p.seat
        })),
        boarding_point: state.origin || "Dhaka",
        dropping_point: state.destination || "Chittagong",
        journey_date: jDate,
        departure_time: depTime,
        total_fare: state.totalFare || passengers.length * 850 + 20,
        idempotency_key: crypto.randomUUID()
      };

      console.log("Creating booking with data:", requestData);
      const response = await apiClient.post("/api/bookings/", requestData);
      console.log("Booking response:", response.data);
      
      if (response.data.success) {
        toast.success("Seats locked! Proceed to payment.");
        sessionStorage.removeItem("pending_booking");
        navigate(`/booking/payment/${response.data.data.booking_id}`, {
          state: { totalFare: requestData.total_fare }
        });
      } else {
        toast.error(response.data.message || "Failed to create booking");
      }
    } catch (err: any) {
      console.error("Booking error:", err);
      console.error("Error response:", err.response?.data);
      let errMsg = "An error occurred during booking";
      const detail = err.response?.data?.detail;
      if (typeof detail === "string") {
        errMsg = detail;
      } else if (Array.isArray(detail)) {
        errMsg = detail.map((d: any) => d.msg).join(", ");
      }
      toast.error(errMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface-50" id="passenger-details-page">
      {/* Header */}
      <div className="bg-white border-b border-surface-200 shadow-elevation-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          {/* Stepper */}
          <div className="flex items-center gap-2 text-sm">
            {["Seats", "Passengers", "Payment", "Confirmation"].map((s, i) => (
              <div key={s} className="flex items-center gap-2">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                  i < 1 ? "bg-emerald-500 text-white" : i === 1 ? "bg-brand-600 text-white shadow-brand" : "bg-surface-200 text-surface-400"
                }`}>
                  {i < 1 ? "✓" : i + 1}
                </div>
                <span className={`hidden sm:inline text-xs font-medium ${i <= 1 ? "text-surface-900" : "text-surface-400"}`}>{s}</span>
                {i < 3 && <div className={`w-8 h-px ${i < 1 ? "bg-emerald-500" : "bg-surface-200"}`} />}
              </div>
            ))}
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Form */}
          <div className="flex-1 space-y-6">
            {/* Contact Info */}
            <div className="card-premium p-6">
              <h2 className="text-lg font-bold text-surface-900 mb-1">Contact Information</h2>
              <p className="text-sm text-surface-500 mb-5">We'll send your e-ticket and updates to this contact.</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-surface-700 mb-1.5">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-surface-400" />
                    <input
                      type="email"
                      value={contactInfo.email}
                      onChange={(e) => { setContactInfo((c) => ({ ...c, email: e.target.value })); setErrors((er) => ({ ...er, contact_email: "" })); }}
                      placeholder="your@email.com"
                      className={`input-premium !pl-10 ${errors.contact_email ? "!border-red-400" : ""}`}
                      id="contact-email"
                    />
                  </div>
                  {errors.contact_email && <p className="text-red-500 text-xs mt-1">{errors.contact_email}</p>}
                </div>
                <div>
                  <label className="block text-sm font-semibold text-surface-700 mb-1.5">Phone</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-surface-400" />
                    <input
                      type="tel"
                      value={contactInfo.phone}
                      onChange={(e) => { setContactInfo((c) => ({ ...c, phone: e.target.value })); setErrors((er) => ({ ...er, contact_phone: "" })); }}
                      placeholder="+880 1XXX XXXXXX"
                      className={`input-premium !pl-10 ${errors.contact_phone ? "!border-red-400" : ""}`}
                      id="contact-phone"
                    />
                  </div>
                  {errors.contact_phone && <p className="text-red-500 text-xs mt-1">{errors.contact_phone}</p>}
                </div>
              </div>
            </div>

            {/* Passenger Cards */}
            {passengers.map((p: any, i: number) => (
              <div key={i} className="card-premium p-6 animate-fade-in-up" style={{ animationDelay: `${i * 100}ms` }} id={`passenger-card-${i}`}>
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center">
                    <User className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-surface-900">Passenger {i + 1}</h3>
                    <span className="text-xs badge badge-info">Seat {p.seat}</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-semibold text-surface-700 mb-1.5">Full Name</label>
                    <input
                      type="text"
                      value={p.name}
                      onChange={(e) => updatePassenger(i, "name", e.target.value)}
                      placeholder="As per NID / Passport"
                      className={`input-premium ${errors[`p${i}_name`] ? "!border-red-400" : ""}`}
                      id={`passenger-name-${i}`}
                    />
                    {errors[`p${i}_name`] && <p className="text-red-500 text-xs mt-1">{errors[`p${i}_name`]}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-surface-700 mb-1.5">Phone (Optional)</label>
                    <input
                      type="tel"
                      value={p.phone}
                      onChange={(e) => updatePassenger(i, "phone", e.target.value)}
                      placeholder="+880..."
                      className="input-premium"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-surface-700 mb-1.5">Gender</label>
                    <select
                      value={p.gender}
                      onChange={(e) => updatePassenger(i, "gender", e.target.value)}
                      className="input-premium"
                    >
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Sidebar */}
          <div className="lg:w-80">
            <div className="lg:sticky lg:top-24 space-y-4">
              <div className="card-premium p-6">
                <h3 className="font-bold text-surface-900 mb-4">Trip Summary</h3>

                <div className="space-y-3 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-surface-100 flex items-center justify-center">
                      <MapPin className="h-4 w-4 text-surface-500" />
                    </div>
                    <div>
                      <p className="font-semibold text-surface-900">{state.origin || "Dhaka"} → {state.destination || "Chittagong"}</p>
                      <p className="text-xs text-surface-500">{state.operator || "Greenline Paribahan"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-surface-100 flex items-center justify-center">
                      <Clock className="h-4 w-4 text-surface-500" />
                    </div>
                    <div>
                      <p className="font-semibold text-surface-900">{state.departureTime || "08:00 AM"}</p>
                      <p className="text-xs text-surface-500">{state.date || "May 1, 2026"}</p>
                    </div>
                  </div>
                </div>

                <div className="border-t border-surface-200 mt-4 pt-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-surface-500">Seats</span>
                    <span className="font-medium text-surface-900">{passengers.map((p: any) => p.seat).join(", ")}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-surface-500">Subtotal</span>
                    <span className="font-medium text-surface-900">৳ {(state.totalFare - 20) || passengers.length * 850}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-surface-500">Service fee</span>
                    <span className="font-medium text-surface-900">৳ 20</span>
                  </div>
                  <div className="flex justify-between pt-3 border-t border-surface-200 text-base">
                    <span className="font-bold text-surface-900">Total</span>
                    <span className="font-extrabold text-brand-600">৳ {state.totalFare || passengers.length * 850 + 20}</span>
                  </div>
                </div>
              </div>

              <button 
                type="submit" 
                disabled={isSubmitting}
                className={`btn-primary w-full flex items-center justify-center gap-2 !py-3 ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`} 
                id="continue-to-payment" 
                onClick={handleSubmit}
              >
                {isSubmitting ? "Processing..." : "Continue to Payment"} <ArrowRight className="h-4 w-4" />
              </button>

              <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-xl border border-blue-200 text-sm">
                <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                <p className="text-blue-700">Your information is encrypted and secure. We never share your data.</p>
              </div>

              <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-xl border border-amber-200 text-sm mt-3">
                <Clock className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                <p className="text-amber-700">
                  <strong>Important:</strong> Your seats will be held for 10 minutes. Complete payment to confirm your booking, or seats will be automatically released.
                </p>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
