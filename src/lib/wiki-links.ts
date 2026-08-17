/**
 * The one definition of what a wiki link looks like. The backlinks SQL in
 * 0014_linked_desk.sql mirrors this shape — change one and change the other,
 * or a note will link out without ever linking back.
 */
const WIKI_LINK = /\[\[([^\]]+)\]\]/g;

/** Titles are matched trimmed and case-insensitively; blank means "Untitled". */
export function wikiLinkKey(title: string): string {
  return (title.trim() || "Untitled").toLowerCase();
}

/** Every distinct `[[label]]` in the source, in first-seen order. */
export function findWikiLinks(markdown: string): string[] {
  const seen = new Set<string>();
  const labels: string[] = [];
  for (const match of markdown.matchAll(WIKI_LINK)) {
    const label = match[1].trim();
    if (!label || seen.has(wikiLinkKey(label))) continue;
    seen.add(wikiLinkKey(label));
    labels.push(label);
  }
  return labels;
}

/**
 * Labels that point at no note. Wiki links resolve by title, so renaming a
 * note silently breaks every link into it — this is what makes that visible.
 */
export function findBrokenWikiLinks(
  markdown: string,
  notes: ReadonlyArray<{ title: string }>
): string[] {
  const known = new Set(notes.map((n) => wikiLinkKey(n.title)));
  return findWikiLinks(markdown).filter((label) => !known.has(wikiLinkKey(label)));
}

/** Expand `[[Note title]]` wiki links into Markdown links for known notes. */
export function expandWikiLinks(
  markdown: string,
  notes: ReadonlyArray<{ id: string; title: string }>
): string {
  return markdown.replace(WIKI_LINK, (_match, raw: string) => {
    const label = raw.trim();
    if (!label) return "[[]]";
    const hit = notes.find((n) => wikiLinkKey(n.title) === wikiLinkKey(label));
    if (hit) return `[${label}](/notes/${hit.id})`;
    return `[${label}](#missing-note)`;
  });
}

export function isInternalNoteHref(href: string | undefined): href is string {
  return Boolean(href && /^\/notes\/[0-9a-f-]{36}$/i.test(href));
}
