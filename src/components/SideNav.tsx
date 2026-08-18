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
      className="side-nav sticky top-[4.25rem] hidden max-h-[calc(100svh-5.5rem)] w-56 shrink-0 flex-col self-start overflow-y-auto border-r border-line py-5 pr-3 lg:flex"
      aria-label="Primary"
    >
      <div className="mb-6 px-2">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent">
            <div className="h-2.5 w-2.5 rounded-[3px] bg-on-accent" />
          </div>
          <p className="side-nav__wordmark truncate text-lg font-bold tracking-tight text-ink">
            DailyMark
          </p>
        </div>
        {/* Ember only — see the mood's block in index.css. */}
        <p className="side-nav__tagline mt-2.5 whitespace-nowrap text-[0.55rem] font-semibold uppercase tracking-[0.16em] text-faint">
          Jot today. Find tomorrow.
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

      {/* Ember only. The reference's signature, and the reason the rail runs
          the full height of the page in that mood. */}
      <div className="side-nav__flourish mt-auto px-3 pt-8">
        <div className="mb-3 flex items-center gap-1.5" aria-hidden="true">
          <span className="h-px w-5 bg-white/15" />
          <span className="h-[3px] w-[3px] rounded-full bg-accent-ink" />
          <span className="h-px w-5 bg-white/15" />
        </div>
        <p className="side-nav__script text-2xl">
          Write it down.
          <br />
          Make it happen.
        </p>
      </div>
    </nav>
  );
}
