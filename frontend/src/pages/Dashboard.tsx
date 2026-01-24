import { StatCard } from "../ui/StatCard";

export function Dashboard() {
  // TODO: qui poi ci mettiamo React Query che chiama /api/dashboard/summary?year=2026
  const mock = {
    workouts: 8,
    days: 7,
    volumeKg: 21438,
    uniqueExercises: 13,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="text-sm text-zinc-400">Dashboard</div>
          <h1 className="text-2xl font-semibold tracking-tight">2026</h1>
        </div>
        <div className="flex gap-2">
          <button className="btn">Anno ▾</button>
          <button className="btn btn-primary">Sync now</button>
        </div>
      </div>

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Allenamenti" value={mock.workouts} icon="🏋️" subtitle="YTD" />
        <StatCard title="Giorni allenati" value={mock.days} icon="🗓️" subtitle="YTD" />
        <StatCard title="Volume totale (kg)" value={mock.volumeKg.toLocaleString()} icon="📦" subtitle="Somma (peso × reps)" />
        <StatCard title="Esercizi unici" value={mock.uniqueExercises} icon="🧩" subtitle="YTD" />
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="card p-5 lg:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-zinc-400">Volume</div>
              <div className="font-semibold">Volume per mese</div>
            </div>
            <span className="pill">kg</span>
          </div>
          <div className="mt-4 h-64 flex items-center justify-center text-zinc-500">
            {/* qui ci metti il grafico vero */}
            Grafico (Recharts)
          </div>
        </div>

        <div className="card p-5">
          <div className="text-sm text-zinc-400">Top</div>
          <div className="font-semibold">Top esercizi per volume</div>
          <div className="mt-4 space-y-3">
            {["Panca piana", "Lat machine", "Squat", "Curl manubri", "Shoulder press"].map((x, idx) => (
              <div key={x} className="flex items-center justify-between">
                <div className="text-sm">
                  <span className="text-zinc-400 mr-2">{idx + 1}.</span>
                  {x}
                </div>
                <span className="pill">—</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
