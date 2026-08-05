import type { Thought } from "./types";

/** At least this many fresh pieces are meant to drop each day. */
export const DROPS_PER_DAY = 3;
/** A live piece leaves the feed after this many days unless saved. */
export const LIVE_MAX_AGE_DAYS = 2;

const MS_PER_DAY = 86_400_000;
/** Even spacing between consecutive drops (3/day → one every 8 hours). */
const DROP_INTERVAL_MS = MS_PER_DAY / DROPS_PER_DAY;

/** When this piece drops off the live feed (published_at + LIVE_MAX_AGE_DAYS). */
export function liveExpiresAt(thought: Thought): Date {
  const published = new Date(thought.published_at).getTime();
  return new Date(published + LIVE_MAX_AGE_DAYS * MS_PER_DAY);
}

/** True while the piece is still inside the live freshness window. */
export function isWithinLiveWindow(thought: Thought, date = new Date()): boolean {
  const published = new Date(thought.published_at).getTime();
  if (Number.isNaN(published)) return false;
  const ageMs = date.getTime() - published;
  return ageMs >= 0 && ageMs < LIVE_MAX_AGE_DAYS * MS_PER_DAY;
}

/**
 * Live feed: recent drops only, newest first.
 * Saved/bookmarked pieces leave Live and live in the Saved shelf instead.
 */
export function pickLiveThoughts(
  catalog: readonly Thought[],
  date = new Date(),
  excludeIds?: ReadonlySet<string>
): Thought[] {
  return catalog
    .filter((thought) => {
      if (excludeIds?.has(thought.id)) return false;
      return isWithinLiveWindow(thought, date);
    })
    .sort((a, b) => {
      const byDate = new Date(b.published_at).getTime() - new Date(a.published_at).getTime();
      if (byDate !== 0) return byDate;
      return a.id.localeCompare(b.id);
    });
}

/** @deprecated Use pickLiveThoughts — kept for older imports during the rename. */
export function pickRotatingThoughts(
  catalog: readonly Thought[],
  date = new Date()
): Thought[] {
  return pickLiveThoughts(catalog, date);
}

/** Friendly sidebar hint for how long the freshest live piece still has. */
export function liveFeedLabel(live: readonly Thought[], date = new Date()): string {
  if (live.length === 0) return "New drops arrive daily";

  let soonestExpiry = Infinity;
  for (const thought of live) {
    soonestExpiry = Math.min(soonestExpiry, liveExpiresAt(thought).getTime());
  }

  const days = Math.max(0, Math.ceil((soonestExpiry - date.getTime()) / MS_PER_DAY));
  if (days <= 0) return "Refreshing soon";
  if (days === 1) return "Oldest drops off tomorrow";
  return `Live up to ${LIVE_MAX_AGE_DAYS} days`;
}

/** @deprecated Use liveFeedLabel */
export function rotationLabel(date = new Date()): string {
  return liveFeedLabel([], date);
}

/**
 * The next instant at which the live feed would actually look different — a
 * piece ageing out, or `liveFeedLabel` ticking down a whole day. Between two
 * boundaries nothing derived from the clock changes, so the provider can sleep
 * until then instead of re-deriving the feed every minute.
 *
 * Returns null when no future boundary exists (an empty or fully-expired
 * catalog), which means: no timer needed at all.
 */
export function nextLiveBoundary(
  catalog: readonly Thought[],
  date = new Date()
): Date | null {
  const now = date.getTime();
  let soonest = Infinity;

  for (const thought of catalog) {
    const expiry = liveExpiresAt(thought).getTime();
    if (Number.isNaN(expiry)) continue;
    // The label counts whole days left, so it changes on each day step down
    // to the expiry itself — wake for those too, not just the drop-off.
    for (let k = LIVE_MAX_AGE_DAYS; k >= 0; k--) {
      const boundary = expiry - k * MS_PER_DAY;
      if (boundary > now && boundary < soonest) soonest = boundary;
    }
  }

  return Number.isFinite(soonest) ? new Date(soonest) : null;
}

/**
 * Restage a fixed catalog onto the drop cadence ending at `date`, spacing
 * pieces one `DROP_INTERVAL_MS` apart (3/day), so local demo / bundled
 * fallback always has a real live window with several fresh pieces.
 */
export function withDropCadenceDates(
  catalog: readonly Thought[],
  date = new Date()
): Thought[] {
  const ordered = [...catalog].sort(
    (a, b) => new Date(a.published_at).getTime() - new Date(b.published_at).getTime()
  );
  // Anchor the newest drop at "now" (not a future clock time) so Live never
  // hides the latest piece before its scheduled hour arrives.
  const newest = date.getTime();
  return ordered.map((thought, index) => {
    const ageSteps = ordered.length - 1 - index;
    const published = new Date(newest - ageSteps * DROP_INTERVAL_MS);
    return {
      ...thought,
      published_at: published.toISOString(),
      created_at: thought.created_at || published.toISOString(),
    };
  });
}
