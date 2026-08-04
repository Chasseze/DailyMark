import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../context/auth-context";
import { errorMessage, requireSupabase } from "../lib/supabase";
import { addDays, dayKey, type MoodRow, type QuizRow } from "../lib/rhythm";

/** How far back Rhythm looks. Twelve weeks fits a phone column comfortably. */
export const RHYTHM_DAYS = 84;

export interface RhythmData {
  moods: MoodRow[];
  quizzes: QuizRow[];
  savedThoughts: number;
  loading: boolean;
  error: string | null;
  /** True when a table is missing or unreadable, so the UI can say so. */
  partial: boolean;
}

/**
 * Reads back the history the app has been writing all along: a mood row and a
 * quiz row per day, plus the saved-thought count.
 *
 * Notes are deliberately absent — `NotesProvider` already holds them, so
 * Rhythm derives its writing stats from that rather than issuing a fourth
 * query. These three only run when the tab is opened.
 */
export function useRhythm(days = RHYTHM_DAYS): RhythmData {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [data, setData] = useState<Omit<RhythmData, "loading">>({
    moods: [],
    quizzes: [],
    savedThoughts: 0,
    error: null,
    partial: false,
  });
  const [loading, setLoading] = useState(true);

  const load = useCallback(
    async (uid: string) => {
      const since = dayKey(addDays(new Date(), -(days - 1)));
      const db = requireSupabase();

      // Settled, not all: one missing table (a migration not yet applied)
      // should cost that panel, not the whole tab.
      const [moodsRes, quizRes, savedRes] = await Promise.allSettled([
        db
          .from("daily_moods")
          .select("date_key, mood, note")
          .eq("user_id", uid)
          .gte("date_key", since)
          .order("date_key"),
        db
          .from("quiz_progress")
          .select("date_key, score, attempt")
          .eq("user_id", uid)
          .gte("date_key", since)
          .order("date_key"),
        db
          .from("thought_bookmarks")
          .select("thought_id", { count: "exact", head: true })
          .eq("user_id", uid),
      ]);

      const ok = <T,>(res: PromiseSettledResult<{ data: T | null; error: unknown }>) =>
        res.status === "fulfilled" && !res.value.error ? res.value.data : null;

      const moods = (ok(moodsRes) as MoodRow[] | null) ?? [];
      const quizzes = (ok(quizRes) as QuizRow[] | null) ?? [];
      const savedCount =
        savedRes.status === "fulfilled" && !savedRes.value.error
          ? (savedRes.value as { count: number | null }).count ?? 0
          : 0;

      const partial = [moodsRes, quizRes, savedRes].some(
        (res) => res.status === "rejected" || (res.status === "fulfilled" && res.value.error)
      );

      return { moods, quizzes, savedThoughts: savedCount, error: null, partial };
    },
    [days]
  );

  useEffect(() => {
    // Signed out is derived below rather than written into state — there is
    // nothing to synchronise, and setting state here would cascade a render.
    if (!userId) return;

    let active = true;
    void (async () => {
      try {
        const next = await load(userId);
        if (active) setData(next);
      } catch (err) {
        if (active) {
          setData({
            moods: [],
            quizzes: [],
            savedThoughts: 0,
            error: errorMessage(err),
            partial: false,
          });
        }
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [userId, load]);

  if (!userId) {
    return { moods: [], quizzes: [], savedThoughts: 0, error: null, partial: false, loading: false };
  }

  return { ...data, loading };
}
