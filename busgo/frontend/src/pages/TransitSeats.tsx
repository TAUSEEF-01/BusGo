import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { ArrowRight, ArrowLeft, Bus, Info, MapPin, Clock } from "lucide-react";
import { apiClient } from "../api/client";
import { toast } from "react-hot-toast";

type SeatStatus = "available" | "booked" | "selected";
interface Seat { id: string; row: number; col: number; status: SeatStatus; }

function toSeats(dbSeats: any[], selectedIds: string[]): Seat[] {
  if (!dbSeats || dbSeats.length === 0) {
    const seats: Seat[] = [];
    for (let row = 0; row < 10; row++)
      for (let col = 0; col < 4; col++)
        seats.push({ id: `${String.fromCharCode(65 + row)}${col + 1}`, row, col, status: "available" });
    return seats.map((s) => (selectedIds.includes(s.id) ? { ...s, status: "selected" } : s));
  }
  return dbSeats.map((s: any) => {
    const rowChar = s.seat_number.charAt(0).toUpperCase();
    const row = rowChar.charCodeAt(0) - 65;
    const col = parseInt(s.seat_number.substring(1), 10) - 1;
    let status: SeatStatus = s.status === "BOOKED" || s.status === "LOCKED" ? "booked" : "available";
    if (selectedIds.includes(s.seat_number)) status = "selected";
    return { id: s.seat_number, row, col, status };
  });
}

