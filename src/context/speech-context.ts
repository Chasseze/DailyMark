import { createContext, useContext } from "react";

export type SpeechStatus = "idle" | "speaking" | "paused";

export interface SpeechPrefs {
  /** null means "whatever voice the platform picks for the text's language". */
  voiceURI: string | null;
  rate: number;
  pitch: number;
}

export interface SpeechRequest {
  /** Stable id for the thing being read, so each button knows if it's playing. */
  id: string;
  /** Shown in the playback bar. */
  label: string;
  text: string;
  /** Strip Markdown syntax before speaking. Defaults to true. */
  markdown?: boolean;
}

export interface SpeechContextType {
  supported: boolean;
  voices: SpeechSynthesisVoice[];
  prefs: SpeechPrefs;
  setVoiceURI: (voiceURI: string | null) => void;
  setRate: (rate: number) => void;
  setPitch: (pitch: number) => void;

  status: SpeechStatus;
  /** Request id currently loaded into the player, playing or paused. */
  activeId: string | null;
  label: string | null;
  chunks: string[];
  chunkIndex: number;
  /** Character range of the word being spoken inside the current chunk. */
  wordRange: [number, number] | null;
  error: string | null;

  speak: (request: SpeechRequest) => void;
  /** Play, pause or resume depending on what this id is already doing. */
  toggle: (request: SpeechRequest) => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  skip: (delta: number) => void;
  dismissError: () => void;
}

// Split from SpeechContext.tsx so that file only exports a component, which is
// what React Fast Refresh needs to hot-reload the provider.
export const SpeechContext = createContext<SpeechContextType | null>(null);

export function useSpeech() {
  const ctx = useContext(SpeechContext);
  if (!ctx) throw new Error("useSpeech must be used within SpeechProvider");
  return ctx;
}
