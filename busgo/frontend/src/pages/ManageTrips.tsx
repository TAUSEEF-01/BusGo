import { useState, useEffect } from "react";
import { Bus, Map, Clock, Plus, Loader2, X } from "lucide-react";
import { apiClient } from "../api/client";
import { toast } from "react-hot-toast";

const OPERATOR_ID = "84cd0cc6-ac4a-43f9-ade7-d982f7494077"; // Seeded Greenline Operator

export function ManageTrips() {
  const [activeTab, setActiveTab] = useState("Trips");
  const [buses, setBuses] = useState<any[]>([]);
  const [routes, setRoutes] = useState<any[]>([]);
  const [trips, setTrips] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [isAddBusOpen, setIsAddBusOpen] = useState(false);
  const [isAddTripOpen, setIsAddTripOpen] = useState(false);

  // Form States
  const [busForm, setBusForm] = useState({
    registration_no: "",
    bus_type: "AC",
    total_seats: 40,
  });

  const [tripForm, setTripForm] = useState({
    bus_id: "",
    route_id: "",
    departure_datetime: "",
    arrival_datetime: "",
    fare_amount: 1000,
  });

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

  const handleAddBus = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        ...busForm,
        seat_layout: {}, // Minimal mock payload
        amenities: ["WiFi", "Water"]
      };
      const res = await apiClient.post(`/api/operators/operators/${OPERATOR_ID}/buses`, payload);
      if (res.data.success) {
        toast.success("Bus added successfully");
        setIsAddBusOpen(false);
        fetchData();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Failed to add bus");
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
        departure_datetime: new Date(tripForm.departure_datetime).toISOString(),
        arrival_datetime: new Date(tripForm.arrival_datetime).toISOString(),
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
              <button onClick={() => setIsAddBusOpen(true)} className="btn-primary flex items-center gap-2 !py-2 !text-sm"><Plus className="w-4 h-4"/> Add Bus</button>
            </div>
            <table className="w-full text-left">
              <thead>
                <tr className="bg-surface-50">
                  <th className="px-5 py-3 text-xs font-bold text-surface-500 uppercase">Reg Number</th>
                  <th className="px-5 py-3 text-xs font-bold text-surface-500 uppercase">Type</th>
                  <th className="px-5 py-3 text-xs font-bold text-surface-500 uppercase">Seats</th>
                  <th className="px-5 py-3 text-xs font-bold text-surface-500 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100">
                {buses.map(b => (
                  <tr key={b.id} className="hover:bg-surface-50">
                    <td className="px-5 py-4 text-sm font-bold text-surface-900">{b.registration_no}</td>
                    <td className="px-5 py-4 text-sm text-surface-600">{b.bus_type}</td>
                    <td className="px-5 py-4 text-sm text-surface-600">{b.total_seats}</td>
                    <td className="px-5 py-4 text-sm"><span className="badge badge-success">Active</span></td>
                  </tr>
                ))}
                {buses.length === 0 && <tr><td colSpan={4} className="px-5 py-8 text-center text-surface-500">No buses found in fleet.</td></tr>}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === "Routes" && (
          <div>
            <div className="p-5 border-b border-surface-100">
              <h3 className="font-bold text-surface-900 flex items-center gap-2"><Map className="w-5 h-5 text-brand-500" /> Permitted Routes</h3>
            </div>
            <table className="w-full text-left">
              <thead>
                <tr className="bg-surface-50">
                  <th className="px-5 py-3 text-xs font-bold text-surface-500 uppercase">Origin</th>
                  <th className="px-5 py-3 text-xs font-bold text-surface-500 uppercase">Destination</th>
                  <th className="px-5 py-3 text-xs font-bold text-surface-500 uppercase">Distance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100">
                {routes.map(r => (
                  <tr key={r.id} className="hover:bg-surface-50">
                    <td className="px-5 py-4 text-sm font-bold text-surface-900">{r.origin_city}</td>
                    <td className="px-5 py-4 text-sm font-bold text-surface-900">{r.destination_city}</td>
                    <td className="px-5 py-4 text-sm text-surface-600">{r.distance_km} km</td>
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
                    </tr>
                  )
                })}
                {trips.length === 0 && <tr><td colSpan={5} className="px-5 py-8 text-center text-surface-500">No trips scheduled.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Bus Modal */}
      {isAddBusOpen && (
        <div className="fixed inset-0 z-50 bg-surface-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-elevation-3">
            <div className="px-6 py-4 border-b border-surface-100 flex justify-between items-center">
              <h3 className="font-bold text-lg text-surface-900">Add New Bus</h3>
              <button onClick={() => setIsAddBusOpen(false)} className="text-surface-400 hover:text-surface-700"><X className="w-5 h-5"/></button>
            </div>
            <form onSubmit={handleAddBus} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-surface-700 mb-1">Registration Number</label>
                <input type="text" required className="input-premium w-full" value={busForm.registration_no} onChange={e => setBusForm({...busForm, registration_no: e.target.value})} placeholder="e.g. DHAKA-METRO-B-11-2233" />
              </div>
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
              <button type="submit" className="btn-primary w-full mt-4">Save Bus</button>
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
                  <option value="">-- Choose Bus --</option>
                  {buses.map(b => <option key={b.id} value={b.id}>{b.registration_no} ({b.bus_type})</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-surface-700 mb-1">Departure Time</label>
                  <input type="datetime-local" required className="input-premium w-full" value={tripForm.departure_datetime} onChange={e => setTripForm({...tripForm, departure_datetime: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-surface-700 mb-1">Arrival Time</label>
                  <input type="datetime-local" required className="input-premium w-full" value={tripForm.arrival_datetime} onChange={e => setTripForm({...tripForm, arrival_datetime: e.target.value})} />
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
    </div>
  );
}
