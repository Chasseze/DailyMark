import { useState } from "react";
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
  const { notes, loading } = useNotes();
  const note = notes.find((n) => n.id === id);

  // Without this, opening a note link directly flashes "Note not found"
  // for as long as the initial fetch takes.
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-slate-500">Loading…</p>
      </div>
    );
  }

  if (!note) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-4">
        <span className="text-4xl">🔍</span>
        <p className="mt-3 text-slate-400">Note not found</p>
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

  // Reading the title first makes the spoken version match the page.
  const spoken = [note.title, note.content].filter((part) => part.trim()).join("\n\n");

  const handleToggleTask = async (line: number) => {
    const next = toggleTaskAtLine(note.content, line);
    if (next === null) return;
    setTaskError(null);
    try {
      await updateNote(note.id, { content: next });
    } catch (err) {
      // Otherwise the checkbox just springs back with no explanation.
      setTaskError(errorMessage(err));
    }
  };

  return (
    <div className="animate-in px-4 pt-4">
      <div className="mb-4 flex items-center gap-2">
        <button onClick={() => navigate("/notes")}
          className="rounded-xl p-2 text-slate-400 hover:bg-slate-800/50 hover:text-white light:hover:bg-slate-100 light:hover:text-slate-900">
          ←
        </button>
        <div className="flex-1" />
        <ReadAloudButton
          request={{ id: "note:" + note.id, label: note.title || "Untitled", text: spoken }}
        />
        <button onClick={() => void togglePin(note.id)}
          className={
            "rounded-xl p-2 text-sm transition-colors hover:bg-white/10 " +
            (note.is_pinned ? "text-amber-400" : "text-slate-500")
          }>
          📌
        </button>
        <button onClick={() => navigate("/notes/" + note.id + "/edit")}
          className="rounded-xl p-2 text-sm text-slate-400 hover:bg-slate-800/50 hover:text-white light:hover:bg-slate-100">
          ✏️
        </button>
        <button onClick={async () => {
            if (!confirm("Delete this note?")) return;
            // Navigate only after the delete lands, so a failure leaves the
            // note on screen instead of silently pretending it worked.
            await deleteNote(note.id);
            navigate("/notes");
          }}
          className="rounded-xl p-2 text-sm text-slate-500 hover:bg-red-500/10 hover:text-red-400">
          🗑️
        </button>
      </div>

      {taskError && (
        <div className="mb-3 rounded-xl bg-red-500/10 p-3 text-xs text-red-400">{taskError}</div>
      )}

      <article>
        <h1 className="note-title mb-1 text-2xl text-white light:text-slate-900">
          {note.title || "Untitled"}
        </h1>
        <p className="mb-4 text-xs text-slate-500">{date}</p>

        {note.tags.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-1.5">
            {note.tags.map((tag) => (
              <span key={tag} className="rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs text-amber-400">
                {tag}
              </span>
            ))}
          </div>
        )}

        <div className="mt-4 text-sm leading-relaxed text-slate-300 light:text-slate-700">
          {note.content.trim() ? (
            // Checkboxes stay live here: ticking one saves the note.
            <Markdown onToggleTask={(line) => void handleToggleTask(line)}>{note.content}</Markdown>
          ) : (
            <p className="italic text-slate-500">This note is empty. Tap edit to add content.</p>
          )}
        </div>
      </article>
    </div>
  );
}
