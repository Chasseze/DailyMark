/**
 * Turns pasted rich text into Markdown so formatting survives the trip into a
 * note. Browsers put an HTML flavour of the clipboard alongside the plain text
 * one; without this, pasting a formatted document flattens every heading, list
 * and link into undifferentiated prose.
 *
 * Only the tags that carry meaning in Markdown are translated. Anything else
 * contributes its text and nothing more.
 */

interface Ctx {
  listDepth: number;
  /** Inside <pre>: whitespace is significant and must not be collapsed. */
  pre: boolean;
}

const SKIPPED = new Set([
  "SCRIPT",
  "STYLE",
  "NOSCRIPT",
  "HEAD",
  "TITLE",
  "META",
  "LINK",
  "SVG",
  "IFRAME",
  "OBJECT",
  "SELECT",
  "TEXTAREA",
  "INPUT",
]);

const BLOCK_TAGS = new Set([
  "P",
  "DIV",
  "SECTION",
  "ARTICLE",
  "HEADER",
  "FOOTER",
  "MAIN",
  "ASIDE",
  "FIGURE",
  "FIGCAPTION",
  "DL",
  "DD",
  "DT",
  "ADDRESS",
]);

/** Stands in for a Markdown hard break until trailing spaces are safe again. */
const HARD_BREAK = "\u0001";

const FORMATTED_HTML =
  /<(?:h[1-6]|strong|b|em|i|u|del|s|strike|ul|ol|li|blockquote|pre|code|table|a|img|hr|br)\b/i;

/** Whether pasted HTML carries formatting worth converting to Markdown. */
export function hasRichFormatting(html: string): boolean {
  return FORMATTED_HTML.test(html);
}

export function htmlToMarkdown(html: string): string {
  if (typeof DOMParser === "undefined") return "";

  const doc = new DOMParser().parseFromString(html, "text/html");
  if (!doc.body) return "";

  return normalize(serializeChildren(doc.body, { listDepth: 0, pre: false }));
}

function normalize(markdown: string): string {
  return markdown
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .split(HARD_BREAK)
    .join("  \n")
    .trim();
}

function serializeChildren(node: Node, ctx: Ctx): string {
  let out = "";
  node.childNodes.forEach((child) => {
    out += serialize(child, ctx);
  });
  return out;
}

