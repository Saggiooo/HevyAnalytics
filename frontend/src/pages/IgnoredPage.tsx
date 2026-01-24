import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { listWorkouts, toggleIgnored } from "../lib/api"

export default function IgnoredPage() {
  const year = new Date().getFullYear()
  const qc = useQueryClient()

  const { data, isLoading, error } = useQuery({
    queryKey: ["workouts", year, true],
    queryFn: () => listWorkouts({ year, includeIgnored: true }),
  })

  const ignored = (data || []).filter(x => x.ignored)

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
      <div className="text-xl font-semibold">Ignored</div>
      <div className="mt-1 text-sm text-zinc-500">Workout ignorati, ripristinabili</div>

      <div className="mt-4 space-y-2">
        {ignored.map(w => (
          <div key={w.id} className="flex items-center justify-between rounded-xl border border-zinc-100 p-3">
            <div>
              <div className="font-medium">{w.title || "Workout"}</div>
              <div className="text-xs text-zinc-500">
                {w.date ? new Date(w.date).toLocaleString() : "no date"}
              </div>
            </div>

            <button
              className="rounded-lg border border-zinc-200 px-3 py-2 text-sm hover:bg-zinc-50 disabled:opacity-50"
              onClick={() => mut.mutate(w.id)}
              disabled={mut.isPending}
            >
              Ripristina
            </button>
          </div>
        ))}
        {ignored.length === 0 && (
          <div className="text-sm text-zinc-500">Nessun workout ignorato.</div>
        )}
      </div>
    </div>
  )
}
