import { useQuery } from "@tanstack/react-query"
import { getDashboardSummary } from "../lib/api"
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts"

function monthLabels() {
  return ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"]
}

export default function DashboardPage() {
  const year = new Date().getFullYear()
  const { data, isLoading, error } = useQuery({
    queryKey: ["dashboard", year],
    queryFn: () => getDashboardSummary(year),
  })

  if (isLoading) return <div className="rounded-2xl bg-white p-6 shadow-sm">Loading...</div>
  if (error) return <div className="rounded-2xl bg-white p-6 shadow-sm">Errore: {(error as Error).message}</div>
  if (!data) return null

  const chartData = monthLabels().map((m, i) => ({
    month: m,
    volume: data.volume_by_month[i],
    workouts: data.workouts_by_month[i],
  }))

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <div className="text-xl font-semibold">Dashboard {year}</div>
        <div className="mt-1 text-sm text-zinc-500">Smoke test: dati dal backend</div>

        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Card label="Allenamenti" value={data.workouts_count} />
          <Card label="Giorni allenati" value={data.training_days} />
          <Card label="Volume totale (kg)" value={Math.round(data.total_volume_kg)} />
          <Card label="Esercizi unici" value={data.unique_exercises} />
        </div>
      </div>

      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <div className="mb-3 text-sm font-medium">Volume per mese</div>
        <div style={{ width: "100%", height: 280 }}>
          <ResponsiveContainer>
            <BarChart data={chartData}>
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="volume" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}

function Card({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-zinc-100 bg-zinc-50 p-4">
      <div className="text-xs text-zinc-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  )
}
