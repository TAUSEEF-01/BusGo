import { useState, useEffect } from "react";
import { useAuthStore } from "../stores/authStore";
import { apiClient } from "../api/client";
import { toast } from "react-hot-toast";
import {
  Tag, Zap, Plus, Pencil, Trash2, Eye, EyeOff, Copy, Check,
  Clock, Percent, BadgePercent,
} from "lucide-react";

/* ─── Types ─────────────────────────────────────────── */
interface PromoCode {
  id: string;
  code: string;
  title: string | null;
  description: string | null;
  discount_type: "PERCENTAGE" | "FLAT";
  discount_value: number;
  min_fare: number;
  max_discount: number | null;
  valid_from: string;
  valid_until: string;
  max_uses: number;
  current_uses: number;
  is_active: boolean;
  operator_id: string | null;
}

interface FlashSale {
  id: string;
  name: string;
  description: string | null;
  discount_percentage: number;
  start_time: string;
  end_time: string;
  applicable_trips: string[];
  applicable_routes: string[];
  is_active: boolean;
  operator_id: string | null;
}

const EMPTY_PROMO_FORM = {
  title: "",
  code: "",
  discount_type: "PERCENTAGE" as "PERCENTAGE" | "FLAT",
  discount_value: 10,
  min_fare: 0,
  max_discount: "",
  valid_from: "",
  valid_until: "",
  max_uses: 100,
  is_active: true,
};

const EMPTY_FLASH_FORM = {
  name: "",
  description: "",
  discount_percentage: 10,
  start_time: "",
  end_time: "",
  is_active: true,
};

