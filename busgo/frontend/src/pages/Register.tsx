import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "../stores/authStore";
import { apiClient } from "../api/client";
import { Mail, Lock, Eye, EyeOff, Bus, ArrowRight, User, Phone, Check, Shield, Zap, Heart } from "lucide-react";

const STEPS = ["Account", "Personal", "Verify"];

export function Register() {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [registerError, setRegisterError] = useState("");
  const [form, setForm] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    name: "",
    phone: "",
    agreedToTerms: false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = (key: string, value: string | boolean) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: "" }));
  };

  const validateStep = () => {
    const errs: Record<string, string> = {};
    if (step === 0) {
      if (!form.email) errs.email = "Email is required";
      else if (!/\S+@\S+\.\S+/.test(form.email)) errs.email = "Invalid email address";
      if (!form.password) errs.password = "Password is required";
      else if (form.password.length < 8) errs.password = "Must be at least 8 characters";
      if (form.password !== form.confirmPassword) errs.confirmPassword = "Passwords don't match";
    }
    if (step === 1) {
      if (!form.name) errs.name = "Name is required";
      if (!form.phone) errs.phone = "Phone is required";
    }
    if (step === 2) {
      if (!form.agreedToTerms) errs.agreedToTerms = "You must agree to the terms";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const nextStep = () => {
    if (validateStep()) {
      if (step < STEPS.length - 1) setStep(step + 1);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateStep()) return;
    setLoading(true);
    setRegisterError("");
    try {
      // Register user via auth-service
      const registerResponse = await apiClient.post("/api/auth/register", {
        phone: form.phone,
        full_name: form.name,
        password: form.password,
        email: form.email,
      });
      
      if (registerResponse.data.success) {
        // Auto-login after registration (skip OTP for dev)
        try {
          const loginResponse = await apiClient.post("/api/auth/login", {
            phone: form.phone,
            password: form.password,
          });
          if (loginResponse.data.success) {
            const { access_token, refresh_token, user } = loginResponse.data.data;
            login(
              { id: user.id, name: user.full_name, email: user.email || "", phone: user.phone, role: user.role },
              access_token,
              refresh_token
            );
            navigate("/");
            return;
          }
        } catch {
          // Login failed after register, redirect to login page
        }
        navigate("/login");
      } else {
        setRegisterError(registerResponse.data.message || "Registration failed");
      }
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      setRegisterError(typeof detail === "string" ? detail : "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex" id="register-page">
      {/* Left — Illustration */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden items-center justify-center p-12" style={{
        background: 'linear-gradient(-45deg, #0F172A, #1E293B, #334155, #1E293B)',
        backgroundSize: '400% 400%',
        animation: 'gradientShift 12s ease infinite',
      }}>
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-20 -right-20 w-96 h-96 bg-brand-500/10 rounded-full blur-3xl floating" />
          <div className="absolute bottom-10 -left-20 w-80 h-80 bg-accent-500/10 rounded-full blur-3xl floating-delayed" />
          <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,0.04) 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
        </div>

        <div className="relative z-10 text-white max-w-md text-center">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-brand-500 to-accent-500 flex items-center justify-center mx-auto mb-8 shadow-brand-lg">
            <Bus className="h-10 w-10" />
          </div>
          <h2 className="text-3xl font-extrabold mb-4">Join the BusGo family</h2>
          <p className="text-white/60 text-lg mb-10">Create your account and start booking bus tickets across Bangladesh in seconds.</p>

          <div className="space-y-4 text-left">
            {[
              { icon: Shield, text: "Your data is always encrypted and secure" },
              { icon: Zap, text: "Book tickets in under 60 seconds" },
              { icon: Heart, text: "Exclusive deals for registered users" },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3 bg-white/5 rounded-xl px-4 py-3 backdrop-blur-sm border border-white/10">
                <item.icon className="h-5 w-5 text-accent-400" />
                <span className="text-sm font-medium text-white/80">{item.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right — Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center px-6 py-12 bg-white">
        <div className="w-full max-w-md animate-fade-in-up">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="p-1.5 rounded-lg bg-brand-600">
              <Bus className="h-5 w-5 text-white" />
            </div>
            <span className="text-2xl font-extrabold text-surface-900">BusGo</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-surface-900 mb-2" id="register-heading">
            Create your account
          </h1>
          <p className="text-surface-500 mb-8">
            Already have an account?{" "}
            <Link to="/login" className="text-brand-600 font-semibold hover:text-brand-700 transition-colors">
              Sign in
            </Link>
          </p>

          {registerError && (
            <div className="mb-6 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-medium animate-fade-in">
              {registerError}
            </div>
          )}

          {/* Progress Steps */}
          <div className="flex items-center gap-3 mb-10">
            {STEPS.map((s, i) => (
              <div key={s} className="flex items-center gap-2 flex-1">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300 ${
                  i < step ? "bg-emerald-500 text-white" :
                  i === step ? "bg-brand-600 text-white shadow-brand" :
                  "bg-surface-100 text-surface-400"
                }`}>
                  {i < step ? <Check className="h-4 w-4" /> : i + 1}
                </div>
                <span className={`text-sm font-medium hidden sm:block ${i <= step ? "text-surface-900" : "text-surface-400"}`}>
                  {s}
                </span>
                {i < STEPS.length - 1 && (
                  <div className={`flex-1 h-0.5 rounded ${i < step ? "bg-emerald-500" : "bg-surface-200"}`} />
                )}
              </div>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-5" id="register-form">
            {/* Step 1: Account */}
            {step === 0 && (
              <div className="space-y-5 animate-fade-in">
                <div>
                  <label htmlFor="reg-email" className="block text-sm font-semibold text-surface-700 mb-1.5">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-surface-400" />
                    <input id="reg-email" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="name@example.com" className={`input-premium !pl-10 ${errors.email ? "!border-red-400" : ""}`} />
                  </div>
                  {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
                </div>
                <div>
                  <label htmlFor="reg-password" className="block text-sm font-semibold text-surface-700 mb-1.5">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-surface-400" />
                    <input id="reg-password" type={showPassword ? "text" : "password"} value={form.password} onChange={(e) => set("password", e.target.value)} placeholder="Min 8 characters" className={`input-premium !pl-10 !pr-10 ${errors.password ? "!border-red-400" : ""}`} />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600">
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                  {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password}</p>}
                  {/* Password strength */}
                  {form.password && (
                    <div className="mt-2 flex gap-1">
                      {[1,2,3,4].map((i) => (
                        <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${
                          form.password.length >= i * 3 ? (form.password.length >= 12 ? "bg-emerald-500" : form.password.length >= 8 ? "bg-accent-500" : "bg-red-400") : "bg-surface-200"
                        }`} />
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <label htmlFor="reg-confirm" className="block text-sm font-semibold text-surface-700 mb-1.5">Confirm Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-surface-400" />
                    <input id="reg-confirm" type="password" value={form.confirmPassword} onChange={(e) => set("confirmPassword", e.target.value)} placeholder="Re-enter password" className={`input-premium !pl-10 ${errors.confirmPassword ? "!border-red-400" : ""}`} />
                  </div>
                  {errors.confirmPassword && <p className="text-red-500 text-xs mt-1">{errors.confirmPassword}</p>}
                </div>
              </div>
            )}

            {/* Step 2: Personal */}
            {step === 1 && (
              <div className="space-y-5 animate-fade-in">
                <div>
                  <label htmlFor="reg-name" className="block text-sm font-semibold text-surface-700 mb-1.5">Full Name</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-surface-400" />
                    <input id="reg-name" type="text" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Enter your full name" className={`input-premium !pl-10 ${errors.name ? "!border-red-400" : ""}`} />
                  </div>
                  {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
                </div>
                <div>
                  <label htmlFor="reg-phone" className="block text-sm font-semibold text-surface-700 mb-1.5">Phone Number</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-surface-400" />
                    <input id="reg-phone" type="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+880 1XXX XXXXXX" className={`input-premium !pl-10 ${errors.phone ? "!border-red-400" : ""}`} />
                  </div>
                  {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone}</p>}
                </div>
              </div>
            )}

            {/* Step 3: Verify */}
            {step === 2 && (
              <div className="space-y-5 animate-fade-in">
                <div className="card-premium p-6">
                  <h3 className="font-bold text-surface-900 mb-4">Review your information</h3>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between py-2 border-b border-surface-100">
                      <span className="text-surface-500">Email</span>
                      <span className="font-medium text-surface-900">{form.email}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-surface-100">
                      <span className="text-surface-500">Name</span>
                      <span className="font-medium text-surface-900">{form.name}</span>
                    </div>
                    <div className="flex justify-between py-2">
                      <span className="text-surface-500">Phone</span>
                      <span className="font-medium text-surface-900">{form.phone}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    id="agree-terms"
                    checked={form.agreedToTerms}
                    onChange={(e) => set("agreedToTerms", e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded border-surface-300 text-brand-600 focus:ring-brand-500"
                  />
                  <label htmlFor="agree-terms" className="text-sm text-surface-600">
                    I agree to the{" "}
                    <a href="#" className="text-brand-600 font-semibold hover:underline">Terms of Service</a> and{" "}
                    <a href="#" className="text-brand-600 font-semibold hover:underline">Privacy Policy</a>
                  </label>
                </div>
                {errors.agreedToTerms && <p className="text-red-500 text-xs">{errors.agreedToTerms}</p>}
              </div>
            )}

            {/* Navigation */}
            <div className="flex gap-3 pt-2">
              {step > 0 && (
                <button type="button" onClick={() => setStep(step - 1)} className="btn-secondary flex-1 !py-3" id="reg-back">
                  Back
                </button>
              )}
              {step < STEPS.length - 1 ? (
                <button type="button" onClick={nextStep} className="btn-primary flex-1 flex items-center justify-center gap-2 !py-3" id="reg-next">
                  Continue <ArrowRight className="h-4 w-4" />
                </button>
              ) : (
                <button type="submit" disabled={loading} className="btn-primary flex-1 flex items-center justify-center gap-2 !py-3 disabled:opacity-60" id="reg-submit">
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>Create Account <ArrowRight className="h-4 w-4" /></>
                  )}
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
