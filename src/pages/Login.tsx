import { useState, type FormEvent } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/auth-context";
import { errorMessage } from "../lib/supabase";

type Mode = "signin" | "signup";

export default function Login() {
  const { session, loading, signIn, signUp, signInWithGoogle } = useAuth();
  const location = useLocation();

  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  if (loading) return null;

  if (session) {
    // Send people back where they were headed before the guard intercepted.
    const from = (location.state as { from?: string } | null)?.from ?? "/notes";
    return <Navigate to={from} replace />;
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      if (mode === "signup") {
        const needsConfirmation = await signUp(email, password);
        if (needsConfirmation) {
          setNotice(
            "Account created. Check " + email + " for a confirmation link, " +
              "then sign in."
          );
          setMode("signin");
        }
      } else {
        await signIn(email, password);
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const handleGoogle = async () => {
    setError(null);
    setBusy(true);
    try {
      await signInWithGoogle();
      // On success the browser navigates away to Google, so nothing follows.
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center bg-slate-950 px-6 text-white light:bg-white light:text-slate-900">
      <div className="animate-in">
        <h1 className="page-title text-white light:text-slate-900">dailymark</h1>
        <p className="mb-8 text-sm text-slate-400 light:text-slate-500">
          {mode === "signin"
            ? "Sign in to reach your notes."
            : "Create an account to get started."}
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label htmlFor="email" className="mb-1 block text-xs text-slate-500">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-xl border border-white/5 bg-slate-900/50 px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-amber-500/30 focus:outline-none light:border-slate-200 light:bg-slate-50 light:text-slate-900"
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-1 block text-xs text-slate-500">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={6}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-xl border border-white/5 bg-slate-900/50 px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-amber-500/30 focus:outline-none light:border-slate-200 light:bg-slate-50 light:text-slate-900"
            />
          </div>

          {error && (
            <p className="rounded-xl bg-red-500/10 p-3 text-xs text-red-400">{error}</p>
          )}
          {notice && (
            <p className="rounded-xl bg-green-500/10 p-3 text-xs text-green-400">
              {notice}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 px-4 py-3 text-sm font-semibold text-black transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
          >
            {busy ? "Working…" : mode === "signin" ? "Sign in" : "Create account"}
          </button>
        </form>

        <div className="my-5 flex items-center gap-3">
          <div className="h-px flex-1 bg-white/10 light:bg-slate-200" />
          <span className="text-[10px] uppercase tracking-wider text-slate-600">or</span>
          <div className="h-px flex-1 bg-white/10 light:bg-slate-200" />
        </div>

        <button
          type="button"
          onClick={handleGoogle}
          disabled={busy}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-slate-900/50 px-4 py-3 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-800/60 disabled:opacity-50 light:border-slate-200 light:bg-white light:text-slate-700 light:hover:bg-slate-50"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
            <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.8z" />
            <path fill="#34A853" d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.9-3c-1.1.7-2.4 1.2-4 1.2-3.1 0-5.7-2.1-6.6-4.9H1.4v3.1A12 12 0 0 0 12 24z" />
            <path fill="#FBBC05" d="M5.4 14.4a7.2 7.2 0 0 1 0-4.6V6.7H1.4a12 12 0 0 0 0 10.8l4-3.1z" />
            <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.4 6.7l4 3.1C6.3 6.9 8.9 4.8 12 4.8z" />
          </svg>
          Continue with Google
        </button>

        <p className="mt-6 text-center text-xs text-slate-500">
          {mode === "signin" ? "No account yet?" : "Already have an account?"}{" "}
          <button
            type="button"
            onClick={() => {
              setMode(mode === "signin" ? "signup" : "signin");
              setError(null);
              setNotice(null);
            }}
            className="font-medium text-amber-400 hover:text-amber-300"
          >
            {mode === "signin" ? "Create one" : "Sign in"}
          </button>
        </p>
      </div>
    </div>
  );
}
