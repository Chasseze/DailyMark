import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Thought } from "../lib/types";
import { THOUGHTS_BANK } from "../lib/thoughts-bank";
import { errorMessage, requireSupabase } from "../lib/supabase";
import { ThoughtsContext } from "./thoughts-context";

export function ThoughtsProvider({ children }: { children: ReactNode }) {
  const [thoughts, setThoughts] = useState<Thought[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchThoughts = useCallback(async () => {
    try {
      const db = requireSupabase();
      const { data, error: err } = await db
        .from("thoughts")
        .select("*")
        .order("published_at", { ascending: false });
      if (err) throw err;

      if (data && data.length > 0) {
        setThoughts(data as Thought[]);
      } else {
        // Table exists but is empty — ship the bundled starter set.
        setThoughts(THOUGHTS_BANK);
      }
      setError(null);
    } catch (err) {
      // Migration not applied yet, or offline — still show curated starters.
      setThoughts(THOUGHTS_BANK);
      // Keep the UI quiet when the fallback bank is enough; surface only if empty.
      setError(THOUGHTS_BANK.length ? null : errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      await fetchThoughts();
      if (!active) return;
    })();
    return () => {
      active = false;
    };
  }, [fetchThoughts]);

  const value = useMemo(
    () => ({
      thoughts,
      loading,
      error,
      refresh: fetchThoughts,
    }),
    [thoughts, loading, error, fetchThoughts]
  );

  return <ThoughtsContext.Provider value={value}>{children}</ThoughtsContext.Provider>;
}
