import { createContext, useContext } from "react";
import type { Thought } from "../lib/types";

export type ThoughtsShelf = "live" | "saved";

export interface ThoughtsContextType {
  /** Full curated catalog (not all shown at once). */
  catalog: Thought[];
  /** Current live rotation (refreshes every few days). */
  featured: Thought[];
  /** Bookmarked thoughts, newest bookmark first. */
  saved: Thought[];
  bookmarkIds: ReadonlySet<string>;
  loading: boolean;
  error: string | null;
  /** e.g. "Rotates in 2 days" */
  rotationHint: string;
  isBookmarked: (id: string) => boolean;
  toggleBookmark: (id: string) => Promise<void>;
  getThought: (id: string) => Thought | undefined;
  refresh: () => Promise<void>;
}

export const ThoughtsContext = createContext<ThoughtsContextType | null>(null);

export function useThoughts() {
  const ctx = useContext(ThoughtsContext);
  if (!ctx) throw new Error("useThoughts must be used within ThoughtsProvider");
  return ctx;
}
