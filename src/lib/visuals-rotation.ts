import type { Visual } from "./types";

/**
 * Same live/saved rotation mechanics as thoughts-rotation.ts, applied to
 * picture stories instead of prose — but Visuals runs its own cadence: a
 * daily drop rather than every 2 days, so 5 stories are live at once
 * instead of Thoughts' ~2.
 */

/** New drops are meant to land about this often. */
export const DROP_CADENCE_DAYS = 1;
/**
 * A live piece leaves the feed after this many days unless saved. Paired
 * with a 1-day drop cadence, this keeps exactly 5 picture stories live at
 * once — one new drop a day, one dropping off five days later.
 */
export const LIVE_MAX_AGE_DAYS = 5;

const MS_PER_DAY = 86_400_000;

/** When this piece drops off the live feed (published_at + LIVE_MAX_AGE_DAYS). */
export function liveExpiresAt(visual: Visual): Date {
  const published = new Date(visual.published_at).getTime();
  return new Date(published + LIVE_MAX_AGE_DAYS * MS_PER_DAY);
}

/** True while the piece is still inside the live freshness window. */
export function isWithinLiveWindow(visual: Visual, date = new Date()): boolean {
  const published = new Date(visual.published_at).getTime();
  if (Number.isNaN(published)) return false;
  const ageMs = date.getTime() - published;
  return ageMs >= 0 && ageMs < LIVE_MAX_AGE_DAYS * MS_PER_DAY;
}

/**
 * Live feed: recent drops only, newest first.
 * Saved/bookmarked pieces leave Live and live in the Saved shelf instead.
 */
export function pickLiveVisuals(
  catalog: readonly Visual[],
  date = new Date(),
  excludeIds?: ReadonlySet<string>
): Visual[] {
  return catalog
    .filter((visual) => {
      if (excludeIds?.has(visual.id)) return false;
      return isWithinLiveWindow(visual, date);
    })
    .sort((a, b) => {
      const byDate = new Date(b.published_at).getTime() - new Date(a.published_at).getTime();
      if (byDate !== 0) return byDate;
      return a.id.localeCompare(b.id);
    });
}

/** Friendly sidebar hint for how long the freshest live piece still has. */
export function liveFeedLabel(live: readonly Visual[], date = new Date()): string {
  if (live.length === 0) return "Next drop within a couple of days";

  let soonestExpiry = Infinity;
  for (const visual of live) {
    soonestExpiry = Math.min(soonestExpiry, liveExpiresAt(visual).getTime());
  }

  const days = Math.max(0, Math.ceil((soonestExpiry - date.getTime()) / MS_PER_DAY));
  if (days <= 0) return "Refreshing soon";
  if (days === 1) return "Oldest drops off tomorrow";
  return `Live up to ${LIVE_MAX_AGE_DAYS} days`;
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
  catalog: readonly Visual[],
  date = new Date()
): Date | null {
  const now = date.getTime();
  let soonest = Infinity;

  for (const visual of catalog) {
    const expiry = liveExpiresAt(visual).getTime();
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
 * Restage a fixed catalog onto the daily drop cadence ending at `date` so
 * local demo / bundled fallback always has a real live window.
 */
export function withDropCadenceDates(
  catalog: readonly Visual[],
  date = new Date()
): Visual[] {
  const ordered = [...catalog].sort(
    (a, b) => new Date(a.published_at).getTime() - new Date(b.published_at).getTime()
  );
  // Anchor the newest drop at "now" (not a future clock time) so Live never
  // hides the latest piece before its scheduled hour arrives.
  const newest = date.getTime();
  return ordered.map((visual, index) => {
    const ageSteps = ordered.length - 1 - index;
    const published = new Date(newest - ageSteps * DROP_CADENCE_DAYS * MS_PER_DAY);
    return {
      ...visual,
      published_at: published.toISOString(),
      created_at: visual.created_at || published.toISOString(),
    };
  });
}
