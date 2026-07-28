import type { Note } from "../lib/types";
import { useNotes } from "../context/notes-context";

interface Props {
  note: Note;
  onClick: () => void;
}

export default function NoteCard({ note, onClick }: Props) {
  const { togglePin, deleteNote } = useNotes();

  const preview = note.content
    .replace(/[#*`>[\]!-]/g, "")
    .slice(0, 120)
    .trim();

  const date = new Date(note.updated_at).toLocaleDateString(undefined, {
    month: "short", day: "numeric",
  });

  return (
    <div
      onClick={onClick}
      className="group glass rounded-2xl p-4 cursor-pointer transition-all duration-200 hover:scale-[1.01] hover:border-amber-500/20 active:scale-[0.99]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold text-white light:text-slate-900">
            {note.title || "Untitled"}
          </h3>
          <p className="mt-1 line-clamp-2 text-xs text-slate-400 light:text-slate-500">
            {preview || "No content yet"}
          </p>
          <div className="mt-2 flex items-center gap-2">
            <span className="text-[10px] text-slate-500">{date}</span>
            {note.tags.map((tag) => (
              <span key={tag} className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-400">
                {tag}
              </span>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            onClick={(e) => { e.stopPropagation(); void togglePin(note.id); }}
            className={
              "rounded-lg p-1 text-sm transition-colors hover:bg-white/10 " +
              (note.is_pinned ? "text-amber-400" : "text-slate-500")
            }
            title={note.is_pinned ? "Unpin" : "Pin"}
          >
            📌
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); if (confirm("Delete this note?")) void deleteNote(note.id); }}
            className="rounded-lg p-1 text-sm text-slate-500 transition-colors hover:bg-red-500/10 hover:text-red-400"
            title="Delete"
          >
            🗑️
          </button>
        </div>
      </div>
    </div>
  );
}
