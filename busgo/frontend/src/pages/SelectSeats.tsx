import { useState, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { ArrowRight, Bus, Clock, MapPin, Star, Info, X, ChevronDown } from "lucide-react";
import { apiClient } from "../api/client";
import { toast } from "react-hot-toast";

/* ─── Seat Layout ──────────────────────────────────── */
type SeatStatus = "available" | "booked" | "ladies" | "selected";

const MAX_SEATS = 4;

interface Seat {
  id: string;
  row: number;
  col: number;
  status: SeatStatus;
}

interface RoutePoint {
  name: string;
  address?: string;
  lat?: number;
  lng?: number;
}

function generateDefaultLayout(): Seat[] {
  const seats: Seat[] = [];
  for (let row = 0; row < 10; row++) {
    const rowLetter = String.fromCharCode(65 + row);
    for (let col = 0; col < 4; col++) {
      const id = `${rowLetter}${col + 1}`;
      seats.push({
        id,
        row,
        col,
        status: "available",
      });
    }
  }
  return seats;
}

export function SelectSeats() {
  const { trip_id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state || {};
  const [seats, setSeats] = useState<Seat[]>([]);
  const [tripDetails, setTripDetails] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [boardingPoint, setBoardingPoint] = useState<string>("");
  const [droppingPoint, setDroppingPoint] = useState<string>("");
  const selected = seats.filter((s) => s.status === "selected");
  const pricePerSeat = state.price || tripDetails?.fare_amount || 850;

  const boardingPoints: RoutePoint[] = tripDetails?.boarding_points || [];
  const droppingPoints: RoutePoint[] = tripDetails?.dropping_points || [];
  const selectedBoarding = boardingPoints.find((p) => p.name === boardingPoint);
  const selectedDropping = droppingPoints.find((p) => p.name === droppingPoint);

  useEffect(() => {
    if (trip_id) {
      fetchSeats();
      fetchTripDetails();
    }
  }, [trip_id]);

  const fetchTripDetails = async () => {
    try {
      const res = await apiClient.get(`/api/operators/trips/${trip_id}?_t=${Date.now()}`);
      if (res.data.success) {
        const data = res.data.data;
        setTripDetails(data);
        if (data.boarding_points?.length > 0) setBoardingPoint(data.boarding_points[0].name);
        if (data.dropping_points?.length > 0) setDroppingPoint(data.dropping_points[0].name);
      }
    } catch (err) {
      console.error("Failed to fetch trip details", err);
    }
  };

  const fetchSeats = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get(`/api/inventory/trips/${trip_id}/seats?_t=${Date.now()}`);
      if (res.data.success && res.data.data && res.data.data.length > 0) {
        const dbSeats = res.data.data.map((s: any) => {
          const rowChar = s.seat_number.charAt(0).toUpperCase();
          const colStr = s.seat_number.substring(1);
          const row = rowChar.charCodeAt(0) - 65;
          const col = parseInt(colStr, 10) - 1;
          
          let frontendStatus: SeatStatus = "available";
          if (s.status === "BOOKED" || s.status === "LOCKED") {
             frontendStatus = "booked";
          }
          
          return {
            id: s.seat_number,
            row,
            col,
            status: frontendStatus
          };
        });
        setSeats(dbSeats);
      } else {
        setSeats(generateDefaultLayout());
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to fetch seat map.");
      setSeats(generateDefaultLayout());
    } finally {
      setLoading(false);
    }
  };

  const toggleSeat = (id: string) => {
    setSeats((prev) => {
      const target = prev.find((s) => s.id === id);
      if (!target || target.status === "booked") return prev;

      // Deselecting is always allowed
      const isSelecting = target.status !== "selected";
      if (isSelecting) {
        const selectedCount = prev.filter((s) => s.status === "selected").length;
        if (selectedCount >= MAX_SEATS) {
          toast.error(`Maximum ${MAX_SEATS} seats can be selected.`);
          return prev;
        }
      }

      return prev.map((s) => {
        if (s.id !== id) return s;
        if (s.status === "selected") return { ...s, status: "available" };
        return { ...s, status: "selected" };
      });
    });
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
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-surface-800 to-surface-900 flex items-center justify-center text-white text-xs font-bold">
              {(state.operator || tripDetails?.operator_name || "Greenline Paribahan").split(" ").map((w: string) => w[0]).join("").slice(0,2)}
            </div>
            <div>
              <h1 className="font-bold text-surface-900">{state.operator || tripDetails?.operator_name || "Greenline Paribahan"}</h1>
              <div className="flex items-center gap-3 text-sm text-surface-500">
                <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {state.origin || tripDetails?.origin_city || "Dhaka"} → {state.destination || tripDetails?.destination_city || "Chittagong"}</span>
                <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {state.departureTime || (tripDetails?.departure_datetime ? new Date(tripDetails.departure_datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }) : "08:00 AM")}</span>
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

              {/* Max seats notice */}
              <div className="flex items-center justify-center mb-6 p-3 bg-amber-50 rounded-xl border border-amber-200">
                <Info className="h-4 w-4 text-amber-600 mr-2 flex-shrink-0" />
                <span className="text-sm font-medium text-amber-700">Maximum {MAX_SEATS} seats can be selected.</span>
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
                  {loading ? (
                    <div className="flex justify-center items-center h-64">
                      <div className="w-10 h-10 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin"></div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {Array.from({ length: 10 }).map((_, row) => {
                        const rowSeats = seats.filter((s) => s.row === row).sort((a, b) => a.col - b.col);
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
                  )}
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
                    <p className="font-bold text-surface-900">{state.departureTime || (tripDetails?.departure_datetime ? new Date(tripDetails.departure_datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }) : "08:00 AM")}</p>
                    <p className="text-xs text-surface-500">{state.origin || tripDetails?.origin_city || "Dhaka"}</p>
                  </div>
                  <div className="flex-1 flex items-center px-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-brand-500" />
                    <div className="flex-1 h-px bg-surface-300 mx-1" />
                    <div className="w-1.5 h-1.5 rounded-full bg-brand-500" />
                  </div>
                  <div className="text-center">
                    <p className="font-bold text-surface-900">{state.arrivalTime || (tripDetails?.arrival_datetime ? new Date(tripDetails.arrival_datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }) : "13:30")}</p>
                    <p className="text-xs text-surface-500">{state.destination || tripDetails?.destination_city || "Chittagong"}</p>
                  </div>
                </div>

                {/* Boarding & Dropping Points */}
                {(boardingPoints.length > 0 || droppingPoints.length > 0) && (
                  <div className="rounded-xl border border-surface-200 divide-y divide-surface-200 mb-4 overflow-hidden">
                    {/* Boarding */}
                    <div className="p-3">
                      <div className="flex items-center gap-1.5 mb-2">
                        <span className="flex items-center justify-center w-5 h-5 rounded-full bg-brand-50">
                          <MapPin className="h-3 w-3 text-brand-600" />
                        </span>
                        <span className="text-xs font-semibold text-surface-700 uppercase tracking-wide">Boarding Point</span>
                      </div>
                      <div className="relative">
                        <select
                          value={boardingPoint}
                          onChange={(e) => setBoardingPoint(e.target.value)}
                          className="w-full appearance-none pl-3 pr-9 py-2.5 text-sm font-medium text-surface-900 rounded-lg border border-surface-200 bg-surface-50 hover:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent cursor-pointer transition-colors truncate"
                          id="boarding-point-select"
                        >
                          {boardingPoints.length === 0 && <option value="">Not available</option>}
                          {boardingPoints.map((p, i) => (
                            <option key={`b-${i}`} value={p.name}>{p.name}</option>
                          ))}
                        </select>
                        <ChevronDown className="h-4 w-4 text-surface-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      </div>
                      {selectedBoarding?.address && (
                        <p className="mt-1.5 text-xs text-surface-500 leading-snug line-clamp-2">{selectedBoarding.address}</p>
                      )}
                    </div>

                    {/* Dropping */}
                    <div className="p-3">
                      <div className="flex items-center gap-1.5 mb-2">
                        <span className="flex items-center justify-center w-5 h-5 rounded-full bg-red-50">
                          <MapPin className="h-3 w-3 text-red-500" />
                        </span>
                        <span className="text-xs font-semibold text-surface-700 uppercase tracking-wide">Dropping Point</span>
                      </div>
                      <div className="relative">
                        <select
                          value={droppingPoint}
                          onChange={(e) => setDroppingPoint(e.target.value)}
                          className="w-full appearance-none pl-3 pr-9 py-2.5 text-sm font-medium text-surface-900 rounded-lg border border-surface-200 bg-surface-50 hover:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent cursor-pointer transition-colors truncate"
                          id="dropping-point-select"
                        >
                          {droppingPoints.length === 0 && <option value="">Not available</option>}
                          {droppingPoints.map((p, i) => (
                            <option key={`d-${i}`} value={p.name}>{p.name}</option>
                          ))}
                        </select>
                        <ChevronDown className="h-4 w-4 text-surface-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      </div>
                      {selectedDropping?.address && (
                        <p className="mt-1.5 text-xs text-surface-500 leading-snug line-clamp-2">{selectedDropping.address}</p>
                      )}
                    </div>
                  </div>
                )}

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
                  onClick={() => {
                    if (selected.length === 0) return;
                    if (boardingPoints.length > 0 && !boardingPoint) {
                      toast.error("Please select a boarding point.");
                      return;
                    }
                    if (droppingPoints.length > 0 && !droppingPoint) {
                      toast.error("Please select a dropping point.");
                      return;
                    }
                    navigate("/booking/passengers", {
                      state: {
                        trip_id: trip_id,
                        operator_id: state.operator_id || tripDetails?.operator_id,
                        seats: selected.map((s) => s.id),
                        totalFare: selected.length * pricePerSeat + 20,
                        origin: state.origin || tripDetails?.origin_city || "Dhaka",
                        destination: state.destination || tripDetails?.destination_city || "Chittagong",
                        boardingPoint: boardingPoint || undefined,
                        droppingPoint: droppingPoint || undefined,
                        date: state.date || (tripDetails?.departure_datetime ? tripDetails.departure_datetime.split('T')[0] : "2026-05-01"),
                        departureTime: state.departureTime || (tripDetails?.departure_datetime ? new Date(tripDetails.departure_datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }) : "08:00 AM"),
                        operator: state.operator || tripDetails?.operator_name || "Greenline Paribahan"
                      },
                    });
                  }}
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
                <div className="text-amber-700">
                  <p className="font-semibold mb-1">Seat Reservation Policy</p>
                  <p>Selected seats are held for 10 minutes. You must complete payment within this time to confirm your booking. Unpaid bookings will be automatically cancelled and seats released.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
