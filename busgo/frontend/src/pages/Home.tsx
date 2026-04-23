import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Calendar,
  MapPin,
  Search,
  ArrowRight,
  Shield,
  Clock,
  Headphones,
  Star,
  TrendingDown,
  Bus,
  Wifi,
  Snowflake,
  Zap,
  Users,
  Quote,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

/* ─── Scroll-triggered fade-in hook ────────────────── */
function useScrollFade() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add("visible");
        }
      },
      { threshold: 0.15 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return ref;
}

/* ─── Animated Counter ─────────────────────────────── */
function AnimatedCounter({ target, suffix = "" }: { target: number; suffix?: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const triggered = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !triggered.current) {
          triggered.current = true;
          const duration = 2000;
          const start = performance.now();
          const animate = (now: number) => {
            const progress = Math.min((now - start) / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setCount(Math.floor(eased * target));
            if (progress < 1) requestAnimationFrame(animate);
          };
          requestAnimationFrame(animate);
        }
      },
      { threshold: 0.5 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [target]);

  return <span ref={ref}>{count.toLocaleString()}{suffix}</span>;
}

/* ════════════════════════════════════════════════════
   HOME PAGE
   ════════════════════════════════════════════════════ */
export function Home() {
  const navigate = useNavigate();
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [date, setDate] = useState("");

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (origin && destination && date) {
      navigate(`/search?origin=${origin}&destination=${destination}&date=${date}`);
    }
  };

  const stats = useScrollFade();
  const routes = useScrollFade();
  const howItWorks = useScrollFade();
  const features = useScrollFade();
  const testimonials = useScrollFade();

  return (
    <div className="flex flex-col">
      {/* ──── HERO SECTION ──── */}
      <section className="relative min-h-[90vh] flex items-center hero-gradient overflow-hidden" id="hero-section">
        {/* Animated background elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-20 -right-20 w-96 h-96 bg-white/5 rounded-full blur-3xl floating" />
          <div className="absolute top-1/3 -left-32 w-80 h-80 bg-white/5 rounded-full blur-3xl floating-delayed" />
          <div className="absolute bottom-10 right-1/4 w-64 h-64 bg-accent-500/10 rounded-full blur-3xl floating" />
          {/* Grid pattern overlay */}
          <div className="absolute inset-0" style={{
            backgroundImage: 'radial-gradient(rgba(255,255,255,0.08) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }} />
        </div>

        <div className="relative w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 mt-8">
          <div className="text-center max-w-4xl mx-auto">
            {/* Pill badge */}
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 text-white/90 text-sm font-medium mb-8 animate-fade-in-down">
              <Zap className="h-4 w-4 text-accent-400" />
              <span>Trusted by 10M+ travelers across Bangladesh</span>
            </div>

            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold text-white tracking-tight leading-tight animate-fade-in-up" id="hero-heading">
              Travel Anywhere,
              <br />
              <span className="relative">
                Book
                <span className="relative inline-block mx-2">
                  <span className="relative z-10">Instantly</span>
                  <span className="absolute bottom-1 left-0 right-0 h-3 bg-accent-500/40 -skew-x-3 rounded" />
                </span>
              </span>
            </h1>

            <p className="mt-6 text-lg sm:text-xl text-white/70 max-w-2xl mx-auto font-body animate-fade-in-up animate-delay-200" id="hero-subtitle">
              Compare operators, choose your seat, and book bus tickets in under 60 seconds. The smartest way to travel across Bangladesh.
            </p>
          </div>

          {/* ──── SEARCH FORM ──── */}
          <form
            onSubmit={handleSearch}
            id="search-form"
            className="mt-12 max-w-5xl mx-auto bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl p-4 sm:p-6 border border-white/50 animate-fade-in-up animate-delay-300"
          >
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
              {/* Origin */}
              <div className="space-y-1.5">
                <label className="flex items-center gap-1.5 text-sm font-semibold text-surface-700">
                  <MapPin className="w-4 h-4 text-brand-500" />
                  From
                </label>
                <input
                  type="text"
                  id="origin-input"
                  value={origin}
                  onChange={(e) => setOrigin(e.target.value)}
                  placeholder="e.g. Dhaka"
                  className="input-premium"
                  required
                />
              </div>

              {/* Destination */}
              <div className="space-y-1.5">
                <label className="flex items-center gap-1.5 text-sm font-semibold text-surface-700">
                  <MapPin className="w-4 h-4 text-brand-500" />
                  To
                </label>
                <input
                  type="text"
                  id="destination-input"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  placeholder="e.g. Chittagong"
                  className="input-premium"
                  required
                />
              </div>

              {/* Date */}
              <div className="space-y-1.5">
                <label className="flex items-center gap-1.5 text-sm font-semibold text-surface-700">
                  <Calendar className="w-4 h-4 text-brand-500" />
                  Date
                </label>
                <input
                  type="date"
                  id="date-input"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="input-premium"
                  required
                />
              </div>

              {/* Submit */}
              <button
                type="submit"
                id="search-button"
                className="btn-primary flex items-center justify-center gap-2 !py-3 text-base"
              >
                <Search className="w-5 h-5" />
                Search Buses
              </button>
            </div>

            {/* Quick suggestions */}
            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
              <span className="text-surface-400">Popular:</span>
              {["Dhaka → Chittagong", "Dhaka → Cox's Bazar", "Dhaka → Sylhet"].map((route) => (
                <button
                  key={route}
                  type="button"
                  onClick={() => {
                    const [from, to] = route.split(" → ");
                    setOrigin(from);
                    setDestination(to);
                  }}
                  className="px-3 py-1 rounded-full bg-surface-50 text-surface-600 hover:bg-brand-50 hover:text-brand-600 border border-surface-200 transition-colors font-medium"
                >
                  {route}
                </button>
              ))}
            </div>
          </form>
        </div>

        {/* Bottom wave */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 120" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full">
            <path d="M0 120L60 110C120 100 240 80 360 70C480 60 600 60 720 65C840 70 960 80 1080 85C1200 90 1320 90 1380 90L1440 90V120H1380C1320 120 1200 120 1080 120C960 120 840 120 720 120C600 120 480 120 360 120C240 120 120 120 60 120H0Z" fill="#F8FAFC"/>
          </svg>
        </div>
      </section>

      {/* ──── STATS SECTION ──── */}
      <section className="py-16 bg-surface-50" id="stats-section">
        <div ref={stats} className="scroll-fade max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { icon: Users, value: 10, suffix: "M+", label: "Happy Travelers", color: "brand" },
              { icon: Bus, value: 50, suffix: "K+", label: "Bus Operators", color: "accent" },
              { icon: MapPin, value: 500, suffix: "+", label: "Routes Covered", color: "brand" },
              { icon: Star, value: 4, suffix: ".9", label: "User Rating", color: "accent" },
            ].map((stat, i) => (
              <div
                key={stat.label}
                className="card-premium p-6 text-center group"
                style={{ animationDelay: `${i * 100}ms` }}
              >
                <div className={`w-12 h-12 rounded-xl mx-auto mb-3 flex items-center justify-center ${
                  stat.color === "brand" ? "bg-brand-50 text-brand-600" : "bg-accent-50 text-accent-600"
                } group-hover:scale-110 transition-transform duration-300`}>
                  <stat.icon className="h-6 w-6" />
                </div>
                <p className="text-3xl sm:text-4xl font-extrabold text-surface-900 font-display">
                  <AnimatedCounter target={stat.value} suffix={stat.suffix} />
                </p>
                <p className="text-surface-500 text-sm font-medium mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ──── POPULAR ROUTES ──── */}
      <section className="py-20 bg-white" id="popular-routes">
        <div ref={routes} className="scroll-fade max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <span className="inline-block px-3 py-1 rounded-full bg-brand-50 text-brand-600 text-xs font-bold uppercase tracking-wider mb-3">
              Popular Routes
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-surface-900">
              Top destinations travelers love
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { from: "Dhaka", to: "Chittagong", price: "৳ 800", duration: "5h 30m", operators: 42, gradient: "from-red-500 to-orange-500" },
              { from: "Dhaka", to: "Cox's Bazar", price: "৳ 1,200", duration: "9h", operators: 28, gradient: "from-blue-500 to-cyan-500" },
              { from: "Dhaka", to: "Sylhet", price: "৳ 700", duration: "4h", operators: 35, gradient: "from-emerald-500 to-teal-500" },
              { from: "Dhaka", to: "Rajshahi", price: "৳ 650", duration: "5h", operators: 22, gradient: "from-purple-500 to-pink-500" },
              { from: "Dhaka", to: "Khulna", price: "৳ 750", duration: "6h", operators: 18, gradient: "from-amber-500 to-orange-500" },
              { from: "Chittagong", to: "Cox's Bazar", price: "৳ 500", duration: "4h", operators: 30, gradient: "from-indigo-500 to-blue-500" },
            ].map((route, i) => (
              <button
                key={i}
                onClick={() => navigate(`/search?origin=${route.from}&destination=${route.to}&date=2026-05-01`)}
                className="group card-premium p-0 overflow-hidden text-left"
                id={`route-card-${i}`}
              >
                {/* Colored header */}
                <div className={`h-2 bg-gradient-to-r ${route.gradient}`} />
                <div className="p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${route.gradient} flex items-center justify-center text-white shadow-lg`}>
                      <Bus className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 text-surface-900 font-bold text-lg">
                        {route.from}
                        <ArrowRight className="h-4 w-4 text-surface-400 group-hover:text-brand-500 group-hover:translate-x-0.5 transition-all" />
                        {route.to}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-4">
                    <div className="flex items-center gap-4 text-sm text-surface-500">
                      <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {route.duration}</span>
                      <span className="flex items-center gap-1"><Bus className="h-3.5 w-3.5" /> {route.operators} operators</span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-surface-400">from</span>
                      <p className="text-lg font-bold text-brand-600">{route.price}</p>
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ──── HOW IT WORKS ──── */}
      <section className="py-20 bg-surface-50" id="how-it-works">
        <div ref={howItWorks} className="scroll-fade max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <span className="inline-block px-3 py-1 rounded-full bg-brand-50 text-brand-600 text-xs font-bold uppercase tracking-wider mb-3">
              How It Works
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-surface-900">
              Book your ticket in 3 simple steps
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            {/* Connecting line */}
            <div className="hidden md:block absolute top-16 left-[20%] right-[20%] h-0.5 bg-gradient-to-r from-brand-200 via-brand-400 to-brand-200" />

            {[
              { step: 1, title: "Search", desc: "Enter your origin, destination, and travel date to browse available buses from top operators.", icon: Search, color: "from-brand-500 to-brand-600" },
              { step: 2, title: "Select & Book", desc: "Choose your preferred bus, pick your favorite seat, and enter passenger details securely.", icon: Zap, color: "from-accent-500 to-accent-600" },
              { step: 3, title: "Pay & Travel", desc: "Complete payment via bKash, Nagad, or card. Get your e-ticket instantly on your phone.", icon: Shield, color: "from-emerald-500 to-emerald-600" },
            ].map((item) => (
              <div key={item.step} className="relative flex flex-col items-center text-center">
                <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${item.color} flex items-center justify-center text-white shadow-lg z-10 mb-6`}>
                  <item.icon className="h-7 w-7" />
                </div>
                <span className="text-xs font-bold text-surface-400 uppercase tracking-widest mb-2">Step {item.step}</span>
                <h3 className="text-xl font-bold text-surface-900 mb-2">{item.title}</h3>
                <p className="text-surface-500 leading-relaxed text-sm max-w-xs">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ──── WHY BUSGO ──── */}
      <section className="py-20 bg-white" id="why-busgo">
        <div ref={features} className="scroll-fade max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <span className="inline-block px-3 py-1 rounded-full bg-brand-50 text-brand-600 text-xs font-bold uppercase tracking-wider mb-3">
              Why BusGo
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-surface-900">
              The smarter way to book bus tickets
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: TrendingDown, title: "Best Prices", desc: "We compare prices across operators so you always get the best deal.", color: "bg-emerald-50 text-emerald-600" },
              { icon: Shield, title: "Secure Payments", desc: "Bank-grade encryption protects every transaction you make.", color: "bg-blue-50 text-blue-600" },
              { icon: Headphones, title: "24/7 Support", desc: "Our support team is always available to help with any issues.", color: "bg-purple-50 text-purple-600" },
              { icon: Clock, title: "Instant Booking", desc: "Confirm your seat in seconds. No waiting, no hassle.", color: "bg-amber-50 text-amber-600" },
              { icon: Wifi, title: "Live Tracking", desc: "Track your bus in real-time and share your location with loved ones.", color: "bg-cyan-50 text-cyan-600" },
              { icon: Star, title: "Verified Reviews", desc: "Read genuine reviews from real travelers before you book.", color: "bg-pink-50 text-pink-600" },
              { icon: Snowflake, title: "AC & Non-AC", desc: "Choose from a wide range of AC and Non-AC buses to suit your budget.", color: "bg-indigo-50 text-indigo-600" },
              { icon: Zap, title: "E-Ticket", desc: "Paperless travel with QR-code tickets delivered straight to your phone.", color: "bg-orange-50 text-orange-600" },
            ].map((feature, i) => (
              <div key={i} className="card-premium p-6 group" id={`feature-${i}`}>
                <div className={`w-12 h-12 rounded-xl ${feature.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}>
                  <feature.icon className="h-6 w-6" />
                </div>
                <h3 className="text-base font-bold text-surface-900 mb-1.5">{feature.title}</h3>
                <p className="text-surface-500 text-sm leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ──── TESTIMONIALS ──── */}
      <TestimonialsSection sectionRef={testimonials} />

      {/* ──── CTA BANNER ──── */}
      <section className="py-20 bg-white" id="cta-section">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative hero-gradient rounded-3xl overflow-hidden px-8 py-16 sm:px-16 text-center">
            {/* Background decorations */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <div className="absolute -top-10 -right-10 w-60 h-60 bg-white/5 rounded-full blur-2xl" />
              <div className="absolute -bottom-10 -left-10 w-48 h-48 bg-white/5 rounded-full blur-2xl" />
            </div>

            <div className="relative z-10">
              <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-4">
                Ready to start your journey?
              </h2>
              <p className="text-white/70 text-lg mb-8 max-w-xl mx-auto">
                Join millions of travelers who trust BusGo for their daily commute and long-distance travel.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <button
                  onClick={() => document.getElementById('origin-input')?.focus()}
                  className="bg-white text-brand-600 font-bold px-8 py-3.5 rounded-xl hover:bg-white/90 transition-all shadow-xl hover:shadow-2xl hover:-translate-y-0.5 flex items-center gap-2"
                  id="cta-book-now"
                >
                  <Search className="h-5 w-5" />
                  Book Now
                </button>
                <button className="text-white/90 font-semibold px-8 py-3.5 rounded-xl border-2 border-white/30 hover:bg-white/10 transition-all flex items-center gap-2">
                  Learn More
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

/* ─── Testimonials Carousel ────────────────────────── */
function TestimonialsSection({ sectionRef }: { sectionRef: React.RefObject<HTMLDivElement | null> }) {
  const [active, setActive] = useState(0);

  const testimonials = [
    {
      name: "Rashida Akter",
      role: "Frequent Traveler",
      text: "BusGo has completely changed how I book bus tickets. The seat selection feature is amazing — I can pick my favorite window seat every time!",
      rating: 5,
      initial: "R",
      color: "from-brand-500 to-pink-500",
    },
    {
      name: "Kamal Hossain",
      role: "Business Professional",
      text: "I travel Dhaka to Chittagong every week. BusGo saves me at least 15 minutes per booking compared to buying at the counter. Highly recommended!",
      rating: 5,
      initial: "K",
      color: "from-blue-500 to-indigo-500",
    },
    {
      name: "Nusrat Jahan",
      role: "Student",
      text: "The prices are always competitive, and I love that I can compare different operators side by side. The e-ticket feature means no more paper hassle!",
      rating: 4,
      initial: "N",
      color: "from-emerald-500 to-teal-500",
    },
  ];

  const next = () => setActive((a) => (a + 1) % testimonials.length);
  const prev = () => setActive((a) => (a - 1 + testimonials.length) % testimonials.length);

  useEffect(() => {
    const timer = setInterval(next, 6000);
    return () => clearInterval(timer);
  }, []);

  const t = testimonials[active];

  return (
    <section className="py-20 bg-surface-50" id="testimonials">
      <div ref={sectionRef} className="scroll-fade max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14">
          <span className="inline-block px-3 py-1 rounded-full bg-brand-50 text-brand-600 text-xs font-bold uppercase tracking-wider mb-3">
            Testimonials
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-surface-900">
            Loved by travelers everywhere
          </h2>
        </div>

        <div className="max-w-3xl mx-auto">
          <div className="card-premium p-8 sm:p-12 text-center relative" id="testimonial-card">
            <Quote className="h-10 w-10 text-brand-100 mx-auto mb-6" />

            <p className="text-lg sm:text-xl text-surface-700 leading-relaxed mb-8 font-body min-h-[80px]">
              "{t.text}"
            </p>

            <div className="flex items-center justify-center gap-3 mb-4">
              <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${t.color} flex items-center justify-center text-white font-bold text-lg shadow-lg`}>
                {t.initial}
              </div>
              <div className="text-left">
                <p className="font-bold text-surface-900">{t.name}</p>
                <p className="text-sm text-surface-500">{t.role}</p>
              </div>
            </div>

            <div className="flex items-center justify-center gap-0.5 mb-6">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  className={`h-4 w-4 ${i < t.rating ? "text-accent-400 fill-accent-400" : "text-surface-300"}`}
                />
              ))}
            </div>

            {/* Navigation */}
            <div className="flex items-center justify-center gap-4">
              <button onClick={prev} className="p-2 rounded-full hover:bg-surface-100 text-surface-400 hover:text-surface-700 transition-colors" id="testimonial-prev">
                <ChevronLeft className="h-5 w-5" />
              </button>
              <div className="flex gap-2">
                {testimonials.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setActive(i)}
                    className={`w-2 h-2 rounded-full transition-all duration-300 ${
                      i === active ? "w-6 bg-brand-500" : "bg-surface-300 hover:bg-surface-400"
                    }`}
                  />
                ))}
              </div>
              <button onClick={next} className="p-2 rounded-full hover:bg-surface-100 text-surface-400 hover:text-surface-700 transition-colors" id="testimonial-next">
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}