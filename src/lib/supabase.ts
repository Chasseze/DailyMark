import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? "";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? "";

export const isSupabaseConfigured = () =>
  supabaseUrl.length > 0 && supabaseAnonKey.length > 0;

// createClient() throws on empty credentials, so the client is built lazily and
// App renders a setup screen when it can't be built. Without this, a missing
// .env.local is a blank white page with a stack trace in the console.
export const supabase = isSupabaseConfigured()
  ? createClient<Database>(supabaseUrl, supabaseAnonKey)
  : null;

/** Use inside code that only runs behind an authenticated route. */
export function requireSupabase() {
  if (!supabase) {
    throw new Error(
      "Supabase is not configured. Copy .env.example to .env.local and fill in " +
        "VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY."
    );
  }
  return supabase;
}

/** Postgres/PostgREST errors are objects, not Errors — normalise for the UI. */
export function errorMessage(err: unknown): string {
  if (err && typeof err === "object" && "message" in err) {
    return String((err as { message: unknown }).message);
  }
  return "Something went wrong. Please try again.";
}
