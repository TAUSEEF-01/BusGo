import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { ArrowRight, User, Mail, Phone, MapPin, ArrowRight as Arrow } from "lucide-react";
import { apiClient } from "../api/client";
import { toast } from "react-hot-toast";
import { useAuthStore } from "../stores/authStore";

interface PassengerDraft {
  name: string;
  age: string;
  gender: "male" | "female" | "other";
}

export function TransitPassengerDetails() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state || {};
  const itinerary = state.itinerary;
  const legs: any[] = itinerary?.legs || [];
  const seatsByLeg: string[][] = state.seatsByLeg || [];
  const user = useAuthStore((store) => store.user);

  const [contact, setContact] = useState({ email: user?.email || "", phone: user?.phone || "" });
  const [passengers, setPassengers] = useState<PassengerDraft[]>(() =>
    (seatsByLeg[0] || []).map((_, index) => ({
      name: index === 0 ? user?.name || "" : "",
      age: "",
      gender: "male",
    }))
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  if (!itinerary) { navigate("/search"); return null; }

  const totalFare = legs.reduce((sum, l, i) => sum + Number(l.fare_amount) * (seatsByLeg[i]?.length || 0), 0);
  const operatorDiscountRate = Number(itinerary.total_fare) > 0
    ? Number(itinerary.operator_discount_amount || 0) / Number(itinerary.total_fare)
    : 0;
  const operatorDiscount = Math.round(totalFare * operatorDiscountRate * 100) / 100;
  const payableFare = Math.max(0, totalFare - operatorDiscount);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!contact.email) e.email = "Email is required";
    if (!/^01\d{9}$/.test(contact.phone.replace(/\D/g, "").slice(-11))) e.phone = "Enter a valid 11-digit phone number";
    passengers.forEach((passenger, index) => {
      if (passenger.name.trim().length < 2) e[`passenger_name_${index}`] = "Full name is required";
      const age = Number(passenger.age);
      if (!Number.isInteger(age) || age < 1 || age > 120) e[`passenger_age_${index}`] = "Enter a valid age";
    });
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const updatePassenger = (index: number, patch: Partial<PassengerDraft>) => {
    setPassengers((current) => current.map((passenger, position) => position === index ? { ...passenger, ...patch } : passenger));
    setErrors((current) => ({
      ...current,
      [`passenger_name_${index}`]: "",
      [`passenger_age_${index}`]: "",
    }));
  };

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      const apiLegs = legs.map((l, i) => {
        const seats = seatsByLeg[i] || [];
        return {
          trip_id: l.trip_id,
          operator_id: l.operator_id,
          seat_numbers: seats,
          boarding_point: l.origin_city,
          dropping_point: l.destination_city,
          journey_date: String(l.departure_datetime).slice(0, 10),
          departure_time: String(l.departure_datetime).slice(11, 19) || "08:00:00",
          fare: Number(l.fare_amount) * seats.length,
        };
      });
      const passenger_details = (seatsByLeg[0] || []).map((seat, index) => ({
        name: passengers[index].name.trim(),
        age: Number(passengers[index].age),
        gender: passengers[index].gender,
        seat,
      }));
      const body = {
        origin: state.origin,
        destination: state.destination,
        legs: apiLegs,
        passenger_details,
        total_fare: totalFare,
        transit_route_id: itinerary.transit_route_id || undefined,
        idempotency_key: crypto.randomUUID(),
      };
      const res = await apiClient.post("/api/bookings/journeys/", body);
      if (res.data.success) {
        toast.success("Seats locked on all buses! Proceed to payment.");
        const d = res.data.data;
        navigate(`/booking/payment/${d.booking_ids[0]}`, {
          state: {
            isTransit: true,
            journeyId: d.journey_id,
            journeyTotal: d.final_fare,
            legs: d.legs,
            origin: state.origin,
            destination: state.destination,
          },
        });
      } else {
        toast.error(res.data.message || "Could not create the journey");
      }
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      toast.error(typeof detail === "string" ? detail : "Could not create the journey");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface-50">
      <div className="bg-white border-b border-surface-200 shadow-elevation-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <h1 className="font-bold text-surface-900 flex items-center gap-2"><MapPin className="h-4 w-4 text-brand-600" /> {state.origin} → {state.destination} · Passenger details</h1>
        </div>
      </div>

      <form onSubmit={submit} className="max-w-4xl mx-auto px-4 py-8 flex flex-col lg:flex-row gap-8">
        <div className="flex-1 card-premium p-6">
          <h2 className="text-lg font-bold text-surface-900 mb-1">Passenger details</h2>
          <p className="text-sm text-surface-500 mb-5">Each passenger keeps the seat shown for every bus below.</p>
          <div className="space-y-4">
            {passengers.map((passenger, index) => (
              <div key={index} className="rounded-xl border border-surface-200 bg-surface-50/60 p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="font-bold text-surface-900">Passenger {index + 1}</p>
                  <div className="flex flex-wrap justify-end gap-1">
                    {legs.map((_, legIndex) => <span key={legIndex} className="badge badge-info text-[10px]">Bus {legIndex + 1}: Seat {seatsByLeg[legIndex]?.[index] || "—"}</span>)}
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-surface-600 mb-1">Full name</label>
                    <div className="relative"><User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-400" /><input value={passenger.name} onChange={(event) => updatePassenger(index, { name: event.target.value })} className={`input-premium !pl-9 ${errors[`passenger_name_${index}`] ? "!border-red-400" : ""}`} placeholder="As shown on identification" /></div>
                    {errors[`passenger_name_${index}`] && <p className="text-red-500 text-xs mt-1">{errors[`passenger_name_${index}`]}</p>}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-surface-600 mb-1">Age</label>
                    <input value={passenger.age} onChange={(event) => updatePassenger(index, { age: event.target.value.replace(/\D/g, "").slice(0, 3) })} className={`input-premium ${errors[`passenger_age_${index}`] ? "!border-red-400" : ""}`} inputMode="numeric" placeholder="Age" />
                    {errors[`passenger_age_${index}`] && <p className="text-red-500 text-xs mt-1">{errors[`passenger_age_${index}`]}</p>}
                  </div>
                </div>
                <div className="flex gap-2 mt-3">
                  {(["male", "female", "other"] as const).map((gender) => <button key={gender} type="button" onClick={() => updatePassenger(index, { gender })} className={`flex-1 rounded-lg border px-3 py-2 text-xs font-semibold capitalize ${passenger.gender === gender ? "border-brand-500 bg-brand-50 text-brand-700" : "border-surface-200 bg-white text-surface-600"}`}>{gender}</button>)}
                </div>
              </div>
            ))}

            <div className="border-t border-surface-200 pt-4">
              <h3 className="font-bold text-surface-900 mb-1">Ticket contact</h3>
              <p className="text-xs text-surface-500 mb-3">All leg tickets and connection updates are sent here.</p>
              <label className="block text-sm font-semibold text-surface-700 mb-1.5">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-surface-400" />
                <input value={contact.email} onChange={(e) => setContact((c) => ({ ...c, email: e.target.value }))} className={`input-premium !pl-10 ${errors.email ? "!border-red-400" : ""}`} placeholder="your@email.com" />
              </div>
              {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
            </div>
            <div>
              <label className="block text-sm font-semibold text-surface-700 mb-1.5">Phone</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-surface-400" />
                <input value={contact.phone} onChange={(e) => setContact((c) => ({ ...c, phone: e.target.value }))} className={`input-premium !pl-10 ${errors.phone ? "!border-red-400" : ""}`} placeholder="+880 1XXX XXXXXX" />
              </div>
              {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone}</p>}
            </div>
          </div>
        </div>

        <div className="lg:w-80">
          <div className="card-premium p-6 lg:sticky lg:top-24">
            <h3 className="font-bold text-surface-900 mb-4">Journey Summary</h3>
            <div className="space-y-3">
              {legs.map((l, i) => (
                <div key={i}>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-[10px] font-bold text-brand-600 uppercase">Bus {i + 1}</span>
                    <span className="font-semibold text-surface-900">{l.origin_city} → {l.destination_city}</span>
                  </div>
                  <div className="flex justify-between text-xs text-surface-500 mt-0.5">
                    <span>Seats {(seatsByLeg[i] || []).join(", ")}</span>
                    <span>৳ {Number(l.fare_amount) * (seatsByLeg[i]?.length || 0)}</span>
                  </div>
                  {i < legs.length - 1 && itinerary.transfers?.[i] && (
                    <div className="flex items-center gap-1 text-[11px] text-amber-700 mt-1"><Arrow className="h-3 w-3" /> Change at {itinerary.transfers[i].city} · wait {itinerary.transfers[i].wait_minutes} min</div>
                  )}
                </div>
              ))}
            </div>
            <div className="border-t border-surface-200 mt-4 pt-3 space-y-2 text-sm">
              <div className="flex justify-between text-surface-600"><span>Segment fares</span><span>৳ {totalFare.toLocaleString()}</span></div>
              {operatorDiscount > 0 && <div className="flex justify-between text-emerald-700"><span>Through-service discount</span><span>− ৳ {operatorDiscount.toLocaleString()}</span></div>}
              <div className="flex justify-between border-t border-surface-100 pt-2 text-base">
                <span className="font-bold text-surface-900">One-payment total</span>
                <span className="font-extrabold text-brand-600">৳ {payableFare.toLocaleString()}</span>
              </div>
            </div>
            <button type="submit" disabled={submitting} className="btn-primary w-full flex items-center justify-center gap-2 !py-3 mt-4 disabled:opacity-50">
              {submitting ? "Locking seats..." : <>Continue to Payment <ArrowRight className="h-4 w-4" /></>}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
