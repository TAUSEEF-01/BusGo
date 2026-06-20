import { Outlet, Link, useNavigate, useLocation } from "react-router-dom";
import { useAuthStore } from "../stores/authStore";
import {
  LogOut,
  User,
  Menu,
  X,
  Bus,
  MapPin,
  Phone,
  Mail,
  ChevronRight,
  Ticket,
  HelpCircle,
  Home,
  Shield,
  Clock,
  ChevronDown,
  BadgePercent,
} from "lucide-react";
import { useState, useEffect } from "react";
import { NotificationBell } from "../notifications/NotificationBell";

export function MainLayout() {
  return (
    <div className="min-h-screen flex flex-col bg-surface-50">
      <Navbar />
      <main className="flex-grow">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}

/* ════════════════════════════════════════════════════
   NAVBAR — Glassmorphism with scroll-aware opacity
   ════════════════════════════════════════════════════ */
function Navbar() {
  const { isAuthenticated, user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
    setProfileOpen(false);
  }, [location.pathname]);

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const isHome = location.pathname === "/";
  const navBg = scrolled
    ? "bg-white/90 backdrop-blur-xl shadow-elevation-2 border-b border-surface-200/50"
    : isHome
      ? "bg-transparent"
      : "bg-white/90 backdrop-blur-xl border-b border-surface-200/50";
  const textColor = scrolled || !isHome ? "text-surface-800" : "text-white";
  const logoColor = scrolled || !isHome ? "text-brand-600" : "text-white";

  const navLinks = [
    { to: "/", label: "Home", icon: Home },
    { to: "/routes", label: "Routes", icon: MapPin },
    { to: "/deals", label: "Deals", icon: BadgePercent },
    ...(isAuthenticated ? [{ to: "/my-bookings", label: "My Bookings", icon: Ticket }] : []),
  ];

  return (
    <>
      <nav
        id="main-navbar"
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-400 ${navBg}`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16 lg:h-18">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2 group" id="nav-logo">
              <div className={`p-1.5 rounded-lg transition-colors duration-300 ${
                scrolled || !isHome ? "bg-brand-600" : "bg-white/20"
              }`}>
                <Bus className="h-5 w-5 text-white" />
              </div>
              <span className={`text-2xl font-extrabold tracking-tight transition-colors duration-300 ${logoColor}`}>
                Bus<span className={scrolled || !isHome ? "text-brand-500" : "text-white/80"}>Go</span>
              </span>
            </Link>

            {/* Desktop Nav */}
            <div className="hidden md:flex items-center gap-1">
              {navLinks.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${
                    location.pathname === link.to
                      ? scrolled || !isHome
                        ? "bg-brand-50 text-brand-600"
                        : "bg-white/20 text-white"
                      : `${textColor} hover:${scrolled || !isHome ? "bg-surface-100" : "bg-white/10"}`
                  }`}
                >
                  <link.icon className="h-4 w-4" />
                  {link.label}
                </Link>
              ))}
            </div>

            {/* Right Side */}
            <div className="hidden md:flex items-center gap-3">
              {isAuthenticated ? (
                <>
                  {/* Notification Bell */}
                  <NotificationBell scrolled={scrolled} isHome={isHome} />

                  <div className="relative">
                  <button
                    id="profile-button"
                    onClick={() => setProfileOpen(!profileOpen)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl transition-all duration-300 ${
                      scrolled || !isHome
                        ? "hover:bg-surface-100 text-surface-700"
                        : "hover:bg-white/10 text-white"
                    }`}
                  >
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white text-sm font-bold shadow-brand">
                      {user?.name?.charAt(0)?.toUpperCase() || "U"}
                    </div>
                    <span className="text-sm font-medium max-w-24 truncate">{user?.name || "Profile"}</span>
                    <ChevronRight className={`h-4 w-4 transition-transform duration-300 ${profileOpen ? "rotate-90" : ""}`} />
                  </button>

                  {profileOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setProfileOpen(false)} />
                      <div className="absolute right-0 mt-2 w-56 z-50 bg-white rounded-xl shadow-glass-lg border border-surface-200 overflow-hidden animate-scale-in origin-top-right">
                        <div className="px-4 py-3 border-b border-surface-100 bg-surface-50">
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-sm font-semibold text-surface-900">{user?.name}</p>
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-brand-100 text-brand-700 uppercase">
                              {user?.role}
                            </span>
                          </div>
                          <p className="text-xs text-surface-500 truncate">{user?.email}</p>
                        </div>
                        <div className="py-1">
                          {user?.role?.toUpperCase() === "OPERATOR" && (
                            <Link to="/operator" className="flex items-center gap-2 px-4 py-2.5 text-sm text-brand-600 font-bold hover:bg-brand-50 transition-colors">
                              <Bus className="h-4 w-4" /> Operator Portal
                            </Link>
                          )}
                          {user?.role?.toUpperCase() === "ADMIN" && (
                            <Link to="/admin" className="flex items-center gap-2 px-4 py-2.5 text-sm text-accent-600 font-bold hover:bg-accent-50 transition-colors">
                              <Shield className="h-4 w-4" /> Admin Portal
                            </Link>
                          )}
                           <Link to="/profile" className="flex items-center gap-2 px-4 py-2.5 text-sm text-surface-700 hover:bg-surface-50 transition-colors">
                            <User className="h-4 w-4 text-surface-400" /> My Profile
                          </Link>
                          <Link to="/my-bookings" className="flex items-center gap-2 px-4 py-2.5 text-sm text-surface-700 hover:bg-surface-50 transition-colors">
                            <Ticket className="h-4 w-4 text-surface-400" /> My Bookings
                          </Link>
                          <button
                            id="logout-button"
                            onClick={handleLogout}
                            className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                          >
                            <LogOut className="h-4 w-4" /> Sign out
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                  </div>
                </>
              ) : (
                <>
                  <Link
                    to="/login"
                    id="login-link"
                    className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-300 ${
                      scrolled || !isHome
                        ? "text-surface-700 hover:text-brand-600 hover:bg-brand-50"
                        : "text-white hover:bg-white/15"
                    }`}
                  >
                    Log in
                  </Link>
                  <Link
                    to="/register"
                    id="register-link"
                    className="btn-primary text-sm !py-2 !px-5 !rounded-lg inline-flex items-center"
                  >
                    Get Started
                  </Link>
                </>
              )}
            </div>

            {/* Mobile Toggle */}
            <button
              id="mobile-menu-toggle"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className={`md:hidden p-2 rounded-lg transition-colors ${
                scrolled || !isHome ? "text-surface-600 hover:bg-surface-100" : "text-white hover:bg-white/10"
              }`}
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-surface-900/60 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} />
          <div className="absolute top-0 right-0 w-80 max-w-[85vw] h-full bg-white shadow-2xl animate-slide-in-right">
            <div className="flex items-center justify-between p-4 border-b border-surface-100">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-brand-600">
                  <Bus className="h-4 w-4 text-white" />
                </div>
                <span className="text-xl font-extrabold text-surface-900">BusGo</span>
              </div>
              <button onClick={() => setMobileMenuOpen(false)} className="p-2 hover:bg-surface-100 rounded-lg">
                <X className="h-5 w-5 text-surface-500" />
              </button>
            </div>

            {isAuthenticated && (
              <div className="p-4 border-b border-surface-100 bg-surface-50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white font-bold">
                    {user?.name?.charAt(0)?.toUpperCase() || "U"}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-surface-900">{user?.name}</p>
                    <p className="text-xs text-surface-500">{user?.email}</p>
                  </div>
                </div>
              </div>
            )}

            <div className="p-3 space-y-1">
              {user?.role?.toUpperCase() === "OPERATOR" && (
                <Link
                  to="/operator"
                  className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-brand-600 bg-brand-50"
                >
                  <Bus className="h-5 w-5" />
                  Operator Portal
                </Link>
              )}
              {user?.role?.toUpperCase() === "ADMIN" && (
                <Link
                  to="/admin"
                  className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-accent-600 bg-accent-50"
                >
                  <Shield className="h-5 w-5" />
                  Admin Portal
                </Link>
              )}
              {navLinks.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                    location.pathname === link.to
                      ? "bg-brand-50 text-brand-600"
                      : "text-surface-700 hover:bg-surface-50"
                  }`}
                >
                  <link.icon className="h-5 w-5" />
                  {link.label}
                </Link>
              ))}
              {isAuthenticated && (
                <Link
                  to="/profile"
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                    location.pathname === "/profile"
                      ? "bg-brand-50 text-brand-600"
                      : "text-surface-700 hover:bg-surface-50"
                  }`}
                >
                  <User className="h-5 w-5 text-surface-400" />
                  My Profile
                </Link>
              )}
              <Link
                to="/routes"
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-surface-700 hover:bg-surface-50 transition-colors"
              >
                <HelpCircle className="h-5 w-5" />
                Help & Support
              </Link>
            </div>

            <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-surface-100 bg-white">
              {isAuthenticated ? (
                <button
                  onClick={handleLogout}
                  className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-semibold text-red-600 bg-red-50 hover:bg-red-100 transition-colors"
                >
                  <LogOut className="h-4 w-4" /> Sign out
                </button>
              ) : (
                <div className="space-y-2">
                  <Link to="/login" className="block w-full text-center py-3 rounded-xl text-sm font-semibold text-brand-600 border-2 border-brand-600 hover:bg-brand-50 transition-colors">
                    Log in
                  </Link>
                  <Link to="/register" className="block w-full text-center py-3 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-brand-600 to-brand-700 hover:shadow-brand transition-all">
                    Get Started
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Spacer for fixed navbar */}
      {!isHome && <div className="h-16 lg:h-18" />}
    </>
  );
}

