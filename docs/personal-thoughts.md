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

## Verification

- `npm run lint`, `npm test`, `npm run build`, `npm audit --audit-level=moderate`
- `tests/security.sql` and `tests/thought-sources.sql` against an isolated local DB
- `npm run test:browser`: source preservation after catalog changes, concurrent
  creation, editor labels, Markdown credit, anonymous shared reading, unsave,
  and desktop/mobile layout; existing save-failure/conflict tests still run.
- `supabase db lint --local` and `supabase db advisors --local --type security`

The local advisor also reports existing mutable-search-path warnings in
`notes_set_preview`, `notes_set_search_vector`, `thoughts_set_preview` and
`visuals_set_preview`; those functions are outside this feature’s migration.
