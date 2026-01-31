import { useMutation } from "@tanstack/react-query";

const API_BASE =
  (import.meta as any).env?.VITE_API_BASE || "http://127.0.0.1:8000/api";

type Props = {
  collapsed: boolean;
  onToggleSidebar: () => void;
};

export function Topbar({ onToggleSidebar }: Props) {
  const syncMut = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${API_BASE}/sync?force=true`, {
        method: "POST",
        headers: { Accept: "application/json" },
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(`Sync failed: HTTP ${res.status}${txt ? ` – ${txt}` : ""}`);
      }
      return res.json() as Promise<{ ok: boolean; last_sync_ts?: string | null }>;
    },
  });

  return (
    <header className="sticky top-0 z-20 border-b border-white/10 bg-zinc-950/60 backdrop-blur">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button className="btn md:hidden" onClick={onToggleSidebar}>☰</button>
            <div className="min-w-0">
              <div className="text-sm text-zinc-400">Hevy Analytics</div>
              <div className="font-semibold leading-tight">Dashboard</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="pill">Europe/Rome</span>
            <button className="btn">Export</button>

            <button
              className="btn btn-primary"
              onClick={() => syncMut.mutate()}
              disabled={syncMut.isPending}
              title="Scarica da Hevy e aggiorna il DB"
            >
              {syncMut.isPending ? "Sync…" : "Sync"}
            </button>
          </div>
        </div>

        {syncMut.isError && (
          <div className="mx-auto max-w-6xl pb-3 text-sm text-rose-300">
            {(syncMut.error as Error).message}
          </div>
        )}
        {syncMut.isSuccess && (
          <div className="mx-auto max-w-6xl pb-3 text-sm text-emerald-300">
            Sync ok {syncMut.data?.last_sync_ts ? `(${syncMut.data.last_sync_ts})` : ""}
          </div>
        )}
      </div>
    </header>
  );
}