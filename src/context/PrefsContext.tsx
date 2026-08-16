import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "./auth-context";
import {
  DEFAULT_PREFS,
  loadUserPrefs,
  mergePrefs,
  saveUserPrefs,
  type UserPrefs,
} from "../lib/user-prefs";
import { DEFAULT_REMINDER, setReminderPrefs } from "../lib/reminders";
import type { Theme } from "../lib/types";
import type { NotesMood } from "../lib/moods";
import { DEFAULT_NOTES_MOOD } from "../lib/moods";

function syncReminderLoop(prefs: UserPrefs) {
  setReminderPrefs({
    enabled: Boolean(prefs.reminder?.enabled),
    time:
      typeof prefs.reminder?.time === "string" && /^\d{2}:\d{2}$/.test(prefs.reminder.time)
        ? prefs.reminder.time
        : DEFAULT_REMINDER.time,
  });
}

interface PrefsContextValue {
  prefs: UserPrefs;
  loading: boolean;
  patchPrefs: (patch: Partial<UserPrefs>) => Promise<void>;
  theme: Theme;
  notesMood: NotesMood;
  focus: boolean;
}

const PrefsContext = createContext<PrefsContextValue | null>(null);

function applyTheme(theme: Theme) {
  const systemLight = window.matchMedia("(prefers-color-scheme: light)").matches;
  const resolved = theme === "system" ? (systemLight ? "light" : "dark") : theme;
  document.documentElement.classList.toggle("light", resolved === "light");
  document.documentElement.classList.toggle("dark", resolved === "dark");
}

export function PrefsProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [prefs, setPrefs] = useState<UserPrefs>({ ...DEFAULT_PREFS });
  const [loading, setLoading] = useState(true);
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;

  useEffect(() => {
    if (authLoading) return;
    let active = true;
    void (async () => {
      if (!user) {
        if (active) {
          setPrefs({ ...DEFAULT_PREFS });
          setLoading(false);
        }
        return;
      }
      const remote = await loadUserPrefs();
      if (!active) return;
      syncReminderLoop(remote);
      setPrefs(remote);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [user, authLoading]);

  const theme = prefs.theme ?? "system";
  const notesMood = prefs.notesMood ?? DEFAULT_NOTES_MOOD;
  const focus = Boolean(prefs.focus);

  useEffect(() => {
    applyTheme(theme);
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const onChange = () => applyTheme(theme);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);

  useEffect(() => {
    document.documentElement.dataset.mood = notesMood;
  }, [notesMood]);

  const patchPrefs = useCallback(async (patch: Partial<UserPrefs>) => {
    const next = mergePrefs(prefsRef.current, patch);
    setPrefs(next);
    if (patch.reminder) syncReminderLoop(next);
    if (!user) return;
    try {
      await saveUserPrefs(next);
    } catch {
      // Keep optimistic UI; next successful save will catch up.
    }
  }, [user]);

  const value = useMemo(
    () => ({ prefs, loading, patchPrefs, theme, notesMood, focus }),
    [prefs, loading, patchPrefs, theme, notesMood, focus]
  );

  return <PrefsContext.Provider value={value}>{children}</PrefsContext.Provider>;
}

export function usePrefs(): PrefsContextValue {
  const ctx = useContext(PrefsContext);
  if (!ctx) throw new Error("usePrefs must be used within PrefsProvider");
  return ctx;
}
