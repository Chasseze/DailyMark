import type { Thought } from "./types";

/** New drops are meant to land about this often. */
export const DROP_CADENCE_DAYS = 2;
/** A live piece leaves the feed after this many days unless saved. */
export const LIVE_MAX_AGE_DAYS = 3;

const MS_PER_DAY = 86_400_000;

/** UTC midnight for the calendar day of `date`. */
export function startOfUtcDay(date = new Date()): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

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
  if (live.length === 0) return "Next drop within a couple of days";

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
 * Restage a fixed catalog onto a 2-day drop cadence ending today so local
 * demo / bundled fallback always has a real live window.
 */
export function withDropCadenceDates(
  catalog: readonly Thought[],
  date = new Date()
): Thought[] {
  const ordered = [...catalog].sort(
    (a, b) => new Date(a.published_at).getTime() - new Date(b.published_at).getTime()
  );
  const newest = startOfUtcDay(date).getTime() + 10 * 3_600_000; // 10:00 UTC
  return ordered.map((thought, index) => {
    const ageSteps = ordered.length - 1 - index;
    const published = new Date(newest - ageSteps * DROP_CADENCE_DAYS * MS_PER_DAY);
    return {
      ...thought,
      published_at: published.toISOString(),
      created_at: thought.created_at || published.toISOString(),
    };
  });
}
