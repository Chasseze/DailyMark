/**
 * Pure text transforms behind the editor's formatting toolbar, shortcuts and
 * smart Enter/Tab handling. Each returns a range to replace plus where the
 * selection should land, so the component can apply it through the browser's
 * own insert-text command and keep native undo intact.
 */

export interface MdEdit {
  /** Range of the current value to replace. */
  start: number;
  end: number;
  /** Replacement text for that range. */
  text: string;
  /** Selection in the resulting value. */
  selectionStart: number;
  selectionEnd: number;
}

interface LineSpec {
  /** Matches the prefix this spec owns, on a line with indent removed. */
  test: RegExp;
  /** Competing prefixes cleared before this one is applied. */
  strip: RegExp;
  /** Prefix for the nth affected line. */
  build: (index: number) => string;
}

const LIST_PREFIX = /^(?:[-*+]|\d{1,9}[.)])[ \t]+(?:\[[ xX]\][ \t]+)?/;

export const BULLET: LineSpec = {
  test: /^[-*+][ \t]+/,
  strip: LIST_PREFIX,
  build: () => "- ",
};

export const NUMBERED: LineSpec = {
  test: /^\d{1,9}[.)][ \t]+/,
  strip: LIST_PREFIX,
  build: (i) => `${i + 1}. `,
};

export const TASK: LineSpec = {
  test: /^[-*+][ \t]+\[[ xX]\][ \t]+/,
  strip: LIST_PREFIX,
  build: () => "- [ ] ",
};

export const QUOTE: LineSpec = {
  test: /^>[ \t]?/,
  strip: /^>[ \t]?/,
  build: () => "> ",
};

export function heading(level: number): LineSpec {
  return {
    test: new RegExp(`^#{${level}}[ \\t]+`),
    strip: /^#{1,6}[ \t]+/,
    build: () => "#".repeat(level) + " ",
  };
}

/** Applies an edit to a value — the same thing the textarea ends up with. */
export function applyMdEdit(value: string, edit: MdEdit): string {
  return value.slice(0, edit.start) + edit.text + value.slice(edit.end);
}

function lineBounds(value: string, start: number, end: number): [number, number] {
  const from = value.lastIndexOf("\n", start - 1) + 1;
  const nextBreak = value.indexOf("\n", end);
  // A selection ending exactly on a line break shouldn't drag the next line in.
  const to = nextBreak === -1 ? value.length : nextBreak;
  return [from, Math.max(from, to)];
}

/** Wraps or unwraps the selection with an inline marker such as `**`. */
export function toggleWrap(value: string, start: number, end: number, marker: string): MdEdit {
  const len = marker.length;
  const selected = value.slice(start, end);

  if (value.slice(start - len, start) === marker && value.slice(end, end + len) === marker) {
    return {
      start: start - len,
      end: end + len,
      text: selected,
      selectionStart: start - len,
      selectionEnd: start - len + selected.length,
    };
  }

  if (selected.length >= len * 2 && selected.startsWith(marker) && selected.endsWith(marker)) {
    const inner = selected.slice(len, -len);
    return { start, end, text: inner, selectionStart: start, selectionEnd: start + inner.length };
  }

  if (!selected) {
    return {
      start,
      end,
      text: marker + marker,
      selectionStart: start + len,
      selectionEnd: start + len,
    };
  }

  // Whitespace stays outside the markers — `** bold **` is not emphasis.
  const [, lead, core, trail] = /^(\s*)([\s\S]*?)(\s*)$/.exec(selected)!;
  if (!core) {
    return { start, end, text: selected, selectionStart: start, selectionEnd: end };
  }

  return {
    start,
    end,
    text: lead + marker + core + marker + trail,
    selectionStart: start + lead.length + len,
    selectionEnd: start + lead.length + len + core.length,
  };
}

