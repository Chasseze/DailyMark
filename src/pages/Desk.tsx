import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import CaptureBar from "../components/CaptureBar";
import { useNotes } from "../context/notes-context";
import { useStreak } from "../hooks/useStreak";
import { loadPinnedThought, type PinnedThought } from "../lib/pinned-thought";
import {
  RETURN_MAX,
  ensureReturnQueue,
  loadReturnSessionSynced,
} from "../lib/return-queue";
import { dayKey } from "../lib/rhythm";
import { markdownExcerpt } from "../lib/markdown";

const RECENT_COUNT = 4;

function greeting(now = new Date()): string {
  const h = now.getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

/**
 * The desk: where a session starts.
 *
 * Deliberately thin. Every card here except the capture bar is a doorway to a
 * page that owns the thing — Return and the quiz live on /daily, the streak's
 * history on /rhythm. The desk shows a count and gets out of the way, so there
 * is one place to change when any of them changes.
 */
export default function Desk() {
  const { notes, loading } = useNotes();
  const { streak } = useStreak();
  const today = useMemo(() => dayKey(new Date()), []);

  const [waiting, setWaiting] = useState<number | null>(null);
  const [thought, setThought] = useState<PinnedThought | null>(null);

  useEffect(() => {
    let active = true;
    void loadPinnedThought().then((row) => {
      if (active) setThought(row);
    });
    return () => {
      active = false;
    };
  }, []);

  // Same freeze the evening ritual uses, so the count and the page agree.
  useEffect(() => {
    if (loading) return;
    let active = true;
    void loadReturnSessionSynced(today).then((remote) => {
      // null means the read failed — leave the count blank rather than
      // showing a confident zero the account does not agree with.
      if (!active || !remote) return;
      const session = ensureReturnQueue(remote, notes);
      const left = session.queuedIds.filter((id) => !session.doneIds.includes(id)).length;
      setWaiting(Math.min(left, RETURN_MAX));
    });
    return () => {
      active = false;
    };
  }, [today, loading, notes]);

  const recent = useMemo(
    () =>
      [...notes]
        .filter((note) => !note.deleted_at)
        .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
        .slice(0, RECENT_COUNT),
    [notes]
  );

  const dateLine = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="animate-in px-4 pt-6">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted">{dateLine}</p>
          <h1 className="page-title mt-2 text-ink">{greeting()}</h1>
        </div>
        <Link
          to="/rhythm"
          className="flex items-center gap-2 rounded-full border border-accent/40 px-4 py-2 transition-colors hover:bg-accent-soft"
        >
          <span className="text-xs font-medium uppercase tracking-wider text-accent-ink">
            Streak
          </span>
          <span className="text-sm font-semibold text-accent-ink">{streak ?? "–"}</span>
        </Link>
      </div>

      <div className="mb-4">
        {/* Stays on the desk after saving — you came here to start, not to edit. */}
        <CaptureBar openAfterCreate={false} />
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Link to="/daily" className="glass rounded-2xl p-5 transition-colors hover:bg-surface">
          <ClockIcon />
          <p className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-accent-ink">
            Return tonight
          </p>
          {waiting === null ? (
            <div className="skeleton mt-3 h-8 w-16" />
          ) : (
            <p className="note-title mt-2 text-3xl text-ink">{waiting}</p>
          )}
          <p className="mt-1 text-sm text-muted">
            {waiting === 0 ? "nothing waiting" : "notes waiting"}
          </p>
        </Link>

        <Link to="/daily" className="glass rounded-2xl p-5 transition-colors hover:bg-surface">
          <CalendarIcon />
          <p className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-accent-ink">
            Daily quiz
          </p>
          <p className="note-title mt-2 text-lg leading-snug text-ink">Today's round</p>
          <p className="mt-1 text-sm text-muted">
            General knowledge, or drawn from your own notes.
          </p>
        </Link>

        {thought ? (
          <Link
            to={"/thoughts/" + thought.id}
            className="glass rounded-2xl p-5 transition-colors hover:bg-surface"
          >
            <SparkIcon />
            <p className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-accent-ink">
              Thought of the week
            </p>
            <p className="note-title mt-2 text-base leading-snug text-ink">{thought.title}</p>
            <span className="mt-2 inline-block text-sm font-medium text-accent-ink">Open →</span>
          </Link>
        ) : (
          <Link to="/thoughts" className="glass rounded-2xl p-5 transition-colors hover:bg-surface">
            <SparkIcon />
            <p className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-accent-ink">
              Thoughts
            </p>
            <p className="note-title mt-2 text-base leading-snug text-ink">
              Today's drops are waiting
            </p>
            <span className="mt-2 inline-block text-sm font-medium text-accent-ink">Open →</span>
          </Link>
        )}
      </div>

      <section className="glass rounded-2xl p-4">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-accent-ink">
            Picked back up
          </h2>
          <Link to="/notes" className="text-xs font-medium text-accent-ink hover:text-accent">
            All notes →
          </Link>
        </div>

        {loading ? (
          <div className="space-y-2">
            <div className="skeleton h-16" />
            <div className="skeleton h-16" />
          </div>
        ) : recent.length === 0 ? (
          <p className="py-2 text-sm text-muted">
            Nothing yet — the bar above is the quickest way to start.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {recent.map((note) => (
              <Link
                key={note.id}
                to={"/notes/" + note.id}
                className="rounded-xl bg-surface-2 px-3 py-2.5 transition-colors hover:bg-surface-3"
              >
                <p className="note-title truncate text-sm text-ink">
                  {note.title.trim() || "Untitled"}
                </p>
                <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted">
                  {markdownExcerpt(note.preview, 90) || "No content yet"}
                </p>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

const lineIcon = "h-[22px] w-[22px] text-accent-ink";

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" className={lineIcon} fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="8.25" />
      <path d="M12 7.5V12l3 1.75" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" className={lineIcon} fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3.75" y="5.25" width="16.5" height="15" rx="2" />
      <path d="M3.75 9.75h16.5M8 3.5v3.5M16 3.5v3.5" />
    </svg>
  );
}

function SparkIcon() {
  return (
    <svg viewBox="0 0 24 24" className={lineIcon} fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3.5a5.5 5.5 0 0 0-3 10.1V16h6v-2.4A5.5 5.5 0 0 0 12 3.5Z" />
      <path d="M10 18.5h4M10.5 21h3" />
    </svg>
  );
}
