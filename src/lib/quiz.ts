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

export function storageKey(key: string): string {
  return `dailymark.quiz.${key}`;
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

export function loadProgress(key: string): QuizProgress | null {
  try {
    const raw = localStorage.getItem(storageKey(key));
    if (!raw) return null;
    return normalizeProgress(key, JSON.parse(raw) as Partial<QuizProgress>);
  } catch {
    return null;
  }
}

/** Prefer remote quiz progress when signed in; fall back to localStorage. */
export async function loadProgressSynced(key: string): Promise<QuizProgress | null> {
  const local = loadProgress(key);
  try {
    const { requireSupabase } = await import("./supabase");
    const db = requireSupabase();
    const { data: auth } = await db.auth.getSession();
    if (!auth.session) return local;

    const { data, error } = await db
      .from("quiz_progress")
      .select("*")
      .eq("date_key", key)
      .maybeSingle();
    if (error || !data) return local;

    const remote = normalizeProgress(key, {
      dateKey: data.date_key,
      attempt: data.attempt,
      questionIds: data.question_ids,
      index: data.index,
      score: data.score,
      selected: data.selected,
      phase: data.phase,
    });
    if (!remote) return local;

    // Keep whichever attempt is further along so a mid-quiz device isn't wiped.
    if (
      local &&
      (local.attempt > remote.attempt ||
        (local.attempt === remote.attempt && local.index > remote.index) ||
        (local.attempt === remote.attempt &&
          local.index === remote.index &&
          local.phase === "results" &&
          remote.phase !== "results"))
    ) {
      return local;
    }

    try {
      localStorage.setItem(storageKey(key), JSON.stringify(remote));
    } catch {
      // ignore
    }
    return remote;
  } catch {
    return local;
  }
}

export function saveProgress(progress: QuizProgress): void {
  try {
    localStorage.setItem(storageKey(progress.dateKey), JSON.stringify(progress));
  } catch {
    // private mode / quota — quiz still works for the session
  }

  // Best-effort cloud sync; never block the quiz UI on network.
  void (async () => {
    try {
      const { requireSupabase } = await import("./supabase");
      const db = requireSupabase();
      const { data: auth } = await db.auth.getSession();
      const uid = auth.session?.user.id;
      if (!uid) return;
      await db.from("quiz_progress").upsert({
        user_id: uid,
        date_key: progress.dateKey,
        attempt: progress.attempt,
        question_ids: progress.questionIds,
        index: progress.index,
        score: progress.score,
        selected: progress.selected,
        phase: progress.phase,
      });
    } catch {
      // offline / RLS — local cache still has the progress
    }
  })();
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
