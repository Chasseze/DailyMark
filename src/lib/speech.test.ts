import { describe, expect, it } from "vitest";
import { chunkForSpeech, voiceLanguages, voicesForLanguage, wordLengthAt } from "./speech";

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

const voice = (name: string, lang: string) =>
  ({ name, lang, voiceURI: `${name}:${lang}`, default: false, localService: true }) as SpeechSynthesisVoice;

describe("voiceLanguages", () => {
  it("puts an exact locale match first, then the same language", () => {
    const voices = [voice("Zed", "de-DE"), voice("Amy", "en-GB"), voice("Bob", "en-US")];
    expect(voiceLanguages(voices, "en-US")).toEqual(["en-us", "en-gb", "de-de"]);
  });

  it("lists each language once", () => {
    const voices = [voice("Ann", "en-US"), voice("Bea", "en-US"), voice("Cal", "fr-FR")];
    expect(voiceLanguages(voices, "en-US")).toEqual(["en-us", "fr-fr"]);
  });

  it("accepts underscore-separated tags", () => {
    expect(voiceLanguages([voice("Ann", "en_US")], "en-US")).toEqual(["en-us"]);
  });
});

describe("voicesForLanguage", () => {
  const voices = [voice("Bea", "en-GB"), voice("Ann", "en-US"), voice("Cal", "en_US")];

  it("keeps only the voices of that language, sorted by name", () => {
    expect(voicesForLanguage(voices, "en-US").map((v) => v.name)).toEqual(["Ann", "Cal"]);
  });

  it("is empty for a language nothing speaks", () => {
    expect(voicesForLanguage(voices, "ja-JP")).toEqual([]);
  });
});
