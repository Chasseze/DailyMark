export type MdCommand =
  | "bold"
  | "italic"
  | "strike"
  | "h1"
  | "h2"
  | "bullet"
  | "numbered"
  | "task"
  | "quote"
  | "code"
  | "link"
  | "noteLink"
  | "image"
  | "table";

interface Tool {
  command: MdCommand;
  glyph: string;
  name: string;
  shortcut?: string;
  glyphClass?: string;
}

const TOOLS: Tool[] = [
  { command: "bold", glyph: "B", name: "Bold", shortcut: "B", glyphClass: "font-bold" },
  { command: "italic", glyph: "I", name: "Italic", shortcut: "I", glyphClass: "italic" },
  { command: "strike", glyph: "S", name: "Strikethrough", glyphClass: "line-through" },
  { command: "h1", glyph: "H1", name: "Heading 1" },
  { command: "h2", glyph: "H2", name: "Heading 2" },
  { command: "bullet", glyph: "•", name: "Bullet list" },
  { command: "numbered", glyph: "1.", name: "Numbered list" },
  { command: "task", glyph: "☑", name: "Task list" },
  { command: "quote", glyph: "❝", name: "Quote" },
  { command: "code", glyph: "‹›", name: "Code", shortcut: "E" },
  { command: "link", glyph: "🔗", name: "Link", shortcut: "K" },
  { command: "noteLink", glyph: "[[ ]]", name: "Note link", glyphClass: "font-mono tracking-tight" },
  { command: "image", glyph: "▣", name: "Image" },
  { command: "table", glyph: "▦", name: "Table" },
];

const MOD = typeof navigator !== "undefined" && /Mac|iP(hone|ad|od)/.test(navigator.userAgent) ? "⌘" : "Ctrl+";

interface Props {
  onCommand: (command: MdCommand) => void;
  disabled?: boolean;
}

export default function MarkdownToolbar({ onCommand, disabled = false }: Props) {
  return (
    <div
      role="toolbar"
      aria-label="Markdown formatting"
      className="-mx-1 mb-2 flex items-center gap-0.5 overflow-x-auto px-1 pb-1"
    >
      {TOOLS.map((tool) => (
        <button
          key={tool.command}
          type="button"
          // Keeps the caret in the textarea, so the command has a selection to work on.
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onCommand(tool.command)}
          disabled={disabled}
          title={tool.shortcut ? `${tool.name} (${MOD}${tool.shortcut})` : tool.name}
          aria-label={tool.name}
          className="shrink-0 rounded-lg px-2.5 py-1.5 text-xs text-muted transition-colors hover:bg-accent-soft hover:text-accent disabled:opacity-40"
        >
          <span className={tool.glyphClass}>{tool.glyph}</span>
        </button>
      ))}
    </div>
  );
}
