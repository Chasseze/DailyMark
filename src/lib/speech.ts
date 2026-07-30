/**
 * Helpers around the browser's built-in speech synthesis. Nothing here talks to
 * the network: `window.speechSynthesis` uses whatever voices the operating
 * system already has installed.
 */

export const RATE_MIN = 0.6;
export const RATE_MAX = 2;
export const RATE_STEP = 0.1;
export const PITCH_MIN = 0.6;
export const PITCH_MAX = 1.6;

/** Long utterances are unreliable across engines, so sentences are the unit. */
const MAX_CHUNK_LENGTH = 220;

export function isSpeechSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "speechSynthesis" in window &&
    typeof window.SpeechSynthesisUtterance === "function"
  );
}

/**
 * Splits prose into sentence-sized pieces. Chunking buys three things: progress
 * that can be shown and skipped through, resilience against engines that choke
 * on very long strings, and a natural pause between paragraphs.
 */
export function chunkForSpeech(text: string, maxLength = MAX_CHUNK_LENGTH): string[] {
  const chunks: string[] = [];

  for (const block of text.split(/\n+/)) {
    const trimmed = block.trim();
    if (!trimmed) continue;

    const pieces: string[] = [];
    const push = (piece: string) => {
      const last = pieces[pieces.length - 1];
      // Stray fragments ("Mr.", a lone bracket) belong with the sentence before.
      if (last && piece.length < 4) pieces[pieces.length - 1] = `${last} ${piece}`;
      else pieces.push(piece);
    };

    const sentences = trimmed.match(/[^.!?…]+(?:[.!?…]+["'”’)\]]*|$)/g) ?? [trimmed];
    for (const sentence of sentences) {
      let remaining = sentence.trim();
      if (!remaining) continue;

      while (remaining.length > maxLength) {
        let cut = remaining.lastIndexOf(" ", maxLength);
        if (cut < maxLength / 2) cut = maxLength;
        push(remaining.slice(0, cut).trim());
        remaining = remaining.slice(cut).trim();
      }
      if (remaining) push(remaining);
    }

    chunks.push(...pieces);
  }

  return chunks;
}

/** Length of the word starting at `index`, for engines that omit charLength. */
export function wordLengthAt(text: string, index: number): number {
  const match = /^[\p{L}\p{N}'’-]+/u.exec(text.slice(index));
  return match ? match[0].length : 0;
}

/** Compact label for a voice, e.g. "Samantha · en-US". */
export function describeVoice(voice: SpeechSynthesisVoice): string {
  return `${voice.name} · ${voice.lang}`;
}

/**
 * Voices sorted so the ones matching the browser's language come first — the
 * raw list is in whatever order the platform hands it over.
 */
export function sortVoices(voices: SpeechSynthesisVoice[], locale: string): SpeechSynthesisVoice[] {
  const language = locale.slice(0, 2).toLowerCase();

  return [...voices].sort((a, b) => {
    const score = (v: SpeechSynthesisVoice) =>
      (v.lang.toLowerCase().replace("_", "-") === locale.toLowerCase() ? 0 : 2) +
      (v.lang.slice(0, 2).toLowerCase() === language ? 0 : 4);
    const diff = score(a) - score(b);
    return diff !== 0 ? diff : a.name.localeCompare(b.name);
  });
}

export function describeSpeechError(error: string): string {
  switch (error) {
    case "not-allowed":
      return "Your browser blocked speech playback. Press play again to allow it.";
    case "audio-busy":
      return "The audio device is busy. Try again in a moment.";
    case "audio-hardware":
      return "No audio output is available on this device.";
    case "language-unavailable":
    case "voice-unavailable":
      return "That voice isn't available here. Pick another one in Settings.";
    case "synthesis-failed":
    case "synthesis-unavailable":
      return "This browser couldn't start its speech engine.";
    default:
      return "Read aloud stopped unexpectedly.";
  }
}
