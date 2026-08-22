import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { NewNote, Note, Notebook, NoteUpdate } from "../lib/types";
import type { NoteRow, SearchNoteRow } from "../lib/database.types";
import { createNotebookShare, createNoteShare } from "../lib/share";
import { errorMessage, requireSupabase } from "../lib/supabase";
import { useAuth } from "./auth-context";
import { NotesContext } from "./notes-context";

const LIST_COLUMNS =
  "id,user_id,notebook_id,title,preview,is_pinned,tags,deleted_at,revisit_at,revisit_step,created_at,updated_at";

/**
 * Notes are read from and written to Supabase, and nowhere else.
 *
 * There used to be an IndexedDB snapshot and an outbox behind all of this so
 * edits could queue while offline. It is gone on purpose: a device holding its
 * own copy of the account is a second source of truth, and a stale one could
 * be pushed over good data. Every read here is a read of the account, and a
 * write that cannot reach it fails loudly instead of being stored locally.
 */

function asListNote(row: Omit<NoteRow, "content"> & { content?: string }): Note {
  return {
    ...row,
    content: "",
    preview: row.preview ?? "",
    deleted_at: row.deleted_at ?? null,
    revisit_at: row.revisit_at ?? null,
    revisit_step: row.revisit_step ?? 0,
    bodyLoaded: false,
  };
}

function asHydratedNote(row: NoteRow): Note {
  return {
    ...row,
    preview: row.preview ?? "",
    deleted_at: row.deleted_at ?? null,
    revisit_at: row.revisit_at ?? null,
    revisit_step: row.revisit_step ?? 0,
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
    revisit_step: 0,
    created_at: row.created_at,
    updated_at: row.updated_at,
    bodyLoaded: false,
  };
}

function makePreview(content: string): string {
  return content.replace(/\s+/g, " ").trim().slice(0, 160);
}

