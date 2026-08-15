/**
 * Visuals list cards are ~400 CSS pixels wide. The catalog stores a 1600px
 * Wikimedia rendition for the article view; requesting that into a thumb
 * wastes bandwidth and decode time. Rewrite the `width` query when the URL
 * already uses one (FilePath and most Commons thumbnails do).
 */
export function visualImageUrl(url: string, width: number): string {
  if (!url || !Number.isFinite(width) || width < 1) return url;
  try {
    const parsed = new URL(url);
    if (parsed.searchParams.has("width")) {
      parsed.searchParams.set("width", String(Math.round(width)));
      return parsed.toString();
    }
  } catch {
    // Relative or malformed — leave the stored URL alone.
  }
  return url;
}
