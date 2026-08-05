import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Visual } from "../lib/types";
import { VISUALS_BANK } from "../lib/visuals-bank";
import {
  isWithinLiveWindow,
  liveFeedLabel,
  nextLiveBoundary,
  pickLiveVisuals,
  withDropCadenceDates,
} from "../lib/visuals-rotation";
import { errorMessage, requireSupabase } from "../lib/supabase";
import { useAuth } from "./auth-context";
import { VisualsContext } from "./visuals-context";

function prepareCatalog(rows: Visual[], date: Date): Visual[] {
  if (rows.length === 0) return rows;
  // If something is genuinely fresh, trust the stored dates as-is. Only
  // when NOTHING in the catalog is currently live does the whole table
  // get restaged onto the drop cadence ending at `date`, so Live never
  // silently starves down to nothing but Saved just because no one has
  // curated a new drop recently. See ThoughtsContext.tsx for the fuller
  // reasoning — this used to only restage when every row was one of the
  // six starter ids, which broke for good the moment a single non-starter
  // row existed in the table.
  const hasLiveContent = rows.some((v) => isWithinLiveWindow(v, date));
  if (hasLiveContent) return rows;
  return withDropCadenceDates(rows, date);
}

export function VisualsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [catalog, setCatalog] = useState<Visual[]>([]);
  const [bookmarkIds, setBookmarkIds] = useState<Set<string>>(() => new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());

  // Same sleep-until-next-boundary trick as ThoughtsContext — nothing
  // derived from the clock changes between two boundaries, so there is no
  // reason to re-render every consumer once a minute for an identical feed.
  useEffect(() => {
    const boundary = nextLiveBoundary(catalog, now);
    if (!boundary) return;
    const delay = Math.min(Math.max(boundary.getTime() - Date.now(), 1_000), 2_147_483_000);
    const id = window.setTimeout(() => setNow(new Date()), delay);
    return () => window.clearTimeout(id);
  }, [catalog, now]);

  const fetchAll = useCallback(async () => {
    const asOf = new Date();
    let nextCatalog = prepareCatalog(VISUALS_BANK, asOf);

    try {
      const db = requireSupabase();
      const { data, error: err } = await db
        .from("visuals")
        .select("*")
        .order("published_at", { ascending: false });
      if (err) throw err;
      if (data && data.length > 0) nextCatalog = prepareCatalog(data as Visual[], asOf);
      setError(null);
    } catch (err) {
      setError(VISUALS_BANK.length ? null : errorMessage(err));
    }

    setCatalog(nextCatalog);
    setNow(asOf);

    if (!userId) {
      setBookmarkIds(new Set());
      setLoading(false);
      return;
    }

    // Saved state lives only in Supabase — no browser cache — so every device
    // and browser reads the same source of truth. On a fresh load we start
    // from empty and let the DB fill it in; a failed read leaves Saved empty
    // rather than resurrecting stale local data.
    try {
      const db = requireSupabase();
      const { data, error: err } = await db
        .from("visual_bookmarks")
        .select("visual_id, created_at")
        .order("created_at", { ascending: false });
      if (err) throw err;
      setBookmarkIds(new Set((data ?? []).map((row) => row.visual_id)));
    } catch {
      setBookmarkIds(new Set());
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
    () => pickLiveVisuals(catalog, now, bookmarkIds),
    [catalog, now, bookmarkIds]
  );

  const saved = useMemo(() => {
    const byId = new Map(catalog.map((v) => [v.id, v]));
    return [...bookmarkIds]
      .map((id) => byId.get(id))
      .filter((v): v is Visual => Boolean(v));
  }, [catalog, bookmarkIds]);

  const isBookmarked = useCallback((id: string) => bookmarkIds.has(id), [bookmarkIds]);

  const getVisual = useCallback(
    (id: string) => catalog.find((v) => v.id === id),
    [catalog]
  );

  const toggleBookmark = useCallback(
    async (id: string) => {
      if (!userId) throw new Error("Sign in to save visuals.");

      // Write to Supabase FIRST and only update local state once it commits.
      // The old code optimistically flipped state and swallowed DB errors, so
      // a failed write (e.g. the table not yet migrated) still looked "saved"
      // locally but never persisted — which is exactly why saves didn't sync
      // across browsers. Now a failure throws so the caller can surface it,
      // and local state can never drift from the database.
      const db = requireSupabase();
      const was = bookmarkIds.has(id);
      if (was) {
        const { error: err } = await db
          .from("visual_bookmarks")
          .delete()
          .eq("visual_id", id);
        if (err) throw err;
      } else {
        const { error: err } = await db.from("visual_bookmarks").insert({
          user_id: userId,
          visual_id: id,
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

  const rotationHint = useMemo(() => liveFeedLabel(featured, now), [featured, now]);

  const value = useMemo(
    () => ({
      catalog,
      featured,
      saved,
      bookmarkIds,
      loading,
      error,
      rotationHint,
      isBookmarked,
      toggleBookmark,
      getVisual,
      refresh: fetchAll,
    }),
    [
      catalog,
      featured,
      saved,
      bookmarkIds,
      loading,
      error,
      rotationHint,
      isBookmarked,
      toggleBookmark,
      getVisual,
      fetchAll,
    ]
  );

  return <VisualsContext.Provider value={value}>{children}</VisualsContext.Provider>;
}
