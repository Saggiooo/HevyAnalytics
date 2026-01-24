import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { assignWorkoutType, getWorkoutTypes, listWorkouts, toggleIgnore } from "../lib/api";
import type { Workout, WorkoutType } from "../lib/types";
import { compareWorkouts, workoutTotalVolumeKg } from "../lib/workoutCompare";

function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
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

function Delta({ v, suffix = "" }: { v: number; suffix?: string }) {
  const good = v > 0;
  const bad = v < 0;
  const cls = good ? "text-emerald-300" : bad ? "text-rose-300" : "text-zinc-400";
  const sign = good ? "+" : "";
  const rounded = Math.round(v * 100) / 100;
  return <span className={cls}>{sign}{rounded}{suffix}</span>;
}

function safeVolume(w: Workout | null) {
  try {
    if (!w) return 0;
    // se workoutTotalVolumeKg fosse fragile, qui non rompiamo la pagina
    const v = workoutTotalVolumeKg(w);
    return Number.isFinite(v) ? v : 0;
  } catch {
    return 0;
  }
}

export function WorkoutsPage() {
  const qc = useQueryClient();
  const [typeId, setTypeId] = useState<number | "all">("all");
  const [includeIgnored, setIncludeIgnored] = useState(false);

  const typesQ = useQuery({
    queryKey: ["workout-types"],
    queryFn: () => getWorkoutTypes(),
    staleTime: 60_000,
  });

  const workoutsQ = useQuery({
    queryKey: ["workouts", typeId, includeIgnored],
    queryFn: () => listWorkouts({ typeId: typeId === "all" ? undefined : typeId, includeIgnored }),
    staleTime: 10_000,
  });

  const assignMut = useMutation({
    mutationFn: ({ workoutId, typeId }: { workoutId: string; typeId: number | null }) =>
      assignWorkoutType(workoutId, typeId),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["workouts"] });
      await qc.invalidateQueries({ queryKey: ["workout-types"] });
    },
  });

  const ignoreMut = useMutation({
    mutationFn: (workoutId: string) => toggleIgnore(workoutId),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["workouts"] });
      await qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  // Guard rails: mai più schermo nero
  if (typesQ.isLoading || workoutsQ.isLoading) {
    return <div className="card p-6">Loading workouts…</div>;
  }

  if (typesQ.isError || workoutsQ.isError) {
    const msg = String((workoutsQ.error as any)?.message || (typesQ.error as any)?.message || "Errore sconosciuto");
    return (
      <div className="card p-6">
        <div className="text-sm text-zinc-400">Allenamenti</div>
        <div className="text-xl font-semibold mt-1 text-rose-300">Errore nel caricamento</div>
        <div className="text-zinc-400 mt-2 text-sm break-words">{msg}</div>

        <div className="mt-4 flex gap-2">
          <button className="btn" onClick={() => qc.invalidateQueries({ queryKey: ["workouts"] })}>
            Riprova
          </button>
        </div>
      </div>
    );
  }

  const workouts = workoutsQ.data ?? [];
  const types = typesQ.data ?? [];

  // Ultimo e penultimo nello scope attuale (se filtri per type, arrivano già filtrati)
  const last = workouts[0] ?? null;
  const prev = workouts[1] ?? null;

  // Comparazione: se non ci sono sets, non deve crashare
  const rows = useMemo(() => {
    try {
      return compareWorkouts(last, prev);
    } catch {
      return [];
    }
  }, [last, prev]);

  const lastVol = safeVolume(last);
  const prevVol = safeVolume(prev);

  const lastHasSets = Array.isArray((last as any)?.sets) && (last as any).sets.length > 0;
  const prevHasSets = Array.isArray((prev as any)?.sets) && (prev as any).sets.length > 0;
  const canCompareExercises = Boolean(last && prev && lastHasSets && prevHasSets);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="text-sm text-zinc-400">Allenamenti</div>
          <h1 className="text-2xl font-semibold tracking-tight">Confronto & storico</h1>
        </div>

        <div className="flex items-center gap-2">
          <select
            className="btn"
            value={typeId}
            onChange={(e) => setTypeId(e.target.value === "all" ? "all" : Number(e.target.value))}
          >
            <option value="all">Tutti i tipi</option>
            {types.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
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
                {fmtDate((last as any)?.date ?? (last as any)?.start_time ?? null)}
                {" • "}
                durata {fmtDur((last as any)?.duration_seconds ?? null)}
                {" • "}
                volume {Math.round(lastVol).toLocaleString()} kg
              </div>
            </div>

            {last && (
              <button
                className="btn shrink-0"
                onClick={() => ignoreMut.mutate(last.id)}
                disabled={ignoreMut.isPending}
                title="Ignora / ripristina"
              >
                {(last as any).ignored ? "Ripristina" : "Ignora"}
              </button>
            )}
          </div>

          <div className="mt-4 flex gap-2 flex-wrap">
            <span className="pill">Sets: {lastHasSets ? (last as any).sets.length : "—"}</span>
            <span className="pill">
              Esercizi: {lastHasSets ? new Set(((last as any).sets ?? []).map((s: any) => s.exercise_title)).size : "—"}
            </span>
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
            {fmtDate((prev as any)?.date ?? (prev as any)?.start_time ?? null)}
            {" • "}
            durata {fmtDur((prev as any)?.duration_seconds ?? null)}
            {" • "}
            volume {Math.round(prevVol).toLocaleString()} kg
          </div>

          <div className="mt-4 flex items-center justify-between">
            <div className="text-sm">
              Delta volume: <Delta v={lastVol - prevVol} suffix=" kg" />
            </div>
            {prev && (
              <button className="btn" onClick={() => ignoreMut.mutate(prev.id)} disabled={ignoreMut.isPending}>
                {(prev as any).ignored ? "Ripristina" : "Ignora"}
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
        <div className="flex items-center justify-between">
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
        ) : !canCompareExercises ? (
          <div className="mt-6 text-zinc-500">
            Per confrontare gli esercizi mi servono i <span className="text-zinc-300">sets</span> nei workout.
            Al momento l’API interna sembra tornare workout “light”.
            <div className="mt-2 text-xs text-zinc-500">
              Soluzione: aggiungere endpoint dettaglio workout (es. <span className="text-zinc-300">GET /api/workouts/{`{id}`}</span>) oppure includere sets per last/prev.
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
                    <td className="py-3 px-3 text-right">
                      {r.last ? `${r.last.bestW} kg × ${r.last.bestR}` : "—"}
                    </td>
                    <td className="py-3 px-3 text-right">
                      {r.prev ? `${r.prev.bestW} kg × ${r.prev.bestR}` : "—"}
                    </td>
                    <td className="py-3 px-3 text-right"><Delta v={r.deltaW} /></td>
                    <td className="py-3 px-3 text-right"><Delta v={r.deltaR} /></td>
                    <td className="py-3 pl-3 text-right"><Delta v={r.deltaV} suffix=" kg" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Lista workout filtrati */}
      <section className="card p-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-zinc-400">Storico</div>
            <div className="font-semibold">Workouts ({workouts.length})</div>
          </div>
        </div>

        <div className="mt-4 divide-y divide-white/10">
          {workouts.map((w) => {
            const vol = safeVolume(w);
            return (
              <div key={w.id} className="py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium truncate">
                    {w.title} {(w as any).ignored && <span className="pill ml-2">ignored</span>}
                  </div>
                  <div className="text-xs text-zinc-500">
                    {fmtDate((w as any)?.date ?? (w as any)?.start_time ?? null)}
                    {" • "}
                    durata {fmtDur((w as any)?.duration_seconds ?? null)}
                    {" • "}
                    volume {Math.round(vol).toLocaleString()} kg
                  </div>
                </div>

                <div className="flex gap-2 shrink-0">
                  <button className="btn" onClick={() => ignoreMut.mutate(w.id)} disabled={ignoreMut.isPending}>
                    {(w as any).ignored ? "Ripristina" : "Ignora"}
                  </button>
                </div>
              </div>
            );
          })}

          {workouts.length === 0 && (
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
          value={(workout as any).type_id ?? ""}
          onChange={(e) => onAssign(e.target.value ? Number(e.target.value) : null)}
          disabled={busy}
        >
          <option value="">Nessuno</option>
          {types.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
