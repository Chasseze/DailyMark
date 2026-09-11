import { useEffect, useMemo, useRef, useState } from "react";
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
  const open = () => {
    setQuery("");
    setError("");
    dialog.current?.showModal();
  };
  const go = (to: string) => {
    dialog.current?.close();
    navigate(to);
  };
  const q = query.trim().toLowerCase();
  const places = useMemo(
    () => NAV_ITEMS.filter((n) => n.label.toLowerCase().includes(q)),
    [q],
  );
  const hits = useMemo(
    () =>
      notes
        .filter((n) => (n.title + " " + n.preview).toLowerCase().includes(q))
        .slice(0, 30),
    [notes, q],
  );
  return (
    <>
      <button type="button" onClick={open} className="cmdk-trigger">
        <svg
          viewBox="0 0 24 24"
          className="h-4 w-4 shrink-0"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="6.5" />
          <path strokeLinecap="round" d="m16.5 16.5 3 3" />
        </svg>
        <span className="sm:hidden">Search</span>
        <span className="hidden sm:inline">Search &amp; commands</span>
        <kbd className="cmdk-trigger__kbd">⌘K</kbd>
      </button>
      <dialog ref={dialog} aria-label="Search and commands" className="cmdk">
        <div className="cmdk__bar">
          <svg
            viewBox="0 0 24 24"
            className="h-4 w-4 shrink-0 text-muted"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="6.5" />
            <path strokeLinecap="round" d="m16.5 16.5 3 3" />
          </svg>
          <input
            aria-label="Find notes or commands"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find notes or commands…"
            className="cmdk__input"
          />
          <button
            type="button"
            onClick={() => dialog.current?.close()}
            className="cmdk__close"
          >
            Close
          </button>
        </div>
        {error && (
          <p role="alert" className="cmdk__error">
            {error}
          </p>
        )}
        <div className="cmdk__results">
          <p className="cmdk__group">Actions</p>
          <button
            type="button"
            disabled={busy}
            className="cmdk__row"
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
            <span className="cmdk__row-title">New note</span>
            <span className="cmdk__row-meta">Blank page</span>
          </button>

          {places.length > 0 && <p className="cmdk__group">Go to</p>}
          {places.map((n) => (
            <button
              type="button"
              className="cmdk__row"
              key={n.to}
              onClick={() => go(n.to)}
            >
              <span className="cmdk__row-title">{n.label}</span>
              <span className="cmdk__row-meta">{n.to}</span>
            </button>
          ))}

          {hits.length > 0 && <p className="cmdk__group">Notes</p>}
          {hits.map((n) => (
            <button
              type="button"
              className="cmdk__row"
              key={n.id}
              onClick={() => go(`/notes/${n.id}`)}
            >
              <span className="cmdk__row-title">{n.title || "Untitled"}</span>
              {n.preview && (
                <span className="cmdk__row-meta">{n.preview.slice(0, 80)}</span>
              )}
            </button>
          ))}

          {q && places.length === 0 && hits.length === 0 && (
            <p className="cmdk__empty">Nothing matched “{query.trim()}”.</p>
          )}
        </div>
      </dialog>
    </>
  );
}
