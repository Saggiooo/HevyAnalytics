import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listWorkouts, toggleIgnore } from "../lib/api";
import type { Workout } from "../lib/types";
import { compareWorkouts, workoutTotalVolumeKg } from "../lib/workoutCompare";
import { Link } from "react-router-dom";

type Props = {
  title?: string;
};

type WorkoutDetail = Workout & {
  sets?: Array<{
    exercise_title?: string | null;
    weight_kg?: number | null;
    reps?: number | null;
    distance_meters?: number | null;
    duration_seconds?: number | null;
    set_type?: string | null;
  }>;
};

const API_BASE = (import.meta as any).env?.VITE_API_URL || "http://127.0.0.1:8000";

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

async function getWorkoutDetail(workoutId: string): Promise<WorkoutDetail> {
  const res = await fetch(`${API_BASE}/api/workouts/${encodeURIComponent(workoutId)}`);
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`GET /api/workouts/${workoutId} failed (${res.status}) ${txt}`);
  }
  return (await res.json()) as WorkoutDetail;
}

function getSetsSafe(workout: any) {
  const s = workout?.sets ?? workout?.exercise_sets ?? workout?.exerciseSets ?? [];
  return Array.isArray(s) ? s : [];
}

function uniqueExercisesCount(workout: any) {
  const sets = getSetsSafe(workout);
  const titles = sets.map((x: any) => String(x?.exercise_title ?? "")).filter(Boolean);
  return new Set(titles).size;
}

function volumeSafe(workout: any) {
  if (!workout) return 0;
  const w = { ...workout, sets: getSetsSafe(workout) } as Workout;
  return workoutTotalVolumeKg(w);
}

function titleOf(w: Workout) {
  return (w.title || "").trim() || "Senza titolo";
}

