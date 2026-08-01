import type { Note } from "./types";

/** Build a downloadable Markdown document from a note. */
export function noteToMarkdown(note: Pick<Note, "title" | "content" | "tags">): string {
  const title = note.title.trim() || "Untitled";
  const tags =
    note.tags.length > 0 ? `\n\n---\ntags: ${note.tags.map((t) => `#${t}`).join(" ")}\n` : "\n";
  return `# ${title}\n\n${note.content.trim()}${tags}`;
}

export function downloadText(filename: string, text: string, mime = "text/markdown;charset=utf-8") {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function safeFilename(title: string): string {
  const base = (title.trim() || "untitled")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
  return `${base || "untitled"}.md`;
}

/** Pull a title + body out of a Markdown file (first H1 becomes the title). */
export function parseImportedMarkdown(raw: string, fallbackTitle: string): {
  title: string;
  content: string;
  tags: string[];
} {
  const text = raw.replace(/^\uFEFF/, "");
  const tags: string[] = [];
  let body = text;

  // Trailing `tags: #a #b` footer from our exporter.
  const tagFooter = /\n---\ntags:\s*([^\n]+)\s*$/i.exec(body);
  if (tagFooter) {
    for (const part of tagFooter[1].split(/\s+/)) {
      const tag = part.replace(/^#/, "").trim().toLowerCase();
      if (tag && !tags.includes(tag)) tags.push(tag);
    }
    body = body.slice(0, tagFooter.index).trimEnd();
  }

  const heading = /^#\s+(.+)\n?/.exec(body);
  if (heading) {
    return {
      title: heading[1].trim() || fallbackTitle,
      content: body.slice(heading[0].length).trim(),
      tags,
    };
  }

  return { title: fallbackTitle, content: body.trim(), tags };
}
