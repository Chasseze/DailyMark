import { memo, useEffect, useMemo, useState, type CSSProperties } from "react";
import { NavLink, useNavigate, useParams } from "react-router-dom";
import { useNotes } from "../context/notes-context";
import CaptureBar from "./CaptureBar";
import { useStreak } from "../hooks/useStreak";
import { shareUrl } from "../lib/share";
import { errorMessage } from "../lib/supabase";
import type { Note } from "../lib/types";

const COLORS = ["#f59e0b", "#3b82f6", "#ef4444", "#10b981", "#8b5cf6", "#ec4899"];

/** Opening preview from the DB snippet, wrapped to ~3 lines via CSS. */
function openingLines(preview: string): string {
  const plain = preview.trim();
  if (!plain) return "";
  // Prefer sentence-ish breaks so line-clamp has natural wraps.
  return plain.replace(/([.!?])\s+/g, "$1\n");
}

function matchesSearch(note: Note, q: string): boolean {
  return (
    note.title.toLowerCase().includes(q) ||
    note.preview.toLowerCase().includes(q) ||
    note.tags.some((t) => t.toLowerCase().includes(q))
  );
}

export default function NotesSidebar() {
  const {
    notes,
    trash,
    notebooks,
    loading,
    error,
    addNote,
    addNotebook,
    updateNotebook,
    deleteNotebook,
    restoreNote,
    purgeNote,
    emptyTrash,
    searchNotes,
    dueNotes,
    createNotebookShare,
  } = useNotes();
  const { streak } = useStreak();
  const { id: selectedId } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [activeNotebook, setActiveNotebook] = useState<string | null>(null);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [showTrash, setShowTrash] = useState(false);
  const [showDue, setShowDue] = useState(false);
  const [tagsOpen, setTagsOpen] = useState(false);
  const [ftsHits, setFtsHits] = useState<Note[] | null>(null);
  const [ftsBusy, setFtsBusy] = useState(false);
  const [showNewNotebook, setShowNewNotebook] = useState(false);
  const [newNbName, setNewNbName] = useState("");
  const [newNbColor, setNewNbColor] = useState(COLORS[0]);
  const [editingNb, setEditingNb] = useState<string | null>(null);
  const [editNbName, setEditNbName] = useState("");
  const [editNbColor, setEditNbColor] = useState(COLORS[0]);
  const [busy, setBusy] = useState(false);
  const [writeError, setWriteError] = useState<string | null>(null);
  const [shareStatus, setShareStatus] = useState<string | null>(null);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    for (const note of notes) for (const tag of note.tags) set.add(tag);
    return [...set].sort();
  }, [notes]);

  const searchQuery = search.trim();
  // Ignore stale FTS results when the query is cleared or Trash/Due is open.
  const activeFts = searchQuery && !showTrash && !showDue ? ftsHits : null;

  useEffect(() => {
    if (!searchQuery || showTrash || showDue) return;

    let active = true;
    const timer = window.setTimeout(() => {
      setFtsBusy(true);
      void searchNotes(searchQuery)
        .then((hits) => {
          if (active) setFtsHits(hits);
        })
        .catch(() => {
          // Client filter below still works if FTS is unavailable.
          if (active) setFtsHits(null);
        })
        .finally(() => {
          if (active) setFtsBusy(false);
        });
    }, 280);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [searchQuery, showTrash, showDue, searchNotes]);

  const filtered = useMemo(() => {
    if (showTrash) {
      let list = trash;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        list = list.filter((n) => matchesSearch(n, q));
      }
      return list;
    }

    if (showDue) {
      let list = dueNotes;
      if (activeTag) list = list.filter((n) => n.tags.includes(activeTag));
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        list = list.filter((n) => matchesSearch(n, q));
      }
      return list;
    }

    let list = activeFts ?? notes;
    if (activeNotebook) list = list.filter((n) => n.notebook_id === activeNotebook);
    if (activeTag) list = list.filter((n) => n.tags.includes(activeTag));
    if (!activeFts && searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter((n) => matchesSearch(n, q));
    }
    return [...list].sort((a, b) => {
      if (a.is_pinned && !b.is_pinned) return -1;
      if (!a.is_pinned && b.is_pinned) return 1;
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });
  }, [
    notes,
    trash,
    dueNotes,
    activeNotebook,
    activeTag,
    searchQuery,
    showTrash,
    showDue,
    activeFts,
  ]);

  const handleQuickNote = async () => {
    if (busy || showTrash) return;
    setBusy(true);
    setWriteError(null);
    try {
      const note = await addNote({
        title: "",
        content: "",
        notebook_id: activeNotebook,
        is_pinned: false,
        tags: activeTag ? [activeTag] : [],
      });
      navigate("/notes/" + note.id + "/edit");
    } catch (err) {
      setWriteError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const handleShareNotebook = async () => {
    if (!activeNotebook || busy) return;
    setShareStatus(null);
    setWriteError(null);
    try {
      const token = await createNotebookShare(activeNotebook);
      await navigator.clipboard.writeText(shareUrl(token));
      setShareStatus("Link copied");
      window.setTimeout(() => setShareStatus(null), 2000);
    } catch (err) {
      setWriteError(errorMessage(err));
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

  const handleSaveNotebook = async () => {
    if (!editingNb || !editNbName.trim() || busy) return;
    setBusy(true);
    setWriteError(null);
    try {
      await updateNotebook(editingNb, { name: editNbName.trim(), color: editNbColor });
      setEditingNb(null);
    } catch (err) {
      setWriteError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteNotebook = async (id: string, name: string) => {
    if (!confirm(`Delete notebook “${name}”? Notes stay; they just lose this notebook.`)) return;
    setBusy(true);
    setWriteError(null);
    try {
      await deleteNotebook(id);
      if (activeNotebook === id) setActiveNotebook(null);
      if (editingNb === id) setEditingNb(null);
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
            <h1 className="page-title text-ink">My notes</h1>
            <p className="mt-2 text-sm text-muted">
              {loading
                ? "Loading…"
                : showTrash
                  ? `${filtered.length} in trash`
                  : showDue
                    ? `${filtered.length} due`
                    : `${filtered.length} note${filtered.length !== 1 ? "s" : ""}`}
              {!loading && streak != null && !showTrash && (
                <span className="ml-2 text-accent-ink">· {streak} day streak</span>
              )}
            </p>
          </div>
        </div>

        {/* The fast path. Was a pair of small buttons up in the header; a note
            app's primary job deserves the full width. */}
        {!showTrash && (
          <div className="mb-4">
            <CaptureBar notebookId={activeNotebook} tags={activeTag ? [activeTag] : []} />
          </div>
        )}

        <div className="relative mb-3">
          <svg
            viewBox="0 0 24 24"
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
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
            placeholder={showTrash ? "Search trash…" : "Search notes…"}
            className="w-full rounded-xl border border-line bg-surface py-2.5 pl-10 pr-4 text-sm text-ink placeholder-faint focus:border-accent/50 focus:outline-none"
          />
          {ftsBusy && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted">
              …
            </span>
          )}
        </div>

        {/* Notebooks and Trash are structure — where a note lives — so they
            stay on their own row, in view. Only the free-form article tags
            (which grow without bound) sit behind a disclosure. */}
        {/* One line, always. Scope + notebooks share a scrolling track so a
            long notebook list can never push anything onto a second row, and
            "+" / Trash are pinned outside that track so they stay in view no
            matter how many notebooks there are. */}
        <div className="notes-scope mb-3 flex items-center">
          <div className="notes-scope__track flex min-w-0 flex-1 items-center overflow-x-auto">
            <button
              type="button"
              onClick={() => {
                setShowTrash(false);
                setShowDue(false);
                setActiveNotebook(null);
              }}
              className={
                "notes-chip " +
                (!showTrash && !showDue && !activeNotebook
                  ? "notes-chip--on"
                  : "notes-chip--off")
              }
            >
              All
            </button>
            {dueNotes.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setShowTrash(false);
                  setShowDue(true);
                  setActiveNotebook(null);
                }}
                className={
                  "notes-chip " + (!showTrash && showDue ? "notes-chip--on" : "notes-chip--off")
                }
              >
                Due ({dueNotes.length})
              </button>
            )}
            {notebooks.map((nb) => (
              <button
                key={nb.id}
                type="button"
                onClick={() => {
                  setShowTrash(false);
                  setShowDue(false);
                  setActiveNotebook(nb.id);
                }}
                onDoubleClick={() => {
                  setEditingNb(nb.id);
                  setEditNbName(nb.name);
                  setEditNbColor(nb.color);
                  setShowNewNotebook(false);
                }}
                className={
                  "notes-chip notes-chip--nb " +
                  (!showTrash && !showDue && activeNotebook === nb.id ? "is-active" : "")
                }
                style={{ "--nb-color": nb.color } as CSSProperties}
                title="Double-click to rename"
              >
                {nb.name}
              </button>
            ))}
          </div>

          <div className="notes-scope__pinned flex shrink-0 items-center border-l border-line">
            <button
              type="button"
              onClick={() => {
                setShowTrash(true);
                setShowDue(false);
                setActiveNotebook(null);
                setActiveTag(null);
              }}
              className={
                "notes-chip " + (showTrash ? "notes-chip--trash" : "notes-chip--off")
              }
            >
              Trash{trash.length > 0 ? ` (${trash.length})` : ""}
            </button>
          </div>
        </div>

        {activeNotebook && !showTrash && !showDue && (
          <div className="mb-3 flex items-center gap-2">
            <button
              type="button"
              onClick={() => void handleShareNotebook()}
              disabled={busy}
              className="rounded-lg px-2.5 py-1 text-xs font-medium text-muted transition-colors hover:bg-surface-2 hover:text-ink-soft disabled:opacity-50"
            >
              Share
            </button>
            {shareStatus && <span className="text-xs text-accent-ink">{shareStatus}</span>}
          </div>
        )}

        {!showTrash && (
          <div className="mb-3">
            <div className="flex items-center gap-1.5">
              {allTags.length > 0 && (
                <button
                  type="button"
                  onClick={() => setTagsOpen((open) => !open)}
                  aria-expanded={tagsOpen}
                  aria-controls="notes-tag-filter"
                  className={
                    "shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors " +
                    (tagsOpen
                      ? "bg-surface-2 text-ink-soft"
                      : "text-muted hover:bg-surface-2 hover:text-ink-soft")
                  }
                >
                  Tags{activeTag ? " (1)" : ""}
                </button>
              )}
              {activeTag && (
                <button
                  type="button"
                  onClick={() => setActiveTag(null)}
                  className="inline-flex items-center gap-1.5 rounded-md bg-accent-soft px-2 py-1 text-xs font-medium text-accent-ink"
                >
                  #{activeTag}
                  <span aria-hidden="true">×</span>
                  <span className="sr-only">Clear tag filter</span>
                </button>
              )}
              <div className="flex-1" />
              {/* Creating a notebook is an action, not a filter, so it sits
                  here rather than eating width in the scope row above. */}
              <button
                type="button"
                onClick={() => {
                  setShowNewNotebook(!showNewNotebook);
                  setEditingNb(null);
                }}
                aria-expanded={showNewNotebook}
                className={
                  "shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors " +
                  (showNewNotebook
                    ? "bg-surface-2 text-ink-soft"
                    : "text-muted hover:bg-surface-2 hover:text-ink-soft")
                }
              >
                + Notebook
              </button>
            </div>
            {tagsOpen && (
              <div
                id="notes-tag-filter"
                className="mt-2 flex flex-wrap items-center gap-1.5 rounded-xl border border-line bg-surface p-2"
              >
                {allTags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setActiveTag(activeTag === tag ? null : tag)}
                    className={
                      "shrink-0 rounded-md px-2 py-1 text-xs font-medium " +
                      (activeTag === tag
                        ? "bg-accent-soft text-accent-ink"
                        : "text-muted hover:bg-surface-2 hover:text-ink-soft")
                    }
                  >
                    #{tag}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {showNewNotebook && (
          <div className="mb-3 space-y-2 rounded-2xl border border-line bg-surface p-3">
            <input
              type="text"
              value={newNbName}
              onChange={(e) => setNewNbName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void handleCreateNotebook()}
              placeholder="Notebook name…"
              className="w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm text-ink placeholder-faint focus:outline-none"
            />
            <div className="flex items-center justify-between gap-2">
              <div className="flex gap-1">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setNewNbColor(c)}
                    aria-label={`Colour ${c}`}
                    className={
                      "h-5 w-5 rounded-full border-2 transition-transform " +
                      (newNbColor === c ? "scale-110 border-ink" : "border-transparent")
                    }
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
              <button
                type="button"
                onClick={() => void handleCreateNotebook()}
                className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-on-accent"
              >
                Create
              </button>
            </div>
          </div>
        )}

        {editingNb && (
          <div className="mb-3 space-y-2 rounded-2xl border border-line bg-surface p-3">
            <input
              type="text"
              value={editNbName}
              onChange={(e) => setEditNbName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void handleSaveNotebook()}
              aria-label="Notebook name"
              className="w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm text-ink focus:outline-none"
            />
            <div className="flex gap-1">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setEditNbColor(c)}
                  aria-label={`Colour ${c}`}
                  className={
                    "h-5 w-5 rounded-full border-2 transition-transform " +
                    (editNbColor === c ? "scale-110 border-ink" : "border-transparent")
                  }
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void handleSaveNotebook()}
                className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-on-accent"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => setEditingNb(null)}
                className="rounded-lg bg-surface-2 px-3 py-1.5 text-xs text-ink-soft"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleDeleteNotebook(editingNb, editNbName)}
                className="rounded-lg px-3 py-1.5 text-xs text-danger"
              >
                Delete
              </button>
            </div>
          </div>
        )}

        {showTrash && trash.length > 0 && (
          <button
            type="button"
            onClick={async () => {
              if (!confirm("Permanently delete everything in Trash?")) return;
              setBusy(true);
              try {
                await emptyTrash();
                navigate("/notes");
              } catch (err) {
                setWriteError(errorMessage(err));
              } finally {
                setBusy(false);
              }
            }}
            className="mb-3 w-full rounded-lg bg-danger-soft px-3 py-2 text-xs font-medium text-danger"
          >
            Empty trash
          </button>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
        {(error || writeError) && (
          <div className="mb-3 rounded-xl bg-danger-soft px-3 py-2 text-xs text-danger">
            {error ?? writeError}
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="skeleton h-28 rounded-2xl" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="glass mt-6 rounded-3xl px-4 py-10 text-center">
            <p className="text-sm font-semibold text-muted">
              {showTrash
                ? "Trash is empty"
                : showDue
                  ? "Nothing due"
                  : search || activeTag
                    ? "Nothing matched"
                    : "No notes yet"}
            </p>
            {!showTrash && !showDue && (
              <button
                type="button"
                onClick={() => void handleQuickNote()}
                disabled={busy}
                className="mt-3 text-sm font-medium text-accent-ink hover:text-accent disabled:opacity-50"
              >
                Create a note
              </button>
            )}
          </div>
        ) : (
          <nav className="notes-file-list" aria-label={showTrash ? "Trash" : showDue ? "Due" : "Notes"}>
            {filtered.map((note) => (
              <NoteCard
                key={note.id}
                note={note}
                active={selectedId === note.id}
                showTrash={showTrash}
                showDue={showDue}
                onRestore={restoreNote}
                onPurge={purgeNote}
                onWriteError={setWriteError}
              />
            ))}
          </nav>
        )}
      </div>
    </aside>
  );
}

const CARD_DATE: Intl.DateTimeFormatOptions = {
  month: "short",
  day: "numeric",
  year: "numeric",
};
const DUE_DATE: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };

const NoteCard = memo(function NoteCard({
  note,
  active,
  showTrash,
  showDue,
  onRestore,
  onPurge,
  onWriteError,
}: {
  note: Note;
  active: boolean;
  showTrash: boolean;
  showDue: boolean;
  onRestore: (id: string) => Promise<void>;
  onPurge: (id: string) => Promise<void>;
  onWriteError: (message: string | null) => void;
}) {
  const navigate = useNavigate();
  const preview = openingLines(note.preview);
  const date = new Date(note.updated_at).toLocaleDateString(undefined, CARD_DATE);

  return (
    <div className="relative">
      <NavLink
        to={"/notes/" + note.id}
        className="notes-file-card"
        data-active={active ? "true" : "false"}
      >
        <div className="flex items-start justify-between gap-2">
          <h3 className="min-w-0 flex-1 truncate text-sm font-semibold tracking-tight text-ink">
            {note.title || "Untitled"}
          </h3>
          {note.is_pinned && !showTrash && (
            <span
              className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent"
              role="img"
              aria-label="Pinned"
            />
          )}
        </div>

        <p className="mt-1 text-xs font-medium uppercase tracking-[0.08em] text-muted">
          {date}
          {showDue && note.revisit_at && (
            <span className="ml-1.5 normal-case tracking-normal text-accent-ink">
              · due {new Date(note.revisit_at).toLocaleDateString(undefined, DUE_DATE)}
            </span>
          )}
        </p>

        {note.tags.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {note.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-md bg-accent-soft px-1.5 py-0.5 text-xs font-medium text-accent-ink"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {preview ? (
          <p className="notes-file-card__preview mt-2 text-xs leading-relaxed text-muted">
            {preview}
          </p>
        ) : (
          <p className="mt-2 text-xs italic text-muted">No content yet</p>
        )}
      </NavLink>

      {showTrash && (
        <div className="mt-1 mb-2 flex gap-2 px-1">
          <button
            type="button"
            onClick={async () => {
              try {
                await onRestore(note.id);
              } catch (err) {
                onWriteError(errorMessage(err));
              }
            }}
            className="text-xs font-medium text-accent-ink hover:text-accent"
          >
            Restore
          </button>
          <button
            type="button"
            onClick={async () => {
              if (!confirm("Delete forever?")) return;
              try {
                await onPurge(note.id);
                if (active) navigate("/notes");
              } catch (err) {
                onWriteError(errorMessage(err));
              }
            }}
            className="text-xs font-medium text-danger hover:text-danger"
          >
            Delete forever
          </button>
        </div>
      )}
    </div>
  );
});

