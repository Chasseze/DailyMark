/** Expand `[[Note title]]` wiki links into Markdown links for known notes. */
export function expandWikiLinks(
  markdown: string,
  notes: ReadonlyArray<{ id: string; title: string }>
): string {
  return markdown.replace(/\[\[([^\]]+)\]\]/g, (_match, raw: string) => {
    const label = raw.trim();
    if (!label) return "[[]]";
    const hit = notes.find(
      (n) => (n.title || "Untitled").trim().toLowerCase() === label.toLowerCase()
    );
    if (hit) return `[${label}](/notes/${hit.id})`;
    return `[${label}](#missing-note)`;
  });
}

export function isInternalNoteHref(href: string | undefined): href is string {
  return Boolean(href && /^\/notes\/[0-9a-f-]{36}$/i.test(href));
}
