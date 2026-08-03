import { NavLink } from "react-router-dom";
import { NAV_ITEMS } from "./nav-items";

/**
 * Desktop primary navigation. From lg up the bottom tab bar — a phone
 * convention that reads oddly on a laptop — gives way to a fixed left rail,
 * which also frees the full column height for the notes master–detail view.
 */
export default function SideNav() {
  return (
    <nav
      className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-line bg-paper/60 px-3 py-5 lg:flex"
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
