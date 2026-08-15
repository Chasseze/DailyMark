import type { Note } from "./types";
import { addDays, dayKey } from "./rhythm";

/** Three marks is the evening close — not a second inbox. */
export const RETURN_MAX = 3;
/** Due notes take the first seats; an older note fills what is left. */
export const RETURN_DUE_SLOTS = 2;
export const RETURN_LATER_DAYS = 7;

const STORAGE_KEY = "dailymark.return";

export type ReturnReason = "due" | "older";

export interface ReturnItem {
  note: Note;
  reason: ReturnReason;
}

export interface ReturnSession {
  dateKey: string;
  /** Frozen the first time the day has notes, so Keep/Later cannot refill the pile. */
  queuedIds: string[];
  doneIds: string[];
}

export function isDueNote(note: Note, now = new Date()): boolean {
  if (!note.revisit_at) return false;
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  return new Date(note.revisit_at).getTime() <= end.getTime();
}

export function buildReturnQueue(
  notes: readonly Note[],
  doneIds: readonly string[] = [],
  now = new Date()
): ReturnItem[] {
  if (doneIds.length >= RETURN_MAX) return [];

  const done = new Set(doneIds);
  const live = notes.filter((note) => !note.deleted_at && !done.has(note.id));
  const due = live
    .filter((note) => isDueNote(note, now))
    .sort(
      (a, b) =>
        new Date(a.revisit_at!).getTime() - new Date(b.revisit_at!).getTime()
    );
  const duePick = due.slice(0, RETURN_DUE_SLOTS);
  const taken = new Set(duePick.map((note) => note.id));
  const older = live
    .filter((note) => !taken.has(note.id) && !isDueNote(note, now))
    .filter((note) => note.title.trim() || note.preview.trim())
    .sort(
      (a, b) =>
        new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime()
    );
  const olderPick = older.slice(0, RETURN_MAX - duePick.length);

  return [
    ...duePick.map((note) => ({ note, reason: "due" as const })),
    ...olderPick.map((note) => ({ note, reason: "older" as const })),
  ];
}

export function laterRevisitAt(now = new Date(), days = RETURN_LATER_DAYS): string {
  const next = addDays(now, days);
  next.setHours(12, 0, 0, 0);
  return next.toISOString();
}

export function appendReturnLine(
  content: string,
  line: string,
  when = new Date()
): string {
  const bit = line.trim();
  if (!bit) return content;
  const stamp = when.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const block = `> Return · ${stamp}\n> ${bit}`;
  return content.trimEnd() ? `${content.trimEnd()}\n\n${block}\n` : `${block}\n`;
}

export function emptyReturnSession(key: string): ReturnSession {
  return { dateKey: key, queuedIds: [], doneIds: [] };
}

export function loadReturnSession(key: string): ReturnSession {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyReturnSession(key);
    const parsed = JSON.parse(raw) as Partial<ReturnSession>;
    if (parsed.dateKey !== key) return emptyReturnSession(key);
    const queuedIds = Array.isArray(parsed.queuedIds)
      ? parsed.queuedIds.filter((id): id is string => typeof id === "string")
      : [];
    const doneIds = Array.isArray(parsed.doneIds)
      ? parsed.doneIds.filter((id): id is string => typeof id === "string")
      : [];
    return { dateKey: key, queuedIds, doneIds };
  } catch {
    return emptyReturnSession(key);
  }
}

export function saveReturnSession(session: ReturnSession): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

/**
 * Pin today's three ids the first time we can. Later edits must not slide a
 * fourth due note into the evening.
 */
export function ensureReturnQueue(
  session: ReturnSession,
  notes: readonly Note[],
  now = new Date()
): ReturnSession {
  const key = dayKey(now);
  if (session.dateKey !== key) {
    session = emptyReturnSession(key);
  }
  if (session.queuedIds.length > 0 || session.doneIds.length >= RETURN_MAX) {
    return session;
  }
  const queuedIds = buildReturnQueue(notes, session.doneIds, now).map(
    (item) => item.note.id
  );
  if (queuedIds.length === 0) return session;
  return { ...session, queuedIds };
}

export function markReturnDone(session: ReturnSession, id: string): ReturnSession {
  if (session.doneIds.includes(id)) return session;
  return { ...session, doneIds: [...session.doneIds, id] };
}
