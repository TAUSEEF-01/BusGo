import { useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import {
  ArrowRight,
  CheckCircle2,
  Edit2,
  GitBranch,
  MapPin,
  Percent,
  Plus,
  Power,
  Trash2,
  X,
} from "lucide-react";
import { apiClient } from "../api/client";
import { CityCombobox } from "../components/CityCombobox";
import { cityKey } from "../data/cityOptions";
import { useCityOptions } from "../hooks/useCityOptions";
import { useAuthStore } from "../stores/authStore";

interface TransitRoute {
  id: string;
  name: string;
  origin_city: string;
  destination_city: string;
  via_cities: string[];
  combined_discount_pct: number;
  is_active: boolean;
}

interface TransitRouteForm {
  name: string;
  origin_city: string;
  via_cities: string[];
  destination_city: string;
  combined_discount_pct: number;
}

const EMPTY_FORM: TransitRouteForm = {
  name: "",
  origin_city: "",
  via_cities: [""],
  destination_city: "",
  combined_discount_pct: 0,
};

function errorMessage(error: any, fallback: string) {
  const detail = error?.response?.data?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail[0]?.msg || fallback;
  return error?.response?.data?.message || error?.message || fallback;
}

export function OperatorTransitRoutes() {
  const { user } = useAuthStore();
  const [routes, setRoutes] = useState<TransitRoute[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [changingId, setChangingId] = useState<string | null>(null);
  const [form, setForm] = useState<TransitRouteForm>(EMPTY_FORM);

  const knownRouteCities = useMemo(
    () => routes.flatMap((route) => [route.origin_city, ...route.via_cities, route.destination_city]),
    [routes],
  );
  const { cities, loadingCities } = useCityOptions(knownRouteCities);

  const load = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get("/api/operators/transit-routes/mine");
      if (response.data.success) setRoutes(response.data.data || []);
      else toast.error(response.data.message || "Could not load your transit routes");
    } catch (error) {
      toast.error(errorMessage(error, "Could not load your transit routes"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const openEdit = (route: TransitRoute) => {
    setEditingId(route.id);
    setForm({
      name: route.name,
      origin_city: route.origin_city,
      via_cities: route.via_cities.length ? [...route.via_cities] : [""],
      destination_city: route.destination_city,
      combined_discount_pct: route.combined_discount_pct,
    });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const updateVia = (index: number, city: string) => {
    setForm((current) => ({
      ...current,
      via_cities: current.via_cities.map((item, itemIndex) => itemIndex === index ? city : item),
    }));
  };

  const validate = () => {
    const via = form.via_cities.filter(Boolean);
    if (!form.name.trim()) return "Enter a route name";
    if (!form.origin_city) return "Select an origin city from the dropdown";
    if (via.length === 0) return "Select at least one transit location";
    if (!form.destination_city) return "Select a destination city from the dropdown";
    const sequence = [form.origin_city, ...via, form.destination_city].map(cityKey);
    if (new Set(sequence).size !== sequence.length) return "Each location can appear only once in a transit route";
    if (form.combined_discount_pct < 0 || form.combined_discount_pct > 50) return "Discount must be between 0% and 50%";
    return null;
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving) return;
    const validationError = validate();
    if (validationError) {
      toast.error(validationError);
      return;
    }
    if (!editingId && !user?.id) {
      toast.error("Your operator session is missing. Please sign in again.");
      return;
    }

    const payload = {
      name: form.name.trim(),
      origin_city: form.origin_city,
      destination_city: form.destination_city,
      via_cities: form.via_cities.filter(Boolean),
      combined_discount_pct: Number(form.combined_discount_pct),
      ...(!editingId ? { operator_id: user!.id } : {}),
    };

    setSaving(true);
    try {
      const response = editingId
        ? await apiClient.put(`/api/operators/transit-routes/${editingId}`, payload)
        : await apiClient.post("/api/operators/transit-routes/", payload);
      if (!response.data.success) throw new Error(response.data.message || "Save failed");
      toast.success(editingId ? "Transit route updated" : "Transit route published");
      closeForm();
      await load();
    } catch (error) {
      toast.error(errorMessage(error, editingId ? "Could not update route" : "Could not publish route"));
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (route: TransitRoute) => {
    if (changingId) return;
    setChangingId(route.id);
    try {
      const response = await apiClient.put(`/api/operators/transit-routes/${route.id}`, {
        is_active: !route.is_active,
      });
      if (!response.data.success) throw new Error("Status update failed");
      setRoutes((current) => current.map((item) => item.id === route.id ? response.data.data : item));
      toast.success(route.is_active ? "Transit route paused" : "Transit route published");
    } catch (error) {
      toast.error(errorMessage(error, "Could not change route status"));
    } finally {
      setChangingId(null);
    }
  };

  const remove = async (route: TransitRoute) => {
    if (!confirm(`Delete “${route.name}”? This cannot be undone.`)) return;
    setChangingId(route.id);
    try {
      const response = await apiClient.delete(`/api/operators/transit-routes/${route.id}`);
      if (!response.data.success) throw new Error("Delete failed");
      toast.success("Transit route deleted");
      setRoutes((current) => current.filter((item) => item.id !== route.id));
      if (editingId === route.id) closeForm();
    } catch (error) {
      toast.error(errorMessage(error, "Could not delete route"));
    } finally {
      setChangingId(null);
    }
  };

  const selectedSequence = [form.origin_city, ...form.via_cities.filter(Boolean), form.destination_city].filter(Boolean);

  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-extrabold text-surface-900">
            <GitBranch className="h-6 w-6 text-brand-600" /> Transit Routes
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-surface-500">
            Build ordered connecting journeys for passengers. Select one or two transit locations and optionally offer a combined-fare discount.
          </p>
        </div>
        <button onClick={showForm ? closeForm : openCreate} className={showForm ? "btn-secondary flex items-center gap-2" : "btn-primary flex items-center gap-2"}>
          {showForm ? <><X className="h-4 w-4" /> Close</> : <><Plus className="h-4 w-4" /> New transit route</>}
        </button>
      </div>

      {showForm && (
        <form onSubmit={save} className="card-premium mb-7 overflow-visible p-6">
          <div className="mb-5 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-surface-900">{editingId ? "Edit transit route" : "Create transit route"}</h2>
              <p className="mt-1 text-xs text-surface-500">Locations are saved in travel order. Each city can be selected only once.</p>
            </div>
            {loadingCities && <span className="text-xs text-surface-400">Refreshing city list…</span>}
          </div>

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_180px]">
            <div>
              <label htmlFor="transit-route-name" className="mb-1.5 block text-sm font-semibold text-surface-700">Route name</label>
              <input
                id="transit-route-name"
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                className="input-premium w-full"
                placeholder="Dhaka–Sylhet Express Connection"
                maxLength={120}
                required
              />
            </div>
            <div>
              <label htmlFor="transit-discount" className="mb-1.5 block text-sm font-semibold text-surface-700">Combined discount</label>
              <div className="relative">
                <Percent className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
                <input
                  id="transit-discount"
                  type="number"
                  min={0}
                  max={50}
                  step={0.5}
                  value={form.combined_discount_pct}
                  onChange={(event) => setForm({ ...form, combined_discount_pct: Number(event.target.value) })}
                  className="input-premium w-full pr-9"
                />
              </div>
            </div>
          </div>

          <div className="my-6 rounded-2xl border border-surface-200 bg-surface-50/70 p-4 sm:p-5">
            <div className="grid gap-4 lg:grid-cols-4">
              <div>
                <div className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-surface-700">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-600 text-[11px] text-white">1</span> Origin
                </div>
                <CityCombobox
                  id="transit-origin"
                  ariaLabel="Origin city"
                  value={form.origin_city}
                  onChange={(city) => setForm({ ...form, origin_city: city })}
                  options={cities}
                  excludedCities={[...form.via_cities, form.destination_city]}
                  placeholder="Select origin"
                  required
                />
              </div>

              {form.via_cities.map((via, index) => (
                <div key={`via-${index}`}>
                  <div className="mb-1.5 flex items-center justify-between gap-2 text-sm font-semibold text-surface-700">
                    <span className="flex items-center gap-2">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-[11px] text-white">{index + 2}</span>
                      Transit {index + 1}{index === 1 && <span className="font-normal text-surface-400">(optional)</span>}
                    </span>
                    {index === 1 && (
                      <button type="button" onClick={() => setForm({ ...form, via_cities: form.via_cities.slice(0, 1) })} className="text-surface-400 hover:text-red-500" aria-label="Remove second transit stop">
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  <CityCombobox
                    id={`transit-via-${index}`}
                    ariaLabel={`Transit location ${index + 1}`}
                    value={via}
                    onChange={(city) => updateVia(index, city)}
                    options={cities}
                    excludedCities={[form.origin_city, form.destination_city, ...form.via_cities.filter((_, itemIndex) => itemIndex !== index)]}
                    placeholder="Select transit city"
                    required={index === 0}
                  />
                </div>
              ))}

              <div>
                <div className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-surface-700">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-[11px] text-white">{form.via_cities.length + 2}</span> Destination
                </div>
                <CityCombobox
                  id="transit-destination"
                  ariaLabel="Destination city"
                  value={form.destination_city}
                  onChange={(city) => setForm({ ...form, destination_city: city })}
                  options={cities}
                  excludedCities={[form.origin_city, ...form.via_cities]}
                  placeholder="Select destination"
                  required
                />
              </div>
            </div>

            {form.via_cities.length < 2 && (
              <button
                type="button"
                onClick={() => setForm({ ...form, via_cities: [...form.via_cities, ""] })}
                className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold text-brand-700 hover:text-brand-800"
              >
                <Plus className="h-3.5 w-3.5" /> Add a second transit location
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="min-h-9">
              {selectedSequence.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 text-sm text-surface-600" aria-label="Route preview">
                  <span className="font-semibold text-surface-500">Preview:</span>
                  {selectedSequence.map((city, index) => (
                    <span key={`${city}-${index}`} className="contents">
                      <span className="rounded-full border border-surface-200 bg-white px-2.5 py-1 font-medium">{city}</span>
                      {index < selectedSequence.length - 1 && <ArrowRight className="h-3.5 w-3.5 text-surface-400" />}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={closeForm} className="btn-secondary px-5 py-2.5">Cancel</button>
              <button type="submit" disabled={saving} className="btn-primary min-w-36 px-5 py-2.5 disabled:opacity-50">
                {saving ? "Saving…" : editingId ? "Save changes" : "Publish route"}
              </button>
            </div>
          </div>
        </form>
      )}

      {loading ? (
        <div className="flex justify-center py-16"><div className="h-7 w-7 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" /></div>
      ) : routes.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-surface-200 py-16 text-center">
          <GitBranch className="mx-auto mb-3 h-10 w-10 text-surface-300" />
          <p className="font-semibold text-surface-700">No transit routes yet</p>
          <p className="mt-1 text-sm text-surface-500">Create a route to offer passengers a curated connecting journey.</p>
          <button onClick={openCreate} className="btn-primary mt-5 inline-flex items-center gap-2"><Plus className="h-4 w-4" /> Create first route</button>
        </div>
      ) : (
        <div className="space-y-4">
          {routes.map((route) => {
            const sequence = [route.origin_city, ...route.via_cities, route.destination_city];
            return (
              <article key={route.id} className={`card-premium overflow-hidden transition-opacity ${route.is_active ? "" : "opacity-75"}`}>
                <div className="flex flex-wrap items-start justify-between gap-4 p-5">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-bold text-surface-900">{route.name}</h3>
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${route.is_active ? "bg-emerald-50 text-emerald-700" : "bg-surface-100 text-surface-500"}`}>
                        {route.is_active ? <CheckCircle2 className="h-3 w-3" /> : <Power className="h-3 w-3" />}
                        {route.is_active ? "Published" : "Paused"}
                      </span>
                      {route.combined_discount_pct > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-1 text-xs font-bold text-brand-700">
                          <Percent className="h-3 w-3" /> {route.combined_discount_pct}% combined discount
                        </span>
                      )}
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-surface-700">
                      {sequence.map((city, index) => (
                        <span key={`${route.id}-${city}-${index}`} className="contents">
                          <span className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-medium ${index > 0 && index < sequence.length - 1 ? "bg-amber-50 text-amber-800" : "bg-surface-100"}`}>
                            <MapPin className="h-3.5 w-3.5" /> {city}
                          </span>
                          {index < sequence.length - 1 && <ArrowRight className="h-4 w-4 text-surface-400" />}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={route.is_active}
                      disabled={changingId === route.id}
                      onClick={() => toggleStatus(route)}
                      className={`mr-2 inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold transition-colors disabled:opacity-50 ${route.is_active ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100" : "bg-surface-100 text-surface-600 hover:bg-surface-200"}`}
                      title={route.is_active ? "Pause this route" : "Publish this route"}
                    >
                      <span className={`relative h-4 w-7 rounded-full transition-colors ${route.is_active ? "bg-emerald-500" : "bg-surface-300"}`}>
                        <span className={`absolute top-0.5 h-3 w-3 rounded-full bg-white shadow-sm transition-transform ${route.is_active ? "translate-x-3.5" : "translate-x-0.5"}`} />
                      </span>
                      {route.is_active ? "Live" : "Paused"}
                    </button>
                    <button onClick={() => openEdit(route)} className="rounded-lg p-2.5 text-surface-500 hover:bg-brand-50 hover:text-brand-700" aria-label={`Edit ${route.name}`} title="Edit route">
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button disabled={changingId === route.id} onClick={() => remove(route)} className="rounded-lg p-2.5 text-surface-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50" aria-label={`Delete ${route.name}`} title="Delete route">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
