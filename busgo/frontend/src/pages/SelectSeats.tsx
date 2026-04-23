import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowRight, Bus, Clock, MapPin, Star, Info, X } from "lucide-react";

/* ─── Seat Layout ──────────────────────────────────── */
type SeatStatus = "available" | "booked" | "ladies" | "selected";

interface Seat {
  id: string;
  row: number;
  col: number;
  status: SeatStatus;
}

function generateSeats(): Seat[] {
  const seats: Seat[] = [];
  const bookedIds = new Set(["A1", "A2", "B3", "C1", "D2", "E4", "F1", "F3", "G2", "H1", "H4"]);
  const ladiesIds = new Set(["B1", "B2", "C3", "C4"]);

  for (let row = 0; row < 10; row++) {
    const rowLetter = String.fromCharCode(65 + row);
    for (let col = 0; col < 4; col++) {
      const id = `${rowLetter}${col + 1}`;
      seats.push({
        id,
        row,
        col,
        status: bookedIds.has(id) ? "booked" : ladiesIds.has(id) ? "ladies" : "available",
      });
    }
  }
  return seats;
}

export function SelectSeats() {
  const { trip_id } = useParams();
  const navigate = useNavigate();
  const [seats, setSeats] = useState<Seat[]>(generateSeats);
  const selected = seats.filter((s) => s.status === "selected");
  const pricePerSeat = 850;

  const toggleSeat = (id: string) => {
    setSeats((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s;
        if (s.status === "booked") return s;
        if (s.status === "selected") return { ...s, status: "available" };
        if (s.status === "ladies") return { ...s, status: "selected" };
        return { ...s, status: "selected" };
      })
    );
  };

  const removeSeat = (id: string) => {
    setSeats((prev) =>
      prev.map((s) => (s.id === id ? { ...s, status: "available" } : s))
    );
  };

  return (
    <div className="min-h-screen bg-surface-50" id="select-seats-page">
      {/* Header */}
      <div className="bg-white border-b border-surface-200 shadow-elevation-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-surface-800 to-surface-900 flex items-center justify-center text-white text-xs font-bold">GP</div>
            <div>
              <h1 className="font-bold text-surface-900">Greenline Paribahan</h1>
              <div className="flex items-center gap-3 text-sm text-surface-500">
                <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> Dhaka → Chittagong</span>
                <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> 08:00 AM</span>
                <span className="flex items-center gap-1"><Star className="h-3.5 w-3.5 text-accent-400 fill-accent-400" /> 4.8</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* ── Seat Map ── */}
          <div className="flex-1">
            <div className="card-premium p-6 sm:p-8">
              <h2 className="text-lg font-bold text-surface-900 mb-6">Choose Your Seats</h2>

              {/* Legend */}
              <div className="flex flex-wrap items-center gap-4 mb-8 p-3 bg-surface-50 rounded-xl">
                {[
                  { cls: "seat-available", label: "Available" },
                  { cls: "seat-selected", label: "Selected" },
                  { cls: "seat-booked", label: "Booked" },
                  { cls: "seat-ladies", label: "Ladies" },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-2">
                    <div className={`w-6 h-6 rounded ${item.cls}`} />
                    <span className="text-xs font-medium text-surface-600">{item.label}</span>
                  </div>
                ))}
              </div>

              {/* Bus Container */}
              <div className="max-w-sm mx-auto">
                {/* Driver area */}
                <div className="flex items-center justify-between mb-4 px-4">
                  <span className="text-xs text-surface-400 font-medium">FRONT</span>
                  <div className="w-10 h-10 rounded-xl bg-surface-200 flex items-center justify-center">
                    <Bus className="h-5 w-5 text-surface-500" />
                  </div>
                </div>

                {/* Seat Grid */}
                <div className="border-2 border-surface-200 rounded-2xl p-4 bg-surface-50/50">
                  <div className="space-y-2">
                    {Array.from({ length: 10 }).map((_, row) => {
                      const rowSeats = seats.filter((s) => s.row === row);
                      return (
                        <div key={row} className="flex items-center justify-center gap-2">
                          {/* Left 2 seats */}
                          <div className="flex gap-2">
                            {rowSeats.slice(0, 2).map((s) => (
                              <button
                                key={s.id}
                                onClick={() => toggleSeat(s.id)}
                                disabled={s.status === "booked"}
                                className={`seat seat-${s.status}`}
                                title={s.id}
                                id={`seat-${s.id}`}
                              >
                                {s.id}
                              </button>
                            ))}
                          </div>
                          {/* Aisle */}
                          <div className="w-8" />
                          {/* Right 2 seats */}
                          <div className="flex gap-2">
                            {rowSeats.slice(2, 4).map((s) => (
                              <button
                                key={s.id}
                                onClick={() => toggleSeat(s.id)}
                                disabled={s.status === "booked"}
                                className={`seat seat-${s.status}`}
                                title={s.id}
                                id={`seat-${s.id}`}
                              >
                                {s.id}
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="text-center mt-3">
                  <span className="text-xs text-surface-400 font-medium">REAR</span>
                </div>
              </div>
            </div>
          </div>

          {/* ── Booking Summary ── */}
          <div className="lg:w-80">
            <div className="lg:sticky lg:top-24 space-y-4">
              <div className="card-premium p-6">
                <h3 className="font-bold text-surface-900 mb-4">Booking Summary</h3>

                {/* Route */}
                <div className="flex items-center gap-2 p-3 bg-surface-50 rounded-xl mb-4 text-sm">
                  <div className="text-center">
                    <p className="font-bold text-surface-900">08:00</p>
                    <p className="text-xs text-surface-500">Dhaka</p>
                  </div>
                  <div className="flex-1 flex items-center px-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-brand-500" />
                    <div className="flex-1 h-px bg-surface-300 mx-1" />
                    <div className="w-1.5 h-1.5 rounded-full bg-brand-500" />
                  </div>
                  <div className="text-center">
                    <p className="font-bold text-surface-900">13:30</p>
                    <p className="text-xs text-surface-500">Chittagong</p>
                  </div>
                </div>

                {/* Selected Seats */}
                {selected.length > 0 ? (
                  <>
                    <div className="space-y-2 mb-4">
                      {selected.map((s) => (
                        <div key={s.id} className="flex items-center justify-between py-2 px-3 bg-blue-50 rounded-lg">
                          <span className="text-sm font-semibold text-blue-700">Seat {s.id}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-surface-900">৳ {pricePerSeat}</span>
                            <button onClick={() => removeSeat(s.id)} className="p-0.5 hover:bg-blue-100 rounded text-blue-400 hover:text-red-500 transition-colors">
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="border-t border-surface-200 pt-3 mb-4">
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-surface-500">Subtotal ({selected.length} seats)</span>
                        <span className="font-semibold text-surface-900">৳ {selected.length * pricePerSeat}</span>
                      </div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-surface-500">Service fee</span>
                        <span className="font-semibold text-surface-900">৳ 20</span>
                      </div>
                      <div className="flex justify-between text-base mt-3 pt-3 border-t border-surface-200">
                        <span className="font-bold text-surface-900">Total</span>
                        <span className="font-extrabold text-brand-600 text-lg">৳ {selected.length * pricePerSeat + 20}</span>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="py-8 text-center">
                    <Info className="h-8 w-8 text-surface-300 mx-auto mb-2" />
                    <p className="text-sm text-surface-500">Click on available seats to select them</p>
                  </div>
                )}

                <button
                  onClick={() => selected.length > 0 && navigate("/booking/passengers")}
                  disabled={selected.length === 0}
                  className="btn-primary w-full flex items-center justify-center gap-2 !py-3 disabled:opacity-50 disabled:cursor-not-allowed"
                  id="continue-to-passengers"
                >
                  Continue <ArrowRight className="h-4 w-4" />
                </button>
              </div>

              {/* Info Notice */}
              <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-xl border border-amber-200 text-sm">
                <Info className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                <p className="text-amber-700">Selected seats are held for 10 minutes. Complete your booking before the timer expires.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
