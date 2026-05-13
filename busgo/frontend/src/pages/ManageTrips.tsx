import { useState, useEffect } from "react";
import { Bus, Map, Clock, Plus, Loader2, X, Edit2, Trash2, Eye, Calendar, Users, ArrowRight } from "lucide-react";
import { apiClient } from "../api/client";
import { toast } from "react-hot-toast";

import { useAuthStore } from "../stores/authStore";

/* ─── Seat Map Modal ────────────────────────────────── */
interface SeatInfo {
  id: string;
  trip_id: string;
  seat_number: string;
  seat_type: string;
  status: string;
  locked_by_booking_id: string | null;
  booked_by_user_id: string | null;
}

function SeatMapModal({
  tripId,
  tripLabel,
  onClose,
}: {
  tripId: string;
  tripLabel: string;
  onClose: () => void;
}) {
  const [seats, setSeats] = useState<SeatInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSeats = async () => {
      try {
        const res = await apiClient.get(`/api/inventory/trips/${tripId}/seats`);
        if (res.data.success) {
          setSeats(res.data.data);
        }
      } catch (err) {
        console.error("Failed to fetch seat data", err);
        toast.error("Failed to load seat map");
      } finally {
        setLoading(false);
      }
    };
    fetchSeats();
  }, [tripId]);

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

  return (
    <div className="fixed inset-0 z-[60] bg-surface-900/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-2xl overflow-hidden shadow-elevation-3 animate-fade-in" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-surface-100 flex justify-between items-center bg-gradient-to-r from-brand-600 to-brand-700">
          <div>
            <h3 className="font-bold text-lg text-white">Seat Map</h3>
            <p className="text-brand-100 text-sm">{tripLabel}</p>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-brand-600" /></div>
        ) : seats.length === 0 ? (
          <div className="p-8 text-center text-surface-500">No seat data available for this trip.</div>
        ) : (
          <div className="p-6">
            <div className="grid grid-cols-4 gap-3 mb-6">
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

            <div className="flex items-center gap-5 mb-4 text-xs font-semibold text-surface-600">
              <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded bg-emerald-100 border-2 border-emerald-400 inline-block"></span> Available</span>
              <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded bg-red-500 border-2 border-red-600 inline-block"></span> Booked</span>
              <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded bg-amber-400 border-2 border-amber-500 inline-block"></span> Locked</span>
            </div>

            <div className="bg-surface-50 rounded-xl p-4 border border-surface-100 max-h-[400px] overflow-y-auto">
              <div className="flex flex-col gap-2">
                {sortedRows.map((row) => (
                  <div key={row} className="flex items-center gap-2">
                    <span className="w-6 text-xs font-bold text-surface-400 text-center">{row}</span>
                    <div className="flex gap-2 flex-wrap">
                      {seatsByRow[row].map((seat) => {
                        const isBooked = seat.status === "BOOKED";
                        const isLocked = seat.status === "LOCKED";
                        return (
                          <div key={seat.id} className={`w-10 h-10 rounded-lg flex items-center justify-center text-xs font-bold transition-all duration-200 border-2 ${isBooked ? "bg-red-500 border-red-600 text-white shadow-sm" : isLocked ? "bg-amber-400 border-amber-500 text-amber-900 shadow-sm" : "bg-emerald-100 border-emerald-400 text-emerald-700 hover:bg-emerald-200"}`}>
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
      </div>
    </div>
  );
}


export function ManageTrips() {
  const user = useAuthStore((s) => s.user);
  const OPERATOR_ID = user?.id || "";

  const [activeTab, setActiveTab] = useState("Trips");
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
  const [seatMapTrip, setSeatMapTrip] = useState<{ tripId: string; label: string } | null>(null);

  const combineDateAndTime = (timeStr: string) => {
    if (!timeStr) return "";
    const [hours, minutes] = timeStr.split(':');
    const date = new Date();
    date.setHours(parseInt(hours), parseInt(minutes), 0, 0);
    return date.toISOString();
  };

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
      const [busesRes, routesRes, tripsRes] = await Promise.all([
        apiClient.get(`/api/operators/operators/${OPERATOR_ID}/buses`),
        apiClient.get(`/api/operators/operators/${OPERATOR_ID}/routes`),
        apiClient.get(`/api/operators/trips/?operator_id=${OPERATOR_ID}`)
      ]);
      if (busesRes.data.success) setBuses(busesRes.data.data);
      if (routesRes.data.success) setRoutes(routesRes.data.data);
      if (tripsRes.data.success) setTrips(tripsRes.data.data);
    } catch (error) {
      console.error("Failed to fetch operator data", error);
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
          const route = routes.find(r => r.id === busForm.route_id);
          const departureISO = combineDateAndTime(busForm.departure_datetime);
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
          await apiClient.post(`/api/operators/trips/`, tripPayload);
          toast.success("Bus mapped to route successfully");
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

      const payload = {
        operator_id: OPERATOR_ID,
        bus_id: tripForm.bus_id,
        route_id: tripForm.route_id,
        departure_datetime: combineDateAndTime(tripForm.departure_datetime),
        arrival_datetime: combineDateAndTime(tripForm.arrival_datetime),
        fare_amount: tripForm.fare_amount,
        available_seats: bus.total_seats
      };

      const res = await apiClient.post(`/api/operators/trips/`, payload);
      if (res.data.success) {
        toast.success("Trip scheduled successfully");
        setIsAddTripOpen(false);
        fetchData();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Failed to schedule trip");
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
                {buses.map(b => {
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
                  )
                })}
                {buses.length === 0 && <tr><td colSpan={6} className="px-5 py-8 text-center text-surface-500">No buses found in fleet.</td></tr>}
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
                {routes.map(r => (
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
              </tbody>
            </table>
          </div>
        )}

        {activeTab === "Trips" && (
          <div>
            <div className="p-5 border-b border-surface-100 flex justify-between items-center">
              <h3 className="font-bold text-surface-900 flex items-center gap-2"><Clock className="w-5 h-5 text-brand-500" /> Scheduled Trips</h3>
              <button onClick={() => setIsAddTripOpen(true)} className="btn-primary flex items-center gap-2 !py-2 !text-sm"><Plus className="w-4 h-4"/> Schedule Trip</button>
            </div>
            <table className="w-full text-left">
              <thead>
                <tr className="bg-surface-50">
                  <th className="px-5 py-3 text-xs font-bold text-surface-500 uppercase">Date & Time</th>
                  <th className="px-5 py-3 text-xs font-bold text-surface-500 uppercase">Route</th>
                  <th className="px-5 py-3 text-xs font-bold text-surface-500 uppercase">Bus</th>
                  <th className="px-5 py-3 text-xs font-bold text-surface-500 uppercase">Fare</th>
                  <th className="px-5 py-3 text-xs font-bold text-surface-500 uppercase">Status</th>
                  <th className="px-5 py-3 text-xs font-bold text-surface-500 uppercase text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100">
                {trips.map(t => {
                  const route = routes.find(r => r.id === t.route_id);
                  const bus = buses.find(b => b.id === t.bus_id);
                  return (
                    <tr key={t.id} className="hover:bg-surface-50">
                      <td className="px-5 py-4 text-sm font-medium text-surface-900">{new Date(t.departure_datetime).toLocaleString()}</td>
                      <td className="px-5 py-4 text-sm text-surface-600">{route ? `${route.origin_city} → ${route.destination_city}` : 'Unknown'}</td>
                      <td className="px-5 py-4 text-sm text-surface-600">{bus?.registration_no || 'Unknown'}</td>
                      <td className="px-5 py-4 text-sm font-bold text-surface-900">৳ {t.fare_amount}</td>
                      <td className="px-5 py-4 text-sm"><span className="badge badge-info">{t.status}</span></td>
                      <td className="px-5 py-4 text-sm text-right">
                        <button 
                          onClick={() => setSeatMapTrip({ tripId: t.id, label: `${route?.origin_city} → ${route?.destination_city} | ${new Date(t.departure_datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` })}
                          className="p-2 text-surface-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors"
                          title="View Booked Seats"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
                {trips.length === 0 && <tr><td colSpan={5} className="px-5 py-8 text-center text-surface-500">No trips scheduled.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
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
                    <div className="grid grid-cols-1 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-surface-700 mb-1">Departure Time</label>
                        <input type="time" required={busForm.assign_route} className="input-premium w-full" value={busForm.departure_datetime} onChange={e => setBusForm({...busForm, departure_datetime: e.target.value})} />
                      </div>
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
                <label className="block text-sm font-semibold text-surface-700 mb-1">Fare Amount (৳)</label>
                <input type="number" required className="input-premium w-full" value={tripForm.fare_amount} onChange={e => setTripForm({...tripForm, fare_amount: parseInt(e.target.value)})} min="100" />
              </div>
              <button type="submit" className="btn-primary w-full mt-4">Schedule Trip</button>
            </form>
          </div>
        </div>
      )}
      {/* Seat Map Modal */}
      {seatMapTrip && (
        <SeatMapModal
          tripId={seatMapTrip.tripId}
          tripLabel={seatMapTrip.label}
          onClose={() => setSeatMapTrip(null)}
        />
      )}
    </div>
  );
}
