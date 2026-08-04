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
        <p className="text-sm text-muted">Loading…</p>
      </div>
    );
  }

  if (!thought) {
    return (
      <div className="flex h-full min-h-[16rem] flex-col items-center justify-center px-4">
        <p className="text-muted">Thought not found</p>
        <button
          type="button"
          onClick={() => navigate("/thoughts")}
          className="mt-4 text-sm text-accent-ink"
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
  const onLiveShelf = !saved && featured.some((t) => t.id === thought.id);

  const date = new Date(thought.published_at).toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const spoken = [thought.title, thought.content].filter((part) => part.trim()).join("\n\n");

  const iconBtn =
    "rounded-xl p-2 text-muted transition-colors hover:bg-surface-2 hover:text-ink";

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
            (saved ? "text-accent-ink hover:text-accent" : "") +
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
            (isPinned ? "text-accent-ink hover:text-accent" : "") +
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
          className="rounded-xl px-3 py-2 text-xs font-semibold text-accent-ink transition-colors hover:bg-accent-soft hover:text-accent disabled:opacity-50"
        >
          Write a note
        </button>
      </div>

      {actionError && (
        <div className="mb-3 rounded-xl bg-danger-soft p-3 text-xs text-danger">{actionError}</div>
      )}

      <article className="note-view__article glass rounded-2xl p-5">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {saved ? (
            <span className="rounded-md bg-surface-2 px-2 py-0.5 text-xs font-semibold uppercase tracking-wider text-ink-soft">
              Saved
            </span>
          ) : onLiveShelf ? (
            <span className="rounded-md bg-accent-soft px-2 py-0.5 text-xs font-semibold uppercase tracking-wider text-accent-ink">
              Live · {rotationHint}
            </span>
          ) : (
            <span className="rounded-md bg-surface-2 px-2 py-0.5 text-xs font-semibold uppercase tracking-wider text-muted">
              Off the live feed
            </span>
          )}
          {isPinned && (
            <span className="rounded-md bg-accent-soft px-2 py-0.5 text-xs font-semibold uppercase tracking-wider text-accent-ink">
              Thought of the week
            </span>
          )}
          {thought.collection ? (
            <span className="rounded-md bg-surface-2 px-2 py-0.5 text-xs font-semibold uppercase tracking-wider text-ink-soft">
              {thought.collection}
            </span>
          ) : null}
        </div>

        <h1 className="note-title mb-1 break-words text-2xl text-ink">
          {thought.title}
        </h1>
        <p className="mb-4 text-xs text-muted">
          {date}
          {thought.author ? ` · ${thought.author}` : ""}
        </p>

        {thought.tags.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-1.5">
            {thought.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-md bg-accent-soft px-2.5 py-0.5 text-xs text-accent-ink"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        <div className="mt-2 min-w-0 text-sm leading-relaxed text-ink-soft">
          {thought.content.trim() ? (
            <Markdown notes={[]}>{thought.content}</Markdown>
          ) : (
            <p className="italic text-muted">This thought is empty.</p>
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
      className="thought-attribution mt-8 border-t border-line pt-4"
      aria-label="Source attribution"
    >
      <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted">
        Caveat
      </p>
      <p className="mt-2 text-xs leading-relaxed text-muted">
        This is a curated reflection for DailyMark readers — not a reprint of the original
        work. Ideas and guidance belong to their authors. Credit:{" "}
        <span className="text-ink-soft">{byline}</span>.
        {thought.source_url ? " Please read and support the source." : ""}
      </p>
      {thought.source_url && (
        <a
          href={thought.source_url}
          target="_blank"
          rel="noreferrer noopener"
          className="mt-3 inline-flex text-sm font-medium text-accent-ink hover:text-accent"
        >
          View original →
        </a>
      )}
    </aside>
  );
}
