import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Bus, CheckCircle2, Shield, Zap, Clock } from "lucide-react";
import { exchangeGoogleSession, startGoogleSignIn } from "../lib/googleAuth";

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

export function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const callbackStarted = useRef(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const requestedPath = location.state?.from
    ? `${location.state.from.pathname || "/"}${location.state.from.search || ""}`
    : "/";

  const finishLogin = (user: { role?: string }, returnTo: string) => {
    const role = user.role?.toUpperCase();
    const safeReturnTo = returnTo.startsWith("/") ? returnTo : "/";
    if (role === "ADMIN" && (safeReturnTo === "/" || safeReturnTo.startsWith("/operator"))) {
      navigate("/admin", { replace: true });
    } else if (role === "OPERATOR" && (safeReturnTo === "/" || safeReturnTo.startsWith("/admin"))) {
      navigate("/operator", { replace: true });
    } else {
      navigate(safeReturnTo, { replace: true });
    }
  };

  useEffect(() => {
    const isCallback = new URLSearchParams(location.search).get("google") === "callback";
    if (!isCallback || callbackStarted.current) return;
    callbackStarted.current = true;
    setLoading(true);
    exchangeGoogleSession()
      .then(({ user, returnTo }) => finishLogin(user, returnTo))
      .catch((reason) => setError(reason?.response?.data?.detail || reason?.message || "Google login failed."))
      .finally(() => setLoading(false));
  }, [location.search]);

  const signIn = async () => {
    setLoading(true);
    setError("");
    try {
      await startGoogleSignIn({ returnTo: requestedPath });
    } catch (reason: any) {
      setError(reason?.message || "Unable to start Google login.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex" id="login-page">
      <div className="hidden lg:flex lg:w-1/2 hero-gradient relative overflow-hidden items-center justify-center p-12">
        <div className="absolute inset-0" style={{ backgroundImage: "radial-gradient(rgba(255,255,255,.06) 1px, transparent 1px)", backgroundSize: "32px 32px" }} />
        <div className="relative z-10 text-white max-w-md text-center">
          <div className="w-20 h-20 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center mx-auto mb-8">
            <Bus className="h-10 w-10" />
          </div>
          <h2 className="text-3xl font-extrabold mb-4">Welcome back to BusGo</h2>
          <p className="text-white/70 text-lg mb-10">One secure Google account for bookings, operator tools, and administration.</p>
          <div className="space-y-4 text-left">
            {[
              { icon: Shield, text: "Google-secured identity" },
              { icon: Zap, text: "No password to remember" },
              { icon: Clock, text: "Your existing account and role are preserved" },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-3 bg-white/10 rounded-xl px-4 py-3 border border-white/10">
                <Icon className="h-5 w-5 text-accent-300" />
                <span className="text-sm font-medium text-white/90">{text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="w-full lg:w-1/2 flex items-center justify-center px-6 py-12 bg-white">
        <div className="w-full max-w-md animate-fade-in-up">
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="p-1.5 rounded-lg bg-brand-600"><Bus className="h-5 w-5 text-white" /></div>
            <span className="text-2xl font-extrabold text-surface-900">BusGo</span>
          </div>
          <h1 className="text-3xl font-extrabold text-surface-900 mb-2" id="login-heading">Sign in securely</h1>
          <p className="text-surface-500 mb-8">Use the Google address already associated with your BusGo account.</p>

          {error && <div className="mb-6 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-medium">{error}</div>}
          {new URLSearchParams(location.search).get("google") === "callback" && !error && (
            <div className="mb-6 p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 text-sm font-medium">Completing your secure sign-in…</div>
          )}

          <button
            type="button"
            onClick={signIn}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 px-5 py-3.5 rounded-xl border-2 border-surface-200 bg-white text-surface-800 font-semibold hover:bg-surface-50 hover:border-surface-300 transition-all disabled:opacity-60"
            id="google-login"
          >
            {loading ? <span className="w-5 h-5 border-2 border-surface-300 border-t-brand-600 rounded-full animate-spin" /> : <GoogleIcon />}
            {loading ? "Signing you in…" : "Continue with Google"}
          </button>

          <div className="mt-6 flex gap-3 rounded-xl bg-emerald-50 border border-emerald-100 p-4 text-sm text-emerald-800">
            <CheckCircle2 className="h-5 w-5 shrink-0" />
            <p>Customers, operators, and admins use this same button. BusGo opens the correct portal based on your saved role.</p>
          </div>
          <p className="text-center text-sm text-surface-500 mt-8">
            New to BusGo? <Link to="/register" className="text-brand-600 font-semibold hover:text-brand-700">Create an account</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