function SeatGrid({ seats, onToggle, loading }: { seats: Seat[]; onToggle: (id: string) => void; loading: boolean }) {
  return (
    <div className="max-w-sm mx-auto">
      <div className="flex items-center justify-between mb-4 px-4">
        <span className="text-xs text-surface-400 font-medium">FRONT</span>
        <div className="w-10 h-10 rounded-xl bg-surface-200 flex items-center justify-center"><Bus className="h-5 w-5 text-surface-500" /></div>
      </div>
      <div className="border-2 border-surface-200 rounded-2xl p-4 bg-surface-50/50">
        {loading ? (
          <div className="flex justify-center items-center h-64"><div className="w-10 h-10 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin" /></div>
        ) : (
          <div className="space-y-2">
            {Array.from({ length: 10 }).map((_, row) => {
              const rowSeats = seats.filter((s) => s.row === row).sort((a, b) => a.col - b.col);
              return (
                <div key={row} className="flex items-center justify-center gap-2">
                  <div className="flex gap-2">
                    {rowSeats.slice(0, 2).map((s) => (
                      <button key={s.id} onClick={() => onToggle(s.id)} disabled={s.status === "booked"} className={`seat seat-${s.status}`} title={s.id}>{s.id}</button>
                    ))}
                  </div>
                  <div className="w-8" />
                  <div className="flex gap-2">
                    {rowSeats.slice(2, 4).map((s) => (
                      <button key={s.id} onClick={() => onToggle(s.id)} disabled={s.status === "booked"} className={`seat seat-${s.status}`} title={s.id}>{s.id}</button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      <div className="text-center mt-3"><span className="text-xs text-surface-400 font-medium">REAR</span></div>
    </div>
  );
}

export function TransitSeats() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state || {};
  const itinerary = state.itinerary;
  const legs: any[] = itinerary?.legs || [];

  const [passengerCount, setPassengerCount] = useState<number>(1);
  const [started, setStarted] = useState(false);
  const [step, setStep] = useState(0); // current leg index
  const [seatsByLeg, setSeatsByLeg] = useState<Seat[][]>([]);
  const [selectedByLeg, setSelectedByLeg] = useState<string[][]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!itinerary) {
      toast.error("No itinerary selected");
      navigate("/search");
    }
  }, [itinerary]);

  // Fetch seats for the current leg.
  useEffect(() => {
    if (!started || !legs[step]) return;
    (async () => {
      setLoading(true);
      try {
        const res = await apiClient.get(`/api/inventory/trips/${legs[step].trip_id}/seats?_t=${Date.now()}`);
        const db = res.data.success ? res.data.data : [];
        setSeatsByLeg((prev) => {
          const next = [...prev];
          next[step] = toSeats(db, selectedByLeg[step] || []);
          return next;
        });
      } catch {
        setSeatsByLeg((prev) => { const n = [...prev]; n[step] = toSeats([], selectedByLeg[step] || []); return n; });
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, step]);

  const currentSeats = seatsByLeg[step] || [];
  const currentSelected = currentSeats.filter((s) => s.status === "selected");

  const toggle = (id: string) => {
    setSeatsByLeg((prev) => {
      const next = [...prev];
      const seats = [...(next[step] || [])];
      const t = seats.find((s) => s.id === id);
      if (!t || t.status === "booked") return prev;
      if (t.status !== "selected") {
        const count = seats.filter((s) => s.status === "selected").length;
        if (count >= passengerCount) { toast.error(`Select exactly ${passengerCount} seat(s) per bus.`); return prev; }
      }
      next[step] = seats.map((s) => (s.id === id ? { ...s, status: s.status === "selected" ? "available" : "selected" } : s));
      return next;
    });
  };

  const proceed = () => {
    if (currentSelected.length !== passengerCount) {
      toast.error(`Select exactly ${passengerCount} seat(s) on this bus.`);
      return;
    }
    const selIds = currentSelected.map((s) => s.id);
    const nextSel = [...selectedByLeg];
    nextSel[step] = selIds;
    setSelectedByLeg(nextSel);

    if (step < legs.length - 1) {
      setStep(step + 1);
    } else {
      // All legs done → passenger details
      navigate("/booking/transit-passengers", {
        state: { itinerary, origin: state.origin, destination: state.destination, date: state.date,
                 passengerCount, seatsByLeg: nextSel },
      });
    }
  };

  const back = () => {
    if (step > 0) setStep(step - 1);
    else setStarted(false);
  };

  if (!itinerary) return null;

  return (
    <div className="min-h-screen bg-surface-50">
      <div className="bg-white border-b border-surface-200 shadow-elevation-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <h1 className="font-bold text-surface-900 flex items-center gap-2">
            <MapPin className="h-4 w-4 text-brand-600" /> {state.origin} → {state.destination}
            <span className="text-xs font-normal text-surface-500">· {legs.length}-bus connecting journey</span>
          </h1>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8">
        {!started ? (
          <div className="card-premium p-8 text-center">
            <h2 className="text-lg font-bold text-surface-900 mb-2">How many passengers?</h2>
            <p className="text-sm text-surface-500 mb-6">You'll pick the same number of seats on each of the {legs.length} buses.</p>
            <div className="flex justify-center gap-3 mb-8">
              {[1, 2, 3, 4].map((n) => (
                <button key={n} onClick={() => setPassengerCount(n)}
                  className={`w-14 h-14 rounded-xl border-2 font-bold text-lg ${passengerCount === n ? "border-brand-500 bg-brand-50 text-brand-700" : "border-surface-200 text-surface-600"}`}>{n}</button>
              ))}
            </div>
            <button onClick={() => setStarted(true)} className="btn-primary inline-flex items-center gap-2">Pick seats <ArrowRight className="h-4 w-4" /></button>
          </div>
        ) : (
          <>
            {/* Leg stepper */}
            <div className="flex items-center gap-2 mb-6">
              {legs.map((l, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className={`px-3 py-1.5 rounded-full text-xs font-semibold ${i === step ? "bg-brand-600 text-white" : i < step ? "bg-emerald-100 text-emerald-700" : "bg-surface-100 text-surface-500"}`}>
                    Bus {i + 1}: {l.origin_city}→{l.destination_city}
                  </div>
                  {i < legs.length - 1 && <ArrowRight className="h-3 w-3 text-surface-300" />}
                </div>
              ))}
            </div>

            <div className="card-premium p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="font-bold text-surface-900">Bus {step + 1}: {legs[step].operator_name}</h2>
                  <p className="text-xs text-surface-500 flex items-center gap-1"><Clock className="h-3 w-3" />{legs[step].origin_city} → {legs[step].destination_city} · ৳{legs[step].fare_amount}/seat</p>
                </div>
                <span className="text-sm font-semibold text-brand-600">{currentSelected.length}/{passengerCount} seats</span>
              </div>

              <div className="flex flex-wrap items-center gap-4 mb-6 p-3 bg-surface-50 rounded-xl">
                {[["seat-available", "Available"], ["seat-selected", "Selected"], ["seat-booked", "Booked"]].map(([cls, label]) => (
                  <div key={label} className="flex items-center gap-2"><div className={`w-6 h-6 rounded ${cls}`} /><span className="text-xs font-medium text-surface-600">{label}</span></div>
                ))}
              </div>

              <SeatGrid seats={currentSeats} onToggle={toggle} loading={loading} />

              <div className="flex items-center justify-between mt-6 pt-4 border-t border-surface-200">
                <button onClick={back} className="flex items-center gap-1 text-sm font-semibold text-surface-600 hover:text-surface-900"><ArrowLeft className="h-4 w-4" /> Back</button>
                <button onClick={proceed} disabled={currentSelected.length !== passengerCount}
                  className="btn-primary flex items-center gap-2 disabled:opacity-50">
                  {step < legs.length - 1 ? <>Next bus <ArrowRight className="h-4 w-4" /></> : <>Continue <ArrowRight className="h-4 w-4" /></>}
                </button>
              </div>
            </div>

            <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-xl border border-amber-200 text-sm mt-4">
              <Info className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <p className="text-amber-700">All buses in this journey are booked together and held for 10 minutes. If any leg's seats are unavailable, nothing is booked.</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
