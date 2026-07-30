import { createContext, useContext } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

interface Props {
  children: string;
  /** Tighter spacing, for note cards and other previews. */
  compact?: boolean;
  className?: string;
  /** Receives the source line of the task checkbox that was clicked. */
  onToggleTask?: (line: number) => void;
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
export default function Markdown({ children, compact = false, className = "", onToggleTask }: Props) {
  const components: Components = {
    a({ href, title, children: label }) {
      return (
        <a href={href} title={title} target="_blank" rel="noreferrer noopener">
          {label}
        </a>
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
        {children}
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
