import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useFocus } from "../context/focus-context";
import { useNotes } from "../context/notes-context";
import { errorMessage } from "../lib/supabase";
import type { Note, NoteUpdate } from "../lib/types";
import MarkdownEditor from "../components/MarkdownEditor";

export default function NoteEdit() {
  const { id } = useParams<{ id: string }>();
  const { notes, trash, loading, ensureNote } = useNotes();
  const note = notes.find((n) => n.id === id) ?? trash.find((n) => n.id === id);
  const [hydrateError, setHydrateError] = useState<string | null>(null);
  const awaitingBody =
    Boolean(id) && !loading && !hydrateError && (!note || !note.bodyLoaded);

  useEffect(() => {
    if (!id || loading) return;
    if (note?.bodyLoaded) return;
    let active = true;
    void ensureNote(id)
      .then((row) => {
        if (!active) return;
        if (!row) setHydrateError("Note not found");
      })
      .catch((err) => {
        if (active) setHydrateError(errorMessage(err));
      });
    return () => {
      active = false;
    };
  }, [id, loading, note?.bodyLoaded, ensureNote]);

  if (loading || awaitingBody) {
    return (
      <div className="flex h-full min-h-[16rem] items-center justify-center">
        <p className="text-sm text-muted">Loading…</p>
      </div>
    );
  }

  if (!note || hydrateError) {
    return (
      <div className="flex h-full min-h-[16rem] items-center justify-center">
        <p className="text-muted">{hydrateError ?? "Note not found"}</p>
      </div>
    );
  }

  if (note.deleted_at) {
    return <TrashedNoteNotice id={note.id} />;
  }

  return <NoteEditor key={note.id} note={note} />;
}

function TrashedNoteNotice({ id }: { id: string }) {
  const navigate = useNavigate();
  return (
    <div className="flex h-full min-h-[16rem] flex-col items-center justify-center px-4">
      <p className="text-muted">This note is in Trash. Restore it before editing.</p>
      <button
        type="button"
        onClick={() => navigate("/notes/" + id)}
        className="mt-4 text-sm text-accent-ink"
      >
        ← Back
      </button>
    </div>
  );
}

function sameTags(a: string[], b: string[]) {
  if (a.length !== b.length) return false;
  const left = [...a].sort();
  const right = [...b].sort();
  return left.every((tag, i) => tag === right[i]);
}

function toDateInput(iso: string | null): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

function fromDateInput(value: string): string | null {
  if (!value) return null;
  return new Date(value + "T12:00:00").toISOString();
}

