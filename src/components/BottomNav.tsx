import { useEffect, useRef, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { NAV_ITEMS } from "./nav-items";

/**
 * Mobile / tablet primary navigation. The desktop rail is `SideNav`.
 *
 * Four everyday destinations stay fixed in view; lower-frequency sections
 * live in a compact More menu rather than making primary navigation scroll.
 */
export default function BottomNav() {
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const { pathname } = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  const primaryItems = NAV_ITEMS.filter((item) =>
    ["/desk", "/notes", "/daily", "/rhythm"].includes(item.to),
  );
  const moreItems = NAV_ITEMS.filter((item) => !primaryItems.includes(item));
  const isMoreActive = moreItems.some(
    (item) => pathname === item.to || pathname.startsWith(item.to + "/"),
  );

  useEffect(() => {
    const active = trackRef.current?.querySelector<HTMLElement>(
      "[data-active='true']",
    );
    active?.scrollIntoView({ inline: "nearest", block: "nearest" });
  }, [pathname]);

  useEffect(() => {
    if (!moreOpen) return;
    menuRef.current?.querySelector<HTMLElement>("a")?.focus();
    const dismiss = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMoreOpen(false);
        triggerRef.current?.focus();
      }
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const items = [
          ...(menuRef.current?.querySelectorAll<HTMLElement>("a") ?? []),
        ];
        const at = items.indexOf(document.activeElement as HTMLElement);
        items[
          (at + (e.key === "ArrowDown" ? 1 : items.length - 1)) % items.length
        ]?.focus();
      }
    };
    const outside = (e: PointerEvent) => {
      if (
        !menuRef.current?.contains(e.target as Node) &&
        !triggerRef.current?.contains(e.target as Node)
      )
        setMoreOpen(false);
    };
    document.addEventListener("keydown", dismiss);
    document.addEventListener("pointerdown", outside);
    return () => {
      document.removeEventListener("keydown", dismiss);
      document.removeEventListener("pointerdown", outside);
    };
  }, [moreOpen]);

  return (
    <nav
      className="app-bottom-nav border-t border-line lg:hidden"
      style={{ paddingBottom: "max(0.55rem, env(safe-area-inset-bottom))" }}
      aria-label="Primary"
    >
      <div
        ref={trackRef}
        className="app-bottom-nav__track relative grid grid-cols-5 gap-1 px-2.5 pt-2.5"
      >
        {primaryItems.map(({ to, icon, label }) => (
          <NavLink
            key={to}
            to={to}
            data-active={pathname === to || pathname.startsWith(to + "/")}
            className={({ isActive }) =>
              "flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1.5 py-2 text-xs font-medium transition-colors duration-200 " +
              (isActive
                ? "bg-accent-soft text-accent-ink"
                : "text-muted hover:bg-surface hover:text-ink-soft")
            }
          >
            {icon}
            <span className="truncate">{label}</span>
          </NavLink>
        ))}
        <button
          type="button"
          ref={triggerRef}
          onClick={() => setMoreOpen((open) => !open)}
          aria-expanded={moreOpen}
          aria-haspopup="menu"
          className={
            "flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1.5 py-2 text-xs font-medium transition-colors " +
            (isMoreActive || moreOpen
              ? "bg-accent-soft text-accent-ink"
              : "text-muted hover:bg-surface hover:text-ink-soft")
          }
        >
          <MoreIcon />
          <span>More</span>
        </button>
        {moreOpen && (
          <div
            ref={menuRef}
            className="app-bottom-nav__more glass"
            role="menu"
            aria-label="More sections"
          >
            {moreItems.map(({ to, icon, label }) => (
              <NavLink
                key={to}
                to={to}
                role="menuitem"
                onClick={() => setMoreOpen(false)}
                className={({ isActive }) =>
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors " +
                  (isActive
                    ? "bg-accent-soft text-accent-ink"
                    : "text-muted hover:bg-surface-2 hover:text-ink")
                }
              >
                {icon}
                {label}
              </NavLink>
            ))}
          </div>
        )}
      </div>
    </nav>
  );
}

function MoreIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      aria-hidden="true"
    >
      <circle cx="5" cy="12" r="1" fill="currentColor" />
      <circle cx="12" cy="12" r="1" fill="currentColor" />
      <circle cx="19" cy="12" r="1" fill="currentColor" />
    </svg>
  );
}
