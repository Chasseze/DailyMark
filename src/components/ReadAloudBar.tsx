import type { ReactNode } from "react";
import { useSpeechControls, useSpeechProgress } from "../context/speech-context";

const RATES = [0.8, 1, 1.25, 1.5, 1.75];

/** 1 → "1", 1.25 → "1.25" — no trailing zeroes in the speed pill. */
function formatRate(rate: number): string {
  return String(Number(rate.toFixed(2)));
}

const ControlButton = ({
  onClick,
  label,
  children,
  primary = false,
}: {
  onClick: () => void;
  label: string;
  children: ReactNode;
  primary?: boolean;
}) => (
  <button
    type="button"
    onClick={onClick}
    title={label}
    aria-label={label}
    className={
      primary
        ? "flex h-9 w-9 items-center justify-center rounded-full bg-accent text-on-accent transition-transform hover:scale-105 active:scale-95"
        : "flex h-8 w-8 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-ink"
    }
  >
    {children}
  </button>
);

/**
 * The playback strip for read-aloud. It lives above the tab bar rather than on
 * the note page, so speech stays controllable while you browse elsewhere.
 */
export default function ReadAloudBar() {
  const {
    status,
    label,
    error,
    prefs,
    setRate,
    pause,
    resume,
    stop,
    skip,
    dismissError,
  } = useSpeechControls();
  const { chunks, chunkIndex, wordRange } = useSpeechProgress();

  if (status === "idle" && !error) return null;

  if (status === "idle" && error) {
    return (
      <div className="glass border-t border-line px-4 py-3">
        <div className="mx-auto flex max-w-lg items-center gap-3">
          <p className="flex-1 text-xs text-danger">{error}</p>
          <button
            type="button"
            onClick={dismissError}
            className="rounded-lg px-2 py-1 text-xs text-muted hover:text-ink"
          >
            Dismiss
          </button>
        </div>
      </div>
    );
  }

  const sentence = chunks[chunkIndex] ?? "";
  const [wordStart, wordEnd] = wordRange ?? [0, 0];
  const progress = chunks.length ? ((chunkIndex + 1) / chunks.length) * 100 : 0;
  const nextRate = RATES.find((rate) => rate > prefs.rate + 0.001) ?? RATES[0];

  return (
    <div className="glass border-t border-line/80">
      <div className="h-0.5 w-full bg-surface-2">
        <div
          className="h-full bg-accent transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="mx-auto max-w-lg px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-wider text-accent-ink">
            {status === "paused" ? "Paused" : "Reading"}
          </span>
          <p className="min-w-0 flex-1 truncate text-xs text-muted">{label}</p>
          <span className="shrink-0 text-xs text-muted">
            {chunkIndex + 1}/{chunks.length}
          </span>
        </div>

        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-ink-soft">
          {wordRange ? (
            <>
              {sentence.slice(0, wordStart)}
              <mark className="rounded bg-accent-soft text-accent-ink">
                {sentence.slice(wordStart, wordEnd)}
              </mark>
              {sentence.slice(wordEnd)}
            </>
          ) : (
            sentence
          )}
        </p>

        <div className="mt-1.5 flex items-center gap-1">
          <ControlButton onClick={() => skip(-1)} label="Previous sentence">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
              <path d="M17 6v12L8.5 12 17 6ZM7 5.5h2v13H7z" />
            </svg>
          </ControlButton>

          {status === "paused" ? (
            <ControlButton onClick={resume} label="Resume reading" primary>
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
                <path d="M8 5.5v13l11-6.5-11-6.5Z" />
              </svg>
            </ControlButton>
          ) : (
            <ControlButton onClick={pause} label="Pause reading" primary>
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
                <rect x="7" y="5.5" width="3.5" height="13" rx="1.2" />
                <rect x="13.5" y="5.5" width="3.5" height="13" rx="1.2" />
              </svg>
            </ControlButton>
          )}

          <ControlButton onClick={() => skip(1)} label="Next sentence">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
              <path d="M7 6v12L15.5 12 7 6ZM15 5.5h2v13h-2z" />
            </svg>
          </ControlButton>

          <div className="flex-1" />

          <button
            type="button"
            onClick={() => setRate(nextRate)}
            title="Reading speed"
            className="rounded-lg px-2 py-1 text-xs font-medium text-muted transition-colors hover:bg-surface-2 hover:text-accent"
          >
            {formatRate(prefs.rate)}×
          </button>

          <button
            type="button"
            onClick={stop}
            title="Stop reading"
            aria-label="Stop reading"
            className="rounded-lg px-2 py-1 text-xs text-muted transition-colors hover:bg-danger-soft hover:text-danger"
          >
            Stop
          </button>
        </div>
      </div>
    </div>
  );
}
