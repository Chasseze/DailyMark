import { useMemo, useState } from "react";
import { NavLink, useParams } from "react-router-dom";
import { useVisuals, type VisualsShelf } from "../context/visuals-context";
import type { Visual } from "../lib/types";

export default function VisualsSidebar() {
  const { featured, saved, bookmarkIds, loading, error, rotationHint } = useVisuals();
  const { id: selectedId } = useParams<{ id?: string }>();
  const [search, setSearch] = useState("");
  const [activeCollection, setActiveCollection] = useState<string | null>(null);
  const [shelf, setShelf] = useState<VisualsShelf>("live");

  const shelfList = shelf === "live" ? featured : saved;

  const collections = useMemo(() => {
    const set = new Set<string>();
    for (const visual of shelfList) {
      if (visual.collection) set.add(visual.collection);
    }
    return [...set].sort();
  }, [shelfList]);

  const filtered = useMemo(() => {
    let list = shelfList;
    if (activeCollection) {
      list = list.filter((v) => v.collection === activeCollection);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (v) =>
          v.title.toLowerCase().includes(q) ||
          v.preview.toLowerCase().includes(q) ||
          v.author.toLowerCase().includes(q) ||
          v.source_name.toLowerCase().includes(q) ||
          v.collection.toLowerCase().includes(q) ||
          v.tags.some((tag) => tag.toLowerCase().includes(q))
      );
    }
    return list;
  }, [shelfList, activeCollection, search]);

  const hasContent = filtered.length > 0;

  return (
    <aside className="notes-sidebar">
      <div className="px-4 pt-6">
        <div className="mb-5">
          <h1 className="page-title text-ink">Visuals</h1>
          <p className="mt-2 text-sm text-muted">
            {loading
              ? "Loading…"
              : shelf === "live"
                ? `Live feed · ${rotationHint}`
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
                ? "bg-accent-soft text-accent-ink"
                : "bg-surface text-muted hover:text-ink-soft")
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
                ? "bg-accent-soft text-accent-ink"
                : "bg-surface text-muted hover:text-ink-soft")
            }
          >
            Saved{bookmarkIds.size > 0 ? ` · ${bookmarkIds.size}` : ""}
          </button>
        </div>

        <div className="relative mb-3">
          <svg
            viewBox="0 0 24 24"
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
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
            placeholder={shelf === "live" ? "Search live feed…" : "Search saved…"}
            className="w-full rounded-xl border border-line bg-surface py-2.5 pl-10 pr-4 text-sm text-ink placeholder-faint focus:border-accent/50 focus:outline-none"
          />
        </div>

        {collections.length > 0 && (
          <div className="mb-3 flex items-center gap-1.5 overflow-x-auto pb-0.5">
            <button
              type="button"
              onClick={() => setActiveCollection(null)}
              className={
                "shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors " +
                (!activeCollection
                  ? "bg-accent-soft text-accent-ink"
                  : "text-muted hover:bg-surface-2 hover:text-ink-soft")
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
                  "shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors " +
                  (activeCollection === collection
                    ? "bg-accent-soft text-accent-ink"
                    : "text-muted hover:bg-surface-2 hover:text-ink-soft")
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
          <div className="mb-3 rounded-xl bg-danger-soft px-3 py-2 text-xs text-danger">
            {error}
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-28 animate-pulse rounded-2xl bg-surface" />
            ))}
          </div>
        ) : !hasContent ? (
          <div className="glass mt-6 rounded-3xl px-4 py-10 text-center">
            <p className="text-sm font-semibold text-muted">
              {search || activeCollection
                ? "Nothing matched"
                : shelf === "saved"
                  ? "Nothing saved yet"
                  : "No live drops right now"}
            </p>
            {shelf === "saved" && !search && !activeCollection && (
              <p className="mt-2 text-xs text-muted">
                Open a live picture story and tap Save — it leaves Live and stays here.
              </p>
            )}
            {shelf === "live" && !search && !activeCollection && (
              <p className="mt-2 text-xs text-muted">
                Fresh pieces stay for 2–3 days, then drop off unless you save them.
              </p>
            )}
          </div>
        ) : (
          <nav className="notes-file-list" aria-label={shelf === "live" ? "Live visuals" : "Saved visuals"}>
            {filtered.map((visual) => (
              <VisualCard
                key={visual.id}
                visual={visual}
                selectedId={selectedId}
                bookmarked={bookmarkIds.has(visual.id)}
              />
            ))}
          </nav>
        )}
      </div>
    </aside>
  );
}

function VisualCard({
  visual,
  selectedId,
  bookmarked,
}: {
  visual: Visual;
  selectedId?: string;
  bookmarked: boolean;
}) {
  const active = selectedId === visual.id;
  const date = new Date(visual.published_at).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <NavLink
      to={"/visuals/" + visual.id}
      className="notes-file-card"
      data-active={active ? "true" : "false"}
    >
      <div className="mb-2.5 flex gap-3">
        <img
          src={visual.image_url}
          alt=""
          loading="lazy"
          className="h-16 w-20 shrink-0 rounded-lg object-cover"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="min-w-0 flex-1 text-sm font-semibold leading-snug tracking-tight text-ink">
              {visual.title}
            </h3>
            {bookmarked && (
              <span className="mt-0.5 shrink-0 text-accent-ink" aria-label="Saved" title="Saved">
                <BookmarkGlyph filled />
              </span>
            )}
          </div>
          <p className="mt-1 text-xs font-medium uppercase tracking-[0.08em] text-muted">
            {date}
            {visual.author ? ` · ${visual.author}` : ""}
          </p>
          {visual.collection ? (
            <p className="mt-0.5 text-xs text-muted">{visual.collection}</p>
          ) : null}
        </div>
      </div>

      {visual.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {visual.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-md bg-accent-soft px-1.5 py-0.5 text-xs font-medium text-accent-ink"
            >
              {tag}
            </span>
          ))}
        </div>
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
