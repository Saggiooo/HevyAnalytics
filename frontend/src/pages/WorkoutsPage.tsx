import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { listWorkouts, toggleIgnored } from "../lib/api"

export default function WorkoutsPage() {
  const year = new Date().getFullYear()
  const qc = useQueryClient()

  const { data, isLoading, error } = useQuery({
    queryKey: ["workouts", year, false],
    queryFn: () => listWorkouts({ year }),
  })

  const mut = useMutation({
    mutationFn: (id: string) => toggleIgnored(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workouts"] })
      qc.invalidateQueries({ queryKey: ["dashboard"] })
    },
  })

  if (isLoading) return <div className="rounded-2xl bg-white p-6 shadow-sm">Loading...</div>
  if (error) return <div className="rounded-2xl bg-white p-6 shadow-sm">Errore: {(error as Error).message}</div>

  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm">
      <div className="text-xl font-semibold">Allenamenti</div>
      <div className="mt-1 text-sm text-zinc-500">Lista workout non ignorati (toggle per ignorare)</div>

      <div className="mt-4 space-y-2">
        {data?.map(w => (
          <div key={w.id} className="flex items-center justify-between rounded-xl border border-zinc-100 p-3">
            <div>
              <div className="font-medium">{w.title || "Workout"}</div>
              <div className="text-xs text-zinc-500">
                {w.date ? new Date(w.date).toLocaleString() : "no date"}{" "}
                {w.duration_seconds ? `• ${Math.round(w.duration_seconds / 60)} min` : ""}
              </div>
            </div>

            <button
              className="rounded-lg bg-zinc-900 px-3 py-2 text-sm text-white disabled:opacity-50"
              onClick={() => mut.mutate(w.id)}
              disabled={mut.isPending}
            >
              Ignora
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
