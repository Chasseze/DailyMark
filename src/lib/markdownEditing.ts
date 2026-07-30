/**
 * Text transforms behind the editor's markdown awareness: continuing lists and
 * quotes on Enter, indenting items with Tab, and toggling inline/block markers
 * from the toolbar or keyboard shortcuts.
 *
 * Every helper is pure — it returns the range to replace plus where the caret
 * should land — so the caller can apply it in a way that keeps native undo.
 */

export interface TextEdit {
  /** Range in the current value to replace. */
  start: number;
  end: number;
  text: string;
  /** Caret/selection in the resulting value. */
  selectionStart: number;
  selectionEnd: number;
}

const RE_LIST = /^(\s*)(?:([-*+])|(\d{1,9})([.)]))(\s+)(\[[ xX]\]\s+)?/;
const RE_QUOTE = /^(\s*>+\s?)/;

function lineStartOf(value: string, at: number) {
  return value.lastIndexOf("\n", at - 1) + 1;
}

function lineEndOf(value: string, at: number) {
  const next = value.indexOf("\n", at);
  return next === -1 ? value.length : next;
}

/**
 * Line-oriented edits move a caret along with its line, but grow an existing
 * selection to cover every line they touched — including the markers they added.
 */
function lineEdit(
  selectionStart: number,
  selectionEnd: number,
  start: number,
  end: number,
  text: string,
  caretDelta: number
): TextEdit {
  if (selectionStart === selectionEnd) {
    const caret = Math.max(start, selectionStart + caretDelta);
    return { start, end, text, selectionStart: caret, selectionEnd: caret };
  }
  return { start, end, text, selectionStart: start, selectionEnd: start + text.length };
}

/**
 * Enter inside a list item or blockquote carries the marker to the next line;
 * Enter on an item that is still empty removes the marker instead, which is how
 * you leave a list without reaching for backspace.
 *
 * Returns null when the caret is not in a marked block, so the browser's own
 * newline handling stays in charge.
 */
export function continueBlock(value: string, caret: number): TextEdit | null {
  const start = lineStartOf(value, caret);
  const line = value.slice(start, lineEndOf(value, caret));
  const beforeCaret = value.slice(start, caret);

  const list = RE_LIST.exec(beforeCaret);
  if (list) {
    const [prefix, indent, bullet, digits, delim, space, task] = list;
    const emptyItem = beforeCaret.length === prefix.length && line.length === prefix.length;
    if (emptyItem) {
      return { start, end: caret, text: "", selectionStart: start, selectionEnd: start };
    }
    const marker = bullet ?? `${Number(digits) + 1}${delim}`;
    const next = `\n${indent}${marker}${space}${task ? "[ ] " : ""}`;
    const at = caret + next.length;
    return { start: caret, end: caret, text: next, selectionStart: at, selectionEnd: at };
  }

  const quote = RE_QUOTE.exec(beforeCaret);
  if (quote) {
    const prefix = quote[1];
    if (beforeCaret.length === prefix.length && line.length === prefix.length) {
      return { start, end: caret, text: "", selectionStart: start, selectionEnd: start };
    }
    const next = `\n${prefix}`;
    const at = caret + next.length;
    return { start: caret, end: caret, text: next, selectionStart: at, selectionEnd: at };
  }

  return null;
}

/** Tab / Shift-Tab on the selected lines, two spaces at a time. */
export function indentBlock(
  value: string,
  selectionStart: number,
  selectionEnd: number,
  outdent: boolean
): TextEdit {
  const start = lineStartOf(value, selectionStart);
  const end = lineEndOf(value, selectionEnd);
  const lines = value.slice(start, end).split("\n");

  let firstDelta = 0;
  const next = lines
    .map((line, i) => {
      if (outdent) {
        const removed = /^ {1,2}/.exec(line)?.[0].length ?? 0;
        if (i === 0) firstDelta = -removed;
        return line.slice(removed);
      }
      if (i === 0) firstDelta = 2;
      return "  " + line;
    })
    .join("\n");

  return lineEdit(selectionStart, selectionEnd, start, end, next, firstDelta);
}

/**
 * Wraps the selection in `marker` — or unwraps it when the selection is already
 * wrapped, so the same shortcut toggles. With no selection it drops in the
 * markers plus `placeholder` and selects the placeholder.
 */
