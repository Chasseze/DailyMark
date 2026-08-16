/**
 * IndexedDB note cache + outbox for offline editing.
 * Account data still lives in Supabase; this only bridges disconnects.
 */

import type { Note, Notebook, NoteUpdate } from "./types";

const DB_NAME = "dailymark-notes-v2";
const DB_VERSION = 1;

export type OutboxOp =
  | { id: string; type: "insert"; note: Note }
  | { id: string; type: "patch"; noteId: string; data: NoteUpdate }
  | { id: string; type: "update"; noteId: string; data: NoteUpdate }
  | { id: string; type: "purge"; noteId: string }
  | { id: string; type: "emptyTrash"; noteIds: string[] };

export interface NotesSnapshot {
  userId: string;
  notes: Note[];
  trash: Note[];
  notebooks: Notebook[];
  savedAt: string;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("snapshots")) {
        db.createObjectStore("snapshots", { keyPath: "userId" });
      }
      if (!db.objectStoreNames.contains("outbox")) {
        db.createObjectStore("outbox", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("meta")) {
        db.createObjectStore("meta", { keyPath: "key" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB open failed"));
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("IndexedDB tx failed"));
    tx.onabort = () => reject(tx.error ?? new Error("IndexedDB tx aborted"));
  });
}

export function isOnline(): boolean {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}

export async function saveNotesSnapshot(snap: NotesSnapshot): Promise<void> {
  const db = await openDb();
  const tx = db.transaction("snapshots", "readwrite");
  tx.objectStore("snapshots").put(snap);
  await txDone(tx);
}

export async function loadNotesSnapshot(userId: string): Promise<NotesSnapshot | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("snapshots", "readonly");
    const req = tx.objectStore("snapshots").get(userId);
    req.onsuccess = () => resolve((req.result as NotesSnapshot | undefined) ?? null);
    req.onerror = () => reject(req.error);
  });
}

export async function enqueueOutbox(op: OutboxOp): Promise<void> {
  const db = await openDb();
  const tx = db.transaction("outbox", "readwrite");
  tx.objectStore("outbox").put(op);
  await txDone(tx);
}

export async function listOutbox(): Promise<OutboxOp[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("outbox", "readonly");
    const req = tx.objectStore("outbox").getAll();
    req.onsuccess = () => resolve((req.result as OutboxOp[]) ?? []);
    req.onerror = () => reject(req.error);
  });
}

export async function removeOutbox(id: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction("outbox", "readwrite");
  tx.objectStore("outbox").delete(id);
  await txDone(tx);
}

export async function clearOutbox(): Promise<void> {
  const db = await openDb();
  const tx = db.transaction("outbox", "readwrite");
  tx.objectStore("outbox").clear();
  await txDone(tx);
}

/** Once-per-local-day reminder latch (device-local, not prefs). */
export async function reminderFiredToday(day: string): Promise<boolean> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("meta", "readonly");
    const req = tx.objectStore("meta").get("reminderFired");
    req.onsuccess = () => {
      const row = req.result as { key: string; day?: string } | undefined;
      resolve(row?.day === day);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function markReminderFired(day: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction("meta", "readwrite");
  tx.objectStore("meta").put({ key: "reminderFired", day });
  await txDone(tx);
}

export function newClientId(): string {
  return crypto.randomUUID();
}
