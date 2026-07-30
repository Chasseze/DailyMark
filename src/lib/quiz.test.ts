import { describe, expect, it } from "vitest";
import {
  QUESTIONS_PER_DAY,
  daySeed,
  pickQuestions,
  resolveQuestions,
  resultMessage,
  resultTier,
  seededShuffle,
} from "./quiz";
import { QUIZ_BANK, type QuizCategory } from "./quiz-bank";

describe("QUIZ_BANK", () => {
  it("is large enough for several distinct 10-question rounds", () => {
    expect(QUIZ_BANK.length).toBeGreaterThanOrEqual(QUESTIONS_PER_DAY * 3);
  });

  it("covers the expanded categories", () => {
    const categories = new Set(QUIZ_BANK.map((q) => q.category));
    for (const needed of [
      "Medicine",
      "Science",
      "Current Affairs",
      "General Knowledge",
    ] as QuizCategory[]) {
      expect(categories.has(needed)).toBe(true);
    }
  });

  it("keeps every answer among the options", () => {
    for (const question of QUIZ_BANK) {
      expect(question.options).toContain(question.answer);
      expect(question.options).toHaveLength(4);
    }
  });

  it("uses unique ids", () => {
    const ids = QUIZ_BANK.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("seededShuffle", () => {
  it("is deterministic for the same seed", () => {
    const a = seededShuffle([1, 2, 3, 4, 5], 42);
    const b = seededShuffle([1, 2, 3, 4, 5], 42);
    expect(a).toEqual(b);
  });

  it("changes order when the seed changes", () => {
    const a = seededShuffle([1, 2, 3, 4, 5, 6, 7, 8], 1);
    const b = seededShuffle([1, 2, 3, 4, 5, 6, 7, 8], 2);
    expect(a).not.toEqual(b);
  });

  it("preserves every item", () => {
    const input = ["a", "b", "c", "d"];
    expect(seededShuffle(input, 99).sort()).toEqual(input);
  });
});

describe("pickQuestions", () => {
  it(`returns ${QUESTIONS_PER_DAY} questions`, () => {
    expect(pickQuestions("2026-07-30", 0)).toHaveLength(QUESTIONS_PER_DAY);
  });

  it("is stable for the same day and attempt", () => {
    const a = pickQuestions("2026-07-30", 0).map((q) => q.id);
    const b = pickQuestions("2026-07-30", 0).map((q) => q.id);
    expect(a).toEqual(b);
  });

  it("rotates when the attempt bumps — Play again gets a fresh set", () => {
    const first = pickQuestions("2026-07-30", 0).map((q) => q.id);
    const second = pickQuestions("2026-07-30", 1).map((q) => q.id);
    expect(first).not.toEqual(second);

    const overlap = first.filter((id) => second.includes(id)).length;
    // With a bank this size, a retake should swap in several new questions.
    expect(overlap).toBeLessThan(QUESTIONS_PER_DAY);
  });

  it("changes across calendar days", () => {
    const a = pickQuestions("2026-07-30", 0).map((q) => q.id);
    const b = pickQuestions("2026-07-31", 0).map((q) => q.id);
    expect(a).not.toEqual(b);
  });

  it("spreads categories across a round", () => {
    const categories = new Set(pickQuestions("2026-07-30", 0).map((q) => q.category));
    expect(categories.size).toBeGreaterThanOrEqual(4);
  });

  it("never repeats a question inside one round", () => {
    const ids = pickQuestions("2026-01-15", 3).map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("resolveQuestions", () => {
  it("returns the questions in the stored order", () => {
    const picked = pickQuestions("2026-07-30", 2);
    const resolved = resolveQuestions(picked.map((q) => q.id));
    expect(resolved?.map((q) => q.id)).toEqual(picked.map((q) => q.id));
  });

  it("returns null when an id is missing from the bank", () => {
    expect(resolveQuestions(["nope"])).toBeNull();
  });
});

describe("result copy", () => {
  it("celebrates a perfect score", () => {
    expect(resultTier(10, 10)).toBe("perfect");
    expect(resultMessage(10, 10)).toMatch(/Perfect/);
  });

  it("points retakers at a fresh rotation", () => {
    expect(resultMessage(6, 10)).toMatch(/Play again|fresh/i);
  });
});

describe("daySeed", () => {
  it("hashes the same string to the same number", () => {
    expect(daySeed("2026-07-30")).toBe(daySeed("2026-07-30"));
  });
});
