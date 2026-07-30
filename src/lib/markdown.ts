/**
 * Markdown recognition used while a note is being composed.
 *
 * `tokenizeMarkdown` turns the raw source into per-line tokens so the editor can
 * paint the formatting it recognized behind the caret, and `analyzeMarkdown`
 * summarizes which features were found. Both work on the same single pass over
 * the text, so the editor never disagrees with itself about what it detected.
 *
 * This is deliberately a light-weight scanner rather than a real CommonMark
 * parser: it only needs to be right about the constructs a note author types,
 * and it has to survive being re-run on every keystroke.
 */

export type TokenKind =
  | "text"
  /** Markdown punctuation itself (`#`, `**`, backticks, `>`, `|`, list bullets). */
  | "syntax"
  | "heading"
  | "strong"
  | "em"
  | "strike"
  | "code"
  | "codeblock"
  | "link"
  | "image"
  | "url"
  | "quote"
  | "checkbox"
  | "checkbox-done"
  /** Body text of a completed task item. */
  | "done"
  | "rule"
  | "table-sep";

export interface MarkdownToken {
  kind: TokenKind;
  text: string;
}

export type BlockKind =
  | "blank"
  | "paragraph"
  | "heading"
  | "fence"
  | "code"
  | "bullet"
  | "ordered"
  | "task"
  | "quote"
  | "table"
  | "rule";

export interface MarkdownLine {
  raw: string;
  block: BlockKind;
  /** Heading level for headings, indent depth for list items, otherwise 0. */
  level: number;
  /** True for the delimiter row of a table and for checked task items. */
  flag: boolean;
  tokens: MarkdownToken[];
}

export interface MarkdownStats {
  headings: number;
  bold: number;
  italic: number;
  strikethrough: number;
  inlineCode: number;
  codeBlocks: number;
  links: number;
  images: number;
  bulletItems: number;
  orderedItems: number;
  tasksTotal: number;
  tasksDone: number;
  quoteLines: number;
  tables: number;
  rules: number;
  words: number;
}

export interface RecognizedFeature {
  id: string;
  /** Markdown snippet that triggered the feature, shown as the chip's prefix. */
  hint: string;
  label: string;
}

