import { useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { listWorkouts } from "../lib/api";
import type { Workout } from "../lib/types";
import { compareWorkouts, workoutTotalVolumeKg } from "../lib/workoutCompare";

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

function getSetsSafe(workout: any) {
  const s = workout?.sets ?? workout?.exercise_sets ?? workout?.exerciseSets ?? [];
  return Array.isArray(s) ? s : [];
}

function uniqueExercisesCount(workout: any) {
  const sets = getSetsSafe(workout);
  const titles = sets.map((x: any) => String(x?.exercise_title ?? "")).filter(Boolean);
  return new Set(titles).size;
}

async function getWorkoutDetail(workoutId: string): Promise<WorkoutDetail> {
  const res = await fetch(`${API_BASE}/api/workouts/${encodeURIComponent(workoutId)}`);
  if (!res.ok) throw new Error(`GET /api/workouts/${workoutId} failed (${res.status})`);
  return (await res.json()) as WorkoutDetail;
}

function titleOf(w: Workout) {
  return (w.title || "").trim() || "Senza titolo";
}

function Delta({ v, suffix = "" }: { v: number; suffix?: string }) {
  const good = v > 0;
  const bad = v < 0;
  const cls = good ? "text-emerald-300" : bad ? "text-rose-300" : "text-zinc-400";
  const sign = good ? "+" : "";
  return <span className={cls}>{sign}{Math.round(v * 100) / 100}{suffix}</span>;
}

function BestSetCell({ w, r, variant }: { w?: number | null; r?: number | null; variant: "last" | "prev" }) {
  const has = typeof w === "number" && typeof r === "number";
  const base = "inline-flex items-center justify-end rounded-xl px-3 py-2 min-w-[120px] border";
  const lastCls = "bg-emerald-500/12 border-emerald-400/30";
  const prevCls = "bg-white/5 border-white/10";

  return (
    <div className={`${base} ${variant === "last" ? lastCls : prevCls}`}>
      {!has ? (
        <div className="text-zinc-500">—</div>
      ) : (
        <div className="flex items-baseline gap-2">
          <span className="text-lg font-semibold text-white">{Math.round(w * 100) / 100}</span>
          <span className="text-xs text-zinc-400">kg</span>
          <span className="text-zinc-500">×</span>
          <span className="text-xl font-semibold text-white">{r}</span>
        </div>
      )}
    </div>
  );
}

export function WorkoutDetailPage() {
  const { id } = useParams<{ id: string }>();
  const workoutId = id || "";

  // 1) Dettaglio del workout cliccato
  const targetQ = useQuery<WorkoutDetail, Error>({
    queryKey: ["workout-detail", workoutId],
    queryFn: () => getWorkoutDetail(workoutId),
    enabled: !!workoutId,
  });

  const target = targetQ.data ?? null;

  // 2) Lista light per trovare “most recent dello stesso tipo”
  const listQ = useQuery<Workout[], Error>({
    queryKey: ["workouts", true], // includeIgnored true per non sputtanare l’ordinamento
    queryFn: async () => (await listWorkouts({ includeIgnored: true })) as Workout[],
    initialData: [],
  });

  const workouts = listQ.data ?? [];

  // 3) Trova il most recent dello stesso titolo, ESCLUDENDO quello target
  const recentSameTypeLight = useMemo(() => {
    if (!target) return null;
    const tTitle = titleOf(target);
    const same = workouts.filter((w) => titleOf(w) === tTitle && w.id !== target.id);
    return same[0] ?? null; // sono già ordinati desc dal backend
  }, [workouts, target]);

  // 4) Dettaglio del most recent
  const recentQ = useQuery<WorkoutDetail, Error>({
    queryKey: ["workout-detail", recentSameTypeLight?.id],
    queryFn: () => getWorkoutDetail(recentSameTypeLight!.id),
    enabled: !!recentSameTypeLight?.id,
  });

  const recent = recentQ.data ?? null;

  // 5) Confronto: recent (last) vs target (prev)
  const rows = useMemo(() => {
    if (!recent || !target) return [];
    const wl = { ...(recent as any), sets: getSetsSafe(recent) } as Workout;
    const wp = { ...(target as any), sets: getSetsSafe(target) } as Workout;
    return compareWorkouts(wl, wp);
  }, [recent, target]);

  const targetVol = target ? workoutTotalVolumeKg({ ...(target as any), sets: getSetsSafe(target) }) : 0;
  const recentVol = recent ? workoutTotalVolumeKg({ ...(recent as any), sets: getSetsSafe(recent) }) : 0;

  if (targetQ.isLoading) return <div className="card p-6">Carico workout…</div>;
  if (targetQ.isError) return <div className="card p-6 text-rose-300">Errore: {targetQ.error.message}</div>;
  if (!target) return <div className="card p-6">Workout non trovato.</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm text-zinc-400">
            <Link className="hover:underline" to="/workouts">← Allenamenti</Link>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight mt-1">
            {titleOf(target)}
          </h1>
          <div className="text-sm text-zinc-500 mt-1">
            {fmtDate(target.date)} • durata {fmtDur(target.duration_seconds)}
          </div>
        </div>

        <div className="pill bg-white/5 border border-white/10">
          ID: <span className="text-zinc-300">{target.id.slice(0, 8)}…</span>
        </div>
      </div>

      {/* BOX */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="card p-4">
          <div className="text-xs text-zinc-400">Sets</div>
          <div className="text-2xl font-semibold mt-1">{getSetsSafe(target).length}</div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-zinc-400">Esercizi</div>
          <div className="text-2xl font-semibold mt-1">{uniqueExercisesCount(target)}</div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-zinc-400">Durata</div>
          <div className="text-2xl font-semibold mt-1">{fmtDur(target.duration_seconds)}</div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-zinc-400">Volume</div>
          <div className="text-2xl font-semibold mt-1">{Math.round(targetVol).toLocaleString()} kg</div>
        </div>
      </section>

      {/* Header confronto */}
      <section className="card p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm text-zinc-400">Confronto</div>
            <div className="font-semibold mt-1">
              Most recent stesso tipo vs questo workout
            </div>
            {!recentSameTypeLight && (
              <div className="text-sm text-zinc-500 mt-2">
                Non esiste un altro workout dello stesso tipo da confrontare.
              </div>
            )}
          </div>

          {recent && (
            <div className="text-right">
              <div className="text-xs text-zinc-400">Delta volume</div>
              <div className="text-sm mt-1">
                <Delta v={recentVol - targetVol} suffix=" kg" />
              </div>
            </div>
          )}
        </div>

        {/* Tabella */}
        {!recentSameTypeLight ? null : recentQ.isLoading ? (
          <div className="mt-6 text-zinc-500">Carico il workout più recente…</div>
        ) : recentQ.isError ? (
          <div className="mt-6 text-rose-300">Errore: {recentQ.error.message}</div>
        ) : rows.length === 0 ? (
          <div className="mt-6 text-zinc-500">Nessun dato per confronto (sets vuoti o titoli esercizi mancanti).</div>
        ) : (
          <div className="mt-4 overflow-auto">
            <table className="w-full text-sm">
              <thead className="text-zinc-400">
                <tr className="border-b border-white/10">
                  <th className="text-left py-3 pr-3">Esercizio</th>
                  <th className="text-right py-3 px-3">Most recent</th>
                  <th className="text-right py-3 px-3">Questo</th>
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
                        Recent vol: {Math.round(r.last?.volume ?? 0).toLocaleString()} • Questo: {Math.round(r.prev?.volume ?? 0).toLocaleString()}
                      </div>
                    </td>

                    <td className="py-3 px-3 text-right">
                      <BestSetCell variant="last" w={r.last?.bestW ?? null} r={r.last?.bestR ?? null} />
                    </td>

                    <td className="py-3 px-3 text-right">
                      <BestSetCell variant="prev" w={r.prev?.bestW ?? null} r={r.prev?.bestR ?? null} />
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
    </div>
  );
}

export default WorkoutDetailPage;