import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { assignWorkoutType, getWorkoutTypes, listWorkouts, toggleIgnore } from "../lib/api";
import type { Workout, WorkoutType } from "../lib/types";
import { compareWorkouts, workoutTotalVolumeKg } from "../lib/workoutCompare";

type Props = {
  title?: string;
};

function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(String(iso));
  if (isNaN(d.getTime())) return String(iso);
  return d.toLocaleDateString("it-IT", { year: "numeric", month: "short", day: "2-digit" });
}

function fmtDur(sec?: number | null) {
  if (!sec || sec <= 0) return "—";
  const m = Math.round(sec / 60);
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return h > 0 ? `${h}h ${mm}m` : `${mm}m`;
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function Delta({ v, suffix = "" }: { v: number; suffix?: string }) {
  const good = v > 0;
  const bad = v < 0;
  const cls = good ? "text-emerald-300" : bad ? "text-rose-300" : "text-zinc-400";
  const sign = good ? "+" : "";
  return (
    <span className={cls}>
      {sign}
      {round2(v)}
      {suffix}
    </span>
  );
}

/**
 * IMPORTANT: il backend potrebbe non mandare `sets`.
 * Qui normalizziamo in modo super difensivo.
 */
function getSetsSafe(workout: any): any[] {
  const s =
    workout?.sets ??
    workout?.exercise_sets ??
    workout?.exerciseSets ??
    workout?.workout_sets ??
    [];
  return Array.isArray(s) ? s : [];
}

function uniqueExercisesCount(workout: any) {
  const sets = getSetsSafe(workout);
  const titles = sets.map((x) => String(x?.exercise_title ?? x?.exerciseTitle ?? "")).filter(Boolean);
  return new Set(titles).size;
}

function totalVolumeSafe(workout: any) {
  // se workoutCompare si aspetta `sets`, glieli “iniettiamo” senza mutare l’originale
  const w = workout ? ({ ...workout, sets: getSetsSafe(workout) } as Workout) : null;
  return w ? workoutTotalVolumeKg(w) : 0;
}

export function WorkoutsPage({ title = "Allenamenti" }: Props) {
  const qc = useQueryClient();
  const [typeId, setTypeId] = useState<number | "all">("all");
  const [includeIgnored, setIncludeIgnored] = useState(false);

  const typesQ = useQuery({
    queryKey: ["workout-types"],
    queryFn: () => getWorkoutTypes(),
  });

  const workoutsQ = useQuery<Workout[], Error>({
  queryKey: ["workouts", typeId, includeIgnored],
  queryFn: async () =>
    (await listWorkouts({
      typeId: typeId === "all" ? undefined : typeId,
      includeIgnored,
    })) as Workout[],
  initialData: [],
});

  const assignMut = useMutation({
    mutationFn: ({ workoutId, typeId }: { workoutId: string; typeId: number | null }) =>
      assignWorkoutType(workoutId, typeId),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["workouts"] });
    },
  });

  const ignoreMut = useMutation({
    mutationFn: (workoutId: string) => toggleIgnore(workoutId),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["workouts"] });
      await qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  const workouts = workoutsQ.data ?? [];
  const types = typesQ.data ?? [];

  // Ultimo e penultimo (già filtrati dal backend se passi typeId)
  const lastRaw = workouts[0] ?? null;
  const prevRaw = workouts[1] ?? null;

  const last = lastRaw ? ({ ...lastRaw, sets: getSetsSafe(lastRaw) } as Workout) : null;
  const prev = prevRaw ? ({ ...prevRaw, sets: getSetsSafe(prevRaw) } as Workout) : null;

  const [compareError, rows] = useMemo(() => {
    if (!last || !prev) return [null, []] as const;
    try {
      return [null, compareWorkouts(last, prev)] as const;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return [msg, []] as const;
    }
  }, [last, prev]);

  const lastVol = totalVolumeSafe(last);
  const prevVol = totalVolumeSafe(prev);

  if (workoutsQ.isLoading || typesQ.isLoading) {
    return <div className="card p-6">Loading workouts…</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="text-sm text-zinc-400">{title}</div>
          <h1 className="text-2xl font-semibold tracking-tight">Confronto & storico</h1>

          {workoutsQ.isError && (
            <div className="text-sm text-rose-300 mt-2">
              Errore API: {(workoutsQ.error as Error).message}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <select
            className="btn"
            value={typeId}
            onChange={(e) => setTypeId(e.target.value === "all" ? "all" : Number(e.target.value))}
          >
            <option value="all">Tutti i tipi</option>
            {types.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>

          <button
            className={`btn ${includeIgnored ? "bg-white/10" : ""}`}
            onClick={() => setIncludeIgnored((v) => !v)}
            title="Mostra anche gli ignorati"
          >
            {includeIgnored ? "Ignored: ON" : "Ignored: OFF"}
          </button>
        </div>
      </div>

      {/* Cards: ultimo vs precedente */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm text-zinc-400">Ultimo allenamento</div>
              <div className="font-semibold truncate">{last?.title ?? "—"}</div>
              <div className="text-xs text-zinc-500 mt-1">
                {last ? fmtDate(last.date) : "—"} • durata {fmtDur(last?.duration_seconds)} • volume{" "}
                {Math.round(lastVol).toLocaleString()} kg
              </div>
            </div>

            {last && (
              <button
                className="btn shrink-0"
                onClick={() => ignoreMut.mutate(last.id)}
                disabled={ignoreMut.isPending}
                title="Ignora / ripristina"
              >
                {last.ignored ? "Ripristina" : "Ignora"}
              </button>
            )}
          </div>

          <div className="mt-4 flex gap-2 flex-wrap">
            <span className="pill">Sets: {getSetsSafe(last).length || "—"}</span>
            <span className="pill">Esercizi: {uniqueExercisesCount(last) || "—"}</span>
          </div>

          {typeId === "all" && last && (
            <AssignTypeBlock
              workout={last}
              types={types}
              onAssign={(tid) => assignMut.mutate({ workoutId: last.id, typeId: tid })}
              busy={assignMut.isPending}
            />
          )}
        </div>

        <div className="card p-5">
          <div className="text-sm text-zinc-400">Precedente (stesso tipo)</div>
          <div className="font-semibold truncate">{prev?.title ?? "—"}</div>
          <div className="text-xs text-zinc-500 mt-1">
            {prev ? fmtDate(prev.date) : "—"} • durata {fmtDur(prev?.duration_seconds)} • volume{" "}
            {Math.round(prevVol).toLocaleString()} kg
          </div>

          <div className="mt-4 flex items-center justify-between gap-3">
            <div className="text-sm">
              Delta volume: <Delta v={lastVol - prevVol} suffix=" kg" />
            </div>
            {prev && (
              <button className="btn shrink-0" onClick={() => ignoreMut.mutate(prev.id)} disabled={ignoreMut.isPending}>
                {prev.ignored ? "Ripristina" : "Ignora"}
              </button>
            )}
          </div>

          {typeId === "all" && prev && (
            <AssignTypeBlock
              workout={prev}
              types={types}
              onAssign={(tid) => assignMut.mutate({ workoutId: prev.id, typeId: tid })}
              busy={assignMut.isPending}
            />
          )}
        </div>
      </section>

      {/* Tabella confronto */}
      <section className="card p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm text-zinc-400">Confronto esercizi</div>
            <div className="font-semibold">Best set + volume per esercizio</div>
          </div>
          <span className="pill">{rows.length} esercizi</span>
        </div>

        {!last || !prev ? (
          <div className="mt-6 text-zinc-500">
            Seleziona un tipo allenamento (A/B/…) con almeno 2 workout per vedere il confronto.
          </div>
        ) : compareError ? (
          <div className="mt-6 text-rose-300 text-sm">
            Crash evitato 😄: compareWorkouts ha lanciato un errore:
            <div className="mt-2 text-zinc-300">{compareError}</div>
            <div className="mt-2 text-zinc-500">
              Tipicamente succede se il backend non sta includendo i set nel payload dei workout.
            </div>
          </div>
        ) : (
          <div className="mt-4 overflow-auto">
            <table className="w-full text-sm">
              <thead className="text-zinc-400">
                <tr className="border-b border-white/10">
                  <th className="text-left py-3 pr-3">Esercizio</th>
                  <th className="text-right py-3 px-3">Ultimo best</th>
                  <th className="text-right py-3 px-3">Prec. best</th>
                  <th className="text-right py-3 px-3">Δ kg</th>
                  <th className="text-right py-3 px-3">Δ reps</th>
                  <th className="text-right py-3 pl-3">Δ volume</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.key} className="border-b border-white/5 hover:bg-white/5">
                    <td className="py-3 pr-3">
                      <div className="font-medium">{r.title}</div>
                      <div className="text-xs text-zinc-500">
                        Ultimo vol: {Math.round(r.last?.volume ?? 0).toLocaleString()} • Prec:{" "}
                        {Math.round(r.prev?.volume ?? 0).toLocaleString()}
                      </div>
                    </td>
                    <td className="py-3 px-3 text-right">{r.last ? `${r.last.bestW} kg × ${r.last.bestR}` : "—"}</td>
                    <td className="py-3 px-3 text-right">{r.prev ? `${r.prev.bestW} kg × ${r.prev.bestR}` : "—"}</td>
                    <td className="py-3 px-3 text-right">
                      <Delta v={r.deltaW} />
                    </td>
                    <td className="py-3 px-3 text-right">
                      <Delta v={r.deltaR} />
                    </td>
                    <td className="py-3 pl-3 text-right">
                      <Delta v={r.deltaV} suffix=" kg" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Lista workout filtrati */}
      <section className="card p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm text-zinc-400">Storico</div>
            <div className="font-semibold">Workouts ({workouts.length})</div>
          </div>
          {workoutsQ.isLoading && <span className="pill">loading...</span>}
        </div>

        <div className="mt-4 divide-y divide-white/10">
          {workouts.map((w) => {
            const setsCount = getSetsSafe(w).length;
            return (
              <div key={w.id} className="py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium truncate">
                    {w.title} {w.ignored && <span className="pill ml-2">ignored</span>}
                  </div>
                  <div className="text-xs text-zinc-500">
                    {fmtDate(w.date)} • durata {fmtDur(w.duration_seconds)} • sets {setsCount} • volume{" "}
                    {Math.round(totalVolumeSafe(w)).toLocaleString()} kg
                  </div>
                </div>

                <div className="flex gap-2 shrink-0">
                  <button className="btn" onClick={() => ignoreMut.mutate(w.id)} disabled={ignoreMut.isPending}>
                    {w.ignored ? "Ripristina" : "Ignora"}
                  </button>
                </div>
              </div>
            );
          })}

          {workouts.length === 0 && !workoutsQ.isLoading && (
            <div className="py-6 text-zinc-500">Nessun workout per questo filtro.</div>
          )}
        </div>
      </section>
    </div>
  );
}

function AssignTypeBlock({
  workout,
  types,
  onAssign,
  busy,
}: {
  workout: Workout;
  types: WorkoutType[];
  onAssign: (typeId: number | null) => void;
  busy: boolean;
}) {
  return (
    <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-between gap-3">
      <div className="text-sm text-zinc-400">Assegna tipo</div>
      <div className="flex gap-2">
        <select
          className="btn"
          value={workout.type_id ?? ""}
          onChange={(e) => onAssign(e.target.value ? Number(e.target.value) : null)}
          disabled={busy}
        >
          <option value="">Nessuno</option>
          {types.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

export default WorkoutsPage;
