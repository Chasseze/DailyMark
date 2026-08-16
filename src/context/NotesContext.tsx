import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { NewNote, Note, Notebook, NoteUpdate } from "../lib/types";
import type { NoteRow, SearchNoteRow } from "../lib/database.types";
import {
  enqueueOutbox,
  isOnline,
  listOutbox,
  loadNotesSnapshot,
  newClientId,
  removeOutbox,
  saveNotesSnapshot,
  type OutboxOp,
} from "../lib/notes-offline";
import { createNotebookShare, createNoteShare } from "../lib/share";
import { errorMessage, requireSupabase } from "../lib/supabase";
import { useAuth } from "./auth-context";
import { NotesContext } from "./notes-context";

const LIST_COLUMNS =
  "id,user_id,notebook_id,title,preview,is_pinned,tags,deleted_at,revisit_at,created_at,updated_at";

const OFFLINE_ERROR = "Working offline";

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

function makePreview(content: string): string {
  return content.replace(/\s+/g, " ").trim().slice(0, 160);
}

function newOutboxId(): string {
  return `${Date.now()}-${newClientId()}`;
}

function mergeById(list: Note[], id: string, patch: Partial<Note>): Note[] {
  const idx = list.findIndex((n) => n.id === id);
  if (idx === -1) return list;
  const next = list.slice();
  next[idx] = { ...next[idx], ...patch };
  return next;
}

function localSearch(pool: Note[], query: string): Note[] {
  const q = query.toLowerCase();
  return pool.filter(
    (n) =>
      n.title.toLowerCase().includes(q) ||
      (n.preview ?? "").toLowerCase().includes(q) ||
      (n.content ?? "").toLowerCase().includes(q)
  );
}

