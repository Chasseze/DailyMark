import { createContext, useContext } from "react";
import type { NewNote, Note, Notebook, NoteUpdate } from "../lib/types";

export interface NotesContextType {
  notes: Note[];
  /** Soft-deleted notes still recoverable from Trash. */
  trash: Note[];
  notebooks: Notebook[];
  /** True during the initial load; the list pages show a skeleton meanwhile. */
  loading: boolean;
  /** Set when a read or write failed, so the UI can surface it. */
  error: string | null;
  addNote: (note: NewNote) => Promise<Note>;
  updateNote: (id: string, data: NoteUpdate) => Promise<void>;
  /** Soft-delete — moves the note into Trash. */
  deleteNote: (id: string) => Promise<void>;
  restoreNote: (id: string) => Promise<void>;
  /** Permanently remove a trashed note. */
  purgeNote: (id: string) => Promise<void>;
  emptyTrash: () => Promise<void>;
  togglePin: (id: string) => Promise<void>;
  addNotebook: (name: string, color: string) => Promise<Notebook>;
  updateNotebook: (id: string, data: { name?: string; color?: string }) => Promise<void>;
  deleteNotebook: (id: string) => Promise<void>;
  /** Load the full Markdown body for a list row (no-op if already hydrated). */
  ensureNote: (id: string) => Promise<Note | null>;
  /** Server-side full-text search; empty query returns []. */
  searchNotes: (query: string) => Promise<Note[]>;
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
