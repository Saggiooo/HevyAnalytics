import { NavLink } from "react-router-dom";

type Props = {
  collapsed: boolean;
  onToggle: () => void;
};

const nav = [
  { to: "/", label: "Dashboard", icon: "📊" },
  { to: "/workouts", label: "Allenamenti", icon: "🏋️" },
  { to: "/records", label: "Record", icon: "🏆" },
  { to: "/ignored", label: "Ignored", icon: "🚫" },
  { to: "/exercises", label: "Esercizi", icon: "💪" }, 
  { to: "/analysis", label: "Analysis", icon: "🔍" },
  { to: "/settings", label: "Settings", icon: "⚙️" },
];

export function Sidebar({ collapsed, onToggle }: Props) {
  return (
    <aside
      className={[
        "sticky top-0 h-screen border-r border-white/10",
        "bg-zinc-950/60 backdrop-blur",
        collapsed ? "w-[76px]" : "w-[260px]",
        "hidden md:block",
        "transition-[width] duration-200",
      ].join(" ")}
    >
      <div className="flex items-center justify-between px-4 py-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-10 w-10 rounded-2xl bg-indigo-600/90 flex items-center justify-center shadow-lg shadow-indigo-600/20">
            <span className="text-lg">💪</span>
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <div className="font-semibold leading-tight">Hevy Analytics</div>
              <div className="text-xs text-zinc-400 leading-tight">FastAPI + React</div>
            </div>
          )}
        </div>

        <button className="btn" onClick={onToggle} aria-label="Toggle sidebar">
          {collapsed ? "▶" : "◀"}
        </button>
      </div>

      <nav className="px-2 py-2 space-y-1">
        {nav.map((i) => (
          <NavLink
            key={i.to}
            to={i.to}
            className={({ isActive }) =>
              [
                "navItem",
                isActive ? "navItemActive" : "",
                collapsed ? "justify-center" : "",
              ].join(" ")
            }
          >
            <span className="text-lg">{i.icon}</span>
            {!collapsed && <span>{i.label}</span>}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
