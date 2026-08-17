import { createContext, useContext } from "react";
import type { UserPrefs } from "../lib/user-prefs";
import type { Theme } from "../lib/types";
import type { NotesMood } from "../lib/moods";

export interface PrefsContextValue {
  prefs: UserPrefs;
  loading: boolean;
  patchPrefs: (patch: Partial<UserPrefs>) => Promise<void>;
  theme: Theme;
  notesMood: NotesMood;
  focus: boolean;
}

// Kept out of PrefsContext.tsx so that file only exports a component, which is
// what React Fast Refresh needs to hot-reload the provider.
export const PrefsContext = createContext<PrefsContextValue | null>(null);

export function usePrefs(): PrefsContextValue {
  const ctx = useContext(PrefsContext);
  if (!ctx) throw new Error("usePrefs must be used within PrefsProvider");
  return ctx;
}
