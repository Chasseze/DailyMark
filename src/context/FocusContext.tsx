import { useCallback, useMemo, useState, type ReactNode } from "react";
import { FocusContext } from "./focus-context";

const KEY = "dailymark.focus";

function readFocus(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function FocusProvider({ children }: { children: ReactNode }) {
  const [focus, setFocusState] = useState(readFocus);

  const setFocus = useCallback((on: boolean) => {
    setFocusState(on);
    try {
      localStorage.setItem(KEY, on ? "1" : "0");
    } catch {
      // ignore
    }
  }, []);

  const toggleFocus = useCallback(() => {
    setFocus(!focus);
  }, [focus, setFocus]);

  const value = useMemo(
    () => ({ focus, setFocus, toggleFocus }),
    [focus, setFocus, toggleFocus]
  );

  return <FocusContext.Provider value={value}>{children}</FocusContext.Provider>;
}
