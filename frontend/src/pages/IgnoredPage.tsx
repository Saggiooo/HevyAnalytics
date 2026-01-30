import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listWorkouts, toggleIgnore } from "../lib/api";
import type { Workout } from "../lib/types";

type ToggleIgnoreResult = { ok: boolean };

function fmtDateTime(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("it-IT", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function IgnoredPage() {
  const qc = useQueryClient();

  const q = useQuery<Workout[], Error>({
    queryKey: ["workouts", "ignored"],
    queryFn: async () => (await listWorkouts({ includeIgnored: true })) as Workout[],
    initialData: [],
  });

  const ignored = (q.data ?? []).filter((w) => Boolean(w.ignored));

  const restoreMut = useMutation<ToggleIgnoreResult, Error, string>({
    mutationFn: (id: string) => toggleIgnore(id) as Promise<ToggleIgnoreResult>,
    onSuccess: async () => {
      // Refresh both lists and dashboards that depend on ignored flag
      await qc.invalidateQueries({ queryKey: ["workouts"] });
      await qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="text-sm text-zinc-400">Allenamenti</div>
          <h1 className="text-2xl font-semibold tracking-tight">Elenco allenamenti nascosti</h1>
          <div className="mt-1 text-sm text-zinc-500">
            Lista degli allenamenti ignorati perché non validi, non completi o altro. Puoi ripristinarli con un click.
          </div>
        </div>

        <div className="flex items-center gap-2">
          {q.isLoading && <span className="pill">loading…</span>}
          <span className="pill">{ignored.length} ignorati</span>
        </div>
      </div>

      {q.isError && (
        <div className="card p-5">
          <div className="text-sm text-rose-300">Errore: {q.error.message}</div>
        </div>
      )}

      <section className="card p-5">
        {q.isLoading && ignored.length === 0 ? (
          <div className="text-zinc-500">Carico gli ignorati…</div>
        ) : ignored.length === 0 ? (
          <div className="text-zinc-500">Nessun workout ignorato. Bravo, sei un uomo di pace ✨</div>
        ) : (
          <div className="divide-y divide-white/10">
            {ignored.map((w) => (
              <div key={w.id} className="py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium truncate">
                    {w.title || "Workout"} <span className="pill ml-2">ignored</span>
                  </div>
                  <div className="text-xs text-zinc-500">
                    {fmtDateTime(w.date)}
                    {typeof w.duration_seconds === "number" && w.duration_seconds > 0 ? (
                      <>
                        {" "}• durata {Math.round(w.duration_seconds / 60)}m
                      </>
                    ) : null}
                  </div>
                </div>

                <div className="shrink-0 flex items-center gap-2">
                  <button
                    className="btn"
                    onClick={() => restoreMut.mutate(w.id)}
                    disabled={restoreMut.isPending}
                    title="Ripristina questo allenamento"
                  >
                    Ripristina
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
