# Changelog

## Unreleased

Review pass — no behaviour changes intended, `npm run lint` back to zero.

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
