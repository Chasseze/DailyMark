import { useSpeech } from "../context/speech-context";
import type { SpeechRequest } from "../context/speech-context";
import { markdownToPlainText } from "../lib/markdown";

interface Props {
  request: SpeechRequest;
  /** Icon-only, for dense places like note cards. */
  compact?: boolean;
  className?: string;
}

const SpeakerIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5.5 6.5 9H4v6h2.5L11 18.5V5.5Z" />
    <path strokeLinecap="round" d="M15 9.5a3.5 3.5 0 0 1 0 5M17.5 7a7 7 0 0 1 0 10" />
  </svg>
);

const PauseIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
    <rect x="7" y="5.5" width="3.5" height="13" rx="1.2" />
    <rect x="13.5" y="5.5" width="3.5" height="13" rx="1.2" />
  </svg>
);

const PlayIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
    <path d="M8 5.5v13l11-6.5-11-6.5Z" />
  </svg>
);

/**
 * Reads a note — or any other text — aloud with the browser's speech engine.
 * Hidden when the browser has no speech synthesis at all; Settings explains why.
 */
export default function ReadAloudButton({ request, compact = false, className = "" }: Props) {
  const { supported, status, activeId, toggle } = useSpeech();
  if (!supported) return null;

  const active = activeId === request.id;
  const speaking = active && status === "speaking";
  const paused = active && status === "paused";
  const empty = !markdownToPlainText(request.text).trim();

  const action = speaking ? "Pause reading" : paused ? "Resume reading" : "Read aloud";
  const icon = speaking ? <PauseIcon /> : paused ? <PlayIcon /> : <SpeakerIcon />;

  const base = compact
    ? "rounded-lg p-1.5 transition-colors hover:bg-white/10 disabled:opacity-40 "
    : "flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium transition-colors hover:bg-white/10 disabled:opacity-40 ";
  const tone = active
    ? "text-amber-400"
    : "text-slate-400 light:text-slate-500 light:hover:text-slate-700";

  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        toggle(request);
      }}
      disabled={empty}
      title={empty ? "Nothing to read yet" : action}
      aria-label={action}
      className={base + tone + (className ? ` ${className}` : "")}
    >
      {icon}
      {!compact && <span>{speaking ? "Pause" : paused ? "Resume" : "Listen"}</span>}
    </button>
  );
}
