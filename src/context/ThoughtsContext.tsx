import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Thought } from "../lib/types";
import { THOUGHTS_BANK } from "../lib/thoughts-bank";
import { pickRotatingThoughts, rotationLabel } from "../lib/thoughts-rotation";
import { errorMessage, requireSupabase } from "../lib/supabase";
import { useAuth } from "./auth-context";
import { ThoughtsContext } from "./thoughts-context";

const BOOKMARK_CACHE = "dailymark.thought_bookmarks";

function readBookmarkCache(userId: string): string[] {
  try {
    const raw = localStorage.getItem(`${BOOKMARK_CACHE}.${userId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === "string")
      : [];
  } catch {
    return [];
  }
}

function writeBookmarkCache(userId: string, ids: string[]) {
  try {
    localStorage.setItem(`${BOOKMARK_CACHE}.${userId}`, JSON.stringify(ids));
  } catch {
    // private mode / quota
  }
}

export function ThoughtsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [catalog, setCatalog] = useState<Thought[]>([]);
  const [bookmarkIds, setBookmarkIds] = useState<Set<string>>(() => new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [now] = useState(() => new Date());

  const fetchAll = useCallback(async () => {
    let nextCatalog = THOUGHTS_BANK;

    try {
      const db = requireSupabase();
      const { data, error: err } = await db
        .from("thoughts")
        .select("*")
        .order("published_at", { ascending: false });
      if (err) throw err;
      if (data && data.length > 0) nextCatalog = data as Thought[];
      setError(null);
    } catch (err) {
      setError(THOUGHTS_BANK.length ? null : errorMessage(err));
    }

    setCatalog(nextCatalog);

    if (!userId) {
      setBookmarkIds(new Set());
      setLoading(false);
      return;
    }

    const cached = readBookmarkCache(userId);
    setBookmarkIds(new Set(cached));

    try {
      const db = requireSupabase();
      const { data, error: err } = await db
        .from("thought_bookmarks")
        .select("thought_id, created_at")
        .order("created_at", { ascending: false });
      if (err) throw err;
      const ids = (data ?? []).map((row) => row.thought_id);
      setBookmarkIds(new Set(ids));
      writeBookmarkCache(userId, ids);
    } catch {
      // Keep local cache if the bookmarks table isn't available yet.
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

  const featured = useMemo(() => pickRotatingThoughts(catalog, now), [catalog, now]);

  const saved = useMemo(() => {
    const byId = new Map(catalog.map((t) => [t.id, t]));
    return [...bookmarkIds]
      .map((id) => byId.get(id))
      .filter((t): t is Thought => Boolean(t));
  }, [catalog, bookmarkIds]);

  const isBookmarked = useCallback((id: string) => bookmarkIds.has(id), [bookmarkIds]);

  const getThought = useCallback(
    (id: string) => catalog.find((t) => t.id === id),
    [catalog]
  );

  const toggleBookmark = useCallback(
    async (id: string) => {
      if (!userId) throw new Error("Sign in to save thoughts.");

      const was = bookmarkIds.has(id);
      const next = new Set(bookmarkIds);
      if (was) next.delete(id);
      else next.add(id);
      setBookmarkIds(next);
      writeBookmarkCache(userId, [...next]);

      // Best-effort cloud sync. Local cache already updated so Saved still works
      // if the bookmarks table isn't applied yet or we're on the bundled bank.
      try {
        const db = requireSupabase();
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
      } catch {
        // Keep the optimistic local bookmark; cloud catch-up happens on refresh
        // once migrations / catalog rows are in place.
      }
    },
    [userId, bookmarkIds]
  );

  const value = useMemo(
    () => ({
      catalog,
      featured,
      saved,
      bookmarkIds,
      loading,
      error,
      rotationHint: rotationLabel(now),
      isBookmarked,
      toggleBookmark,
      getThought,
      refresh: fetchAll,
    }),
    [
      catalog,
      featured,
      saved,
      bookmarkIds,
      loading,
      error,
      now,
      isBookmarked,
      toggleBookmark,
      getThought,
      fetchAll,
    ]
  );

  return <ThoughtsContext.Provider value={value}>{children}</ThoughtsContext.Provider>;
}
