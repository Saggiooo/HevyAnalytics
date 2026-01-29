import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listWorkouts, toggleIgnore } from "../lib/api";
import type { Workout } from "../lib/types";

type ToggleIgnoreResult = { ok: boolean };

export default function IgnoredPage() {
  const qc = useQueryClient();

  const {
    data,
    isLoading,
    error,
  } = useQuery<Workout[], Error>({
    queryKey: ["workouts", "ignored"],
    // listWorkouts nel tuo repo è Promise<unknown> (o non tipizzata),
    // quindi qui la "convertiamo" a Promise<Workout[]>
    queryFn: async () => (await listWorkouts({ includeIgnored: true })) as Workout[],
    initialData: [], // così data è SEMPRE array e filter/map funzionano
  });

  const ignored = data.filter((w: Workout) => w.ignored);

  const mut = useMutation<ToggleIgnoreResult, Error, string>({
    // toggleIgnore ritorna Promise<{ ok: boolean }>
    mutationFn: (id: string) => toggleIgnore(id) as Promise<ToggleIgnoreResult>,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["workouts"] });
      await qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  if (isLoading) {
    return <div className="rounded-2xl bg-white p-6 shadow-sm">Loading...</div>;
  }

  if (error) {
    return (
      <div className="rounded-2xl bg-white p-6 shadow-sm">
        Errore: {error.message}
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm">
      <div className="text-xl font-semibold">Ignored</div>
      <div className="mt-1 text-sm text-zinc-500">
        Workout ignorati, ripristinabili
      </div>

      <div className="mt-4 space-y-2">
        {ignored.map((w: Workout) => (
          <div
            key={w.id}
            className="flex items-center justify-between rounded-xl border border-zinc-100 p-3"
          >
            <div className="min-w-0">
              <div className="font-medium truncate">{w.title || "Workout"}</div>
              <div className="text-xs text-zinc-500">
                {w.date ? new Date(w.date).toLocaleString("it-IT") : "no date"}
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
  );
}
