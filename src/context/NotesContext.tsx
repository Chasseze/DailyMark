import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { NewNote, Note, Notebook, NoteUpdate } from "../lib/types";
import type { NoteRow, SearchNoteRow } from "../lib/database.types";
import { createNotebookShare, createNoteShare } from "../lib/share";
import { errorMessage, requireSupabase } from "../lib/supabase";
import { useAuth } from "./auth-context";
import { NotesContext } from "./notes-context";

const LIST_COLUMNS =
  "id,user_id,notebook_id,title,preview,is_pinned,tags,deleted_at,revisit_at,created_at,updated_at";

function asListNote(row: Omit<NoteRow, "content"> & { content?: string }): Note {
  return {
    ...row,
    content: "",
    preview: row.preview ?? "",
    deleted_at: row.deleted_at ?? null,
    revisit_at: row.revisit_at ?? null,
    bodyLoaded: false,
  };
}

function asHydratedNote(row: NoteRow): Note {
  return {
    ...row,
    preview: row.preview ?? "",
    deleted_at: row.deleted_at ?? null,
    revisit_at: row.revisit_at ?? null,
    bodyLoaded: true,
  };
}

function asSearchNote(row: SearchNoteRow): Note {
  return {
    id: row.id,
    user_id: row.user_id,
    notebook_id: row.notebook_id,
    title: row.title,
    content: "",
    preview: row.preview ?? "",
    is_pinned: row.is_pinned,
    tags: row.tags ?? [],
    deleted_at: row.deleted_at,
    revisit_at: null,
    created_at: row.created_at,
    updated_at: row.updated_at,
    bodyLoaded: false,
  };
}