export function NotesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [notes, setNotes] = useState<Note[]>([]);
  const [trash, setTrash] = useState<Note[]>([]);
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(() => !isOnline());
  // Avoid depending togglePin on the full notes array identity.
  const notesRef = useRef(notes);
  const trashRef = useRef(trash);
  const notebooksRef = useRef(notebooks);
  const flushingRef = useRef(false);
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

  const persistSnapshot = useCallback(
    async (uid: string, nextNotes: Note[], nextTrash: Note[], nextNotebooks?: Notebook[]) => {
      await saveNotesSnapshot({
        userId: uid,
        notes: nextNotes,
        trash: nextTrash,
        notebooks: nextNotebooks ?? notebooksRef.current,
        savedAt: new Date().toISOString(),
      });
    },
    []
  );

  const applySnapshot = useCallback(
    (snap: { notes: Note[]; trash: Note[]; notebooks: Notebook[] }) => {
      setNotes(snap.notes);
      setTrash(snap.trash);
      setNotebooks(snap.notebooks);
    },
    []
  );

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

  const flushOutbox = useCallback(async () => {
    if (!isOnline() || flushingRef.current) return;
    flushingRef.current = true;
    try {
      const db = requireSupabase();
      const ops = (await listOutbox()).slice().sort((a, b) => a.id.localeCompare(b.id));
      for (const op of ops) {
        await applyOutboxOp(db, op);
        await removeOutbox(op.id);
      }
    } finally {
      flushingRef.current = false;
    }
  }, []);

  const refresh = useCallback(async () => {
    if (!userId) {
      setNotes([]);
      setTrash([]);
      setNotebooks([]);
      setLoading(false);
      setError(null);
      setOffline(false);
      return;
    }

    if (!isOnline()) {
      const snap = await loadNotesSnapshot(userId);
      if (snap) {
        applySnapshot(snap);
        setError(OFFLINE_ERROR);
      } else {
        setError(OFFLINE_ERROR);
      }
      setOffline(true);
      setLoading(false);
      return;
    }

    try {
      await flushOutbox();
      const data = await fetchAll(userId);
      setNotes(data.notes);
      setTrash(data.trash);
      setNotebooks(data.notebooks);
      await persistSnapshot(userId, data.notes, data.trash, data.notebooks);
      setError(null);
      setOffline(false);
    } catch (err) {
      const snap = await loadNotesSnapshot(userId);
      if (snap) {
        applySnapshot(snap);
        setError(OFFLINE_ERROR);
        setOffline(true);
      } else {
        setError(errorMessage(err));
      }
    } finally {
      setLoading(false);
    }
  }, [applySnapshot, fetchAll, flushOutbox, persistSnapshot, userId]);

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
        setOffline(false);
        setLoading(false);
        return;
      }

      if (!isOnline()) {
        const snap = await loadNotesSnapshot(userId);
        if (!active) return;
        if (snap) applySnapshot(snap);
        setError(OFFLINE_ERROR);
        setOffline(true);
        setLoading(false);
        return;
      }

      try {
        await flushOutbox();
        if (!active) return;
        const data = await fetchAll(userId);
        if (!active) return;
        setNotes(data.notes);
        setTrash(data.trash);
        setNotebooks(data.notebooks);
        await persistSnapshot(userId, data.notes, data.trash, data.notebooks);
        setError(null);
        setOffline(false);
      } catch (err) {
        const snap = await loadNotesSnapshot(userId);
        if (!active) return;
        if (snap) {
          applySnapshot(snap);
          setError(OFFLINE_ERROR);
          setOffline(true);
        } else if (active) {
          setError(errorMessage(err));
        }
      } finally {
        if (active) setLoading(false);
      }
    })();

    const onOnline = () => {
      void refreshRef.current();
    };
    const onOffline = () => {
      setOffline(true);
      setError(OFFLINE_ERROR);
    };

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    return () => {
      active = false;
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [applySnapshot, fetchAll, flushOutbox, persistSnapshot, userId]);

  const ensureNote = useCallback(
    async (id: string) => {
      const existing =
        notesRef.current.find((n) => n.id === id) ?? trashRef.current.find((n) => n.id === id);
      if (existing?.bodyLoaded) return existing;

      if (!isOnline()) {
        setOffline(true);
        setError(OFFLINE_ERROR);
        return null;
      }

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
        if (userId) {
          await persistSnapshot(userId, nextNotes, nextTrash);
        }
        return hydrated;
      } catch {
        if (existing?.bodyLoaded) {
          setOffline(true);
          setError(OFFLINE_ERROR);
          return existing;
        }
        throw new Error(OFFLINE_ERROR);
      }
    },
    [persistSnapshot, userId]
  );

  const addNote = useCallback(
    async (note: NewNote) => {
      if (!userId) throw new Error("You must be signed in to create a note.");

      if (!isOnline()) {
        const now = new Date().toISOString();
        const hydrated: Note = {
          id: newClientId(),
          user_id: userId,
          notebook_id: note.notebook_id ?? null,
          title: note.title ?? "",
          content: note.content ?? "",
          preview: makePreview(note.content ?? ""),
          is_pinned: note.is_pinned ?? false,
          tags: note.tags ?? [],
          deleted_at: null,
          revisit_at: null,
          created_at: now,
          updated_at: now,
          bodyLoaded: true,
        };
        const nextNotes = [hydrated, ...notesRef.current];
        setNotes(nextNotes);
        await enqueueOutbox({ id: newOutboxId(), type: "insert", note: hydrated });
        await persistSnapshot(userId, nextNotes, trashRef.current);
        setOffline(true);
        setError(OFFLINE_ERROR);
        return hydrated;
      }

      const db = requireSupabase();
      const { data, error: err } = await db
        .from("notes")
        .insert({ ...note, user_id: userId })
        .select()
        .single();
      if (err) throw err;

      const hydrated = asHydratedNote(data as NoteRow);
      const nextNotes = [hydrated, ...notesRef.current];
      setNotes(nextNotes);
      await persistSnapshot(userId, nextNotes, trashRef.current);
      return hydrated;
    },
    [persistSnapshot, userId]
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

      const nextNotes = mergeById(notesRef.current, id, localPatch);
      const nextTrash = mergeById(trashRef.current, id, localPatch);
      setNotes(nextNotes);
      setTrash(nextTrash);

      const enqueueAndKeep = async () => {
        await enqueueOutbox({ id: newOutboxId(), type: "patch", noteId: id, data });
        if (userId) await persistSnapshot(userId, nextNotes, nextTrash);
        setOffline(true);
        setError(OFFLINE_ERROR);
      };

      if (!isOnline()) {
        await enqueueAndKeep();
        return;
      }

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
        if (userId) await persistSnapshot(userId, syncedNotes, syncedTrash);
      } catch {
        await enqueueAndKeep();
      }
    },
    [persistSnapshot, userId]
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
      let nextNotes = notesRef.current.filter((n) => n.id !== id);
      let nextTrash = trashRef.current.filter((n) => n.id !== id);
      if (merged.deleted_at) {
        nextTrash = [merged, ...nextTrash];
      } else {
        nextNotes = [merged, ...nextNotes];
      }
      setNotes(nextNotes);
      setTrash(nextTrash);

      const enqueueAndKeep = async () => {
        await enqueueOutbox({ id: newOutboxId(), type: "update", noteId: id, data });
        if (userId) await persistSnapshot(userId, nextNotes, nextTrash);
        setOffline(true);
        setError(OFFLINE_ERROR);
      };

      if (!isOnline()) {
        await enqueueAndKeep();
        return;
      }

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
        if (userId) await persistSnapshot(userId, nextNotes, nextTrash);
      } catch {
        await enqueueAndKeep();
      }
    },
    [persistSnapshot, userId]
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
      const nextNotes = notesRef.current.filter((n) => n.id !== id);
      const nextTrash = trashRef.current.filter((n) => n.id !== id);
      setNotes(nextNotes);
      setTrash(nextTrash);

      const enqueueAndKeep = async () => {
        await enqueueOutbox({ id: newOutboxId(), type: "purge", noteId: id });
        if (userId) await persistSnapshot(userId, nextNotes, nextTrash);
        setOffline(true);
        setError(OFFLINE_ERROR);
      };

      if (!isOnline()) {
        await enqueueAndKeep();
        return;
      }

      try {
        const db = requireSupabase();
        const { error: err } = await db.from("notes").delete().eq("id", id);
        if (err) throw err;
        if (userId) await persistSnapshot(userId, nextNotes, nextTrash);
      } catch {
        await enqueueAndKeep();
      }
    },
    [persistSnapshot, userId]
  );

  const emptyTrash = useCallback(async () => {
    const ids = trashRef.current.map((n) => n.id);
    if (ids.length === 0) return;

    const nextTrash: Note[] = [];
    setTrash(nextTrash);

    const enqueueAndKeep = async () => {
      await enqueueOutbox({ id: newOutboxId(), type: "emptyTrash", noteIds: ids });
      if (userId) await persistSnapshot(userId, notesRef.current, nextTrash);
      setOffline(true);
      setError(OFFLINE_ERROR);
    };

    if (!isOnline()) {
      await enqueueAndKeep();
      return;
    }

    try {
      const db = requireSupabase();
      const { error: err } = await db.from("notes").delete().in("id", ids);
      if (err) throw err;
      if (userId) await persistSnapshot(userId, notesRef.current, nextTrash);
    } catch {
      await enqueueAndKeep();
    }
  }, [persistSnapshot, userId]);

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

      const nextNotebooks = [...notebooksRef.current, data];
      setNotebooks(nextNotebooks);
      await persistSnapshot(userId, notesRef.current, trashRef.current, nextNotebooks);
      return data;
    },
    [persistSnapshot, userId]
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
      const nextNotebooks = notebooksRef.current.map((nb) => (nb.id === id ? row : nb));
      setNotebooks(nextNotebooks);
      if (userId) {
        await persistSnapshot(userId, notesRef.current, trashRef.current, nextNotebooks);
      }
    },
    [persistSnapshot, userId]
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
      if (userId) {
        await persistSnapshot(userId, nextNotes, trashRef.current, nextNotebooks);
      }
    },
    [persistSnapshot, userId]
  );

  const searchNotes = useCallback(async (query: string) => {
    const q = query.trim();
    if (!q) return [];

    if (!isOnline()) {
      setOffline(true);
      return localSearch([...notesRef.current, ...trashRef.current], q);
    }

    try {
      const db = requireSupabase();
      const { data, error: err } = await db.rpc("search_notes", { q });
      if (err) throw err;
      return ((data ?? []) as SearchNoteRow[]).map(asSearchNote);
    } catch {
      setOffline(true);
      setError(OFFLINE_ERROR);
      return localSearch([...notesRef.current, ...trashRef.current], q);
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
      offline,
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
      offline,
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

async function applyOutboxOp(
  db: ReturnType<typeof requireSupabase>,
  op: OutboxOp
): Promise<void> {
  switch (op.type) {
    case "insert": {
      const n = op.note;
      const { error: err } = await db.from("notes").insert({
        id: n.id,
        user_id: n.user_id,
        notebook_id: n.notebook_id,
        title: n.title,
        content: n.content,
        is_pinned: n.is_pinned,
        tags: n.tags,
        deleted_at: n.deleted_at,
        revisit_at: n.revisit_at,
      });
      if (err) throw err;
      return;
    }
    case "patch":
    case "update": {
      const { error: err } = await db.from("notes").update(op.data).eq("id", op.noteId);
      if (err) throw err;
      return;
    }
    case "purge": {
      const { error: err } = await db.from("notes").delete().eq("id", op.noteId);
      if (err) throw err;
      return;
    }
    case "emptyTrash": {
      if (op.noteIds.length === 0) return;
      const { error: err } = await db.from("notes").delete().in("id", op.noteIds);
      if (err) throw err;
      return;
    }
  }
}
