import { createClient } from '@supabase/supabase-js'
import type { Session, User } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

type SupabaseAuthLike = {
  getSession: () => Promise<{ data: { session: Session | null }; error: null }>
  getUser: () => Promise<{ data: { user: User | null }; error: null }>
  refreshSession: () => Promise<{ data: { session: Session | null }; error: null }>
  signOut: () => Promise<{ error: null }>
}

type SupabaseLike = {
  auth: SupabaseAuthLike
}

const createSupabaseFallback = (): SupabaseLike => ({
  auth: {
    getSession: async () => ({ data: { session: null }, error: null }),
    getUser: async () => ({ data: { user: null }, error: null }),
    refreshSession: async () => ({ data: { session: null }, error: null }),
    signOut: async () => ({ error: null }),
  },
})

const hasSupabaseConfig = Boolean(supabaseUrl && supabaseAnonKey)

if (!hasSupabaseConfig) {
  console.warn('Supabase environment variables are missing; auth will fall back to local session handling.')
}

export const supabase: SupabaseLike = hasSupabaseConfig
  ? (createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: window.localStorage,
      },
    }) as unknown as SupabaseLike)
  : createSupabaseFallback()

// Helper function to get the current session
export const getSession = async () => {
  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  return data.session
}

// Helper function to get the current user
export const getCurrentUser = async () => {
  const { data, error } = await supabase.auth.getUser()
  if (error) throw error
  return data.user
}

// Helper function to sign out
export const signOut = async () => {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}
