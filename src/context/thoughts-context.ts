import { createContext, useContext } from "react";
import type { Thought } from "../lib/types";

export interface ThoughtsContextType {
  thoughts: Thought[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export const ThoughtsContext = createContext<ThoughtsContextType | null>(null);

export function useThoughts() {
  const ctx = useContext(ThoughtsContext);
  if (!ctx) throw new Error("useThoughts must be used within ThoughtsProvider");
  return ctx;
}
