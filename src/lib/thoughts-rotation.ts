import type { Thought } from "./types";

/** Live shelf refreshes this often (≤ 3 days as requested). */
export const ROTATION_DAYS = 2;
/** How many pieces sit on the live shelf each window. */
export const FEATURED_COUNT = 3;

const EPOCH_UTC = Date.UTC(2026, 0, 1);

/** Integer window index that advances every `ROTATION_DAYS` calendar days. */
export function rotationWindow(date = new Date()): number {
  const day = Math.floor((date.getTime() - EPOCH_UTC) / 86_400_000);
  return Math.floor(Math.max(0, day) / ROTATION_DAYS);
}

/** UTC midnight when the *next* rotation window begins. */
export function nextRotationAt(date = new Date()): Date {
  const window = rotationWindow(date);
  const nextDay = (window + 1) * ROTATION_DAYS;
  return new Date(EPOCH_UTC + nextDay * 86_400_000);
}

function hashSeed(n: number): number {
  let h = n >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d);
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b);
  return (h ^ (h >>> 16)) >>> 0;
}

/** Deterministic shuffle so every user sees the same live shelf for a window. */
export function seededOrder<T>(items: readonly T[], seed: number): T[] {
  const order = items.slice();
  let s = hashSeed(seed);
  for (let i = order.length - 1; i > 0; i--) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    const j = s % (i + 1);
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

/**
 * Pick the live rotation from the full catalog. Stable across clients for the
 * same window; bookmarks are separate and can surface pieces that rotated out.
 */
export function pickRotatingThoughts(
  catalog: readonly Thought[],
  date = new Date(),
  count = FEATURED_COUNT
): Thought[] {
  if (catalog.length === 0 || count <= 0) return [];
  const sorted = [...catalog].sort((a, b) => a.id.localeCompare(b.id));
  const ordered = seededOrder(sorted, rotationWindow(date));
  return ordered.slice(0, Math.min(count, ordered.length));
}

/** Friendly label for the sidebar (“Rotates in 2 days”, “Rotates tomorrow”). */
export function rotationLabel(date = new Date()): string {
  const next = nextRotationAt(date);
  const ms = next.getTime() - date.getTime();
  const days = Math.max(0, Math.ceil(ms / 86_400_000));
  if (days <= 0) return "New shelf today";
  if (days === 1) return "Rotates tomorrow";
  return `Rotates in ${days} days`;
}