export function NotesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [notes, setNotes] = useState<Note[]>([]);
  const [trash, setTrash] = useState<Note[]>([]);
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Avoid depending togglePin on the full notes array identity.
  const notesRef = useRef(notes);
  const trashRef = useRef(trash);
  useEffect(() => {
    notesRef.current = notes;
  }, [notes]);
  useEffect(() => {
    trashRef.current = trash;
  }, [trash]);

  const fetchAll = useCallback(async (uid: string | null) => {
    if (!uid) {
      return { notes: [] as Note[], trash: [] as Note[], notebooks: [] as Notebook[] };
    }

    const db = requireSupabase();
    const [notesRes, trashRes, notebooksRes] = await Promise.all([
      db
        .from("notes")
        .select(LIST_COLUMNS)
        .is("deleted_at", null)
        .order("is_pinned", { ascending: false })
        .order("updated_at", { ascending: false }),
      db
        .from("notes")
        .select(LIST_COLUMNS)
        .not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false }),
      db.from("notebooks").select("*").order("created_at"),
    ]);

    if (notesRes.error) throw notesRes.error;
    if (trashRes.error) throw trashRes.error;
    if (notebooksRes.error) throw notebooksRes.error;

    return {
      notes: (notesRes.data as Omit<NoteRow, "content">[]).map(asListNote),
      trash: (trashRes.data as Omit<NoteRow, "content">[]).map(asListNote),
      notebooks: notebooksRes.data,
    };
  }, []);

  const refresh = useCallback(async () => {
    try {
      const data = await fetchAll(userId);
      setNotes(data.notes);
      setTrash(data.trash);
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
        setTrash(data.trash);
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
    const existing =
      notesRef.current.find((n) => n.id === id) ?? trashRef.current.find((n) => n.id === id);
    if (existing?.bodyLoaded) return existing;

    const db = requireSupabase();
    const { data, error: err } = await db.from("notes").select("*").eq("id", id).maybeSingle();
    if (err) throw err;
    if (!data) return null;

    const hydrated = asHydratedNote(data as NoteRow);
    const target = hydrated.deleted_at ? setTrash : setNotes;
    const other = hydrated.deleted_at ? setNotes : setTrash;
    target((prev) => {
      const idx = prev.findIndex((n) => n.id === id);
      if (idx === -1) return [hydrated, ...prev];
      const next = prev.slice();
      next[idx] = hydrated;
      return next;
    });
    other((prev) => prev.filter((n) => n.id !== id));
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

  /**
   * Autosave path. Sends only the fields that actually changed and asks for
   * three columns back instead of the whole row — a full `select()` echoed the
   * entire Markdown body on every pause in typing, then replaced the note
   * object and re-rendered the list with it. `preview` and `updated_at` are
   * both computed server-side (see 0002_notes_preview), so they still have to
   * come back; `content` does not, because we already have it.
   */
  const patchNote = useCallback(async (id: string, data: NoteUpdate) => {
    if (Object.keys(data).length === 0) return;

    const db = requireSupabase();
    const { data: row, error: err } = await db
      .from("notes")
      .update(data)
      .eq("id", id)
      .select("id,updated_at,preview")
      .single();
    if (err) throw err;

    const patch = { ...data, updated_at: row.updated_at, preview: row.preview ?? "" };
    setNotes((prev) => {
      const idx = prev.findIndex((n) => n.id === id);
      if (idx === -1) return prev;
      const next = prev.slice();
      next[idx] = { ...next[idx], ...patch };
      return next;
    });
  }, []);

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
    if (hydrated.deleted_at) {
      setNotes((prev) => prev.filter((n) => n.id !== id));
      setTrash((prev) => {
        const idx = prev.findIndex((n) => n.id === id);
        if (idx === -1) return [hydrated, ...prev];
        const next = prev.slice();
        next[idx] = hydrated;
        return next;
      });
    } else {
      setTrash((prev) => prev.filter((n) => n.id !== id));
      setNotes((prev) => {
        const idx = prev.findIndex((n) => n.id === id);
        if (idx === -1) return [hydrated, ...prev];
        const next = prev.slice();
        next[idx] = hydrated;
        return next;
      });
    }
  }, []);

  const deleteNote = useCallback(
    async (id: string) => {
      await updateNote(id, { deleted_at: new Date().toISOString() });
    },
    [updateNote]
  );

  const restoreNote = useCallback(
    async (id: string) => {
      await updateNote(id, { deleted_at: null });
    },
    [updateNote]
  );

  const purgeNote = useCallback(async (id: string) => {
    const db = requireSupabase();
    const { error: err } = await db.from("notes").delete().eq("id", id);
    if (err) throw err;
    setNotes((prev) => prev.filter((n) => n.id !== id));
    setTrash((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const emptyTrash = useCallback(async () => {
    const ids = trashRef.current.map((n) => n.id);
    if (ids.length === 0) return;
    const db = requireSupabase();
    const { error: err } = await db.from("notes").delete().in("id", ids);
    if (err) throw err;
    setTrash([]);
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

  const updateNotebook = useCallback(async (id: string, data: { name?: string; color?: string }) => {
    const db = requireSupabase();
    const { data: row, error: err } = await db
      .from("notebooks")
      .update(data)
      .eq("id", id)
      .select()
      .single();
    if (err) throw err;
    setNotebooks((prev) => prev.map((nb) => (nb.id === id ? row : nb)));
  }, []);

  const deleteNotebook = useCallback(async (id: string) => {
    const db = requireSupabase();
    // FK on notes.notebook_id is ON DELETE SET NULL, so notes stay put.
    const { error: err } = await db.from("notebooks").delete().eq("id", id);
    if (err) throw err;
    setNotebooks((prev) => prev.filter((nb) => nb.id !== id));
    setNotes((prev) =>
      prev.map((n) => (n.notebook_id === id ? { ...n, notebook_id: null } : n))
    );
  }, []);

  const searchNotes = useCallback(async (query: string) => {
    const q = query.trim();
    if (!q) return [];
    const db = requireSupabase();
    const { data, error: err } = await db.rpc("search_notes", { q });
    if (err) throw err;
    return ((data ?? []) as SearchNoteRow[]).map(asSearchNote);
  }, []);

  const inboxId = useMemo(
    () => notebooks.find((nb) => nb.name.toLowerCase() === "inbox")?.id ?? null,
    [notebooks]
  );

  const dueNotes = useMemo(() => {
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    return notes
      .filter((n) => n.revisit_at && new Date(n.revisit_at).getTime() <= end.getTime())
      .sort(
        (a, b) =>
          new Date(a.revisit_at!).getTime() - new Date(b.revisit_at!).getTime()
      );
  }, [notes]);

  const shareNote = useCallback(
    async (noteId: string) => {
      if (!userId) throw new Error("You must be signed in to share.");
      return createNoteShare(userId, noteId);
    },
    [userId]
  );

  const shareNotebook = useCallback(
    async (notebookId: string) => {
      if (!userId) throw new Error("You must be signed in to share.");
      return createNotebookShare(userId, notebookId);
    },
    [userId]
  );

  const value = useMemo(
    () => ({
      notes,
      trash,
      notebooks,
      loading,
      error,
      addNote,
      updateNote,
      patchNote,
      deleteNote,
      restoreNote,
      purgeNote,
      emptyTrash,
      togglePin,
      addNotebook,
      updateNotebook,
      deleteNotebook,
      ensureNote,
      searchNotes,
      inboxId,
      dueNotes,
      createNoteShare: shareNote,
      createNotebookShare: shareNotebook,
      refresh,
    }),
    [
      notes,
      trash,
      notebooks,
      loading,
      error,
      addNote,
      updateNote,
      patchNote,
      deleteNote,
      restoreNote,
      purgeNote,
      emptyTrash,
      togglePin,
      addNotebook,
      updateNotebook,
      deleteNotebook,
      ensureNote,
      searchNotes,
      inboxId,
      dueNotes,
      shareNote,
      shareNotebook,
      refresh,
    ]
  );

  return <NotesContext.Provider value={value}>{children}</NotesContext.Provider>;
}
