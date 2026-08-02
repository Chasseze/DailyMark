import { useNavigate, useParams } from "react-router-dom";
import Markdown from "../components/Markdown";
import ReadAloudButton from "../components/ReadAloudButton";
import { useThoughts } from "../context/thoughts-context";
import type { Thought } from "../lib/types";

export default function ThoughtView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { thoughts, loading } = useThoughts();
  const thought = thoughts.find((t) => t.id === id);

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
  const date = new Date(thought.published_at).toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const spoken = [thought.title, thought.content].filter((part) => part.trim()).join("\n\n");

  const iconBtn =
    "rounded-xl p-2 text-slate-400 transition-colors hover:bg-white/5 hover:text-white light:hover:bg-slate-100 light:hover:text-slate-900";

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
      </div>

      <article className="note-view__article glass rounded-2xl p-5">
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
            <Markdown>{thought.content}</Markdown>
          ) : (
            <p className="italic text-slate-500">This thought is empty.</p>
          )}
        </div>

        <ThoughtAttribution thought={thought} />
      </article>
    </div>
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
