import { createContext, useContext } from "react";

export interface FocusContextType {
  focus: boolean;
  setFocus: (on: boolean) => void;
  toggleFocus: () => void;
}

export const FocusContext = createContext<FocusContextType | null>(null);

export function useFocus() {
  const ctx = useContext(FocusContext);
  if (!ctx) throw new Error("useFocus must be used within FocusProvider");
  return ctx;
}
