import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useNotes } from "../context/notes-context";
import { useDictation } from "../hooks/useDictation";
import { errorMessage } from "../lib/supabase";

interface Props {
  /** Notebook a typed note lands in; voice notes always go to Inbox. */
  notebookId?: string | null;
  /** Tags applied to a typed note (the active tag filter, on the notes list). */
  tags?: string[];
  /** Open the new note for editing. Off on the desk, where you keep reading. */
  openAfterCreate?: boolean;
}

/**
 * The fast path: type a line and it becomes a note, or dictate one.
 *
 * The first line becomes the title and the rest the body, so a jotted sentence
 * arrives as a titled note rather than an untitled blob.
 */
export default function CaptureBar({
  notebookId = null,
  tags = [],
  openAfterCreate = true,
}: Props) {
  const navigate = useNavigate();
  const { addNote, inboxId } = useNotes();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const create = async (
    body: string,
    opts: { title?: string; notebook: string | null; tags: string[]; open: boolean }
  ) => {
    setBusy(true);
    setError(null);
    try {
      const lines = body.trim().split("\n");
      const title = opts.title ?? lines[0].slice(0, 120);
      const content = opts.title ? body.trim() : lines.slice(1).join("\n").trim();
      const note = await addNote({
        title,
        content,
        notebook_id: opts.notebook,
        is_pinned: false,
        tags: opts.tags,
      });
      setText("");
      if (opts.open) {
        navigate("/notes/" + note.id + "/edit");
      } else {
        setSaved(title || "Untitled");
        window.setTimeout(() => setSaved(null), 2600);
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const dictation = useDictation({
    disabled: busy,
    onError: setError,
    onTranscript: (transcript) =>
      void create(transcript, {
        title: "Voice note",
        notebook: inboxId,
        tags: ["voice"],
        open: openAfterCreate,
      }),
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    // An empty bar still means "new note" — open a blank one to write in.
    if (!text.trim()) {
      void create("", { title: "", notebook: notebookId, tags, open: true });
      return;
    }
    void create(text, { notebook: notebookId, tags, open: openAfterCreate });
  };

  return (
    <div>
      <form
        onSubmit={submit}
        className="glass flex items-center gap-2 rounded-2xl p-1.5 pl-4 transition-colors focus-within:border-accent/50"
      >
        <PenIcon />
        <label htmlFor="capture-input" className="sr-only">
          Jot a note
        </label>
        <input
          id="capture-input"
          type="text"
          value={dictation.listening ? dictation.draft : text}
          onChange={(event) => setText(event.target.value)}
          readOnly={dictation.listening}
          placeholder={dictation.listening ? "Listening…" : "Jot something down…"}
          className="min-w-0 flex-1 bg-transparent py-2.5 text-sm text-ink placeholder-faint focus:outline-none"
        />
        <button
          type="button"
          onClick={dictation.toggle}
          disabled={busy}
          aria-pressed={dictation.listening}
          aria-label={dictation.listening ? "Stop listening and save" : "Dictate a note"}
          title={dictation.listening ? "Tap to stop and save" : "Dictate a note"}
          className={
            "shrink-0 rounded-xl border p-2.5 transition-colors disabled:opacity-50 " +
            (dictation.listening
              ? "border-accent/50 bg-accent-soft text-accent-ink ring-2 ring-accent/40"
              : "border-line text-accent-ink hover:bg-surface-2 hover:text-accent")
          }
        >
          <MicIcon />
        </button>
        <button
          type="submit"
          disabled={busy}
          className="btn-primary shrink-0 rounded-xl px-4 py-2.5 text-sm"
        >
          {busy ? "Saving…" : "New note"}
        </button>
      </form>
      {saved && (
        <p className="mt-2 text-xs text-accent-ink">Saved “{saved}” to your notes.</p>
      )}
      {error && <p className="mt-2 text-xs text-danger">{error}</p>}
    </div>
  );
}

function PenIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5 shrink-0 text-muted"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 20h16M6 16.5 16.8 5.7a2 2 0 0 1 2.8 2.8L8.8 19.3 4.5 20l.7-4.3Z" />
    </svg>
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
