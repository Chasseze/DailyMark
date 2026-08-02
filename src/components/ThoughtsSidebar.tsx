import { useMemo, useState } from "react";
import { NavLink, useParams } from "react-router-dom";
import { useThoughts, type ThoughtsShelf } from "../context/thoughts-context";
import type { Thought } from "../lib/types";

function openingLines(preview: string): string {
  const plain = preview.trim();
  if (!plain) return "";
  return plain.replace(/([.!?])\s+/g, "$1\n");
}

export default function ThoughtsSidebar() {
  const { featured, saved, pinned, bookmarkIds, loading, error, rotationHint } = useThoughts();
  const { id: selectedId } = useParams<{ id?: string }>();
  const [search, setSearch] = useState("");
  const [activeCollection, setActiveCollection] = useState<string | null>(null);
  const [shelf, setShelf] = useState<ThoughtsShelf>("live");

  const shelfList = shelf === "live" ? featured : saved;

  const collections = useMemo(() => {
    const set = new Set<string>();
    for (const thought of shelfList) {
      if (thought.collection) set.add(thought.collection);
    }
    return [...set].sort();
  }, [shelfList]);

  const filtered = useMemo(() => {
    let list = shelfList;
    if (activeCollection) {
      list = list.filter((t) => t.collection === activeCollection);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.preview.toLowerCase().includes(q) ||
          t.author.toLowerCase().includes(q) ||
          t.source_name.toLowerCase().includes(q) ||
          t.collection.toLowerCase().includes(q) ||
          t.tags.some((tag) => tag.toLowerCase().includes(q))
      );
    }
    return list;
  }, [shelfList, activeCollection, search]);

  const showPinnedCard = shelf === "live" && Boolean(pinned);
  const listItems = showPinnedCard && pinned
    ? filtered.filter((t) => t.id !== pinned.id)
    : filtered;
  const hasContent = listItems.length > 0 || showPinnedCard;

  return (
    <aside className="notes-sidebar">
      <div className="px-4 pt-6">
        <div className="mb-5">
          <h1 className="page-title text-white light:text-slate-900">Thoughts</h1>
          <p className="mt-2 text-sm text-slate-400 light:text-slate-500">
            {loading
              ? "Loading…"
              : shelf === "live"
                ? `Live shelf · ${rotationHint}`
                : `${saved.length} saved`}
          </p>
        </div>

        <div className="mb-3 flex gap-1.5">
          <button
            type="button"
            onClick={() => {
              setShelf("live");
              setActiveCollection(null);
            }}
            className={
              "flex-1 rounded-xl px-3 py-2 text-xs font-semibold transition-colors " +
              (shelf === "live"
                ? "bg-amber-500/20 text-amber-400"
                : "bg-white/5 text-slate-400 hover:text-slate-200 light:bg-slate-100 light:text-slate-600")
            }
          >
            Live
          </button>
          <button
            type="button"
            onClick={() => {
              setShelf("saved");
              setActiveCollection(null);
            }}
            className={
              "flex-1 rounded-xl px-3 py-2 text-xs font-semibold transition-colors " +
              (shelf === "saved"
                ? "bg-amber-500/20 text-amber-400"
                : "bg-white/5 text-slate-400 hover:text-slate-200 light:bg-slate-100 light:text-slate-600")
            }
          >
            Saved{bookmarkIds.size > 0 ? ` · ${bookmarkIds.size}` : ""}
          </button>
        </div>

        <div className="relative mb-3">
          <svg
            viewBox="0 0 24 24"
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="6.5" />
            <path strokeLinecap="round" d="m16.5 16.5 3 3" />
          </svg>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={shelf === "live" ? "Search live shelf…" : "Search saved…"}
            className="w-full rounded-xl border border-white/5 bg-white/5 py-2.5 pl-10 pr-4 text-sm text-white placeholder-slate-500 focus:border-amber-500/35 focus:outline-none light:border-slate-200 light:bg-white/70 light:text-slate-900"
          />
        </div>

        {collections.length > 0 && (
          <div className="mb-3 flex items-center gap-1.5 overflow-x-auto pb-0.5">
            <button
              type="button"
              onClick={() => setActiveCollection(null)}
              className={
                "shrink-0 rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-colors " +
                (!activeCollection
                  ? "bg-amber-500/20 text-amber-400"
                  : "text-slate-400 hover:bg-white/5 hover:text-slate-200 light:hover:bg-slate-100")
              }
            >
              All
            </button>
            {collections.map((collection) => (
              <button
                key={collection}
                type="button"
                onClick={() =>
                  setActiveCollection(activeCollection === collection ? null : collection)
                }
                className={
                  "shrink-0 rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-colors " +
                  (activeCollection === collection
                    ? "bg-amber-500/20 text-amber-400"
                    : "text-slate-400 hover:bg-white/5 hover:text-slate-200 light:hover:bg-slate-100")
                }
              >
                {collection}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
        {error && featured.length === 0 && (
          <div className="mb-3 rounded-xl bg-red-500/10 px-3 py-2 text-xs text-red-400">
            {error}
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-28 animate-pulse rounded-2xl bg-white/5 light:bg-slate-200/70" />
            ))}
          </div>
        ) : !hasContent ? (
          <div className="glass mt-6 rounded-3xl px-4 py-10 text-center">
            <p className="text-sm font-semibold text-slate-400">
              {search || activeCollection
                ? "Nothing matched"
                : shelf === "saved"
                  ? "Nothing saved yet"
                  : "No thoughts yet"}
            </p>
            {shelf === "saved" && !search && !activeCollection && (
              <p className="mt-2 text-xs text-slate-500">
                Open a live piece and tap Save to keep it after it rotates out.
              </p>
            )}
          </div>
        ) : (
          <nav className="notes-file-list" aria-label={shelf === "live" ? "Live thoughts" : "Saved thoughts"}>
            {showPinnedCard && pinned && (
              <PinnedThoughtCard thought={pinned} selectedId={selectedId} bookmarkIds={bookmarkIds} />
            )}
            {listItems.map((thought) => (
              <ThoughtCard
                key={thought.id}
                thought={thought}
                selectedId={selectedId}
                bookmarked={bookmarkIds.has(thought.id)}
              />
            ))}
          </nav>
        )}
      </div>
    </aside>
  );
}

function PinnedThoughtCard({
  thought,
  selectedId,
  bookmarkIds,
}: {
  thought: Thought;
  selectedId?: string;
  bookmarkIds: ReadonlySet<string>;
}) {
  const active = selectedId === thought.id;
  const preview = openingLines(thought.preview || thought.content);
  const bookmarked = bookmarkIds.has(thought.id);

  return (
    <NavLink
      to={"/thoughts/" + thought.id}
      className="notes-file-card"
      data-active={active ? "true" : "false"}
    >
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="rounded-md bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-400">
          Thought of the week
        </span>
        {bookmarked && (
          <span className="shrink-0 text-amber-400" aria-label="Saved" title="Saved">
            <BookmarkGlyph filled />
          </span>
        )}
      </div>
      <h3 className="truncate text-[0.95rem] font-semibold tracking-tight text-white light:text-slate-900">
        {thought.title}
      </h3>
      {thought.collection ? (
        <p className="mt-1 text-[10px] font-medium uppercase tracking-[0.08em] text-slate-500">
          {thought.collection}
        </p>
      ) : null}
      {preview ? (
        <p className="notes-file-card__preview mt-2 text-[11px] leading-relaxed text-slate-400 light:text-slate-500">
          {preview}
        </p>
      ) : null}
    </NavLink>
  );
}

function ThoughtCard({
  thought,
  selectedId,
  bookmarked,
}: {
  thought: Thought;
  selectedId?: string;
  bookmarked: boolean;
}) {
  const active = selectedId === thought.id;
  const preview = openingLines(thought.preview || thought.content);
  const date = new Date(thought.published_at).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <NavLink
      to={"/thoughts/" + thought.id}
      className="notes-file-card"
      data-active={active ? "true" : "false"}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="min-w-0 flex-1 truncate text-[0.95rem] font-semibold tracking-tight text-white light:text-slate-900">
          {thought.title}
        </h3>
        {bookmarked && (
          <span className="mt-0.5 shrink-0 text-amber-400" aria-label="Saved" title="Saved">
            <BookmarkGlyph filled />
          </span>
        )}
      </div>

      <p className="mt-1 text-[10px] font-medium uppercase tracking-[0.08em] text-slate-500">
        {date}
        {thought.author ? ` · ${thought.author}` : ""}
        {thought.collection ? ` · ${thought.collection}` : ""}
      </p>

      {thought.tags.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {thought.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-md bg-amber-500/12 px-1.5 py-0.5 text-[10px] font-medium text-amber-400"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {preview ? (
        <p className="notes-file-card__preview mt-2 text-[11px] leading-relaxed text-slate-400 light:text-slate-500">
          {preview}
        </p>
      ) : (
        <p className="mt-2 text-[11px] italic text-slate-500">No preview</p>
      )}
    </NavLink>
  );
}

function BookmarkGlyph({ filled }: { filled?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
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
