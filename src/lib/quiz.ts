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

/** Visual cue for each category — small and labelled, not decorative clutter. */
export const CATEGORY_META: Record<
  QuizCategory,
  { emoji: string; label: string; tone: string }
> = {
  Medicine: { emoji: "🩺", label: "Medicine", tone: "text-rose-400 bg-rose-500/10" },
  Science: { emoji: "🔬", label: "Science", tone: "text-sky-400 bg-sky-500/10" },
  "Current Affairs": {
    emoji: "📰",
    label: "Current affairs",
    tone: "text-violet-400 bg-violet-500/10",
  },
  "General Knowledge": {
    emoji: "🧠",
    label: "General knowledge",
    tone: "text-amber-400 bg-amber-500/10",
  },
  History: { emoji: "📜", label: "History", tone: "text-orange-400 bg-orange-500/10" },
  Geography: { emoji: "🌍", label: "Geography", tone: "text-emerald-400 bg-emerald-500/10" },
  Technology: { emoji: "💻", label: "Technology", tone: "text-cyan-400 bg-cyan-500/10" },
  Literature: { emoji: "📚", label: "Literature", tone: "text-fuchsia-400 bg-fuchsia-500/10" },
  Philosophy: { emoji: "💭", label: "Philosophy", tone: "text-indigo-400 bg-indigo-500/10" },
  Art: { emoji: "🎨", label: "Art", tone: "text-pink-400 bg-pink-500/10" },
  Math: { emoji: "∑", label: "Math", tone: "text-teal-400 bg-teal-500/10" },
  Culture: { emoji: "🎭", label: "Culture", tone: "text-lime-400 bg-lime-500/10" },
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

export function loadProgress(key: string): QuizProgress | null {
  try {
    const raw = localStorage.getItem(storageKey(key));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<QuizProgress>;
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
  } catch {
    return null;
  }
}

export function saveProgress(progress: QuizProgress): void {
  try {
    localStorage.setItem(storageKey(progress.dateKey), JSON.stringify(progress));
  } catch {
    // private mode / quota — quiz still works for the session
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
