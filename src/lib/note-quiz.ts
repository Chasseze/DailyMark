/**
 * Quiz questions drawn from your own notes.
 *
 * The bundled bank in quiz-bank.ts tests general knowledge; this tests what you
 * actually wrote down. The signal is emphasis you already added while writing —
 * `**bold**` and `==highlight==` — so nothing has to be tagged specially. A
 * span becomes the blank, the sentence around it becomes the prompt, and the
 * other spans in your library become the wrong answers.
 *
 * No model is involved: this is deterministic text surgery, so the same note
 * produces the same question every time and the whole thing works offline once
 * the pool has been fetched.
 */

import { daySeed, seededShuffle, type QuizQuestion } from "./quiz";

/** A note offered up as raw material. */
export interface NoteQuizSource {
  id: string;
  title: string;
  content: string;
}

export const NOTE_QUIZ_CATEGORY = "From your notes" as const;

/** Wide enough to read as a sentence, short enough to fit a card. */
const MIN_SENTENCE = 25;
const MAX_SENTENCE = 260;
/** A one-character blank is a guess; a whole paragraph is not a question. */
const MIN_TERM = 2;
const MAX_TERM = 48;
const OPTIONS_PER_QUESTION = 4;
/** Below this the wrong answers repeat too obviously to be worth asking. */
export const MIN_NOTE_QUIZ_POOL = OPTIONS_PER_QUESTION;

/** The visible blank in a prompt. */
export const CLOZE_BLANK = "_____";
/** Placeholder held through cleanProse; a space would be lost in the collapse. */
const SENTINEL = "\u0000";

const BOLD = /\*\*([^*\n]{1,80})\*\*/g;
const HIGHLIGHT = /==([^=\n]{1,80})==/g;

/** Strips the inline marks that would leak the answer or clutter the prompt. */
function cleanProse(text: string): string {
  return text
    .replace(/`([^`]*)`/g, "$1")
    .replace(/\*\*([^*]*)\*\*/g, "$1")
    .replace(/==([^=]*)==/g, "$1")
    .replace(/\*([^*]*)\*/g, "$1")
    .replace(/_([^_]*)_/g, "$1")
    .replace(/\[\[([^\]]+)\]\]/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

/** Lines that cannot carry a sensible question, whatever they emphasise. */
function isProseLine(line: string): boolean {
  const t = line.trim();
  if (!t) return false;
  if (t.startsWith("#")) return false;
  if (t.startsWith(">")) return false;
  if (t.startsWith("|")) return false;
  if (t.startsWith("```") || t.startsWith("~~~")) return false;
  return true;
}

export interface ClozeCandidate {
  noteId: string;
  noteTitle: string;
  /** The emphasised span — the right answer. */
  term: string;
  /** The sentence with the term replaced by a blank. */
  prompt: string;
}

/**
 * Pulls every usable blank out of one note. Fenced code is skipped whole, since
 * emphasis inside it is syntax rather than something you meant to remember.
 */
