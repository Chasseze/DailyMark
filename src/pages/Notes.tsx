import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useNotes } from "../context/notes-context";
import { errorMessage } from "../lib/supabase";
import NoteCard from "../components/NoteCard";

const COLORS = ["#f59e0b", "#3b82f6", "#ef4444", "#10b981", "#8b5cf6", "#ec4899"];

export default function Notes() {
  const { notes, notebooks, loading, error, addNote, addNotebook } = useNotes();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [activeNotebook, setActiveNotebook] = useState<string | null>(null);
  const [showNewNotebook, setShowNewNotebook] = useState(false);
  const [newNbName, setNewNbName] = useState("");
  const [newNbColor, setNewNbColor] = useState(COLORS[0]);
  const [busy, setBusy] = useState(false);
  const [writeError, setWriteError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let list = notes;
    if (activeNotebook) list = list.filter((n) => n.notebook_id === activeNotebook);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((n) =>
        n.title.toLowerCase().includes(q) ||
        n.content.toLowerCase().includes(q) ||
        n.tags.some((t) => t.toLowerCase().includes(q))
      );
    }
    return [...list].sort((a, b) => {
      if (a.is_pinned && !b.is_pinned) return -1;
      if (!a.is_pinned && b.is_pinned) return 1;
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });
  }, [notes, activeNotebook, search]);

  const handleQuickNote = async () => {
    if (busy) return;
    setBusy(true);
    setWriteError(null);
    try {
      const note = await addNote({
        title: "", content: "", notebook_id: activeNotebook, is_pinned: false, tags: [],
      });
      navigate("/notes/" + note.id + "/edit");
    } catch (err) {
      setWriteError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const handleCreateNotebook = async () => {
    if (!newNbName.trim() || busy) return;
    setBusy(true);
    setWriteError(null);
    try {
      await addNotebook(newNbName.trim(), newNbColor);
      setNewNbName("");
      setShowNewNotebook(false);
    } catch (err) {
      setWriteError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="px-4 pt-6">
      <div className="mb-6">
        <h1 className="page-title text-white light:text-slate-900">My notes</h1>
        <p className="mt-2 text-sm text-slate-400 light:text-slate-500">
          {loading ? "Loading…" : `${notes.length} note${notes.length !== 1 ? "s" : ""}`}
        </p>
      </div>

      <div className="relative mb-4">
        <svg
          viewBox="0 0 24 24"
          className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="6.5" />
          <path strokeLinecap="round" d="m16.5 16.5 3 3" />
        </svg>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search notes…"
          className="w-full rounded-xl border border-white/5 bg-slate-900/50 py-2.5 pl-10 pr-4 text-sm text-white placeholder-slate-500 focus:border-amber-500/30 focus:outline-none light:border-slate-200 light:bg-slate-50 light:text-slate-900"
        />
      </div>

      <div className="mb-4 flex items-center gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setActiveNotebook(null)}
          className={
            "shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-all " +
            (!activeNotebook
              ? "bg-amber-500/20 text-amber-400"
              : "bg-slate-800/50 text-slate-400 hover:text-slate-200 light:bg-slate-100 light:text-slate-500")
          }
        >
          All
        </button>
        {notebooks.map((nb) => (
          <button
            key={nb.id}
            onClick={() => setActiveNotebook(nb.id)}
            className={
              "shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-all " +
              (activeNotebook === nb.id
                ? "bg-amber-500/20 text-amber-400"
                : "bg-slate-800/50 text-slate-400 hover:text-slate-200 light:bg-slate-100 light:text-slate-500")
            }
          >
            <span className="mr-1 inline-block h-2 w-2 rounded-full" style={{ backgroundColor: nb.color }} />
            {nb.name}
          </button>
        ))}
        <button
          onClick={() => setShowNewNotebook(!showNewNotebook)}
          className="shrink-0 rounded-full bg-slate-800/50 px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 light:bg-slate-100 light:text-slate-500"
        >
          + Add
        </button>
      </div>

      {showNewNotebook && (
        <div className="mb-4 flex items-center gap-2 rounded-xl bg-slate-800/30 p-3 light:bg-slate-100">
          <input
            type="text" value={newNbName} onChange={(e) => setNewNbName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreateNotebook()}
            placeholder="Notebook name..."
            className="flex-1 rounded-lg border border-white/5 bg-slate-900/50 px-3 py-1.5 text-sm text-white placeholder-slate-500 focus:outline-none light:border-slate-300 light:bg-white light:text-slate-900"
          />
          <div className="flex gap-1">
            {COLORS.map((c) => (
              <button
                key={c} onClick={() => setNewNbColor(c)}
                className={
                  "h-6 w-6 rounded-full border-2 transition-all " +
                  (newNbColor === c ? "border-white scale-110" : "border-transparent")
                }
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
          <button onClick={handleCreateNotebook} className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-medium text-black">
            Create
          </button>
        </div>
      )}

      {(error || writeError) && (
        <div className="mb-4 rounded-xl bg-red-500/10 p-3 text-xs text-red-400">
          {error ?? writeError}
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-slate-800/40 light:bg-slate-100" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="mt-12 text-center">
          <p className="note-title text-2xl text-slate-400 light:text-slate-500">
            {search ? "Nothing matched" : "Fresh page"}
          </p>
          <p className="mt-2 text-sm text-slate-500">
            {search ? "Try a different search." : "Start with a quick note."}
          </p>
          <button onClick={handleQuickNote} disabled={busy} className="mt-4 rounded-full bg-amber-500/10 px-4 py-2 text-sm font-medium text-amber-400 hover:bg-amber-500/20 disabled:opacity-50">
            Create your first note
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((note) => (
            <NoteCard key={note.id} note={note} onClick={() => navigate("/notes/" + note.id)} />
          ))}
        </div>
      )}

      <button
        onClick={handleQuickNote}
        disabled={busy}
        className="fixed bottom-24 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-lg shadow-amber-500/20 transition-all hover:scale-105 active:scale-95 disabled:opacity-50 md:right-[calc(50%-15rem)]"
      >
        <span className="text-2xl">+</span>
      </button>
    </div>
  );
}
