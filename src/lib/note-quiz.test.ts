import { describe, expect, it } from "vitest";
import {
  CLOZE_BLANK,
  buildNoteQuestions,
  collectCloze,
  extractCloze,
  type ClozeCandidate,
  type NoteQuizSource,
} from "./note-quiz";

function source(content: string, partial: Partial<NoteQuizSource> = {}): NoteQuizSource {
  return { id: "n1", title: "Pharmacology", content, ...partial };
}

describe("extractCloze", () => {
  it("blanks a bold span and keeps the sentence around it", () => {
    const [hit] = extractCloze(
      source("The first-line treatment for anaphylaxis is **adrenaline**, given IM.")
    );
    expect(hit.term).toBe("adrenaline");
    expect(hit.prompt).toBe(`The first-line treatment for anaphylaxis is ${CLOZE_BLANK}, given IM.`);
  });

  it("blanks a highlight span the same way", () => {
    const [hit] = extractCloze(
      source("Insulin is produced by the ==beta cells== of the pancreatic islets.")
    );
    expect(hit.term).toBe("beta cells");
    expect(hit.prompt).toContain(CLOZE_BLANK);
    expect(hit.prompt).not.toContain("beta cells");
  });

  it("blanks only the matched span when a line emphasises several things", () => {
    const hits = extractCloze(
      source("The **pancreas** releases insulin and the **liver** stores glycogen away.")
    );
    expect(hits.map((h) => h.term)).toEqual(["pancreas", "liver"]);
    // Each prompt hides its own answer and keeps the other term visible.
    expect(hits[0].prompt).toContain("liver");
    expect(hits[0].prompt).not.toContain("pancreas");
    expect(hits[1].prompt).toContain("pancreas");
    expect(hits[1].prompt).not.toContain("liver");
  });

  it("never leaks the answer back into the prompt", () => {
    for (const hit of extractCloze(source("Give **adrenaline** for anaphylaxis without delay."))) {
      expect(hit.prompt.toLowerCase()).not.toContain(hit.term.toLowerCase());
    }
  });

  it("skips emphasis inside fenced code, which is syntax not knowledge", () => {
    const hits = extractCloze(
      source(
        [
          "Real prose with a **memorable term** in it for the quiz.",
          "```js",
          "const x = **notAterm** + 1; // long enough to pass the length gate",
          "```",
        ].join("\n")
      )
    );
    expect(hits.map((h) => h.term)).toEqual(["memorable term"]);
  });

  it("ignores headings, quotes and table rows", () => {
    const hits = extractCloze(
      source(
        [
          "# A heading with a **bold word** that should not be asked about",
          "> A quotation carrying a **quoted term** inside of it here",
          "| a | **cell term** that is inside a table row of some length |",
        ].join("\n")
      )
    );
    expect(hits).toEqual([]);
  });

  it("strips list bullets so the prompt reads as a sentence", () => {
    const [hit] = extractCloze(
      source("- The resting membrane potential sits near **-70 mV** in most neurons.")
    );
    expect(hit.prompt.startsWith("The resting")).toBe(true);
  });

  it("drops spans too short or too long to make a fair question", () => {
    const hits = extractCloze(
      source(
        [
          "A sentence with a single letter **x** emphasised inside of it here.",
          `A sentence with an absurdly long span **${"word ".repeat(20)}** inside it.`,
        ].join("\n")
      )
    );
    expect(hits).toEqual([]);
  });

  it("drops sentences too short to stand as a prompt", () => {
    expect(extractCloze(source("Use **adrenaline**."))).toEqual([]);
  });

  it("does not repeat an identical blank twice", () => {
    const hits = extractCloze(
      source(
        [
          "The pancreas releases **insulin** to lower blood glucose levels.",
          "The pancreas releases **insulin** to lower blood glucose levels.",
        ].join("\n")
      )
    );
    expect(hits).toHaveLength(1);
  });

  it("titles an untitled note rather than showing an empty attribution", () => {
    const [hit] = extractCloze(
      source("A sentence with a **memorable term** for the quiz here.", { title: "  " })
    );
    expect(hit.noteTitle).toBe("Untitled");
  });
});

describe("buildNoteQuestions", () => {
  function candidates(n: number, noteId = "n1"): ClozeCandidate[] {
    return Array.from({ length: n }, (_, i) => ({
      noteId,
      noteTitle: "Notebook",
      term: `term-${i}`,
      prompt: `A sentence about ${CLOZE_BLANK} number ${i} for the quiz.`,
    }));
  }

  it("always includes the right answer among the options", () => {
    for (const q of buildNoteQuestions(candidates(8), "2026-07-10")) {
      expect(q.options).toContain(q.answer);
    }
  });

  it("offers four distinct options", () => {
    for (const q of buildNoteQuestions(candidates(8), "2026-07-10")) {
      expect(q.options).toHaveLength(4);
      expect(new Set(q.options).size).toBe(4);
    }
  });

  it("draws the wrong answers from the reader's own terms", () => {
    const pool = candidates(8);
    const known = new Set(pool.map((c) => c.term));
    for (const q of buildNoteQuestions(pool, "2026-07-10")) {
      for (const option of q.options) expect(known.has(option)).toBe(true);
    }
  });

  it("returns nothing when the pool is too small to make distractors", () => {
    expect(buildNoteQuestions(candidates(3), "2026-07-10")).toEqual([]);
  });

  it("is deterministic for a given day and attempt", () => {
    const pool = candidates(8);
    const a = buildNoteQuestions(pool, "2026-07-10");
    const b = buildNoteQuestions(pool, "2026-07-10");
    expect(a).toEqual(b);
  });

  it("draws a different set on a replay", () => {
    const pool = candidates(12);
    const first = buildNoteQuestions(pool, "2026-07-10", 0, 4).map((q) => q.text);
    const again = buildNoteQuestions(pool, "2026-07-10", 1, 4).map((q) => q.text);
    expect(again).not.toEqual(first);
  });

  it("spreads across notes so one long note cannot own the round", () => {
    const pool = [
      ...candidates(6, "long-note"),
      ...candidates(1, "short-note").map((c) => ({ ...c, term: "solo-term" })),
    ];
    const noteIds = new Set(buildNoteQuestions(pool, "2026-07-10", 0, 2).map((q) => q.id.split(":")[1]));
    expect(noteIds.has("short-note")).toBe(true);
  });

  it("honours the requested count", () => {
    expect(buildNoteQuestions(candidates(20), "2026-07-10", 0, 5)).toHaveLength(5);
  });

  it("credits the note each question came from", () => {
    const [q] = buildNoteQuestions(candidates(8), "2026-07-10");
    expect(q.explain).toContain("Notebook");
  });
});

describe("collectCloze", () => {
  it("gathers blanks across every note", () => {
    const found = collectCloze([
      source("The pancreas makes **insulin** to lower blood glucose levels.", { id: "a" }),
      source("The thyroid makes **thyroxine** to set the metabolic rate.", { id: "b" }),
    ]);
    expect(found.map((c) => c.term)).toEqual(["insulin", "thyroxine"]);
    expect(found.map((c) => c.noteId)).toEqual(["a", "b"]);
  });
});
