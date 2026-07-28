import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { requireSupabase, supabase } from "../lib/supabase";
import { AuthContext } from "./auth-context";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  // Nothing to look up when there's no client, so don't start in a loading
  // state we'd immediately have to clear from inside the effect.
  const [loading, setLoading] = useState(supabase !== null);

  useEffect(() => {
    if (!supabase) return;

    // getSession() reads the persisted session (including the tokens Supabase
    // parses out of the URL after an OAuth redirect), so a reload keeps you
    // logged in instead of bouncing to /login.
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setLoading(false);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await requireSupabase().auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    const { data, error } = await requireSupabase().auth.signUp({
      email,
      password,
    });
    if (error) throw error;
    // With email confirmation on, signUp returns a user but no session — the
    // caller needs to know to show "check your inbox" rather than navigating.
    return data.session === null;
  }, []);

  const signInWithGoogle = useCallback(async () => {
    const { error } = await requireSupabase().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    const { error } = await requireSupabase().auth.signOut();
    if (error) throw error;
  }, []);

  const value = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      loading,
      signIn,
      signUp,
      signInWithGoogle,
      signOut,
    }),
    [session, loading, signIn, signUp, signInWithGoogle, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
