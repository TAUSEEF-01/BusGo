import { useState, useEffect } from "react";
import { apiClient } from "../api/client";
import { useAuthStore } from "../stores/authStore";
import { toast } from "react-hot-toast";
import { GitBranch, Plus, Trash2, Percent, X, MapPin } from "lucide-react";

interface TransitRoute {
  id: string;
  name: string;
  origin_city: string;
  destination_city: string;
  via_cities: string[];
  combined_discount_pct: number;
  is_active: boolean;
}

export function OperatorTransitRoutes() {
  const { user } = useAuthStore();
  const [routes, setRoutes] = useState<TransitRoute[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", origin_city: "", via: "", destination_city: "", combined_discount_pct: 0 });

  const load = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get("/api/operators/transit-routes/mine");
      if (res.data.success) setRoutes(res.data.data || []);
    } catch {
      toast.error("Could not load your transit routes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    apiClient.get("/api/search/cities").then((r) => { if (r.data.success) setCities(r.data.data.sort()); }).catch(() => {});
  }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    const via = form.via.split(",").map((c) => c.trim()).filter(Boolean);
    if (!form.name || !form.origin_city || !form.destination_city || via.length === 0) {
      toast.error("Fill name, origin, at least one via city, and destination");
      return;
    }
    setSaving(true);
    try {
      const res = await apiClient.post("/api/operators/transit-routes/", {
        name: form.name, origin_city: form.origin_city, destination_city: form.destination_city,
        via_cities: via, combined_discount_pct: Number(form.combined_discount_pct), operator_id: user?.id,
      });
      if (res.data.success) {
        toast.success("Transit route published");
        setShowForm(false);
        setForm({ name: "", origin_city: "", via: "", destination_city: "", combined_discount_pct: 0 });
        load();
      } else {
        toast.error(res.data.message || "Could not create route");
      }
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Could not create route");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this transit route?")) return;
    try {
      await apiClient.delete(`/api/operators/transit-routes/${id}`);
      toast.success("Route deleted");
      setRoutes((r) => r.filter((x) => x.id !== id));
    } catch {
      toast.error("Delete failed");
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-extrabold text-surface-900 flex items-center gap-2">
            <GitBranch className="h-6 w-6 text-brand-600" /> Transit Routes
          </h1>
          <p className="text-surface-500 text-sm mt-1 max-w-2xl">
            Publish curated connecting journeys (e.g. Dhaka → Comilla → Sylhet). Passengers see these as
            guaranteed connections, ranked above auto-discovered ones, with your combined-fare discount.
          </p>
        </div>
        <button onClick={() => setShowForm((s) => !s)} className="btn-primary flex items-center gap-2">
          {showForm ? <><X className="h-4 w-4" /> Cancel</> : <><Plus className="h-4 w-4" /> New Route</>}
        </button>
      </div>

      {showForm && (
        <form onSubmit={create} className="card-premium p-6 mb-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-surface-600 mb-1">Route name</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input-premium !py-2" placeholder="Dhaka–Sylhet Express Connection" />
          </div>
          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-surface-600 mb-1">Origin</label>
              <input list="cities" value={form.origin_city} onChange={(e) => setForm({ ...form, origin_city: e.target.value })} className="input-premium !py-2" placeholder="Dhaka" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-surface-600 mb-1">Via (comma-separated, 1–2)</label>
              <input value={form.via} onChange={(e) => setForm({ ...form, via: e.target.value })} className="input-premium !py-2" placeholder="Comilla" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-surface-600 mb-1">Destination</label>
              <input list="cities" value={form.destination_city} onChange={(e) => setForm({ ...form, destination_city: e.target.value })} className="input-premium !py-2" placeholder="Sylhet" />
            </div>
          </div>
          <datalist id="cities">{cities.map((c) => <option key={c} value={c} />)}</datalist>
          <div className="flex items-end gap-4">
            <div>
              <label className="block text-xs font-semibold text-surface-600 mb-1">Combined discount %</label>
              <input type="number" min={0} max={50} value={form.combined_discount_pct} onChange={(e) => setForm({ ...form, combined_discount_pct: Number(e.target.value) })} className="input-premium !w-32 !py-2" />
            </div>
            <button type="submit" disabled={saving} className="btn-primary disabled:opacity-50">{saving ? "Saving..." : "Publish route"}</button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-brand-200 border-t-brand-600 rounded-full animate-spin" /></div>
      ) : routes.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-surface-200 rounded-2xl">
          <GitBranch className="h-10 w-10 text-surface-300 mx-auto mb-3" />
          <p className="text-surface-500 font-medium">No transit routes yet. Publish one to offer connecting journeys.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {routes.map((r) => (
            <div key={r.id} className="card-premium p-5 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="font-bold text-surface-900">{r.name}</p>
                <div className="flex items-center gap-1.5 text-sm text-surface-600 mt-1 flex-wrap">
                  <MapPin className="h-3.5 w-3.5 text-surface-400" />
                  {[r.origin_city, ...r.via_cities, r.destination_city].join(" → ")}
                </div>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                {r.combined_discount_pct > 0 && (
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-full">
                    <Percent className="h-3 w-3" />{r.combined_discount_pct}% off
                  </span>
                )}
                <span className={`text-xs font-semibold px-2 py-1 rounded-full ${r.is_active ? "bg-brand-50 text-brand-700" : "bg-surface-100 text-surface-500"}`}>{r.is_active ? "Active" : "Inactive"}</span>
                <button onClick={() => remove(r.id)} className="p-2 text-surface-400 hover:text-red-500"><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
