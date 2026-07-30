import { describe, expect, it } from "vitest";
import { chunkForSpeech, sortVoices, wordLengthAt } from "./speech";

describe("chunkForSpeech", () => {
  it("splits on sentence endings", () => {
    expect(chunkForSpeech("First one. Second one! Third one?")).toEqual([
      "First one.",
      "Second one!",
      "Third one?",
    ]);
  });

  it("treats paragraphs as separate chunks", () => {
    expect(chunkForSpeech("Line one\nLine two\n\nLine three")).toEqual([
      "Line one",
      "Line two",
      "Line three",
    ]);
  });

  it("keeps closing quotes with the sentence they end", () => {
    expect(chunkForSpeech('He said "go now." Then he left.')).toEqual([
      'He said "go now."',
      "Then he left.",
    ]);
  });

  it("splits sentences that are longer than an engine will take", () => {
    const long = `${"word ".repeat(60).trim()}.`;
    const chunks = chunkForSpeech(long, 60);
    expect(chunks.length).toBeGreaterThan(1);
    expect(Math.max(...chunks.map((c) => c.length))).toBeLessThanOrEqual(60);
    expect(chunks.join(" ")).toBe(long);
  });

  it("never emits empty or whitespace-only chunks", () => {
    const chunks = chunkForSpeech("\n\n  \n Something. \n\n  \n");
    expect(chunks).toEqual(["Something."]);
  });

  it("returns nothing for empty text", () => {
    expect(chunkForSpeech("   \n  ")).toEqual([]);
  });
});

describe("wordLengthAt", () => {
  it("measures the word at an offset", () => {
    expect(wordLengthAt("hello there", 6)).toBe(5);
  });

  it("is zero when the offset lands on punctuation", () => {
    expect(wordLengthAt("hi, there", 2)).toBe(0);
  });
});

describe("sortVoices", () => {
  const voice = (name: string, lang: string) =>
    ({ name, lang, voiceURI: `${name}:${lang}`, default: false, localService: true }) as SpeechSynthesisVoice;

  it("puts an exact locale match first, then the same language", () => {
    const voices = [voice("Zed", "de-DE"), voice("Amy", "en-GB"), voice("Bob", "en-US")];
    expect(sortVoices(voices, "en-US").map((v) => v.name)).toEqual(["Bob", "Amy", "Zed"]);
  });

  it("sorts alphabetically within the same tier", () => {
    const voices = [voice("Bea", "en-US"), voice("Ann", "en-US")];
    expect(sortVoices(voices, "en-US").map((v) => v.name)).toEqual(["Ann", "Bea"]);
  });
});
