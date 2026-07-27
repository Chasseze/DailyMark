import { useState, useCallback, useEffect, type ReactNode } from "react";
import type { Note, Notebook } from "../lib/types";
import { getSupabase } from "../lib/supabase";
import { NotesContext } from "./notes-context";

const DEFAULT_NOTEBOOKS: Notebook[] = [
  { id: "inbox", name: "Inbox", color: "#6b7280", created_at: new Date().toISOString() },
  { id: "ideas", name: "Ideas", color: "#f59e0b", created_at: new Date().toISOString() },
  { id: "journal", name: "Journal", color: "#3b82f6", created_at: new Date().toISOString() },
];

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function saveToStorage<T>(key: string, data: T) {
  localStorage.setItem(key, JSON.stringify(data));
}

export function NotesProvider({ children }: { children: ReactNode }) {
  const [notes, setNotes] = useState<Note[]>(() =>
    loadFromStorage<Note[]>("dailyMark_notes", [])
  );
  const [notebooks, setNotebooks] = useState<Notebook[]>(() =>
    loadFromStorage<Notebook[]>("dailyMark_notebooks", DEFAULT_NOTEBOOKS)
  );

  useEffect(() => { saveToStorage("dailyMark_notes", notes); }, [notes]);
  useEffect(() => { saveToStorage("dailyMark_notebooks", notebooks); }, [notebooks]);

  // Future: Supabase sync
  useEffect(() => {
    const client = getSupabase();
    if (!client) return;
  }, []);

  const addNote = useCallback(
    (note: Omit<Note, "id" | "created_at" | "updated_at">) => {
      const now = new Date().toISOString();
      const newNote: Note = { ...note, id: generateId(), created_at: now, updated_at: now };
      setNotes((prev) => [newNote, ...prev]);
      return newNote;
    },
    []
  );

  const updateNote = useCallback((id: string, data: Partial<Note>) => {
    setNotes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, ...data, updated_at: new Date().toISOString() } : n))
    );
  }, []);

  const deleteNote = useCallback((id: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const togglePin = useCallback((id: string) => {
    setNotes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_pinned: !n.is_pinned } : n))
    );
  }, []);

  const addNotebook = useCallback((name: string, color: string) => {
    const nb: Notebook = { id: generateId(), name, color, created_at: new Date().toISOString() };
    setNotebooks((prev) => [...prev, nb]);
    return nb;
  }, []);

  return (
    <NotesContext.Provider
      value={{ notes, notebooks, addNote, updateNote, deleteNote, togglePin, addNotebook }}
    >
      {children}
    </NotesContext.Provider>
  );
}
