import { describe, expect, it } from "vitest";
import {
  clampPitch,
  clampRate,
  estimateSpeechSeconds,
  formatDuration,
  markdownToSpeech,
} from "./speech";

function spoken(source: string, title?: string) {
  return markdownToSpeech(source, { title }).map((s) => s.text);
}

describe("markdownToSpeech", () => {
  it("reads the title first", () => {
    expect(spoken("Body text.", "Trip notes")[0]).toBe("Trip notes.");
  });

  it("reads headings without their hashes", () => {
    expect(spoken("## Packing list")).toEqual(["Packing list."]);
  });

  it("drops emphasis markers but keeps the words", () => {
    expect(spoken("Left **early** and drove ~~slowly~~ *west*.")).toEqual([
      "Left early and drove slowly west.",
    ]);
  });

  it("reads a link by its label, never its url", () => {
    expect(spoken("Check the [route map](https://maps.example.com/a/b).")).toEqual([
      "Check the route map.",
    ]);
  });

  it("announces task state", () => {
    expect(spoken("- [x] tickets\n- [ ] passport")).toEqual(["Done: tickets.", "To do: passport."]);
  });

  it("keeps list items as separate segments", () => {
    expect(spoken("- milk\n- eggs\n1. first")).toEqual(["milk.", "eggs.", "first."]);
  });

  it("joins wrapped paragraph lines into one segment and splits on blank lines", () => {
    expect(spoken("one line\nsame paragraph\n\nsecond paragraph")).toEqual([
      "one line same paragraph.",
      "second paragraph.",
    ]);
  });

  it("announces a code block once instead of reading it", () => {
    expect(spoken("Before.\n\n```js\nconst a = 1;\n```\n\nAfter.")).toEqual([
      "Before.",
      "Code block skipped.",
      "After.",
    ]);
  });

  it("reads table rows as cells and skips the delimiter row", () => {
    expect(spoken("| leg | hours |\n| --- | --- |\n| north | 3 |")).toEqual([
      "leg, hours.",
      "north, 3.",
    ]);
  });

  it("skips dividers and blank lines", () => {
    expect(spoken("Above.\n\n---\n\nBelow.")).toEqual(["Above.", "Below."]);
  });

  it("splits long prose into sentence-sized segments", () => {
    const sentence = "Sentence number " + "x".repeat(60) + ".";
    const segments = markdownToSpeech([sentence, sentence, sentence].join(" "));
    expect(segments.length).toBeGreaterThan(1);
    for (const segment of segments) expect(segment.text.length).toBeLessThanOrEqual(220);
  });

  it("splits a single run-on sentence at word boundaries", () => {
    const segments = markdownToSpeech(Array.from({ length: 80 }, () => "word").join(" "));
    expect(segments.length).toBeGreaterThan(1);
    for (const segment of segments) {
      expect(segment.text.length).toBeLessThanOrEqual(220);
      expect(segment.text).not.toMatch(/wor$/);
    }
  });

  it("labels segments by the block they came from", () => {
    const kinds = markdownToSpeech("# Title\n\ntext\n\n> quoted\n\n- item", { title: "T" }).map(
      (s) => s.kind
    );
    expect(kinds).toEqual(["title", "heading", "paragraph", "quote", "list"]);
  });

  it("returns nothing for an empty note", () => {
    expect(markdownToSpeech("   \n\n")).toEqual([]);
  });
});

describe("prefs and estimates", () => {
  it("clamps rate and pitch into what engines accept", () => {
    expect(clampRate(9)).toBe(2);
    expect(clampRate(0)).toBe(0.5);
    expect(clampRate("fast")).toBe(1);
    expect(clampPitch(9)).toBe(1.5);
  });

  it("shortens the estimate as the rate goes up", () => {
    const segments = markdownToSpeech(Array.from({ length: 200 }, () => "word").join(" "));
    const slow = estimateSpeechSeconds(segments, 1);
    const fast = estimateSpeechSeconds(segments, 2);
    expect(slow).toBeGreaterThan(fast);
    expect(formatDuration(slow)).toMatch(/min|sec/);
  });

  it("formats durations for the player", () => {
    expect(formatDuration(0)).toBe("0 sec");
    expect(formatDuration(45)).toBe("45 sec");
    expect(formatDuration(130)).toBe("2 min");
  });
});
