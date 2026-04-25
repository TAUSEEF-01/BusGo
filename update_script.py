import os

path = 'busgo/frontend/src/pages/ManageTrips.tsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1
content = content.replace(
    'import { Bus, Map, Clock, Plus, Loader2, X } from "lucide-react";',
    'import { Bus, Map, Clock, Plus, Loader2, X, Edit2 } from "lucide-react";'
)

# 2
old_states = '''  // Modals
  const [isAddBusOpen, setIsAddBusOpen] = useState(false);
  const [isAddTripOpen, setIsAddTripOpen] = useState(false);
  const [isAddRouteOpen, setIsAddRouteOpen] = useState(false);'''
new_states = '''  // Modals
  const [isAddBusOpen, setIsAddBusOpen] = useState(false);
  const [isAddTripOpen, setIsAddTripOpen] = useState(false);
  const [isAddRouteOpen, setIsAddRouteOpen] = useState(false);
  const [editingBusId, setEditingBusId] = useState<string | null>(null);

  const openAddBus = () => {
    setBusForm({
      registration_no: "",
      bus_type: "AC",
      total_seats: 40,
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
      assign_route: false,
    });
    setEditingBusId(bus.id);
    setIsAddBusOpen(true);
  };'''
content = content.replace(old_states, new_states)

# 3
old_handle = '''  const handleAddBus = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        registration_no: busForm.registration_no,
        bus_type: busForm.bus_type,
        total_seats: busForm.total_seats,
        seat_layout: {}, // Minimal mock payload
        amenities: ["WiFi", "Water"]
      };
      const res = await apiClient.post(`/api/operators/operators/${OPERATOR_ID}/buses`, payload);
      
      if (res.data.success) {
        const newBusId = res.data.data.id;
        toast.success("Bus added successfully");
        
        // If user wanted to assign a route right away
        if (busForm.assign_route && busForm.route_id && busForm.departure_datetime && busForm.arrival_datetime) {
          const tripPayload = {
            operator_id: OPERATOR_ID,
            bus_id: newBusId,
            route_id: busForm.route_id,
            departure_datetime: new Date(busForm.departure_datetime).toISOString(),
            arrival_datetime: new Date(busForm.arrival_datetime).toISOString(),
            fare_amount: busForm.fare_amount,
            available_seats: busForm.total_seats
          };
          await apiClient.post(`/api/operators/trips/`, tripPayload);
          toast.success("Bus mapped to route successfully");
        }

        setIsAddBusOpen(false);
        fetchData();
        setBusForm({
          registration_no: "",
          bus_type: "AC",
          total_seats: 40,
          assign_route: false,
          route_id: "",
          departure_datetime: "",
          arrival_datetime: "",
          fare_amount: 1000,
        });
      }
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Failed to add bus");
    }
  };'''

new_handle = '''  const handleAddBus = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        registration_no: busForm.registration_no,
        bus_type: busForm.bus_type,
        total_seats: busForm.total_seats,
        seat_layout: {}, // Minimal mock payload
        amenities: ["WiFi", "Water"]
      };

      if (editingBusId) {
        const res = await apiClient.put(`/api/operators/buses/${editingBusId}`, payload);
        if (res.data.success) {
          toast.success("Bus updated successfully");
          setIsAddBusOpen(false);
          fetchData();
        }
      } else {
        const res = await apiClient.post(`/api/operators/operators/${OPERATOR_ID}/buses`, payload);
        
        if (res.data.success) {
          const newBusId = res.data.data.id;
          toast.success("Bus added successfully");
          
          // If user wanted to assign a route right away
          if (busForm.assign_route && busForm.route_id && busForm.departure_datetime && busForm.arrival_datetime) {
            const tripPayload = {
              operator_id: OPERATOR_ID,
              bus_id: newBusId,
              route_id: busForm.route_id,
              departure_datetime: new Date(busForm.departure_datetime).toISOString(),
              arrival_datetime: new Date(busForm.arrival_datetime).toISOString(),
              fare_amount: busForm.fare_amount,
              available_seats: busForm.total_seats
            };
            await apiClient.post(`/api/operators/trips/`, tripPayload);
            toast.success("Bus mapped to route successfully");
          }

          setIsAddBusOpen(false);
          fetchData();
          setBusForm({
            registration_no: "",
            bus_type: "AC",
            total_seats: 40,
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
  };'''
content = content.replace(old_handle, new_handle)

# 4
content = content.replace(
    '<button onClick={() => setIsAddBusOpen(true)} className="btn-primary flex items-center gap-2 !py-2 !text-sm"><Plus className="w-4 h-4"/> Add Bus</button>',
    '<button onClick={openAddBus} className="btn-primary flex items-center gap-2 !py-2 !text-sm"><Plus className="w-4 h-4"/> Add Bus</button>'
)

# 5
old_table_headers = '''                  <th className="px-5 py-3 text-xs font-bold text-surface-500 uppercase">Seats</th>
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
                {buses.length === 0 && <tr><td colSpan={4} className="px-5 py-8 text-center text-surface-500">No buses found in fleet.</td></tr>}'''

new_table_headers = '''                  <th className="px-5 py-3 text-xs font-bold text-surface-500 uppercase">Seats</th>
                  <th className="px-5 py-3 text-xs font-bold text-surface-500 uppercase">Current Route</th>
                  <th className="px-5 py-3 text-xs font-bold text-surface-500 uppercase">Status</th>
                  <th className="px-5 py-3 text-xs font-bold text-surface-500 uppercase text-right">Actions</th>
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
                    <td className="px-5 py-4 text-sm"><span className="badge badge-success">Active</span></td>
                    <td className="px-5 py-4 text-sm text-right">
                      <button onClick={() => openEditBus(b)} className="p-2 text-surface-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors">
                        <Edit2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                  )
                })}
                {buses.length === 0 && <tr><td colSpan={6} className="px-5 py-8 text-center text-surface-500">No buses found in fleet.</td></tr>}'''

content = content.replace(old_table_headers, new_table_headers)

# 6
content = content.replace(
    '<h3 className="font-bold text-lg text-surface-900">Add New Bus</h3>',
    '<h3 className="font-bold text-lg text-surface-900">{editingBusId ? "Edit Bus" : "Add New Bus"}</h3>'
)

# 7
content = content.replace(
    '''              <div className="pt-2 border-t border-surface-100">
                <label className="flex items-center gap-2 text-sm font-semibold text-surface-900 cursor-pointer mb-2">''',
    '''              {!editingBusId && (
              <div className="pt-2 border-t border-surface-100">
                <label className="flex items-center gap-2 text-sm font-semibold text-surface-900 cursor-pointer mb-2">'''
)
content = content.replace(
    '''                    </div>
                  </div>
                )}
              </div>

              <button type="submit" className="btn-primary w-full mt-4">Save Bus</button>''',
    '''                    </div>
                  </div>
                )}
              </div>
              )}

              <button type="submit" className="btn-primary w-full mt-4">{editingBusId ? "Update Bus" : "Save Bus"}</button>'''
)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
print("Replaced successfully")
