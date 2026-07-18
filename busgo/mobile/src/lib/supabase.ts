import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// Release builds must carry the Supabase configuration (from eas.json / EAS
// environment variables); without it Google login is silently impossible.
if (!__DEV__ && (!supabaseUrl || !supabaseAnonKey)) {
  throw new Error('EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY are not configured for this build.');
}

export const supabase: SupabaseClient | null =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          storage: AsyncStorage,
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false,
        },
      })
    : null;

export function requireSupabase(): SupabaseClient {
  if (!supabase) {
    throw new Error("Google authentication is not configured in the mobile environment.");
  }
  return supabase;
}