const RE_FENCE = /^\s{0,3}(?:```|~~~)/;
const RE_HEADING = /^(\s{0,3}#{1,6})(\s.*|)$/;
const RE_RULE = /^(?:\*\s*){3,}$|^(?:-\s*){3,}$|^(?:_\s*){3,}$/;
const RE_BULLET = /^(\s*)([-*+])(\s+)/;
const RE_ORDERED = /^(\s*)(\d{1,9}[.)])(\s+)/;
const RE_TASK = /^(\[[ xX]\])(\s+)/;
const RE_QUOTE = /^(\s{0,3}>+\s?)/;
const RE_TABLE_ROW = /^\s{0,3}\|/;
const RE_TABLE_SEP = /^[\s|:-]*-[\s|:-]*$/;

/** Inline matchers, tried in order at each position of a line. */
const RE_ESCAPE = /\\[\\`*_{}[\]()#+\-.!>~|]/y;
const RE_CODE = /(`+)([^`]+?)\1(?!`)/y;
const RE_IMAGE = /!\[([^\]\n]*)\]\(([^()\s]*)((?:\s+"[^"\n]*")?)\)/y;
const RE_LINK = /\[([^\]\n]*)\]\(([^()\s]*)((?:\s+"[^"\n]*")?)\)/y;
const RE_AUTOLINK = /<(?:https?:\/\/|mailto:)[^>\s]+>/y;
const RE_BARE_URL = /https?:\/\/[^\s<>()[\]]+/y;
const RE_STRONG_EM = /(\*\*\*|___)(?=\S)(.*?\S)\1/y;
const RE_STRONG = /(\*\*|__)(?=\S)(.*?\S)\1/y;
const RE_EM = /([*_])(?=[^\s*_])(.*?[^\s*_])\1(?!\1)/y;
const RE_STRIKE = /~~(?=\S)(.*?\S)~~/y;

/** `_` only opens emphasis at a word boundary, so `snake_case_names` stay plain. */
function underscoreAllowed(src: string, at: number) {
  if (src[at] !== "_") return true;
  return at === 0 || !/[\p{L}\p{N}]/u.test(src[at - 1]);
}

function matchAt(re: RegExp, src: string, at: number) {
  re.lastIndex = at;
  const m = re.exec(src);
  return m && m.index === at ? m : null;
}

function inlineTokens(src: string, base: TokenKind, depth = 0): MarkdownToken[] {
  const tokens: MarkdownToken[] = [];
  let pending = "";
  const flush = () => {
    if (pending) {
      tokens.push({ kind: base, text: pending });
      pending = "";
    }
  };
  const nested = (text: string, kind: TokenKind) =>
    depth >= 2 ? [{ kind, text }] : inlineTokens(text, kind, depth + 1);

  let i = 0;
  while (i < src.length) {
    const before = i;

    const escaped = matchAt(RE_ESCAPE, src, i);
    if (escaped) {
      pending += escaped[0];
      i += escaped[0].length;
      continue;
    }

    const code = matchAt(RE_CODE, src, i);
    if (code) {
      flush();
      tokens.push({ kind: "syntax", text: code[1] });
      tokens.push({ kind: "code", text: code[2] });
      tokens.push({ kind: "syntax", text: code[1] });
      i += code[0].length;
      continue;
    }

    const image = matchAt(RE_IMAGE, src, i);
    if (image) {
      flush();
      tokens.push({ kind: "syntax", text: "![" });
      if (image[1]) tokens.push({ kind: "image", text: image[1] });
      tokens.push({ kind: "syntax", text: "](" });
      tokens.push({ kind: "url", text: image[2] + image[3] });
      tokens.push({ kind: "syntax", text: ")" });
      i += image[0].length;
      continue;
    }

    const link = matchAt(RE_LINK, src, i);
    if (link) {
      flush();
      tokens.push({ kind: "syntax", text: "[" });
      if (link[1]) tokens.push({ kind: "link", text: link[1] });
      tokens.push({ kind: "syntax", text: "](" });
      tokens.push({ kind: "url", text: link[2] + link[3] });
      tokens.push({ kind: "syntax", text: ")" });
      i += link[0].length;
      continue;
    }

    const autolink = matchAt(RE_AUTOLINK, src, i) ?? matchAt(RE_BARE_URL, src, i);
    if (autolink) {
      flush();
      tokens.push({ kind: "url", text: autolink[0] });
      i += autolink[0].length;
      continue;
    }

    if (underscoreAllowed(src, i)) {
      const strongEm = matchAt(RE_STRONG_EM, src, i);
      const strong = strongEm ? null : matchAt(RE_STRONG, src, i);
      const em = strongEm || strong ? null : matchAt(RE_EM, src, i);
      const hit = strongEm ?? strong ?? em;
      if (hit) {
        flush();
        tokens.push({ kind: "syntax", text: hit[1] });
        tokens.push(...nested(hit[2], em ? "em" : "strong"));
        tokens.push({ kind: "syntax", text: hit[1] });
        i += hit[0].length;
        continue;
      }
    }

    const strike = matchAt(RE_STRIKE, src, i);
    if (strike) {
      flush();
      tokens.push({ kind: "syntax", text: "~~" });
      tokens.push(...nested(strike[1], "strike"));
      tokens.push({ kind: "syntax", text: "~~" });
      i += strike[0].length;
      continue;
    }

    if (i === before) {
      pending += src[i];
      i += 1;
    }
  }
  flush();
  return tokens;
}

export function tokenizeMarkdown(source: string): MarkdownLine[] {
  const out: MarkdownLine[] = [];
  let inFence = false;

  for (const raw of source.split("\n")) {
    if (RE_FENCE.test(raw)) {
      inFence = !inFence;
      out.push({ raw, block: "fence", level: 0, flag: false, tokens: [{ kind: "syntax", text: raw }] });
      continue;
    }
    if (inFence) {
      out.push({ raw, block: "code", level: 0, flag: false, tokens: [{ kind: "codeblock", text: raw }] });
      continue;
    }
    if (!raw.trim()) {
      out.push({ raw, block: "blank", level: 0, flag: false, tokens: raw ? [{ kind: "text", text: raw }] : [] });
      continue;
    }

    const tokens: MarkdownToken[] = [];
    let rest = raw;
    let block: BlockKind = "paragraph";
    let level = 0;
    let flag = false;

    const quote = RE_QUOTE.exec(rest);
    if (quote) {
      tokens.push({ kind: "syntax", text: quote[1] });
      rest = rest.slice(quote[1].length);
      block = "quote";
    }

    const trimmed = rest.trim();
    if (RE_RULE.test(trimmed)) {
      tokens.push({ kind: "rule", text: rest });
      out.push({ raw, block: block === "quote" ? "quote" : "rule", level: 0, flag: false, tokens });
      continue;
    }

    const heading = RE_HEADING.exec(rest);
    if (heading) {
      tokens.push({ kind: "syntax", text: heading[1] });
      tokens.push(...inlineTokens(heading[2], "heading"));
      out.push({
        raw,
        block: block === "quote" ? "quote" : "heading",
        level: heading[1].trim().length,
        flag: false,
        tokens,
      });
      continue;
    }

    if (RE_TABLE_ROW.test(rest)) {
      const cells = rest.split("|");
      const isSep = RE_TABLE_SEP.test(rest);
      cells.forEach((cell, idx) => {
        if (idx > 0) tokens.push({ kind: "syntax", text: "|" });
        if (!cell) return;
        tokens.push(...(isSep ? [{ kind: "table-sep" as TokenKind, text: cell }] : inlineTokens(cell, "text")));
      });
      out.push({ raw, block: "table", level: 0, flag: isSep, tokens });
      continue;
    }

    const bullet = RE_BULLET.exec(rest);
    const ordered = bullet ? null : RE_ORDERED.exec(rest);
    const marker = bullet ?? ordered;
    if (marker) {
      tokens.push({ kind: "syntax", text: marker[0] });
      rest = rest.slice(marker[0].length);
      level = Math.floor(marker[1].length / 2);
      block = bullet ? "bullet" : "ordered";

      const task = RE_TASK.exec(rest);
      if (task) {
        flag = task[1].toLowerCase() === "[x]";
        tokens.push({ kind: flag ? "checkbox-done" : "checkbox", text: task[1] });
        tokens.push({ kind: "syntax", text: task[2] });
        rest = rest.slice(task[0].length);
        block = "task";
      }
      tokens.push(...inlineTokens(rest, flag ? "done" : "text"));
      out.push({ raw, block, level, flag, tokens });
      continue;
    }

    tokens.push(...inlineTokens(rest, block === "quote" ? "quote" : "text"));
    out.push({ raw, block, level, flag, tokens });
  }

  return out;
}

/** Token kinds that carry no spoken or readable content of their own. */
const SILENT_KINDS = new Set<TokenKind>([
  "syntax",
  "url",
  "codeblock",
  "checkbox",
  "checkbox-done",
  "rule",
  "table-sep",
]);

/** Drops markdown punctuation and link targets, keeping the prose. */
export function tokensToText(tokens: MarkdownToken[]): string {
  return tokens
    .filter((t) => !SILENT_KINDS.has(t.kind))
    .map((t) => t.text)
    .join("");
}

/** A table row split into cell text, pipes and markdown punctuation removed. */
export function tokensToCells(tokens: MarkdownToken[]): string[] {
  const cells: string[] = [];
  let current: MarkdownToken[] = [];
  for (const token of tokens) {
    if (token.kind === "syntax" && token.text === "|") {
      cells.push(tokensToText(current));
      current = [];
      continue;
    }
    current.push(token);
  }
  cells.push(tokensToText(current));
  return cells.map((cell) => cell.trim()).filter(Boolean);
}

function countWords(text: string) {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

export function analyzeMarkdown(source: string): MarkdownStats {
  const stats: MarkdownStats = {
    headings: 0,
    bold: 0,
    italic: 0,
    strikethrough: 0,
    inlineCode: 0,
    codeBlocks: 0,
    links: 0,
    images: 0,
    bulletItems: 0,
    orderedItems: 0,
    tasksTotal: 0,
    tasksDone: 0,
    quoteLines: 0,
    tables: 0,
    rules: 0,
    words: 0,
  };

  let fences = 0;
  for (const line of tokenizeMarkdown(source)) {
    switch (line.block) {
      case "heading":
        stats.headings += 1;
        break;
      case "fence":
        fences += 1;
        break;
      case "bullet":
        stats.bulletItems += 1;
        break;
      case "ordered":
        stats.orderedItems += 1;
        break;
      case "task":
        stats.tasksTotal += 1;
        if (line.flag) stats.tasksDone += 1;
        break;
      case "quote":
        stats.quoteLines += 1;
        break;
      case "table":
        if (line.flag) stats.tables += 1;
        break;
      case "rule":
        stats.rules += 1;
        break;
    }

    for (const token of line.tokens) {
      if (token.kind === "strong") stats.bold += 1;
      else if (token.kind === "em") stats.italic += 1;
      else if (token.kind === "strike") stats.strikethrough += 1;
      else if (token.kind === "code") stats.inlineCode += 1;
      else if (token.kind === "link") stats.links += 1;
      else if (token.kind === "image") stats.images += 1;
    }

    stats.words += countWords(tokensToText(line.tokens));
  }
  stats.codeBlocks = Math.ceil(fences / 2);

  return stats;
}

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

/** Chips describing what the editor recognized, in reading order. */
export function recognizedFeatures(stats: MarkdownStats): RecognizedFeature[] {
  const features: RecognizedFeature[] = [];
  const add = (id: string, hint: string, label: string) => features.push({ id, hint, label });

  if (stats.headings) add("headings", "#", plural(stats.headings, "heading"));
  if (stats.bold) add("bold", "**", `${stats.bold} bold`);
  if (stats.italic) add("italic", "*", `${stats.italic} italic`);
  if (stats.strikethrough) add("strike", "~~", `${stats.strikethrough} struck`);
  if (stats.tasksTotal) add("tasks", "- [ ]", `${stats.tasksDone}/${stats.tasksTotal} tasks done`);
  const listItems = stats.bulletItems + stats.orderedItems;
  if (listItems) add("list", stats.orderedItems > stats.bulletItems ? "1." : "-", plural(listItems, "list item"));
  if (stats.quoteLines) add("quote", ">", plural(stats.quoteLines, "quote line"));
  if (stats.codeBlocks) add("code-block", "```", plural(stats.codeBlocks, "code block"));
  if (stats.inlineCode) add("code", "`", `${stats.inlineCode} inline code`);
  if (stats.links) add("link", "[]()", plural(stats.links, "link"));
  if (stats.images) add("image", "![]()", plural(stats.images, "image"));
  if (stats.tables) add("table", "|", plural(stats.tables, "table"));
  if (stats.rules) add("rule", "---", plural(stats.rules, "divider"));

  return features;
}
