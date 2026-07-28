/**
 * Shown instead of the app when VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are
 * missing. Without it a fresh clone is just a blank page and a console error.
 */
export default function SetupNotice() {
  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-4 bg-slate-950 px-6 text-white light:bg-white light:text-slate-900">
      <h1 className="page-title text-white light:text-slate-900">almost there</h1>

      <p className="text-sm text-slate-400 light:text-slate-600">
        DailyMark needs a Supabase project before it can store anything. Three steps:
      </p>

      <ol className="space-y-3 text-sm text-slate-400 light:text-slate-600">
        <li>
          <span className="font-semibold text-slate-200 light:text-slate-900">1.</span>{" "}
          Create a free project at{" "}
          <a
            href="https://supabase.com/dashboard"
            target="_blank"
            rel="noreferrer"
            className="text-amber-400 underline"
          >
            supabase.com/dashboard
          </a>
          .
        </li>
        <li>
          <span className="font-semibold text-slate-200 light:text-slate-900">2.</span>{" "}
          In the SQL Editor, run{" "}
          <code className="rounded bg-slate-800/60 px-1.5 py-0.5 text-xs light:bg-slate-100">
            supabase/migrations/0001_init.sql
          </code>
          .
        </li>
        <li>
          <span className="font-semibold text-slate-200 light:text-slate-900">3.</span>{" "}
          Copy{" "}
          <code className="rounded bg-slate-800/60 px-1.5 py-0.5 text-xs light:bg-slate-100">
            .env.example
          </code>{" "}
          to{" "}
          <code className="rounded bg-slate-800/60 px-1.5 py-0.5 text-xs light:bg-slate-100">
            .env.local
          </code>
          , paste in your Project URL and anon key from Settings → API, then
          restart the dev server.
        </li>
      </ol>

      <p className="text-xs text-slate-600">
        Vite only reads env files at startup, so the restart matters.
      </p>
    </div>
  );
}
