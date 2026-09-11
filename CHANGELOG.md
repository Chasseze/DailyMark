# Changelog

## Unreleased

### Notes

- **The capture bar and the search box are one height** — they already measured the same 39px, but the capture bar wore a 16px corner radius against the search box's 12px, and a rounder bar of the same height reads as the fatter one. Same radius now, both on a single `--field-h` token (42px, a hair more than the 39px they were) so a later padding change to either cannot separate them again. The mic and New note buttons come back up to 36px from 33px
- **The search palette's scrollbar is visible** — the results list is the only place in the app where the 4px app-wide bar is load-bearing: it is the sole cue that the dropdown holds more than it shows. It is 12px there. Deliberately no `scrollbar-width` / `scrollbar-color` alongside it — in Chrome the standard properties take precedence over `::-webkit-scrollbar` and would quietly undo the wider bar

- **The capture bar is as slim as the search box** — "Jot something down", the mic and New note sat in a 55px bar above a 39px search field, so the two rows that do the same job looked like different components. Padding only: the bar is 39px now, exactly the search box, and the buttons stretch to fill it rather than carrying their own padding
- **Mobile search finds notes, like the desktop does** — the palette listed all seven nav destinations before the first note, which put the Notes group below the panel's own scroll fold (y=628 in a panel ending at y=616). On a phone the keyboard takes about half the screen, so what was left looked like a list of tabs with no notes in it. Notes now come straight after Actions and above Go to, and the panel sizes itself to the *visual* viewport — the keyboard shrinks that but not the layout viewport, which is why the old panel kept its full height and hid behind it. The drop from the top goes 4.5rem → 1rem under 40rem

- **The notes list gives its space back to the notes** — the header, search row and list shared a loose 16px gutter and a 24px top pad, each block sat on its own row with 12–20px between, and every card carried a checkbox and the word "Select" on a line above it. The gutter is one variable now (13.6px on a small phone, 12px in the desktop list pane), the blocks sit closer, the cards are tighter and closer together, and bulk-select moved into the card's top-right corner. Roughly a card and a half more of the list is in view on a phone, with nothing removed
- **Templates are a styled menu beside the search box** — "Choose from the template" was a bare `<select>` and a text label on their own row: the only piece of browser chrome in the list, and a whole line spent on a control that showed five names and nothing about them. It is now a "Templates" pull-down sharing the search row, and each entry says what you get — the pinned dot moved to the front of a card's title so the corner it vacated could take the checkbox
- **Search and commands is opaque** — the palette panel was `bg-surface`, a 6% white wash, over a plain 50% backdrop, so on a desktop you read your own wallpaper through the results. The panel is opaque, the overlay dims and blurs what is behind it (dropping the blur under `prefers-reduced-transparency`), and results are grouped into Actions / Go to / Notes with an empty state. The masthead trigger is a search pill rather than a run of white text

### Rhythm

- **Return evenings fold to the week** — the panel printed one row per evening for the whole 84-day window, so it grew a line a day and said no more at 60 rows than at 6. It now shows this week's evenings with the week's marks and how many closed at three, and counts everything older on one line
- **Clear evenings before this week** — a button on that line drops the older log from the account once the week has been reviewed, behind a confirm. Only the log goes: the Keep and defer marks were written onto the notes when they were made, so the notes and their revisit dates are untouched
- **Rhythm stops over-reading Return** — it pulled all 84 days of evenings to render fourteen rows and to date-filter the weekly review down to seven; the rest was fetched and never read. It now reads this week's rows and counts the older ones with a `head` query, so the number on the Clear button is the real total on the account rather than however many happened to be in the window

### Daily

- **Return survives two open devices** — the evening card replaced its state with the account's row on load, so `mergeReturnSessions` — written and tested for exactly this — was never reached. The row is now folded in rather than swapped in, and re-read when the tab comes back to the foreground, so a mark made on the phone shows on the laptop instead of the two tabs writing over each other. The refetch stands down while a mark is in flight

### Sync and the Return card

- **Quiz progress writes are serialised** — every answer fired an independent upsert, so two in quick succession landed last-*response*-wins rather than last-*state*-wins: a finished round could come back as the state from two questions ago. One request is in flight at a time now, a save arriving mid-flight replaces the queued one, and a failed write is retried on a backoff instead of being swallowed
- **A failed save is visible** — the quiz card says “Saving…” or “Not saved — will retry” instead of losing the round in silence
- **The last answer survives closing the tab** — a normal request dies with the document; the final state goes out with `keepalive`
- **Return card** — the note preview rendered raw Markdown, so a note beginning `# Heading` showed the hashes. It runs through `markdownExcerpt` now, and the jot field's placeholder no longer implies it is a required step before Keep
- **This device** — Settings can clear the offline copy of your notes, the only app data DailyMark keeps in the browser. It warns first when edits are still queued

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
