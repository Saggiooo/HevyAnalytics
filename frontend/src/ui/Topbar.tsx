type Props = {
  collapsed: boolean;
  onToggleSidebar: () => void;
};

export function Topbar({ onToggleSidebar }: Props) {
  return (
    <header className="sticky top-0 z-20 border-b border-white/10 bg-zinc-950/60 backdrop-blur">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button className="btn md:hidden" onClick={onToggleSidebar}>
              ☰
            </button>
            <div className="min-w-0">
              <div className="text-sm text-zinc-400">Hevy Analytics</div>
              <div className="font-semibold leading-tight">Dashboard</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="pill">Europe/Rome</span>
            <button className="btn">Export</button>
            <button className="btn btn-primary">Sync</button>
          </div>
        </div>
      </div>
    </header>
  );
}
