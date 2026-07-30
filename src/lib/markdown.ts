/**
 * Markdown understanding that ships with the app instead of living in a
 * preview pane: one tokenizer drives the live syntax painting in the editor,
 * and the same pass is reused to recover the prose a screen reader — or the
 * browser's speech engine — should actually say.
 */

export type MdTokenKind =
  | "text"
  | "syntax"
  | "heading"
  | "strong"
  | "em"
  | "strong-em"
  | "strike"
  | "code"
  | "code-block"
  | "link"
  | "url"
  | "quote"
  | "marker"
  | "task-done"
  | "rule"
  | "table";

export interface MdToken {
  kind: MdTokenKind;
  text: string;
}

/** Kinds that are pure syntax scaffolding, never spoken or read as prose. */
const SILENT_KINDS = new Set<MdTokenKind>(["syntax", "marker", "rule", "table", "url", "code-block"]);

const EMPHASIS: { re: RegExp; kind: MdTokenKind }[] = [
  { re: /^\*\*\*(?!\s)([\s\S]*?[^\s*])\*\*\*/, kind: "strong-em" },
  { re: /^___(?!\s)([\s\S]*?[^\s_])___/, kind: "strong-em" },
  { re: /^\*\*(?!\s)([\s\S]*?[^\s*])\*\*/, kind: "strong" },
  { re: /^__(?!\s)([\s\S]*?[^\s_])__/, kind: "strong" },
  { re: /^\*(?!\s)([\s\S]*?[^\s*])\*/, kind: "em" },
  { re: /^_(?!\s)([\s\S]*?[^\s_])_/, kind: "em" },
  { re: /^~~(?!\s)([\s\S]*?[^\s~])~~/, kind: "strike" },
];

const MARKER_LENGTH: Record<string, number> = { "strong-em": 3, strong: 2, em: 1, strike: 2 };

/**
 * Splits source into one token list per line. Concatenating every token's text
 * reproduces the line character for character — the editor overlay is painted
 * behind a real `<textarea>`, so losing or inventing a single character would
 * drift the caret away from the text under it.
 */
export function tokenizeMarkdown(source: string): MdToken[][] {
  const lines = source.split("\n");
  const out: MdToken[][] = [];
  let fence: string | null = null;

  for (const line of lines) {
    const opener = /^\s{0,3}(```+|~~~+)/.exec(line);
    if (opener) {
      const marker = opener[1][0];
      if (fence === null) {
        fence = marker;
        out.push([{ kind: "syntax", text: line }]);
        continue;
      }
      if (fence === marker) {
        fence = null;
        out.push([{ kind: "syntax", text: line }]);
        continue;
      }
    }
    if (fence !== null) {
      out.push([{ kind: "code-block", text: line }]);
      continue;
    }
    out.push(tokenizeLine(line));
  }

  return out;
}

function tokenizeLine(line: string): MdToken[] {
  if (line === "") return [];

  // Checked before lists so `- - -` reads as a rule rather than a bullet.
  if (/^\s{0,3}([-*_])[ \t]*(?:\1[ \t]*){2,}$/.test(line)) {
    return [{ kind: "rule", text: line }];
  }

  const tokens: MdToken[] = [];
  let rest = line;
  let base: MdTokenKind = "text";

  const quote = /^(\s*(?:>[ \t]?)+)/.exec(rest);
  if (quote) {
    tokens.push({ kind: "syntax", text: quote[1] });
    rest = rest.slice(quote[1].length);
    base = "quote";
  }

  const heading = /^(#{1,6})([ \t]+)([\s\S]*)$/.exec(rest);
  if (heading) {
    tokens.push({ kind: "syntax", text: heading[1] + heading[2] });
    tokens.push(...tokenizeInline(heading[3], "heading"));
    return tokens;
  }

  const list = /^([ \t]*)([-*+]|\d{1,9}[.)])([ \t]+)([\s\S]*)$/.exec(rest);
  if (list) {
    if (list[1]) tokens.push({ kind: "text", text: list[1] });
    tokens.push({ kind: "marker", text: list[2] + list[3] });

    let body = list[4];
    let itemBase: MdTokenKind = base;
    const task = /^\[([ xX])\]([ \t]+)([\s\S]*)$/.exec(body);
    if (task) {
      tokens.push({ kind: "marker", text: `[${task[1]}]${task[2]}` });
      body = task[3];
      if (task[1] !== " ") itemBase = "task-done";
    }

    tokens.push(...tokenizeInline(body, itemBase));
    return tokens;
  }

  if (/^\s*\|/.test(rest)) {
    if (/^[\s|:-]+$/.test(rest)) {
      tokens.push({ kind: "table", text: rest });
      return tokens;
    }
    tokens.push(...tokenizeTableRow(rest, base));
    return tokens;
  }

  tokens.push(...tokenizeInline(rest, base));
  return tokens;
}

function tokenizeTableRow(row: string, base: MdTokenKind): MdToken[] {
  const tokens: MdToken[] = [];
  let cell = "";

  for (const ch of row) {
    if (ch === "|") {
      if (cell) tokens.push(...tokenizeInline(cell, base));
      cell = "";
      tokens.push({ kind: "syntax", text: "|" });
    } else {
      cell += ch;
    }
  }
  if (cell) tokens.push(...tokenizeInline(cell, base));

  return tokens;
}

function tokenizeInline(text: string, base: MdTokenKind): MdToken[] {
  const tokens: MdToken[] = [];
  let plain = "";

  const flush = () => {
    if (plain) {
      tokens.push({ kind: base, text: plain });
      plain = "";
    }
  };

  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    const rest = text.slice(i);

    if (ch === "\\" && i + 1 < text.length) {
      flush();
      tokens.push({ kind: "syntax", text: "\\" });
      tokens.push({ kind: base, text: text[i + 1] });
      i += 2;
      continue;
    }

    if (ch === "`") {
      const m = /^(`+)([\s\S]*?)\1(?!`)/.exec(rest);
      if (m) {
        flush();
        tokens.push({ kind: "syntax", text: m[1] });
        if (m[2]) tokens.push({ kind: "code", text: m[2] });
        tokens.push({ kind: "syntax", text: m[1] });
        i += m[0].length;
        continue;
      }
    }

    if (ch === "!" && rest[1] === "[") {
      const m = /^!\[([^\]]*)\]\(([^)]*)\)/.exec(rest);
      if (m) {
        flush();
        tokens.push({ kind: "syntax", text: "![" });
        if (m[1]) tokens.push({ kind: "text", text: m[1] });
        tokens.push({ kind: "syntax", text: "](" });
        if (m[2]) tokens.push({ kind: "url", text: m[2] });
        tokens.push({ kind: "syntax", text: ")" });
        i += m[0].length;
        continue;
      }
    }

    if (ch === "[") {
      const m = /^\[([^\]]*)\]\(([^)]*)\)/.exec(rest);
      if (m) {
        flush();
        tokens.push({ kind: "syntax", text: "[" });
        tokens.push(...tokenizeInline(m[1], "link"));
        tokens.push({ kind: "syntax", text: "](" });
        if (m[2]) tokens.push({ kind: "url", text: m[2] });
        tokens.push({ kind: "syntax", text: ")" });
        i += m[0].length;
        continue;
      }
    }

    if (ch === "<") {
      const m = /^<((?:https?:\/\/|mailto:)[^>\s]+)>/.exec(rest);
      if (m) {
        flush();
        tokens.push({ kind: "syntax", text: "<" });
        tokens.push({ kind: "url", text: m[1] });
        tokens.push({ kind: "syntax", text: ">" });
        i += m[0].length;
        continue;
      }
    }

    if (ch === "*" || ch === "_" || ch === "~") {
      // Underscores inside identifiers (snake_case) are not emphasis.
      const insideWord = ch === "_" && i > 0 && /[\w]/.test(text[i - 1]);
      if (!insideWord) {
        const hit = EMPHASIS.find((e) => e.re.test(rest));
        if (hit) {
          const m = hit.re.exec(rest)!;
          const markerLength = MARKER_LENGTH[hit.kind];
          const marker = m[0].slice(0, markerLength);
          flush();
          tokens.push({ kind: "syntax", text: marker });
          tokens.push(...tokenizeInline(m[1], hit.kind));
          tokens.push({ kind: "syntax", text: marker });
          i += m[0].length;
          continue;
        }
      }
    }

    if (ch === "h" || ch === "w") {
      const m = /^(?:https?:\/\/|www\.)[^\s<>()"']+/.exec(rest);
      if (m) {
        flush();
        tokens.push({ kind: "url", text: m[0] });
        i += m[0].length;
        continue;
      }
    }

    plain += ch;
    i += 1;
  }

  flush();
  return tokens;
}

