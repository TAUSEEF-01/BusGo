import { useState, useEffect } from "react";
import { apiClient } from "../api/client";
import { useAuthStore } from "../stores/authStore";
import { Tag, Zap, Clock, Copy, Check, Percent, BadgePercent, Flame, Search, ChevronRight } from "lucide-react";
import { toast } from "react-hot-toast";
import { useNavigate } from "react-router-dom";

interface PromoCode {
  id: string;
  code: string;
  discount_type: "PERCENTAGE" | "FLAT";
  discount_value: number;
  min_fare: number;
  max_discount: number | null;
  valid_from: string;
  valid_until: string;
  max_uses: number;
  current_uses: number;
  is_active: boolean;
}

interface FlashSale {
  id: string;
  name: string;
  discount_percentage: number;
  start_time: string;
  end_time: string;
  is_active: boolean;
}

function CountdownTimer({ end }: { end: string }) {
  const calc = () => Math.max(0, new Date(end).getTime() - Date.now());
  const [ms, setMs] = useState(calc());

  useEffect(() => {
    const t = setInterval(() => setMs(calc()), 1000);
    return () => clearInterval(t);
  }, [end]);

  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);

  if (ms === 0) return <span className="text-red-500 font-bold text-xs">Expired</span>;
  return (
    <span className="font-mono text-sm font-bold text-red-600">
      {String(h).padStart(2, "0")}:{String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}
    </span>
  );
}

