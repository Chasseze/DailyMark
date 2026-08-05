import { createContext, useContext } from "react";
import type { Visual } from "../lib/types";

export type VisualsShelf = "live" | "saved";

export interface VisualsContextType {
  /** Full curated catalog (Live + older drops still reachable via Saved). */
  catalog: Visual[];
  /** Fresh web drops still inside the live window and not saved. */
  featured: Visual[];
  /** Bookmarked visuals, newest bookmark first — leaves Live when saved. */
  saved: Visual[];
  bookmarkIds: ReadonlySet<string>;
  loading: boolean;
  error: string | null;
  /** e.g. "Live up to 3 days" */
  rotationHint: string;
  isBookmarked: (id: string) => boolean;
  toggleBookmark: (id: string) => Promise<void>;
  getVisual: (id: string) => Visual | undefined;
  refresh: () => Promise<void>;
}

export const VisualsContext = createContext<VisualsContextType | null>(null);

export function useVisuals() {
  const ctx = useContext(VisualsContext);
  if (!ctx) throw new Error("useVisuals must be used within VisualsProvider");
  return ctx;
}