export function toggleWrap(
  value: string,
  selectionStart: number,
  selectionEnd: number,
  marker: string,
  placeholder: string
): TextEdit {
  const selected = value.slice(selectionStart, selectionEnd);

  if (selected) {
    if (selected.startsWith(marker) && selected.endsWith(marker) && selected.length > marker.length * 2) {
      const inner = selected.slice(marker.length, selected.length - marker.length);
      return {
        start: selectionStart,
        end: selectionEnd,
        text: inner,
        selectionStart,
        selectionEnd: selectionStart + inner.length,
      };
    }
    const outer =
      value.slice(Math.max(0, selectionStart - marker.length), selectionStart) === marker &&
      value.slice(selectionEnd, selectionEnd + marker.length) === marker;
    if (outer) {
      return {
        start: selectionStart - marker.length,
        end: selectionEnd + marker.length,
        text: selected,
        selectionStart: selectionStart - marker.length,
        selectionEnd: selectionStart - marker.length + selected.length,
      };
    }
    return {
      start: selectionStart,
      end: selectionEnd,
      text: marker + selected + marker,
      selectionStart: selectionStart + marker.length,
      selectionEnd: selectionStart + marker.length + selected.length,
    };
  }

  return {
    start: selectionStart,
    end: selectionStart,
    text: marker + placeholder + marker,
    selectionStart: selectionStart + marker.length,
    selectionEnd: selectionStart + marker.length + placeholder.length,
  };
}

/**
 * Adds `prefix` to every selected line, or strips it when all of them already
 * start with it. Used for headings, quotes, bullets and task items.
 */
export function togglePrefix(
  value: string,
  selectionStart: number,
  selectionEnd: number,
  prefix: string
): TextEdit {
  const start = lineStartOf(value, selectionStart);
  const end = lineEndOf(value, selectionEnd);
  const lines = value.slice(start, end).split("\n");
  const hasAll = lines.every((line) => line.trimStart().startsWith(prefix));

  let firstDelta = 0;
  const next = lines
    .map((line, i) => {
      const indent = /^\s*/.exec(line)?.[0] ?? "";
      const body = line.slice(indent.length);
      const updated = hasAll ? indent + body.slice(prefix.length) : indent + prefix + body;
      if (i === 0) firstDelta = updated.length - line.length;
      return updated;
    })
    .join("\n");

  return lineEdit(selectionStart, selectionEnd, start, end, next, firstDelta);
}

/** Turns the selection into a link label, leaving the caret in the URL slot. */
export function insertLink(value: string, selectionStart: number, selectionEnd: number): TextEdit {
  const label = value.slice(selectionStart, selectionEnd) || "link text";
  const text = `[${label}](url)`;
  const urlAt = selectionStart + label.length + 3;
  return {
    start: selectionStart,
    end: selectionEnd,
    text,
    selectionStart: urlAt,
    selectionEnd: urlAt + 3,
  };
}

/** Fenced code block around the selection, language slot ready to type into. */
export function insertCodeBlock(value: string, selectionStart: number, selectionEnd: number): TextEdit {
  const selected = value.slice(selectionStart, selectionEnd);
  const atLineStart = selectionStart === 0 || value[selectionStart - 1] === "\n";
  const lead = atLineStart ? "" : "\n";
  const text = `${lead}\`\`\`\n${selected || ""}\n\`\`\``;
  const langAt = selectionStart + lead.length + 3;
  return {
    start: selectionStart,
    end: selectionEnd,
    text,
    selectionStart: langAt,
    selectionEnd: langAt,
  };
}

/**
 * Applies an edit to a live textarea. `insertText` keeps the browser's undo
 * stack intact; the direct-assignment fallback covers engines that refuse it
 * and still notifies React by way of a native input event.
 */
export function applyEdit(el: HTMLTextAreaElement, edit: TextEdit) {
  el.focus();
  el.setSelectionRange(edit.start, edit.end);

  let inserted: boolean;
  try {
    // `insertText` ignores an empty payload, so a pure deletion needs `delete`.
    inserted =
      edit.text === "" && edit.end > edit.start
        ? document.execCommand("delete")
        : document.execCommand("insertText", false, edit.text);
  } catch {
    inserted = false;
  }

  if (!inserted) {
    const setValue = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
    const next = el.value.slice(0, edit.start) + edit.text + el.value.slice(edit.end);
    setValue?.call(el, next);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }

  el.setSelectionRange(edit.selectionStart, edit.selectionEnd);
}
