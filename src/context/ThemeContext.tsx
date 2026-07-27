import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Theme } from "../lib/types";
import { ThemeContext } from "./theme-context";

const THEMES: Theme[] = ["dark", "light", "system"];

function getStoredTheme(): Theme {
  const stored = localStorage.getItem("theme");
  return THEMES.includes(stored as Theme) ? (stored as Theme) : "system";
}

function getSystemPreference(): "dark" | "light" {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(getStoredTheme);
  const [systemPref, setSystemPref] = useState(getSystemPreference);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const handler = () => setSystemPref(getSystemPreference());
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const resolved = theme === "system" ? systemPref : theme;

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("light", resolved === "light");
    root.classList.toggle("dark", resolved === "dark");
  }, [resolved]);

  const setTheme = useCallback((t: Theme) => {
    localStorage.setItem("theme", t);
    setThemeState(t);
  }, []);

  const toggle = useCallback(() => {
    setTheme(resolved === "dark" ? "light" : "dark");
  }, [resolved, setTheme]);

  const value = useMemo(
    () => ({ theme, resolved, setTheme, toggle }),
    [theme, resolved, setTheme, toggle]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