export function Deals() {
  const [promos, setPromos] = useState<PromoCode[]>([]);
  const [flashSales, setFlashSales] = useState<FlashSale[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const { isAuthenticated } = useAuthStore();
  const navigate = useNavigate();

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
        // service may be empty; silently ignore
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(code);
      toast.success(`Code "${code}" copied!`);
      setTimeout(() => setCopied(null), 2500);
    });
  };

  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

  const usagePercent = (p: PromoCode) =>
    Math.round((p.current_uses / p.max_uses) * 100);

  const filteredPromos = promos.filter(
    (p) =>
      p.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      `${p.discount_value}`.includes(searchTerm)
  );

  const now = new Date();
  const activeFlash = flashSales.filter((f) => new Date(f.end_time) > now);

  return (
    <div className="min-h-screen bg-surface-50" id="deals-page">
      {/* Hero banner */}
      <div className="hero-gradient py-14 px-4 text-center relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
        <div className="relative z-10 max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 border border-white/20 text-white/90 text-sm font-medium mb-4">
            <BadgePercent className="h-4 w-4 text-accent-400" />
            Exclusive Offers
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white mb-3">Deals &amp; Offers</h1>
          <p className="text-white/70 text-base mb-6">Save more on every journey with promo codes and flash sales.</p>
          <button
            onClick={() => navigate("/routes")}
            className="inline-flex items-center gap-2 bg-white text-brand-700 font-bold px-6 py-3 rounded-xl hover:bg-white/90 transition-all shadow-lg text-sm"
          >
            <Search className="h-4 w-4" /> Browse Trips
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-12">
        {/* Flash Sales */}
        {(loading || activeFlash.length > 0) && (
          <section>
            <div className="flex items-center gap-2 mb-5">
              <Flame className="h-5 w-5 text-red-500" />
              <h2 className="text-xl font-extrabold text-surface-900">Flash Sales</h2>
              <span className="text-xs font-bold bg-red-100 text-red-600 px-2 py-0.5 rounded-full">Limited Time</span>
            </div>
            {loading ? (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2].map((i) => (
                  <div key={i} className="h-36 bg-surface-100 rounded-2xl animate-pulse" />
                ))}
              </div>
            ) : activeFlash.length === 0 ? null : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {activeFlash.map((sale) => (
                  <div key={sale.id} className="relative bg-gradient-to-br from-red-500 to-orange-500 rounded-2xl p-5 text-white overflow-hidden shadow-lg">
                    <div className="absolute -top-4 -right-4 w-24 h-24 bg-white/10 rounded-full" />
                    <div className="absolute -bottom-4 -left-4 w-20 h-20 bg-white/10 rounded-full" />
                    <div className="relative z-10">
                      <div className="flex items-center gap-2 mb-2">
                        <Zap className="h-4 w-4 text-yellow-300" />
                        <span className="text-xs font-bold uppercase tracking-wider text-white/80">Flash Sale</span>
                      </div>
                      <p className="font-extrabold text-2xl mb-1">{sale.discount_percentage}% OFF</p>
                      <p className="text-white/90 font-semibold text-sm mb-3">{sale.name}</p>
                      <div className="flex items-center gap-1.5 text-white/80 text-xs">
                        <Clock className="h-3.5 w-3.5" />
                        Ends in <CountdownTimer end={sale.end_time} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Promo Codes */}
        <section>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
            <div className="flex items-center gap-2">
              <Tag className="h-5 w-5 text-brand-600" />
              <h2 className="text-xl font-extrabold text-surface-900">Promo Codes</h2>
              {!loading && <span className="text-xs font-bold bg-brand-50 text-brand-600 px-2 py-0.5 rounded-full">{filteredPromos.length} available</span>}
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search promo codes..."
                className="w-full pl-9 pr-3 py-2 border border-surface-200 rounded-xl text-sm focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 bg-white"
              />
            </div>
          </div>

          {loading ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-48 bg-surface-100 rounded-2xl animate-pulse" />
              ))}
            </div>
          ) : filteredPromos.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-2xl border border-surface-200">
              <BadgePercent className="h-14 w-14 text-surface-200 mx-auto mb-4" />
              <p className="text-surface-500 font-medium text-lg">No promo codes available right now.</p>
              <p className="text-surface-400 text-sm mt-1">Check back soon for exclusive deals!</p>
              <button onClick={() => navigate("/routes")} className="mt-6 inline-flex items-center gap-2 btn-primary !py-2.5 !px-5 !text-sm">
                Browse Trips <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredPromos.map((promo) => {
                const pct = usagePercent(promo);
                const almostGone = pct >= 80;
                const isCopied = copied === promo.code;
                return (
                  <div key={promo.id} className="bg-white rounded-2xl border border-surface-200 shadow-elevation-1 overflow-hidden hover:shadow-elevation-2 transition-shadow">
                    {/* Top accent */}
                    <div className={`h-1.5 ${promo.discount_type === "PERCENTAGE" ? "bg-gradient-to-r from-brand-500 to-accent-500" : "bg-gradient-to-r from-emerald-500 to-teal-500"}`} />
                    <div className="p-5">
                      {/* Discount badge */}
                      <div className="flex items-start justify-between mb-4">
                        <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-extrabold ${
                          promo.discount_type === "PERCENTAGE"
                            ? "bg-brand-50 text-brand-700"
                            : "bg-emerald-50 text-emerald-700"
                        }`}>
                          {promo.discount_type === "PERCENTAGE"
                            ? <><Percent className="h-3.5 w-3.5" />{promo.discount_value}% OFF</>
                            : <><Tag className="h-3.5 w-3.5" />৳{promo.discount_value} OFF</>
                          }
                        </div>
                        {almostGone && (
                          <span className="text-[10px] font-bold bg-red-50 text-red-600 px-2 py-1 rounded-full">Almost Gone!</span>
                        )}
                      </div>

                      {/* Code box */}
                      <div className="flex items-center gap-2 mb-4">
                        <div className="flex-1 bg-surface-50 border-2 border-dashed border-surface-200 rounded-xl px-3 py-2.5 text-center">
                          <span className="font-mono font-extrabold text-surface-900 text-lg tracking-widest">{promo.code}</span>
                        </div>
                        <button
                          onClick={() => copyCode(promo.code)}
                          className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all flex-shrink-0 ${
                            isCopied ? "bg-emerald-500 text-white" : "bg-surface-100 text-surface-600 hover:bg-brand-50 hover:text-brand-600"
                          }`}
                          title="Copy code"
                        >
                          {isCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                        </button>
                      </div>

                      {/* Details */}
                      <div className="space-y-1.5 text-xs text-surface-500">
                        {promo.min_fare > 0 && <p>Min. fare: <span className="font-semibold text-surface-700">৳{promo.min_fare}</span></p>}
                        {promo.max_discount && <p>Max discount: <span className="font-semibold text-surface-700">৳{promo.max_discount}</span></p>}
                        <p>Valid until: <span className="font-semibold text-surface-700">{fmtDate(promo.valid_until)}</span></p>
                      </div>

                      {/* Usage bar */}
                      <div className="mt-4">
                        <div className="flex justify-between text-[10px] text-surface-400 mb-1">
                          <span>{promo.current_uses} used</span>
                          <span>{promo.max_uses - promo.current_uses} left</span>
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
                          if (!isAuthenticated) { navigate("/login"); return; }
                          copyCode(promo.code);
                          navigate("/routes");
                        }}
                        className="mt-4 w-full btn-primary !py-2 !text-sm flex items-center justify-center gap-1.5"
                      >
                        Use Code <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* How to use */}
        <section className="bg-white rounded-2xl border border-surface-200 p-6 shadow-elevation-1">
          <h2 className="text-lg font-bold text-surface-900 mb-5">How to Use a Promo Code</h2>
          <div className="grid sm:grid-cols-3 gap-6">
            {[
              { step: "1", title: "Copy the code", desc: "Click the copy button on any active promo code above." },
              { step: "2", title: "Search & select a trip", desc: "Browse available routes and select the trip you want to book." },
              { step: "3", title: "Apply at checkout", desc: "Paste your code in the promo field on the payment page to save instantly." },
            ].map((item) => (
              <div key={item.step} className="flex gap-4">
                <div className="w-9 h-9 rounded-xl bg-brand-600 text-white flex items-center justify-center font-extrabold text-sm flex-shrink-0">
                  {item.step}
                </div>
                <div>
                  <p className="font-bold text-surface-900 text-sm mb-0.5">{item.title}</p>
                  <p className="text-surface-500 text-xs leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
