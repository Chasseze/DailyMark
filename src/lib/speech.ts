/**
 * Preparing a note for the browser's speech synthesizer.
 *
 * Feeding raw markdown to `speechSynthesis` makes it read punctuation as noise
 * ("hash hash Groceries", "star star important star star"), so the note is first
 * rewritten into short spoken segments: markers dropped, links read by their
 * label, tasks announced as done or to do, code blocks skipped.
 *
 * Segments are also kept short on purpose. Long utterances are unreliable across
 * engines, and one utterance per sentence is what lets the UI show progress and
 * the line currently being spoken.
 */

import { tokenizeMarkdown, tokensToCells, tokensToText } from "./markdown";

export type SegmentKind = "title" | "heading" | "paragraph" | "list" | "quote" | "code" | "table";

export interface SpeechSegment {
  text: string;
  kind: SegmentKind;
}

export interface SpeechPrefs {
  /** `SpeechSynthesisVoice.voiceURI`, or null for the browser default. */
  voiceURI: string | null;
  rate: number;
  pitch: number;
}

export const DEFAULT_SPEECH_PREFS: SpeechPrefs = { voiceURI: null, rate: 1, pitch: 1 };

const PREFS_KEY = "dailymark.speech";
const MAX_SEGMENT_CHARS = 220;
/** Words per minute a synthesizer covers at rate 1 — close enough for an ETA. */
const WORDS_PER_MINUTE = 165;

export function loadSpeechPrefs(): SpeechPrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return DEFAULT_SPEECH_PREFS;
    const parsed = JSON.parse(raw) as Partial<SpeechPrefs>;
    return {
      voiceURI: typeof parsed.voiceURI === "string" ? parsed.voiceURI : null,
      rate: clampRate(parsed.rate),
      pitch: clampPitch(parsed.pitch),
    };
  } catch {
    return DEFAULT_SPEECH_PREFS;
  }
}

export function saveSpeechPrefs(prefs: SpeechPrefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // private mode / quota — the choice just won't survive a reload
  }
}

export function clampRate(rate: unknown): number {
  const n = typeof rate === "number" && Number.isFinite(rate) ? rate : 1;
  return Math.min(2, Math.max(0.5, n));
}

export function clampPitch(pitch: unknown): number {
  const n = typeof pitch === "number" && Number.isFinite(pitch) ? pitch : 1;
  return Math.min(1.5, Math.max(0.5, n));
}

function tidy(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

/** Gives the synthesizer something to pause on between segments. */
function ensureStop(text: string) {
  return /[.!?:;,…"')\]]$/.test(text) ? text : text + ".";
}

function pushChunks(into: SpeechSegment[], text: string, kind: SegmentKind) {
  const clean = ensureStop(tidy(text));
  if (!clean) return;
  if (clean.length <= MAX_SEGMENT_CHARS) {
    into.push({ text: clean, kind });
    return;
  }

  const sentences = clean.split(/(?<=[.!?…])\s+/);
  let buffer = "";
  const flush = () => {
    if (buffer) {
      into.push({ text: buffer, kind });
      buffer = "";
    }
  };

  for (const sentence of sentences) {
    if (sentence.length > MAX_SEGMENT_CHARS) {
      flush();
      let rest = sentence;
      while (rest.length > MAX_SEGMENT_CHARS) {
        const cut = rest.lastIndexOf(" ", MAX_SEGMENT_CHARS);
        const at = cut > MAX_SEGMENT_CHARS / 2 ? cut : MAX_SEGMENT_CHARS;
        into.push({ text: rest.slice(0, at).trim(), kind });
        rest = rest.slice(at).trim();
      }
      buffer = rest;
      continue;
    }
    if (!buffer) buffer = sentence;
    else if (buffer.length + 1 + sentence.length <= MAX_SEGMENT_CHARS) buffer += " " + sentence;
    else {
      flush();
      buffer = sentence;
    }
  }
  flush();
}

export function markdownToSpeech(source: string, options: { title?: string } = {}): SpeechSegment[] {
  const segments: SpeechSegment[] = [];
  const title = tidy(options.title ?? "");
  if (title) segments.push({ text: ensureStop(title), kind: "title" });

  let paragraph: string[] = [];
  const flushParagraph = () => {
    if (paragraph.length) {
      pushChunks(segments, paragraph.join(" "), "paragraph");
      paragraph = [];
    }
  };

  let inFence = false;
  for (const line of tokenizeMarkdown(source)) {
    const text = tidy(tokensToText(line.tokens));

    switch (line.block) {
      case "fence":
        flushParagraph();
        // Announce the block once, on the way in, then stay quiet through it.
        if (!inFence) segments.push({ text: "Code block skipped.", kind: "code" });
        inFence = !inFence;
        break;
      case "code":
        break;
      case "blank":
      case "rule":
        flushParagraph();
        break;
      case "heading":
        flushParagraph();
        pushChunks(segments, text, "heading");
        break;
      case "bullet":
      case "ordered":
        flushParagraph();
        pushChunks(segments, text, "list");
        break;
      case "task":
        flushParagraph();
        pushChunks(segments, `${line.flag ? "Done" : "To do"}: ${text}`, "list");
        break;
      case "quote":
        flushParagraph();
        pushChunks(segments, text, "quote");
        break;
      case "table":
        flushParagraph();
        if (!line.flag) pushChunks(segments, tokensToCells(line.tokens).join(", "), "table");
        break;
      default:
        paragraph.push(text);
    }
  }
  flushParagraph();

  return segments;
}

/** Rough spoken length, used for the "about 2 min" hint on the player. */
export function estimateSpeechSeconds(segments: SpeechSegment[], rate: number): number {
  const words = segments.reduce((sum, s) => sum + (s.text.trim() ? s.text.trim().split(/\s+/).length : 0), 0);
  if (!words) return 0;
  return Math.round((words / (WORDS_PER_MINUTE * clampRate(rate))) * 60);
}

export function formatDuration(seconds: number): string {
  if (seconds <= 0) return "0 sec";
  if (seconds < 60) return `${seconds} sec`;
  const minutes = Math.round(seconds / 60);
  return `${minutes} min`;
}
