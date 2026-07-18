import { useState } from "react";
import { Link } from "react-router-dom";
import { BriefcaseBusiness, Bus, ShieldCheck, Ticket } from "lucide-react";
import { startGoogleSignIn, type RegistrationRole } from "../lib/googleAuth";

function GoogleIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09A6.52 6.52 0 0 1 5.49 12c0-.73.13-1.43.35-2.09V7.07H2.18A11 11 0 0 0 1 12c0 1.78.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

export function Register() {
  const [role, setRole] = useState<RegistrationRole>("CUSTOMER");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const register = async () => {
    setLoading(true);
    setError("");
    try {
      await startGoogleSignIn({ role, returnTo: role === "OPERATOR" ? "/operator" : "/" });
    } catch (reason: any) {
      setError(reason?.message || "Unable to start Google registration.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex" id="register-page">
      <div className="hidden lg:flex lg:w-1/2 hero-gradient items-center justify-center p-12">
        <div className="max-w-md text-center text-white">
          <div className="w-20 h-20 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center mx-auto mb-8"><Bus className="h-10 w-10" /></div>
          <h2 className="text-3xl font-extrabold mb-4">Join BusGo with Google</h2>
          <p className="text-white/70 text-lg">Your verified name and email create the account. No BusGo password is stored.</p>
        </div>
      </div>
      <div className="w-full lg:w-1/2 flex items-center justify-center px-6 py-12 bg-white">
        <div className="w-full max-w-md">
          <h1 className="text-3xl font-extrabold text-surface-900 mb-2">Create your account</h1>
          <p className="text-surface-500 mb-8">First choose how you will use BusGo.</p>

          <div className="grid sm:grid-cols-2 gap-3 mb-6">
            {[
              { value: "CUSTOMER" as const, title: "Passenger", text: "Search and book tickets", icon: Ticket },
              { value: "OPERATOR" as const, title: "Bus operator", text: "Manage buses and routes", icon: BriefcaseBusiness },
            ].map(({ value, title, text, icon: Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => setRole(value)}
                className={`rounded-xl border-2 p-4 text-left transition-all ${role === value ? "border-brand-600 bg-brand-50" : "border-surface-200 hover:border-surface-300"}`}
              >
                <Icon className={`h-6 w-6 mb-3 ${role === value ? "text-brand-600" : "text-surface-500"}`} />
                <span className="block font-bold text-surface-900">{title}</span>
                <span className="text-xs text-surface-500">{text}</span>
              </button>
            ))}
          </div>

          {error && <div className="mb-5 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>}
          <button
            type="button"
            onClick={register}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 px-5 py-3.5 rounded-xl border-2 border-surface-200 font-semibold hover:bg-surface-50 transition-all disabled:opacity-60"
          >
            {loading ? <span className="w-5 h-5 border-2 border-surface-300 border-t-brand-600 rounded-full animate-spin" /> : <GoogleIcon />}
            {loading ? "Connecting to Google…" : "Create account with Google"}
          </button>
          <div className="flex gap-3 mt-6 rounded-xl bg-surface-50 p-4 text-sm text-surface-600">
            <ShieldCheck className="h-5 w-5 text-emerald-600 shrink-0" />
            <p>Admin access cannot be requested here. Existing admin accounts are recognized only by their saved BusGo role.</p>
          </div>
          <p className="text-center text-sm text-surface-500 mt-8">Already registered? <Link to="/login" className="text-brand-600 font-semibold">Sign in</Link></p>
        </div>
      </div>
    </div>
  );
}
