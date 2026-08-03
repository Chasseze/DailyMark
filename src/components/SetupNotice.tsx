/**
 * Shown instead of the app when VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are
 * missing. Without it a fresh clone is just a blank page and a console error.
 */
export default function SetupNotice() {
  return (
    <div className="app-shell mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-4 px-6 text-ink">
      <h1 className="page-title text-ink">Almost there</h1>

      <p className="text-sm text-muted">
        DailyMark needs a Supabase project before it can store anything. Three steps:
      </p>

      <ol className="space-y-3 text-sm text-muted">
        <li>
          <span className="font-semibold text-ink-soft">1.</span>{" "}
          Create a free project at{" "}
          <a
            href="https://supabase.com/dashboard"
            target="_blank"
            rel="noreferrer"
            className="text-accent-ink underline"
          >
            supabase.com/dashboard
          </a>
          .
        </li>
        <li>
          <span className="font-semibold text-ink-soft">2.</span>{" "}
          In the SQL Editor, run{" "}
          <code className="rounded bg-surface-2 px-1.5 py-0.5 text-xs">
            supabase/migrations/0001_init.sql
          </code>
          .
        </li>
        <li>
          <span className="font-semibold text-ink-soft">3.</span>{" "}
          Copy{" "}
          <code className="rounded bg-surface-2 px-1.5 py-0.5 text-xs">
            .env.example
          </code>{" "}
          to{" "}
          <code className="rounded bg-surface-2 px-1.5 py-0.5 text-xs">
            .env.local
          </code>
          , paste in your Project URL and anon key from Settings → API, then
          restart the dev server.
        </li>
      </ol>

      <p className="text-xs text-muted">
        Vite only reads env files at startup, so the restart matters.
      </p>
    </div>
  );
}
