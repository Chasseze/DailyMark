import { useCallback, useMemo, type ReactNode } from "react";
import type { NotesMood } from "../lib/moods";
import { MoodContext } from "./mood-context";
import { usePrefs } from "./prefs-context";

export function MoodProvider({ children }: { children: ReactNode }) {
  const { notesMood: mood, patchPrefs } = usePrefs();

  const setMood = useCallback(
    (next: NotesMood) => {
      void patchPrefs({ notesMood: next });
    },
    [patchPrefs]
  );

  const value = useMemo(() => ({ mood, setMood }), [mood, setMood]);

  return <MoodContext.Provider value={value}>{children}</MoodContext.Provider>;
}
