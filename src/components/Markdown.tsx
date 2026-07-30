import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

interface Props {
  children: string;
  /** Tighter spacing, for note cards and other previews. */
  compact?: boolean;
  className?: string;
  /** Receives the index of the task checkbox that was clicked, if interactive. */
  onToggleTask?: (index: number) => void;
}

/**
 * The single place Markdown becomes rich text. GitHub-flavoured syntax —
 * tables, strikethrough, task lists, autolinks — is on everywhere the app shows
 * note content, so what you type is what you see without opting in.
 */
export default function Markdown({ children, compact = false, className = "", onToggleTask }: Props) {
  // Rebuilt every render so the checkbox counter restarts with the document.
  let taskIndex = 0;

  const components: Components = {
    a({ href, title, children }) {
      return (
        <a href={href} title={title} target="_blank" rel="noreferrer noopener">
          {children}
        </a>
      );
    },
    input({ type, checked }) {
      // The only input Markdown produces is a task-list checkbox.
      if (type !== "checkbox") return null;
      const index = taskIndex++;
      return (
        <input
          type="checkbox"
          checked={Boolean(checked)}
          className="md-task-checkbox"
          disabled={!onToggleTask}
          readOnly={!onToggleTask}
          onChange={() => onToggleTask?.(index)}
        />
      );
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
