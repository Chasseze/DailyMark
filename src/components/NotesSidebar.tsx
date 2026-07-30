import { useMemo, useState } from "react";
import { NavLink, useNavigate, useParams } from "react-router-dom";
import { useNotes } from "../context/notes-context";
import { errorMessage } from "../lib/supabase";

const COLORS = ["#f59e0b", "#3b82f6", "#ef4444", "#10b981", "#8b5cf6", "#ec4899"];

export default function NotesSidebar() {
  const { notes, notebooks, loading, error, addNote, addNotebook } = useNotes();
  const { id: selectedId } = useParams<{ id?: string }>();
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
      list = list.filter(
        (n) =>
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
        title: "",
        content: "",
        notebook_id: activeNotebook,
        is_pinned: false,
        tags: [],
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
    <aside className="notes-sidebar">
      <div className="border-b border-white/5 p-3 light:border-slate-200/70">
        <div className="relative">
          <svg
            viewBox="0 0 24 24"
            className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500"
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
            placeholder="Search files…"
            className="w-full rounded-lg border border-white/5 bg-white/5 py-2 pl-9 pr-3 text-xs text-white placeholder-slate-500 focus:border-amber-500/35 focus:outline-none light:border-slate-200 light:bg-white/70 light:text-slate-900"
          />
        </div>

        <div className="mt-2.5 flex items-center gap-1.5 overflow-x-auto pb-0.5">
          <button
            type="button"
            onClick={() => setActiveNotebook(null)}
            className={
              "shrink-0 rounded-md px-2 py-1 text-[11px] font-medium transition-colors " +
              (!activeNotebook
                ? "bg-amber-500/20 text-amber-400"
                : "text-slate-400 hover:bg-white/5 hover:text-slate-200 light:hover:bg-slate-100")
            }
          >
            All
          </button>
          {notebooks.map((nb) => (
            <button
              key={nb.id}
              type="button"
              onClick={() => setActiveNotebook(nb.id)}
              className={
                "shrink-0 rounded-md px-2 py-1 text-[11px] font-medium transition-colors " +
                (activeNotebook === nb.id
                  ? "bg-amber-500/20 text-amber-400"
                  : "text-slate-400 hover:bg-white/5 hover:text-slate-200 light:hover:bg-slate-100")
              }
            >
              <span
                className="mr-1 inline-block h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: nb.color }}
              />
              {nb.name}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setShowNewNotebook(!showNewNotebook)}
            className="shrink-0 rounded-md px-2 py-1 text-[11px] text-slate-500 hover:bg-white/5 hover:text-slate-300"
          >
            +
          </button>
        </div>

        {showNewNotebook && (
          <div className="mt-2 space-y-2 rounded-lg bg-black/20 p-2 light:bg-white/60">
            <input
              type="text"
              value={newNbName}
              onChange={(e) => setNewNbName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void handleCreateNotebook()}
              placeholder="Notebook name…"
              className="w-full rounded-md border border-white/5 bg-black/20 px-2 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none light:border-slate-200 light:bg-white light:text-slate-900"
            />
            <div className="flex items-center justify-between gap-2">
              <div className="flex gap-1">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setNewNbColor(c)}
                    className={
                      "h-5 w-5 rounded-full border-2 transition-transform " +
                      (newNbColor === c ? "scale-110 border-white" : "border-transparent")
                    }
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
              <button
                type="button"
                onClick={() => void handleCreateNotebook()}
                className="rounded-md bg-amber-500 px-2.5 py-1 text-[11px] font-semibold text-black"
              >
                Create
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        <div className="mb-1.5 flex items-center justify-between px-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            {loading ? "Loading" : `${filtered.length} file${filtered.length !== 1 ? "s" : ""}`}
          </p>
          <button
            type="button"
            onClick={() => void handleQuickNote()}
            disabled={busy}
            className="rounded-md px-1.5 py-0.5 text-[11px] font-semibold text-amber-400 hover:bg-amber-500/10 disabled:opacity-50"
          >
            New
          </button>
        </div>

        {(error || writeError) && (
          <div className="mb-2 rounded-lg bg-red-500/10 px-2 py-1.5 text-[11px] text-red-400">
            {error ?? writeError}
          </div>
        )}

        {loading ? (
          <div className="space-y-1.5 px-1">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="h-10 animate-pulse rounded-lg bg-white/5 light:bg-slate-200/70" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-2 py-8 text-center">
            <p className="text-sm font-semibold text-slate-400">
              {search ? "Nothing matched" : "No notes yet"}
            </p>
            <button
              type="button"
              onClick={() => void handleQuickNote()}
              disabled={busy}
              className="mt-3 text-xs font-medium text-amber-400 hover:text-amber-300 disabled:opacity-50"
            >
              Create a note
            </button>
          </div>
        ) : (
          <nav className="space-y-0.5" aria-label="Notes files">
            {filtered.map((note) => {
              const active = selectedId === note.id;
              return (
                <NavLink
                  key={note.id}
                  to={"/notes/" + note.id}
                  className="notes-file-row"
                  data-active={active ? "true" : "false"}
                >
                  <span className="notes-file-glyph" aria-hidden="true">
                    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7 3.75h7.5L19 8.25v12a.75.75 0 0 1-.75.75H7.75A.75.75 0 0 1 7 20.25V3.75Z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14.5 3.75V8H19" />
                    </svg>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1">
                      <span className="truncate text-[0.82rem] font-medium text-white light:text-slate-900">
                        {note.title || "Untitled"}
                      </span>
                      {note.is_pinned && (
                        <span className="shrink-0 text-[0.55rem] text-amber-400" aria-label="Pinned">
                          ●
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 block truncate text-[10px] text-slate-500">
                      {new Date(note.updated_at).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </span>
                </NavLink>
              );
            })}
          </nav>
        )}
      </div>
    </aside>
  );
}
