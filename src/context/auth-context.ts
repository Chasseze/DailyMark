import { createContext, useContext } from "react";
import type { Session, User } from "@supabase/supabase-js";

export type SignUpResult =
  | { status: "confirm_email" }
  | { status: "signed_in" }
  | { status: "already_registered" };

export interface AuthContextType {
  session: Session | null;
  user: User | null;
  /** True until the initial session lookup finishes. */
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  /**
   * Creates an account. With Confirm email enabled on the Supabase project,
   * this returns `confirm_email` and Supabase sends the verification link.
   */
  signUp: (email: string, password: string) => Promise<SignUpResult>;
  /** Resend the signup confirmation email (rate-limited by Supabase). */
  resendConfirmation: (email: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