/**
 * Reduces Markdown to the prose inside it: syntax, list bullets, table pipes,
 * URLs and fenced code bodies drop out, because "hash hash Groceries, dash
 * milk, https colon slash slash…" is not something anyone wants read to them.
 */
export function markdownToPlainText(markdown: string): string {
  const lines: string[] = [];

  for (const tokens of tokenizeMarkdown(markdown)) {
    let line = "";
    for (const token of tokens) {
      if (token.kind === "syntax" && token.text === "|") {
        line += ", ";
        continue;
      }
      if (SILENT_KINDS.has(token.kind)) continue;
      line += token.text;
    }

    const cleaned = line
      .replace(/\s+/g, " ")
      .replace(/\s+([,.;:!?])/g, "$1")
      // Table pipes become commas, so empty cells leave separators behind.
      .replace(/(,\s*)+/g, ", ")
      .replace(/^[\s,]+/, "")
      .replace(/[\s,]+$/, "");

    if (cleaned) lines.push(cleaned);
  }

  return lines.join("\n");
}

/** First `limit` characters of the prose in a note, for one-line summaries. */
export function markdownExcerpt(markdown: string, limit = 160): string {
  const text = markdownToPlainText(markdown).replace(/\n+/g, " ").trim();
  return text.length > limit ? text.slice(0, limit).trimEnd() + "…" : text;
}

/**
 * Opening lines of a note, cut on line boundaries so a card preview can render
 * them as Markdown without a half-written `**bold` or an orphaned code fence.
 */
export function markdownPreview(markdown: string, limit = 220): string {
  const lines = markdown.replace(/^\s*\n+/, "").split("\n");
  const kept: string[] = [];
  let total = 0;

  for (const line of lines) {
    if (kept.length && total + line.length > limit) break;
    kept.push(line);
    total += line.length + 1;
    if (total > limit) break;
  }

  const preview = kept.join("\n");
  const fences = preview.match(/^\s{0,3}(?:```|~~~)/gm)?.length ?? 0;
  return fences % 2 === 1 ? preview + "\n```" : preview;
}

/** True when the text carries Markdown the app should render as rich text. */
export function looksLikeMarkdown(text: string): boolean {
  return /(^|\n)\s{0,3}(#{1,6}\s|[-*+]\s|\d{1,9}[.)]\s|>\s|```|\|.*\|)|\*\*[^*]+\*\*|__[^_]+__|~~[^~]+~~|\[[^\]]*\]\([^)]*\)|`[^`]+`/.test(
    text
  );
}
