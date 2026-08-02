import { useEffect, useMemo, useState } from "react";
import { NavLink, useNavigate, useParams } from "react-router-dom";
import { useNotes } from "../context/notes-context";
import { useStreak } from "../hooks/useStreak";
import { shareUrl } from "../lib/share";
import { errorMessage } from "../lib/supabase";
import type { Note } from "../lib/types";

const COLORS = ["#f59e0b", "#3b82f6", "#ef4444", "#10b981", "#8b5cf6", "#ec4899"];

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

function getSpeechRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

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
    inboxId,
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
  const [ftsHits, setFtsHits] = useState<Note[] | null>(null);
  const [ftsBusy, setFtsBusy] = useState(false);
  const [showNewNotebook, setShowNewNotebook] = useState(false);
  const [newNbName, setNewNbName] = useState("");
  const [newNbColor, setNewNbColor] = useState(COLORS[0]);
  const [editingNb, setEditingNb] = useState<string | null>(null);
  const [editNbName, setEditNbName] = useState("");
  const [editNbColor, setEditNbColor] = useState(COLORS[0]);
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
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

  const handleVoiceCapture = () => {
    if (busy || listening || showTrash) return;
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      setWriteError("Voice capture is not supported in this browser.");
      return;
    }

    setWriteError(null);
    const recognition = new Ctor();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = navigator.language || "en-US";

    recognition.onresult = (event) => {
      const parts: string[] = [];
      for (let i = 0; i < event.results.length; i++) {
        const alt = event.results[i]?.[0]?.transcript;
        if (alt) parts.push(alt);
      }
      const transcript = parts.join(" ").trim();
      if (!transcript) {
        setWriteError("No speech detected. Try again.");
        setListening(false);
        return;
      }

      setBusy(true);
      void (async () => {
        try {
          const note = await addNote({
            title: "Voice note",
            content: transcript,
            notebook_id: inboxId,
            is_pinned: false,
            tags: ["voice"],
          });
          navigate("/notes/" + note.id + "/edit");
        } catch (err) {
          setWriteError(errorMessage(err));
        } finally {
          setBusy(false);
          setListening(false);
        }
      })();
    };

    recognition.onerror = (event) => {
      setListening(false);
      setWriteError(event.error ? `Voice capture failed: ${event.error}` : "Voice capture failed.");
    };

    recognition.onend = () => {
      setListening(false);
    };

    try {
      setListening(true);
      recognition.start();
    } catch (err) {
      setListening(false);
      setWriteError(errorMessage(err));
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
            <h1 className="page-title text-white light:text-slate-900">My notes</h1>
            <p className="mt-2 text-sm text-slate-400 light:text-slate-500">
              {loading
                ? "Loading…"
                : showTrash
                  ? `${filtered.length} in trash`
                  : showDue
                    ? `${filtered.length} due`
                    : `${filtered.length} note${filtered.length !== 1 ? "s" : ""}`}
              {!loading && streak != null && !showTrash && (
                <span className="ml-2 text-amber-500/80">· {streak} day streak</span>
              )}
            </p>
          </div>
          {!showTrash && (
            <div className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                onClick={handleVoiceCapture}
                disabled={busy || listening}
                className={
                  "rounded-xl p-2 transition-colors disabled:opacity-50 " +
                  (listening
                    ? "bg-amber-500/20 text-amber-400"
                    : "bg-white/5 text-slate-400 hover:bg-white/8 hover:text-slate-200 light:bg-slate-100 light:text-slate-600")
                }
                aria-label={listening ? "Listening…" : "Voice note"}
                title={listening ? "Listening…" : "Voice note"}
              >
                <MicIcon />
              </button>
              <button
                type="button"
                onClick={() => void handleQuickNote()}
                disabled={busy}
                className="rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 px-3.5 py-2 text-sm font-semibold text-black transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
              >
                New
              </button>
            </div>
          )}
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
            placeholder={showTrash ? "Search trash…" : "Search notes…"}
            className="w-full rounded-xl border border-white/5 bg-white/5 py-2.5 pl-10 pr-4 text-sm text-white placeholder-slate-500 focus:border-amber-500/35 focus:outline-none light:border-slate-200 light:bg-white/70 light:text-slate-900"
          />
          {ftsBusy && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-500">
              …
            </span>
          )}
        </div>

        <div className="mb-3 flex items-center gap-1.5 overflow-x-auto pb-0.5">
          <button
            type="button"
            onClick={() => {
              setShowTrash(false);
              setShowDue(false);
              setActiveNotebook(null);
            }}
            className={
              "shrink-0 rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-colors " +
              (!showTrash && !showDue && !activeNotebook
                ? "bg-amber-500/20 text-amber-400"
                : "text-slate-400 hover:bg-white/5 hover:text-slate-200 light:hover:bg-slate-100")
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
                "shrink-0 rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-colors " +
                (!showTrash && showDue
                  ? "bg-amber-500/20 text-amber-400"
                  : "text-slate-400 hover:bg-white/5 hover:text-slate-200 light:hover:bg-slate-100")
              }
            >
              Due{dueNotes.length > 0 ? ` (${dueNotes.length})` : ""}
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
                "shrink-0 rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-colors " +
                (!showTrash && !showDue && activeNotebook === nb.id
                  ? "bg-amber-500/20 text-amber-400"
                  : "text-slate-400 hover:bg-white/5 hover:text-slate-200 light:hover:bg-slate-100")
              }
              title="Double-click to rename"
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
            onClick={() => {
              setShowNewNotebook(!showNewNotebook);
              setEditingNb(null);
            }}
            className="shrink-0 rounded-lg px-2.5 py-1.5 text-[11px] text-slate-500 hover:bg-white/5 hover:text-slate-300"
          >
            +
          </button>
          <button
            type="button"
            onClick={() => {
              setShowTrash(true);
              setShowDue(false);
              setActiveNotebook(null);
              setActiveTag(null);
            }}
            className={
              "shrink-0 rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-colors " +
              (showTrash
                ? "bg-red-500/15 text-red-400"
                : "text-slate-500 hover:bg-white/5 hover:text-slate-300")
            }
          >
            Trash{trash.length > 0 ? ` (${trash.length})` : ""}
          </button>
        </div>

        {activeNotebook && !showTrash && !showDue && (
          <div className="mb-3 flex items-center gap-2">
            <button
              type="button"
              onClick={() => void handleShareNotebook()}
              disabled={busy}
              className="rounded-lg px-2.5 py-1 text-[11px] font-medium text-slate-400 transition-colors hover:bg-white/5 hover:text-slate-200 disabled:opacity-50 light:hover:bg-slate-100"
            >
              Share
            </button>
            {shareStatus && (
              <span className="text-[11px] text-amber-400/90">{shareStatus}</span>
            )}
          </div>
        )}

        {!showTrash && allTags.length > 0 && (
          <div className="mb-3 flex items-center gap-1.5 overflow-x-auto pb-0.5">
            <button
              type="button"
              onClick={() => setActiveTag(null)}
              className={
                "shrink-0 rounded-md px-2 py-1 text-[10px] font-medium " +
                (!activeTag
                  ? "bg-white/10 text-slate-200 light:bg-slate-200 light:text-slate-700"
                  : "text-slate-500 hover:text-slate-300")
              }
            >
              Any tag
            </button>
            {allTags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => setActiveTag(activeTag === tag ? null : tag)}
                className={
                  "shrink-0 rounded-md px-2 py-1 text-[10px] font-medium " +
                  (activeTag === tag
                    ? "bg-amber-500/20 text-amber-400"
                    : "text-slate-500 hover:bg-white/5 hover:text-slate-300")
                }
              >
                #{tag}
              </button>
            ))}
          </div>
        )}

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

        {editingNb && (
          <div className="mb-3 space-y-2 rounded-2xl bg-black/20 p-3 light:bg-white/60">
            <input
              type="text"
              value={editNbName}
              onChange={(e) => setEditNbName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void handleSaveNotebook()}
              className="w-full rounded-lg border border-white/5 bg-black/20 px-3 py-2 text-sm text-white focus:outline-none light:border-slate-200 light:bg-white light:text-slate-900"
            />
            <div className="flex gap-1">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setEditNbColor(c)}
                  className={
                    "h-5 w-5 rounded-full border-2 transition-transform " +
                    (editNbColor === c ? "scale-110 border-white" : "border-transparent")
                  }
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void handleSaveNotebook()}
                className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-black"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => setEditingNb(null)}
                className="rounded-lg bg-white/10 px-3 py-1.5 text-xs text-slate-300 light:bg-slate-200 light:text-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleDeleteNotebook(editingNb, editNbName)}
                className="rounded-lg px-3 py-1.5 text-xs text-red-400"
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
            className="mb-3 w-full rounded-lg bg-red-500/10 px-3 py-2 text-xs font-medium text-red-400 hover:bg-red-500/15"
          >
            Empty trash
          </button>
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
                className="mt-3 text-sm font-medium text-amber-400 hover:text-amber-300 disabled:opacity-50"
              >
                Create a note
              </button>
            )}
          </div>
        ) : (
          <nav className="notes-file-list" aria-label={showTrash ? "Trash" : showDue ? "Due" : "Notes"}>
            {filtered.map((note) => {
              const active = selectedId === note.id;
              const preview = openingLines(note.preview);
              const date = new Date(note.updated_at).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
              });

              return (
                <div key={note.id} className="relative">
                  <NavLink
                    to={"/notes/" + note.id}
                    className="notes-file-card"
                    data-active={active ? "true" : "false"}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="min-w-0 flex-1 truncate text-[0.95rem] font-semibold tracking-tight text-white light:text-slate-900">
                        {note.title || "Untitled"}
                      </h3>
                      {note.is_pinned && !showTrash && (
                        <span className="mt-1 shrink-0 text-[0.55rem] text-amber-400" aria-label="Pinned">
                          ●
                        </span>
                      )}
                    </div>

                    <p className="mt-1 text-[10px] font-medium uppercase tracking-[0.08em] text-slate-500">
                      {date}
                      {showDue && note.revisit_at && (
                        <span className="ml-1.5 normal-case tracking-normal text-amber-500/70">
                          · due{" "}
                          {new Date(note.revisit_at).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                      )}
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

                  {showTrash && (
                    <div className="mt-1 mb-2 flex gap-2 px-1">
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await restoreNote(note.id);
                          } catch (err) {
                            setWriteError(errorMessage(err));
                          }
                        }}
                        className="text-[11px] font-medium text-amber-400 hover:text-amber-300"
                      >
                        Restore
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          if (!confirm("Delete forever?")) return;
                          try {
                            await purgeNote(note.id);
                            if (selectedId === note.id) navigate("/notes");
                          } catch (err) {
                            setWriteError(errorMessage(err));
                          }
                        }}
                        className="text-[11px] font-medium text-red-400 hover:text-red-300"
                      >
                        Delete forever
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
        )}
      </div>
    </aside>
  );
}

function MicIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
      <rect x="9" y="3.5" width="6" height="11" rx="3" />
      <path strokeLinecap="round" d="M6.5 11.5a5.5 5.5 0 0 0 11 0M12 17v3.5" />
    </svg>
  );
}
