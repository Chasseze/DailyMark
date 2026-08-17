import type { Note } from "./types";
import { addDays, dayKey } from "./rhythm";

/** Three marks is the evening close — not a second inbox. */
export const RETURN_MAX = 3;
/** Due notes take the first seats; an older note fills what is left. */
export const RETURN_DUE_SLOTS = 2;
export const RETURN_LATER_DAYS = 7;

export type ReturnReason = "due" | "older";

export interface ReturnItem {
  note: Note;
  reason: ReturnReason;
}

export interface ReturnSession {
  dateKey: string;
  /** Frozen the first time the day has notes, so Keep/Later cannot refill the pile. */
  queuedIds: string[];
  /** Parallel to queuedIds when frozen — why each seat was chosen. */
  reasons: ReturnReason[];
  doneIds: string[];
}

export interface ReturnHistoryRow {
  dateKey: string;
  queuedIds: string[];
  reasons: ReturnReason[];
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
  return { dateKey: key, queuedIds: [], reasons: [], doneIds: [] };
}

function asReason(value: unknown): ReturnReason | null {
  return value === "due" || value === "older" ? value : null;
}

function normalizeSession(
  key: string,
  parsed:
    | {
        dateKey?: string;
        queuedIds?: unknown;
        doneIds?: unknown;
        reasons?: unknown;
      }
    | null
    | undefined
): ReturnSession {
  if (!parsed || parsed.dateKey !== key) return emptyReturnSession(key);
  const queuedIds = Array.isArray(parsed.queuedIds)
    ? parsed.queuedIds.filter((id): id is string => typeof id === "string")
    : [];
  const doneIds = Array.isArray(parsed.doneIds)
    ? parsed.doneIds.filter((id): id is string => typeof id === "string")
    : [];
  const reasons = Array.isArray(parsed.reasons)
    ? parsed.reasons.map(asReason).filter((r): r is ReturnReason => Boolean(r))
    : [];
  return {
    dateKey: key,
    queuedIds,
    reasons: reasons.length === queuedIds.length ? reasons : [],
    doneIds,
  };
}

function sameIdList(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((id, i) => id === b[i]);
}

/**
 * Combine in-memory progress with the cloud row for the same day.
 * Frozen queues win; if two browsers froze different piles, the one with
 * more Keep/Later marks is kept. Done ids are unioned onto that pile.
 */
export function mergeReturnSessions(local: ReturnSession, remote: ReturnSession): ReturnSession {
  if (remote.dateKey !== local.dateKey) return local;

  let queuedIds: string[];
  let reasons: ReturnReason[];
  if (local.queuedIds.length && remote.queuedIds.length) {
    if (sameIdList(local.queuedIds, remote.queuedIds)) {
      queuedIds = remote.queuedIds;
      reasons = remote.reasons.length ? remote.reasons : local.reasons;
    } else if (local.doneIds.length > remote.doneIds.length) {
      queuedIds = local.queuedIds;
      reasons = local.reasons;
    } else {
      queuedIds = remote.queuedIds;
      reasons = remote.reasons;
    }
  } else if (remote.queuedIds.length) {
    queuedIds = remote.queuedIds;
    reasons = remote.reasons;
  } else {
    queuedIds = local.queuedIds;
    reasons = local.reasons;
  }

  const allowed = new Set(queuedIds);
  const doneIds: string[] = [];
  for (const id of [...local.doneIds, ...remote.doneIds]) {
    if (doneIds.includes(id)) continue;
    if (allowed.size === 0 || allowed.has(id)) doneIds.push(id);
  }
  return { dateKey: local.dateKey, queuedIds, reasons, doneIds };
}

async function persistRemote(session: ReturnSession): Promise<void> {
  try {
    const { requireSupabase } = await import("./supabase");
    const db = requireSupabase();
    const { data: auth } = await db.auth.getSession();
    const uid = auth.session?.user.id;
    if (!uid) return;
    await db.from("return_sessions").upsert({
      user_id: uid,
      date_key: session.dateKey,
      queued_ids: session.queuedIds,
      done_ids: session.doneIds,
      reasons: session.reasons,
    });
  } catch {
    // offline / missing column — in-memory session still works
  }
}

/** Load today's Return session from the account. */
export async function loadReturnSessionSynced(key: string): Promise<ReturnSession> {
  try {
    const { requireSupabase } = await import("./supabase");
    const db = requireSupabase();
    const { data: auth } = await db.auth.getSession();
    if (!auth.session) return emptyReturnSession(key);

    const { data, error } = await db
      .from("return_sessions")
      .select("date_key, queued_ids, done_ids, reasons")
      .eq("date_key", key)
      .maybeSingle();
    if (error || !data) return emptyReturnSession(key);

    return normalizeSession(key, {
      dateKey: data.date_key,
      queuedIds: data.queued_ids,
      doneIds: data.done_ids,
      reasons: data.reasons,
    });
  } catch {
    return emptyReturnSession(key);
  }
}

export function saveReturnSession(session: ReturnSession): void {
  void persistRemote(session);
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
  const built = buildReturnQueue(notes, session.doneIds, now);
  const queuedIds = built.map((item) => item.note.id);
  if (queuedIds.length === 0) return session;
  return {
    ...session,
    queuedIds,
    reasons: built.map((item) => item.reason),
  };
}

export function markReturnDone(session: ReturnSession, id: string): ReturnSession {
  if (session.doneIds.includes(id)) return session;
  return { ...session, doneIds: [...session.doneIds, id] };
}

export function reasonForQueued(
  session: ReturnSession,
  noteId: string,
  note: Note,
  now = new Date()
): ReturnReason {
  const idx = session.queuedIds.indexOf(noteId);
  if (idx >= 0 && session.reasons[idx]) return session.reasons[idx];
  return isDueNote(note, now) ? "due" : "older";
}

/** Past Return evenings for Rhythm / weekly review. */
export async function listReturnSessions(
  sinceKey: string,
  untilKey: string
): Promise<ReturnHistoryRow[]> {
  try {
    const { requireSupabase } = await import("./supabase");
    const db = requireSupabase();
    const { data: auth } = await db.auth.getSession();
    if (!auth.session) return [];
    const { data, error } = await db
      .from("return_sessions")
      .select("date_key, queued_ids, done_ids, reasons")
      .gte("date_key", sinceKey)
      .lte("date_key", untilKey)
      .order("date_key", { ascending: false });
    if (error || !data) return [];
    return data.map((row) => {
      const queuedIds = row.queued_ids ?? [];
      const reasons = (row.reasons ?? [])
        .map(asReason)
        .filter((r): r is ReturnReason => Boolean(r));
      return {
        dateKey: row.date_key,
        queuedIds,
        doneIds: row.done_ids ?? [],
        reasons: reasons.length === queuedIds.length ? reasons : [],
      };
    });
  } catch {
    return [];
  }
}
