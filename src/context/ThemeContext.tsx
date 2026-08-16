import { useCallback, useMemo, type ReactNode } from "react";
import type { Theme } from "../lib/types";
import { ThemeContext } from "./theme-context";
import { usePrefs } from "./PrefsContext";

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { theme, patchPrefs } = usePrefs();

  const systemLight =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-color-scheme: light)").matches;
  const resolved: "dark" | "light" =
    theme === "system" ? (systemLight ? "light" : "dark") : theme;

  const setTheme = useCallback(
    (t: Theme) => {
      void patchPrefs({ theme: t });
    },
    [patchPrefs]
  );

  const toggle = useCallback(() => {
    setTheme(resolved === "dark" ? "light" : "dark");
  }, [resolved, setTheme]);

  const value = useMemo(
    () => ({ theme, resolved, setTheme, toggle }),
    [theme, resolved, setTheme, toggle]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
