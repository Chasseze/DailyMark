import { useCallback, useEffect, useState, type ReactNode } from "react";
import type { NewNote, Note, Notebook, NoteUpdate } from "../lib/types";
import { errorMessage, requireSupabase } from "../lib/supabase";
import { useAuth } from "./auth-context";
import { NotesContext } from "./notes-context";

export function NotesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [notes, setNotes] = useState<Note[]>([]);
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async (uid: string | null) => {
    if (!uid) return { notes: [] as Note[], notebooks: [] as Notebook[] };

    const db = requireSupabase();
    // RLS already scopes both tables to the current user; the ordering is what
    // the Notes page renders, so it comes from the indexed query.
    const [notesRes, notebooksRes] = await Promise.all([
      db
        .from("notes")
        .select("*")
        .order("is_pinned", { ascending: false })
        .order("updated_at", { ascending: false }),
      db.from("notebooks").select("*").order("created_at"),
    ]);

    if (notesRes.error) throw notesRes.error;
    if (notebooksRes.error) throw notebooksRes.error;

    return { notes: notesRes.data, notebooks: notebooksRes.data };
  }, []);

  // Every state update happens after an await, never synchronously in the
  // effect body — that's what keeps this off the cascading-render path.
  const refresh = useCallback(async () => {
    try {
      const data = await fetchAll(userId);
      setNotes(data.notes);
      setNotebooks(data.notebooks);
      setError(null);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [fetchAll, userId]);

  // Reload whenever the signed-in user changes. The `active` guard drops a
  // response that arrives after the user switched, so a slow request for the
  // previous account can't land its rows in the new one's session.
  useEffect(() => {
    let active = true;

    void (async () => {
      try {
        const data = await fetchAll(userId);
        if (!active) return;
        setNotes(data.notes);
        setNotebooks(data.notebooks);
        setError(null);
      } catch (err) {
        if (active) setError(errorMessage(err));
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [fetchAll, userId]);

  const addNote = useCallback(
    async (note: NewNote) => {
      const db = requireSupabase();
      if (!userId) throw new Error("You must be signed in to create a note.");

      const { data, error: err } = await db
        .from("notes")
        .insert({ ...note, user_id: userId })
        .select()
        .single();
      if (err) throw err;

      setNotes((prev) => [data, ...prev]);
      return data;
    },
    [userId]
  );

  const updateNote = useCallback(async (id: string, data: NoteUpdate) => {
    const db = requireSupabase();
    // updated_at is set by a database trigger, so the returned row is the
    // authority on it rather than a clock guess made here.
    const { data: row, error: err } = await db
      .from("notes")
      .update(data)
      .eq("id", id)
      .select()
      .single();
    if (err) throw err;

    setNotes((prev) => prev.map((n) => (n.id === id ? row : n)));
  }, []);

  const deleteNote = useCallback(async (id: string) => {
    const db = requireSupabase();
    const { error: err } = await db.from("notes").delete().eq("id", id);
    if (err) throw err;

    setNotes((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const togglePin = useCallback(
    async (id: string) => {
      const current = notes.find((n) => n.id === id);
      if (!current) return;
      await updateNote(id, { is_pinned: !current.is_pinned });
    },
    [notes, updateNote]
  );

  const addNotebook = useCallback(
    async (name: string, color: string) => {
      const db = requireSupabase();
      if (!userId) throw new Error("You must be signed in to create a notebook.");

      const { data, error: err } = await db
        .from("notebooks")
        .insert({ name, color, user_id: userId })
        .select()
        .single();
      if (err) throw err;

      setNotebooks((prev) => [...prev, data]);
      return data;
    },
    [userId]
  );

  return (
    <NotesContext.Provider
      value={{
        notes,
        notebooks,
        loading,
        error,
        addNote,
        updateNote,
        deleteNote,
        togglePin,
        addNotebook,
        refresh,
      }}
    >
      {children}
    </NotesContext.Provider>
  );
}
