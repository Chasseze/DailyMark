import { createContext, useContext } from "react";
import type { NotesMood } from "../lib/moods";

export interface MoodContextType {
  mood: NotesMood;
  setMood: (mood: NotesMood) => void;
}

export const MoodContext = createContext<MoodContextType | null>(null);

export function useMood() {
  const ctx = useContext(MoodContext);
  if (!ctx) throw new Error("useMood must be used within MoodProvider");
  return ctx;
}
