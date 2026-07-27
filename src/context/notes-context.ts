import { createContext, useContext } from "react";
import type { Note, Notebook } from "../lib/types";

export interface NotesContextType {
  notes: Note[];
  notebooks: Notebook[];
  addNote: (note: Omit<Note, "id" | "created_at" | "updated_at">) => Note;
  updateNote: (id: string, data: Partial<Note>) => void;
  deleteNote: (id: string) => void;
  togglePin: (id: string) => void;
  addNotebook: (name: string, color: string) => Notebook;
}

// Kept out of NotesContext.tsx so that file only exports a component, which is
// what React Fast Refresh needs to hot-reload the provider.
export const NotesContext = createContext<NotesContextType | null>(null);

export function useNotes() {
  const ctx = useContext(NotesContext);
  if (!ctx) throw new Error("useNotes must be used within NotesProvider");
  return ctx;
}
