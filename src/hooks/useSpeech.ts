import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DEFAULT_SPEECH_PREFS,
  loadSpeechPrefs,
  saveSpeechPrefs,
  type SpeechPrefs,
} from "../lib/speech";

export type SpeechStatus = "idle" | "speaking" | "paused";

interface Speech {
  /** False when the browser has no Web Speech synthesis at all. */
  supported: boolean;
  /** True once the engine reported at least one installed voice. */
  hasVoices: boolean;
  voices: SpeechSynthesisVoice[];
  prefs: SpeechPrefs;
  setPrefs: (patch: Partial<SpeechPrefs>) => void;
  status: SpeechStatus;
  /** Index of the segment currently being spoken. */
  index: number;
  error: string | null;
  speak: (segments: string[]) => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
}

/**
 * Read-aloud on top of `window.speechSynthesis`.
 *
 * Text arrives pre-split into segments and each one becomes its own utterance,
 * which is what makes progress reporting possible and keeps individual
 * utterances short enough that engines don't truncate them.
 */
export function useSpeech(): Speech {
  const supported = useMemo(
    () =>
      typeof window !== "undefined" &&
      "speechSynthesis" in window &&
      "SpeechSynthesisUtterance" in window,
    []
  );

  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [prefs, setPrefsState] = useState<SpeechPrefs>(() =>
    supported ? loadSpeechPrefs() : DEFAULT_SPEECH_PREFS
  );
  const [status, setStatus] = useState<SpeechStatus>("idle");
  const [index, setIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const segmentsRef = useRef<string[]>([]);
  const indexRef = useRef(0);
  const statusRef = useRef<SpeechStatus>("idle");
  const prefsRef = useRef(prefs);
  const voicesRef = useRef(voices);
  /** Bumped on every new playback so stale utterance events are ignored. */
  const runRef = useRef(0);
  /** Chrome drops utterances that aren't referenced while they're queued. */
  const queueRef = useRef<SpeechSynthesisUtterance[]>([]);
  const timerRef = useRef<number | null>(null);

  const updateStatus = useCallback((next: SpeechStatus) => {
    statusRef.current = next;
    setStatus(next);
  }, []);

  useEffect(() => {
    if (!supported) return;
    const synth = window.speechSynthesis;
    let attempts = 0;

    const load = () => {
      const list = synth.getVoices();
      if (list.length) {
        voicesRef.current = list;
        setVoices(list);
        return true;
      }
      return false;
    };

    // Chrome populates voices asynchronously and doesn't always fire the event.
    if (!load()) {
      const poll = window.setInterval(() => {
        attempts += 1;
        if (load() || attempts > 12) window.clearInterval(poll);
      }, 250);
      synth.addEventListener("voiceschanged", load);
      return () => {
        window.clearInterval(poll);
        synth.removeEventListener("voiceschanged", load);
      };
    }

    synth.addEventListener("voiceschanged", load);
    return () => synth.removeEventListener("voiceschanged", load);
  }, [supported]);

  const hardStop = useCallback(() => {
    if (!supported) return;
    const synth = window.speechSynthesis;
    runRef.current += 1;
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    // Cancelling while paused leaves some engines wedged, so lift the pause first.
    if (synth.paused) synth.resume();
    synth.cancel();
    queueRef.current = [];
  }, [supported]);

  const speakFrom = useCallback(
    (from: number) => {
      if (!supported) return;
      const synth = window.speechSynthesis;
      const segments = segmentsRef.current;
      if (from >= segments.length) {
        hardStop();
        updateStatus("idle");
        return;
      }

      hardStop();
      const run = runRef.current;
      setError(null);
      indexRef.current = from;
      setIndex(from);
      updateStatus("speaking");

      const start = () => {
        const { rate, pitch, voiceURI } = prefsRef.current;
        const voice = voiceURI ? voicesRef.current.find((v) => v.voiceURI === voiceURI) : undefined;

        segments.slice(from).forEach((text, offset) => {
          const at = from + offset;
          const utterance = new SpeechSynthesisUtterance(text);
          if (voice) {
            utterance.voice = voice;
            utterance.lang = voice.lang;
          }
          utterance.rate = rate;
          utterance.pitch = pitch;
          utterance.onstart = () => {
            if (run !== runRef.current) return;
            indexRef.current = at;
            setIndex(at);
          };
          utterance.onend = () => {
            if (run !== runRef.current) return;
            if (at === segments.length - 1) {
              updateStatus("idle");
              indexRef.current = 0;
              setIndex(0);
            }
          };
          utterance.onerror = (event) => {
            if (run !== runRef.current) return;
            // "interrupted"/"canceled" just mean we stopped it on purpose.
            if (event.error === "interrupted" || event.error === "canceled") return;
            setError(
              event.error === "not-allowed"
                ? "The browser blocked speech — try pressing play again."
                : `Speech failed (${event.error}).`
            );
            updateStatus("idle");
          };
          queueRef.current.push(utterance);
          synth.speak(utterance);
        });
      };

      // A cancel() immediately followed by speak() is dropped in Chrome; a tick
      // of breathing room makes restarts (and speed changes) reliable.
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        if (run === runRef.current) start();
      }, 60);
    },
    [hardStop, supported, updateStatus]
  );

  const speak = useCallback(
    (segments: string[]) => {
      segmentsRef.current = segments.filter((s) => s.trim());
      speakFrom(0);
    },
    [speakFrom]
  );

  const pause = useCallback(() => {
    if (!supported || statusRef.current !== "speaking") return;
    window.speechSynthesis.pause();
    updateStatus("paused");
  }, [supported, updateStatus]);

  const resume = useCallback(() => {
    if (!supported || statusRef.current !== "paused") return;
    const synth = window.speechSynthesis;
    synth.resume();
    updateStatus("speaking");
    // Some engines forget a paused queue entirely; restart the current segment.
    if (!synth.speaking) speakFrom(indexRef.current);
  }, [speakFrom, supported, updateStatus]);

  const stop = useCallback(() => {
    hardStop();
    indexRef.current = 0;
    setIndex(0);
    updateStatus("idle");
  }, [hardStop, updateStatus]);

  const setPrefs = useCallback(
    (patch: Partial<SpeechPrefs>) => {
      const next = { ...prefsRef.current, ...patch };
      prefsRef.current = next;
      setPrefsState(next);
      saveSpeechPrefs(next);
      // Rate, pitch and voice are fixed per utterance, so apply them by
      // re-speaking from wherever playback currently is.
      if (statusRef.current !== "idle") speakFrom(indexRef.current);
    },
    [speakFrom]
  );

  useEffect(() => () => hardStop(), [hardStop]);

  return {
    supported,
    hasVoices: voices.length > 0,
    voices,
    prefs,
    setPrefs,
    status,
    index,
    error,
    speak,
    pause,
    resume,
    stop,
  };
}
