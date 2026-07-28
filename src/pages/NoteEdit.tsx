import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useNotes } from "../context/notes-context";
import { errorMessage } from "../lib/supabase";
import type { Note } from "../lib/types";
import MarkdownEditor from "../components/MarkdownEditor";

export default function NoteEdit() {
  const { id } = useParams<{ id: string }>();
  const { notes, loading } = useNotes();
  const note = notes.find((n) => n.id === id);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-slate-500">Loading…</p>
      </div>
    );
  }

  if (!note) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-slate-400">Note not found</p>
      </div>
    );
  }

  // Keyed by id so switching notes remounts the form with fresh initial state,
  // instead of an effect that would clobber in-progress edits on every save.
  return <NoteEditor key={note.id} note={note} />;
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

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      await updateNote(note.id, { title, content, tags, notebook_id: notebookId });
      navigate("/notes/" + note.id);
    } catch (err) {
      // Stay on the page so the user's unsaved text isn't thrown away.
      setSaveError(errorMessage(err));
      setSaving(false);
    }
  };

  const handleGoBack = async () => {
    if (title.trim() || content.trim()) {
      await handleSave();
    } else {
      navigate("/notes/" + note.id);
    }
  };

  const addTag = () => {
    const tag = tagInput.trim().toLowerCase().replace(/\s+/g, "-");
    if (tag && !tags.includes(tag)) setTags([...tags, tag]);
    setTagInput("");
  };

  return (
    <div className="animate-in px-4 pt-4">
      <div className="mb-4 flex items-center gap-3">
        <button onClick={handleGoBack}
          className="rounded-xl p-2 text-slate-400 hover:bg-slate-800/50 hover:text-white light:hover:bg-slate-100 light:hover:text-slate-900">
          ←
        </button>
        <div className="flex-1" />
        <button onClick={handleSave} disabled={saving}
          className="rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 px-4 py-2 text-sm font-semibold text-black transition-all hover:scale-105 active:scale-95 disabled:opacity-50">
          {saving ? "Saving…" : "Save"}
        </button>
      </div>

      {saveError && (
        <div className="mb-3 rounded-xl bg-red-500/10 p-3 text-xs text-red-400">
          {saveError}
        </div>
      )}

      <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
        placeholder="Note title..."
        className="mb-3 w-full bg-transparent text-xl font-bold text-white placeholder-slate-600 focus:outline-none light:text-slate-900 light:placeholder-slate-300"
      />

      <div className="mb-3 flex items-center gap-2">
        <span className="text-xs text-slate-500">Notebook:</span>
        <select value={notebookId ?? ""} onChange={(e) => setNotebookId(e.target.value || null)}
          className="rounded-lg border border-white/5 bg-slate-800/50 px-2 py-1 text-xs text-slate-300 focus:outline-none light:border-slate-200 light:bg-slate-100 light:text-slate-700">
          <option value="">None</option>
          {notebooks.map((nb) => (
            <option key={nb.id} value={nb.id}>{nb.name}</option>
          ))}
        </select>
      </div>

      <div className="mb-4">
        <div className="flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs text-amber-400">
              {tag}
              <button onClick={() => setTags(tags.filter((t) => t !== tag))}
                className="ml-0.5 text-amber-500 hover:text-red-400">×</button>
            </span>
          ))}
        </div>
        <div className="mt-2 flex gap-2">
          <input type="text" value={tagInput} onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTag())}
            placeholder="Add tag..."
            className="flex-1 rounded-lg border border-white/5 bg-slate-800/50 px-3 py-1 text-xs text-white placeholder-slate-500 focus:outline-none light:border-slate-200 light:bg-slate-100 light:text-slate-900"
          />
          <button onClick={addTag}
            className="rounded-lg bg-slate-800/50 px-3 py-1 text-xs text-slate-400 hover:text-white light:bg-slate-100 light:hover:text-slate-900">
            Add
          </button>
        </div>
      </div>

      <MarkdownEditor content={content} onChange={setContent} />
    </div>
  );
}
