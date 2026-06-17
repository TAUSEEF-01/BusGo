import { useState, useEffect, useRef } from "react";
import { apiClient } from "../api/client";
import { useAuthStore } from "../stores/authStore";
import {
  Tag, Zap, Clock, Copy, Check, Percent, BadgePercent, Flame, Search,
  ChevronRight, Star, Shield, Headphones, RefreshCcw, ArrowRight,
  TrendingDown, Gift, Ticket, ChevronDown, ChevronUp, Sparkles,
} from "lucide-react";
import { toast } from "react-hot-toast";
import { useNavigate } from "react-router-dom";

/* ─── Types ────────────────────────────────────────── */
interface PromoCode {
  id: string;
  code: string;
  title?: string;
  description?: string;
  discount_type: "PERCENTAGE" | "FLAT";
  discount_value: number;
  min_fare: number;
  max_discount: number | null;
  valid_from: string;
  valid_until: string;
  max_uses: number;
  current_uses: number;
  is_active: boolean;
  operator_id?: string | null;
}

interface FlashSale {
  id: string;
  name: string;
  description?: string;
  discount_percentage: number;
  start_time: string;
  end_time: string;
  is_active: boolean;
  operator_id?: string | null;
}

/* ─── Countdown Timer ──────────────────────────────── */
function CountdownTimer({ end, size = "md" }: { end: string; size?: "sm" | "md" | "lg" }) {
  const calc = () => Math.max(0, new Date(end).getTime() - Date.now());
  const [ms, setMs] = useState(calc());

  useEffect(() => {
    const t = setInterval(() => setMs(calc()), 1000);
    return () => clearInterval(t);
  }, [end]);

  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);

  if (ms === 0) return <span className="text-red-400 font-bold text-xs">Expired</span>;

  if (size === "lg") {
    return (
      <div className="flex items-center gap-2">
        {[{ v: h, l: "HRS" }, { v: m, l: "MIN" }, { v: s, l: "SEC" }].map(({ v, l }) => (
          <div key={l} className="text-center">
            <div className="bg-white/20 backdrop-blur-sm rounded-lg px-2.5 py-1.5 min-w-[44px]">
              <span className="font-mono font-extrabold text-xl text-white leading-none block">
                {String(v).padStart(2, "0")}
              </span>
            </div>
            <span className="text-[9px] font-bold text-white/60 uppercase tracking-widest mt-1 block">{l}</span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <span className={`font-mono font-bold ${size === "sm" ? "text-xs" : "text-sm"} text-red-600`}>
      {String(h).padStart(2, "0")}:{String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}
    </span>
  );
}

/* ─── FAQ Item ─────────────────────────────────────── */
function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-surface-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-surface-50 transition-colors"
      >
        <span className="font-semibold text-surface-900 text-sm pr-4">{q}</span>
        {open ? <ChevronUp className="h-4 w-4 text-surface-400 flex-shrink-0" /> : <ChevronDown className="h-4 w-4 text-surface-400 flex-shrink-0" />}
      </button>
      {open && (
        <div className="px-5 pb-4 text-sm text-surface-600 leading-relaxed border-t border-surface-100 pt-3">
          {a}
        </div>
      )}
    </div>
  );
}

/* ─── Main Deals Page ──────────────────────────────── */
export function Deals() {
  const [promos, setPromos] = useState<PromoCode[]>([]);
  const [flashSales, setFlashSales] = useState<FlashSale[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [promoFilter, setPromoFilter] = useState<"all" | "percentage" | "flat">("all");
  const { isAuthenticated } = useAuthStore();
  const navigate = useNavigate();
  const heroRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [promosRes, flashRes] = await Promise.all([
          apiClient.get("/api/deals/promos/"),
          apiClient.get("/api/deals/flash-sales/active"),
        ]);
        setPromos((promosRes.data || []).filter((p: PromoCode) => p.is_active));
        setFlashSales(flashRes.data || []);
      } catch {
        // silently ignore — service may be empty
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(code);
      toast.success(`Code "${code}" copied to clipboard!`);
      setTimeout(() => setCopied(null), 2500);
    });
  };

  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

  const usagePct = (p: PromoCode) =>
    p.max_uses > 0 ? Math.round((p.current_uses / p.max_uses) * 100) : 0;

  const now = new Date();
  const activeFlash = flashSales.filter((f) => new Date(f.end_time) > now);
  const featuredFlash = activeFlash[0] ?? null;

  const filteredPromos = promos
    .filter((p) => {
      if (promoFilter === "percentage") return p.discount_type === "PERCENTAGE";
      if (promoFilter === "flat") return p.discount_type === "FLAT";
      return true;
    })
    .filter(
      (p) =>
        !searchTerm ||
        p.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.title || "").toLowerCase().includes(searchTerm.toLowerCase())
    );

  const totalSavings = promos.reduce((acc, p) => {
    if (p.discount_type === "FLAT") return acc + p.discount_value * p.current_uses;
    return acc + (p.discount_value * p.current_uses * 5); // rough estimate
  }, 0);

  return (
    <div className="min-h-screen bg-surface-50" id="deals-page">

      {/* ── Hero ── */}
      <div
        ref={heroRef}
        className="relative overflow-hidden py-16 sm:py-24"
        style={{ background: "linear-gradient(135deg, #1a0533 0%, #3b0764 40%, #1e1b4b 70%, #0f172a 100%)" }}
      >
        {/* Decorative blobs */}
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-brand-600/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.04) 1px, transparent 1px)", backgroundSize: "28px 28px" }} />

        {/* Floating discount badges */}
        <div className="absolute top-8 left-8 sm:left-16 hidden sm:flex items-center gap-1.5 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-3 py-1.5 text-white text-xs font-bold animate-pulse">
          <Zap className="h-3 w-3 text-yellow-300" /> Flash Sale Live
        </div>
        <div className="absolute top-16 right-8 sm:right-20 hidden sm:flex items-center gap-1.5 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-3 py-1.5 text-white text-xs font-bold" style={{ animationDelay: "0.5s" }}>
          <Tag className="h-3 w-3 text-emerald-300" /> Promo Codes
        </div>

        <div className="relative z-10 max-w-3xl mx-auto px-4 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 border border-white/20 text-white/80 text-xs font-semibold uppercase tracking-wider mb-5">
            <Sparkles className="h-3.5 w-3.5 text-accent-400" />
            Exclusive Member Offers
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-white mb-4 leading-tight">
            Deals &amp; <span className="text-transparent bg-clip-text" style={{ backgroundImage: "linear-gradient(90deg, #f59e0b, #ef4444)" }}>Offers</span>
          </h1>
          <p className="text-white/60 text-base sm:text-lg mb-8 max-w-xl mx-auto">
            Save on every journey with exclusive promo codes and time-limited flash sales from BusGo and top operators.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => navigate("/routes")}
              className="inline-flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 text-white font-bold px-6 py-3 rounded-xl transition-all shadow-lg text-sm"
            >
              <Search className="h-4 w-4" /> Browse Trips
            </button>
            <button
              onClick={() => document.getElementById("promos-section")?.scrollIntoView({ behavior: "smooth" })}
              className="inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold px-6 py-3 rounded-xl transition-all text-sm"
            >
              <Tag className="h-4 w-4" /> View Promo Codes
            </button>
          </div>
        </div>

        {/* Stats row */}
        {!loading && (promos.length > 0 || activeFlash.length > 0) && (
          <div className="relative z-10 max-w-3xl mx-auto mt-12 px-4">
            <div className="grid grid-cols-3 gap-3 sm:gap-6">
              {[
                { label: "Active Deals", value: (promos.length + activeFlash.length).toString(), icon: BadgePercent },
                { label: "Flash Sales Live", value: activeFlash.length.toString(), icon: Zap },
                { label: "Promo Codes", value: promos.length.toString(), icon: Tag },
              ].map((stat) => (
                <div key={stat.label} className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-3 sm:p-4 text-center">
                  <stat.icon className="h-4 w-4 text-accent-400 mx-auto mb-1.5" />
                  <p className="text-2xl font-extrabold text-white">{stat.value}</p>
                  <p className="text-[11px] text-white/60 font-medium">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-14">

        {/* ── Featured Flash Sale Banner ── */}
        {!loading && featuredFlash && (
          <section className="animate-fade-in">
            <div
              className="relative rounded-2xl overflow-hidden shadow-xl p-6 sm:p-8"
              style={{ background: "linear-gradient(135deg, #dc2626 0%, #ea580c 50%, #d97706 100%)" }}
            >
              <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.08) 1px, transparent 1px)", backgroundSize: "20px 20px" }} />
              <div className="absolute -top-8 -right-8 w-40 h-40 bg-white/10 rounded-full" />
              <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-white/10 rounded-full" />

              <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Flame className="h-5 w-5 text-yellow-300 animate-pulse" />
                    <span className="text-xs font-extrabold text-white/80 uppercase tracking-widest">Flash Sale — Live Now</span>
                  </div>
                  <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-1">
                    {featuredFlash.discount_percentage}% OFF
                  </h2>
                  <p className="text-white/90 font-semibold text-base mb-1">{featuredFlash.name}</p>
                  {featuredFlash.description && (
                    <p className="text-white/60 text-sm">{featuredFlash.description}</p>
                  )}
                </div>
                <div className="flex flex-col items-start md:items-end gap-4">
                  <div>
                    <p className="text-white/60 text-xs uppercase font-bold tracking-widest mb-2">Ends in</p>
                    <CountdownTimer end={featuredFlash.end_time} size="lg" />
                  </div>
                  <button
                    onClick={() => navigate("/routes")}
                    className="flex items-center gap-2 bg-white text-red-600 font-extrabold px-5 py-2.5 rounded-xl hover:bg-white/90 transition-all text-sm shadow-lg"
                  >
                    Book Now <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ── Flash Sales Grid ── */}
        {!loading && activeFlash.length > 1 && (
          <section>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center">
                <Flame className="h-4 w-4 text-red-500" />
              </div>
              <div>
                <h2 className="text-xl font-extrabold text-surface-900">Flash Sales</h2>
                <p className="text-sm text-surface-500">Limited-time discounts — grab them before they're gone</p>
              </div>
              <span className="ml-auto text-xs font-bold bg-red-50 text-red-600 px-2.5 py-1 rounded-full border border-red-100">
                {activeFlash.length} Live
              </span>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeFlash.slice(1).map((sale) => (
                <div
                  key={sale.id}
                  className="relative rounded-2xl overflow-hidden shadow-lg cursor-pointer group"
                  style={{ background: "linear-gradient(135deg, #7c3aed 0%, #db2777 100%)" }}
                  onClick={() => navigate("/routes")}
                >
                  <div className="absolute -top-4 -right-4 w-20 h-20 bg-white/10 rounded-full" />
                  <div className="absolute -bottom-4 -left-4 w-16 h-16 bg-white/10 rounded-full" />
                  <div className="relative z-10 p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <Zap className="h-4 w-4 text-yellow-300" />
                      <span className="text-[10px] font-extrabold uppercase tracking-widest text-white/70">Flash Sale</span>
                    </div>
                    <p className="text-3xl font-extrabold text-white mb-1">{sale.discount_percentage}%</p>
                    <p className="font-semibold text-white/90 text-sm mb-3 line-clamp-1">{sale.name}</p>
                    <div className="flex items-center gap-1.5 text-white/70 text-xs">
                      <Clock className="h-3 w-3" />
                      <CountdownTimer end={sale.end_time} size="sm" />
                    </div>
                    <div className="mt-3 flex items-center gap-1 text-white/70 text-xs group-hover:text-white/90 transition-colors">
                      Book now <ArrowRight className="h-3 w-3" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Promo Codes ── */}
        <section id="promos-section">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-brand-50 flex items-center justify-center">
                <Tag className="h-4 w-4 text-brand-600" />
              </div>
              <div>
                <h2 className="text-xl font-extrabold text-surface-900">Promo Codes</h2>
                <p className="text-sm text-surface-500">Copy a code and apply it at checkout</p>
              </div>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search codes..."
                className="w-full pl-9 pr-3 py-2 border border-surface-200 rounded-xl text-sm focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 bg-white"
              />
            </div>
          </div>

          {/* Filter tabs */}
          <div className="flex items-center gap-2 mb-5">
            {([
              { key: "all", label: "All Codes" },
              { key: "percentage", label: "% Off" },
              { key: "flat", label: "Flat Discount" },
            ] as const).map((tab) => (
              <button
                key={tab.key}
                onClick={() => setPromoFilter(tab.key)}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
                  promoFilter === tab.key
                    ? "bg-brand-600 text-white shadow-sm"
                    : "bg-white border border-surface-200 text-surface-600 hover:border-brand-300 hover:text-brand-600"
                }`}
              >
                {tab.label}
                {tab.key !== "all" && (
                  <span className={`ml-1.5 ${promoFilter === tab.key ? "text-white/70" : "text-surface-400"}`}>
                    ({promos.filter(p => tab.key === "percentage" ? p.discount_type === "PERCENTAGE" : p.discount_type === "FLAT").length})
                  </span>
                )}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-56 bg-surface-100 rounded-2xl animate-pulse" />
              ))}
            </div>
          ) : filteredPromos.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-2xl border border-surface-200">
              <div className="w-16 h-16 rounded-2xl bg-surface-100 flex items-center justify-center mx-auto mb-4">
                <BadgePercent className="h-8 w-8 text-surface-300" />
              </div>
              <p className="text-surface-700 font-bold text-lg mb-1">No promo codes available</p>
              <p className="text-surface-400 text-sm">Check back soon — new deals are added regularly.</p>
              <button onClick={() => navigate("/routes")} className="mt-6 btn-primary !py-2.5 !px-5 !text-sm inline-flex items-center gap-2">
                Browse Trips <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredPromos.map((promo) => {
                const pct = usagePct(promo);
                const almostGone = pct >= 80;
                const isCopied = copied === promo.code;
                const isPercentage = promo.discount_type === "PERCENTAGE";
                const remaining = promo.max_uses - promo.current_uses;

                return (
                  <div
                    key={promo.id}
                    className="bg-white rounded-2xl border border-surface-200 shadow-elevation-1 overflow-hidden hover:shadow-elevation-2 hover:-translate-y-0.5 transition-all duration-200 flex flex-col"
                  >
                    {/* Top stripe */}
                    <div className={`h-1 ${isPercentage ? "bg-gradient-to-r from-brand-500 to-purple-500" : "bg-gradient-to-r from-emerald-500 to-teal-500"}`} />

                    <div className="p-5 flex flex-col flex-1">
                      {/* Header row */}
                      <div className="flex items-start justify-between mb-3">
                        <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-extrabold ${
                          isPercentage ? "bg-brand-50 text-brand-700" : "bg-emerald-50 text-emerald-700"
                        }`}>
                          {isPercentage
                            ? <><Percent className="h-3 w-3" />{promo.discount_value}% OFF</>
                            : <><Tag className="h-3 w-3" />৳{promo.discount_value} OFF</>
                          }
                        </div>
                        {almostGone && (
                          <span className="flex items-center gap-0.5 text-[10px] font-bold bg-red-50 text-red-600 px-2 py-0.5 rounded-full border border-red-100">
                            <Flame className="h-2.5 w-2.5" /> Almost gone
                          </span>
                        )}
                      </div>

                      {/* Title */}
                      {promo.title && (
                        <p className="text-sm font-bold text-surface-900 mb-1 leading-snug">{promo.title}</p>
                      )}
                      {promo.description && (
                        <p className="text-xs text-surface-500 mb-3 leading-relaxed line-clamp-2">{promo.description}</p>
                      )}

                      {/* Code box */}
                      <div className="flex items-center gap-2 mb-4">
                        <div className="flex-1 border-2 border-dashed border-surface-200 rounded-xl px-3 py-2 text-center bg-surface-50/50">
                          <span className="font-mono font-extrabold text-surface-900 text-lg tracking-widest">{promo.code}</span>
                        </div>
                        <button
                          onClick={() => copyCode(promo.code)}
                          className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all flex-shrink-0 ${
                            isCopied ? "bg-emerald-500 text-white scale-95" : "bg-surface-100 text-surface-600 hover:bg-brand-50 hover:text-brand-600"
                          }`}
                          title="Copy code"
                        >
                          {isCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                        </button>
                      </div>

                      {/* Details */}
                      <div className="space-y-1 text-xs text-surface-500 mb-4">
                        {promo.min_fare > 0 && (
                          <div className="flex items-center justify-between">
                            <span>Min. fare</span>
                            <span className="font-semibold text-surface-700">৳{promo.min_fare}</span>
                          </div>
                        )}
                        {promo.max_discount && (
                          <div className="flex items-center justify-between">
                            <span>Max discount</span>
                            <span className="font-semibold text-surface-700">৳{promo.max_discount}</span>
                          </div>
                        )}
                        <div className="flex items-center justify-between">
                          <span>Valid until</span>
                          <span className="font-semibold text-surface-700">{fmtDate(promo.valid_until)}</span>
                        </div>
                      </div>

                      {/* Usage bar */}
                      <div className="mb-4">
                        <div className="flex justify-between text-[10px] text-surface-400 mb-1">
                          <span>{promo.current_uses} used</span>
                          <span className={remaining <= 5 ? "text-red-500 font-bold" : ""}>{remaining} left</span>
                        </div>
                        <div className="h-1.5 bg-surface-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${almostGone ? "bg-red-400" : "bg-brand-500"}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>

                      {/* CTA */}
                      <button
                        onClick={() => {
                          copyCode(promo.code);
                          if (!isAuthenticated) { navigate("/login"); return; }
                          setTimeout(() => navigate("/routes"), 600);
                        }}
                        className="mt-auto w-full btn-primary !py-2 !text-sm flex items-center justify-center gap-1.5"
                      >
                        {isCopied ? "Code Copied! Book Now" : "Use This Code"} <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* ── How to Use ── */}
        <section className="bg-white rounded-2xl border border-surface-200 shadow-elevation-1 overflow-hidden">
          <div className="p-6 sm:p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 rounded-lg bg-brand-50 flex items-center justify-center">
                <Gift className="h-4 w-4 text-brand-600" />
              </div>
              <div>
                <h2 className="text-xl font-extrabold text-surface-900">How to Use a Promo Code</h2>
                <p className="text-sm text-surface-500">3 simple steps to save on your next ride</p>
              </div>
            </div>
            <div className="grid sm:grid-cols-3 gap-6">
              {[
                {
                  step: "01", icon: Copy, title: "Copy the code",
                  desc: "Click the copy button on any active promo card above to copy the code to your clipboard.",
                  color: "from-brand-500 to-brand-600",
                },
                {
                  step: "02", icon: Search, title: "Find your trip",
                  desc: "Browse available routes, select the date and seats for the journey you want to book.",
                  color: "from-purple-500 to-purple-600",
                },
                {
                  step: "03", icon: Ticket, title: "Apply at checkout",
                  desc: "Paste your code in the promo field on the payment page. Your discount is applied instantly.",
                  color: "from-emerald-500 to-emerald-600",
                },
              ].map((item) => (
                <div key={item.step} className="relative">
                  <div className="flex items-start gap-4">
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${item.color} flex items-center justify-center shadow-sm flex-shrink-0`}>
                      <item.icon className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-surface-400 uppercase tracking-widest">Step {item.step}</span>
                      <p className="font-bold text-surface-900 text-sm mb-1 mt-0.5">{item.title}</p>
                      <p className="text-surface-500 text-xs leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Trust Badges ── */}
        <section>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { icon: Shield, title: "100% Secure", desc: "SSL encrypted payments" },
              { icon: RefreshCcw, title: "Easy Refunds", desc: "Cancel within 1 hour" },
              { icon: Headphones, title: "24/7 Support", desc: "Always here to help" },
              { icon: Star, title: "Verified Deals", desc: "All promos are genuine" },
            ].map((item) => (
              <div key={item.title} className="bg-white rounded-xl border border-surface-200 p-4 text-center hover:border-brand-200 transition-colors">
                <div className="w-9 h-9 rounded-lg bg-brand-50 flex items-center justify-center mx-auto mb-2">
                  <item.icon className="h-4.5 w-4.5 text-brand-600" />
                </div>
                <p className="text-sm font-bold text-surface-900">{item.title}</p>
                <p className="text-xs text-surface-500 mt-0.5">{item.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── FAQ ── */}
        <section>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 rounded-lg bg-surface-100 flex items-center justify-center">
              <TrendingDown className="h-4 w-4 text-surface-600" />
            </div>
            <h2 className="text-xl font-extrabold text-surface-900">Frequently Asked Questions</h2>
          </div>
          <div className="space-y-3">
            <FaqItem
              q="How do I apply a promo code?"
              a="Copy the promo code by clicking the copy button on any active deal. When you reach the payment page, enter the code in the 'Promo Code' field and click Apply. Your discount will be calculated and reflected in the total fare."
            />
            <FaqItem
              q="Can I use more than one promo code per booking?"
              a="Only one promo code can be applied per booking. Choose the code that gives you the maximum savings for your journey."
            />
            <FaqItem
              q="Why is my promo code not working?"
              a="A promo code may fail if: it has expired, the minimum fare requirement is not met, it has reached the maximum usage limit, or you have already used it before. Check the terms on the promo card for details."
            />
            <FaqItem
              q="What is a Flash Sale?"
              a="Flash Sales are time-limited discounts applied automatically to trips during the sale period — no code needed. Simply book a trip while the sale is active and the discount is applied at checkout."
            />
            <FaqItem
              q="Can operators create their own deals?"
              a="Yes! BusGo operators can create exclusive promo codes and flash sales for their services through the Operator Portal. Look for operator-specific deals on this page."
            />
          </div>
        </section>

        {/* ── CTA Banner ── */}
        <section>
          <div
            className="rounded-2xl p-8 sm:p-10 text-center relative overflow-hidden"
            style={{ background: "linear-gradient(135deg, #1e1b4b 0%, #3730a3 100%)" }}
          >
            <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1px)", backgroundSize: "20px 20px" }} />
            <div className="relative z-10">
              <BadgePercent className="h-10 w-10 text-accent-400 mx-auto mb-4" />
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white mb-3">Ready to save on your next trip?</h2>
              <p className="text-white/60 text-sm mb-6 max-w-md mx-auto">
                Browse hundreds of routes and use your promo code at checkout to unlock instant savings.
              </p>
              <button
                onClick={() => navigate("/routes")}
                className="inline-flex items-center gap-2 bg-accent-500 hover:bg-accent-600 text-white font-extrabold px-8 py-3 rounded-xl transition-all shadow-lg text-sm"
              >
                Search Trips Now <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}
