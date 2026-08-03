import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useFocus } from "../context/focus-context";
import { useNotes } from "../context/notes-context";
import Markdown from "../components/Markdown";
import ReadAloudButton from "../components/ReadAloudButton";
import { toggleTaskAtLine } from "../lib/markdown-edit";
import { downloadText, noteToMarkdown, safeFilename } from "../lib/notes-io";
import { shareUrl } from "../lib/share";
import { errorMessage } from "../lib/supabase";
import type { Note } from "../lib/types";

export default function NoteView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
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
      <div className="flex h-full min-h-[16rem] flex-col items-center justify-center px-4">
        <p className="text-muted">{hydrateError ?? "Note not found"}</p>
        <button onClick={() => navigate("/notes")} className="mt-4 text-sm text-accent-ink">
          ← Back to notes
        </button>
      </div>
    );
  }

  return <NoteArticle note={note} />;
}

function NoteArticle({ note }: { note: Note }) {
  const navigate = useNavigate();
  const { notes, deleteNote, restoreNote, purgeNote, togglePin, updateNote, createNoteShare } =
    useNotes();
  const { focus, toggleFocus } = useFocus();
  const [taskError, setTaskError] = useState<string | null>(null);
  const [shareStatus, setShareStatus] = useState<string | null>(null);
  const trashed = Boolean(note.deleted_at);

  const date = new Date(note.updated_at).toLocaleDateString(undefined, {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  const revisitLabel = note.revisit_at
    ? new Date(note.revisit_at).toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;

  const spoken = [note.title, note.content].filter((part) => part.trim()).join("\n\n");

  const handleToggleTask = async (line: number) => {
    if (trashed) return;
    const next = toggleTaskAtLine(note.content, line);
    if (next === null) return;
    setTaskError(null);
    try {
      await updateNote(note.id, { content: next });
    } catch (err) {
      setTaskError(errorMessage(err));
    }
  };

  const handleExport = async () => {
    let body = note;
    if (!note.bodyLoaded) {
      // ensureNote is already called by parent; content should be loaded.
      body = note;
    }
    downloadText(safeFilename(body.title), noteToMarkdown(body));
  };

  const handleShare = async () => {
    setShareStatus(null);
    try {
      const token = await createNoteShare(note.id);
      await navigator.clipboard.writeText(shareUrl(token));
      setShareStatus("Link copied");
      window.setTimeout(() => setShareStatus(null), 2000);
    } catch (err) {
      setShareStatus(errorMessage(err));
      window.setTimeout(() => setShareStatus(null), 3500);
    }
  };

  const iconBtn =
    "rounded-xl p-2 text-muted transition-colors hover:bg-surface-2 hover:text-ink";

  return (
    <div className="note-view animate-in px-4 pt-6">
      <div className="mb-4 flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => navigate("/notes")}
          className={iconBtn}
          aria-label="Back to note list"
        >
          <BackIcon />
        </button>
        <div className="min-w-0 flex-1" />
        {shareStatus && (
          <span className="mr-1 text-xs font-medium text-accent-ink">{shareStatus}</span>
        )}
        <button
          type="button"
          onClick={() => toggleFocus()}
          className={iconBtn + " " + (focus ? "text-accent-ink hover:text-accent" : "")}
          aria-label={focus ? "Exit focus mode" : "Enter focus mode"}
          title={focus ? "Exit focus" : "Focus"}
        >
          <FocusIcon />
        </button>
        <ReadAloudButton
          request={{ id: "note:" + note.id, label: note.title || "Untitled", text: spoken }}
        />
        <button
          type="button"
          onClick={() => void handleExport()}
          className={iconBtn}
          aria-label="Export Markdown"
          title="Export Markdown"
        >
          <ExportIcon />
        </button>
        {!trashed && (
          <>
            <button
              type="button"
              onClick={() => void handleShare()}
              className={iconBtn}
              aria-label="Copy share link"
              title="Share"
            >
              <ShareIcon />
            </button>
            <button
              type="button"
              onClick={() => void togglePin(note.id)}
              className={
                iconBtn + " " + (note.is_pinned ? "text-accent-ink hover:text-accent" : "")
              }
              aria-label={note.is_pinned ? "Unpin note" : "Pin note"}
              title={note.is_pinned ? "Unpin" : "Pin"}
            >
              <PinIcon filled={note.is_pinned} />
            </button>
            <button
              type="button"
              onClick={() => navigate("/notes/" + note.id + "/edit")}
              className={iconBtn}
              aria-label="Edit note"
              title="Edit"
            >
              <EditIcon />
            </button>
            <button
              type="button"
              onClick={async () => {
                if (!confirm("Move this note to Trash?")) return;
                await deleteNote(note.id);
                navigate("/notes");
              }}
              className={iconBtn + " hover:bg-danger-soft hover:text-danger"}
              aria-label="Move to trash"
              title="Move to trash"
            >
              <TrashIcon />
            </button>
          </>
        )}
        {trashed && (
          <>
            <button
              type="button"
              onClick={async () => {
                await restoreNote(note.id);
              }}
              className="rounded-xl bg-accent-soft px-3 py-2 text-xs font-semibold text-accent-ink"
            >
              Restore
            </button>
            <button
              type="button"
              onClick={async () => {
                if (!confirm("Delete forever?")) return;
                await purgeNote(note.id);
                navigate("/notes");
              }}
              className={iconBtn + " hover:bg-danger-soft hover:text-danger"}
              aria-label="Delete forever"
              title="Delete forever"
            >
              <TrashIcon />
            </button>
          </>
        )}
      </div>

      {trashed && (
        <div className="mb-3 rounded-xl bg-danger-soft px-3 py-2 text-xs text-danger">
          This note is in Trash.
        </div>
      )}

      {taskError && (
        <div className="mb-3 rounded-xl bg-danger-soft p-3 text-xs text-danger">{taskError}</div>
      )}

      <article className="note-view__article glass rounded-2xl p-5">
        <h1 className="note-title mb-1 break-words text-2xl text-ink">
          {note.title || "Untitled"}
        </h1>
        <p className={"text-xs text-muted " + (revisitLabel ? "mb-1" : "mb-4")}>{date}</p>
        {revisitLabel && (
          <p className="mb-4 text-xs text-accent-ink">Revisit by {revisitLabel}</p>
        )}

        {note.tags.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-1.5">
            {note.tags.map((tag) => (
              <span key={tag} className="rounded-md bg-surface-2 px-2.5 py-0.5 text-xs text-muted">
                {tag}
              </span>
            ))}
          </div>
        )}

        <div className="mt-2 min-w-0 text-sm leading-relaxed text-ink-soft">
          {note.content.trim() ? (
            <Markdown
              notes={notes}
              onToggleTask={(line) => void handleToggleTask(line)}
            >
              {note.content}
            </Markdown>
          ) : (
            <p className="italic text-muted">This note is empty. Tap edit to add content.</p>
          )}
        </div>
      </article>
    </div>
  );
}

function BackIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.5 5.5 9 12l6.5 6.5" />
    </svg>
  );
}

function PinIcon({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 4.5 9.5 10l-2 5.5L13 13.5 18.5 8M9.5 10 5 14.5" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="m14.5 5.5 4 4M5 19l1.2-4.4L15.8 5 20 9.2 10.4 18.8 6 20z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 7h14M9.5 7V5.5A1.5 1.5 0 0 1 11 4h2a1.5 1.5 0 0 1 1.5 1.5V7m-6 0 0.6 11.2A1.5 1.5 0 0 0 10.6 20h2.8a1.5 1.5 0 0 0 1.5-1.8L15.5 7" />
    </svg>
  );
}

function ExportIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v10m0 0 3.5-3.5M12 14l-3.5-3.5M5 18h14" />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
      <circle cx="18" cy="5" r="2.25" />
      <circle cx="6" cy="12" r="2.25" />
      <circle cx="18" cy="19" r="2.25" />
      <path strokeLinecap="round" d="M8.2 10.8 15.8 6.4M8.2 13.2l7.6 4.4" />
    </svg>
  );
}

function FocusIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
      <circle cx="12" cy="12" r="3.25" />
      <path strokeLinecap="round" d="M12 3.5v2.5M12 18v2.5M3.5 12h2.5M18 12h2.5" />
    </svg>
  );
}
