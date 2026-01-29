import { useMemo, useState } from "react";
import type { ReactNode } from "react";

import { Sidebar } from "../ui/Sidebar";
import { Topbar } from "../ui/Topbar";

export function AppShell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);

  const bg = useMemo(
    () =>
      `radial-gradient(1000px 700px at 10% 10%, rgba(99,102,241,0.18), transparent 55%),
       radial-gradient(900px 600px at 90% 30%, rgba(16,185,129,0.14), transparent 60%),
       radial-gradient(1000px 700px at 40% 100%, rgba(244,63,94,0.10), transparent 55%)`,
    []
  );

  return (
    <div className="min-h-screen" style={{ backgroundImage: bg }}>
      <div className="min-h-screen bg-zinc-950/80">
        <div className="flex">
          <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(v => !v)} />

          <div className="flex-1 min-w-0">
            <Topbar collapsed={collapsed} onToggleSidebar={() => setCollapsed(v => !v)} />

            <main className="px-4 sm:px-6 lg:px-8 py-6">
              <div className="mx-auto max-w-6xl">
                {children}
              </div>
            </main>

            <footer className="px-4 sm:px-6 lg:px-8 pb-8">
              <div className="mx-auto max-w-6xl text-xs text-zinc-500">
                Hevy Analytics • local-first • FastAPI + React
              </div>
            </footer>
          </div>
        </div>
      </div>
    </div>
  );
}
