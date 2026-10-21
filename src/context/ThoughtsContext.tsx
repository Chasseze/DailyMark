import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Thought } from "../lib/types";
import type { ThoughtSourceRow } from "../lib/database.types";
import { readAllPages } from "../lib/pagination";
import { THOUGHTS_BANK } from "../lib/thoughts-bank";
import {
  liveFeedLabel,
  nextLiveBoundary,
  pickLiveThoughts,
  withDropCadenceDates,
} from "../lib/thoughts-rotation";
import { errorMessage, isSupabaseConfigured, requireSupabase } from "../lib/supabase";
import { useAuth } from "./auth-context";
import { ThoughtsContext } from "./thoughts-context";

function normalizeThought(row: Thought): Thought {
  return { ...row, collection: row.collection ?? "" };
}

/**
 * The database owns `published_at` now — migration 0010 schedules
 * `promote_daily_drops()` to publish a fixed number of pieces per day, so
 * stored dates are real and stable. The client must NOT rewrite them: doing
 * that was what made the same row report a different publish date on every
 * visit, and made "new" never actually new.
 *
 * The bundled bank is the only thing still restaged, because it ships with
 * fixed dates and has no scheduler behind it — it exists purely so an
 * offline / unconfigured build still shows a believable shelf.
 */
function fromDatabase(rows: Thought[]): Thought[] {
  return rows.map(normalizeThought);
}

function fromBundledBank(date: Date): Thought[] {
  return withDropCadenceDates(THOUGHTS_BANK.map(normalizeThought), date);
}

export function ThoughtsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  return <ThoughtsAccountProvider key={userId ?? "signed-out"} userId={userId}>{children}</ThoughtsAccountProvider>;
}

