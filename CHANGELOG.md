# Changelog

## Unreleased

### Desk

- **Desk** — a new landing page at `/desk`: a capture bar, tonight's Return count, the daily quiz, Thought of the week and the notes you last touched. Every card is a doorway to the page that owns the thing, so the desk stays thin. It reads the one pinned thought directly rather than mounting the thoughts catalog, which would put it back on the sign-in path
- **Capture bar** — type a line and it becomes a titled note, or dictate one. Replaces the pair of small buttons in the notes header, and is the same component on both surfaces. Dictation moved to a `useDictation` hook so there is one recogniser, not two
- **Ember mood** — a fourth mood beside Cobalt / Midnight / Harbor, and the only one that changes more than colour: cream paper, a full-height charcoal rail with a curved edge in place of the blue masthead, Outfit for headings, muted gold for the accent, and the script sign-off in the rail. Expressed entirely in the mood's own CSS block, so the three blues are untouched. Outfit and Sacramento are self-hosted like the existing faces

### Linked desk

Requires `supabase/migrations/0014_linked_desk.sql` and
`supabase/migrations/0015_desk_function_grants.sql`.

- **Backlinks** — a note now shows what links *to* it. Wiki links resolve by title, so renaming a note used to break every link into it silently; the unresolved ones are now named under “Links to nothing”
- **Return spacing ladder** — deferring walks 3 days → 1 week → 3 weeks → 2 months rather than always meaning a week, so a note you keep pushing away comes back less often. Keep resets it
- **Quiz from your notes** — `**bold**` and `==highlight==` spans become fill-in-the-blank questions, with the wrong answers drawn from your own other notes. No model involved, so a note always yields the same question
- **Function grants** — `0014` revoked the two new functions from `PUBLIC`, which on hosted Supabase does not undo the default `EXECUTE` grant to the `anon` role. No data was reachable (both filter on `auth.uid()`), but anon could call them; `0015` revokes by role name, as `0010` already did

### Review pass

No behaviour changes intended, `npm run lint` back to zero.

- **Service worker** — an offline navigation with no cached shell returned nothing at all (`caches.match()` is a promise, so `a || b` always took the first branch); failed responses are no longer cached as the shell
- **Prefs** — `usePrefs` moved to `prefs-context.ts` per the repo's Fast Refresh convention; the provider no longer writes a ref during render
- **Speech** — the local copy of the speech prefs is gone; the account row is the single source of truth
- **Scan sheet** — mounted only while open, so closing it drops the camera stream instead of resetting state by hand
- **Dead code** — `loadProgress` / `loadReturnSession` were stubs that always returned nothing
- **Local dev** — the seed's blanket function grant no longer undoes `0010`'s revoke of `promote_daily_drops`

## 2.0.0

Account-synced daily desk.

- **Account prefs** — theme, notes mood, focus, speech, and reminder settings live on `profiles.prefs` (no app localStorage)
- **Offline notes** — IndexedDB snapshot + outbox; edits queue while offline and flush when back online
- **Return / Rhythm ritual** — frozen reasons, Return evening history on Rhythm, richer weekly review draft; streak uses local calendar day
- **Living library** — Library shelf (full catalog search), personal collections, Thought share parity, “why this was chosen” on live drops
