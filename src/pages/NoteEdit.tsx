import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useNotes } from "../context/notes-context";
import { errorMessage } from "../lib/supabase";
import type { Note } from "../lib/types";
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
        <p className="text-sm text-slate-500">Loading…</p>
      </div>
    );
  }

  if (!note || hydrateError) {
    return (
      <div className="flex h-full min-h-[16rem] items-center justify-center">
        <p className="text-slate-400">{hydrateError ?? "Note not found"}</p>
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
      <p className="text-slate-400">This note is in Trash. Restore it before editing.</p>
      <button
        type="button"
        onClick={() => navigate("/notes/" + id)}
        className="mt-4 text-sm text-amber-400"
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

function NoteEditor({ note }: { note: Note }) {
  const navigate = useNavigate();
  const { notebooks, updateNote } = useNotes();

  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>(note.tags);
  const [notebookId, setNotebookId] = useState<string | null>(note.notebook_id);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [leavePrompt, setLeavePrompt] = useState(false);
  const [saved, setSaved] = useState({
    title: note.title,
    content: note.content,
    tags: note.tags,
    notebookId: note.notebook_id,
  });

  const dirty =
    title !== saved.title ||
    content !== saved.content ||
    notebookId !== saved.notebookId ||
    !sameTags(tags, saved.tags);

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  // Autosave after a short pause in typing.
  useEffect(() => {
    if (!dirty) return;
    const timer = window.setTimeout(() => {
      void (async () => {
        setSaving(true);
        setSaveError(null);
        try {
          await updateNote(note.id, {
            title,
            content,
            tags,
            notebook_id: notebookId,
          });
          setSaved({ title, content, tags, notebookId });
          setLastSavedAt(new Date());
        } catch (err) {
          setSaveError(errorMessage(err));
        } finally {
          setSaving(false);
        }
      })();
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [title, content, tags, notebookId, dirty, note.id, updateNote]);

  const handleSave = async () => {
    if (saving) return;
    if (dirty) {
      setSaving(true);
      setSaveError(null);
      try {
        await updateNote(note.id, { title, content, tags, notebook_id: notebookId });
        setSaved({ title, content, tags, notebookId });
        setLastSavedAt(new Date());
      } catch (err) {
        setSaveError(errorMessage(err));
        setSaving(false);
        return;
      }
      setSaving(false);
    }
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
          className="rounded-xl p-2 text-slate-400 hover:bg-white/5 hover:text-white light:hover:bg-slate-100 light:hover:text-slate-900"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.5 5.5 9 12l6.5 6.5" />
          </svg>
        </button>
        <div className="flex-1" />
        {statusLabel && (
          <span className="mr-1 text-[11px] font-medium uppercase tracking-wider text-amber-400/80">
            {statusLabel}
          </span>
        )}
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving}
          className="rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 px-4 py-2 text-sm font-semibold text-black transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
        >
          {dirty ? (saving ? "Saving…" : "Save") : "Done"}
        </button>
      </div>

      {leavePrompt && (
        <div className="mb-3 rounded-xl border border-amber-500/25 bg-amber-500/10 p-3">
          <p className="text-sm text-amber-200 light:text-amber-800">
            You have unsaved changes.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving}
              className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-black disabled:opacity-50"
            >
              Save
            </button>
            <button
              type="button"
              onClick={discardAndLeave}
              className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-slate-200 light:bg-slate-200 light:text-slate-800"
            >
              Discard
            </button>
            <button
              type="button"
              onClick={() => setLeavePrompt(false)}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-400"
            >
              Keep editing
            </button>
          </div>
        </div>
      )}

      {saveError && (
        <div className="mb-3 rounded-xl bg-red-500/10 p-3 text-xs text-red-400">
          {saveError}
        </div>
      )}

      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Note title..."
        className="note-title mb-3 w-full bg-transparent text-2xl text-white placeholder-slate-600 focus:outline-none light:text-slate-900 light:placeholder-slate-300"
      />

      <div className="mb-3 flex items-center gap-2">
        <span className="text-xs text-slate-500">Notebook:</span>
        <select
          value={notebookId ?? ""}
          onChange={(e) => setNotebookId(e.target.value || null)}
          className="rounded-lg border border-white/5 bg-slate-800/50 px-2 py-1 text-xs text-slate-300 focus:outline-none light:border-slate-200 light:bg-slate-100 light:text-slate-700"
        >
          <option value="">None</option>
          {notebooks.map((nb) => (
            <option key={nb.id} value={nb.id}>{nb.name}</option>
          ))}
        </select>
      </div>

      <div className="mb-4">
        <div className="flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <span key={tag} className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-2.5 py-0.5 text-xs text-amber-400">
              {tag}
              <button
                type="button"
                onClick={() => setTags(tags.filter((t) => t !== tag))}
                aria-label={`Remove ${tag}`}
                className="ml-0.5 text-amber-500 hover:text-red-400"
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
            className="flex-1 rounded-lg border border-white/5 bg-slate-800/50 px-3 py-1 text-xs text-white placeholder-slate-500 focus:outline-none light:border-slate-200 light:bg-slate-100 light:text-slate-900"
          />
          <button
            type="button"
            onClick={addTag}
            className="rounded-lg bg-slate-800/50 px-3 py-1 text-xs text-slate-400 hover:text-white light:bg-slate-100 light:hover:text-slate-900"
          >
            Add
          </button>
        </div>
      </div>

      <MarkdownEditor content={content} onChange={setContent} noteId={note.id} />
    </div>
  );
}
