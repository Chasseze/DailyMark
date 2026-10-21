import type { ThoughtSource } from "../lib/database.types";
import { isAdapted, sourceCredit, sourceWebUrl } from "../lib/thought-source";
import Markdown from "./Markdown";
import { useState } from "react";
import { Link } from "react-router-dom";
import ThoughtChanges from "./ThoughtChanges";

/** Attribution is rendered outside the editable body and survives rewrites. */
export default function ThoughtSourcePanel({
  source,
  title,
  content,
  shared = false,
  showThoughtLink = true,
}: {
  source: ThoughtSource;
  title: string;
  content: string;
  shared?: boolean;
  showThoughtLink?: boolean;
}) {
  const [compareOpen, setCompareOpen] = useState(false);
  const adapted = isAdapted(title, content, source);
  const url = sourceWebUrl(source.snapshot.source_url);
  return (
    <aside
      aria-label="Preserved thought source"
      className="my-4 rounded-xl border border-line bg-surface-2 p-4"
    >
      <p className="text-xs font-semibold uppercase tracking-wider text-accent-ink">
        {adapted
          ? shared
            ? "Personal adaptation · Edited by the note author"
            : "Personal adaptation · Edited by you"
          : "Personal copy · Unedited"}
      </p>
      <p className="mt-2 text-sm text-ink-soft">
        Based on DailyMark’s curated reflection “{source.snapshot.title}”.
      </p>
      <p className="mt-1 text-xs leading-relaxed text-muted">
        Source credit: {sourceCredit(source)}. Additions express the note
        author’s own views.
      </p>
      {url && (
        <a
          href={url}
          target="_blank"
          rel="noreferrer noopener"
          className="mt-2 inline-flex min-h-10 items-center text-sm font-medium text-accent-ink hover:underline"
        >
          View original publication ↗
        </a>
      )}
      {!shared && showThoughtLink && <Link to={`/thoughts/${source.snapshot.id}`} className="mt-2 flex min-h-11 items-center text-sm font-medium text-accent-ink hover:underline">← Back to saved thought</Link>}
      <details className="mt-2" onToggle={(event) => setCompareOpen(event.currentTarget.open)}>
        <summary className="cursor-pointer py-2 text-sm font-medium text-ink">
          Compare with saved source
        </summary>
        <p className="my-2 text-xs text-muted">
          {source.origin === "backup" ? "Restored from a backup. " : ""}
          Source copy captured{" "}
          {new Date(source.captured_at).toLocaleDateString()}. This is the saved
          DailyMark reflection, not a full copy of the linked publication.
        </p>
        {compareOpen && adapted && <ThoughtChanges source={source} title={title} content={content} />}
        {compareOpen && <div role="region" aria-label="Preserved source text" className="max-h-96 overflow-auto rounded-lg border border-line bg-surface p-4 text-sm leading-relaxed text-ink-soft">
          <h2 className="mb-3 text-lg font-semibold text-ink">
            {source.snapshot.title}
          </h2>
          <Markdown>{source.snapshot.content}</Markdown>
        </div>}
      </details>
    </aside>
  );
}
