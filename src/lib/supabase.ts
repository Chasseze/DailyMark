import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? "";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? "";

export const isSupabaseConfigured = () =>
  supabaseUrl.length > 0 && supabaseAnonKey.length > 0;

let client: SupabaseClient | null = null;

// Created lazily: createClient() throws when the env vars are missing, and the
// app is meant to run offline-first on localStorage without any Supabase setup.
export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  if (!client) client = createClient(supabaseUrl, supabaseAnonKey);
  return client;
}
