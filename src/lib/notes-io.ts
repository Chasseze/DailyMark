import type { Note } from "./types";
import type { ThoughtSource } from "./database.types";
import { isAdapted, sourceCredit, sourceWebUrl } from "./thought-source";

/** Build a downloadable Markdown document from a note. */
export function noteToMarkdown(
  note: Pick<Note, "title" | "content" | "tags"> & {
    thoughtSource?: ThoughtSource | null;
  },
): string {
  const title = note.title.trim() || "Untitled";
  const tags =
    note.tags.length > 0
      ? `\n\n---\ntags: ${note.tags.map((t) => `#${t}`).join(" ")}\n`
      : "\n";
  const source = note.thoughtSource;
  const attribution = source
    ? `\n\n---\n${isAdapted(note.title, note.content, source) ? "Personal adaptation · Edited by the DailyMark user" : "Personal copy · Unedited"}\n\nBased on DailyMark’s curated reflection: ${source.snapshot.title}\n\nSource credit: ${sourceCredit(source)}${sourceWebUrl(source.snapshot.source_url) ? `\n\nOriginal publication: ${sourceWebUrl(source.snapshot.source_url)}` : ""}\n\nSource copy captured: ${source.captured_at}\n\n<details>\n<summary>Preserved DailyMark source</summary>\n\n${source.snapshot.content}\n\n</details>\n`
    : "";
  return `# ${title}\n\n${note.content.trim()}${attribution}${tags}`;
}

export function downloadText(
  filename: string,
  text: string,
  mime = "text/markdown;charset=utf-8",
) {
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
export function parseImportedMarkdown(
  raw: string,
  fallbackTitle: string,
): {
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
