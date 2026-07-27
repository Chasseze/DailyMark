import { createContext, useContext } from "react";
import type { Theme } from "../lib/types";

export interface ThemeContextType {
  theme: Theme;
  resolved: "dark" | "light";
  setTheme: (t: Theme) => void;
  toggle: () => void;
}

// Kept out of ThemeContext.tsx so that file only exports a component, which is
// what React Fast Refresh needs to hot-reload the provider.
export const ThemeContext = createContext<ThemeContextType | null>(null);

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
