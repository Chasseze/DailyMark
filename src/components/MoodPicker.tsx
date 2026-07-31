import { useEffect, useId, useRef, useState } from "react";
import { NOTES_MOODS } from "../lib/moods";
import { useMood } from "../context/mood-context";

/** Compact mood switcher as a pull-down so the My Notes title keeps room on mobile. */
export default function MoodPicker() {
  const { mood, setMood } = useMood();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const active = NOTES_MOODS.find((option) => option.id === mood) ?? NOTES_MOODS[0];

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className="mood-picker relative shrink-0" ref={rootRef}>
      <button
        type="button"
        className="mood-picker__trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        title={`${active.label}: ${active.blurb}`}
        onClick={() => setOpen((value) => !value)}
      >
        <span
          className="h-2 w-2 shrink-0 rounded-full ring-1 ring-white/40"
          style={{ backgroundColor: active.swatch }}
          aria-hidden="true"
        />
        <span className="truncate">{active.label}</span>
        <svg
          viewBox="0 0 20 20"
          className={"h-3.5 w-3.5 shrink-0 opacity-80 transition-transform " + (open ? "rotate-180" : "")}
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M5.25 7.5 10 12.25 14.75 7.5" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Notes mood"
          className="mood-picker__menu"
        >
          {NOTES_MOODS.map((option) => {
            const selected = mood === option.id;
            return (
              <li key={option.id} role="option" aria-selected={selected}>
                <button
                  type="button"
                  className={"mood-picker__option" + (selected ? " is-active" : "")}
                  onClick={() => {
                    setMood(option.id);
                    setOpen(false);
                  }}
                >
                  <span
                    className="mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-white/30"
                    style={{ backgroundColor: option.swatch }}
                    aria-hidden="true"
                  />
                  <span className="min-w-0 text-left">
                    <span className="block text-[12px] font-semibold">{option.label}</span>
                    <span className="mt-0.5 block text-[10px] leading-snug opacity-70">
                      {option.blurb}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
