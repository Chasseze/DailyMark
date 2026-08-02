import { useMemo, useState } from "react";
import { NavLink, useParams } from "react-router-dom";
import { useThoughts } from "../context/thoughts-context";

function openingLines(preview: string): string {
  const plain = preview.trim();
  if (!plain) return "";
  return plain.replace(/([.!?])\s+/g, "$1\n");
}

export default function ThoughtsSidebar() {
  const { thoughts, loading, error } = useThoughts();
  const { id: selectedId } = useParams<{ id?: string }>();
  const [search, setSearch] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    for (const thought of thoughts) for (const tag of thought.tags) set.add(tag);
    return [...set].sort();
  }, [thoughts]);

  const filtered = useMemo(() => {
    let list = thoughts;
    if (activeTag) list = list.filter((t) => t.tags.includes(activeTag));
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.preview.toLowerCase().includes(q) ||
          t.author.toLowerCase().includes(q) ||
          t.source_name.toLowerCase().includes(q) ||
          t.tags.some((tag) => tag.toLowerCase().includes(q))
      );
    }
    return [...list].sort(
      (a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime()
    );
  }, [thoughts, activeTag, search]);

  return (
    <aside className="notes-sidebar">
      <div className="px-4 pt-6">
        <div className="mb-5">
          <h1 className="page-title text-white light:text-slate-900">Thoughts</h1>
          <p className="mt-2 text-sm text-slate-400 light:text-slate-500">
            {loading
              ? "Loading…"
              : `${filtered.length} curated piece${filtered.length !== 1 ? "s" : ""}`}
          </p>
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
            placeholder="Search thoughts…"
            className="w-full rounded-xl border border-white/5 bg-white/5 py-2.5 pl-10 pr-4 text-sm text-white placeholder-slate-500 focus:border-amber-500/35 focus:outline-none light:border-slate-200 light:bg-white/70 light:text-slate-900"
          />
        </div>

        {allTags.length > 0 && (
          <div className="mb-3 flex items-center gap-1.5 overflow-x-auto pb-0.5">
            <button
              type="button"
              onClick={() => setActiveTag(null)}
              className={
                "shrink-0 rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-colors " +
                (!activeTag
                  ? "bg-amber-500/20 text-amber-400"
                  : "text-slate-400 hover:bg-white/5 hover:text-slate-200 light:hover:bg-slate-100")
              }
            >
              All
            </button>
            {allTags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => setActiveTag(activeTag === tag ? null : tag)}
                className={
                  "shrink-0 rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-colors " +
                  (activeTag === tag
                    ? "bg-amber-500/20 text-amber-400"
                    : "text-slate-400 hover:bg-white/5 hover:text-slate-200 light:hover:bg-slate-100")
                }
              >
                #{tag}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
        {error && thoughts.length === 0 && (
          <div className="mb-3 rounded-xl bg-red-500/10 px-3 py-2 text-xs text-red-400">
            {error}
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-28 animate-pulse rounded-2xl bg-white/5 light:bg-slate-200/70" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="glass mt-6 rounded-3xl px-4 py-10 text-center">
            <p className="text-sm font-semibold text-slate-400">
              {search || activeTag ? "Nothing matched" : "No thoughts yet"}
            </p>
          </div>
        ) : (
          <nav className="notes-file-list" aria-label="Thoughts">
            {filtered.map((thought) => {
              const active = selectedId === thought.id;
              const preview = openingLines(thought.preview || thought.content);
              const date = new Date(thought.published_at).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
              });

              return (
                <NavLink
                  key={thought.id}
                  to={"/thoughts/" + thought.id}
                  className="notes-file-card"
                  data-active={active ? "true" : "false"}
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="min-w-0 flex-1 truncate text-[0.95rem] font-semibold tracking-tight text-white light:text-slate-900">
                      {thought.title}
                    </h3>
                  </div>

                  <p className="mt-1 text-[10px] font-medium uppercase tracking-[0.08em] text-slate-500">
                    {date}
                    {thought.author ? ` · ${thought.author}` : ""}
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
            })}
          </nav>
        )}
      </div>
    </aside>
  );
}
