import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Thought } from "../lib/types";
import { THOUGHTS_BANK } from "../lib/thoughts-bank";
import {
  isWithinLiveWindow,
  liveFeedLabel,
  nextLiveBoundary,
  pickLiveThoughts,
  withDropCadenceDates,
} from "../lib/thoughts-rotation";
import { errorMessage, requireSupabase } from "../lib/supabase";
import { useAuth } from "./auth-context";
import { ThoughtsContext } from "./thoughts-context";

function normalizeThought(row: Thought): Thought {
  return { ...row, collection: row.collection ?? "" };
}

function prepareCatalog(rows: Thought[], date: Date): Thought[] {
  const normalized = rows.map(normalizeThought);
  if (normalized.length === 0) return normalized;
  // If something is genuinely fresh (a real curated drop within the live
  // window), trust the stored dates as-is. Only when NOTHING in the catalog
  // is currently live — the whole table has gone stale, whether that's the
  // bundled fallback bank, an untouched starter seed, or hand-curated rows
  // nobody has topped up in a while — restage the lot onto the drop cadence
  // ending at `date`, so Live never silently starves down to nothing but
  // Saved. This used to only kick in when every row was one of the six
  // starter ids; that broke for good the moment a single non-starter row
  // existed in the table, even if everything else was stale too.
  const hasLiveContent = normalized.some((t) => isWithinLiveWindow(t, date));
  if (hasLiveContent) return normalized;
  return withDropCadenceDates(normalized, date);
}

export function ThoughtsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [catalog, setCatalog] = useState<Thought[]>([]);
  const [bookmarkIds, setBookmarkIds] = useState<Set<string>>(() => new Set());
  const [pinnedId, setPinnedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());

  // Live expiry used to be re-evaluated once a minute. Nothing derived from
  // the clock actually changes between two boundaries, so every one of those
  // ticks handed out a fresh context value and re-rendered each consumer for
  // an identical feed — including while the user was typing in a note. Sleep
  // until the next moment the feed could genuinely differ instead.
  useEffect(() => {
    const boundary = nextLiveBoundary(catalog, now);
    if (!boundary) return;
    // setTimeout saturates past ~24.8 days; re-arm rather than fire instantly.
    const delay = Math.min(Math.max(boundary.getTime() - Date.now(), 1_000), 2_147_483_000);
    const id = window.setTimeout(() => setNow(new Date()), delay);
    return () => window.clearTimeout(id);
  }, [catalog, now]);

  const fetchAll = useCallback(async () => {
    const asOf = new Date();
    let nextCatalog = prepareCatalog(THOUGHTS_BANK, asOf);

    try {
      const db = requireSupabase();
      const { data, error: err } = await db
        .from("thoughts")
        .select("*")
        .order("published_at", { ascending: false });
      if (err) throw err;
      if (data && data.length > 0) nextCatalog = prepareCatalog(data as Thought[], asOf);
      setError(null);
    } catch (err) {
      setError(THOUGHTS_BANK.length ? null : errorMessage(err));
    }

    setCatalog(nextCatalog);
    setNow(asOf);

    if (!userId) {
      setBookmarkIds(new Set());
      setPinnedId(null);
      setLoading(false);
      return;
    }

    // Bookmarks and the pinned "Thought of the week" live only in Supabase —
    // no browser cache — so they read the same on every device. A fresh load
    // starts empty and lets the DB fill it in; a failed read clears rather
    // than resurrecting stale local data.
    try {
      const db = requireSupabase();
      const [bookmarksRes, profileRes] = await Promise.all([
        db
          .from("thought_bookmarks")
          .select("thought_id, created_at")
          .order("created_at", { ascending: false }),
        db.from("profiles").select("pinned_thought_id").eq("id", userId).maybeSingle(),
      ]);
      if (bookmarksRes.error) throw bookmarksRes.error;
      setBookmarkIds(new Set((bookmarksRes.data ?? []).map((row) => row.thought_id)));
      setPinnedId(profileRes.error ? null : profileRes.data?.pinned_thought_id ?? null);
    } catch {
      setBookmarkIds(new Set());
      setPinnedId(null);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    let active = true;
    void (async () => {
      await fetchAll();
      if (!active) return;
    })();
    return () => {
      active = false;
    };
  }, [fetchAll]);

  const featured = useMemo(
    () => pickLiveThoughts(catalog, now, bookmarkIds),
    [catalog, now, bookmarkIds]
  );

  const saved = useMemo(() => {
    const byId = new Map(catalog.map((t) => [t.id, t]));
    return [...bookmarkIds]
      .map((id) => byId.get(id))
      .filter((t): t is Thought => Boolean(t));
  }, [catalog, bookmarkIds]);

  const pinned = useMemo(
    () => (pinnedId ? catalog.find((t) => t.id === pinnedId) ?? null : null),
    [catalog, pinnedId]
  );

  const isBookmarked = useCallback((id: string) => bookmarkIds.has(id), [bookmarkIds]);

  const getThought = useCallback(
    (id: string) => catalog.find((t) => t.id === id),
    [catalog]
  );

  const toggleBookmark = useCallback(
    async (id: string) => {
      if (!userId) throw new Error("Sign in to save thoughts.");

      // Write to Supabase FIRST, update local state only once it commits (see
      // the same change in VisualsContext). The old code flipped state
      // optimistically and swallowed DB errors, so a failed write looked saved
      // locally but never persisted — the reason saves didn't sync across
      // browsers. A failure now throws so the caller can surface it.
      const db = requireSupabase();
      const was = bookmarkIds.has(id);
      if (was) {
        const { error: err } = await db
          .from("thought_bookmarks")
          .delete()
          .eq("thought_id", id);
        if (err) throw err;
      } else {
        const { error: err } = await db.from("thought_bookmarks").insert({
          user_id: userId,
          thought_id: id,
        });
        if (err) throw err;
      }

      const next = new Set(bookmarkIds);
      if (was) next.delete(id);
      else next.add(id);
      setBookmarkIds(next);
    },
    [userId, bookmarkIds]
  );

  const pinThought = useCallback(
    async (id: string | null) => {
      if (!userId) throw new Error("Sign in to pin a thought.");
      // DB-authoritative, same as bookmarks: persist then reflect, so the pin
      // is identical on every device and a failure surfaces instead of living
      // only in this browser.
      const db = requireSupabase();
      const { error: err } = await db
        .from("profiles")
        .update({ pinned_thought_id: id })
        .eq("id", userId);
      if (err) throw err;
      setPinnedId(id);
    },
    [userId]
  );

  const rotationHint = useMemo(() => liveFeedLabel(featured, now), [featured, now]);

  const value = useMemo(
    () => ({
      catalog,
      featured,
      saved,
      pinned,
      bookmarkIds,
      loading,
      error,
      rotationHint,
      isBookmarked,
      toggleBookmark,
      pinThought,
      getThought,
      refresh: fetchAll,
    }),
    [
      catalog,
      featured,
      saved,
      pinned,
      bookmarkIds,
      loading,
      error,
      rotationHint,
      isBookmarked,
      toggleBookmark,
      pinThought,
      getThought,
      fetchAll,
    ]
  );

  return <ThoughtsContext.Provider value={value}>{children}</ThoughtsContext.Provider>;
}
