import { useMemo, useState } from "react";
import { NavLink, useNavigate, useParams } from "react-router-dom";
import { useNotes } from "../context/notes-context";
import { errorMessage } from "../lib/supabase";

const COLORS = ["#f59e0b", "#3b82f6", "#ef4444", "#10b981", "#8b5cf6", "#ec4899"];

/** Opening preview from the DB snippet, wrapped to ~3 lines via CSS. */
function openingLines(preview: string): string {
  const plain = preview.trim();
  if (!plain) return "";
  // Prefer sentence-ish breaks so line-clamp has natural wraps.
  return plain.replace(/([.!?])\s+/g, "$1\n");
}

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
          n.preview.toLowerCase().includes(q) ||
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
      <div className="px-4 pt-6">
        <div className="mb-5 flex items-end justify-between gap-3">
          <div>
            <h1 className="page-title text-white light:text-slate-900">My notes</h1>
            <p className="mt-2 text-sm text-slate-400 light:text-slate-500">
              {loading
                ? "Loading…"
                : `${filtered.length} note${filtered.length !== 1 ? "s" : ""}`}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void handleQuickNote()}
            disabled={busy}
            className="shrink-0 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 px-3.5 py-2 text-sm font-semibold text-black transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
          >
            New
          </button>
        </div>

        <div className="relative mb-3">
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
            className="w-full rounded-xl border border-white/5 bg-white/5 py-2.5 pl-10 pr-4 text-sm text-white placeholder-slate-500 focus:border-amber-500/35 focus:outline-none light:border-slate-200 light:bg-white/70 light:text-slate-900"
          />
        </div>

        <div className="mb-3 flex items-center gap-1.5 overflow-x-auto pb-0.5">
          <button
            type="button"
            onClick={() => setActiveNotebook(null)}
            className={
              "shrink-0 rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-colors " +
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
                "shrink-0 rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-colors " +
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
            className="shrink-0 rounded-lg px-2.5 py-1.5 text-[11px] text-slate-500 hover:bg-white/5 hover:text-slate-300"
          >
            +
          </button>
        </div>

        {showNewNotebook && (
          <div className="mb-3 space-y-2 rounded-2xl bg-black/20 p-3 light:bg-white/60">
            <input
              type="text"
              value={newNbName}
              onChange={(e) => setNewNbName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void handleCreateNotebook()}
              placeholder="Notebook name…"
              className="w-full rounded-lg border border-white/5 bg-black/20 px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none light:border-slate-200 light:bg-white light:text-slate-900"
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
                className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-black"
              >
                Create
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
        {(error || writeError) && (
          <div className="mb-3 rounded-xl bg-red-500/10 px-3 py-2 text-xs text-red-400">
            {error ?? writeError}
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-28 animate-pulse rounded-2xl bg-white/5 light:bg-slate-200/70" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="glass mt-6 rounded-3xl px-4 py-10 text-center">
            <p className="text-sm font-semibold text-slate-400">
              {search ? "Nothing matched" : "No notes yet"}
            </p>
            <button
              type="button"
              onClick={() => void handleQuickNote()}
              disabled={busy}
              className="mt-3 text-sm font-medium text-amber-400 hover:text-amber-300 disabled:opacity-50"
            >
              Create a note
            </button>
          </div>
        ) : (
          <nav className="notes-file-list" aria-label="Notes">
            {filtered.map((note) => {
              const active = selectedId === note.id;
              const preview = openingLines(note.preview);
              const date = new Date(note.updated_at).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
              });

              return (
                <NavLink
                  key={note.id}
                  to={"/notes/" + note.id}
                  className="notes-file-card"
                  data-active={active ? "true" : "false"}
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="min-w-0 flex-1 truncate text-[0.95rem] font-semibold tracking-tight text-white light:text-slate-900">
                      {note.title || "Untitled"}
                    </h3>
                    {note.is_pinned && (
                      <span className="mt-1 shrink-0 text-[0.55rem] text-amber-400" aria-label="Pinned">
                        ●
                      </span>
                    )}
                  </div>

                  <p className="mt-1 text-[10px] font-medium uppercase tracking-[0.08em] text-slate-500">
                    {date}
                  </p>

                  {note.tags.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {note.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-md bg-amber-500/12 px-1.5 py-0.5 text-[10px] font-medium text-amber-400"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {preview ? (
                    <p className="notes-file-card__preview mt-2 text-[11px] leading-relaxed text-slate-400 light:text-slate-500">
                      {preview}
                    </p>
                  ) : (
                    <p className="mt-2 text-[11px] italic text-slate-500">No content yet</p>
                  )}
                </NavLink>
              );
            })}
          </nav>
        )}
      </div>
    </aside>
  );
}
