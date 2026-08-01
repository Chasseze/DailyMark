import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { requireSupabase, supabase } from "../lib/supabase";
import { AuthContext, type SignUpResult } from "./auth-context";

/** Where email-confirm / OAuth / recovery flows should land after Supabase verifies. */
function authRedirectTo() {
  return `${window.location.origin}/login`;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  // Nothing to look up when there's no client, so don't start in a loading
  // state we'd immediately have to clear from inside the effect.
  const [loading, setLoading] = useState(supabase !== null);
  const [passwordRecovery, setPasswordRecovery] = useState(false);

  useEffect(() => {
    if (!supabase) return;

    // getSession() reads the persisted session (including the tokens Supabase
    // parses out of the URL after an OAuth / email-confirm redirect), so a
    // reload keeps you logged in instead of bouncing to /login.
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next);
      setLoading(false);
      if (event === "PASSWORD_RECOVERY") {
        setPasswordRecovery(true);
      }
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

  const signUp = useCallback(async (email: string, password: string): Promise<SignUpResult> => {
    const { data, error } = await requireSupabase().auth.signUp({
      email,
      password,
      options: {
        // Must be allowlisted under Authentication → URL Configuration.
        // Without this, the confirm link falls back to Site URL and often
        // lands somewhere the SPA never handles.
        emailRedirectTo: authRedirectTo(),
      },
    });
    if (error) throw error;

    // Supabase returns a user with an empty identities array when the email
    // is already registered — and it does NOT resend the confirmation mail.
    // Treat that as "already registered" so the UI can guide the user.
    const identities = data.user?.identities ?? [];
    if (data.user && identities.length === 0) {
      return { status: "already_registered" };
    }

    if (data.session) {
      // Confirm email is off on the project — signup signed them in directly.
      return { status: "signed_in" };
    }

    // Confirm email is on: Supabase queued the verification email and there
    // is no session until they click the link.
    return { status: "confirm_email" };
  }, []);

  const resendConfirmation = useCallback(async (email: string) => {
    const { error } = await requireSupabase().auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: authRedirectTo() },
    });
    if (error) throw error;
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    const { error } = await requireSupabase().auth.resetPasswordForEmail(email, {
      redirectTo: authRedirectTo(),
    });
    if (error) throw error;
  }, []);

  const updatePassword = useCallback(async (password: string) => {
    const { error } = await requireSupabase().auth.updateUser({ password });
    if (error) throw error;
    setPasswordRecovery(false);
  }, []);

  const clearPasswordRecovery = useCallback(() => {
    setPasswordRecovery(false);
  }, []);

  const signInWithGoogle = useCallback(async () => {
    // Land on /login so the session can settle on a public route.
    const { error } = await requireSupabase().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: authRedirectTo() },
    });
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    const { error } = await requireSupabase().auth.signOut();
    if (error) throw error;
    setPasswordRecovery(false);
  }, []);

  const value = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      loading,
      passwordRecovery,
      signIn,
      signUp,
      resendConfirmation,
      resetPassword,
      updatePassword,
      clearPasswordRecovery,
      signInWithGoogle,
      signOut,
    }),
    [
      session,
      loading,
      passwordRecovery,
      signIn,
      signUp,
      resendConfirmation,
      resetPassword,
      updatePassword,
      clearPasswordRecovery,
      signInWithGoogle,
      signOut,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
