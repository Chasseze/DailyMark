import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { NewNote, Note, Notebook, NoteUpdate } from "../lib/types";
import type { NoteRow } from "../lib/database.types";
import { errorMessage, requireSupabase } from "../lib/supabase";
import { useAuth } from "./auth-context";
import { NotesContext } from "./notes-context";

const LIST_COLUMNS =
  "id,user_id,notebook_id,title,preview,is_pinned,tags,created_at,updated_at";

function asListNote(row: Omit<NoteRow, "content"> & { content?: string }): Note {
  return {
    ...row,
    content: "",
    preview: row.preview ?? "",
    bodyLoaded: false,
  };
}

function asHydratedNote(row: NoteRow): Note {
  return { ...row, preview: row.preview ?? "", bodyLoaded: true };
}

export function NotesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [notes, setNotes] = useState<Note[]>([]);
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Avoid depending togglePin on the full notes array identity.
  const notesRef = useRef(notes);
  useEffect(() => {
    notesRef.current = notes;
  }, [notes]);

  const fetchAll = useCallback(async (uid: string | null) => {
    if (!uid) return { notes: [] as Note[], notebooks: [] as Notebook[] };

    const db = requireSupabase();
    // Slim list: preview instead of full content. Opened notes hydrate via ensureNote.
    const [notesRes, notebooksRes] = await Promise.all([
      db
        .from("notes")
        .select(LIST_COLUMNS)
        .order("is_pinned", { ascending: false })
        .order("updated_at", { ascending: false }),
      db.from("notebooks").select("*").order("created_at"),
    ]);

    if (notesRes.error) throw notesRes.error;
    if (notebooksRes.error) throw notebooksRes.error;

    return {
      notes: (notesRes.data as Omit<NoteRow, "content">[]).map(asListNote),
      notebooks: notebooksRes.data,
    };
  }, []);

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

  const ensureNote = useCallback(async (id: string) => {
    const existing = notesRef.current.find((n) => n.id === id);
    if (existing?.bodyLoaded) return existing;

    const db = requireSupabase();
    const { data, error: err } = await db.from("notes").select("*").eq("id", id).maybeSingle();
    if (err) throw err;
    if (!data) return null;

    const hydrated = asHydratedNote(data as NoteRow);
    setNotes((prev) => {
      const idx = prev.findIndex((n) => n.id === id);
      if (idx === -1) return [hydrated, ...prev];
      const next = prev.slice();
      next[idx] = hydrated;
      return next;
    });
    return hydrated;
  }, []);

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

      const hydrated = asHydratedNote(data as NoteRow);
      setNotes((prev) => [hydrated, ...prev]);
      return hydrated;
    },
    [userId]
  );

  const updateNote = useCallback(async (id: string, data: NoteUpdate) => {
    const db = requireSupabase();
    const { data: row, error: err } = await db
      .from("notes")
      .update(data)
      .eq("id", id)
      .select()
      .single();
    if (err) throw err;

    const hydrated = asHydratedNote(row as NoteRow);
    setNotes((prev) => prev.map((n) => (n.id === id ? hydrated : n)));
  }, []);

  const deleteNote = useCallback(async (id: string) => {
    const db = requireSupabase();
    const { error: err } = await db.from("notes").delete().eq("id", id);
    if (err) throw err;

    setNotes((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const togglePin = useCallback(
    async (id: string) => {
      const current = notesRef.current.find((n) => n.id === id);
      if (!current) return;
      await updateNote(id, { is_pinned: !current.is_pinned });
    },
    [updateNote]
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

  const value = useMemo(
    () => ({
      notes,
      notebooks,
      loading,
      error,
      addNote,
      updateNote,
      deleteNote,
      togglePin,
      addNotebook,
      ensureNote,
      refresh,
    }),
    [
      notes,
      notebooks,
      loading,
      error,
      addNote,
      updateNote,
      deleteNote,
      togglePin,
      addNotebook,
      ensureNote,
      refresh,
    ]
  );

  return <NotesContext.Provider value={value}>{children}</NotesContext.Provider>;
}