/* ════════════════════════════════════════════════════
   FOOTER — Rich multi-column with gradient background
   ════════════════════════════════════════════════════ */
function Footer() {
  const footerLinks = {
    company: [
      { label: "About Us", to: "/" },
      { label: "Careers", to: "/" },
      { label: "Blog", to: "/" },
      { label: "Press", to: "/" },
    ],
    support: [
      { label: "Help Center", to: "/" },
      { label: "Deals & Offers", to: "/deals" },
      { label: "Cancellation", to: "/" },
      { label: "Report Issue", to: "/" },
    ],
    legal: [
      { label: "Terms of Service", to: "/" },
      { label: "Privacy Policy", to: "/" },
      { label: "Cookie Policy", to: "/" },
      { label: "Refund Policy", to: "/" },
    ],
  };

  const socialLinks = [
    { icon: (props: any) => <svg {...props} fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>, label: "Facebook", href: "#" },
    { icon: (props: any) => <svg {...props} fill="currentColor" viewBox="0 0 24 24"><path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/></svg>, label: "Twitter", href: "#" },
    { icon: (props: any) => <svg {...props} fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>, label: "Instagram", href: "#" },
    { icon: (props: any) => <svg {...props} fill="currentColor" viewBox="0 0 24 24"><path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>, label: "Youtube", href: "#" },
  ];

  return (
    <footer className="relative bg-surface-900 text-white overflow-hidden" id="site-footer">
      {/* Gradient accent at top */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-brand-600 via-accent-500 to-brand-600" />

      {/* Decorative elements */}
      <div className="absolute top-10 right-10 w-64 h-64 bg-brand-600/5 rounded-full blur-3xl" />
      <div className="absolute bottom-10 left-10 w-48 h-48 bg-accent-500/5 rounded-full blur-3xl" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Newsletter Strip */}
        <div className="py-8 border-b border-surface-800">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold">Stay updated with the best deals</h3>
              <p className="text-surface-400 text-sm mt-0.5">Get exclusive offers and travel tips straight to your inbox.</p>
            </div>
            <div className="flex w-full md:w-auto gap-2">
              <input
                type="email"
                placeholder="Enter your email"
                className="flex-1 md:w-72 px-4 py-2.5 rounded-lg bg-surface-800 border border-surface-700 text-white placeholder-surface-500 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 text-sm transition-colors"
                id="newsletter-email"
              />
              <button className="btn-primary !py-2.5 !px-6 !text-sm whitespace-nowrap" id="newsletter-subscribe">
                Subscribe
              </button>
            </div>
          </div>
        </div>

        {/* Links Grid */}
        <div className="py-12 grid grid-cols-2 md:grid-cols-5 gap-8">
          {/* Brand Column */}
          <div className="col-span-2 md:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <div className="p-1.5 rounded-lg bg-brand-600">
                <Bus className="h-5 w-5 text-white" />
              </div>
              <span className="text-2xl font-extrabold">BusGo</span>
            </div>
            <p className="text-surface-400 text-sm leading-relaxed mb-6 max-w-sm">
              Bangladesh's most trusted bus booking platform. Book tickets, compare operators, and travel with confidence.
            </p>

            {/* Contact Info */}
            <div className="space-y-2.5">
              <a href="tel:+8809612000000" className="flex items-center gap-2 text-surface-400 hover:text-white text-sm transition-colors">
                <Phone className="h-4 w-4 text-brand-500" /> +880 9612-000000
              </a>
              <a href="mailto:support@busgo.com.bd" className="flex items-center gap-2 text-surface-400 hover:text-white text-sm transition-colors">
                <Mail className="h-4 w-4 text-brand-500" /> support@busgo.com.bd
              </a>
              <div className="flex items-center gap-2 text-surface-400 text-sm">
                <Clock className="h-4 w-4 text-brand-500" /> 24/7 Customer Support
              </div>
            </div>
          </div>

          {/* Link Columns */}
          {Object.entries(footerLinks).map(([title, links]) => (
            <div key={title}>
              <h4 className="text-sm font-bold uppercase tracking-wider text-surface-300 mb-4">
                {title}
              </h4>
              <ul className="space-y-2.5">
                {links.map((link) => (
                  <li key={link.label}>
                    <Link
                      to={link.to}
                      className="text-surface-400 hover:text-white text-sm transition-colors duration-200 flex items-center gap-1 group"
                    >
                      <ChevronRight className="h-3 w-3 opacity-0 -ml-4 group-hover:opacity-100 group-hover:ml-0 transition-all duration-200" />
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom Bar */}
        <div className="py-6 border-t border-surface-800 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-1 text-surface-500 text-sm">
            <Shield className="h-4 w-4" />
            <span>&copy; {new Date().getFullYear()} BusGo. All rights reserved.</span>
          </div>

          <div className="flex items-center gap-3">
            {socialLinks.map((social) => (
              <a
                key={social.label}
                href={social.href}
                aria-label={social.label}
                className="w-9 h-9 rounded-lg bg-surface-800 hover:bg-brand-600 flex items-center justify-center text-surface-400 hover:text-white transition-all duration-300"
              >
                <social.icon className="h-4 w-4" />
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
