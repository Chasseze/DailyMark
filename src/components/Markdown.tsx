import { createContext, useContext } from "react";
import { Link } from "react-router-dom";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { expandWikiLinks, isInternalNoteHref } from "../lib/wiki-links";

interface Props {
  children: string;
  /** Tighter spacing, for note cards and other previews. */
  compact?: boolean;
  className?: string;
  /** Receives the source line of the task checkbox that was clicked. */
  onToggleTask?: (line: number) => void;
  /** When provided, `[[Note title]]` wiki links resolve to notes. */
  notes?: ReadonlyArray<{ id: string; title: string }>;
}

/**
 * Carries a task item's line in the Markdown source down to its checkbox. The
 * checkbox element is synthesised during rendering and has no source position
 * of its own, and counting checkboxes as they render is not safe: React may
 * render a subtree more than once, which silently shifts the count.
 */
const TaskLineContext = createContext<number | null>(null);

/**
 * The single place Markdown becomes rich text. GitHub-flavoured syntax —
 * tables, strikethrough, task lists, autolinks — is on everywhere the app shows
 * note content, so what you type is what you see without opting in.
 */
export default function Markdown({
  children,
  compact = false,
  className = "",
  onToggleTask,
  notes,
}: Props) {
  const source = notes ? expandWikiLinks(children, notes) : children;

  const components: Components = {
    a({ href, title, children: label }) {
      if (href === "#missing-note") {
        return (
          <span
            className="rounded-sm bg-amber-500/15 px-1 text-amber-300/90 underline decoration-dotted decoration-amber-500/50"
            title="No note with this exact title — rename a note or fix the link"
          >
            {label}
          </span>
        );
      }
      if (isInternalNoteHref(href)) {
        return (
          <Link
            to={href}
            title={title ?? "Open linked note"}
            className="font-medium text-amber-400 underline decoration-amber-400/60 underline-offset-2 hover:text-amber-300"
          >
            {label}
          </Link>
        );
      }
      return (
        <a href={href} title={title} target="_blank" rel="noreferrer noopener">
          {label}
        </a>
      );
    },
    img({ src, alt, title }) {
      if (!src) return null;
      return (
        <img
          src={src}
          alt={alt ?? ""}
          title={title}
          loading="lazy"
          decoding="async"
        />
      );
    },
    li({ node, className: liClass, children: items }) {
      const line = node?.position?.start.line ?? null;
      if (!liClass?.includes("task-list-item") || line === null) {
        return <li className={liClass}>{items}</li>;
      }
      return (
        <li className={liClass}>
          <TaskLineContext.Provider value={line}>{items}</TaskLineContext.Provider>
        </li>
      );
    },
    input({ type, checked }) {
      // The only input Markdown produces is a task-list checkbox.
      if (type !== "checkbox") return null;
      return <TaskCheckbox checked={Boolean(checked)} onToggle={onToggleTask} />;
    },
  };

  return (
    <div className={`prose-custom${compact ? " prose-compact" : ""}${className ? ` ${className}` : ""}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {source}
      </ReactMarkdown>
    </div>
  );
}

function TaskCheckbox({
  checked,
  onToggle,
}: {
  checked: boolean;
  onToggle?: (line: number) => void;
}) {
  const line = useContext(TaskLineContext);
  const interactive = Boolean(onToggle) && line !== null;

  return (
    <input
      type="checkbox"
      checked={checked}
      className="md-task-checkbox"
      disabled={!interactive}
      readOnly={!interactive}
      onChange={() => {
        if (line !== null) onToggle?.(line);
      }}
    />
  );
}
