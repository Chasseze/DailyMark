/**
 * Shown instead of the app when VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are
 * missing. Without it a fresh clone (or a Vercel deploy with no env vars) is
 * just a blank page and a console error.
 *
 * Vite inlines VITE_* values at build time, so production needs the vars set
 * in the Vercel project and a redeploy — a .env.local file on your laptop
 * never reaches the hosted build.
 */
export default function SetupNotice() {
  const isProd = import.meta.env.PROD;

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-4 bg-slate-950 px-6 text-white light:bg-white light:text-slate-900">
      <h1 className="page-title text-white light:text-slate-900">almost there</h1>

      <p className="text-sm text-slate-400 light:text-slate-600">
        DailyMark needs a Supabase project before it can store anything.
        {isProd
          ? " This deploy is live, but the Supabase env vars were not available at build time."
          : " Three local steps:"}
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
        {isProd ? (
          <>
            <li>
              <span className="font-semibold text-slate-200 light:text-slate-900">
                3.
              </span>{" "}
              In the{" "}
              <a
                href="https://vercel.com/dashboard"
                target="_blank"
                rel="noreferrer"
                className="text-amber-400 underline"
              >
                Vercel project
              </a>
              , open Settings → Environment Variables and add both for{" "}
              <em>Production</em> (and Preview if you use it):
              <ul className="mt-2 list-disc space-y-1 pl-5 text-xs">
                <li>
                  <code className="rounded bg-slate-800/60 px-1.5 py-0.5 light:bg-slate-100">
                    VITE_SUPABASE_URL
                  </code>
                </li>
                <li>
                  <code className="rounded bg-slate-800/60 px-1.5 py-0.5 light:bg-slate-100">
                    VITE_SUPABASE_ANON_KEY
                  </code>
                </li>
              </ul>
              Copy the values from Supabase → Project Settings → API. Use the
              anon/public key, never the service_role key.
            </li>
            <li>
              <span className="font-semibold text-slate-200 light:text-slate-900">
                4.
              </span>{" "}
              Redeploy (Deployments → … → Redeploy). Vite bakes{" "}
              <code className="rounded bg-slate-800/60 px-1.5 py-0.5 text-xs light:bg-slate-100">
                VITE_*
              </code>{" "}
              into the bundle at build time, so saving the vars alone is not
              enough.
            </li>
            <li>
              <span className="font-semibold text-slate-200 light:text-slate-900">
                5.
              </span>{" "}
              In Supabase → Authentication → URL Configuration, set the Site
              URL to this deploy and add it under Redirect URLs (needed for
              email confirmations and Google sign-in).
            </li>
          </>
        ) : (
          <li>
            <span className="font-semibold text-slate-200 light:text-slate-900">
              3.
            </span>{" "}
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
        )}
      </ol>

      <p className="text-xs text-slate-600">
        {isProd
          ? "After the redeploy finishes, refresh this page — you should land on the login screen."
          : "Vite only reads env files at startup, so the restart matters."}
      </p>
    </div>
  );
}
