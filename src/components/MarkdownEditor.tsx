import { useDeferredValue, useEffect, useRef, useState, type ClipboardEvent, type KeyboardEvent } from "react";
import Markdown from "./Markdown";
import MarkdownHighlight from "./MarkdownHighlight";
import MarkdownToolbar, { type MdCommand } from "./MarkdownToolbar";
import { useAuth } from "../context/auth-context";
import { hasRichFormatting, htmlToMarkdown } from "../lib/html-to-markdown";
import { looksLikeMarkdown } from "../lib/markdown";
import { uploadNoteImage } from "../lib/note-images";
import { errorMessage } from "../lib/supabase";
import {
  BULLET,
  NUMBERED,
  QUOTE,
  TASK,
  applyMdEdit,
  continueList,
  heading,
  inListContext,
  indentLines,
  insertCodeBlock,
  insertImage,
  insertLink,
  insertTable,
  insertWikiLink,
  pasteMarkdown,
  toggleLines,
  toggleTaskAtLine,
  toggleWrap,
  type MdEdit,
} from "../lib/markdown-edit";

interface Props {
  content: string;
  onChange: (content: string) => void;
  /** When set, the image toolbar can upload into Storage for this note. */
  noteId?: string;
  /** Enables `[[Note title]]` resolution in the rich preview. */
  notes?: ReadonlyArray<{ id: string; title: string }>;
}

type View = "live" | "source" | "preview";

const VIEWS: { id: View; label: string }[] = [
  { id: "live", label: "Live" },
  { id: "source", label: "Source" },
  { id: "preview", label: "Preview" },
];

const SHORTCUTS: Record<string, MdCommand> = { b: "bold", i: "italic", k: "link", e: "code" };

function editFor(command: MdCommand, value: string, start: number, end: number): MdEdit {
  switch (command) {
    case "bold":
      return toggleWrap(value, start, end, "**");
    case "italic":
      return toggleWrap(value, start, end, "*");
    case "strike":
      return toggleWrap(value, start, end, "~~");
    case "h1":
      return toggleLines(value, start, end, heading(1));
    case "h2":
      return toggleLines(value, start, end, heading(2));
    case "bullet":
      return toggleLines(value, start, end, BULLET);
    case "numbered":
      return toggleLines(value, start, end, NUMBERED);
    case "task":
      return toggleLines(value, start, end, TASK);
    case "quote":
      return toggleLines(value, start, end, QUOTE);
    case "code": {
      const selected = value.slice(start, end);
      return selected && !selected.includes("\n")
        ? toggleWrap(value, start, end, "`")
        : insertCodeBlock(value, start, end);
    }
    case "link":
      return insertLink(value, start, end);
    case "noteLink":
      return insertWikiLink(value, start, end);
    case "image":
      // Handled asynchronously in the editor (file picker / upload).
      return insertImage(value, start, end, "https://", "image");
    case "table":
      return insertTable(value, start, end);
  }
}

/**
 * Replaces the current selection through the browser's own editing pipeline, so
 * ⌘Z still undoes a toolbar action — assigning the value straight to state
 * would throw the textarea's undo history away. Returns false when the command
 * isn't available and the caller has to fall back to a plain state update.
 */
function insertOverSelection(text: string): boolean {
  try {
    // Inserting an empty string is a no-op, so deletions use `delete`.
    return text ? document.execCommand("insertText", false, text) : document.execCommand("delete");
  } catch {
    return false;
  }
}