/* ─── Helpers ───────────────────────────────────────── */
function formatDateLocal(iso: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function countdown(end: string) {
  const diff = new Date(end).getTime() - Date.now();
  if (diff <= 0) return "Ended";
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (h > 48) return `${Math.floor(h / 24)}d left`;
  return `${h}h ${m}m left`;
}

/* ─── PromoSection ──────────────────────────────────── */
function PromoSection({
  promos,
  loading,
  onRefresh,
  operatorId,
}: {
  promos: PromoCode[];
  loading: boolean;
  onRefresh: () => void;
  operatorId: string;
}) {
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_PROMO_FORM });
  const [saving, setSaving] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const resetForm = () => {
    setForm({ ...EMPTY_PROMO_FORM });
    setEditId(null);
  };

  const openCreate = () => {
    resetForm();
    setShowForm(true);
  };

  const openEdit = (p: PromoCode) => {
    setForm({
      title: p.title || "",
      code: p.code,
      discount_type: p.discount_type,
      discount_value: p.discount_value,
      min_fare: p.min_fare,
      max_discount: p.max_discount != null ? String(p.max_discount) : "",
      valid_from: p.valid_from.slice(0, 16),
      valid_until: p.valid_until.slice(0, 16),
      max_uses: p.max_uses,
      is_active: p.is_active,
    });
    setEditId(p.id);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.code.trim()) { toast.error("Code is required"); return; }
    if (!form.valid_from || !form.valid_until) { toast.error("Valid dates are required"); return; }
    setSaving(true);
    try {
      const payload: any = {
        ...form,
        code: form.code.toUpperCase(),
        max_discount: form.max_discount !== "" ? parseFloat(String(form.max_discount)) : null,
        operator_id: operatorId,
        applicable_operators: [],
      };
      if (editId) {
        await apiClient.put(`/api/deals/promos/${editId}`, payload);
        toast.success("Promo updated!");
      } else {
        await apiClient.post(`/api/deals/promos/`, payload);
        toast.success("Promo created!");
      }
      setShowForm(false);
      resetForm();
      onRefresh();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Failed to save promo");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this promo code?")) return;
    try {
      await apiClient.delete(`/api/deals/promos/${id}`);
      toast.success("Promo deleted");
      onRefresh();
    } catch {
      toast.error("Failed to delete promo");
    }
  };

  const handleToggleActive = async (p: PromoCode) => {
    try {
      await apiClient.put(`/api/deals/promos/${p.id}`, { is_active: !p.is_active });
      toast.success(p.is_active ? "Promo deactivated" : "Promo activated");
      onRefresh();
    } catch {
      toast.error("Failed to update status");
    }
  };

  const copyCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-surface-500">{promos.length} promo code{promos.length !== 1 ? "s" : ""}</p>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2 !py-2 !px-4 text-sm">
          <Plus className="h-4 w-4" /> Create New Promo
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="card-premium p-6 border border-brand-200 animate-fade-in">
          <h3 className="font-bold text-surface-900 mb-4">{editId ? "Edit Promo Code" : "New Promo Code"}</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-surface-700 mb-1.5">Title</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g. Summer Special"
                  className="input-premium w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-surface-700 mb-1.5">Code *</label>
                <input
                  type="text"
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                  placeholder="e.g. SUMMER20"
                  className="input-premium w-full font-mono uppercase"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-surface-700 mb-1.5">Discount Type</label>
                <div className="flex gap-2">
                  {(["PERCENTAGE", "FLAT"] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setForm({ ...form, discount_type: t })}
                      className={`flex-1 py-2 px-3 rounded-lg text-sm font-semibold border transition-all ${
                        form.discount_type === t
                          ? "bg-brand-600 text-white border-brand-600 shadow-brand"
                          : "bg-white text-surface-600 border-surface-200 hover:border-brand-300"
                      }`}
                    >
                      {t === "PERCENTAGE" ? "% Percentage" : "৳ Flat"}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-surface-700 mb-1.5">
                  Discount Value {form.discount_type === "PERCENTAGE" ? "(%)" : "(৳)"}
                </label>
                <input
                  type="number"
                  min={0}
                  value={form.discount_value}
                  onChange={(e) => setForm({ ...form, discount_value: parseFloat(e.target.value) || 0 })}
                  className="input-premium w-full"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-surface-700 mb-1.5">Min Fare (৳)</label>
                <input
                  type="number"
                  min={0}
                  value={form.min_fare}
                  onChange={(e) => setForm({ ...form, min_fare: parseFloat(e.target.value) || 0 })}
                  className="input-premium w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-surface-700 mb-1.5">Max Discount (৳) <span className="text-surface-400 font-normal">optional</span></label>
                <input
                  type="number"
                  min={0}
                  value={form.max_discount}
                  onChange={(e) => setForm({ ...form, max_discount: e.target.value })}
                  placeholder="No cap"
                  className="input-premium w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-surface-700 mb-1.5">Valid From *</label>
                <input
                  type="datetime-local"
                  value={form.valid_from}
                  onChange={(e) => setForm({ ...form, valid_from: e.target.value })}
                  className="input-premium w-full"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-surface-700 mb-1.5">Valid Until *</label>
                <input
                  type="datetime-local"
                  value={form.valid_until}
                  onChange={(e) => setForm({ ...form, valid_until: e.target.value })}
                  className="input-premium w-full"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-surface-700 mb-1.5">Max Uses</label>
                <input
                  type="number"
                  min={1}
                  value={form.max_uses}
                  onChange={(e) => setForm({ ...form, max_uses: parseInt(e.target.value) || 1 })}
                  className="input-premium w-full"
                  required
                />
              </div>
              <div className="flex items-center gap-3 pt-6">
                <button
                  type="button"
                  onClick={() => setForm({ ...form, is_active: !form.is_active })}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.is_active ? "bg-brand-600" : "bg-surface-300"}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${form.is_active ? "translate-x-6" : "translate-x-1"}`} />
                </button>
                <span className="text-sm font-medium text-surface-700">{form.is_active ? "Active" : "Inactive"}</span>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button type="submit" disabled={saving} className="btn-primary flex items-center gap-2 !py-2 !px-5 text-sm">
                {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : null}
                {editId ? "Save Changes" : "Create Promo"}
              </button>
              <button type="button" onClick={() => { setShowForm(false); resetForm(); }} className="btn-secondary !py-2 !px-5 text-sm">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-10 h-10 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
        </div>
      ) : promos.length === 0 ? (
        <div className="card-premium p-12 text-center">
          <div className="w-14 h-14 rounded-2xl bg-surface-100 flex items-center justify-center mx-auto mb-3">
            <Tag className="h-7 w-7 text-surface-400" />
          </div>
          <p className="font-semibold text-surface-700">No promo codes yet</p>
          <p className="text-sm text-surface-400 mt-1">Create your first promo code to attract more passengers.</p>
        </div>
      ) : (
        <div className="card-premium overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-surface-50 text-left">
                  <th className="px-5 py-3 text-xs font-bold text-surface-500 uppercase tracking-wider">Code</th>
                  <th className="px-5 py-3 text-xs font-bold text-surface-500 uppercase tracking-wider">Discount</th>
                  <th className="px-5 py-3 text-xs font-bold text-surface-500 uppercase tracking-wider">Uses</th>
                  <th className="px-5 py-3 text-xs font-bold text-surface-500 uppercase tracking-wider">Valid Until</th>
                  <th className="px-5 py-3 text-xs font-bold text-surface-500 uppercase tracking-wider">Status</th>
                  <th className="px-5 py-3 text-xs font-bold text-surface-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100">
                {promos.map((p) => (
                  <tr key={p.id} className="hover:bg-surface-50 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-surface-900 text-sm">{p.code}</span>
                        <button
                          onClick={() => copyCode(p.code, p.id)}
                          className="p-1 text-surface-400 hover:text-brand-600 rounded transition-colors"
                          title="Copy code"
                        >
                          {copiedId === p.id ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                      {p.title && <p className="text-xs text-surface-400 mt-0.5">{p.title}</p>}
                    </td>
                    <td className="px-5 py-3.5 text-sm font-semibold text-surface-700">
                      {p.discount_type === "PERCENTAGE"
                        ? `${p.discount_value}%`
                        : `৳ ${p.discount_value}`}
                      {p.max_discount && <span className="text-xs text-surface-400 ml-1">(max ৳{p.max_discount})</span>}
                    </td>
                    <td className="px-5 py-3.5 text-sm text-surface-600">
                      <span className="font-semibold">{p.current_uses}</span>
                      <span className="text-surface-400"> / {p.max_uses}</span>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-surface-600">{formatDateLocal(p.valid_until)}</td>
                    <td className="px-5 py-3.5">
                      <span className={`badge text-[10px] ${p.is_active ? "badge-success" : "badge-error"}`}>
                        {p.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleToggleActive(p)}
                          title={p.is_active ? "Deactivate" : "Activate"}
                          className="p-1.5 rounded-lg text-surface-400 hover:text-brand-600 hover:bg-brand-50 transition-all"
                        >
                          {p.is_active ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                        <button
                          onClick={() => openEdit(p)}
                          title="Edit"
                          className="p-1.5 rounded-lg text-surface-400 hover:text-brand-600 hover:bg-brand-50 transition-all"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(p.id)}
                          title="Delete"
                          className="p-1.5 rounded-lg text-surface-400 hover:text-red-600 hover:bg-red-50 transition-all"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── FlashSection ──────────────────────────────────── */
function FlashSection({
  sales,
  loading,
  onRefresh,
  operatorId,
}: {
  sales: FlashSale[];
  loading: boolean;
  onRefresh: () => void;
  operatorId: string;
}) {
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FLASH_FORM });
  const [saving, setSaving] = useState(false);

  const resetForm = () => { setForm({ ...EMPTY_FLASH_FORM }); setEditId(null); };

  const openCreate = () => { resetForm(); setShowForm(true); };

  const openEdit = (s: FlashSale) => {
    setForm({
      name: s.name,
      description: s.description || "",
      discount_percentage: s.discount_percentage,
      start_time: s.start_time.slice(0, 16),
      end_time: s.end_time.slice(0, 16),
      is_active: s.is_active,
    });
    setEditId(s.id);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error("Name is required"); return; }
    if (!form.start_time || !form.end_time) { toast.error("Start and end times are required"); return; }
    if (form.discount_percentage < 1 || form.discount_percentage > 100) {
      toast.error("Discount must be between 1% and 100%");
      return;
    }
    setSaving(true);
    try {
      const payload = { ...form, operator_id: operatorId };
      if (editId) {
        await apiClient.put(`/api/deals/flash-sales/${editId}`, payload);
        toast.success("Flash sale updated!");
      } else {
        await apiClient.post(`/api/deals/flash-sales/`, payload);
        toast.success("Flash sale created!");
      }
      setShowForm(false);
      resetForm();
      onRefresh();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Failed to save flash sale");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this flash sale?")) return;
    try {
      await apiClient.delete(`/api/deals/flash-sales/${id}`);
      toast.success("Flash sale deleted");
      onRefresh();
    } catch {
      toast.error("Failed to delete flash sale");
    }
  };

  const handleToggleActive = async (s: FlashSale) => {
    try {
      await apiClient.put(`/api/deals/flash-sales/${s.id}`, { is_active: !s.is_active });
      toast.success(s.is_active ? "Flash sale deactivated" : "Flash sale activated");
      onRefresh();
    } catch {
      toast.error("Failed to update status");
    }
  };

  const isLive = (s: FlashSale) => {
    const now = Date.now();
    return s.is_active && new Date(s.start_time).getTime() <= now && new Date(s.end_time).getTime() >= now;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-surface-500">{sales.length} flash sale{sales.length !== 1 ? "s" : ""}</p>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2 !py-2 !px-4 text-sm">
          <Plus className="h-4 w-4" /> Create Flash Sale
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="card-premium p-6 border border-brand-200 animate-fade-in">
          <h3 className="font-bold text-surface-900 mb-4">{editId ? "Edit Flash Sale" : "New Flash Sale"}</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-surface-700 mb-1.5">Name *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Eid Special Flash Sale"
                  className="input-premium w-full"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-surface-700 mb-1.5">Discount (%) *</label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={form.discount_percentage}
                  onChange={(e) => setForm({ ...form, discount_percentage: parseInt(e.target.value) || 0 })}
                  className="input-premium w-full"
                  required
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-surface-700 mb-1.5">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Brief description of this flash sale..."
                  className="input-premium w-full min-h-[70px]"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-surface-700 mb-1.5">Start Time *</label>
                <input
                  type="datetime-local"
                  value={form.start_time}
                  onChange={(e) => setForm({ ...form, start_time: e.target.value })}
                  className="input-premium w-full"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-surface-700 mb-1.5">End Time *</label>
                <input
                  type="datetime-local"
                  value={form.end_time}
                  onChange={(e) => setForm({ ...form, end_time: e.target.value })}
                  className="input-premium w-full"
                  required
                />
              </div>
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setForm({ ...form, is_active: !form.is_active })}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.is_active ? "bg-brand-600" : "bg-surface-300"}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${form.is_active ? "translate-x-6" : "translate-x-1"}`} />
                </button>
                <span className="text-sm font-medium text-surface-700">{form.is_active ? "Active" : "Inactive"}</span>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button type="submit" disabled={saving} className="btn-primary flex items-center gap-2 !py-2 !px-5 text-sm">
                {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : null}
                {editId ? "Save Changes" : "Create Flash Sale"}
              </button>
              <button type="button" onClick={() => { setShowForm(false); resetForm(); }} className="btn-secondary !py-2 !px-5 text-sm">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-10 h-10 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
        </div>
      ) : sales.length === 0 ? (
        <div className="card-premium p-12 text-center">
          <div className="w-14 h-14 rounded-2xl bg-surface-100 flex items-center justify-center mx-auto mb-3">
            <Zap className="h-7 w-7 text-surface-400" />
          </div>
          <p className="font-semibold text-surface-700">No flash sales yet</p>
          <p className="text-sm text-surface-400 mt-1">Create a flash sale to offer limited-time discounts.</p>
        </div>
      ) : (
        <div className="card-premium overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-surface-50 text-left">
                  <th className="px-5 py-3 text-xs font-bold text-surface-500 uppercase tracking-wider">Name</th>
                  <th className="px-5 py-3 text-xs font-bold text-surface-500 uppercase tracking-wider">Discount</th>
                  <th className="px-5 py-3 text-xs font-bold text-surface-500 uppercase tracking-wider">Duration</th>
                  <th className="px-5 py-3 text-xs font-bold text-surface-500 uppercase tracking-wider">Status</th>
                  <th className="px-5 py-3 text-xs font-bold text-surface-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100">
                {sales.map((s) => {
                  const live = isLive(s);
                  return (
                    <tr key={s.id} className="hover:bg-surface-50 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="font-semibold text-surface-900 text-sm">{s.name}</div>
                        {s.description && <p className="text-xs text-surface-400 mt-0.5 max-w-xs truncate">{s.description}</p>}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1 text-sm font-bold text-brand-600">
                          <Percent className="h-3.5 w-3.5" />
                          {s.discount_percentage}% off
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="text-xs text-surface-600">
                          <span className="font-medium">{formatDateLocal(s.start_time)}</span>
                          <span className="text-surface-400 mx-1">→</span>
                          <span className="font-medium">{formatDateLocal(s.end_time)}</span>
                        </div>
                        {live && (
                          <div className="flex items-center gap-1 mt-1 text-xs text-amber-600 font-semibold">
                            <Clock className="h-3 w-3" />
                            {countdown(s.end_time)}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        {live ? (
                          <span className="badge badge-success text-[10px]">Live</span>
                        ) : s.is_active && new Date(s.start_time).getTime() > Date.now() ? (
                          <span className="badge badge-info text-[10px]">Scheduled</span>
                        ) : (
                          <span className={`badge text-[10px] ${s.is_active ? "badge-warning" : "badge-error"}`}>
                            {s.is_active ? "Ended" : "Inactive"}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleToggleActive(s)}
                            title={s.is_active ? "Deactivate" : "Activate"}
                            className="p-1.5 rounded-lg text-surface-400 hover:text-brand-600 hover:bg-brand-50 transition-all"
                          >
                            {s.is_active ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                          <button
                            onClick={() => openEdit(s)}
                            title="Edit"
                            className="p-1.5 rounded-lg text-surface-400 hover:text-brand-600 hover:bg-brand-50 transition-all"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(s.id)}
                            title="Delete"
                            className="p-1.5 rounded-lg text-surface-400 hover:text-red-600 hover:bg-red-50 transition-all"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── OperatorDeals ─────────────────────────────────── */
export function OperatorDeals() {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<"promos" | "flash">("promos");
  const [promos, setPromos] = useState<PromoCode[]>([]);
  const [flashSales, setFlashSales] = useState<FlashSale[]>([]);
  const [loadingPromos, setLoadingPromos] = useState(true);
  const [loadingFlash, setLoadingFlash] = useState(true);

  const fetchPromos = async () => {
    if (!user?.id) return;
    setLoadingPromos(true);
    try {
      const res = await apiClient.get(`/api/deals/promos/?operator_id=${user.id}`);
      setPromos(Array.isArray(res.data) ? res.data : []);
    } catch {
      toast.error("Failed to load promo codes");
    } finally {
      setLoadingPromos(false);
    }
  };

  const fetchFlashSales = async () => {
    if (!user?.id) return;
    setLoadingFlash(true);
    try {
      const res = await apiClient.get(`/api/deals/flash-sales?operator_id=${user.id}`);
      setFlashSales(Array.isArray(res.data) ? res.data : []);
    } catch {
      toast.error("Failed to load flash sales");
    } finally {
      setLoadingFlash(false);
    }
  };

  useEffect(() => {
    fetchPromos();
    fetchFlashSales();
  }, [user]);

  const TABS = [
    { id: "promos" as const, label: "Promo Codes", icon: Tag, count: promos.length },
    { id: "flash" as const, label: "Flash Sales", icon: Zap, count: flashSales.length },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <header className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center shadow-brand">
              <BadgePercent className="h-5 w-5 text-white" />
            </div>
            <h2 className="text-2xl font-extrabold text-surface-900 tracking-tight">Deals</h2>
          </div>
          <p className="text-sm text-surface-500">Manage promo codes and flash sales for your passengers.</p>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-surface-100 rounded-xl w-fit">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === tab.id
                ? "bg-white text-brand-600 shadow-sm"
                : "text-surface-500 hover:text-surface-700"
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
            <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
              activeTab === tab.id ? "bg-brand-100 text-brand-700" : "bg-surface-200 text-surface-500"
            }`}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Content */}
      {activeTab === "promos" ? (
        <PromoSection
          promos={promos}
          loading={loadingPromos}
          onRefresh={fetchPromos}
          operatorId={user?.id || ""}
        />
      ) : (
        <FlashSection
          sales={flashSales}
          loading={loadingFlash}
          onRefresh={fetchFlashSales}
          operatorId={user?.id || ""}
        />
      )}
    </div>
  );
}
