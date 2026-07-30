import { useEffect, useMemo } from "react";
import { useSpeech } from "../hooks/useSpeech";
import { estimateSpeechSeconds, formatDuration, markdownToSpeech } from "../lib/speech";

interface Props {
  title: string;
  content: string;
}

const SPEEDS = [0.75, 1, 1.25, 1.5, 2];

/**
 * Read-aloud player for a note, driven by the browser's own speech synthesizer.
 * The note's markdown is converted to spoken segments first, so headings, lists
 * and tasks are announced instead of having their punctuation read out.
 */
export default function ReadAloud({ title, content }: Props) {
  const { supported, hasVoices, prefs, setPrefs, status, index, error, speak, pause, resume, stop } =
    useSpeech();

  const segments = useMemo(() => markdownToSpeech(content, { title }), [content, title]);
  const texts = useMemo(() => segments.map((s) => s.text), [segments]);
  const duration = useMemo(() => estimateSpeechSeconds(segments, prefs.rate), [segments, prefs.rate]);

  // Opening a different note must not keep narrating the previous one.
  useEffect(() => stop, [stop, title, content]);

  if (!segments.length) return null;

  if (!supported) {
    return (
      <p className="mb-4 rounded-2xl bg-slate-800/30 px-4 py-3 text-xs text-slate-500 light:bg-slate-100">
        🔊 Read aloud needs a browser with speech synthesis support.
      </p>
    );
  }

  const active = status !== "idle";
  const current = segments[Math.min(index, segments.length - 1)];
  const progress = active ? ((index + 1) / segments.length) * 100 : 0;

  const handlePlay = () => {
    if (status === "speaking") pause();
    else if (status === "paused") resume();
    else speak(texts);
  };

  return (
    <section className="glass mb-5 rounded-2xl p-3" aria-label="Read aloud">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handlePlay}
          aria-label={status === "speaking" ? "Pause reading" : "Read this note aloud"}
          className={
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-base text-black transition-transform hover:scale-105 active:scale-95 " +
            (status === "speaking" ? "pulse-glow" : "")
          }
        >
          {status === "speaking" ? "⏸" : "▶"}
        </button>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-white light:text-slate-900">
            {status === "speaking" ? "Reading aloud" : status === "paused" ? "Paused" : "Read aloud"}
          </p>
          <p className="mt-0.5 truncate text-xs text-slate-400 light:text-slate-500">
            {active
              ? `${index + 1} of ${segments.length} · ${current.text}`
              : `${segments.length} part${segments.length === 1 ? "" : "s"} · about ${formatDuration(duration)}`}
          </p>
        </div>

        {active && (
          <button
            type="button"
            onClick={stop}
            aria-label="Stop reading"
            className="shrink-0 rounded-xl p-2 text-sm text-slate-400 transition-colors hover:bg-slate-800/60 hover:text-white light:hover:bg-slate-100 light:hover:text-slate-900"
          >
            ⏹
          </button>
        )}
      </div>

      <div className="mt-3 flex items-center gap-2">
        <span className="text-[11px] uppercase tracking-wider text-slate-500">Speed</span>
        <div className="flex gap-1">
          {SPEEDS.map((speed) => (
            <button
              key={speed}
              type="button"
              onClick={() => setPrefs({ rate: speed })}
              className={
                "rounded-lg px-2 py-0.5 text-xs font-medium transition-colors " +
                (Math.abs(prefs.rate - speed) < 0.01
                  ? "bg-amber-500/20 text-amber-400"
                  : "text-slate-400 hover:text-slate-200 light:text-slate-500 light:hover:text-slate-700")
              }
            >
              {speed}×
            </button>
          ))}
        </div>
      </div>

      {active && (
        <div className="mt-3 h-1 overflow-hidden rounded-full bg-slate-800/60 light:bg-slate-200">
          <div
            className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}

      {!hasVoices && !error && (
        <p className="mt-2 text-xs text-slate-500">
          No system voices detected yet — playback may be silent until the browser installs one.
        </p>
      )}
    </section>
  );
}
