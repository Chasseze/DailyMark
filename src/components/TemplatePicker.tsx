import { useEffect, useId, useRef, useState } from "react";
import { NOTE_TEMPLATES, type NoteTemplate } from "../lib/templates";

interface Props {
  /** Create a note from the chosen template. Errors are the caller's to report. */
  onPick: (template: NoteTemplate) => Promise<void> | void;
  disabled?: boolean;
}

/**
 * "Choose from a template" as a pull-down beside the search box.
 *
 * It used to be a bare <select> on its own row — a browser-chrome control in a
 * hand-styled list, and a line of vertical space spent on a label. As a menu it
 * can show what each template actually gives you, and the row it vacated goes
 * back to the notes.
 */
export default function TemplatePicker({ onPick, disabled = false }: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

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

  const choose = async (template: NoteTemplate) => {
    if (busy) return;
    setBusy(true);
    try {
      await onPick(template);
      setOpen(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="pop-picker" ref={rootRef}>
      <button
        type="button"
        className="pop-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label="New from template"
        disabled={disabled || busy}
        onClick={() => setOpen((value) => !value)}
      >
        <svg
          viewBox="0 0 24 24"
          className="h-4 w-4 shrink-0"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M4.75 6.75h14.5M4.75 11.25h8M4.75 15.75h8M16.5 12.5v7M13 16h7"
          />
        </svg>
        <span className="pop-trigger__label">Templates</span>
        <svg
          viewBox="0 0 20 20"
          className={
            "h-3.5 w-3.5 shrink-0 opacity-70 transition-transform " +
            (open ? "rotate-180" : "")
          }
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M5.25 7.5 10 12.25 14.75 7.5"
          />
        </svg>
      </button>

      {open && (
        <div id={menuId} role="menu" aria-label="Note templates" className="pop-menu">
          <p className="pop-menu__head">Start from a template</p>
          {NOTE_TEMPLATES.map((template) => (
            <button
              key={template.name}
              type="button"
              role="menuitem"
              disabled={busy}
              className="pop-menu__option"
              onClick={() => void choose(template)}
            >
              <span className="pop-menu__icon" aria-hidden="true">
                {template.icon}
              </span>
              <span className="min-w-0 text-left">
                <span className="pop-menu__name">{template.name}</span>
                <span className="pop-menu__blurb">{template.blurb}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
