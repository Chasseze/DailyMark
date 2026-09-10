import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useNotes } from "../context/notes-context";
import { NAV_ITEMS } from "./nav-items";
export default function CommandPalette() {
  const dialog = useRef<HTMLDialogElement>(null);
  const [query, setQuery] = useState("");
  const navigate = useNavigate();
  const { notes, addNote } = useNotes();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        if (
          (e.target as HTMLElement)?.closest(
            "textarea,input,[contenteditable=true]",
          )
        )
          return;
        e.preventDefault();
        dialog.current?.showModal();
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  const go = (to: string) => {
    dialog.current?.close();
    navigate(to);
  };
  return (
    <>
      <button
        type="button"
        onClick={() => dialog.current?.showModal()}
        className="rounded-lg px-3 py-2 text-sm"
      >
        <span className="sm:hidden">Search</span><span className="hidden sm:inline">Search & commands · ⌘/Ctrl K</span>
      </button>
      <dialog
        ref={dialog}
        aria-label="Search and commands"
        className="w-full max-w-lg rounded-2xl border border-line bg-surface p-5 text-ink backdrop:bg-black/50"
      >
        <div className="flex gap-3">
          <input
            aria-label="Find notes or commands"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find notes or commands…"
            className="min-w-0 flex-1 bg-surface-2 p-3"
          />
          <button onClick={() => dialog.current?.close()}>Close</button>
        </div>
        {error && <p role="alert">{error}</p>}
        <div className="mt-4 max-h-96 space-y-2 overflow-auto">
          <button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                const n = await addNote({
                  title: "",
                  content: "",
                  tags: [],
                  notebook_id: null,
                  is_pinned: false,
                });
                go(`/notes/${n.id}/edit`);
              } catch {
                setError("Could not create a note. Try again.");
              } finally {
                setBusy(false);
              }
            }}
          >
            + New note
          </button>
          {NAV_ITEMS.filter((n) =>
            n.label.toLowerCase().includes(query.toLowerCase()),
          ).map((n) => (
            <button
              className="block w-full p-2 text-left"
              key={n.to}
              onClick={() => go(n.to)}
            >
              Go to {n.label}
            </button>
          ))}
          {notes
            .filter((n) =>
              (n.title + " " + n.preview)
                .toLowerCase()
                .includes(query.toLowerCase()),
            )
            .slice(0, 30)
            .map((n) => (
              <button
                className="block w-full p-2 text-left"
                key={n.id}
                onClick={() => go(`/notes/${n.id}`)}
              >
                {n.title || "Untitled"}
              </button>
            ))}
        </div>
      </dialog>
    </>
  );
}
