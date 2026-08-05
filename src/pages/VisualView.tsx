import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Markdown from "../components/Markdown";
import { useNotes } from "../context/notes-context";
import { useVisuals } from "../context/visuals-context";
import { errorMessage } from "../lib/supabase";
import type { Visual } from "../lib/types";

export default function VisualView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getVisual, loading } = useVisuals();
  const visual = id ? getVisual(id) : undefined;

  if (loading) {
    return (
      <div className="flex h-full min-h-[16rem] items-center justify-center">
        <p className="text-sm text-muted">Loading…</p>
      </div>
    );
  }

  if (!visual) {
    return (
      <div className="flex h-full min-h-[16rem] flex-col items-center justify-center px-4">
        <p className="text-muted">Picture story not found</p>
        <button
          type="button"
          onClick={() => navigate("/visuals")}
          className="mt-4 text-sm text-accent-ink"
        >
          ← Back to visuals
        </button>
      </div>
    );
  }

  return <VisualArticle visual={visual} />;
}

function VisualArticle({ visual }: { visual: Visual }) {
  const navigate = useNavigate();
  const { isBookmarked, toggleBookmark, featured, rotationHint } = useVisuals();
  const { addNote, inboxId } = useNotes();
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const saved = isBookmarked(visual.id);
  const onLiveShelf = !saved && featured.some((v) => v.id === visual.id);

  const date = new Date(visual.published_at).toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const iconBtn =
    "rounded-xl p-2 text-muted transition-colors hover:bg-surface-2 hover:text-ink";

  const handleBookmark = async () => {
    if (busy) return;
    setBusy(true);
    setActionError(null);
    try {
      await toggleBookmark(visual.id);
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
      const credit = visual.author || visual.source_name;
      const content = credit
        ? `![${visual.alt_text || visual.title}](${visual.image_url})\n\n> — ${credit}\n\n`
        : `![${visual.alt_text || visual.title}](${visual.image_url})\n\n`;
      const note = await addNote({
        title: `Reflection · ${visual.title}`,
        content,
        notebook_id: inboxId,
        is_pinned: false,
        tags: ["from-visual", ...visual.tags.slice(0, 2)],
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
          onClick={() => navigate("/visuals")}
          className={iconBtn}
          aria-label="Back to visuals list"
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
          aria-label={saved ? "Remove from saved" : "Save picture story"}
          title={saved ? "Saved" : "Save"}
        >
          <BookmarkIcon filled={saved} />
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
          {visual.collection ? (
            <span className="rounded-md bg-surface-2 px-2 py-0.5 text-xs font-semibold uppercase tracking-wider text-ink-soft">
              {visual.collection}
            </span>
          ) : null}
        </div>

        <h1 className="note-title mb-1 break-words text-2xl text-ink">
          {visual.title}
        </h1>
        <p className="mb-4 text-xs text-muted">
          {date}
          {visual.author ? ` · ${visual.author}` : ""}
        </p>

        <img
          src={visual.image_url}
          alt={visual.alt_text || visual.title}
          loading="lazy"
          className="mb-4 w-full rounded-xl object-cover"
        />

        {visual.tags.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-1.5">
            {visual.tags.map((tag) => (
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
          {visual.content.trim() ? (
            <Markdown notes={[]}>{visual.content}</Markdown>
          ) : (
            <p className="italic text-muted">No caption for this picture story.</p>
          )}
        </div>

        <VisualAttribution visual={visual} />
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

/** Always shown — points readers back to the original creator / source, and
 * states the image was compressed for delivery rather than reprinted as-is. */
function VisualAttribution({ visual }: { visual: Visual }) {
  const sourceLabel = visual.source_name || "the original publication";
  const byline = visual.author
    ? `${visual.author}${visual.source_name ? ` · ${visual.source_name}` : ""}`
    : sourceLabel;

  return (
    <aside
      className="visual-attribution mt-8 border-t border-line pt-4"
      aria-label="Source attribution"
    >
      <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted">
        Caveat
      </p>
      <p className="mt-2 text-xs leading-relaxed text-muted">
        This image is shown as a compressed rendition for DailyMark readers, credited
        to its original creator — not a reprint at full resolution. All rights remain
        with the creator. Credit: <span className="text-ink-soft">{byline}</span>.
        {visual.license ? ` License: ${visual.license}.` : ""}
        {visual.source_url ? " Please view and support the source." : ""}
      </p>
      {visual.source_url && (
        <a
          href={visual.source_url}
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
