import { useCallback, useMemo, type ReactNode } from "react";
import { FocusContext } from "./focus-context";
import { usePrefs } from "./PrefsContext";

export function FocusProvider({ children }: { children: ReactNode }) {
  const { focus, patchPrefs } = usePrefs();

  const setFocus = useCallback(
    (on: boolean) => {
      void patchPrefs({ focus: on });
    },
    [patchPrefs]
  );

  const toggleFocus = useCallback(() => {
    setFocus(!focus);
  }, [focus, setFocus]);

  const value = useMemo(
    () => ({ focus, setFocus, toggleFocus }),
    [focus, setFocus, toggleFocus]
  );

  return <FocusContext.Provider value={value}>{children}</FocusContext.Provider>;
}
