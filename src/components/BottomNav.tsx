import { NavLink, useLocation } from "react-router-dom";

const tabs = [
  {
    to: "/notes",
    label: "Notes",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M7 3.75h7.5L19 8.25v12a.75.75 0 0 1-.75.75H7.75A.75.75 0 0 1 7 20.25V3.75Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M14.5 3.75V8H19M9.5 12h5M9.5 15.5h5" />
      </svg>
    ),
  },
  {
    to: "/daily",
    label: "Daily",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3.5v2M12 18.5v2M4.5 12h-2M21.5 12h-2M6.2 6.2 4.8 4.8M19.2 19.2l-1.4-1.4M6.2 17.8 4.8 19.2M19.2 4.8l-1.4 1.4" />
        <circle cx="12" cy="12" r="4.25" />
      </svg>
    ),
  },
  {
    to: "/settings",
    label: "Settings",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
        <circle cx="12" cy="12" r="3" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09A1.65 1.65 0 0 0 15 4.6a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9c.36.52.95.84 1.51.84H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
      </svg>
    ),
  },
];

export default function BottomNav() {
  const location = useLocation();
  const isNoteDetail =
    location.pathname.startsWith("/notes/") && location.pathname !== "/notes";

  if (isNoteDetail) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/5 glass light:border-slate-200/80">
      <div className="mx-auto flex max-w-lg items-center justify-around px-2 py-2.5">
        {tabs.map(({ to, icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              "flex flex-col items-center gap-1 rounded-xl px-5 py-1.5 text-[11px] font-medium tracking-wide transition-colors duration-200 " +
              (isActive
                ? "text-amber-400"
                : "text-slate-500 hover:text-slate-300 light:hover:text-slate-700")
            }
          >
            {icon}
            <span>{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
