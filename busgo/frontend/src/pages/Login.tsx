import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuthStore } from "../stores/authStore";
import { apiClient } from "../api/client";
import { Mail, Lock, Eye, EyeOff, Bus, ArrowRight, Shield, Zap, Clock, Phone as PhoneIcon } from "lucide-react";

export function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const login = useAuthStore((s) => s.login);
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [selectedRole, setSelectedRole] = useState<"CUSTOMER" | "OPERATOR">("CUSTOMER");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const from = location.state?.from?.pathname || "/";
  const fromState = location.state?.from?.state || {};

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone || !password) {
      setError("Please enter phone and password");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const response = await apiClient.post("/api/auth/login", {
        phone,
        password,
        expected_role: selectedRole,
      });
      if (response.data.success) {
        const { access_token, refresh_token, user } = response.data.data;
          login(
            { id: user.id, name: user.full_name, email: user.email || "", phone: user.phone, role: user.role },
            access_token,
            refresh_token
          );
          
          const role = user.role?.toUpperCase();
          if (role === "ADMIN") {
            if (from === "/" || from.startsWith("/operator") || from.startsWith("/admin")) {
              navigate("/admin");
            } else {
              navigate(from, { state: fromState, replace: true });
            }
          } else if (role === "OPERATOR") {
            if (from === "/" || from.startsWith("/operator") || from.startsWith("/admin")) {
              navigate("/operator");
            } else {
              navigate(from, { state: fromState, replace: true });
            }
          } else {
            navigate(from, { state: fromState, replace: true });
          }
      } else {
        setError(response.data.message || "Login failed");
      }
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      if (typeof detail === "string") {
        setError(detail);
      } else {
        setError("Login failed. Please check your credentials.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex" id="login-page">
      {/* Left — Illustration Side */}
      <div className="hidden lg:flex lg:w-1/2 hero-gradient relative overflow-hidden items-center justify-center p-12">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-20 -right-20 w-96 h-96 bg-white/5 rounded-full blur-3xl floating" />
          <div className="absolute bottom-10 -left-20 w-80 h-80 bg-white/5 rounded-full blur-3xl floating-delayed" />
          <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
        </div>

        <div className="relative z-10 text-white max-w-md text-center">
          <div className="w-20 h-20 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center mx-auto mb-8">
            <Bus className="h-10 w-10" />
          </div>
          <h2 className="text-3xl font-extrabold mb-4">Welcome back to BusGo</h2>
          <p className="text-white/70 text-lg mb-10">Your journey awaits. Sign in to access your bookings and continue traveling with ease.</p>

          <div className="space-y-4 text-left">
            {[
              { icon: Shield, text: "Secure, encrypted login" },
              { icon: Zap, text: "One-click booking from your history" },
              { icon: Clock, text: "Track your upcoming trips" },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3 bg-white/10 rounded-xl px-4 py-3 backdrop-blur-sm border border-white/10">
                <item.icon className="h-5 w-5 text-accent-300" />
                <span className="text-sm font-medium text-white/90">{item.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right — Form Side */}
      <div className="w-full lg:w-1/2 flex items-center justify-center px-6 py-12 bg-white">
        <div className="w-full max-w-md animate-fade-in-up">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="p-1.5 rounded-lg bg-brand-600">
              <Bus className="h-5 w-5 text-white" />
            </div>
            <span className="text-2xl font-extrabold text-surface-900">BusGo</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-surface-900 mb-2" id="login-heading">
            Sign in to your account
          </h1>
          <p className="text-surface-500 mb-8">
            Don't have an account?{" "}
            <Link to="/register" className="text-brand-600 font-semibold hover:text-brand-700 transition-colors">
              Create one free
            </Link>
          </p>

          {error && (
            <div className="mb-6 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5" id="login-form">
            {/* <div>
              <label className="block text-sm font-semibold text-surface-700 mb-2">Sign in as</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedRole("CUSTOMER")}
                  className={`flex items-center justify-center p-2.5 rounded-xl border-2 text-sm font-bold uppercase tracking-wider transition-all ${
                    selectedRole === "CUSTOMER"
                      ? "border-brand-600 bg-brand-50 text-brand-700"
                      : "border-surface-200 bg-white text-surface-500 hover:border-surface-300"
                  }`}
                >
                  Customer
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedRole("OPERATOR")}
                  className={`flex items-center justify-center p-2.5 rounded-xl border-2 text-sm font-bold uppercase tracking-wider transition-all ${
                    selectedRole === "OPERATOR"
                      ? "border-brand-600 bg-brand-50 text-brand-700"
                      : "border-surface-200 bg-white text-surface-500 hover:border-surface-300"
                  }`}
                >
                  Operator
                </button>
              </div>
            </div> */}

            <div>
              <label htmlFor="login-phone" className="block text-sm font-semibold text-surface-700 mb-1.5">
                Phone number or Email
              </label>
              <div className="relative">
                <PhoneIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-surface-400" />
                <input
                  id="login-phone"
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+880 1XXX XXXXXX or name@example.com"
                  className="input-premium !pl-10"
                  required
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="login-password" className="block text-sm font-semibold text-surface-700">
                  Password
                </label>
                <button type="button" className="text-xs text-brand-600 font-semibold hover:text-brand-700">
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-surface-400" />
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="input-premium !pl-10 !pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="remember-me"
                className="w-4 h-4 rounded border-surface-300 text-brand-600 focus:ring-brand-500"
              />
              <label htmlFor="remember-me" className="text-sm text-surface-600">Remember me</label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full flex items-center justify-center gap-2 !py-3 text-base disabled:opacity-60"
              id="login-submit"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  Sign in
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-8 relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-surface-200" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-3 bg-white text-surface-400">or continue with</span>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3">
            <button className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border-2 border-surface-200 text-surface-700 font-medium text-sm hover:bg-surface-50 hover:border-surface-300 transition-all" id="google-login">
              <svg className="w-5 h-5" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
              Google
            </button>
            <button className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border-2 border-surface-200 text-surface-700 font-medium text-sm hover:bg-surface-50 hover:border-surface-300 transition-all" id="facebook-login">
              <svg className="w-5 h-5" fill="#1877F2" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
              Facebook
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
