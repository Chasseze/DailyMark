import { createContext, useContext } from "react";
import type { Thought } from "../lib/types";

export type ThoughtsShelf = "live" | "saved";

export interface ThoughtsContextType {
  /** Full curated catalog (Live + older drops still reachable via Saved). */
  catalog: Thought[];
  /** Fresh web drops still inside the live window and not saved. */
  featured: Thought[];
  /** Bookmarked thoughts, newest bookmark first — leaves Live when saved. */
  saved: Thought[];
  /** User’s pinned Thought of the week, if any. */
  pinned: Thought | null;
  bookmarkIds: ReadonlySet<string>;
  loading: boolean;
  error: string | null;
  /** e.g. "Live up to 3 days" */
  rotationHint: string;
  isBookmarked: (id: string) => boolean;
  toggleBookmark: (id: string) => Promise<void>;
  pinThought: (id: string | null) => Promise<void>;
  getThought: (id: string) => Thought | undefined;
  refresh: () => Promise<void>;
}

export const ThoughtsContext = createContext<ThoughtsContextType | null>(null);

export function useThoughts() {
  const ctx = useContext(ThoughtsContext);
  if (!ctx) throw new Error("useThoughts must be used within ThoughtsProvider");
  return ctx;
}