export function WorkoutsPage({ title = "Allenamenti" }: Props) {
  const qc = useQueryClient();

  const [includeIgnored, setIncludeIgnored] = useState(false);
  const [titleFilter, setTitleFilter] = useState<string>("all");

  // 1) lista light
  const workoutsQ = useQuery<Workout[], Error>({
    queryKey: ["workouts", includeIgnored],
    queryFn: async () => {
      const data = await listWorkouts({ includeIgnored });
      return (data ?? []) as Workout[];
    },
    initialData: [],
  });

  const workouts = workoutsQ.data ?? [];

  // 2) tipi = titoli
  const titleOptions = useMemo(() => {
    const set = new Set<string>();
    for (const w of workouts) set.add(titleOf(w));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [workouts]);

  // auto-selezione: se non hai ancora scelto, piglia il primo titolo disponibile
  const effectiveTitleFilter = titleFilter;

  // 3) filtra e prendi ultimo/penultimo di quel titolo
  const filtered = useMemo(() => {
    if (effectiveTitleFilter === "all") return workouts;
    return workouts.filter((w) => titleOf(w) === effectiveTitleFilter);
  }, [workouts, effectiveTitleFilter]);

  const lastLight = filtered[0] ?? null;
  const prevLight = filtered[1] ?? null;

  // 4) detail per last/prev
  const lastDetailQ = useQuery<WorkoutDetail, Error>({
    queryKey: ["workout-detail", lastLight?.id],
    queryFn: () => getWorkoutDetail(lastLight!.id),
    enabled: !!lastLight?.id,
  });

  const prevDetailQ = useQuery<WorkoutDetail, Error>({
    queryKey: ["workout-detail", prevLight?.id],
    queryFn: () => getWorkoutDetail(prevLight!.id),
    enabled: !!prevLight?.id,
  });

  const last = lastDetailQ.data ?? null;
  const prev = prevDetailQ.data ?? null;

  // 5) confronto
  const [compareError, rows] = useMemo(() => {
    if (!last || !prev) return [null, []] as const;
    try {
      const wl = { ...(last as any), sets: getSetsSafe(last) } as Workout;
      const wp = { ...(prev as any), sets: getSetsSafe(prev) } as Workout;
      return [null, compareWorkouts(wl, wp)] as const;
    } catch (e) {
      return [e instanceof Error ? e.message : String(e), []] as const;
    }
  }, [last, prev]);

  const lastVol = volumeSafe(last);
  const prevVol = volumeSafe(prev);

  const ignoreMut = useMutation<void, Error, string, { snapshots: Array<[readonly unknown[], unknown]> }>(
    {
      mutationFn: async (workoutId: string) => {
        await toggleIgnore(workoutId);
      },
      // Optimistic update: così il workout sparisce/subito cambia stato senza aspettare il refetch
      onMutate: async (workoutId: string) => {
        // stop refetch in flight
        await qc.cancelQueries({ queryKey: ["workouts"] });

        // snapshot di tutte le cache che iniziano con ["workouts"]
        const snapshots = qc.getQueriesData({ queryKey: ["workouts"] });

        // aggiorna tutte le liste cached
        for (const [key, value] of snapshots) {
          if (!Array.isArray(value)) continue;

          const arr = value as Workout[];
          const idx = arr.findIndex((w) => w.id === workoutId);
          if (idx === -1) continue;

          const current = arr[idx];
          const nextIgnored = !current.ignored;

          // se la query NON include ignorati, quando diventa ignored lo rimuoviamo dalla lista
          // se invece torna attivo, lo lasciamo dentro (comparirà solo dopo il refetch, ma non rompe)
          const includeIgnoredForThisQuery = Array.isArray(key) && key.length >= 2 ? Boolean((key as any)[1]) : false;

          let nextArr: Workout[];
          if (!includeIgnoredForThisQuery && nextIgnored) {
            nextArr = arr.filter((w) => w.id !== workoutId);
          } else {
            nextArr = arr.map((w) => (w.id === workoutId ? { ...w, ignored: nextIgnored } : w));
          }

          qc.setQueryData(key, nextArr);
        }

        // aggiorna anche i dettagli se presenti
        qc.setQueriesData({ queryKey: ["workout-detail"] }, (old: any) => {
          if (!old || typeof old !== "object") return old;
          if (old.id !== workoutId) return old;
          return { ...old, ignored: !old.ignored };
        });

        return { snapshots };
      },
      onError: (_err, _id, ctx) => {
        // rollback cache
        if (!ctx?.snapshots) return;
        for (const [key, value] of ctx.snapshots) {
          qc.setQueryData(key, value);
        }
      },
      onSettled: async () => {
        // refetch vero (così torna tutto coerente)
        await qc.invalidateQueries({ queryKey: ["workouts"] });
        await qc.invalidateQueries({ queryKey: ["dashboard"] });
        await qc.invalidateQueries({ queryKey: ["workout-detail"] });
      },
    }
  );

  const loadingTop = workoutsQ.isLoading || lastDetailQ.isLoading || prevDetailQ.isLoading;

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="text-sm text-zinc-400">{title}</div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Confronto per tipo: <span className="text-zinc-200">{effectiveTitleFilter === "all" ? "Tutti" : effectiveTitleFilter}</span>
          </h1>

          {workoutsQ.isError && (
            <div className="text-sm text-rose-300 mt-2">
              Errore lista: {(workoutsQ.error as Error).message}
            </div>
          )}
          {(lastDetailQ.isError || prevDetailQ.isError) && (
            <div className="text-sm text-rose-300 mt-2">
              Errore dettaglio: {(lastDetailQ.error as any)?.message || (prevDetailQ.error as any)?.message}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <select
            className="btn"
            value={titleFilter}
            onChange={(e) => setTitleFilter(e.target.value)}
            title="Seleziona tipo allenamento"
          >
            <option value="all">Tutti</option>

            {titleOptions.map((t) => (
              <option key={t} value={t}>
                {t}
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
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs uppercase tracking-wide text-zinc-500">Ultimo</div>
              <div className="mt-1 font-semibold text-zinc-100 truncate">
                {lastLight?.title ?? "—"}
              </div>
              <div className="text-xs text-zinc-500 mt-1">
                {fmtDate(lastLight?.date)}
                <span className="mx-2 text-zinc-600">•</span>
                volume {last ? Math.round(lastVol).toLocaleString() : "—"} kg
              </div>
            </div>

            {lastLight && (
              <button
                className="btn shrink-0"
                onClick={() => ignoreMut.mutate(lastLight.id)}
                disabled={ignoreMut.isPending}
                title="Ignora / ripristina"
              >
                {lastLight.ignored ? "Ripristina" : "Ignora"}
              </button>
            )}
          </div>

          <div className="mt-4 flex gap-2 flex-wrap items-center">
            <span className="pill">Sets: {last ? getSetsSafe(last).length : "—"}</span>
            <span className="pill">Esercizi: {last ? uniqueExercisesCount(last) : "—"}</span>
            <span className="pill bg-sky-500/15 text-sky-200 border border-sky-400/20">
              Durata: {fmtDur(lastLight?.duration_seconds)}
            </span>
          </div>

          <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-between">
            <div className="text-sm text-zinc-400">Stato</div>
            <div className="text-sm">
              {lastLight?.ignored ? (
                <span className="pill bg-rose-500/15 text-rose-200 border border-rose-400/20">Ignored</span>
              ) : (
                <span className="pill bg-emerald-500/12 text-emerald-200 border border-emerald-400/20">Attivo</span>
              )}
            </div>
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs uppercase tracking-wide text-zinc-500">Penultimo</div>
              <div className="mt-1 font-semibold text-zinc-100 truncate">
                {prevLight?.title ?? "—"}
              </div>
              <div className="text-xs text-zinc-500 mt-1">
                {fmtDate(prevLight?.date)}
                <span className="mx-2 text-zinc-600">•</span>
                volume {prev ? Math.round(prevVol).toLocaleString() : "—"} kg
              </div>
            </div>

            {prevLight && (
              <button
                className="btn shrink-0"
                onClick={() => ignoreMut.mutate(prevLight.id)}
                disabled={ignoreMut.isPending}
                title="Ignora / ripristina"
              >
                {prevLight.ignored ? "Ripristina" : "Ignora"}
              </button>
            )}
          </div>

          <div className="mt-4 flex gap-2 flex-wrap items-center">
            <span className="pill">Sets: {prev ? getSetsSafe(prev).length : "—"}</span>
            <span className="pill">Esercizi: {prev ? uniqueExercisesCount(prev) : "—"}</span>
            <span className="pill bg-sky-500/15 text-sky-200 border border-sky-400/20">
              Durata: {fmtDur(prevLight?.duration_seconds)}
            </span>
          </div>

          <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-between gap-3">
            <div className="text-sm text-zinc-400">Delta volume vs ultimo</div>
            <div className="text-sm">
              <Delta v={lastVol - prevVol} suffix=" kg" />
            </div>
          </div>
        </div>
      </section>

      {/* Tabella confronto */}
      <section className="card p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm text-zinc-400">Confronto esercizi</div>
            <div className="font-semibold">Best set + volume per esercizio</div>
          </div>
          {loadingTop ? <span className="pill">loading...</span> : <span className="pill">{rows.length} esercizi</span>}
        </div>

        {effectiveTitleFilter === "all" ? (
  <div className="mt-6 text-zinc-500">
    Seleziona un tipo di allenamento per vedere il confronto.
  </div>
) : !lastLight || !prevLight ? (
          <div className="mt-6 text-zinc-500">
            Questo tipo ha meno di 2 allenamenti. Scegline uno che ne abbia almeno 2.
          </div>
        ) : loadingTop ? (
          <div className="mt-6 text-zinc-500">Carico dettagli dei due workout…</div>
        ) : compareError ? (
          <div className="mt-6 text-rose-300 text-sm">
            compareWorkouts ha crashato: <span className="text-zinc-200">{compareError}</span>
          </div>
        ) : rows.length === 0 ? (
          <div className="mt-6 text-zinc-500">
            Tabella vuota: significa che dai dettagli non stanno arrivando set validi (o exercise_title vuoto).
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
                 <tr
  key={r.key}
  className={`border-b border-white/5 hover:bg-white/5 ${
    r.deltaW > 0 ? "bg-emerald-500/5" : ""
  }`}
>
                    <td className="py-3 pr-3">
                      <div className="font-medium">{r.title}</div>
                      <div className="text-xs text-zinc-500">
                        Ultimo vol: {Math.round(r.last?.volume ?? 0).toLocaleString()} • Prec:{" "}
                        {Math.round(r.prev?.volume ?? 0).toLocaleString()}
                      </div>
                    </td>
                   <td className="py-3 px-3 text-right">
  <BestSetCell
    label=""
    variant="last"
    w={r.last?.bestW ?? null}
    r={r.last?.bestR ?? null}
  />
</td>

<td className="py-3 px-3 text-right">
  <BestSetCell
    label=""
    variant="prev"
    w={r.prev?.bestW ?? null}
    r={r.prev?.bestR ?? null}
  />
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

      {/* Storico (light) */}
      <section className="card p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm text-zinc-400">Storico</div>
            <div className="font-semibold">Workouts ({filtered.length})</div>
          </div>
          {workoutsQ.isLoading && <span className="pill">loading...</span>}
        </div>

        <div className="mt-4 divide-y divide-white/10">
          {filtered.map((w: Workout) => (
  <Link
    key={w.id}
    to={`/workouts/${w.id}`}
    className="block py-3 hover:bg-white/5 rounded-xl -mx-2 px-2"
  >
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="font-medium truncate">
          {w.title} {w.ignored && <span className="pill ml-2">ignored</span>}
        </div>
        <div className="text-xs text-zinc-500">
          {fmtDate(w.date)} • durata {fmtDur(w.duration_seconds)}
        </div>
      </div>

      <div className="flex gap-2 shrink-0">
        <button
          className="btn"
          onClick={(e) => {
            e.preventDefault(); // IMPORTANT: evita di navigare quando clicchi ignora
            ignoreMut.mutate(w.id);
          }}
          disabled={ignoreMut.isPending}
        >
          {w.ignored ? "Ripristina" : "Ignora"}
        </button>
      </div>
    </div>
  </Link>
))}

          {filtered.length === 0 && !workoutsQ.isLoading && (
            <div className="py-6 text-zinc-500">Nessun workout per questo filtro.</div>
          )}
        </div>
      </section>
    </div>
  );
}
function BestSetCell({
  label,
  w,
  r,
  variant, // "last" | "prev"
}: {
  label?: string;
  w?: number | null;
  r?: number | null;
  variant: "last" | "prev";
}) {
  const has = typeof w === "number" && typeof r === "number";

  const base =
    "inline-flex flex-col items-end justify-center rounded-xl px-3 py-2 min-w-[92px] sm:min-w-[104px] border";
  const lastCls = "bg-emerald-500/12 border-emerald-400/30";
  const prevCls = "bg-white/5 border-white/10";

  return (
    <div className={`${base} ${variant === "last" ? lastCls : prevCls}`}>
      {label && (
        <div className="text-[10px] uppercase tracking-wide text-zinc-400 mb-1">
          {label}
        </div>
      )}

      {!has ? (
        <div className="text-zinc-500">—</div>
      ) : (
       <>
        <div className="flex items-baseline gap-1">
          <span className="text-lg font-semibold text-white">
            {Math.round(w * 100) / 100}
          </span>
          <span className="text-xs text-zinc-400">kg</span>

          <span className="mx-1 text-zinc-500">×</span>

          <span className="text-xl font-semibold text-white">
            {r}
          </span>
        </div>
      </>
      )}
    </div>
  );
}

export default WorkoutsPage;