function mergeById(list: Note[], id: string, patch: Partial<Note>): Note[] {
  const idx = list.findIndex((n) => n.id === id);
  if (idx === -1) return list;
  const next = list.slice();
  next[idx] = { ...next[idx], ...patch };
  return next;
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
  const notebooksRef = useRef(notebooks);
  const refreshRef = useRef<() => Promise<void>>(async () => {});
  useEffect(() => {
    notesRef.current = notes;
  }, [notes]);
  useEffect(() => {
    trashRef.current = trash;
  }, [trash]);
  useEffect(() => {
    notebooksRef.current = notebooks;
  }, [notebooks]);

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
    if (!userId) {
      setNotes([]);
      setTrash([]);
      setNotebooks([]);
      setLoading(false);
      setError(null);
      return;
    }

    try {
      const data = await fetchAll(userId);
      setNotes(data.notes);
      setTrash(data.trash);
      setNotebooks(data.notebooks);
      setError(null);
    } catch (err) {
      // Keep whatever is on screen and say so. Replacing it with an empty list
      // would look like the account had been emptied.
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [fetchAll, userId]);

  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);

  useEffect(() => {
    let active = true;

    void (async () => {
      if (!userId) {
        if (!active) return;
        setNotes([]);
        setTrash([]);
        setNotebooks([]);
        setError(null);
        setLoading(false);
        return;
      }

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

    // Coming back online is the moment to re-read the account.
    const onOnline = () => {
      void refreshRef.current();
    };
    window.addEventListener("online", onOnline);

    return () => {
      active = false;
      window.removeEventListener("online", onOnline);
    };
  }, [fetchAll, userId]);

  const ensureNote = useCallback(
    async (id: string) => {
      const existing =
        notesRef.current.find((n) => n.id === id) ?? trashRef.current.find((n) => n.id === id);
      if (existing?.bodyLoaded) return existing;

      try {
        const db = requireSupabase();
        const { data, error: err } = await db.from("notes").select("*").eq("id", id).maybeSingle();
        if (err) throw err;
        if (!data) return null;

        const hydrated = asHydratedNote(data as NoteRow);
        const inTrash = Boolean(hydrated.deleted_at);
        let nextNotes = notesRef.current.filter((n) => n.id !== id);
        let nextTrash = trashRef.current.filter((n) => n.id !== id);
        if (inTrash) {
          const idx = nextTrash.findIndex((n) => n.id === id);
          nextTrash =
            idx === -1
              ? [hydrated, ...nextTrash]
              : nextTrash.map((n, i) => (i === idx ? hydrated : n));
          setTrash(nextTrash);
          setNotes(nextNotes);
        } else {
          const idx = nextNotes.findIndex((n) => n.id === id);
          nextNotes =
            idx === -1
              ? [hydrated, ...nextNotes]
              : nextNotes.map((n, i) => (i === idx ? hydrated : n));
          setNotes(nextNotes);
          setTrash(nextTrash);
        }
        return hydrated;
      } catch (err) {
        setError(errorMessage(err));
        throw err;
      }
    },
    []
  );

  const addNote = useCallback(
    async (note: NewNote) => {
      if (!userId) throw new Error("You must be signed in to create a note.");

      const db = requireSupabase();
      const { data, error: err } = await db
        .from("notes")
        .insert({ ...note, user_id: userId })
        .select()
        .single();
      if (err) throw err;

      const hydrated = asHydratedNote(data as NoteRow);
      setNotes([hydrated, ...notesRef.current]);
      setError(null);
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
  const patchNote = useCallback(
    async (id: string, data: NoteUpdate) => {
      if (Object.keys(data).length === 0) return;

      const localPatch: Partial<Note> = {
        ...data,
        updated_at: new Date().toISOString(),
      };
      if (data.content !== undefined) {
        localPatch.preview = makePreview(data.content);
        localPatch.bodyLoaded = true;
      }

      const prevNotes = notesRef.current;
      const prevTrash = trashRef.current;
      const nextNotes = mergeById(prevNotes, id, localPatch);
      const nextTrash = mergeById(prevTrash, id, localPatch);
      setNotes(nextNotes);
      setTrash(nextTrash);

      try {
        const db = requireSupabase();
        const { data: row, error: err } = await db
          .from("notes")
          .update(data)
          .eq("id", id)
          .select("id,updated_at,preview")
          .single();
        if (err) throw err;

        const patch = { ...data, updated_at: row.updated_at, preview: row.preview ?? "" };
        const syncedNotes = mergeById(nextNotes, id, patch);
        const syncedTrash = mergeById(nextTrash, id, patch);
        setNotes(syncedNotes);
        setTrash(syncedTrash);
        setError(null);
      } catch (err) {
        // Roll the optimistic edit back to the list as it stood before this
        // call. Reading the refs here would not do it: they are refreshed from
        // an effect the moment the optimistic setState commits, so by the time
        // the write rejects they already hold the edit being undone.
        setNotes(prevNotes);
        setTrash(prevTrash);
        setError(errorMessage(err));
        throw err;
      }
    },
    []
  );

  const updateNote = useCallback(
    async (id: string, data: NoteUpdate) => {
      const now = new Date().toISOString();
      const localPatch: Partial<Note> = {
        ...data,
        updated_at: now,
      };
      if (data.content !== undefined) {
        localPatch.preview = makePreview(data.content);
        localPatch.bodyLoaded = true;
      }

      const fromNotes = notesRef.current.find((n) => n.id === id);
      const fromTrash = trashRef.current.find((n) => n.id === id);
      const base = fromNotes ?? fromTrash;
      if (!base) return;

      const merged: Note = { ...base, ...localPatch };
      const prevNotes = notesRef.current;
      const prevTrash = trashRef.current;
      let nextNotes = prevNotes.filter((n) => n.id !== id);
      let nextTrash = prevTrash.filter((n) => n.id !== id);
      if (merged.deleted_at) {
        nextTrash = [merged, ...nextTrash];
      } else {
        nextNotes = [merged, ...nextNotes];
      }
      setNotes(nextNotes);
      setTrash(nextTrash);

      try {
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
          nextNotes = notesRef.current.filter((n) => n.id !== id);
          nextTrash = (() => {
            const prev = trashRef.current.filter((n) => n.id !== id);
            return [hydrated, ...prev];
          })();
        } else {
          nextTrash = trashRef.current.filter((n) => n.id !== id);
          nextNotes = (() => {
            const prev = notesRef.current.filter((n) => n.id !== id);
            return [hydrated, ...prev];
          })();
        }
        setNotes(nextNotes);
        setTrash(nextTrash);
        setError(null);
      } catch (err) {
        // Roll the optimistic edit back to the list as it stood before this
        // call. Reading the refs here would not do it: they are refreshed from
        // an effect the moment the optimistic setState commits, so by the time
        // the write rejects they already hold the edit being undone.
        setNotes(prevNotes);
        setTrash(prevTrash);
        setError(errorMessage(err));
        throw err;
      }
    },
    []
  );

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

  const purgeNote = useCallback(
    async (id: string) => {
      const prevNotes = notesRef.current;
      const prevTrash = trashRef.current;
      const nextNotes = prevNotes.filter((n) => n.id !== id);
      const nextTrash = prevTrash.filter((n) => n.id !== id);
      setNotes(nextNotes);
      setTrash(nextTrash);

      try {
        const db = requireSupabase();
        const { error: err } = await db.from("notes").delete().eq("id", id);
        if (err) throw err;
        setError(null);
      } catch (err) {
        // Roll the optimistic edit back to the list as it stood before this
        // call. Reading the refs here would not do it: they are refreshed from
        // an effect the moment the optimistic setState commits, so by the time
        // the write rejects they already hold the edit being undone.
        setNotes(prevNotes);
        setTrash(prevTrash);
        setError(errorMessage(err));
        throw err;
      }
    },
    []
  );

  const emptyTrash = useCallback(async () => {
    const prevTrash = trashRef.current;
    const ids = prevTrash.map((n) => n.id);
    if (ids.length === 0) return;

    setTrash([]);

    try {
      const db = requireSupabase();
      const { error: err } = await db.from("notes").delete().in("id", ids);
      if (err) throw err;
      setError(null);
    } catch (err) {
      // Put Trash back exactly as it was — the rows are still on the account.
      setTrash(prevTrash);
      setError(errorMessage(err));
      throw err;
    }
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

      setNotebooks([...notebooksRef.current, data]);
      return data;
    },
    [userId]
  );

  const updateNotebook = useCallback(
    async (id: string, data: { name?: string; color?: string }) => {
      const db = requireSupabase();
      const { data: row, error: err } = await db
        .from("notebooks")
        .update(data)
        .eq("id", id)
        .select()
        .single();
      if (err) throw err;
      setNotebooks(notebooksRef.current.map((nb) => (nb.id === id ? row : nb)));
    },
    []
  );

  const deleteNotebook = useCallback(
    async (id: string) => {
      const db = requireSupabase();
      // FK on notes.notebook_id is ON DELETE SET NULL, so notes stay put.
      const { error: err } = await db.from("notebooks").delete().eq("id", id);
      if (err) throw err;
      const nextNotebooks = notebooksRef.current.filter((nb) => nb.id !== id);
      const nextNotes = notesRef.current.map((n) =>
        n.notebook_id === id ? { ...n, notebook_id: null } : n
      );
      setNotebooks(nextNotebooks);
      setNotes(nextNotes);
    },
    []
  );

  const searchNotes = useCallback(async (query: string) => {
    const q = query.trim();
    if (!q) return [];

    try {
      const db = requireSupabase();
      const { data, error: err } = await db.rpc("search_notes", { q });
      if (err) throw err;
      return ((data ?? []) as SearchNoteRow[]).map(asSearchNote);
    } catch (err) {
      setError(errorMessage(err));
      return [];
    }
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
