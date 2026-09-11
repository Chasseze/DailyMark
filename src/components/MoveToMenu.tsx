import { useEffect, useId, useRef, useState } from "react";
import type { Notebook } from "../lib/types";

/** `null` means "no notebook"; "trash" means soft-delete. */
export type MoveTarget = string | null | "trash";

interface Props {
  notebooks: Notebook[];
  /** Selection size, for the Trash confirm wording. */
  count: number;
  onMove: (target: MoveTarget) => Promise<void> | void;
  disabled?: boolean;
}

/**
 * Destination picker for a bulk selection.
 *
 * This was a native <select>. On a phone that opens the OS picker sheet, which
 * is much larger than the compact list the same markup gives on a desktop —
 * and the optgroups that separated notebooks from Trash made it taller still.
 * A menu we draw ourselves is the only way the two can match, and it matches
 * the templates and mood pickers while it is at it.
 */
export default function MoveToMenu({
  notebooks,
  count,
  onMove,
  disabled = false,
}: Props) {
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

  const choose = async (target: MoveTarget) => {
    if (busy) return;
    if (
      target === "trash" &&
      !confirm(`Move ${count} note${count === 1 ? "" : "s"} to Trash?`)
    )
      return;
    setBusy(true);
    try {
      await onMove(target);
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
        disabled={disabled || busy}
        onClick={() => setOpen((value) => !value)}
      >
        <span>Move to…</span>
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
        <div id={menuId} role="menu" aria-label="Move selected notes" className="pop-menu pop-menu--left pop-menu--compact">
          <button
            type="button"
            role="menuitem"
            disabled={busy}
            className="pop-menu__option"
            onClick={() => void choose(null)}
          >
            <span className="pop-menu__dot" style={{ background: "transparent" }} aria-hidden="true" />
            <span className="pop-menu__name">No notebook</span>
          </button>
          {notebooks.map((nb) => (
            <button
              key={nb.id}
              type="button"
              role="menuitem"
              disabled={busy}
              className="pop-menu__option"
              onClick={() => void choose(nb.id)}
            >
              <span
                className="pop-menu__dot"
                style={{ background: nb.color }}
                aria-hidden="true"
              />
              <span className="pop-menu__name">{nb.name}</span>
            </button>
          ))}
          <div className="pop-menu__sep" role="none" />
          <button
            type="button"
            role="menuitem"
            disabled={busy}
            className="pop-menu__option pop-menu__option--danger"
            onClick={() => void choose("trash")}
          >
            <span className="pop-menu__dot" style={{ background: "transparent" }} aria-hidden="true" />
            <span className="pop-menu__name">Trash</span>
          </button>
        </div>
      )}
    </div>
  );
}
