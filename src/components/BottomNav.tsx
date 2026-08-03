import { NavLink } from "react-router-dom";
import { NAV_ITEMS } from "./nav-items";

/** Mobile / tablet primary navigation. The desktop rail is `SideNav`. */
export default function BottomNav() {
  return (
    <nav
      className="app-bottom-nav border-t border-line lg:hidden"
      style={{ paddingBottom: "max(0.55rem, env(safe-area-inset-bottom))" }}
      aria-label="Primary"
    >
      <div className="mx-auto flex items-stretch gap-2 px-2.5 pt-2.5">
        {NAV_ITEMS.map(({ to, icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              "flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-md border px-1.5 py-2 text-xs font-medium tracking-wide transition-colors duration-200 " +
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
