import { NavLink } from "react-router-dom";
import { NAV_ITEMS } from "./nav-items";

/**
 * Desktop primary navigation. From lg up the bottom tab bar — a phone
 * convention that reads oddly on a laptop — gives way to a left rail. The rail
 * is a sticky column *inside* the centred app container, not pinned to the
 * viewport, so the app keeps its side margins.
 */
export default function SideNav() {
  return (
    <nav
      className="sticky top-[4.25rem] hidden max-h-[calc(100svh-5.5rem)] w-56 shrink-0 flex-col self-start overflow-y-auto border-r border-line py-5 pr-3 lg:flex"
      aria-label="Primary"
    >
      <div className="mb-6 flex items-center gap-2.5 px-2">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent">
          <div className="h-2.5 w-2.5 rounded-[3px] bg-on-accent" />
        </div>
        <p className="truncate text-lg font-bold tracking-tight text-ink">
          DailyMark
        </p>
      </div>

      <div className="flex flex-col gap-1">
        {NAV_ITEMS.map(({ to, icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors " +
              (isActive
                ? "bg-accent-soft text-accent-ink"
                : "text-muted hover:bg-surface-2 hover:text-ink")
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
