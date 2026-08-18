import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Browser dictation, shared by every surface that offers a mic.
 *
 * Lifted out of NotesSidebar when the capture bar needed the same thing: two
 * copies of a speech recogniser is two sets of the browser quirks below to
 * keep in step.
 */

type SpeechRecognitionResultLike = {
  isFinal: boolean;
  0?: { transcript: string };
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike> & { length: number };
};

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

function getSpeechRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function isDictationSupported(): boolean {
  return typeof window !== "undefined" && getSpeechRecognitionCtor() !== null;
}

export interface Dictation {
  /** True while the recogniser is running. */
  listening: boolean;
  /** Finals plus the current interim, for a live preview. */
  draft: string;
  /** Start listening, or stop and hand the transcript to `onTranscript`. */
  toggle: () => void;
}

export interface DictationOptions {
  /** Called once per session with the trimmed transcript. */
  onTranscript: (text: string) => void;
  /** Called when a session ends with nothing, or the engine fails. */
  onError: (message: string) => void;
  /** Blocks starting a session (a write already in flight, say). */
  disabled?: boolean;
}

export function useDictation({ onTranscript, onError, disabled }: DictationOptions): Dictation {
  const [listening, setListening] = useState(false);
  const [draft, setDraft] = useState("");

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const finalsRef = useRef("");
  const activeRef = useRef(false);
  const stoppingRef = useRef(false);

  // The callbacks are read from refs so a re-render with new closures never
  // has to tear down a running recogniser.
  const onTranscriptRef = useRef(onTranscript);
  const onErrorRef = useRef(onError);
  useEffect(() => {
    onTranscriptRef.current = onTranscript;
    onErrorRef.current = onError;
  }, [onTranscript, onError]);

  const finish = useCallback((transcript: string) => {
    // onerror and onend can both fire; only finalize once.
    if (!activeRef.current && !recognitionRef.current) return;
    recognitionRef.current = null;
    activeRef.current = false;
    stoppingRef.current = false;
    const text = transcript.trim();
    finalsRef.current = "";
    setListening(false);
    setDraft("");

    if (!text) {
      onErrorRef.current("No speech detected. Try again.");
      return;
    }
    onTranscriptRef.current(text);
  }, []);

  const toggle = useCallback(() => {
    if (disabled) return;

    // Second press stops the session and yields one transcript.
    if (activeRef.current && recognitionRef.current) {
      stoppingRef.current = true;
      try {
        recognitionRef.current.stop();
      } catch {
        finish(finalsRef.current);
      }
      return;
    }

    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      onErrorRef.current("Voice capture is not supported in this browser.");
      return;
    }

    setDraft("");
    finalsRef.current = "";
    stoppingRef.current = false;
    activeRef.current = true;

    const recognition = new Ctor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = navigator.language || "en-US";
    recognitionRef.current = recognition;

    recognition.onresult = (event) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const piece = result?.[0]?.transcript?.trim() ?? "";
        if (!piece) continue;
        if (result.isFinal) {
          finalsRef.current = [finalsRef.current, piece].filter(Boolean).join(" ");
        } else {
          interim = interim ? `${interim} ${piece}` : piece;
        }
      }
      setDraft([finalsRef.current, interim].filter(Boolean).join(" "));
    };

    recognition.onerror = (event) => {
      const code = event.error;
      // aborted / no-speech: keep the session; onend restarts or finalizes.
      if (code === "aborted" || code === "no-speech") return;
      activeRef.current = false;
      stoppingRef.current = false;
      recognitionRef.current = null;
      setListening(false);
      setDraft("");
      onErrorRef.current(code ? `Voice capture failed: ${code}` : "Voice capture failed.");
    };

    recognition.onend = () => {
      // Browsers often end continuous recognition after a pause; keep going
      // until the user presses the mic again.
      if (activeRef.current && !stoppingRef.current && recognitionRef.current) {
        try {
          recognitionRef.current.start();
          return;
        } catch {
          // Fall through and finalize whatever we have.
        }
      }
      finish(finalsRef.current);
    };

    try {
      setListening(true);
      recognition.start();
    } catch {
      activeRef.current = false;
      recognitionRef.current = null;
      setListening(false);
      setDraft("");
      onErrorRef.current("Voice capture could not start.");
    }
  }, [disabled, finish]);

  useEffect(() => {
    return () => {
      activeRef.current = false;
      stoppingRef.current = true;
      try {
        recognitionRef.current?.abort();
      } catch {
        // Nothing to clean up.
      }
      recognitionRef.current = null;
    };
  }, []);

  return { listening, draft, toggle };
}
