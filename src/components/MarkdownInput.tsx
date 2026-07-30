import { useMemo, useRef } from "react";
import { tokenizeMarkdown } from "../lib/markdown";
import {
  applyEdit,
  continueBlock,
  indentBlock,
  insertCodeBlock,
  insertLink,
  togglePrefix,
  toggleWrap,
  type TextEdit,
} from "../lib/markdownEditing";

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

interface ToolbarAction {
  label: string;
  title: string;
  run: (value: string, start: number, end: number) => TextEdit;
}

const TOOLBAR: ToolbarAction[] = [
  { label: "H", title: "Heading (## )", run: (v, s, e) => togglePrefix(v, s, e, "## ") },
  { label: "B", title: "Bold (Ctrl/Cmd+B)", run: (v, s, e) => toggleWrap(v, s, e, "**", "bold") },
  { label: "I", title: "Italic (Ctrl/Cmd+I)", run: (v, s, e) => toggleWrap(v, s, e, "*", "italic") },
  { label: "S", title: "Strikethrough", run: (v, s, e) => toggleWrap(v, s, e, "~~", "struck") },
  { label: "`", title: "Inline code (Ctrl/Cmd+E)", run: (v, s, e) => toggleWrap(v, s, e, "`", "code") },
  { label: "•", title: "Bullet list", run: (v, s, e) => togglePrefix(v, s, e, "- ") },
  { label: "☑", title: "Task item", run: (v, s, e) => togglePrefix(v, s, e, "- [ ] ") },
  { label: "❝", title: "Quote", run: (v, s, e) => togglePrefix(v, s, e, "> ") },
  { label: "🔗", title: "Link (Ctrl/Cmd+K)", run: insertLink },
  { label: "{}", title: "Code block", run: insertCodeBlock },
];

const RE_LIST_LINE = /^\s*(?:[-*+]|\d{1,9}[.)])\s/;

/**
 * The composing surface. A mirrored, tokenized copy of the text sits behind a
 * transparent textarea, so markdown is recognized and painted as it is typed
 * while the caret, selection and native undo stay with the real textarea.
 */
export default function MarkdownInput({ value, onChange, placeholder }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const lines = useMemo(() => tokenizeMarkdown(value), [value]);

  const run = (action: (v: string, s: number, e: number) => TextEdit | null) => {
    const el = ref.current;
    if (!el) return false;
    const edit = action(el.value, el.selectionStart, el.selectionEnd);
    if (!edit) return false;
    applyEdit(el, edit);
    return true;
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const el = event.currentTarget;
    const mod = event.metaKey || event.ctrlKey;

    if (mod && !event.altKey) {
      const key = event.key.toLowerCase();
      const shortcut: Record<string, (v: string, s: number, e: number) => TextEdit> = {
        b: (v, s, e) => toggleWrap(v, s, e, "**", "bold"),
        i: (v, s, e) => toggleWrap(v, s, e, "*", "italic"),
        e: (v, s, e) => toggleWrap(v, s, e, "`", "code"),
        k: insertLink,
      };
      if (shortcut[key]) {
        event.preventDefault();
        run(shortcut[key]);
      }
      return;
    }

    if (event.key === "Enter" && !event.shiftKey && !mod) {
      if (el.selectionStart !== el.selectionEnd) return;
      if (run((v, s) => continueBlock(v, s))) event.preventDefault();
      return;
    }

    if (event.key === "Tab") {
      // Tab keeps its usual "move focus" job unless it would indent a list item
      // or a multi-line selection, so keyboard navigation isn't trapped here.
      const lineStart = el.value.lastIndexOf("\n", el.selectionStart - 1) + 1;
      const inList = RE_LIST_LINE.test(el.value.slice(lineStart, el.selectionEnd));
      const multiline = el.value.slice(el.selectionStart, el.selectionEnd).includes("\n");
      if (!inList && !multiline) return;
      event.preventDefault();
      run((v, s, e) => indentBlock(v, s, e, event.shiftKey));
    }
  };

  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-1">
        {TOOLBAR.map((action) => (
          <button
            key={action.label}
            type="button"
            title={action.title}
            aria-label={action.title}
            // Keeping the mousedown default would blur the textarea and drop the
            // selection the action needs.
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => run(action.run)}
            className="md-tool"
          >
            {action.label}
          </button>
        ))}
      </div>

      <div className="md-input">
        <pre className="md-input__mirror" aria-hidden="true">
          {!value && placeholder ? <span className="md-t md-t--placeholder">{placeholder}</span> : null}
          {lines.map((line, i) => (
            <span key={i} className={"md-line md-line--" + line.block}>
              {line.tokens.map((token, j) => (
                <span key={j} className={"md-t md-t--" + token.kind}>
                  {token.text}
                </span>
              ))}
              {"\n"}
            </span>
          ))}
        </pre>
        <textarea
          ref={ref}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={handleKeyDown}
          spellCheck
          className="md-input__area"
          aria-label="Note content in Markdown"
        />
      </div>
    </div>
  );
}
