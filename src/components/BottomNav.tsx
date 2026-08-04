import { useEffect, useRef } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { NAV_ITEMS } from "./nav-items";

/**
 * Mobile / tablet primary navigation. The desktop rail is `SideNav`.
 *
 * Five destinations no longer divide evenly into a 390px screen, so the tabs
 * keep a readable fixed width and the row scrolls instead of squeezing every
 * label until it truncates. A scrolling bar can hide the tab you are on, so
 * the active one is scrolled back into view whenever the route changes.
 */
export default function BottomNav() {
  const trackRef = useRef<HTMLDivElement>(null);
  const { pathname } = useLocation();

  useEffect(() => {
    const active = trackRef.current?.querySelector<HTMLElement>("[data-active='true']");
    active?.scrollIntoView({ inline: "nearest", block: "nearest" });
  }, [pathname]);

  return (
    <nav
      className="app-bottom-nav border-t border-line lg:hidden"
      style={{ paddingBottom: "max(0.55rem, env(safe-area-inset-bottom))" }}
      aria-label="Primary"
    >
      <div ref={trackRef} className="app-bottom-nav__track flex items-stretch gap-2 px-2.5 pt-2.5">
        {NAV_ITEMS.map(({ to, icon, label }) => (
          <NavLink
            key={to}
            to={to}
            data-active={pathname === to || pathname.startsWith(to + "/")}
            className={({ isActive }) =>
              "flex shrink-0 basis-[4.5rem] flex-col items-center justify-center gap-1 rounded-md border px-1.5 py-2 text-xs font-medium tracking-wide transition-colors duration-200 " +
              (isActive
                ? "border-accent/60 bg-accent-soft text-accent-ink"
                : "border-line bg-surface text-muted hover:border-line-strong hover:bg-surface-2 hover:text-ink-soft")
            }
          >
            {icon}
            <span className="truncate">{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
