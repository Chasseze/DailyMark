import { useEffect, useRef, useState } from "react";
import { errorMessage, requireSupabase } from "../lib/supabase";
import { useAuth } from "../context/auth-context";

interface StreakState {
  streak: number | null;
  error: string | null;
}

/**
 * Records today's visit and returns the resulting streak.
 *
 * All the logic lives in the touch_streak() database function so it stays
 * atomic; this hook just calls it once per signed-in user.
 */
export function useStreak(): StreakState {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [state, setState] = useState<StreakState>({ streak: null, error: null });
  // StrictMode mounts effects twice. touch_streak() is safe to call twice, but
  // there's no reason to spend the round trip.
  const recordedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!userId || recordedFor.current === userId) return;
    recordedFor.current = userId;

    let active = true;
    void (async () => {
      try {
        const { data, error } = await requireSupabase().rpc("touch_streak");
        if (error) throw error;
        if (active) setState({ streak: data.streak, error: null });
      } catch (err) {
        if (active) setState({ streak: null, error: errorMessage(err) });
      }
    })();

    return () => {
      active = false;
    };
  }, [userId]);

  return state;
}