/** Adds a line prefix to every selected line, or removes it if all have it. */
export function toggleLines(value: string, start: number, end: number, spec: LineSpec): MdEdit {
  const [from, to] = lineBounds(value, start, end);
  const lines = value.slice(from, to).split("\n");

  const parsed = lines.map((line) => {
    const indent = /^[ \t]*/.exec(line)![0];
    return { indent, body: line.slice(indent.length) };
  });

  const filled = parsed.filter((l) => l.body !== "");
  const targets = filled.length ? filled : parsed;
  const remove = targets.every((l) => spec.test.test(l.body));

  let n = 0;
  const next = parsed.map((l) => {
    if (l.body === "" && filled.length) return l.indent;
    if (remove) return l.indent + l.body.replace(spec.test, "");
    return l.indent + spec.build(n++) + l.body.replace(spec.strip, "");
  });

  const text = next.join("\n");
  const caret = start === end ? caretAfterLineEdit(value, start, from, lines, next) : null;

  return {
    start: from,
    end: to,
    text,
    selectionStart: caret ?? from,
    selectionEnd: caret ?? from + text.length,
  };
}

/** Keeps the caret on its own line, shifted by however much the prefix grew. */
function caretAfterLineEdit(
  value: string,
  caret: number,
  from: number,
  before: string[],
  after: string[]
): number {
  const index = value.slice(from, caret).split("\n").length - 1;
  let lineStart = from;
  for (let i = 0; i < index; i++) lineStart += after[i].length + 1;

  const offsetInOldLine = caret - (from + before.slice(0, index).reduce((n, l) => n + l.length + 1, 0));
  const delta = after[index].length - before[index].length;
  const offset = Math.min(after[index].length, Math.max(0, offsetInOldLine + delta));

  return lineStart + offset;
}

const URL_LIKE = /^(?:https?:\/\/|mailto:|www\.)\S+$/i;

/** `[text](url)` around the selection, with the useful half preselected. */
export function insertLink(value: string, start: number, end: number, url?: string): MdEdit {
  const selected = value.slice(start, end).trim();

  if (url) {
    const label = selected || "link";
    const text = `[${label}](${url})`;
    return {
      start,
      end,
      text,
      selectionStart: start + 1,
      selectionEnd: start + 1 + label.length,
    };
  }

  if (selected && URL_LIKE.test(selected)) {
    const text = `[text](${selected})`;
    return { start, end, text, selectionStart: start + 1, selectionEnd: start + 5 };
  }

  const label = selected || "text";
  const text = `[${label}](url)`;
  const urlStart = start + label.length + 3;
  return {
    start,
    end,
    text,
    selectionStart: selected ? urlStart : start + 1,
    selectionEnd: selected ? urlStart + 3 : start + 1 + label.length,
  };
}

/** Fenced code block around the selection, always on its own lines. */
export function insertCodeBlock(value: string, start: number, end: number): MdEdit {
  const [from, to] = lineBounds(value, start, end);
  const body = value.slice(from, to);
  const lead = from > 0 && value[from - 1] !== "\n" ? "\n" : "";
  const text = `${lead}\`\`\`\n${body}\n\`\`\``;

  return {
    start: from,
    end: to,
    text,
    selectionStart: from + lead.length + 4,
    selectionEnd: from + lead.length + 4 + body.length,
  };
}

/** A GFM table skeleton with the first header cell selected. */
export function insertTable(value: string, start: number, end: number): MdEdit {
  const [from] = lineBounds(value, start, end);
  const lead = from > 0 ? "\n" : "";
  const table = "| Column | Column |\n| --- | --- |\n|  |  |\n";
  const text = lead + table;

  return {
    start: from,
    end: from,
    text,
    selectionStart: from + lead.length + 2,
    selectionEnd: from + lead.length + 8,
  };
}

const LINE_STRUCTURE =
  /^([ \t]*)((?:>[ \t]?)*)((?:[-*+]|\d{1,9}[.)])[ \t]+)?(\[[ xX]\][ \t]+)?([\s\S]*)$/;

/**
 * Enter inside a list, task list or quote carries the marker to the next line;
 * Enter on an empty item drops out of the list instead of nesting forever.
 * Returns null when the caret isn't in such a block, so Enter stays Enter.
 */