export function extractCloze(source: NoteQuizSource): ClozeCandidate[] {
  const out: ClozeCandidate[] = [];
  const seen = new Set<string>();
  let inFence = false;

  for (const rawLine of source.content.split("\n")) {
    if (/^\s*(```|~~~)/.test(rawLine)) {
      inFence = !inFence;
      continue;
    }
    if (inFence || !isProseLine(rawLine)) continue;

    // Strip list bullets and task boxes so the prompt reads as a sentence.
    const line = rawLine.replace(/^\s*(?:[-*+]|\d+\.)\s+(?:\[[ xX]\]\s+)?/, "").trim();

    for (const pattern of [BOLD, HIGHLIGHT]) {
      for (const match of line.matchAll(pattern)) {
        const term = cleanProse(match[1]);
        if (term.length < MIN_TERM || term.length > MAX_TERM) continue;

        // Blank the exact span that matched, leave the rest of the line intact.
        // A sentinel marks the hole rather than a space: cleanProse collapses
        // whitespace, so a space here would be indistinguishable from the rest.
        const blanked =
          line.slice(0, match.index) + SENTINEL + line.slice(match.index + match[0].length);
        const prompt = cleanProse(blanked).split(SENTINEL).join(CLOZE_BLANK);
        if (!prompt.includes(CLOZE_BLANK)) continue;
        if (prompt.length < MIN_SENTENCE || prompt.length > MAX_SENTENCE) continue;

        const key = `${term.toLowerCase()}::${prompt.toLowerCase()}`;
        if (seen.has(key)) continue;
        seen.add(key);

        out.push({
          noteId: source.id,
          noteTitle: source.title.trim() || "Untitled",
          term,
          prompt,
        });
      }
    }
  }

  return out;
}

/** Every blank across the library, in note order. */
export function collectCloze(sources: readonly NoteQuizSource[]): ClozeCandidate[] {
  return sources.flatMap(extractCloze);
}

/**
 * Turns blanks into multiple-choice questions.
 *
 * Wrong answers are other terms from your own notes, which is what makes this
 * hard in a useful way — the distractors are things you also wrote. They are
 * filtered to terms that are not the answer (case-insensitively), and a blank
 * that cannot find enough distinct company is dropped rather than padded.
 */
export function buildNoteQuestions(
  candidates: readonly ClozeCandidate[],
  day: string,
  attempt = 0,
  count = 10
): QuizQuestion[] {
  if (candidates.length < MIN_NOTE_QUIZ_POOL || count <= 0) return [];

  const seed = daySeed(`notes#${day}#${attempt}`);
  const terms = [...new Set(candidates.map((c) => c.term))];

  // One question per note first, so a single long note cannot own the round.
  const byNote = new Map<string, ClozeCandidate[]>();
  for (const candidate of candidates) {
    const list = byNote.get(candidate.noteId) ?? [];
    list.push(candidate);
    byNote.set(candidate.noteId, list);
  }
  const piles = seededShuffle([...byNote.keys()], seed).map((noteId) =>
    seededShuffle(byNote.get(noteId)!, seed ^ noteId.length * 2654435761)
  );

  const ordered: ClozeCandidate[] = [];
  for (let round = 0; ordered.length < candidates.length; round++) {
    let added = false;
    for (const pile of piles) {
      if (round < pile.length) {
        ordered.push(pile[round]);
        added = true;
      }
    }
    if (!added) break;
  }

  const questions: QuizQuestion[] = [];
  for (const [i, candidate] of ordered.entries()) {
    if (questions.length >= count) break;

    const answerKey = candidate.term.toLowerCase();
    const pool = terms.filter((t) => t.toLowerCase() !== answerKey);
    const distractors = seededShuffle(pool, seed ^ (i + 1) * 0x9e3779b9).slice(
      0,
      OPTIONS_PER_QUESTION - 1
    );
    if (distractors.length < OPTIONS_PER_QUESTION - 1) continue;

    questions.push({
      // Stable across a day so saved progress can be resolved back.
      id: `note:${candidate.noteId}:${i}`,
      text: candidate.prompt,
      category: NOTE_QUIZ_CATEGORY,
      options: seededShuffle([candidate.term, ...distractors], seed ^ (i + 7)),
      answer: candidate.term,
      explain: `From your note “${candidate.noteTitle}”.`,
    });
  }

  return questions;
}

/** Live notes with cloze candidates. Empty when offline or unauthenticated. */
export async function loadNoteQuizPool(limit = 40): Promise<NoteQuizSource[]> {
  try {
    const { requireSupabase } = await import("./supabase");
    const db = requireSupabase();
    const { data: auth } = await db.auth.getSession();
    if (!auth.session) return [];

    const { data, error } = await db.rpc("note_quiz_pool", { p_limit: limit });
    if (error || !data) return [];

    return (data as { id: string; title: string | null; content: string | null }[]).map((row) => ({
      id: row.id,
      title: row.title ?? "",
      content: row.content ?? "",
    }));
  } catch {
    // Offline, or the migration has not been applied — the tab stays disabled.
    return [];
  }
}
