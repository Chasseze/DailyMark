import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  PITCH_MAX,
  PITCH_MIN,
  RATE_MAX,
  RATE_MIN,
  chunkForSpeech,
  describeSpeechError,
  isSpeechSupported,
  wordLengthAt,
} from "../lib/speech";
import { markdownToPlainText } from "../lib/markdown";
import {
  SpeechContext,
  type SpeechPrefs,
  type SpeechRequest,
  type SpeechStatus,
} from "./speech-context";

const STORAGE_KEY = "dailymark.speech";
const DEFAULT_PREFS: SpeechPrefs = { voiceURI: null, rate: 1, pitch: 1 };

/** How often the run is checked against the engine's own idea of what it's doing. */
const MONITOR_INTERVAL_MS = 400;
/** An engine that is still silent this long after being asked never started. */
const START_TIMEOUT_MS = 4000;
/** Consecutive silent checks that mean a started run has finished. */
const QUIET_CHECKS_TO_FINISH = 3;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function loadPrefs(): SpeechPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFS;
    const parsed = JSON.parse(raw) as Partial<SpeechPrefs>;
    return {
      voiceURI: typeof parsed.voiceURI === "string" ? parsed.voiceURI : null,
      rate: clamp(Number(parsed.rate) || 1, RATE_MIN, RATE_MAX),
      pitch: clamp(Number(parsed.pitch) || 1, PITCH_MIN, PITCH_MAX),
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function SpeechProvider({ children }: { children: ReactNode }) {
  const supported = useMemo(() => isSpeechSupported(), []);

  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [prefs, setPrefs] = useState<SpeechPrefs>(loadPrefs);
  const [status, setStatus] = useState<SpeechStatus>("idle");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [label, setLabel] = useState<string | null>(null);
  const [chunks, setChunks] = useState<string[]>([]);
  const [chunkIndex, setChunkIndex] = useState(0);
  const [wordRange, setWordRange] = useState<[number, number] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // A run id invalidates callbacks from utterances we've already walked away
  // from — cancel() fires their handlers a tick later.
  const runRef = useRef(0);
  const chunksRef = useRef<string[]>([]);
  const indexRef = useRef(0);
  // Utterances have to stay reachable: several engines drop the callbacks of a
  // garbage-collected utterance mid-sentence.
  const queueRef = useRef<SpeechSynthesisUtterance[]>([]);
  const startTimerRef = useRef<number | null>(null);
  const monitorRef = useRef<number | null>(null);
  const startedRef = useRef(false);
  const prefsRef = useRef(prefs);
  const voicesRef = useRef(voices);
  const statusRef = useRef(status);

  useEffect(() => {
    prefsRef.current = prefs;
  }, [prefs]);
  useEffect(() => {
    voicesRef.current = voices;
  }, [voices]);
  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    if (!supported) return;
    const synth = window.speechSynthesis;
    const load = () => {
      const list = synth.getVoices();
      if (list.length) setVoices(list);
    };
    load();
    synth.addEventListener("voiceschanged", load);
    // Chrome fills the list asynchronously; a few engines never fire the event.
    const retries = [250, 1000, 2500].map((ms) => window.setTimeout(load, ms));
    return () => {
      synth.removeEventListener("voiceschanged", load);
      retries.forEach((id) => clearTimeout(id));
    };
  }, [supported]);

  const clearTimers = useCallback(() => {
    if (startTimerRef.current !== null) clearTimeout(startTimerRef.current);
    if (monitorRef.current !== null) clearInterval(monitorRef.current);
    startTimerRef.current = null;
    monitorRef.current = null;
  }, []);

  const resetPlayer = useCallback(() => {
    runRef.current += 1;
    clearTimers();
    queueRef.current = [];
    chunksRef.current = [];
    indexRef.current = 0;
    startedRef.current = false;
    setStatus("idle");
    setActiveId(null);
    setLabel(null);
    setChunks([]);
    setChunkIndex(0);
    setWordRange(null);
  }, [clearTimers]);

  const stop = useCallback(() => {
    if (supported) window.speechSynthesis.cancel();
    resetPlayer();
  }, [supported, resetPlayer]);

  /** Queues every remaining chunk from `from` and reports progress as it goes. */
  const startRun = useCallback(
    (from: number) => {
      const list = chunksRef.current;
      if (!list.length) return;

      const synth = window.speechSynthesis;
      const startAt = clamp(from, 0, list.length - 1);
      const run = ++runRef.current;

      clearTimers();
      synth.cancel();
      startedRef.current = false;
      indexRef.current = startAt;
      setChunkIndex(startAt);
      setWordRange(null);
      setStatus("speaking");

      // Chrome can swallow an utterance queued in the same tick as cancel().
      startTimerRef.current = window.setTimeout(() => {
        if (run !== runRef.current) return;

        const { voiceURI, rate, pitch } = prefsRef.current;
        const voice = voiceURI ? voicesRef.current.find((v) => v.voiceURI === voiceURI) : undefined;

        const queue = list.slice(startAt).map((text, offset) => {
          const index = startAt + offset;
          const utterance = new SpeechSynthesisUtterance(text);
          if (voice) {
            utterance.voice = voice;
            utterance.lang = voice.lang;
          }
          utterance.rate = rate;
          utterance.pitch = pitch;

          utterance.onstart = () => {
            if (run !== runRef.current) return;
            startedRef.current = true;
            indexRef.current = index;
            setChunkIndex(index);
            setWordRange(null);
          };

          utterance.onboundary = (event) => {
            if (run !== runRef.current) return;
            if (event.name && event.name !== "word") return;
            const at = event.charIndex ?? 0;
            const length = event.charLength || wordLengthAt(text, at);
            if (length > 0) setWordRange([at, at + length]);
          };

          utterance.onerror = (event) => {
            if (run !== runRef.current) return;
            // Cancelling to skip, restart or stop is not a failure.
            if (event.error === "interrupted" || event.error === "canceled") return;
            setError(describeSpeechError(event.error));
            resetPlayer();
          };

          if (index === list.length - 1) {
            utterance.onend = () => {
              if (run === runRef.current) resetPlayer();
            };
          }

          return utterance;
        });

        queueRef.current = queue;
        queue.forEach((utterance) => synth.speak(utterance));

        // Not every engine reports the utterance events: the Linux
        // speech-dispatcher bridge, for one, speaks without ever firing `start`.
        // So the engine's own `speaking`/`pending` flags decide whether a run got
        // going and whether it has finished, and the events above are treated as
        // the finer-grained progress they are when they do arrive.
        let waited = 0;
        let quiet = 0;
        monitorRef.current = window.setInterval(() => {
          if (run !== runRef.current) return;
          // A paused engine still reports itself as speaking.
          if (statusRef.current === "paused") return;

          if (synth.speaking || synth.pending) {
            startedRef.current = true;
            quiet = 0;
            return;
          }

          if (!startedRef.current) {
            waited += MONITOR_INTERVAL_MS;
            if (waited < START_TIMEOUT_MS) return;
            setError("Your device's speech engine didn't start. Try again in a moment.");
            synth.cancel();
            resetPlayer();
            return;
          }

          quiet += 1;
          if (quiet >= QUIET_CHECKS_TO_FINISH) resetPlayer();
        }, MONITOR_INTERVAL_MS);
      }, 60);
    },
    [clearTimers, resetPlayer]
  );

  const speak = useCallback(
    (request: SpeechRequest) => {
      if (!supported) {
        setError("This browser can't read text aloud.");
        return;
      }

      const source =
        request.markdown === false ? request.text : markdownToPlainText(request.text);
      const next = chunkForSpeech(source);
      if (!next.length) {
        setError("There's nothing to read here yet.");
        return;
      }

      setError(null);
      chunksRef.current = next;
      setChunks(next);
      setActiveId(request.id);
      setLabel(request.label);
      startRun(0);
    },
    [supported, startRun]
  );

  const pause = useCallback(() => {
    if (!supported) return;
    window.speechSynthesis.pause();
    setStatus("paused");
  }, [supported]);

  const resume = useCallback(() => {
    if (!supported) return;
    const synth = window.speechSynthesis;
    // Some builds ignore resume() once the queue has drained, so re-speak the
    // chunk we stopped inside instead of leaving the user with silence.
    if (synth.paused) {
      synth.resume();
      setStatus("speaking");
    } else {
      startRun(indexRef.current);
    }
  }, [supported, startRun]);

  const toggle = useCallback(
    (request: SpeechRequest) => {
      if (activeId === request.id) {
        if (status === "speaking") {
          pause();
          return;
        }
        if (status === "paused") {
          resume();
          return;
        }
      }
      speak(request);
    },
    [activeId, status, pause, resume, speak]
  );

  const skip = useCallback(
    (delta: number) => {
      const list = chunksRef.current;
      if (!list.length) return;
      const next = indexRef.current + delta;
      if (next >= list.length) {
        stop();
        return;
      }
      startRun(Math.max(0, next));
    },
    [startRun, stop]
  );

  const savePrefs = useCallback(
    (next: SpeechPrefs) => {
      setPrefs(next);
      prefsRef.current = next;
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // private mode / quota — the setting still applies for this session
      }
      // Voice and rate only reach the engine when an utterance is created, so
      // re-speak the current sentence to make the change audible right away.
      if (statusRef.current === "speaking") startRun(indexRef.current);
    },
    [startRun]
  );

  const setVoiceURI = useCallback(
    (voiceURI: string | null) => savePrefs({ ...prefsRef.current, voiceURI }),
    [savePrefs]
  );
  const setRate = useCallback(
    (rate: number) => savePrefs({ ...prefsRef.current, rate: clamp(rate, RATE_MIN, RATE_MAX) }),
    [savePrefs]
  );
  const setPitch = useCallback(
    (pitch: number) => savePrefs({ ...prefsRef.current, pitch: clamp(pitch, PITCH_MIN, PITCH_MAX) }),
    [savePrefs]
  );

  const dismissError = useCallback(() => setError(null), []);

  useEffect(() => {
    if (!supported) return;
    // Speech outlives the page unless it is cancelled explicitly.
    const cancel = () => window.speechSynthesis.cancel();
    window.addEventListener("beforeunload", cancel);
    return () => {
      window.removeEventListener("beforeunload", cancel);
      cancel();
    };
  }, [supported]);

  const value = useMemo(
    () => ({
      supported,
      voices,
      prefs,
      setVoiceURI,
      setRate,
      setPitch,
      status,
      activeId,
      label,
      chunks,
      chunkIndex,
      wordRange,
      error,
      speak,
      toggle,
      pause,
      resume,
      stop,
      skip,
      dismissError,
    }),
    [
      supported,
      voices,
      prefs,
      setVoiceURI,
      setRate,
      setPitch,
      status,
      activeId,
      label,
      chunks,
      chunkIndex,
      wordRange,
      error,
      speak,
      toggle,
      pause,
      resume,
      stop,
      skip,
      dismissError,
    ]
  );

  return <SpeechContext.Provider value={value}>{children}</SpeechContext.Provider>;
}
