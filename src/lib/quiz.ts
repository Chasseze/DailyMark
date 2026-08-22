/**
 * Daily quiz — selection, categories and progress helpers. The question bank
 * lives in quiz-bank.ts; this file only decides which slice of it a given day
 * and attempt get to see.
 */

import { QUIZ_BANK, type QuizCategory, type QuizQuestion } from "./quiz-bank";

export type { QuizCategory, QuizQuestion };
export { QUIZ_BANK };

export const QUESTIONS_PER_DAY = 10;

export type QuizPhase = "ready" | "question" | "feedback" | "results";

export interface QuizProgress {
  dateKey: string;
  /** Bumps on every "Play again" so the same day can draw a fresh set. */
  attempt: number;
  questionIds: string[];
  index: number;
  score: number;
  selected: string | null;
  phase: QuizPhase;
}

/** Visual cue for each category — label + tone only, no emoji clutter. */
export const CATEGORY_META: Record<
  QuizCategory,
  { label: string; tone: string }
> = {
  Medicine: { label: "Medicine", tone: "text-rose-400 bg-rose-500/10" },
  Science: { label: "Science", tone: "text-sky-400 bg-sky-500/10" },
  "Current Affairs": {
    label: "Current affairs",
    tone: "text-violet-400 bg-violet-500/10",
  },
  "General Knowledge": {
    label: "General knowledge",
    tone: "text-amber-400 bg-amber-500/10",
  },
  History: { label: "History", tone: "text-orange-400 bg-orange-500/10" },
  Geography: { label: "Geography", tone: "text-emerald-400 bg-emerald-500/10" },
  Technology: { label: "Technology", tone: "text-cyan-400 bg-cyan-500/10" },
  Literature: { label: "Literature", tone: "text-fuchsia-400 bg-fuchsia-500/10" },
  Philosophy: { label: "Philosophy", tone: "text-indigo-400 bg-indigo-500/10" },
  Art: { label: "Art", tone: "text-pink-400 bg-pink-500/10" },
  Math: { label: "Math", tone: "text-teal-400 bg-teal-500/10" },
  Culture: { label: "Culture", tone: "text-lime-400 bg-lime-500/10" },
  "From your notes": {
    label: "From your notes",
    tone: "text-accent-ink bg-accent-soft",
  },
};

