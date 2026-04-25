import os

path = 'busgo/frontend/src/pages/ManageTrips.tsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add Trash2 icon
content = content.replace(
    'import { Bus, Map, Clock, Plus, Loader2, X, Edit2 } from "lucide-react";',
    'import { Bus, Map, Clock, Plus, Loader2, X, Edit2, Trash2 } from "lucide-react";'
)

# 2. Add is_active to busForm
content = content.replace(
    '''  const [busForm, setBusForm] = useState({
    registration_no: "",
    bus_type: "AC",
    total_seats: 40,
    assign_route: false,''',
    '''  const [busForm, setBusForm] = useState({
    registration_no: "",
    bus_type: "AC",
    total_seats: 40,
    is_active: true,
    assign_route: false,'''
)

# 3. Update openAddBus
content = content.replace(
    '''    setBusForm({
      registration_no: "",
      bus_type: "AC",
      total_seats: 40,
      assign_route: false,''',
    '''    setBusForm({
      registration_no: "",
      bus_type: "AC",
      total_seats: 40,
      is_active: true,
      assign_route: false,'''
)

# 4. Update openEditBus
content = content.replace(
    '''    setBusForm({
      ...busForm,
      registration_no: bus.registration_no,
      bus_type: bus.bus_type,
      total_seats: bus.total_seats,
      assign_route: false,
    });''',
    '''    setBusForm({
      ...busForm,
      registration_no: bus.registration_no,
      bus_type: bus.bus_type,
      total_seats: bus.total_seats,
      is_active: bus.is_active !== undefined ? bus.is_active : true,
      assign_route: false,
    });'''
)

# 5. Update payload in handleAddBus
content = content.replace(
    '''      const payload = {
        registration_no: busForm.registration_no,
        bus_type: busForm.bus_type,
        total_seats: busForm.total_seats,
        seat_layout: {}, // Minimal mock payload
        amenities: ["WiFi", "Water"]
      };''',
    '''      const payload = {
        registration_no: busForm.registration_no,
        bus_type: busForm.bus_type,
        total_seats: busForm.total_seats,
        is_active: busForm.is_active,
        seat_layout: {}, // Minimal mock payload
        amenities: ["WiFi", "Water"]
      };'''
)

# 6. Add deleteBus and deleteRoute functions right before handleAddBus
delete_funcs = '''  const handleDeleteBus = async (id: string) => {
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

  const handleAddBus'''
content = content.replace('  const handleAddBus', delete_funcs)

# 7. Update bus status badge and add delete button
old_bus_row = '''                    <td className="px-5 py-4 text-sm"><span className="badge badge-success">Active</span></td>
                    <td className="px-5 py-4 text-sm text-right">
                      <button onClick={() => openEditBus(b)} className="p-2 text-surface-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors">
                        <Edit2 className="w-4 h-4" />
                      </button>
                    </td>'''
new_bus_row = '''                    <td className="px-5 py-4 text-sm">
                      {b.is_active === false ? <span className="badge badge-error">Unavailable</span> : <span className="badge badge-success">Active</span>}
                    </td>
                    <td className="px-5 py-4 text-sm text-right">
                      <button onClick={() => openEditBus(b)} className="p-2 text-surface-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDeleteBus(b.id)} className="p-2 text-surface-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors ml-2">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>'''
content = content.replace(old_bus_row, new_bus_row)

# 8. Add actions column and delete button to routes
old_route_head = '''                  <th className="px-5 py-3 text-xs font-bold text-surface-500 uppercase">Origin</th>
                  <th className="px-5 py-3 text-xs font-bold text-surface-500 uppercase">Destination</th>
                  <th className="px-5 py-3 text-xs font-bold text-surface-500 uppercase">Distance</th>
                </tr>'''
new_route_head = '''                  <th className="px-5 py-3 text-xs font-bold text-surface-500 uppercase">Origin</th>
                  <th className="px-5 py-3 text-xs font-bold text-surface-500 uppercase">Destination</th>
                  <th className="px-5 py-3 text-xs font-bold text-surface-500 uppercase">Distance</th>
                  <th className="px-5 py-3 text-xs font-bold text-surface-500 uppercase text-right">Actions</th>
                </tr>'''
content = content.replace(old_route_head, new_route_head)

old_route_row = '''                    <td className="px-5 py-4 text-sm font-bold text-surface-900">{r.origin_city}</td>
                    <td className="px-5 py-4 text-sm font-bold text-surface-900">{r.destination_city}</td>
                    <td className="px-5 py-4 text-sm text-surface-600">{r.distance_km} km</td>
                  </tr>'''