function ThoughtsAccountProvider({ children, userId }: { children: ReactNode; userId: string | null }) {

  const [catalog, setCatalog] = useState<Thought[]>(() => isSupabaseConfigured() ? [] : fromBundledBank(new Date()));
  const [bookmarkIds, setBookmarkIds] = useState<Set<string>>(() => new Set());
  const [sources, setSources] = useState<Map<string, ThoughtSourceRow>>(
    () => new Map(),
  );
  const [pinnedId, setPinnedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [refreshing, setRefreshing] = useState(false);
  const [personalReady, setPersonalReady] = useState(false);
  const requestId = useRef({ value: 0 });
  const [error, setError] = useState<string | null>(() => isSupabaseConfigured() ? null : "Connect your account to load saved thoughts.");
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
    const delay = Math.min(
      Math.max(boundary.getTime() - Date.now(), 1_000),
      2_147_483_000,
    );
    const id = window.setTimeout(() => setNow(new Date()), delay);
    return () => window.clearTimeout(id);
  }, [catalog, now]);

  const fetchAll = useCallback(async () => {
    const state = requestId.current;
    const request = ++state.value;
    const asOf = new Date();
    try {
      const db = requireSupabase();
      const [catalogResult, personalResult, profileResult] = await Promise.allSettled([
        (async () => {
          const result = await readAllPages((from, to) => db.from("thoughts").select("*").order("published_at", { ascending: false }).order("id").range(from, to));
          if (result.error) throw result.error;
          return fromDatabase(result.data);
        })(),
        (async () => {
          if (!userId) return { bookmarks: [] as { thought_id: string }[], sources: [] as ThoughtSourceRow[] };
          const [bookmarks, sources] = await Promise.all([
            readAllPages((from, to) => db.from("thought_bookmarks").select("thought_id,created_at").order("created_at", { ascending: false }).order("thought_id").range(from, to)),
            readAllPages((from, to) => db.from("thought_sources").select("*").order("id").range(from, to)),
          ]);
          if (bookmarks.error) throw bookmarks.error;
          if (sources.error) throw sources.error;
          return { bookmarks: bookmarks.data, sources: sources.data };
        })(),
        (async () => {
          if (!userId) return null;
          const { data, error: err } = await db.from("profiles").select("pinned_thought_id").eq("id", userId).maybeSingle();
          if (err) throw err;
          return data?.pinned_thought_id ?? null;
        })(),
      ]);
      if (request !== state.value) return;
      const errors: string[] = [];
      if (catalogResult.status === "fulfilled") setCatalog(catalogResult.value);
      else errors.push("Could not refresh the catalog: " + errorMessage(catalogResult.reason));
      if (personalResult.status === "fulfilled") {
        const byThought = new Map<string, ThoughtSourceRow>();
        const rows = [...personalResult.value.sources].sort((a, b) =>
          Number(b.origin === "catalog") - Number(a.origin === "catalog") ||
          b.captured_at.localeCompare(a.captured_at) || a.id.localeCompare(b.id));
        for (const row of rows) if (!byThought.has(row.thought_id)) byThought.set(row.thought_id, row);
        setSources(byThought);
        setBookmarkIds(new Set(personalResult.value.bookmarks.map((row) => row.thought_id)));
        setPersonalReady(true);
      } else errors.push("Could not refresh saved thoughts: " + errorMessage(personalResult.reason));
      if (profileResult.status === "fulfilled") setPinnedId(profileResult.value);
      else errors.push("Could not refresh your pinned thought: " + errorMessage(profileResult.reason));
      setNow(asOf);
      setError(errors.length ? errors.join(" ") : null);
    } catch (err) {
      if (request === state.value) setError(errorMessage(err));
    } finally {
      if (request === state.value) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [userId]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    const state = requestId.current;
    void (async () => { await fetchAll(); })();
    return () => {
      ++state.value;
    };
  }, [fetchAll]);

  const featured = useMemo(
    () => pickLiveThoughts(catalog, now, bookmarkIds),
    [catalog, now, bookmarkIds],
  );

  const saved = useMemo(() => {
    const byId = new Map(catalog.map((t) => [t.id, t]));
    return [...bookmarkIds]
      .map((id) => sources.get(id)?.snapshot ?? byId.get(id))
      .filter((t): t is Thought => Boolean(t));
  }, [catalog, bookmarkIds, sources]);

  const pinned = useMemo(
    () => (pinnedId ? (catalog.find((t) => t.id === pinnedId) ?? null) : null),
    [catalog, pinnedId],
  );

  const isBookmarked = useCallback(
    (id: string) => bookmarkIds.has(id),
    [bookmarkIds],
  );

  const getThought = useCallback(
    (id: string) =>
      sources.get(id)?.snapshot ?? catalog.find((t) => t.id === id),
    [catalog, sources],
  );

  const toggleBookmark = useCallback(
    async (id: string) => {
      if (!userId) throw new Error("Sign in to save thoughts.");
      if (!personalReady) throw new Error("Load your saved thoughts before changing bookmarks.");

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
      if (!was) await fetchAll();
    },
    [userId, bookmarkIds, fetchAll, personalReady],
  );

  const createPersonalVersion = useCallback(
    async (id: string) => {
      const { data, error: err } = await requireSupabase().rpc(
        "create_thought_version",
        { p_thought_id: id },
      );
      if (err) throw err;
      await fetchAll();
      return data;
    },
    [fetchAll],
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
    [userId],
  );

  const rotationHint = useMemo(
    () => liveFeedLabel(featured, now),
    [featured, now],
  );

  const value = useMemo(
    () => ({
      catalog,
      featured,
      saved,
      pinned,
      bookmarkIds,
      sources,
      createPersonalVersion,
      loading,
      refreshing,
      personalReady,
      error,
      rotationHint,
      isBookmarked,
      toggleBookmark,
      pinThought,
      getThought,
      refresh,
    }),
    [
      catalog,
      featured,
      saved,
      pinned,
      bookmarkIds,
      sources,
      createPersonalVersion,
      loading,
      refreshing,
      personalReady,
      error,
      rotationHint,
      isBookmarked,
      toggleBookmark,
      pinThought,
      getThought,
      refresh,
    ],
  );

  return (
    <ThoughtsContext.Provider value={value}>
      {children}
    </ThoughtsContext.Provider>
  );
}
