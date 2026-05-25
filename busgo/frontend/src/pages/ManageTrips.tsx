import { useState, useEffect } from "react";
import { Bus, Map, Clock, Plus, Loader2, X, Edit2, Trash2, Eye, Calendar, Users, ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { apiClient } from "../api/client";
import { toast } from "react-hot-toast";

import { useAuthStore } from "../stores/authStore";

interface SeatInfo {
  id: string;
  trip_id: string;
  seat_number: string;
  seat_type: string;
  status: string;
  locked_by_booking_id: string | null;
  booked_by_user_id: string | null;
}

interface PassengerDetail {
  name: string;
  age: number;
  gender: string;
  seat: string;
}

interface BookingInfo {
  id: string;
  user_id: string;
  seat_numbers: string[];
  passenger_details: PassengerDetail[];
  total_fare: number;
  status: string;
  created_at: string;
}

function TripDetailsModal({
  trip,
  routeLabel,
  busLabel,
  onClose,
}: {
  trip: any;
  routeLabel: string;
  busLabel: string;
  onClose: () => void;
}) {
  const [activeTab, setActiveTab] = useState<"overview" | "seats" | "passengers">("overview");
  const [seats, setSeats] = useState<SeatInfo[]>([]);
  const [bookings, setBookings] = useState<BookingInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTripData = async () => {
      try {
        const [seatsRes, bookingsRes] = await Promise.all([
          apiClient.get(`/api/inventory/trips/${trip.id}/seats`),
          apiClient.get(`/api/bookings/trip/${trip.id}`)
        ]);
        if (seatsRes.data.success) {
          setSeats(seatsRes.data.data);
        }
        if (bookingsRes.data.success) {
          setBookings(bookingsRes.data.data);
        }
      } catch (err) {
        console.error("Failed to fetch trip details", err);
        toast.error("Failed to load trip details");
      } finally {
        setLoading(false);
      }
    };
    fetchTripData();
  }, [trip.id]);

  // Group seats into rows
  const seatsByRow: Record<string, SeatInfo[]> = {};
  seats.forEach((s) => {
    const row = s.seat_number.replace(/[0-9]/g, "");
    if (!seatsByRow[row]) seatsByRow[row] = [];
    seatsByRow[row].push(s);
  });

  const sortedRows = Object.keys(seatsByRow).sort();
  sortedRows.forEach((row) => {
    seatsByRow[row].sort((a, b) => {
      const numA = parseInt(a.seat_number.replace(/\D/g, ""));
      const numB = parseInt(b.seat_number.replace(/\D/g, ""));
      return numA - numB;
    });
  });

  const totalSeats = seats.length;
  const bookedSeats = seats.filter((s) => s.status === "BOOKED").length;
  const lockedSeats = seats.filter((s) => s.status === "LOCKED").length;
  const availableSeats = seats.filter((s) => s.status === "AVAILABLE").length;

  const passengers = bookings.flatMap(b => 
    b.passenger_details.map(p => ({
      ...p,
      bookingId: b.id,
      status: b.status,
      userId: b.user_id
    }))
  );

  return (
    <div className="fixed inset-0 z-[60] bg-surface-900/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-3xl overflow-hidden shadow-elevation-3 animate-fade-in flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-surface-100 flex justify-between items-center bg-gradient-to-r from-brand-600 to-brand-700 shrink-0">
          <div>
            <h3 className="font-bold text-lg text-white">Trip Details</h3>
            <p className="text-brand-100 text-sm">{routeLabel} | {busLabel}</p>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex border-b border-surface-100 bg-surface-50 shrink-0">
          {[
            { id: "overview", label: "Overview", icon: Clock },
            { id: "seats", label: "Seat Map", icon: Map },
            { id: "passengers", label: "Passenger List", icon: Users },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold border-b-2 transition-all ${
                activeTab === tab.id
                  ? "border-brand-600 text-brand-600 bg-white"
                  : "border-transparent text-surface-500 hover:text-surface-700 hover:bg-surface-100/50"
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-brand-600" /></div>
          ) : (
            <div className="p-6">
              {activeTab === "overview" && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl border border-surface-100 bg-surface-50/50">
                      <p className="text-xs font-bold text-surface-400 uppercase tracking-wider mb-3">Schedule Information</p>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-surface-500">Departure</span>
                          <span className="text-sm font-bold text-surface-900">{new Date(trip.departure_datetime).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-surface-500">Arrival (Est.)</span>
                          <span className="text-sm font-bold text-surface-900">{new Date(trip.arrival_datetime).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-surface-500">Route</span>
                          <span className="text-sm font-bold text-surface-900">{routeLabel}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-surface-500">Bus Registration</span>
                          <span className="text-sm font-bold text-surface-900">{busLabel}</span>
                        </div>
                      </div>
                    </div>
                    <div className="p-4 rounded-xl border border-surface-100 bg-surface-50/50">
                      <p className="text-xs font-bold text-surface-400 uppercase tracking-wider mb-3">Pricing & Status</p>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-surface-500">Fare Amount</span>
                          <span className="text-sm font-bold text-brand-600">৳ {trip.fare_amount}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-surface-500">Available Seats</span>
                          <span className="text-sm font-bold text-emerald-600">{trip.available_seats} / {totalSeats}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-surface-500">Trip Status</span>
                          <span className="badge badge-info">{trip.status}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-surface-500">Total Bookings</span>
                          <span className="text-sm font-bold text-surface-900">{bookings.length}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-3">
                    <div className="text-center p-3 rounded-xl bg-surface-50 border border-surface-100">
                      <p className="text-xl font-extrabold text-surface-900">{totalSeats}</p>
                      <p className="text-[11px] font-semibold text-surface-500 uppercase tracking-wider">Total</p>
                    </div>
                    <div className="text-center p-3 rounded-xl bg-emerald-50 border border-emerald-100">
                      <p className="text-xl font-extrabold text-emerald-700">{availableSeats}</p>
                      <p className="text-[11px] font-semibold text-emerald-600 uppercase tracking-wider">Available</p>
                    </div>
                    <div className="text-center p-3 rounded-xl bg-red-50 border border-red-100">
                      <p className="text-xl font-extrabold text-red-700">{bookedSeats}</p>
                      <p className="text-[11px] font-semibold text-red-600 uppercase tracking-wider">Booked</p>
                    </div>
                    <div className="text-center p-3 rounded-xl bg-amber-50 border border-amber-100">
                      <p className="text-xl font-extrabold text-amber-700">{lockedSeats}</p>
                      <p className="text-[11px] font-semibold text-amber-600 uppercase tracking-wider">Locked</p>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "seats" && (
                <div>
                  <div className="flex items-center gap-5 mb-4 text-xs font-semibold text-surface-600">
                    <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded bg-emerald-100 border-2 border-emerald-400 inline-block"></span> Available</span>
                    <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded bg-red-500 border-2 border-red-600 inline-block"></span> Booked</span>
                    <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded bg-amber-400 border-2 border-amber-500 inline-block"></span> Locked</span>
                  </div>

                  <div className="bg-surface-50 rounded-xl p-6 border border-surface-100 max-w-md mx-auto">
                    <div className="flex flex-col gap-4">
                      {sortedRows.map((row) => (
                        <div key={row} className="flex items-center gap-4">
                          <span className="w-6 text-sm font-bold text-surface-400 text-center">{row}</span>
                          <div className="flex gap-3 flex-wrap">
                            {seatsByRow[row].map((seat) => {
                              const isBooked = seat.status === "BOOKED";
                              const isLocked = seat.status === "LOCKED";
                              return (
                                <div 
                                  key={seat.id} 
                                  title={isBooked ? "Booked" : isLocked ? "Locked" : "Available"}
                                  className={`w-12 h-12 rounded-xl flex items-center justify-center text-sm font-bold transition-all duration-200 border-2 ${
                                    isBooked ? "bg-red-500 border-red-600 text-white shadow-sm" : 
                                    isLocked ? "bg-amber-400 border-amber-500 text-amber-900 shadow-sm" : 
                                    "bg-emerald-100 border-emerald-400 text-emerald-700 hover:bg-emerald-200"
                                  }`}
                                >
                                  {seat.seat_number}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "passengers" && (
                <div className="space-y-4">
                  {passengers.length === 0 ? (
                    <div className="text-center py-12 bg-surface-50 rounded-2xl border border-dashed border-surface-200">
                      <Users className="w-12 h-12 text-surface-300 mx-auto mb-3" />
                      <p className="text-surface-500 font-medium">No passengers have booked seats for this trip yet.</p>
                    </div>
                  ) : (
                    <div className="overflow-hidden rounded-xl border border-surface-100 shadow-sm">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="bg-surface-50 border-b border-surface-100">
                            <th className="px-4 py-3 text-[11px] font-bold text-surface-500 uppercase">Passenger</th>
                            <th className="px-4 py-3 text-[11px] font-bold text-surface-500 uppercase text-center">Seat</th>
                            <th className="px-4 py-3 text-[11px] font-bold text-surface-500 uppercase">Gender/Age</th>
                            <th className="px-4 py-3 text-[11px] font-bold text-surface-500 uppercase text-right">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-surface-100">
                          {passengers.map((p, idx) => (
                            <tr key={`${p.bookingId}-${idx}`} className="hover:bg-surface-50/50 transition-colors">
                              <td className="px-4 py-3">
                                <p className="font-bold text-surface-900 text-sm">{p.name}</p>
                                <p className="text-[10px] text-surface-400 font-mono">ID: {p.bookingId.split('-')[0].toUpperCase()}</p>
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span className="inline-block px-2 py-1 rounded bg-brand-50 text-brand-700 text-xs font-bold border border-brand-100">
                                  {p.seat}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <span className="text-sm text-surface-600">{p.gender}, {p.age}y</span>
                              </td>
                              <td className="px-4 py-3 text-right">
                                <span className={`badge ${p.status === 'CONFIRMED' ? 'badge-success' : 'badge-amber'} text-[10px]`}>
                                  {p.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


function MultiDateCalendar({
  selectedDates,
  onChange,
}: {
  selectedDates: string[];
  onChange: (dates: string[]) => void;
}) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const formatDateString = (y: number, m: number, d: number) => {
    const mm = String(m + 1).padStart(2, "0");
    const dd = String(d).padStart(2, "0");
    return `${y}-${mm}-${dd}`;
  };

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayIndex = new Date(year, month, 1).getDay();

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const toggleDate = (dateStr: string) => {
    if (selectedDates.includes(dateStr)) {
      onChange(selectedDates.filter((d) => d !== dateStr));
    } else {
      onChange([...selectedDates, dateStr].sort());
    }
  };

  const dayCells = [];
  for (let i = 0; i < firstDayIndex; i++) {
    dayCells.push(<div key={`empty-${i}`} className="w-9 h-9" />);
  }
  
  const todayStr = new Date().toISOString().split("T")[0];
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = formatDateString(year, month, d);
    const isSelected = selectedDates.includes(dateStr);
    const isToday = dateStr === todayStr;
    
    dayCells.push(
      <button
        key={`day-${d}`}
        type="button"
        onClick={() => toggleDate(dateStr)}
        className={`w-9 h-9 text-xs font-bold rounded-lg flex items-center justify-center transition-all duration-150 ${
          isSelected
            ? "bg-brand-600 text-white shadow-sm ring-2 ring-brand-400"
            : isToday
            ? "bg-brand-50 text-brand-600 border border-brand-200 hover:bg-brand-100"
            : "text-surface-700 hover:bg-surface-100"
        }`}
      >
        {d}
      </button>
    );
  }

  const weekDays = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

  return (
    <div className="w-full bg-white border border-surface-200 rounded-2xl p-4 shadow-sm select-none">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-sm font-bold text-surface-900">
          {monthNames[month]} {year}
        </h4>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={handlePrevMonth}
            className="p-1.5 rounded-lg text-surface-500 hover:bg-surface-100 transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={handleNextMonth}
            className="p-1.5 rounded-lg text-surface-500 hover:bg-surface-100 transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-surface-400 uppercase tracking-wider mb-2">
        {weekDays.map((d) => (
          <div key={d} className="py-1">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {dayCells}
      </div>

      {selectedDates.length > 0 && (
        <div className="mt-4 pt-3 border-t border-surface-100 flex items-center justify-between text-xs text-surface-500">
          <span>Selected: <strong>{selectedDates.length}</strong> days</span>
          <button
            type="button"
            onClick={() => onChange([])}
            className="text-red-500 font-semibold hover:underline"
          >
            Clear All
          </button>
        </div>
      )}
    </div>
  );
}


export function ManageTrips() {
  const user = useAuthStore((s) => s.user);
  const OPERATOR_ID = user?.id || "";

  // Debug: Log operator ID on mount
  useEffect(() => {
    console.log("Current user:", user);
    console.log("Operator ID being used:", OPERATOR_ID);
  }, [user, OPERATOR_ID]);

  const [activeTab, setActiveTab] = useState("Trips");
  const [tripsSubTab, setTripsSubTab] = useState<"upcoming" | "past">("upcoming");
  const [buses, setBuses] = useState<any[]>([]);
  const [routes, setRoutes] = useState<any[]>([]);
  const [trips, setTrips] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [isAddBusOpen, setIsAddBusOpen] = useState(false);
  const [isAddTripOpen, setIsAddTripOpen] = useState(false);
  const [isAddRouteOpen, setIsAddRouteOpen] = useState(false);
  const [editingBusId, setEditingBusId] = useState<string | null>(null);
  const [editingRouteId, setEditingRouteId] = useState<string | null>(null);
  const [selectedTrip, setSelectedTrip] = useState<{ trip: any; routeLabel: string; busLabel: string } | null>(null);

  const combineDateAndTime = (timeStr: string) => {
    if (!timeStr) return "";
    const [hours, minutes] = timeStr.split(':');
    const date = new Date();
    date.setHours(parseInt(hours), parseInt(minutes), 0, 0);
    return date.toISOString();
  };

  const combineDateAndTimeToISO = (dateStr: string, timeStr: string) => {
    if (!dateStr || !timeStr) return "";
    const [year, month, day] = dateStr.split('-').map(Number);
    const [hours, minutes] = timeStr.split(':').map(Number);
    const date = new Date(year, month - 1, day, hours, minutes, 0, 0);
    return date.toISOString();
  };

  const calculateArrivalISO = (dateStr: string, depTimeStr: string, arrTimeStr: string) => {
    const depISO = combineDateAndTimeToISO(dateStr, depTimeStr);
    if (!depISO) return "";
    const depDate = new Date(depISO);
    const [arrHours, arrMinutes] = arrTimeStr.split(':').map(Number);
    const arrDate = new Date(depDate.getFullYear(), depDate.getMonth(), depDate.getDate(), arrHours, arrMinutes, 0, 0);
    if (arrDate < depDate) {
      arrDate.setDate(arrDate.getDate() + 1);
    }
    return arrDate.toISOString();
  };

  const [busSelectedDates, setBusSelectedDates] = useState<string[]>([]);
  const [tripSelectedDates, setTripSelectedDates] = useState<string[]>([]);

  // Filters
  const [tripFilterRoute, setTripFilterRoute] = useState("");
  const [tripFilterBus, setTripFilterBus] = useState("");
  const [tripFilterDate, setTripFilterDate] = useState("");

  const [busFilterSearch, setBusFilterSearch] = useState("");
  const [busFilterType, setBusFilterType] = useState("");

  const [routeFilterSearch, setRouteFilterSearch] = useState("");

  const openAddBus = () => {
    setBusForm({
      registration_no: "",
      bus_type: "AC",
      total_seats: 40,
      is_active: true,
      assign_route: false,
      route_id: "",
      departure_datetime: "",
      arrival_datetime: "",
      fare_amount: 1000,
    });
    setBusSelectedDates([]);
    setEditingBusId(null);
    setIsAddBusOpen(true);
  };

  const openEditBus = (bus: any) => {
    setBusForm({
      ...busForm,
      registration_no: bus.registration_no,
      bus_type: bus.bus_type,
      total_seats: bus.total_seats,
      is_active: bus.is_active !== undefined ? bus.is_active : true,
      assign_route: false,
    });
    setBusSelectedDates([]);
    setEditingBusId(bus.id);
    setIsAddBusOpen(true);
  };

  // Form States
  const [busForm, setBusForm] = useState({
    registration_no: "",
    bus_type: "AC",
    total_seats: 40,
    is_active: true,
    // Optional schedule fields
    assign_route: false,
    route_id: "",
    departure_datetime: "",
    arrival_datetime: "",
    fare_amount: 1000,
  });

  const [tripForm, setTripForm] = useState({
    bus_id: "",
    route_id: "",
    departure_datetime: "",
    arrival_datetime: "",
    fare_amount: 1000,
  });

  const [routeForm, setRouteForm] = useState({
    origin_city: "",
    destination_city: "",
    distance_km: 100,
    estimated_duration_hours: 2,
  });

  const openAddRoute = () => {
    setRouteForm({
      origin_city: "",
      destination_city: "",
      distance_km: 100,
      estimated_duration_hours: 2,
    });
    setEditingRouteId(null);
    setIsAddRouteOpen(true);
  };

  const openEditRoute = (route: any) => {
    setRouteForm({
      origin_city: route.origin_city,
      destination_city: route.destination_city,
      distance_km: route.distance_km,
      estimated_duration_hours: route.estimated_duration_hours,
    });
    setEditingRouteId(route.id);
    setIsAddRouteOpen(true);
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      console.log("Fetching data for operator:", OPERATOR_ID);
      const [busesRes, routesRes, tripsRes] = await Promise.all([
        apiClient.get(`/api/operators/operators/${OPERATOR_ID}/buses`),
        apiClient.get(`/api/operators/operators/${OPERATOR_ID}/routes`),
        apiClient.get(`/api/operators/trips/?operator_id=${OPERATOR_ID}`)
      ]);
      console.log("Buses response:", busesRes.data);
      console.log("Routes response:", routesRes.data);
      console.log("Trips response:", tripsRes.data);
      
      if (busesRes.data.success) setBuses(busesRes.data.data);
      if (routesRes.data.success) setRoutes(routesRes.data.data);
      if (tripsRes.data.success) setTrips(tripsRes.data.data);
    } catch (error) {
      console.error("Failed to fetch operator data", error);
      toast.error("Failed to load operator data. Please check console for details.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleDeleteBus = async (id: string) => {
    if (!confirm("Are you sure you want to remove this bus?")) return;
    try {
      const res = await apiClient.delete(`/api/operators/buses/${id}`);
      if (res.data.success) {
        toast.success("Bus removed successfully");
        fetchData();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Failed to remove bus");
    }
  };

  const handleDeleteRoute = async (id: string) => {
    if (!confirm("Are you sure you want to remove this route?")) return;
    try {
      const res = await apiClient.delete(`/api/operators/routes/${id}`);
      if (res.data.success) {
        toast.success("Route removed successfully");
        fetchData();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Failed to remove route");
    }
  };

  const handleDeleteTrip = async (id: string, availableSeats: number, totalSeats: number) => {
    if (availableSeats < totalSeats) {
      toast.error("Cannot delete trip because tickets have already been sold.");
      return;
    }
    if (!confirm("Are you sure you want to delete this scheduled trip?")) return;
    try {
      const res = await apiClient.delete(`/api/operators/trips/${id}`);
      if (res.data.success) {
        toast.success("Trip deleted successfully");
        fetchData();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Failed to delete trip");
    }
  };

  const handleAddBus = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        registration_no: busForm.registration_no,
        bus_type: busForm.bus_type,
        total_seats: busForm.total_seats,
        is_active: busForm.is_active,
        seat_layout: {}, // Minimal mock payload
        amenities: ["WiFi", "Water"]
      };

      let currentBusId = editingBusId;

      if (editingBusId) {
        const res = await apiClient.put(`/api/operators/buses/${editingBusId}`, payload);
        if (res.data.success) {
          toast.success("Bus updated successfully");
        }
      } else {
        const res = await apiClient.post(`/api/operators/operators/${OPERATOR_ID}/buses`, payload);
        if (res.data.success) {
          currentBusId = res.data.data.id;
          toast.success("Bus added successfully");
        }
      }

      if (currentBusId) {
        if (busForm.assign_route && busForm.route_id && busForm.departure_datetime) {
          if (busSelectedDates.length === 0) {
            toast.error("Please add at least one date for scheduling");
            return;
          }

          // Check if this bus is already scheduled for a different route on any of the selected dates
          for (const dateStr of busSelectedDates) {
            const conflict = trips.find(t => {
              if (t.bus_id !== currentBusId) return false;
              const tripDate = t.departure_datetime.split('T')[0];
              return tripDate === dateStr && t.route_id !== busForm.route_id && t.status !== 'CANCELLED';
            });
            if (conflict) {
              const conflictRoute = routes.find(r => r.id === conflict.route_id);
              const routeLabel = conflictRoute ? `${conflictRoute.origin_city} → ${conflictRoute.destination_city}` : "another route";
              toast.error(`Bus ${busForm.registration_no} is already scheduled for a different route (${routeLabel}) on ${dateStr}!`);
              return;
            }
          }

          const route = routes.find(r => r.id === busForm.route_id);
          const promises = busSelectedDates.map(async (dateStr) => {
            const departureISO = combineDateAndTimeToISO(dateStr, busForm.departure_datetime);
            const departure = new Date(departureISO);
            const arrival = new Date(departure);
            if (route) {
              const hours = Math.floor(route.estimated_duration_hours);
              const minutes = Math.round((route.estimated_duration_hours - hours) * 60);
              arrival.setHours(arrival.getHours() + hours);
              arrival.setMinutes(arrival.getMinutes() + minutes);
            } else {
              arrival.setHours(arrival.getHours() + 4); // Default 4 hours if no route data
            }

            const tripPayload = {
              operator_id: OPERATOR_ID,
              bus_id: currentBusId,
              route_id: busForm.route_id,
              departure_datetime: departureISO,
              arrival_datetime: arrival.toISOString(),
              fare_amount: busForm.fare_amount,
              available_seats: busForm.total_seats
            };
            return apiClient.post(`/api/operators/trips/`, tripPayload);
          });

          await Promise.all(promises);
          toast.success("Bus mapped and trips scheduled successfully");
        }

        setIsAddBusOpen(false);
        fetchData();
        if (!editingBusId) {
          setBusForm({
            registration_no: "",
            bus_type: "AC",
            total_seats: 40,
            is_active: true,
            assign_route: false,
            route_id: "",
            departure_datetime: "",
            arrival_datetime: "",
            fare_amount: 1000,
          });
        }
      }
    } catch (err: any) {
      toast.error(err.response?.data?.detail || `Failed to ${editingBusId ? 'update' : 'add'} bus`);
    }
  };

  const handleAddTrip = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Find bus for total seats
      const bus = buses.find(b => b.id === tripForm.bus_id);
      if (!bus) return toast.error("Please select a bus");
      if (tripSelectedDates.length === 0) {
        return toast.error("Please select at least one date");
      }

      // Check if the selected bus is already scheduled for a different route on any of the selected dates
      for (const dateStr of tripSelectedDates) {
        const conflict = trips.find(t => {
          if (t.bus_id !== tripForm.bus_id) return false;
          const tripDate = t.departure_datetime.split('T')[0];
          return tripDate === dateStr && t.route_id !== tripForm.route_id && t.status !== 'CANCELLED';
        });
        if (conflict) {
          const conflictRoute = routes.find(r => r.id === conflict.route_id);
          const routeLabel = conflictRoute ? `${conflictRoute.origin_city} → ${conflictRoute.destination_city}` : "another route";
          toast.error(`The selected bus is already scheduled for a different route (${routeLabel}) on ${dateStr}!`);
          return;
        }
      }

      const promises = tripSelectedDates.map(async (dateStr) => {
        const departureISO = combineDateAndTimeToISO(dateStr, tripForm.departure_datetime);
        const arrivalISO = calculateArrivalISO(dateStr, tripForm.departure_datetime, tripForm.arrival_datetime);

        const payload = {
          operator_id: OPERATOR_ID,
          bus_id: tripForm.bus_id,
          route_id: tripForm.route_id,
          departure_datetime: departureISO,
          arrival_datetime: arrivalISO,
          fare_amount: tripForm.fare_amount,
          available_seats: bus.total_seats
        };
        return apiClient.post(`/api/operators/trips/`, payload);
      });

      await Promise.all(promises);
      toast.success("All trips scheduled successfully");
      setIsAddTripOpen(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Failed to schedule trips");
    }
  };

  const handleAddRoute = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        ...routeForm,
        boarding_points: [{ name: "Main Counter", address: "Main Station", lat: 0, lng: 0 }],
        dropping_points: [{ name: "Main Drop", address: "Main Drop Station", lat: 0, lng: 0 }]
      };
      
      if (editingRouteId) {
        const res = await apiClient.put(`/api/operators/routes/${editingRouteId}`, payload);
        if (res.data.success) {
          toast.success("Route updated successfully");
          setIsAddRouteOpen(false);
          fetchData();
        }
      } else {
        const res = await apiClient.post(`/api/operators/operators/${OPERATOR_ID}/routes`, payload);
        if (res.data.success) {
          toast.success("Route added successfully");
          setIsAddRouteOpen(false);
          fetchData();
        }
      }
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      toast.error(typeof detail === "string" ? detail : `Failed to ${editingRouteId ? 'update' : 'add'} route`);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-brand-600" /></div>;
  }

  return (
    <div className="animate-fade-in">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-surface-900">Manage Services</h2>
        <div className="flex gap-2 bg-surface-100 p-1 rounded-xl">
          {["Trips", "Buses", "Routes"].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${activeTab === tab ? "bg-white text-surface-900 shadow-sm" : "text-surface-500 hover:text-surface-700"}`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div className="card-premium overflow-hidden">
        {activeTab === "Buses" && (
          <div>
            <div className="p-5 border-b border-surface-100 flex justify-between items-center">
              <h3 className="font-bold text-surface-900 flex items-center gap-2"><Bus className="w-5 h-5 text-brand-500" /> Fleet List</h3>
              <button onClick={openAddBus} className="btn-primary flex items-center gap-2 !py-2 !text-sm"><Plus className="w-4 h-4"/> Add Bus</button>
            </div>
            
            {/* Buses Filter Bar */}
            <div className="bg-surface-50 p-4 border-b border-surface-100 grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
              <div>
                <label className="block text-[10px] font-bold text-surface-500 uppercase tracking-wider mb-1.5">Search Reg Number</label>
                <input
                  type="text"
                  placeholder="e.g. DHAKA-METRO"
                  value={busFilterSearch}
                  onChange={(e) => setBusFilterSearch(e.target.value)}
                  className="input-premium py-2 px-3 w-full text-xs"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-surface-500 uppercase tracking-wider mb-1.5">Bus Type</label>
                <select
                  value={busFilterType}
                  onChange={(e) => setBusFilterType(e.target.value)}
                  className="input-premium py-2 px-3 w-full text-xs"
                >
                  <option value="">All Types</option>
                  <option value="AC">AC</option>
                  <option value="NON_AC">Non-AC</option>
                  <option value="SLEEPER">Sleeper</option>
                </select>
              </div>
              <div className="flex justify-end">
                {(busFilterSearch || busFilterType) && (
                  <button
                    onClick={() => {
                      setBusFilterSearch("");
                      setBusFilterType("");
                    }}
                    className="text-xs font-bold text-red-600 hover:text-red-700 hover:underline px-3 py-2"
                  >
                    Clear Filters
                  </button>
                )}
              </div>
            </div>

            <table className="w-full text-left">
              <thead>
                <tr className="bg-surface-50">
                  <th className="px-5 py-3 text-xs font-bold text-surface-500 uppercase">Reg Number</th>
                  <th className="px-5 py-3 text-xs font-bold text-surface-500 uppercase">Type</th>
                  <th className="px-5 py-3 text-xs font-bold text-surface-500 uppercase">Seats</th>
                  <th className="px-5 py-3 text-xs font-bold text-surface-500 uppercase">Current Route</th>
                  <th className="px-5 py-3 text-xs font-bold text-surface-500 uppercase">Fare</th>
                  <th className="px-5 py-3 text-xs font-bold text-surface-500 uppercase">Status</th>
                  <th className="px-5 py-3 text-xs font-bold text-surface-500 uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100">
                {(() => {
                  const filteredBuses = buses.filter(b => {
                    if (busFilterSearch && !b.registration_no.toLowerCase().includes(busFilterSearch.toLowerCase())) return false;
                    if (busFilterType && b.bus_type !== busFilterType) return false;
                    return true;
                  });

                  return (
                    <>
                      {filteredBuses.map(b => {
                        const busTrips = trips.filter(t => t.bus_id === b.id);
                        const latestTrip = busTrips[busTrips.length - 1];
                        const activeRoute = latestTrip ? routes.find(r => r.id === latestTrip.route_id) : null;
                        return (
                          <tr key={b.id} className="hover:bg-surface-50">
                            <td className="px-5 py-4 text-sm font-bold text-surface-900">{b.registration_no}</td>
                            <td className="px-5 py-4 text-sm text-surface-600">{b.bus_type}</td>
                            <td className="px-5 py-4 text-sm text-surface-600">{b.total_seats}</td>
                            <td className="px-5 py-4 text-sm text-surface-600">{activeRoute ? `${activeRoute.origin_city} → ${activeRoute.destination_city}` : <span className="text-surface-400 italic">Unassigned</span>}</td>
                            <td className="px-5 py-4 text-sm font-bold text-surface-900">{latestTrip ? `৳ ${latestTrip.fare_amount}` : '-'}</td>
                            <td className="px-5 py-4 text-sm">
                              {b.is_active === false ? <span className="badge badge-error">Unavailable</span> : <span className="badge badge-success">Active</span>}
                            </td>
                            <td className="px-5 py-4 text-sm text-right">
                              <button onClick={() => openEditBus(b)} className="p-2 text-surface-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors">
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button onClick={() => handleDeleteBus(b.id)} className="p-2 text-surface-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors ml-2">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                      {filteredBuses.length === 0 && (
                        <tr>
                          <td colSpan={7} className="px-5 py-8 text-center text-surface-500 italic">
                            No buses found matching the active filters.
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })()}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === "Routes" && (
          <div>
            <div className="p-5 border-b border-surface-100 flex justify-between items-center">
              <h3 className="font-bold text-surface-900 flex items-center gap-2"><Map className="w-5 h-5 text-brand-500" /> Permitted Routes</h3>
              <button onClick={openAddRoute} className="btn-primary flex items-center gap-2 !py-2 !text-sm"><Plus className="w-4 h-4"/> Add Route</button>
            </div>

            {/* Routes Filter Bar */}
            <div className="bg-surface-50 p-4 border-b border-surface-100 grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
              <div>
                <label className="block text-[10px] font-bold text-surface-500 uppercase tracking-wider mb-1.5">Search Origin / Destination</label>
                <input
                  type="text"
                  placeholder="Search by city (e.g. Dhaka)..."
                  value={routeFilterSearch}
                  onChange={(e) => setRouteFilterSearch(e.target.value)}
                  className="input-premium py-2 px-3 w-full text-xs"
                />
              </div>
              <div className="flex justify-end">
                {routeFilterSearch && (
                  <button
                    onClick={() => setRouteFilterSearch("")}
                    className="text-xs font-bold text-red-600 hover:text-red-700 hover:underline px-3 py-2"
                  >
                    Clear Filter
                  </button>
                )}
              </div>
            </div>

            <table className="w-full text-left">
              <thead>
                <tr className="bg-surface-50">
                  <th className="px-5 py-3 text-xs font-bold text-surface-500 uppercase">Origin</th>
                  <th className="px-5 py-3 text-xs font-bold text-surface-500 uppercase">Destination</th>
                  <th className="px-5 py-3 text-xs font-bold text-surface-500 uppercase">Distance</th>
                  <th className="px-5 py-3 text-xs font-bold text-surface-500 uppercase text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100">
                {(() => {
                  const filteredRoutes = routes.filter(r => {
                    if (routeFilterSearch) {
                      const searchStr = routeFilterSearch.toLowerCase();
                      const originMatch = r.origin_city.toLowerCase().includes(searchStr);
                      const destMatch = r.destination_city.toLowerCase().includes(searchStr);
                      return originMatch || destMatch;
                    }
                    return true;
                  });

                  return (
                    <>
                      {filteredRoutes.map(r => (
                        <tr key={r.id} className="hover:bg-surface-50">
                          <td className="px-5 py-4 text-sm font-bold text-surface-900">{r.origin_city}</td>
                          <td className="px-5 py-4 text-sm font-bold text-surface-900">{r.destination_city}</td>
                          <td className="px-5 py-4 text-sm text-surface-600">{r.distance_km} km</td>
                          <td className="px-5 py-4 text-sm text-right">
                            <button onClick={() => openEditRoute(r)} className="p-2 text-surface-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors">
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button onClick={() => handleDeleteRoute(r.id)} className="p-2 text-surface-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors ml-2">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                      {filteredRoutes.length === 0 && (
                        <tr>
                          <td colSpan={4} className="px-5 py-8 text-center text-surface-500 italic">
                            No routes found matching the active filter.
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })()}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === "Trips" && (() => {
          const now = new Date();
          const filteredTrips = trips.filter(t => {
            if (tripFilterRoute && t.route_id !== tripFilterRoute) return false;
            if (tripFilterBus && t.bus_id !== tripFilterBus) return false;
            if (tripFilterDate) {
              const tripDate = t.departure_datetime.split('T')[0];
              if (tripDate !== tripFilterDate) return false;
            }
            return true;
          });

          const activeTrips = filteredTrips
            .filter(t => t.departure_datetime && new Date(t.departure_datetime) > now)
            .sort((a, b) => new Date(a.departure_datetime).getTime() - new Date(b.departure_datetime).getTime());
          
          const pastTrips = filteredTrips
            .filter(t => !t.departure_datetime || new Date(t.departure_datetime) <= now)
            .sort((a, b) => {
              const timeA = a.departure_datetime ? new Date(a.departure_datetime).getTime() : 0;
              const timeB = b.departure_datetime ? new Date(b.departure_datetime).getTime() : 0;
              return timeB - timeA;
            });
          
          return (
            <div className="space-y-6">
              {/* Filters Bar */}
              <div className="bg-surface-50 p-5 border-b border-surface-100 grid grid-cols-1 sm:grid-cols-4 gap-4 items-end rounded-t-2xl">
                <div>
                  <label className="block text-[10px] font-bold text-surface-500 uppercase tracking-wider mb-1.5">Filter Route</label>
                  <select
                    value={tripFilterRoute}
                    onChange={(e) => setTripFilterRoute(e.target.value)}
                    className="input-premium py-2 px-3 w-full text-xs"
                  >
                    <option value="">All Routes</option>
                    {routes.map(r => (
                      <option key={r.id} value={r.id}>{r.origin_city} → {r.destination_city}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-surface-500 uppercase tracking-wider mb-1.5">Filter Bus</label>
                  <select
                    value={tripFilterBus}
                    onChange={(e) => setTripFilterBus(e.target.value)}
                    className="input-premium py-2 px-3 w-full text-xs"
                  >
                    <option value="">All Buses</option>
                    {buses.map(b => (
                      <option key={b.id} value={b.id}>{b.registration_no} ({b.bus_type})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-surface-500 uppercase tracking-wider mb-1.5">Filter Date</label>
                  <input
                    type="date"
                    value={tripFilterDate}
                    onChange={(e) => setTripFilterDate(e.target.value)}
                    className="input-premium py-2 px-3 w-full text-xs"
                  />
                </div>
                <div className="flex justify-end">
                  {(tripFilterRoute || tripFilterBus || tripFilterDate) && (
                    <button
                      onClick={() => {
                        setTripFilterRoute("");
                        setTripFilterBus("");
                        setTripFilterDate("");
                      }}
                      className="text-xs font-bold text-red-600 hover:text-red-700 hover:underline px-3 py-2"
                    >
                      Clear Filters
                    </button>
                  )}
                </div>
              </div>

              {/* Sub-tabs for Upcoming vs Past Trips */}
              <div className="flex border-b border-surface-100 bg-surface-50 shrink-0 rounded-b-2xl overflow-hidden border-x">
                <button
                  type="button"
                  onClick={() => setTripsSubTab("upcoming")}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold border-b-2 transition-all ${
                    tripsSubTab === "upcoming"
                      ? "border-brand-600 text-brand-600 bg-white"
                      : "border-transparent text-surface-500 hover:text-surface-700 hover:bg-surface-100/50"
                  }`}
                >
                  <Clock className="w-4 h-4" />
                  Scheduled Trips (Upcoming)
                </button>
                <button
                  type="button"
                  onClick={() => setTripsSubTab("past")}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold border-b-2 transition-all ${
                    tripsSubTab === "past"
                      ? "border-brand-600 text-brand-600 bg-white"
                      : "border-transparent text-surface-500 hover:text-surface-700 hover:bg-surface-100/50"
                  }`}
                >
                  <Calendar className="w-4 h-4" />
                  Past Trips History (Already Done)
                </button>
              </div>

              {tripsSubTab === "upcoming" ? (
                /* Active Scheduled Trips */
                <div>
                  <div className="p-5 border-b border-surface-100 flex justify-between items-center bg-surface-50/50 rounded-t-2xl">
                    <h3 className="font-bold text-surface-900 flex items-center gap-2">
                      <Clock className="w-5 h-5 text-brand-500" /> Scheduled Trips (Upcoming)
                    </h3>
                    <button onClick={() => {
                      setTripForm({
                        bus_id: "",
                        route_id: "",
                        departure_datetime: "",
                        arrival_datetime: "",
                        fare_amount: 1000,
                      });
                      setTripSelectedDates([]);
                      setIsAddTripOpen(true);
                    }} className="btn-primary flex items-center gap-2 !py-2 !text-sm">
                      <Plus className="w-4 h-4"/> Schedule Trip
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-surface-50 border-b border-surface-100">
                          <th className="px-5 py-3 text-xs font-bold text-surface-500 uppercase">Date & Time</th>
                          <th className="px-5 py-3 text-xs font-bold text-surface-500 uppercase">Route</th>
                          <th className="px-5 py-3 text-xs font-bold text-surface-500 uppercase">Bus</th>
                          <th className="px-5 py-3 text-xs font-bold text-surface-500 uppercase">Fare</th>
                          <th className="px-5 py-3 text-xs font-bold text-surface-500 uppercase">Status</th>
                          <th className="px-5 py-3 text-xs font-bold text-surface-500 uppercase text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-surface-100">
                        {activeTrips.map(t => {
                          const route = routes.find(r => r.id === t.route_id);
                          const bus = buses.find(b => b.id === t.bus_id);
                          return (
                            <tr key={t.id} className="hover:bg-surface-50 transition-colors">
                              <td className="px-5 py-4 text-sm font-medium text-surface-900">{new Date(t.departure_datetime).toLocaleString()}</td>
                              <td className="px-5 py-4 text-sm text-surface-600">{route ? `${route.origin_city} → ${route.destination_city}` : 'Unknown'}</td>
                              <td className="px-5 py-4 text-sm text-surface-600">{bus?.registration_no || 'Unknown'}</td>
                              <td className="px-5 py-4 text-sm font-bold text-surface-900">৳ {t.fare_amount}</td>
                              <td className="px-5 py-4 text-sm"><span className="badge badge-info">{t.status}</span></td>
                              <td className="px-5 py-4 text-sm text-right flex items-center justify-end gap-1">
                                <button 
                                  onClick={() => setSelectedTrip({ 
                                    trip: t, 
                                    routeLabel: route ? `${route.origin_city} → ${route.destination_city}` : 'Unknown Route',
                                    busLabel: bus?.registration_no || 'Unknown Bus'
                                  })}
                                  className="p-2 text-surface-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors"
                                  title="View Trip Details & Bookings"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>
                                {bus && Number(t.available_seats) === Number(bus.total_seats) && (
                                  <button
                                    onClick={() => handleDeleteTrip(t.id, t.available_seats, bus.total_seats)}
                                    className="p-2 text-surface-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                    title="Delete Scheduled Trip"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                        {activeTrips.length === 0 && (
                          <tr>
                            <td colSpan={6} className="px-5 py-8 text-center text-surface-500 italic">
                              No upcoming scheduled trips.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                /* Past Trips History */
                <div>
                  <div className="p-5 border-b border-surface-100 flex justify-between items-center bg-surface-50/50 rounded-t-2xl">
                    <h3 className="font-bold text-surface-900 flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-emerald-600" /> Past Trips History (Already Done)
                    </h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-surface-50 border-b border-surface-100">
                          <th className="px-5 py-3 text-xs font-bold text-surface-500 uppercase">Date & Time</th>
                          <th className="px-5 py-3 text-xs font-bold text-surface-500 uppercase">Route</th>
                          <th className="px-5 py-3 text-xs font-bold text-surface-500 uppercase">Bus</th>
                          <th className="px-5 py-3 text-xs font-bold text-surface-500 uppercase">Fare</th>
                          <th className="px-5 py-3 text-xs font-bold text-surface-500 uppercase">Status</th>
                          <th className="px-5 py-3 text-xs font-bold text-surface-500 uppercase text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-surface-100">
                        {pastTrips.map(t => {
                          const route = routes.find(r => r.id === t.route_id);
                          const bus = buses.find(b => b.id === t.bus_id);
                          
                          // Dynamically mark scheduled past trips as COMPLETED
                          const displayStatus = t.status === "SCHEDULED" ? "COMPLETED" : t.status;
                          const badgeClass = displayStatus === "COMPLETED" ? "badge-success" : 
                                             displayStatus === "CANCELLED" ? "badge-error" : "badge-neutral";
                          
                          return (
                            <tr key={t.id} className="hover:bg-surface-50 transition-colors bg-surface-50/20">
                              <td className="px-5 py-4 text-sm font-medium text-surface-500">{new Date(t.departure_datetime).toLocaleString()}</td>
                              <td className="px-5 py-4 text-sm text-surface-500">{route ? `${route.origin_city} → ${route.destination_city}` : 'Unknown'}</td>
                              <td className="px-5 py-4 text-sm text-surface-500">{bus?.registration_no || 'Unknown'}</td>
                              <td className="px-5 py-4 text-sm font-bold text-surface-500">৳ {t.fare_amount}</td>
                              <td className="px-5 py-4 text-sm">
                                <span className={`badge ${badgeClass}`}>{displayStatus}</span>
                              </td>
                              <td className="px-5 py-4 text-sm text-right flex items-center justify-end gap-1">
                                <button 
                                  onClick={() => setSelectedTrip({ 
                                    trip: t, 
                                    routeLabel: route ? `${route.origin_city} → ${route.destination_city}` : 'Unknown Route',
                                    busLabel: bus?.registration_no || 'Unknown Bus'
                                  })}
                                  className="p-2 text-surface-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors"
                                  title="View Trip Details & Bookings"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>
                                {bus && Number(t.available_seats) === Number(bus.total_seats) && (
                                  <button
                                    onClick={() => handleDeleteTrip(t.id, t.available_seats, bus.total_seats)}
                                    className="p-2 text-surface-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                    title="Delete Trip"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                        {pastTrips.length === 0 && (
                          <tr>
                            <td colSpan={6} className="px-5 py-8 text-center text-surface-500 italic">
                              No past trip history.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {/* Add Route Modal */}
      {isAddRouteOpen && (
        <div className="fixed inset-0 z-50 bg-surface-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-elevation-3">
            <div className="px-6 py-4 border-b border-surface-100 flex justify-between items-center">
              <h3 className="font-bold text-lg text-surface-900">{editingRouteId ? "Edit Route" : "Add New Route"}</h3>
              <button onClick={() => setIsAddRouteOpen(false)} className="text-surface-400 hover:text-surface-700"><X className="w-5 h-5"/></button>
            </div>
            <form onSubmit={handleAddRoute} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-surface-700 mb-1">Origin City</label>
                <select required className="input-premium w-full" value={routeForm.origin_city} onChange={e => setRouteForm({...routeForm, origin_city: e.target.value})}>
                  <option value="">-- Select Origin --</option>
                  {["Dhaka", "Chittagong", "Sylhet", "Cox's Bazar", "Rajshahi", "Khulna", "Barisal", "Rangpur", "Comilla", "Mymensingh", "Bogra", "Jessore"].map(city => (
                    <option key={city} value={city}>{city}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-surface-700 mb-1">Destination City</label>
                <select required className="input-premium w-full" value={routeForm.destination_city} onChange={e => setRouteForm({...routeForm, destination_city: e.target.value})}>
                  <option value="">-- Select Destination --</option>
                  {["Dhaka", "Chittagong", "Sylhet", "Cox's Bazar", "Rajshahi", "Khulna", "Barisal", "Rangpur", "Comilla", "Mymensingh", "Bogra", "Jessore"].map(city => (
                    <option key={city} value={city}>{city}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-surface-700 mb-1">Distance (km)</label>
                  <input type="number" required className="input-premium w-full" value={routeForm.distance_km} onChange={e => setRouteForm({...routeForm, distance_km: parseInt(e.target.value)})} min="1" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-surface-700 mb-1">Duration (hrs)</label>
                  <input type="number" step="0.5" required className="input-premium w-full" value={routeForm.estimated_duration_hours} onChange={e => setRouteForm({...routeForm, estimated_duration_hours: parseFloat(e.target.value)})} min="0.5" />
                </div>
              </div>
              <button type="submit" className="btn-primary w-full mt-4">{editingRouteId ? "Update Route" : "Save Route"}</button>
            </form>
          </div>
        </div>
      )}

      {/* Add Bus Modal */}
      {isAddBusOpen && (
        <div className="fixed inset-0 z-50 bg-surface-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-elevation-3">
            <div className="px-6 py-4 border-b border-surface-100 flex justify-between items-center">
              <h3 className="font-bold text-lg text-surface-900">{editingBusId ? "Edit Bus" : "Add New Bus"}</h3>
              <button onClick={() => setIsAddBusOpen(false)} className="text-surface-400 hover:text-surface-700"><X className="w-5 h-5"/></button>
            </div>
            <form onSubmit={handleAddBus} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <div>
                <label className="block text-sm font-semibold text-surface-700 mb-1">Registration Number</label>
                <input type="text" required className="input-premium w-full" value={busForm.registration_no} onChange={e => setBusForm({...busForm, registration_no: e.target.value})} placeholder="e.g. DHAKA-METRO-B-11-2233" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-surface-700 mb-1">Bus Type</label>
                  <select className="input-premium w-full" value={busForm.bus_type} onChange={e => setBusForm({...busForm, bus_type: e.target.value})}>
                    <option value="AC">AC</option>
                    <option value="NON_AC">Non-AC</option>
                    <option value="SLEEPER">Sleeper</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-surface-700 mb-1">Total Seats</label>
                  <input type="number" required className="input-premium w-full" value={busForm.total_seats} onChange={e => setBusForm({...busForm, total_seats: parseInt(e.target.value)})} min="10" max="60" />
                </div>
              </div>

              
              <div className="pt-2 border-t border-surface-100">
                <label className="flex items-center gap-2 text-sm font-semibold text-surface-900 cursor-pointer mb-4">
                  <input 
                    type="checkbox" 
                    className="rounded border-surface-300 text-brand-600 focus:ring-brand-500 w-4 h-4"
                    checked={busForm.is_active}
                    onChange={e => setBusForm({...busForm, is_active: e.target.checked})}
                  />
                  Bus is Active and Available
                </label>

                <label className="flex items-center gap-2 text-sm font-semibold text-surface-900 cursor-pointer mb-2">
                  <input 
                    type="checkbox" 
                    className="rounded border-surface-300 text-brand-600 focus:ring-brand-500 w-4 h-4"
                    checked={busForm.assign_route}
                    onChange={e => setBusForm({...busForm, assign_route: e.target.checked})}
                  />
                  {editingBusId ? "Schedule a new trip for this bus?" : "Schedule a trip for this bus now?"}
                </label>

                {busForm.assign_route && (
                  <div className="space-y-4 mt-3 bg-surface-50 p-4 rounded-xl border border-surface-100">
                    <div>
                      <label className="block text-sm font-semibold text-surface-700 mb-1">Select Route</label>
                      <select required={busForm.assign_route} className="input-premium w-full" value={busForm.route_id} onChange={e => setBusForm({...busForm, route_id: e.target.value})}>
                        <option value="">{routes.length === 0 ? "-- No routes available, add one first --" : "-- Choose Route --"}</option>
                        {routes.map(r => <option key={r.id} value={r.id}>{r.origin_city} to {r.destination_city}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-surface-700 mb-1">Departure Time</label>
                      <input type="time" required={busForm.assign_route} className="input-premium w-full" value={busForm.departure_datetime} onChange={e => setBusForm({...busForm, departure_datetime: e.target.value})} />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-surface-700 mb-1.5">Select Dates</label>
                      <MultiDateCalendar
                        selectedDates={busSelectedDates}
                        onChange={setBusSelectedDates}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-surface-700 mb-1">Fare Amount (৳)</label>
                      <input type="number" required={busForm.assign_route} className="input-premium w-full" value={busForm.fare_amount} onChange={e => setBusForm({...busForm, fare_amount: parseInt(e.target.value)})} min="100" />
                    </div>
                  </div>
                )}
              </div>

              <button type="submit" className="btn-primary w-full mt-4">{editingBusId ? "Update Bus" : "Save Bus"}</button>
            </form>
          </div>
        </div>
      )}

      {/* Add Trip Modal */}
      {isAddTripOpen && (
        <div className="fixed inset-0 z-50 bg-surface-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-elevation-3">
            <div className="px-6 py-4 border-b border-surface-100 flex justify-between items-center">
              <h3 className="font-bold text-lg text-surface-900">Schedule Trip</h3>
              <button onClick={() => setIsAddTripOpen(false)} className="text-surface-400 hover:text-surface-700"><X className="w-5 h-5"/></button>
            </div>
            <form onSubmit={handleAddTrip} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-surface-700 mb-1">Select Route</label>
                <select required className="input-premium w-full" value={tripForm.route_id} onChange={e => setTripForm({...tripForm, route_id: e.target.value})}>
                  <option value="">-- Choose Route --</option>
                  {routes.map(r => <option key={r.id} value={r.id}>{r.origin_city} to {r.destination_city}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-surface-700 mb-1">Select Bus</label>
                <select required className="input-premium w-full" value={tripForm.bus_id} onChange={e => setTripForm({...tripForm, bus_id: e.target.value})}>
                  <option value="">{buses.length === 0 ? "-- No buses available, add one first --" : "-- Choose Bus --"}</option>
                  {buses.map(b => <option key={b.id} value={b.id}>{b.registration_no} ({b.bus_type})</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-surface-700 mb-1">Departure Time</label>
                  <input type="time" required className="input-premium w-full" value={tripForm.departure_datetime} onChange={e => setTripForm({...tripForm, departure_datetime: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-surface-700 mb-1">Arrival Time</label>
                  <input type="time" required className="input-premium w-full" value={tripForm.arrival_datetime} onChange={e => setTripForm({...tripForm, arrival_datetime: e.target.value})} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-surface-700 mb-1.5">Select Dates</label>
                <MultiDateCalendar
                  selectedDates={tripSelectedDates}
                  onChange={setTripSelectedDates}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-surface-700 mb-1">Fare Amount (৳)</label>
                <input type="number" required className="input-premium w-full" value={tripForm.fare_amount} onChange={e => setTripForm({...tripForm, fare_amount: parseInt(e.target.value)})} min="100" />
              </div>
              <button type="submit" className="btn-primary w-full mt-4">Schedule Trip</button>
            </form>
          </div>
        </div>
      )}
      {/* Trip Details Modal */}
      {selectedTrip && (
        <TripDetailsModal
          trip={selectedTrip.trip}
          routeLabel={selectedTrip.routeLabel}
          busLabel={selectedTrip.busLabel}
          onClose={() => setSelectedTrip(null)}
        />
      )}
    </div>
  );
}
