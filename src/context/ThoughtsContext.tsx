import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Thought } from "../lib/types";
import { THOUGHTS_BANK } from "../lib/thoughts-bank";
import { pickRotatingThoughts, rotationLabel } from "../lib/thoughts-rotation";
import { errorMessage, requireSupabase } from "../lib/supabase";
import { useAuth } from "./auth-context";
import { ThoughtsContext } from "./thoughts-context";

const BOOKMARK_CACHE = "dailymark.thought_bookmarks";
const PIN_CACHE = "dailymark.pinned_thought";

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

function readPinCache(userId: string): string | null {
  try {
    return localStorage.getItem(`${PIN_CACHE}.${userId}`);
  } catch {
    return null;
  }
}

function writePinCache(userId: string, id: string | null) {
  try {
    if (id) localStorage.setItem(`${PIN_CACHE}.${userId}`, id);
    else localStorage.removeItem(`${PIN_CACHE}.${userId}`);
  } catch {
    // ignore
  }
}

function normalizeThought(row: Thought): Thought {
  return { ...row, collection: row.collection ?? "" };
}

export function ThoughtsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [catalog, setCatalog] = useState<Thought[]>([]);
  const [bookmarkIds, setBookmarkIds] = useState<Set<string>>(() => new Set());
  const [pinnedId, setPinnedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [now] = useState(() => new Date());

  const fetchAll = useCallback(async () => {
    let nextCatalog = THOUGHTS_BANK.map(normalizeThought);

    try {
      const db = requireSupabase();
      const { data, error: err } = await db
        .from("thoughts")
        .select("*")
        .order("published_at", { ascending: false });
      if (err) throw err;
      if (data && data.length > 0) nextCatalog = (data as Thought[]).map(normalizeThought);
      setError(null);
    } catch (err) {
      setError(THOUGHTS_BANK.length ? null : errorMessage(err));
    }

    setCatalog(nextCatalog);

    if (!userId) {
      setBookmarkIds(new Set());
      setPinnedId(null);
      setLoading(false);
      return;
    }

    const cached = readBookmarkCache(userId);
    setBookmarkIds(new Set(cached));
    setPinnedId(readPinCache(userId));

    try {
      const db = requireSupabase();
      const [bookmarksRes, profileRes] = await Promise.all([
        db
          .from("thought_bookmarks")
          .select("thought_id, created_at")
          .order("created_at", { ascending: false }),
        db.from("profiles").select("pinned_thought_id").eq("id", userId).maybeSingle(),
      ]);
      if (!bookmarksRes.error && bookmarksRes.data) {
        const ids = bookmarksRes.data.map((row) => row.thought_id);
        setBookmarkIds(new Set(ids));
        writeBookmarkCache(userId, ids);
      }
      if (!profileRes.error) {
        const pin = profileRes.data?.pinned_thought_id ?? null;
        setPinnedId(pin);
        writePinCache(userId, pin);
      }
    } catch {
      // Keep local caches if tables aren't available yet.
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

      const was = bookmarkIds.has(id);
      const next = new Set(bookmarkIds);
      if (was) next.delete(id);
      else next.add(id);
      setBookmarkIds(next);
      writeBookmarkCache(userId, [...next]);

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
        // Keep optimistic local bookmark.
      }
    },
    [userId, bookmarkIds]
  );

  const pinThought = useCallback(
    async (id: string | null) => {
      if (!userId) throw new Error("Sign in to pin a thought.");
      setPinnedId(id);
      writePinCache(userId, id);
      try {
        const db = requireSupabase();
        const { error: err } = await db
          .from("profiles")
          .update({ pinned_thought_id: id })
          .eq("id", userId);
        if (err) throw err;
      } catch {
        // Local pin still works until profiles column is applied.
      }
    },
    [userId]
  );

  const value = useMemo(
    () => ({
      catalog,
      featured,
      saved,
      pinned,
      bookmarkIds,
      loading,
      error,
      rotationHint: rotationLabel(now),
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
      now,
      isBookmarked,
      toggleBookmark,
      pinThought,
      getThought,
      fetchAll,
    ]
  );

  return <ThoughtsContext.Provider value={value}>{children}</ThoughtsContext.Provider>;
}
