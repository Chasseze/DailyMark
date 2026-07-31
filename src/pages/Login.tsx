import { useState, type FormEvent } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/auth-context";
import { errorMessage } from "../lib/supabase";
import journalHero from "../assets/login-journal.jpg";

type Mode = "signin" | "signup";

export default function Login() {
  const { session, loading, signIn, signUp, signInWithGoogle, resendConfirmation } =
    useAuth();
  const location = useLocation();

  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  /** Email waiting on the confirmation link — enables Resend. */
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);

  // After the user clicks the confirm link, Supabase redirects here with
  // tokens / type in the hash or query. Derive the banner from the URL so we
  // don't need a cascading setState effect on mount.
  const params = new URLSearchParams(location.search);
  const hash = new URLSearchParams(location.hash.replace(/^#/, ""));
  const urlError =
    params.get("error_description") || hash.get("error_description");
  const confirmType = params.get("type") || hash.get("type");
  const urlBannerError = urlError
    ? decodeURIComponent(urlError.replace(/\+/g, " "))
    : null;
  const urlBannerNotice =
    !urlBannerError && (confirmType === "signup" || confirmType === "email")
      ? "Email confirmed. You can sign in now."
      : null;
  const displayError = error ?? urlBannerError;
  const displayNotice = notice ?? urlBannerNotice;
  const effectiveMode =
    urlBannerNotice && !error && !notice ? ("signin" as Mode) : mode;

  if (loading) {
    return (
      <div className="login-hero" aria-busy="true">
        <img
          src={journalHero}
          alt=""
          className="login-hero__media"
          decoding="async"
        />
        <div className="login-hero__scrim" />
      </div>
    );
  }

  if (session) {
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
        const result = await signUp(email, password);
        if (result.status === "confirm_email") {
          setPendingEmail(email);
          setNotice(
            "Account created. We sent a confirmation link to " +
              email +
              ". Open it to activate your account, then sign in."
          );
          setMode("signin");
          setPassword("");
        } else if (result.status === "already_registered") {
          setPendingEmail(email);
          setError(
            "That email is already registered. Sign in, or resend the confirmation link if you never verified it."
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

  const handleResend = async () => {
    const target = pendingEmail || email;
    if (!target) {
      setError("Enter the email you signed up with, then tap Resend.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await resendConfirmation(target);
      setPendingEmail(target);
      setNotice("Confirmation email resent to " + target + ". Check your inbox (and spam).");
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
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <section className="login-hero">
      <img
        src={journalHero}
        alt=""
        className="login-hero__media"
        width={1600}
        height={1067}
        decoding="async"
        fetchPriority="high"
      />
      <div className="login-hero__scrim" aria-hidden="true" />

      <div className="login-hero__content">
        <div className="login-hero__copy animate-in">
          <h1 className="login-brand">DailyMark</h1>
          <p className="login-lede">
            {effectiveMode === "signin"
              ? "A quiet desk for the notes you keep coming back to."
              : "Start a notebook of your own — we'll email a confirmation link."}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="login-form animate-in-delay">
          <div>
            <label htmlFor="email" className="login-label">
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
              className="login-input"
            />
          </div>

          <div>
            <label htmlFor="password" className="login-label">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={6}
              autoComplete={effectiveMode === "signup" ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="login-input"
            />
          </div>

          {displayError && <p className="login-alert login-alert--error">{displayError}</p>}
          {displayNotice && <p className="login-alert login-alert--ok">{displayNotice}</p>}

          <button type="submit" disabled={busy} className="login-submit">
            {busy ? "Working…" : effectiveMode === "signin" ? "Sign in" : "Create account"}
          </button>

          {pendingEmail && (
            <button
              type="button"
              onClick={handleResend}
              disabled={busy}
              className="login-resend"
            >
              Resend confirmation email
            </button>
          )}

          {import.meta.env.VITE_ENABLE_GOOGLE_OAUTH === "true" && (
            <>
              <div className="login-rule" aria-hidden="true">
                <span>or</span>
              </div>

              <button
                type="button"
                onClick={handleGoogle}
                disabled={busy}
                className="login-google"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                  <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.8z" />
                  <path fill="#34A853" d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.9-3c-1.1.7-2.4 1.2-4 1.2-3.1 0-5.7-2.1-6.6-4.9H1.4v3.1A12 12 0 0 0 12 24z" />
                  <path fill="#FBBC05" d="M5.4 14.4a7.2 7.2 0 0 1 0-4.6V6.7H1.4a12 12 0 0 0 0 10.8l4-3.1z" />
                  <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.4 6.7l4 3.1C6.3 6.9 8.9 4.8 12 4.8z" />
                </svg>
                Continue with Google
              </button>
            </>
          )}

          <p className="login-switch">
            {effectiveMode === "signin" ? "No account yet?" : "Already have an account?"}{" "}
            <button
              type="button"
              onClick={() => {
                setMode(effectiveMode === "signin" ? "signup" : "signin");
                setError(null);
                setNotice(null);
              }}
            >
              {effectiveMode === "signin" ? "Create one" : "Sign in"}
            </button>
          </p>
        </form>
      </div>
    </section>
  );
}
