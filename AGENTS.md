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

### Styling conventions

- **Use the semantic tokens, not raw palette classes.** Colour lives in
  `src/index.css`: two themes define the whole scale once, and the three moods
  override only the atmosphere (paper, masthead, glow). In components reach for
  `text-ink` / `text-ink-soft` / `text-muted` / `text-faint`, `bg-surface`
  (`-2`, `-3`), `border-line` / `border-line-strong`, `bg-accent` /
  `text-accent-ink` / `bg-accent-soft` / `text-on-accent`, and
  `text-danger` / `bg-danger-soft`. A pair like
  `text-slate-400 light:text-slate-500` is the old way — it has to be written
  correctly at all ~200 call sites, and one miss is an invisible label in the
  light theme.
- **12px is the type floor** (`text-xs`); the scale is xs / sm / base / lg / xl.
- **The amber→orange gradient means "primary action"** and lives in one place,
  `.btn-primary`. One per screen. Everything else that needs the accent uses a
  solid `bg-accent` or a tinted `bg-accent-soft`.
- `backdrop-filter` is expensive per element. Blur the container, not each row.

### Static assets and caching

`vercel.json` pins `/assets/`, `/fonts/` and `/img/` to a one-year immutable
`Cache-Control`. Vite content-hashes everything under `/assets`, so those are
safe by construction. **`public/fonts/` and `public/img/` are not hashed — the
filename is the cache key.** Changing one of those files in place will leave
returning visitors on the old bytes for up to a year; rename the file (and its
references in `index.html` / `index.css` / `Login.tsx`) instead. `/sw.js` and
`index.html` are deliberately left revalidating, or a deploy could never reach
anyone who has already visited.

### Non-obvious gotchas

- **`supabase/seed.sql` is required for local dev.** Hosted Supabase auto-grants
  table privileges to the `anon`/`authenticated` API roles, so `0001_init.sql`
  does not. The local CLI stack does not replicate that for migration-created
  tables, so without the seed every PostgREST call fails with
  `permission denied for table ...`. The seed only exposes tables to the API
  roles; row-level security still enforces per-user isolation.
- **Auth:** email confirmation is enabled locally (`enable_confirmations = true`)
  so signup matches hosted behavior — Mailpit at `http://localhost:54324` catches
  the confirmation mail. New accounts get a profile row and three starter
  notebooks (Inbox, Ideas, Journal) via a DB trigger after they confirm and
  sign in. Confirmation emails (and any other auth mail) land in Mailpit.
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
