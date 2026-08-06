import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Markdown from "../components/Markdown";
import ReadAloudButton from "../components/ReadAloudButton";
import { useNotes } from "../context/notes-context";
import { useVisuals } from "../context/visuals-context";
import { errorMessage } from "../lib/supabase";
import type { Visual } from "../lib/types";

/** Byline used for both the caption credit and what gets shared. */
function creditLine(visual: Visual): string {
  const byline = visual.author
    ? `${visual.author}${visual.source_name ? ` · ${visual.source_name}` : ""}`
    : visual.source_name || "";
  return [byline, visual.license].filter(Boolean).join(" · ");
}

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
  const { isBookmarked, toggleBookmark, featured, saved: savedList, catalog, rotationHint } =
    useVisuals();
  const { addNote, inboxId } = useNotes();
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [shareState, setShareState] = useState<"idle" | "copied">("idle");
  const saved = isBookmarked(visual.id);
  const onLiveShelf = !saved && featured.some((v) => v.id === visual.id);

  // Flip through whichever shelf this piece belongs to — the live feed if it's
  // a fresh drop, the Saved shelf if it's bookmarked, else the full catalog —
  // so ← / → moves through "the day's drops" the way the list would.
  const browseList = useMemo(() => {
    if (featured.some((v) => v.id === visual.id)) return featured;
    if (savedList.some((v) => v.id === visual.id)) return savedList;
    return catalog;
  }, [featured, savedList, catalog, visual.id]);
  const browseIndex = browseList.findIndex((v) => v.id === visual.id);
  const prevVisual = browseIndex > 0 ? browseList[browseIndex - 1] : undefined;
  const nextVisual =
    browseIndex >= 0 && browseIndex < browseList.length - 1
      ? browseList[browseIndex + 1]
      : undefined;

  const goTo = useCallback(
    (target?: Visual) => {
      if (target) navigate("/visuals/" + target.id);
    },
    [navigate]
  );

  // Arrow-key browsing. Ignore it while typing (the desktop list pane keeps a
  // search box mounted alongside this view) or when a modifier is held.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      if (event.key === "ArrowLeft" && prevVisual) {
        event.preventDefault();
        goTo(prevVisual);
      } else if (event.key === "ArrowRight" && nextVisual) {
        event.preventDefault();
        goTo(nextVisual);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [prevVisual, nextVisual, goTo]);

  const date = new Date(visual.published_at).toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const spoken = [visual.title, visual.content].filter((part) => part.trim()).join("\n\n");

  const iconBtn =
    "rounded-xl p-2 text-muted transition-colors hover:bg-surface-2 hover:text-ink disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-muted";

  const handleShare = async () => {
    const credit = creditLine(visual);
    const url = visual.source_url || window.location.href;
    const text = credit ? `${visual.title} — ${credit}` : visual.title;
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ title: visual.title, text, url });
      } else if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(`${text}\n${url}`);
        setShareState("copied");
        window.setTimeout(() => setShareState("idle"), 1800);
      }
    } catch (err) {
      // The user dismissing the native share sheet isn't an error.
      if ((err as Error)?.name !== "AbortError") setActionError(errorMessage(err));
    }
  };

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
        <button
          type="button"
          onClick={() => goTo(prevVisual)}
          disabled={!prevVisual}
          className={iconBtn}
          aria-label="Previous picture story"
          title={prevVisual ? `Previous · ${prevVisual.title}` : "No previous story"}
        >
          <ChevronIcon direction="left" />
        </button>
        <button
          type="button"
          onClick={() => goTo(nextVisual)}
          disabled={!nextVisual}
          className={iconBtn}
          aria-label="Next picture story"
          title={nextVisual ? `Next · ${nextVisual.title}` : "No next story"}
        >
          <ChevronIcon direction="right" />
        </button>
        <div className="min-w-0 flex-1" />
        <ReadAloudButton
          request={{ id: "visual:" + visual.id, label: visual.title, text: spoken }}
        />
        <button
          type="button"
          onClick={() => void handleShare()}
          className={iconBtn + (shareState === "copied" ? " text-accent-ink" : "")}
          aria-label="Share picture story"
          title={shareState === "copied" ? "Link copied" : "Share"}
        >
          {shareState === "copied" ? <CheckIcon /> : <ShareIcon />}
        </button>
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

function ChevronIcon({ direction }: { direction: "left" | "right" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d={direction === "left" ? "M15 5.5 8.5 12l6.5 6.5" : "M9 5.5 15.5 12 9 18.5"}
      />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      aria-hidden="true"
    >
      <circle cx="6" cy="12" r="2.25" />
      <circle cx="17.5" cy="6" r="2.25" />
      <circle cx="17.5" cy="18" r="2.25" />
      <path strokeLinecap="round" d="m8 10.9 7.5-3.6M8 13.1l7.5 3.6" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="m5 12.5 4 4 10-10" />
    </svg>
  );
}

/** Always shown — points readers back to the original creator / source, and
 * states the image was compressed for delivery rather than reprinted as-is. */
function VisualAttribution({ visual }: { visual: Visual }) {
  const byline = visual.author
    ? `${visual.author}${visual.source_name ? ` · ${visual.source_name}` : ""}`
    : visual.source_name || "the original publication";

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
