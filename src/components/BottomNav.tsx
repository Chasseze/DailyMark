import { NavLink, useLocation } from "react-router-dom";

const tabs = [
  { to: "/notes", icon: "📝", label: "Notes" },
  { to: "/daily", icon: "✨", label: "Daily" },
  { to: "/settings", icon: "⚙️", label: "Settings" },
];

export default function BottomNav() {
  const location = useLocation();
  const isNoteDetail =
    location.pathname.startsWith("/notes/") && location.pathname !== "/notes";

  if (isNoteDetail) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 glass border-t border-white/5">
      <div className="mx-auto flex max-w-lg items-center justify-around px-2 py-2">
        {tabs.map(({ to, icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              "flex flex-col items-center gap-0.5 rounded-xl px-5 py-2 text-xs font-medium transition-all duration-200 " +
              (isActive
                ? "text-amber-400 scale-105"
                : "text-slate-500 hover:text-slate-300")
            }
          >
            <span className="text-xl">{icon}</span>
            <span>{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
