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

/** Infrequent controls — safe for Layout, buttons, and Settings to subscribe to. */
export interface SpeechControlsType {
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

/** High-frequency playback progress — only the read-aloud bar should subscribe. */
export interface SpeechProgressType {
  chunks: string[];
  chunkIndex: number;
  /** Character range of the word being spoken inside the current chunk. */
  wordRange: [number, number] | null;
}

export type SpeechContextType = SpeechControlsType & SpeechProgressType;

export const SpeechControlsContext = createContext<SpeechControlsType | null>(null);
export const SpeechProgressContext = createContext<SpeechProgressType | null>(null);

/** @deprecated Prefer useSpeechControls / useSpeechProgress to avoid word-boundary churn. */
export function useSpeech(): SpeechContextType {
  const controls = useContext(SpeechControlsContext);
  const progress = useContext(SpeechProgressContext);
  if (!controls || !progress) {
    throw new Error("useSpeech must be used within SpeechProvider");
  }
  return { ...controls, ...progress };
}

export function useSpeechControls() {
  const ctx = useContext(SpeechControlsContext);
  if (!ctx) throw new Error("useSpeechControls must be used within SpeechProvider");
  return ctx;
}

export function useSpeechProgress() {
  const ctx = useContext(SpeechProgressContext);
  if (!ctx) throw new Error("useSpeechProgress must be used within SpeechProvider");
  return ctx;
}
