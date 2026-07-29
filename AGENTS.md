# AGENTS.md

## Cursor Cloud specific instructions

DailyMark is a single React 19 + Vite 8 SPA (TypeScript, Tailwind 4) backed by
Supabase (Postgres + Auth + PostgREST). There is no separate app server; the
"backend" is Supabase. Standard scripts live in `package.json` (`dev`, `build`,
`lint`, `preview`).

### Services

- **Frontend (Vite dev server)** — `npm run dev`, served on `http://localhost:5174`.
  The port is pinned with `strictPort` in `vite.config.ts`, so a clash fails loudly
  instead of drifting to another port.
- **Supabase (local stack via the Supabase CLI + Docker)** — the app's backend.
  API on `http://127.0.0.1:54321`, Postgres on `54322`, Studio on `54323`,
  Mailpit (email testing) on `54324`.

Docker and the Supabase CLI are already installed in this environment (they are
not part of the update script). You must start them each session — the update
script only refreshes npm dependencies.

### Starting the backend (do this before `npm run dev`)

1. Ensure the Docker daemon is running. If `docker ps` fails, start it:
   `sudo dockerd > /tmp/dockerd.log 2>&1 &` then `sudo chmod 666 /var/run/docker.sock`.
   Docker is configured with the `fuse-overlayfs` storage driver and
   `iptables-legacy` (required in this VM).
2. From the repo root run `supabase start`. On a fresh volume this applies
   `supabase/migrations/0001_init.sql` and then `supabase/seed.sql`.
3. Create `.env.local` (gitignored) so the frontend can reach the local stack.
   The local anon key is deterministic, so these exact values work every time:
   ```
   VITE_SUPABASE_URL=http://127.0.0.1:54321
   VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0
   ```
   Vite only reads env files at startup, so restart `npm run dev` after editing it.

### Non-obvious gotchas

- **`supabase/seed.sql` is required for local dev.** Hosted Supabase auto-grants
  table privileges to the `anon`/`authenticated` API roles, so `0001_init.sql`
  does not. The local CLI stack does not replicate that for migration-created
  tables, so without the seed every PostgREST call fails with
  `permission denied for table ...`. The seed only exposes tables to the API
  roles; row-level security still enforces per-user isolation.
- **Auth:** email confirmation is disabled locally (`enable_confirmations = false`),
  so signup logs the user in immediately. New accounts get a profile row and three
  starter notebooks (Inbox, Ideas, Journal) via a DB trigger. Confirmation emails
  (if enabled) land in Mailpit at `http://localhost:54324`.
- **Resetting the DB:** `supabase db reset` can fail in this CLI version with a
  "Could not find the supabase-go binary" error. To get a clean DB instead run
  `supabase stop --no-backup` then `supabase start` (this re-applies migrations and
  the seed).
- **`package-lock.json` must include the Linux `rolldown` binding.** Vite 8 uses
  rolldown, whose native binding is platform-specific. If `npm run build` fails
  with `Cannot find native binding`, the lockfile is missing
  `@rolldown/binding-linux-x64-gnu`; regenerate it with
  `rm -f package-lock.json && npm install`.
- Google OAuth ("Continue with Google") is optional and not configured locally;
  email/password is the supported local auth path.
