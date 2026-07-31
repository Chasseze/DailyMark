import { createContext, useContext } from "react";
import type { NewNote, Note, Notebook, NoteUpdate } from "../lib/types";

export interface NotesContextType {
  notes: Note[];
  notebooks: Notebook[];
  /** True during the initial load; the list pages show a skeleton meanwhile. */
  loading: boolean;
  /** Set when a read or write failed, so the UI can surface it. */
  error: string | null;
  addNote: (note: NewNote) => Promise<Note>;
  updateNote: (id: string, data: NoteUpdate) => Promise<void>;
  deleteNote: (id: string) => Promise<void>;
  togglePin: (id: string) => Promise<void>;
  addNotebook: (name: string, color: string) => Promise<Notebook>;
  /** Load the full Markdown body for a list row (no-op if already hydrated). */
  ensureNote: (id: string) => Promise<Note | null>;
  refresh: () => Promise<void>;
}

// Kept out of NotesContext.tsx so that file only exports a component, which is
// what React Fast Refresh needs to hot-reload the provider.
export const NotesContext = createContext<NotesContextType | null>(null);

export function useNotes() {
  const ctx = useContext(NotesContext);
  if (!ctx) throw new Error("useNotes must be used within NotesProvider");
  return ctx;
}