function serialize(node: Node, ctx: Ctx): string {
  if (node.nodeType === Node.TEXT_NODE) {
    const raw = node.nodeValue ?? "";
    return ctx.pre ? raw : escapeInline(raw.replace(/\s+/g, " "));
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return "";

  const el = node as HTMLElement;
  const tag = el.tagName.toUpperCase();
  if (SKIPPED.has(tag)) return "";

  switch (tag) {
    case "BR":
      return HARD_BREAK;
    case "HR":
      return "\n\n---\n\n";

    case "H1":
    case "H2":
    case "H3":
    case "H4":
    case "H5":
    case "H6": {
      const body = serializeChildren(el, ctx).trim();
      return body ? `\n\n${"#".repeat(Number(tag[1]))} ${body}\n\n` : "";
    }

    case "STRONG":
    case "B":
      return wrap(serializeChildren(el, ctx), "**");
    case "EM":
    case "I":
      return wrap(serializeChildren(el, ctx), "*");
    case "DEL":
    case "S":
    case "STRIKE":
      return wrap(serializeChildren(el, ctx), "~~");

    case "CODE":
      // <code> inside <pre> is handled by the PRE branch.
      return ctx.pre ? serializeChildren(el, ctx) : wrapCode(el.textContent ?? "");

    case "PRE": {
      const body = (el.textContent ?? "").replace(/\n+$/, "");
      return body ? `\n\n\`\`\`\n${body}\n\`\`\`\n\n` : "";
    }

    case "A": {
      const body = serializeChildren(el, ctx);
      const href = el.getAttribute("href") ?? "";
      if (!href || href.startsWith("javascript:")) return body;
      return body.trim() ? `[${body.trim()}](${href})` : href;
    }

    case "IMG": {
      const src = el.getAttribute("src") ?? "";
      if (!src || src.startsWith("data:")) return "";
      return `![${el.getAttribute("alt") ?? ""}](${src})`;
    }

    case "UL":
    case "OL":
      return serializeList(el, ctx, tag === "OL");

    case "LI":
      // Reached only for stray list items outside a list.
      return `\n- ${serializeChildren(el, ctx).trim()}\n`;

    case "BLOCKQUOTE": {
      const body = normalize(serializeChildren(el, ctx));
      if (!body) return "";
      const quoted = body
        .split("\n")
        .map((line) => (line ? `> ${line}` : ">"))
        .join("\n");
      return `\n\n${quoted}\n\n`;
    }

    case "TABLE":
      return serializeTable(el, ctx);

    default:
      if (BLOCK_TAGS.has(tag)) {
        const body = serializeChildren(el, ctx);
        return body.trim() ? `\n\n${body.trim()}\n\n` : "";
      }
      return serializeChildren(el, ctx);
  }
}

function serializeList(list: HTMLElement, ctx: Ctx, ordered: boolean): string {
  const items = Array.from(list.children).filter((c) => c.tagName.toUpperCase() === "LI");
  if (!items.length) return "";

  const indent = "  ".repeat(ctx.listDepth);
  const inner: Ctx = { ...ctx, listDepth: ctx.listDepth + 1 };

  const lines = items.map((item, index) => {
    const checkbox = item.querySelector(":scope > input[type=checkbox]");
    const marker = ordered ? `${index + 1}. ` : "- ";
    const task = checkbox ? (checkbox.hasAttribute("checked") ? "[x] " : "[ ] ") : "";

    const body = serializeChildren(item, inner)
      .replace(/\n{2,}/g, "\n")
      .trim()
      .split("\n")
      .map((line, i) => (i === 0 ? line : `${indent}  ${line}`))
      .join("\n");

    return `${indent}${marker}${task}${body}`;
  });

  return `\n\n${lines.join("\n")}\n\n`;
}

function serializeTable(table: HTMLElement, ctx: Ctx): string {
  const rows = Array.from(table.querySelectorAll("tr"));
  if (!rows.length) return "";

  const cellsOf = (row: Element) =>
    Array.from(row.querySelectorAll("th, td")).map((cell) =>
      serializeChildren(cell, ctx).replace(/\s*\n\s*/g, " ").replace(/\|/g, "\\|").trim()
    );

  const grid = rows.map(cellsOf).filter((cells) => cells.length > 0);
  if (!grid.length) return "";

  const width = Math.max(...grid.map((cells) => cells.length));
  const pad = (cells: string[]) => {
    const filled = [...cells];
    while (filled.length < width) filled.push("");
    return `| ${filled.join(" | ")} |`;
  };

  const [header, ...body] = grid;
  const divider = `| ${Array.from({ length: width }, () => "---").join(" | ")} |`;

  return `\n\n${[pad(header), divider, ...body.map(pad)].join("\n")}\n\n`;
}

function wrap(inner: string, marker: string): string {
  const [, lead, core, trail] = /^(\s*)([\s\S]*?)(\s*)$/.exec(inner)!;
  if (!core) return inner;
  return `${lead}${marker}${core}${marker}${trail}`;
}

function wrapCode(text: string): string {
  const body = text.replace(/\s+/g, " ").trim();
  if (!body) return "";
  // A run of n backticks in the code needs a fence of n+1 to survive.
  const longest = /(`+)/.exec(body)?.[1].length ?? 0;
  const fence = "`".repeat(longest + 1);
  const padding = body.startsWith("`") || body.endsWith("`") ? " " : "";
  return `${fence}${padding}${body}${padding}${fence}`;
}

function escapeInline(text: string): string {
  // Intraword underscores aren't emphasis in Markdown, so they're left alone.
  return text.replace(/([\\`*[\]])/g, "\\$1");
}
