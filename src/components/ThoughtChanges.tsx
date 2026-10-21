import { useDeferredValue, useMemo } from "react";
import { compareText } from "../lib/text-diff";
import type { ThoughtSource } from "../lib/database.types";

export default function ThoughtChanges({ source, title, content }: { source: ThoughtSource; title: string; content: string }) {
  const deferredContent = useDeferredValue(content);
  const body = useMemo(() => compareText(source.snapshot.content, deferredContent), [source.snapshot.content, deferredContent]);
  return <section aria-label="Highlighted changes" className="my-3 rounded-lg border border-line bg-surface p-3 text-sm text-ink-soft">
    <h3 className="font-semibold text-ink">Highlighted changes</h3>
    <p className="my-2 text-xs text-muted">Added text is highlighted; removed text is crossed out. Markdown formatting is shown as text.</p>
    {title !== source.snapshot.title && <div className="mb-3 break-words">
      <p className="mb-1 text-xs font-semibold text-muted">Title</p>
      <del className="bg-danger-soft text-danger">{source.snapshot.title}</del>{" → "}
      <ins className="bg-accent-soft text-accent-ink no-underline">{title || "Untitled"}</ins>
    </div>}
    <div className="max-h-96 overflow-auto whitespace-pre-wrap break-words" aria-busy={content !== deferredContent}>
      {body.map((part, index) => part.kind === "removed"
        ? <del key={index} aria-label="Removed text" className="bg-danger-soft text-danger">{part.text}</del>
        : part.kind === "added"
          ? <ins key={index} aria-label="Added text" className="bg-accent-soft text-accent-ink no-underline">{part.text}</ins>
          : <span key={index}>{part.text}</span>)}
    </div>
  </section>;
}