new_route_row = '''                    <td className="px-5 py-4 text-sm font-bold text-surface-900">{r.origin_city}</td>
                    <td className="px-5 py-4 text-sm font-bold text-surface-900">{r.destination_city}</td>
                    <td className="px-5 py-4 text-sm text-surface-600">{r.distance_km} km</td>
                    <td className="px-5 py-4 text-sm text-right">
                      <button onClick={() => handleDeleteRoute(r.id)} className="p-2 text-surface-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>'''
content = content.replace(old_route_row, new_route_row)

# 9. Re-enable routing in edit bus form and add is_active checkbox
content = content.replace('{!editingBusId && (', '')
content = content.replace(')}', '}', 1) # This matches the closing bracket of the {!editingBusId && (...)} which we need to remove. Actually wait.
# It's safer to just replace the exact block.

# Let's read the current block
import re
block_to_replace = r'''              {!editingBusId && \(
              <div className="pt-2 border-t border-surface-100">
                <label className="flex items-center gap-2 text-sm font-semibold text-surface-900 cursor-pointer mb-2">
                  <input 
                    type="checkbox" 
                    className="rounded border-surface-300 text-brand-600 focus:ring-brand-500 w-4 h-4"
                    checked=\{busForm\.assign_route\}
                    onChange=\{e => setBusForm\(\{\.\.\.busForm, assign_route: e\.target\.checked\}\)\}
                  />
                  Schedule a trip for this bus now\?
                </label>

                \{busForm\.assign_route && \(
                  <div className="space-y-4 mt-3 bg-surface-50 p-4 rounded-xl border border-surface-100">
                    <div>
                      <label className="block text-sm font-semibold text-surface-700 mb-1">Select Route</label>
                      <select required=\{busForm\.assign_route\} className="input-premium w-full" value=\{busForm\.route_id\} onChange=\{e => setBusForm\(\{\.\.\.busForm, route_id: e\.target\.value\}\)\}>
                        <option value="">\{\routes\.length === 0 \? "-- No routes available, add one first --" : "-- Choose Route --"\}</option>
                        \{\routes\.map\(r => <option key=\{r\.id\} value=\{r\.id\}>\{r\.origin_city\} to \{r\.destination_city\}</option>\)\}
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-surface-700 mb-1">Departure Time</label>
                        <input type="datetime-local" required=\{busForm\.assign_route\} className="input-premium w-full" value=\{busForm\.departure_datetime\} onChange=\{e => setBusForm\(\{\.\.\.busForm, departure_datetime: e\.target\.value\}\)\} />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-surface-700 mb-1">Arrival Time</label>
                        <input type="datetime-local" required=\{busForm\.assign_route\} className="input-premium w-full" value=\{busForm\.arrival_datetime\} onChange=\{e => setBusForm\(\{\.\.\.busForm, arrival_datetime: e\.target\.value\}\)\} />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-surface-700 mb-1">Fare Amount \(৳\)</label>
                      <input type="number" required=\{busForm\.assign_route\} className="input-premium w-full" value=\{busForm\.fare_amount\} onChange=\{e => setBusForm\(\{\.\.\.busForm, fare_amount: parseInt\(e\.target\.value\)\)\} min="100" />
                    </div>
                  </div>
                \)\}
              </div>
              \)\}'''

new_block = '''              <div className="pt-2 border-t border-surface-100">
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
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-surface-700 mb-1">Departure Time</label>
                        <input type="datetime-local" required={busForm.assign_route} className="input-premium w-full" value={busForm.departure_datetime} onChange={e => setBusForm({...busForm, departure_datetime: e.target.value})} />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-surface-700 mb-1">Arrival Time</label>
                        <input type="datetime-local" required={busForm.assign_route} className="input-premium w-full" value={busForm.arrival_datetime} onChange={e => setBusForm({...busForm, arrival_datetime: e.target.value})} />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-surface-700 mb-1">Fare Amount (৳)</label>
                      <input type="number" required={busForm.assign_route} className="input-premium w-full" value={busForm.fare_amount} onChange={e => setBusForm({...busForm, fare_amount: parseInt(e.target.value)})} min="100" />
                    </div>
                  </div>
                )}
              </div>'''

content = re.sub(block_to_replace, new_block, content)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated successfully")
