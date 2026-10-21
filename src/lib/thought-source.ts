import type { ThoughtSource } from "./database.types";

export function isAdapted(
  title: string,
  content: string,
  source: ThoughtSource,
): boolean {
  return title !== source.snapshot.title || content !== source.snapshot.content;
}

export function sourceCredit(source: ThoughtSource): string {
  return (
    [source.snapshot.author, source.snapshot.source_name]
      .filter(Boolean)
      .join(" · ") || "Source not specified"
  );
}

/** Source links also come from imported backups, so allow only web URLs. */
export function sourceWebUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.href
      : null;
  } catch {
    return null;
  }
}
