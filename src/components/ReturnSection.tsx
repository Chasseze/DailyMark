import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import ReadAloudButton from "./ReadAloudButton";
import { useNotes } from "../context/notes-context";
import {
  RETURN_MAX,
  appendReturnLine,
  emptyReturnSession,
  ensureReturnQueue,
  nextDeferral,
  loadReturnSessionSynced,
  markReturnDone,
  reasonForQueued,
  saveReturnSession,
} from "../lib/return-queue";
import { dayKey } from "../lib/rhythm";
import { errorMessage } from "../lib/supabase";
import type { Note } from "../lib/types";

/**
 * Evening half of Daily: up to three marks — due notes first, then one that
 * has sat. Keep clears the date and the ladder; deferring walks one rung up
 * the spacing ladder, so a note you keep pushing away comes back less often.
 * The day's queue
 * is frozen so this cannot become a second inbox. The freeze and the marks
 * sync through Supabase so another browser sees the same evening.
 */
export default function ReturnSection() {
  const { notes, loading, patchNote, ensureNote } = useNotes();
  const today = useMemo(() => dayKey(new Date()), []);
  const [session, setSession] = useState(() => emptyReturnSession(today));
  const [hydrated, setHydrated] = useState(false);
  const [jot, setJot] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void loadReturnSessionSynced(today).then((remote) => {
      if (!active) return;
      setSession(remote);
      setHydrated(true);
    });
    return () => {
      active = false;
    };
  }, [today]);

  const pinned = useMemo(
    () => (hydrated ? ensureReturnQueue(session, notes) : session),
    [hydrated, session, notes]
  );
  if (pinned !== session) {
    setSession(pinned);
  }

  useEffect(() => {
    if (!hydrated) return;
    if (loading && pinned.queuedIds.length === 0 && pinned.doneIds.length === 0) return;
    saveReturnSession(pinned);
  }, [hydrated, loading, pinned]);

  const remaining = useMemo(() => {
    return pinned.queuedIds
      .filter((id) => !pinned.doneIds.includes(id))
      .map((id) => notes.find((note) => note.id === id))
      .filter((note): note is Note => Boolean(note));
  }, [pinned, notes]);

  const current = remaining[0];
  const finished = pinned.doneIds.length >= RETURN_MAX ||
    (pinned.queuedIds.length > 0 && remaining.length === 0);
  const step = Math.min(pinned.doneIds.length + (current ? 1 : 0), RETURN_MAX);
  const total = Math.min(Math.max(pinned.queuedIds.length, pinned.doneIds.length), RETURN_MAX);

  useEffect(() => {
    if (!current) return;
    void ensureNote(current.id);
  }, [current, ensureNote]);

  const spoken = current
    ? [current.title, current.content.trim() || current.preview]
        .filter((part) => part.trim())
        .join("\n\n")
    : "";

  // The rung this note is on decides both the button's copy and the date it
  // writes, so they can never drift apart.
  const defer = nextDeferral(current?.revisit_step);

  const resolve = async (patch: { revisit_at: string | null; revisit_step: number }) => {
    if (!current || busy) return;
    setBusy(true);
    setError(null);
    try {
      await patchNote(current.id, patch);
      setSession((prev) => markReturnDone(prev, current.id));
      setJot("");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const addLine = async () => {
    if (!current || busy || !jot.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const row = await ensureNote(current.id);
      if (!row) throw new Error("Note not found");
      await patchNote(current.id, { content: appendReturnLine(row.content, jot) });
      setJot("");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="glass rounded-3xl p-6">
      <div className="flex items-center justify-between gap-2">
        <span className="inline-block rounded-lg bg-accent-soft px-3 py-1 text-xs font-medium uppercase tracking-wider text-accent-ink">
          Return
        </span>
        {total > 0 && (
          <span className="text-xs text-muted">
            {finished ? `${pinned.doneIds.length} / ${total}` : `${step} / ${total}`}
          </span>
        )}
      </div>

      {loading || !hydrated ? (
        <div className="mt-4 space-y-2">
          <div className="skeleton h-6 w-40" />
          <div className="skeleton h-20" />
        </div>
      ) : finished ? (
        <div className="mt-4">
          <p className="note-title text-xl text-ink">
            {pinned.doneIds.length >= RETURN_MAX
              ? "Three marks. That is enough for today."
              : "That is enough for today."}
          </p>
          <p className="mt-2 text-sm text-muted">
            Anything still due lives under Due in Notes. Come back tomorrow.
          </p>
        </div>
      ) : !current ? (
        <div className="mt-4">
          <p className="note-title text-xl text-ink">Nothing to return to yet</p>
          <p className="mt-2 text-sm text-muted">
            Write a few notes and set a revisit date — or wait until something has sat a while.
          </p>
        </div>
      ) : (
        <div className="mt-4">
          <p className="text-xs font-medium uppercase tracking-wider text-muted">
            {reasonForQueued(pinned, current.id, current) === "due" ? "Due" : "Sat a while"}
          </p>
          <h2 className="note-title mt-2 text-xl leading-snug text-ink">
            {current.title.trim() || "Untitled"}
          </h2>
          <p className="mt-2 line-clamp-4 text-sm leading-relaxed text-ink-soft">
            {(current.content.trim() || current.preview).trim() || "No content yet"}
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <ReadAloudButton
              compact
              request={{
                id: "return:" + current.id,
                label: current.title.trim() || "Untitled",
                text: spoken,
              }}
            />
            <Link
              to={"/notes/" + current.id}
              className="text-sm font-medium text-accent-ink hover:text-accent"
            >
              Open →
            </Link>
          </div>

          <form
            className="mt-4"
            onSubmit={(event) => {
              event.preventDefault();
              void addLine();
            }}
          >
            <label htmlFor="return-jot" className="sr-only">
              One line on this note
            </label>
            <div className="flex gap-2">
              <input
                id="return-jot"
                type="text"
                value={jot}
                onChange={(event) => setJot(event.target.value)}
                placeholder="One line, then Keep or push it out…"
                className="min-w-0 flex-1 rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink placeholder-faint focus:border-accent/50 focus:outline-none"
              />
              <button
                type="submit"
                disabled={busy || !jot.trim()}
                className="shrink-0 rounded-xl bg-surface-2 px-3 py-2 text-xs font-semibold text-ink-soft disabled:opacity-50"
              >
                Add
              </button>
            </div>
          </form>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => void resolve({ revisit_at: null, revisit_step: 0 })}
              disabled={busy}
              className="flex-1 rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-on-accent disabled:opacity-50"
            >
              Keep
            </button>
            <button
              type="button"
              onClick={() =>
                void resolve({
                  revisit_at: defer.revisit_at,
                  revisit_step: defer.revisit_step,
                })
              }
              disabled={busy}
              className="flex-1 rounded-xl border border-line bg-surface px-4 py-3 text-sm font-medium text-ink-soft transition-colors hover:bg-surface-2 disabled:opacity-50"
            >
              {defer.label}
            </button>
          </div>
        </div>
      )}

      {error && <p className="mt-3 text-xs text-danger">{error}</p>}
    </section>
  );
}
