import { useState } from "react";
import { requireSupabase, errorMessage } from "../lib/supabase";
import { useNotes } from "../context/notes-context";
import type { NoteRow } from "../lib/database.types";
export default function NoteHistory({
  noteId,
  onRestore,
}: {
  noteId: string;
  onRestore: () => void;
}) {
  const { patchNote } = useNotes();
  const [rows, setRows] = useState<
    { id: string; snapshot: NoteRow; created_at: string }[]
  >([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const load = async () => {
    setOpen(true);
    setBusy(true);
    try {
      const { data, error } = await requireSupabase()
        .from("note_versions")
        .select("*")
        .eq("note_id", noteId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      setRows(data ?? []);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="feature-panel my-4 rounded-xl border border-line p-3">
      <button
        type="button"
        onClick={() => (open ? setOpen(false) : void load())}
        aria-expanded={open}
      >
        Version history
      </button>
      {open && (
        <div className="mt-3 space-y-3">
          <p className="text-xs text-muted">
            Up to 50 previous edits. Restore keeps the current version in
            history.
          </p>
          {busy && <p role="status">Loading…</p>}
          {error && <p role="alert">{error}</p>}
          {!busy && !rows.length && <p>No previous versions yet.</p>}
          {rows.map((row) => (
            <details key={row.id}>
              <summary>
                {new Date(row.created_at).toLocaleString()} ·{" "}
                {row.snapshot.title || "Untitled"}
              </summary>
              <pre className="max-h-48 overflow-auto whitespace-pre-wrap text-sm">
                {row.snapshot.content}
              </pre>
              <button
                type="button"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await patchNote(noteId, {
                      title: row.snapshot.title,
                      content: row.snapshot.content,
                      tags: row.snapshot.tags,
                    });
                    onRestore();
                  } catch (e) {
                    setError(errorMessage(e));
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Restore this version
              </button>
            </details>
          ))}
        </div>
      )}
    </section>
  );
}
