import { apiClient } from "../api/client";
import { useAuthStore } from "../stores/authStore";
import { requireSupabase } from "./supabase";

export type RegistrationRole = "CUSTOMER" | "OPERATOR";

const ROLE_KEY = "busgo.google.registration-role";
const RETURN_TO_KEY = "busgo.google.return-to";

export async function startGoogleSignIn(options?: {
  role?: RegistrationRole;
  returnTo?: string;
}) {
  if (options?.role) sessionStorage.setItem(ROLE_KEY, options.role);
  else sessionStorage.removeItem(ROLE_KEY);

  const safeReturnTo = options?.returnTo?.startsWith("/") ? options.returnTo : "/";
  sessionStorage.setItem(RETURN_TO_KEY, safeReturnTo);

  const redirectUrl = new URL("/login", window.location.origin);
  redirectUrl.searchParams.set("google", "callback");

  const { error } = await requireSupabase().auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: redirectUrl.toString() },
  });
  if (error) throw error;
}

export async function exchangeGoogleSession() {
  const client = requireSupabase();
  const { data, error } = await client.auth.getSession();
  if (error) throw error;
  if (!data.session?.access_token) {
    throw new Error("Google did not return a valid session. Please try again.");
  }

  const requestedRole = sessionStorage.getItem(ROLE_KEY);
  const role = requestedRole === "OPERATOR" ? "OPERATOR" : "CUSTOMER";
  const response = await apiClient.post("/api/auth/google-login", {
    token: data.session.access_token,
    role,
  });
  const payload = response.data?.data;
  if (!payload?.access_token || !payload?.refresh_token || !payload?.user) {
    throw new Error("BusGo returned an invalid Google login response.");
  }

  useAuthStore.getState().login(
    {
      id: payload.user.id,
      name: payload.user.full_name,
      email: payload.user.email || "",
      phone: payload.user.phone || "",
      role: payload.user.role,
    },
    payload.access_token,
    payload.refresh_token,
  );

  const returnTo = sessionStorage.getItem(RETURN_TO_KEY) || "/";
  sessionStorage.removeItem(ROLE_KEY);
  sessionStorage.removeItem(RETURN_TO_KEY);
  return { user: payload.user, returnTo };
}