export function dateKey(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

export function daySeed(key: string): number {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return h;
}

/** Deterministic LCG shuffle — same seed always yields the same order. */
export function seededShuffle<T>(items: readonly T[], seed: number): T[] {
  const order = items.slice();
  let s = seed >>> 0;
  for (let i = order.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const j = s % (i + 1);
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

/**
 * Picks a day's questions. The attempt number is folded into the seed so
 * "Play again" draws a different set instead of replaying the same ten.
 * Categories are interleaved so a round isn't three Science questions in a row.
 */
export function pickQuestions(
  day: string,
  attempt = 0,
  count = QUESTIONS_PER_DAY,
  bank: readonly QuizQuestion[] = QUIZ_BANK
): QuizQuestion[] {
  if (count <= 0 || bank.length === 0) return [];

  const seed = daySeed(`${day}#${attempt}`);
  const byCategory = new Map<QuizCategory, QuizQuestion[]>();

  for (const question of bank) {
    const list = byCategory.get(question.category) ?? [];
    list.push(question);
    byCategory.set(question.category, list);
  }

  // Shuffle within each category, then shuffle the category order itself.
  const piles = seededShuffle([...byCategory.keys()], seed).map((category) =>
    seededShuffle(byCategory.get(category)!, seed ^ category.length * 2654435761)
  );

  const picked: QuizQuestion[] = [];
  let round = 0;
  while (picked.length < Math.min(count, bank.length)) {
    let added = false;
    for (const pile of piles) {
      if (picked.length >= count) break;
      if (round < pile.length) {
        picked.push(pile[round]);
        added = true;
      }
    }
    if (!added) break;
    round += 1;
  }

  // One last shuffle so the interleaved order isn't category-A, B, C, A, B, C.
  return seededShuffle(picked, seed ^ 0x9e3779b9);
}

export function resolveQuestions(
  ids: string[],
  bank: readonly QuizQuestion[] = QUIZ_BANK
): QuizQuestion[] | null {
  const byId = new Map(bank.map((q) => [q.id, q]));
  const resolved = ids.map((id) => byId.get(id)).filter((q): q is QuizQuestion => Boolean(q));
  return resolved.length === ids.length && ids.length > 0 ? resolved : null;
}

function normalizeProgress(key: string, parsed: Partial<QuizProgress>): QuizProgress | null {
  if (parsed.dateKey !== key) return null;
  if (!Array.isArray(parsed.questionIds) || parsed.questionIds.length === 0) return null;

  const attempt = Number.isFinite(parsed.attempt) ? Math.max(0, Number(parsed.attempt)) : 0;
  const index = Number.isFinite(parsed.index) ? Math.max(0, Number(parsed.index)) : 0;
  const score = Number.isFinite(parsed.score) ? Math.max(0, Number(parsed.score)) : 0;
  const phase: QuizPhase =
    parsed.phase === "ready" ||
    parsed.phase === "question" ||
    parsed.phase === "feedback" ||
    parsed.phase === "results"
      ? parsed.phase
      : "ready";

  return {
    dateKey: key,
    attempt,
    questionIds: parsed.questionIds.filter((id): id is string => typeof id === "string"),
    index,
    score,
    selected: typeof parsed.selected === "string" ? parsed.selected : null,
    phase,
  };
}

/**
 * Today's round from the account.
 *
 * Three outcomes, deliberately distinct. "empty" is a day with no round yet;
 * "failed" is a read that did not come back. Collapsing them is how a second
 * device replaced a synced round with a blank one: the failure looked like a
 * fresh day, and the first click wrote that blank over the real row.
 */
export type ProgressRead =
  | { status: "ok"; progress: QuizProgress }
  | { status: "empty" }
  | { status: "failed" };

export async function readProgress(key: string): Promise<ProgressRead> {
  try {
    const { requireSupabase } = await import("./supabase");
    const db = requireSupabase();
    const { data: auth } = await db.auth.getSession();
    if (!auth.session) return { status: "empty" };

    const { data, error } = await db
      .from("quiz_progress")
      .select("*")
      .eq("date_key", key)
      .maybeSingle();
    if (error) return { status: "failed" };
    if (!data) return { status: "empty" };

    const progress = normalizeProgress(key, {
      dateKey: data.date_key,
      attempt: data.attempt,
      questionIds: data.question_ids,
      index: data.index,
      score: data.score,
      selected: data.selected,
      phase: data.phase,
    });
    return progress ? { status: "ok", progress } : { status: "empty" };
  } catch {
    return { status: "failed" };
  }
}

/**
 * Writing progress to the account.
 *
 * Every answer, every Next, every replay calls this, and the round only exists
 * in Supabase — there is no device copy to fall back on. So the writes are
 * serialised rather than fired and forgotten: an unordered pair of upserts
 * lands last-response-wins, which is how a finished round could come back as
 * the state from two questions ago.
 *
 * One request is in flight at a time. A save that arrives during one replaces
 * whatever was queued instead of joining a queue — only the newest state is
 * worth sending, and coalescing keeps a fast run of answers to a couple of
 * round trips.
 */

export type ProgressSaveState = "idle" | "saving" | "error";

let pendingSave: QuizProgress | null = null;
let inFlight: Promise<void> | null = null;
let saveState: ProgressSaveState = "idle";
const saveListeners = new Set<(state: ProgressSaveState) => void>();

/**
 * A failed write is retried on a timer, never in a loop. Re-kicking the queue
 * the moment a write fails spins as fast as the network answers — a first cut
 * of this managed several hundred requests a second against a failing endpoint.
 */
const RETRY_MIN_MS = 3000;
const RETRY_MAX_MS = 60_000;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let retryDelay = RETRY_MIN_MS;

function setSaveState(next: ProgressSaveState) {
  if (saveState === next) return;
  saveState = next;
  for (const listener of saveListeners) listener(next);
}

/** Subscribe to the save indicator. Returns an unsubscribe. */
export function onProgressSaveState(
  listener: (state: ProgressSaveState) => void
): () => void {
  saveListeners.add(listener);
  listener(saveState);
  return () => {
    saveListeners.delete(listener);
  };
}

function progressRow(progress: QuizProgress, uid: string) {
  return {
    user_id: uid,
    date_key: progress.dateKey,
    attempt: progress.attempt,
    question_ids: progress.questionIds,
    index: progress.index,
    score: progress.score,
    selected: progress.selected,
    phase: progress.phase,
  };
}

async function writeProgress(progress: QuizProgress): Promise<void> {
  const { requireSupabase } = await import("./supabase");
  const db = requireSupabase();
  const { data: auth } = await db.auth.getSession();
  const uid = auth.session?.user.id;
  if (!uid) return;
  const { error } = await db.from("quiz_progress").upsert(progressRow(progress, uid));
  if (error) throw error;
}

function clearRetry() {
  if (retryTimer === null) return;
  clearTimeout(retryTimer);
  retryTimer = null;
}

function scheduleRetry() {
  if (retryTimer !== null) return;
  const delay = retryDelay;
  retryDelay = Math.min(retryDelay * 2, RETRY_MAX_MS);
  retryTimer = setTimeout(() => {
    retryTimer = null;
    kickSaves();
  }, delay);
}

async function drainSaves(): Promise<void> {
  while (pendingSave) {
    const next = pendingSave;
    pendingSave = null;
    setSaveState("saving");
    try {
      await writeProgress(next);
      retryDelay = RETRY_MIN_MS;
    } catch {
      // Put it back unless something newer replaced it, then wait — the next
      // save or the backoff timer picks it up. Never retry straight away.
      pendingSave = pendingSave ?? next;
      setSaveState("error");
      scheduleRetry();
      return;
    }
  }
  setSaveState("idle");
}

function kickSaves() {
  if (inFlight) return;
  inFlight = drainSaves().finally(() => {
    inFlight = null;
    // Only when the drain ended cleanly: a save that landed in the gap between
    // the loop's last check and this line would otherwise sit unsent. After a
    // failure the timer owns the retry.
    if (pendingSave && saveState !== "error") kickSaves();
  });
}

export function saveProgress(progress: QuizProgress): void {
  pendingSave = { ...progress };
  // The reader just did something, so try now rather than waiting out a backoff.
  clearRetry();
  kickSaves();
}

/** Resolves once nothing is queued. Used by tests and the unload flush. */
export async function progressSettled(): Promise<void> {
  while (inFlight) await inFlight;
}

/**
 * Last-gasp write when the page is going away.
 *
 * A normal request is cancelled when the tab closes, which is how the final
 * answer of a round gets lost. `keepalive` lets this one outlive the document,
 * so it is sent straight to PostgREST rather than through the client.
 */
export async function flushProgressOnUnload(): Promise<void> {
  const queued = pendingSave;
  if (!queued) return;
  try {
    const { requireSupabase, supabaseRest } = await import("./supabase");
    const { data: auth } = await requireSupabase().auth.getSession();
    const token = auth.session?.access_token;
    const uid = auth.session?.user.id;
    if (!token || !uid || !supabaseRest.url) return;
    pendingSave = null;
    await fetch(`${supabaseRest.url}/rest/v1/quiz_progress`, {
      method: "POST",
      keepalive: true,
      headers: {
        apikey: supabaseRest.anonKey,
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify(progressRow(queued, uid)),
    });
  } catch {
    // The tab is closing; there is nowhere left to report this.
  }
}

export function resultMessage(score: number, total: number): string {
  if (total <= 0) return "Come back tomorrow for a new set.";
  if (score === total) return "Perfect — sharp work today.";
  if (score >= Math.ceil(total * 0.8)) return "Excellent. A fresh rotation is ready if you want another go.";
  if (score >= Math.ceil(total * 0.6)) return "Solid round. Play again for a different set, or come back tomorrow.";
  return "Good attempt. Hit Play again for a fresh mix of questions.";
}

/** Score tier used for the results flourish. */
export function resultTier(score: number, total: number): "perfect" | "strong" | "ok" | "try" {
  if (total <= 0 || score === total) return "perfect";
  if (score >= Math.ceil(total * 0.8)) return "strong";
  if (score >= Math.ceil(total * 0.6)) return "ok";
  return "try";
}