export default function MarkdownEditor({ content, onChange, noteId, notes }: Props) {
  const { user } = useAuth();
  const [view, setView] = useState<View>("live");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const pendingSelection = useRef<[number, number] | null>(null);

  // Selection has to be restored after React has committed the new value, or
  // the caret snaps back to wherever the re-render left it.
  useEffect(() => {
    const el = areaRef.current;
    const selection = pendingSelection.current;
    if (!el || !selection) return;
    pendingSelection.current = null;
    el.setSelectionRange(selection[0], selection[1]);
  }, [content]);

  const apply = (edit: MdEdit) => {
    const el = areaRef.current;
    if (!el) return;

    el.focus();
    el.setSelectionRange(edit.start, edit.end);
    pendingSelection.current = [edit.selectionStart, edit.selectionEnd];

    if (!insertOverSelection(edit.text)) onChange(applyMdEdit(el.value, edit));

    el.setSelectionRange(edit.selectionStart, edit.selectionEnd);
  };

  const runCommand = (command: MdCommand) => {
    if (command === "image") {
      if (noteId && user) {
        fileRef.current?.click();
        return;
      }
      const el = areaRef.current;
      if (!el) return;
      apply(insertImage(el.value, el.selectionStart, el.selectionEnd, "https://", "image"));
      return;
    }
    const el = areaRef.current;
    if (!el) return;
    apply(editFor(command, el.value, el.selectionStart, el.selectionEnd));
  };

  const handleImageFile = async (file: File | undefined) => {
    if (!file || !noteId || !user) return;
    setUploadError(null);
    try {
      const url = await uploadNoteImage(user.id, noteId, file);
      const el = areaRef.current;
      if (!el) {
        onChange(content + (content.endsWith("\n") || !content ? "" : "\n") + `![${file.name}](${url})\n`);
        return;
      }
      const alt = file.name.replace(/\.[^.]+$/, "") || "image";
      apply(insertImage(el.value, el.selectionStart, el.selectionEnd, url, alt));
    } catch (err) {
      setUploadError(errorMessage(err));
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    const el = event.currentTarget;
    const mod = event.metaKey || event.ctrlKey;

    if (mod && !event.altKey) {
      const command = SHORTCUTS[event.key.toLowerCase()];
      if (command) {
        event.preventDefault();
        runCommand(command);
        return;
      }
    }

    if (event.key === "Enter" && !event.shiftKey && !mod && el.selectionStart === el.selectionEnd) {
      const edit = continueList(el.value, el.selectionStart);
      if (edit) {
        event.preventDefault();
        apply(edit);
      }
      return;
    }

    // Tab only steals focus when there's a list to indent, so keyboard users can
    // still leave the editor.
    if (event.key === "Tab" && inListContext(el.value, el.selectionStart, el.selectionEnd)) {
      event.preventDefault();
      apply(indentLines(el.value, el.selectionStart, el.selectionEnd, event.shiftKey ? -1 : 1));
    }
  };

  const handlePaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    const el = event.currentTarget;
    const { selectionStart: start, selectionEnd: end } = el;
    const plain = event.clipboardData.getData("text/plain");
    const html = event.clipboardData.getData("text/html");
    const image = [...event.clipboardData.items].find((item) => item.type.startsWith("image/"));

    if (image && noteId && user) {
      const file = image.getAsFile();
      if (file) {
        event.preventDefault();
        void handleImageFile(file);
        return;
      }
    }

    // A URL dropped onto selected text becomes a link around that text.
    if (plain && start !== end && /^(?:https?:\/\/|mailto:)\S+$/i.test(plain.trim())) {
      event.preventDefault();
      apply(insertLink(el.value, start, end, plain.trim()));
      return;
    }

    // Rich text from another app arrives as HTML: keep the formatting by
    // converting it, unless the plain flavour is already Markdown.
    if (!html || !hasRichFormatting(html) || looksLikeMarkdown(plain)) return;

    const markdown = htmlToMarkdown(html);
    if (!markdown || markdown === plain.trim()) return;

    event.preventDefault();
    apply(pasteMarkdown(el.value, start, end, markdown));
  };

  const handleToggleTask = (line: number) => {
    const next = toggleTaskAtLine(content, line);
    if (next !== null) onChange(next);
  };

  const showSource = view !== "preview";
  const showRich = view !== "source";
  // Keep the textarea live; defer the expensive remark render so typing stays smooth.
  const deferredContent = useDeferredValue(content);
  const richContent = view === "live" ? deferredContent : content;

  return (
    <div>
      <div className="mb-2 flex gap-1 rounded-xl bg-slate-800/50 p-1 light:bg-slate-100">
        {VIEWS.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => setView(option.id)}
            aria-pressed={view === option.id}
            className={
              "flex-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-all " +
              (view === option.id
                ? "bg-amber-500/20 text-amber-400"
                : "text-slate-400 hover:text-slate-200 light:hover:text-slate-700")
            }
          >
            {option.label}
          </button>
        ))}
      </div>

      {showSource && <MarkdownToolbar onCommand={runCommand} />}
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          void handleImageFile(file);
        }}
      />
      {uploadError && (
        <p className="mb-2 text-xs text-red-400">{uploadError}</p>
      )}

      <div className={view === "live" ? "grid min-w-0 grid-cols-1 gap-3 md:grid-cols-2" : "block min-w-0"}>
        {showSource && (
          <div className="min-w-0">
            {view === "live" && <PaneLabel>Markdown</PaneLabel>}
            <div className="md-editor-surface rounded-2xl border border-white/5 bg-slate-900/50 focus-within:border-amber-500/30 light:border-slate-200 light:bg-slate-50">
              <MarkdownHighlight source={content} />
              <textarea
                ref={areaRef}
                value={content}
                onChange={(e) => onChange(e.target.value)}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                placeholder="Start writing — # headings, **bold**, - lists and `code` format as you type…"
                aria-label="Note content in Markdown"
                spellCheck
                className="md-editor-input placeholder-slate-500 light:placeholder-slate-400"
              />
            </div>
          </div>
        )}

        {showRich && (
          <div className="min-w-0">
            {view === "live" && <PaneLabel>Rich text</PaneLabel>}
            <div className="min-h-[14rem] min-w-0 overflow-x-clip rounded-2xl border border-white/5 bg-slate-900/30 p-4 text-sm text-slate-300 light:border-slate-200 light:bg-slate-50 light:text-slate-700">
              {richContent.trim() ? (
                <Markdown notes={notes} onToggleTask={handleToggleTask}>
                  {richContent}
                </Markdown>
              ) : (
                <p className="italic text-slate-500">Rich text appears here as you type…</p>
              )}
            </div>
          </div>
        )}
      </div>

      <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
        Markdown is always on: syntax is styled as you type, pasted rich text is converted, and
        Enter carries lists forward. Link another note with{" "}
        <span className="font-mono text-slate-400">[[Exact title]]</span> (toolbar: Note link) —
        matching titles become clickable in preview and when you open the note.
      </p>
    </div>
  );
}

function PaneLabel({ children }: { children: string }) {
  return (
    <p className="mb-1 px-1 text-[10px] font-medium uppercase tracking-wider text-slate-500">
      {children}
    </p>
  );
}