function NoteEditor({ note }: { note: Note }) {
  const navigate = useNavigate();
  const { notebooks, notes, patchNote } = useNotes();
  const { focus, toggleFocus } = useFocus();

  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>(note.tags);
  const [notebookId, setNotebookId] = useState<string | null>(note.notebook_id);
  const [revisitAt, setRevisitAt] = useState(toDateInput(note.revisit_at));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [leavePrompt, setLeavePrompt] = useState(false);
  const [saved, setSaved] = useState({
    title: note.title,
    content: note.content,
    tags: note.tags,
    notebookId: note.notebook_id,
    revisitAt: toDateInput(note.revisit_at),
  });

  // Only the fields that actually moved go over the wire. Retyping a title
  // used to re-upload the entire Markdown body along with it.
  const changed = useMemo(() => {
    const patch: NoteUpdate = {};
    if (title !== saved.title) patch.title = title;
    if (content !== saved.content) patch.content = content;
    if (notebookId !== saved.notebookId) patch.notebook_id = notebookId;
    if (revisitAt !== saved.revisitAt) patch.revisit_at = fromDateInput(revisitAt);
    if (!sameTags(tags, saved.tags)) patch.tags = tags;
    return patch;
  }, [title, content, tags, notebookId, revisitAt, saved]);

  const dirty = Object.keys(changed).length > 0;

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const persist = useCallback(async () => {
    setSaving(true);
    setSaveError(null);
    try {
      await patchNote(note.id, changed);
      setSaved({ title, content, tags, notebookId, revisitAt });
      setLastSavedAt(new Date());
      return true;
    } catch (err) {
      setSaveError(errorMessage(err));
      return false;
    } finally {
      setSaving(false);
    }
  }, [patchNote, note.id, changed, title, content, tags, notebookId, revisitAt]);

  // Autosave after a short pause in typing.
  useEffect(() => {
    if (!dirty) return;
    const timer = window.setTimeout(() => void persist(), 1200);
    return () => window.clearTimeout(timer);
  }, [dirty, persist]);

  const handleSave = async () => {
    if (saving) return;
    if (dirty && !(await persist())) return;
    navigate("/notes/" + note.id);
  };

  const handleGoBack = () => {
    if (!dirty) {
      navigate("/notes/" + note.id);
      return;
    }
    setLeavePrompt(true);
  };

  const discardAndLeave = () => {
    setLeavePrompt(false);
    navigate("/notes/" + note.id);
  };

  const addTag = () => {
    const tag = tagInput.trim().toLowerCase().replace(/\s+/g, "-");
    if (tag && !tags.includes(tag)) setTags([...tags, tag]);
    setTagInput("");
  };

  const statusLabel = saving
    ? "Saving…"
    : dirty
      ? "Unsaved"
      : lastSavedAt
        ? `Saved ${lastSavedAt.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`
        : null;

  return (
    <div className="note-view animate-in px-4 pt-6">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleGoBack}
          aria-label="Back"
          className="rounded-xl p-2 text-muted hover:bg-surface-2 hover:text-ink"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.5 5.5 9 12l6.5 6.5" />
          </svg>
        </button>
        <div className="flex-1" />
        {statusLabel && (
          <span className="mr-1 text-xs font-medium uppercase tracking-wider text-accent-ink">
            {statusLabel}
          </span>
        )}
        <button
          type="button"
          onClick={() => toggleFocus()}
          aria-label={focus ? "Exit focus mode" : "Enter focus mode"}
          title={focus ? "Exit focus" : "Focus"}
          className={
            "rounded-xl p-2 transition-colors hover:bg-surface-2 " +
            (focus
              ? "text-accent-ink hover:text-accent"
              : "text-muted hover:text-ink")
          }
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
            <circle cx="12" cy="12" r="3.25" />
            <path strokeLinecap="round" d="M12 3.5v2.5M12 18v2.5M3.5 12h2.5M18 12h2.5" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving}
          className="btn-primary rounded-xl px-4 py-2 text-sm"
        >
          {dirty ? (saving ? "Saving…" : "Save") : "Done"}
        </button>
      </div>

      {leavePrompt && (
        <div className="mb-3 rounded-xl border border-accent/40 bg-accent-soft p-3">
          <p className="text-sm text-accent-ink">
            You have unsaved changes.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving}
              className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-on-accent disabled:opacity-50"
            >
              Save
            </button>
            <button
              type="button"
              onClick={discardAndLeave}
              className="rounded-lg bg-surface-2 px-3 py-1.5 text-xs font-medium text-ink-soft"
            >
              Discard
            </button>
            <button
              type="button"
              onClick={() => setLeavePrompt(false)}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-muted"
            >
              Keep editing
            </button>
          </div>
        </div>
      )}

      {saveError && (
        <div className="mb-3 rounded-xl bg-danger-soft p-3 text-xs text-danger">
          {saveError}
        </div>
      )}

      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Note title..."
        className="note-title mb-3 w-full bg-transparent text-2xl text-ink placeholder-faint focus:outline-none"
      />

      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted">Notebook:</span>
          <select
            value={notebookId ?? ""}
            onChange={(e) => setNotebookId(e.target.value || null)}
            className="rounded-lg border border-line bg-surface-2 px-2 py-1 text-xs text-ink-soft focus:outline-none"
          >
            <option value="">None</option>
            {notebooks.map((nb) => (
              <option key={nb.id} value={nb.id}>{nb.name}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="revisit-at" className="text-xs text-muted">
            Revisit by:
          </label>
          <input
            id="revisit-at"
            type="date"
            value={revisitAt}
            onChange={(e) => setRevisitAt(e.target.value)}
            className="rounded-lg border border-line bg-surface-2 px-2 py-1 text-xs text-ink-soft focus:outline-none"
          />
          {revisitAt && (
            <button
              type="button"
              onClick={() => setRevisitAt("")}
              className="text-xs text-muted hover:text-ink-soft"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      <div className="mb-4">
        <div className="flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <span key={tag} className="inline-flex items-center gap-1 rounded-md bg-accent-soft px-2.5 py-0.5 text-xs text-accent-ink">
              {tag}
              <button
                type="button"
                onClick={() => setTags(tags.filter((t) => t !== tag))}
                aria-label={`Remove ${tag}`}
                className="ml-0.5 text-accent-ink hover:text-danger"
              >
                ×
              </button>
            </span>
          ))}
        </div>
        <div className="mt-2 flex gap-2">
          <input
            type="text"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTag())}
            placeholder="Add tag..."
            className="flex-1 rounded-lg border border-line bg-surface-2 px-3 py-1 text-xs text-ink placeholder-faint focus:outline-none"
          />
          <button
            type="button"
            onClick={addTag}
            className="rounded-lg bg-surface-2 px-3 py-1 text-xs text-muted hover:text-ink"
          >
            Add
          </button>
        </div>
      </div>

      <MarkdownEditor
        content={content}
        onChange={setContent}
        noteId={note.id}
        notes={notes}
      />
    </div>
  );
}
