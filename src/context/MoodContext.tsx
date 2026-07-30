import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { DEFAULT_NOTES_MOOD, isNotesMood, type NotesMood } from "../lib/moods";
import { MoodContext } from "./mood-context";

const STORAGE_KEY = "notes-mood";

function getStoredMood(): NotesMood {
  if (typeof window === "undefined") return DEFAULT_NOTES_MOOD;
  const stored = localStorage.getItem(STORAGE_KEY);
  return isNotesMood(stored) ? stored : DEFAULT_NOTES_MOOD;
}

export function MoodProvider({ children }: { children: ReactNode }) {
  const [mood, setMoodState] = useState<NotesMood>(getStoredMood);

  useEffect(() => {
    document.documentElement.dataset.mood = mood;
  }, [mood]);

  const setMood = useCallback((next: NotesMood) => {
    localStorage.setItem(STORAGE_KEY, next);
    setMoodState(next);
  }, []);

  const value = useMemo(() => ({ mood, setMood }), [mood, setMood]);

  return <MoodContext.Provider value={value}>{children}</MoodContext.Provider>;
}
