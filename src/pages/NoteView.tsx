import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useNotes } from "../context/notes-context";
import Markdown from "../components/Markdown";
import ReadAloudButton from "../components/ReadAloudButton";
import { toggleTaskAtLine } from "../lib/markdown-edit";
import { errorMessage } from "../lib/supabase";
import type { Note } from "../lib/types";

export default function NoteView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { notes, loading, ensureNote } = useNotes();
  const note = notes.find((n) => n.id === id);
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
      <div className="flex h-full min-h-[16rem] flex-col items-center justify-center px-4">
        <p className="text-slate-400">{hydrateError ?? "Note not found"}</p>
        <button onClick={() => navigate("/notes")} className="mt-4 text-sm text-amber-400">
          ← Back to notes
        </button>
      </div>
    );
  }

  return <NoteArticle note={note} />;
}

function NoteArticle({ note }: { note: Note }) {
  const navigate = useNavigate();
  const { deleteNote, togglePin, updateNote } = useNotes();
  const [taskError, setTaskError] = useState<string | null>(null);

  const date = new Date(note.updated_at).toLocaleDateString(undefined, {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  const spoken = [note.title, note.content].filter((part) => part.trim()).join("\n\n");

  const handleToggleTask = async (line: number) => {
    const next = toggleTaskAtLine(note.content, line);
    if (next === null) return;
    setTaskError(null);
    try {
      await updateNote(note.id, { content: next });
    } catch (err) {
      setTaskError(errorMessage(err));
    }
  };

  const iconBtn =
    "rounded-xl p-2 text-slate-400 transition-colors hover:bg-white/5 hover:text-white light:hover:bg-slate-100 light:hover:text-slate-900";

  return (
    <div className="flex h-full flex-col px-4 py-4 md:px-6 md:py-5">
      <div className="mb-4 flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => navigate("/notes")}
          className={iconBtn + " md:hidden"}
          aria-label="Back to note list"
        >
          <BackIcon />
        </button>
        <div className="flex-1" />
        <ReadAloudButton
          request={{ id: "note:" + note.id, label: note.title || "Untitled", text: spoken }}
        />
        <button
          type="button"
          onClick={() => void togglePin(note.id)}
          className={
            iconBtn + " " + (note.is_pinned ? "text-amber-400 hover:text-amber-300" : "")
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
            if (!confirm("Delete this note?")) return;
            await deleteNote(note.id);
            navigate("/notes");
          }}
          className={iconBtn + " hover:bg-red-500/10 hover:text-red-400"}
          aria-label="Delete note"
          title="Delete"
        >
          <TrashIcon />
        </button>
      </div>

      {taskError && (
        <div className="mb-3 rounded-xl bg-red-500/10 p-3 text-xs text-red-400">{taskError}</div>
      )}

      <article className="glass min-h-0 flex-1 overflow-y-auto rounded-2xl p-5 md:p-7">
        <h1 className="note-title mb-1 text-2xl text-white light:text-slate-900">
          {note.title || "Untitled"}
        </h1>
        <p className="mb-4 text-xs text-slate-500">{date}</p>

        {note.tags.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-1.5">
            {note.tags.map((tag) => (
              <span key={tag} className="rounded-md bg-amber-500/10 px-2.5 py-0.5 text-xs text-amber-400">
                {tag}
              </span>
            ))}
          </div>
        )}

        <div className="mt-2 text-sm leading-relaxed text-slate-300 light:text-slate-700">
          {note.content.trim() ? (
            <Markdown onToggleTask={(line) => void handleToggleTask(line)}>{note.content}</Markdown>
          ) : (
            <p className="italic text-slate-500">This note is empty. Tap edit to add content.</p>
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
