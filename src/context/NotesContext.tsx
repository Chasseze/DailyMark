import { recordTiming } from "../lib/performance";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { NewNote, Note, Notebook, NoteUpdate } from "../lib/types";
import type { NoteRow, SearchNoteRow } from "../lib/database.types";
import { createNotebookShare, createNoteShare } from "../lib/share";
import { errorMessage, requireSupabase } from "../lib/supabase";
import { useAuth } from "./auth-context";
import { readAllPages } from "../lib/pagination";
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

function asListNote(
  row: Omit<NoteRow, "content"> & { content?: string },
): Note {
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
      return {
        notes: [] as Note[],
        trash: [] as Note[],
        notebooks: [] as Notebook[],
      };
    }

    const db = requireSupabase();
    const [notesRes, trashRes, notebooksRes] = await Promise.all([
      readAllPages((from, to) =>
        db
          .from("notes")
          .select(LIST_COLUMNS)
          .is("deleted_at", null)
          .order("id")
          .range(from, to),
      ),
      Promise.resolve({ data: [], error: null }),
      readAllPages((from, to) =>
        db.from("notebooks").select("*").order("id").range(from, to),
      ),
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
      // Refresh metadata without unmounting an editor or advancing its revision.
      const hydrated = notesRef.current.filter((n) => n.bodyLoaded);
      const ids = new Set(hydrated.map((n) => n.id));
      notesRef.current = [
        ...hydrated,
        ...data.notes.filter((n) => !ids.has(n.id)),
      ];
      setNotes(notesRef.current);
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

  const ensureNote = useCallback(async (id: string) => {
    const existing =
      notesRef.current.find((n) => n.id === id) ??
      trashRef.current.find((n) => n.id === id);
    if (existing?.bodyLoaded) return existing;

    try {
      const started = performance.now();
      const db = requireSupabase();
      const { data, error: err } = await db
        .from("notes")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      recordTiming("note-open", performance.now() - started);
      if (err) throw err;
      if (!data) return null;

      const hydrated = asHydratedNote(data as NoteRow);
      const already =
        notesRef.current.find((n) => n.id === id) ??
        trashRef.current.find((n) => n.id === id);
      if (already?.bodyLoaded) return already;
      notesRef.current = notesRef.current.filter((n) => n.id !== id);
      trashRef.current = trashRef.current.filter((n) => n.id !== id);
      if (hydrated.deleted_at)
        trashRef.current = [hydrated, ...trashRef.current];
      else notesRef.current = [hydrated, ...notesRef.current];
      setNotes(notesRef.current);
      setTrash(trashRef.current);
      return hydrated;
    } catch (err) {
      setError(errorMessage(err));
      throw err;
    }
  }, []);

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
      notesRef.current = [hydrated, ...notesRef.current];
      setNotes(notesRef.current);
      setError(null);
      return hydrated;
    },
    [userId],
  );

  /**
   * Autosave path. Sends only the fields that actually changed and asks for
   * three columns back instead of the whole row — a full `select()` echoed the
   * entire Markdown body on every pause in typing, then replaced the note
   * object and re-rendered the list with it. `preview` and `updated_at` are
   * both computed server-side (see 0002_notes_preview), so they still have to
   * come back; `content` does not, because we already have it.
   */
  // Every writer for a note uses the same queue and server revision check.
  const writes = useRef(new Map<string, Promise<void>>());
  const patchNote = useCallback((id: string, data: NoteUpdate) => {
    const run = async () => {
      const started = performance.now();
      const current =
        notesRef.current.find((n) => n.id === id) ??
        trashRef.current.find((n) => n.id === id);
      if (!current)
        throw new Error("Note is no longer available. Reload before editing.");
      if (!Object.keys(data).length) return;
      const { data: row, error: err } = await requireSupabase()
        .from("notes")
        .update(data)
        .eq("id", id)
        .eq("updated_at", current.updated_at)
        .select("id,updated_at,preview")
        .maybeSingle();
      if (err) throw err;
      if (!row)
        throw new Error(
          "This note changed on another device. Your writing is still here. Copy it, then reload the latest version before saving.",
        );
      recordTiming("note-save", performance.now() - started);
      const hydrated: Note = {...current,...data,...row,bodyLoaded: data.content !== undefined || current.bodyLoaded};
      // Merge into current state, never a snapshot captured before the request.
      notesRef.current = notesRef.current.filter((n) => n.id !== id);
      trashRef.current = trashRef.current.filter((n) => n.id !== id);
      if (hydrated.deleted_at)
        trashRef.current = [hydrated, ...trashRef.current];
      else notesRef.current = [hydrated, ...notesRef.current];
      setNotes(notesRef.current);
      setTrash(trashRef.current);
      setError(null);
    };
    const previous = writes.current.get(id) ?? Promise.resolve();
    const next = previous
      .catch(() => {})
      .then(run)
      .catch((err) => {
        recordTiming("save-failure", 0);
        throw err;
      });
    writes.current.set(id, next);
    void next
      .finally(() => {
        if (writes.current.get(id) === next) writes.current.delete(id);
      })
      .catch(() => {});
    return next;
  }, []);

  const updateNote = patchNote;

  const deleteNote = useCallback(
    async (id: string) => {
      await updateNote(id, { deleted_at: new Date().toISOString() });
    },
    [updateNote],
  );

  const restoreNote = useCallback(
    async (id: string) => {
      await updateNote(id, { deleted_at: null });
    },
    [updateNote],
  );

  const loadTrash = useCallback(async () => {
    const result = await readAllPages((from, to) =>
      requireSupabase()
        .from("notes")
        .select(LIST_COLUMNS)
        .not("deleted_at", "is", null)
        .order("id")
        .range(from, to),
    );
    if (result.error) throw result.error;
    trashRef.current = result.data.map(asListNote);
    setTrash(trashRef.current);
  }, []);

  const purgeNote = useCallback(async (id: string) => {
    const { error: err } = await requireSupabase()
      .from("notes")
      .delete()
      .eq("id", id)
      .not("deleted_at", "is", null);
    if (err) throw err;
    trashRef.current = trashRef.current.filter((n) => n.id !== id);
    setTrash(trashRef.current);
  }, []);

  const emptyTrash = useCallback(async () => {
    const { error: err } = await requireSupabase()
      .from("notes")
      .delete()
      .not("deleted_at", "is", null);
    if (err) throw err;
    trashRef.current = [];
    setTrash([]);
  }, []);

  const togglePin = useCallback(
    async (id: string) => {
      const current = notesRef.current.find((n) => n.id === id);
      if (!current) return;
      await updateNote(id, { is_pinned: !current.is_pinned });
    },
    [updateNote],
  );

  const addNotebook = useCallback(
    async (name: string, color: string) => {
      const db = requireSupabase();
      if (!userId)
        throw new Error("You must be signed in to create a notebook.");

      const { data, error: err } = await db
        .from("notebooks")
        .insert({ name, color, user_id: userId })
        .select()
        .single();
      if (err) throw err;

      notebooksRef.current = [...notebooksRef.current, data];
      setNotebooks(notebooksRef.current);
      return data;
    },
    [userId],
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
    [],
  );

  const deleteNotebook = useCallback(async (id: string) => {
    const db = requireSupabase();
    // FK on notes.notebook_id is ON DELETE SET NULL, so notes stay put.
    const { error: err } = await db.from("notebooks").delete().eq("id", id);
    if (err) throw err;
    const nextNotebooks = notebooksRef.current.filter((nb) => nb.id !== id);
    const nextNotes = notesRef.current.map((n) =>
      n.notebook_id === id ? { ...n, notebook_id: null } : n,
    );
    setNotebooks(nextNotebooks);
    setNotes(nextNotes);
  }, []);

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
      throw err;
    }
  }, []);

  const inboxId = useMemo(
    () => notebooks.find((nb) => nb.name.toLowerCase() === "inbox")?.id ?? null,
    [notebooks],
  );

  const dueNotes = useMemo(() => {
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    return notes
      .filter(
        (n) =>
          n.revisit_at && new Date(n.revisit_at).getTime() <= end.getTime(),
      )
      .sort(
        (a, b) =>
          new Date(a.revisit_at!).getTime() - new Date(b.revisit_at!).getTime(),
      );
  }, [notes]);

  const shareNote = useCallback(
    async (noteId: string) => {
      if (!userId) throw new Error("You must be signed in to share.");
      return createNoteShare(userId, noteId);
    },
    [userId],
  );

  const shareNotebook = useCallback(
    async (notebookId: string) => {
      if (!userId) throw new Error("You must be signed in to share.");
      return createNotebookShare(userId, notebookId);
    },
    [userId],
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
      loadTrash,
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
      loadTrash,
    ],
  );

  return (
    <NotesContext.Provider value={value}>{children}</NotesContext.Provider>
  );
}
