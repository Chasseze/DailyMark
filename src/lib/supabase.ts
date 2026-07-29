import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL ?? "").trim();
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? "").trim();

// Reject empty strings and the .env.example placeholders so a half-filled
// Vercel project (or a copy-paste of the template) still shows SetupNotice
// instead of calling a fake host.
function looksConfigured(url: string, key: string): boolean {
  if (!url || !key) return false;
  if (url.includes("your-project-ref") || key === "your-anon-key") return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

export const isSupabaseConfigured = () =>
  looksConfigured(supabaseUrl, supabaseAnonKey);

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
