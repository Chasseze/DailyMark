import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Markdown from "../components/Markdown";
import ReadAloudButton from "../components/ReadAloudButton";
import { useNotes } from "../context/notes-context";
import { useThoughts } from "../context/thoughts-context";
import { errorMessage } from "../lib/supabase";
import type { Thought } from "../lib/types";

export default function ThoughtView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getThought, loading } = useThoughts();
  const thought = id ? getThought(id) : undefined;

  if (loading) {
    return (
      <div className="flex h-full min-h-[16rem] items-center justify-center">
        <p className="text-sm text-slate-500">Loading…</p>
      </div>
    );
  }

  if (!thought) {
    return (
      <div className="flex h-full min-h-[16rem] flex-col items-center justify-center px-4">
        <p className="text-slate-400">Thought not found</p>
        <button
          type="button"
          onClick={() => navigate("/thoughts")}
          className="mt-4 text-sm text-amber-400"
        >
          ← Back to thoughts
        </button>
      </div>
    );
  }

  return <ThoughtArticle thought={thought} />;
}

function ThoughtArticle({ thought }: { thought: Thought }) {
  const navigate = useNavigate();
  const { isBookmarked, toggleBookmark, pinThought, pinned, featured, rotationHint } =
    useThoughts();
  const { addNote, inboxId } = useNotes();
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const saved = isBookmarked(thought.id);
  const isPinned = pinned?.id === thought.id;
  const onLiveShelf = featured.some((t) => t.id === thought.id);

  const date = new Date(thought.published_at).toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const spoken = [thought.title, thought.content].filter((part) => part.trim()).join("\n\n");

  const iconBtn =
    "rounded-xl p-2 text-slate-400 transition-colors hover:bg-white/5 hover:text-white light:hover:bg-slate-100 light:hover:text-slate-900";

  const handleBookmark = async () => {
    if (busy) return;
    setBusy(true);
    setActionError(null);
    try {
      await toggleBookmark(thought.id);
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const handlePin = async () => {
    if (busy) return;
    setBusy(true);
    setActionError(null);
    try {
      await pinThought(isPinned ? null : thought.id);
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const handleWriteNote = async () => {
    if (busy) return;
    setBusy(true);
    setActionError(null);
    try {
      const quoted = thought.content.trim()
        ? thought.content
            .trim()
            .split("\n")
            .map((line) => `> ${line}`)
            .join("\n")
        : `> ${thought.title}`;
      const credit = thought.author || thought.source_name;
      const content = credit ? `${quoted}\n>\n> — ${credit}\n\n` : `${quoted}\n\n`;
      const note = await addNote({
        title: `Reflection · ${thought.title}`,
        content,
        notebook_id: inboxId,
        is_pinned: false,
        tags: ["from-thought", ...thought.tags.slice(0, 2)],
      });
      navigate("/notes/" + note.id + "/edit");
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="note-view animate-in px-4 pt-6">
      <div className="mb-4 flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => navigate("/thoughts")}
          className={iconBtn}
          aria-label="Back to thoughts list"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.5 5.5 9 12l6.5 6.5" />
          </svg>
        </button>
        <div className="min-w-0 flex-1" />
        <ReadAloudButton
          request={{ id: "thought:" + thought.id, label: thought.title, text: spoken }}
        />
        <button
          type="button"
          onClick={() => void handleBookmark()}
          disabled={busy}
          className={
            iconBtn +
            " " +
            (saved ? "text-amber-400 hover:text-amber-300" : "") +
            " disabled:opacity-50"
          }
          aria-label={saved ? "Remove from saved" : "Save thought"}
          title={saved ? "Saved" : "Save"}
        >
          <BookmarkIcon filled={saved} />
        </button>
        <button
          type="button"
          onClick={() => void handlePin()}
          disabled={busy}
          className={
            iconBtn +
            " " +
            (isPinned ? "text-amber-400 hover:text-amber-300" : "") +
            " disabled:opacity-50"
          }
          aria-label={isPinned ? "Unpin Thought of the week" : "Pin as Thought of the week"}
          title={isPinned ? "Unpin Thought of the week" : "Thought of the week"}
        >
          <PinIcon filled={isPinned} />
        </button>
        <button
          type="button"
          onClick={() => void handleWriteNote()}
          disabled={busy}
          className="rounded-xl px-3 py-2 text-xs font-semibold text-amber-400 transition-colors hover:bg-amber-500/10 hover:text-amber-300 disabled:opacity-50"
        >
          Write a note
        </button>
      </div>

      {actionError && (
        <div className="mb-3 rounded-xl bg-red-500/10 p-3 text-xs text-red-400">{actionError}</div>
      )}

      <article className="note-view__article glass rounded-2xl p-5">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {onLiveShelf ? (
            <span className="rounded-md bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-400">
              Live · {rotationHint}
            </span>
          ) : (
            <span className="rounded-md bg-white/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400 light:bg-slate-100 light:text-slate-600">
              From your saved
            </span>
          )}
          {isPinned && (
            <span className="rounded-md bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-400">
              Thought of the week
            </span>
          )}
          {thought.collection ? (
            <span className="rounded-md bg-white/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-300 light:bg-slate-100 light:text-slate-600">
              {thought.collection}
            </span>
          ) : null}
        </div>

        <h1 className="note-title mb-1 break-words text-2xl text-white light:text-slate-900">
          {thought.title}
        </h1>
        <p className="mb-4 text-xs text-slate-500">
          {date}
          {thought.author ? ` · ${thought.author}` : ""}
        </p>

        {thought.tags.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-1.5">
            {thought.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-md bg-amber-500/10 px-2.5 py-0.5 text-xs text-amber-400"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        <div className="mt-2 min-w-0 text-sm leading-relaxed text-slate-300 light:text-slate-700">
          {thought.content.trim() ? (
            <Markdown notes={[]}>{thought.content}</Markdown>
          ) : (
            <p className="italic text-slate-500">This thought is empty.</p>
          )}
        </div>

        <ThoughtAttribution thought={thought} />
      </article>
    </div>
  );
}

function BookmarkIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.75"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M7 4.75h10A1.25 1.25 0 0 1 18.25 6v14L12 16.25 5.75 20V6A1.25 1.25 0 0 1 7 4.75Z"
      />
    </svg>
  );
}

function PinIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.75"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 4.5 9.5 10l-2 5.5L13 13.5 18.5 8M9.5 10 5 14.5"
      />
    </svg>
  );
}

/** Always shown — points readers back to the original owner / source. */
function ThoughtAttribution({ thought }: { thought: Thought }) {
  const sourceLabel = thought.source_name || "the original publication";
  const byline = thought.author
    ? `${thought.author}${thought.source_name ? ` · ${thought.source_name}` : ""}`
    : sourceLabel;

  return (
    <aside
      className="thought-attribution mt-8 border-t border-white/10 pt-4 light:border-slate-200"
      aria-label="Source attribution"
    >
      <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-slate-500">
        Caveat
      </p>
      <p className="mt-2 text-xs leading-relaxed text-slate-400 light:text-slate-500">
        This is a curated reflection for DailyMark readers — not a reprint of the original
        work. Ideas and guidance belong to their authors. Credit:{" "}
        <span className="text-slate-300 light:text-slate-700">{byline}</span>.
        {thought.source_url ? " Please read and support the source." : ""}
      </p>
      {thought.source_url && (
        <a
          href={thought.source_url}
          target="_blank"
          rel="noreferrer noopener"
          className="mt-3 inline-flex text-sm font-medium text-amber-400 hover:text-amber-300"
        >
          View original →
        </a>
      )}
    </aside>
  );
}
