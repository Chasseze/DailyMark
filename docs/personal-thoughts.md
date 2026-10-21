# Personal thought versions

Saving a curated thought now captures its DailyMark body and source attribution
in `thought_sources`. The capture is private to the account and stays fixed even
if the catalog changes or the bookmark is removed. Existing bookmarks are
captured at migration time, with the actual capture date; older unsourced
reflection notes are not automatically relabeled.

“Create my version” creates one personal note from that source. Retries and
concurrent requests return the same note. The existing Notes editor supplies
autosave, conflict detection, draft recovery and version history. Thoughts offers
Saved source / My version controls and links back to the editor. A trashed
version must be restored before editing; permanently deleting it allows a new
copy to be created from the preserved source.

Attribution is stored separately from the editable Markdown. A title or body
change displays “Personal adaptation”; an exact reversion displays “Personal
copy · Unedited”. Tags, notebook changes and pinning do not count as adapting
the text. The source panel distinguishes DailyMark’s curated reflection from
the linked original publication, and offers the unchanged saved body for
comparison. Shared notes/notebooks and Markdown exports carry the same credit.

Backup format 2 adds `thoughtSources` alongside notes and notebooks. Restores
create new notes with their own source records, marked as restored from a backup;
they never replace the canonical catalog capture. Format 1 backups still work.
Importing a Markdown export keeps its visible source footer as text; restoring
the JSON backup preserves structured attribution and the source panel.

## Release order

Apply `20261021021940_thought_personal_versions.sql` to the target Supabase
database before deploying the frontend. Opening a note now also reads its source
record; a failed source read is surfaced rather than silently dropping credit.
The migration backfills existing bookmarks but does not modify curated content
or existing personal notes.

The source table permits account-scoped SELECT only. Source capture is a private
bookmark trigger. `create_thought_version` is a narrowly scoped privileged RPC:
it takes only a thought ID, derives the owner from `auth.uid()`, locks the source,
and never accepts client-supplied attribution or a target note. Backup restore
similarly derives ownership, remaps every note/notebook ID, and runs atomically.
The public sharing RPC returns only provenance attached to its authorized share
target, without source account identifiers. All new functions pin `search_path`.

### Reliability follow-up

Apply `20261021041009_thought_reliability.sql` before deploying this follow-up.
Backup export now uses one database snapshot, so creating a personal version
cannot produce a backup with disconnected notes and source records. There is no
client-side fallback to the old multi-request export.

Saved bookmarks survive removal of the shared catalog entry. The capture trigger
still rejects unknown IDs unless the account already owns a preserved source.
Restored sources can also be personalized without changing their attribution.

Failed Thoughts refreshes retain confirmed data, display an actionable Retry
message on desktop and mobile, and never present a failed fetch as an empty
saved shelf. Personal actions wait until account data has loaded successfully.
Comparison panels highlight added/removed text, and the editor links back to the
saved thought while retaining its unsaved-writing protection.

The follow-up also pins the search path of the four existing preview/search
trigger functions; their bodies use only built-in PostgreSQL functions.

## Verification

- `npm run lint`, `npm test`, `npm run build`, `npm audit --audit-level=moderate`
- `tests/security.sql` and `tests/thought-sources.sql` against an isolated local DB
- `npm run test:browser`: source preservation after catalog changes, concurrent
  creation, editor labels, Markdown credit, anonymous shared reading, unsave,
  and desktop/mobile layout; existing save-failure/conflict tests still run.
- `supabase db lint --local` and `supabase db advisors --local --type security`

The follow-up regression tests cover failed-load recovery, catalog removal,
concurrent export/version creation, and unsaved-writing protection.