export function continueList(value: string, caret: number): MdEdit | null {
  const lineStart = value.lastIndexOf("\n", caret - 1) + 1;
  const lineBreak = value.indexOf("\n", caret);
  const line = value.slice(lineStart, lineBreak === -1 ? value.length : lineBreak);

  const m = LINE_STRUCTURE.exec(line);
  if (!m) return null;

  const [, indent, quote, bullet, task, body] = m;
  if (!quote && !bullet) return null;

  if (body.trim() === "") {
    return { start: lineStart, end: caret, text: "", selectionStart: lineStart, selectionEnd: lineStart };
  }

  let marker = bullet ?? "";
  const numbered = /^(\d{1,9})([.)][ \t]+)$/.exec(marker);
  if (numbered) marker = `${Number(numbered[1]) + 1}${numbered[2]}`;

  const prefix = indent + quote + marker + (task ? "[ ] " : "");
  const caretAfter = caret + 1 + prefix.length;

  return {
    start: caret,
    end: caret,
    text: "\n" + prefix,
    selectionStart: caretAfter,
    selectionEnd: caretAfter,
  };
}

/** Markdown that only means what it says at the very start of a line. */
const BLOCK_START = /^(?:#{1,6}[ \t]|[-*+][ \t]|\d{1,9}[.)][ \t]|>|```|~~~|\||---)/;

/**
 * Drops converted Markdown in at the caret, padding it with blank lines when it
 * needs them. Without this, pasting a formatted document at the end of a line
 * welds its first heading or bullet onto that line, where the syntax is inert
 * and the formatting is silently lost.
 */
export function pasteMarkdown(value: string, start: number, end: number, markdown: string): MdEdit {
  const before = value.slice(0, start);
  const after = value.slice(end);
  const block = markdown.includes("\n") || BLOCK_START.test(markdown);

  const lead = block && before !== "" && !/\n[ \t]*$/.test(before) ? "\n\n" : "";
  const trail = block && after !== "" && !/^[ \t]*\n/.test(after) ? "\n\n" : "";
  const text = lead + markdown + trail;
  const caret = start + lead.length + markdown.length;

  return { start, end, text, selectionStart: caret, selectionEnd: caret };
}

/** Indents or outdents the selected lines by two spaces. */
export function indentLines(value: string, start: number, end: number, direction: 1 | -1): MdEdit {
  const [from, to] = lineBounds(value, start, end);
  const lines = value.slice(from, to).split("\n");

  const next = lines.map((line) => {
    if (direction === 1) return "  " + line;
    return line.replace(/^(?: {1,2}|\t)/, "");
  });

  const text = next.join("\n");
  const shift = next[0].length - lines[0].length;

  if (start === end) {
    const caret = Math.max(from, start + shift);
    return { start: from, end: to, text, selectionStart: caret, selectionEnd: caret };
  }

  return {
    start: from,
    end: to,
    text,
    selectionStart: Math.max(from, start + shift),
    selectionEnd: from + text.length,
  };
}

/** True when Tab should indent instead of moving focus out of the editor. */
export function inListContext(value: string, start: number, end: number): boolean {
  if (start !== end) return true;
  const lineStart = value.lastIndexOf("\n", start - 1) + 1;
  const line = value.slice(lineStart, start);
  return /^[ \t]*(?:[-*+]|\d{1,9}[.)])[ \t]/.test(line);
}

/**
 * Flips the `- [ ]` / `- [x]` checkbox on a given 1-based source line, which is
 * what the renderer reports for the task item that was clicked. Returns null
 * when that line holds no checkbox.
 */
export function toggleTaskAtLine(value: string, line: number): string | null {
  const lines = value.split("\n");
  const index = line - 1;
  if (index < 0 || index >= lines.length) return null;

  const m = /^([ \t]*(?:[-*+]|\d{1,9}[.)])[ \t]+\[)([ xX])(\])/.exec(lines[index]);
  if (!m) return null;

  lines[index] = m[1] + (m[2] === " " ? "x" : " ") + m[3] + lines[index].slice(m[0].length);
  return lines.join("\n");
}
