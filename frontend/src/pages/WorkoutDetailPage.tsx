import { useMemo, useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { listWorkouts } from "../lib/api";
import type { Workout } from "../lib/types";
import { workoutTotalVolumeKg } from "../lib/workoutCompare";

type WorkoutDetail = Workout & {
  sets?: Array<{
    exercise_title?: string | null;
    exercise_template_id?: string | null;
    set_index?: number | null;
    weight_kg?: number | null;
    reps?: number | null;
    distance_meters?: number | null;
    duration_seconds?: number | null;
    set_type?: string | null;
  }>;
};

const API_BASE = (import.meta as any).env?.VITE_API_URL || "http://127.0.0.1:8000";

/** ✅ PRESET ORDER (template_id) */
const PRESET_ORDER: Array<{ id: string; name: string }> = [
  { name: "Streaching", id: "527DA061" },
  { name: "Piegamenti", id: "392887AA" },
  { name: "Panca Piana (Bilanciere)", id: "79D0BB3A" },
  { name: "Panca Inclinata (Manubrio)", id: "07B38369" },
  { name: "Croci ai Cavi", id: "651F844C" },
  { name: "Pushdown Tricipiti", id: "93A552C6" },
  { name: "Estensione Tricipiti (Cavo)", id: "21310F5F" },
  { name: "Skullcrusher (Manubrio)", id: "68F8A292" },
  { name: "Trazione", id: "1B2B1E7C" },
  { name: "Lat pulldown - Presa Stretta (Cavo)", id: "4E5257DE" },
  { name: "Pulldown Inginocchiato (Banda)", id: "D82EA543" },
  { name: "Rematore Inclinato (Bilanciere)", id: "55E6546F" },
  { name: "Lento in Avanti (Smith Machine)", id: "B09A1304" },
  { name: "Alzata laterale con cavo a braccio singolo", id: "DE68C825" },
  { name: "Curl Bicipiti Inclinato da Seduto (Manubrio)", id: "8BAB2735" },
  { name: "Curl Bicipiti (Manubrio)", id: "37FCC2BB" },
  { name: "Hammer Curl (Dumbbell)", id: "7E3BC8B6" },
  { name: "Crunch", id: "DCF3B31B" },
  { name: "Crunch Inverso", id: "7952B5CD" },
  { name: "Ruota Addominali", id: "99D5F10E" },
];

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

type NormSet = {
  exercise: string;
  templateId: string | null;
  idx: number;
  w: number | null;
  r: number | null;
  v: number; // volume per set
};

function normSets(workout: any): NormSet[] {
  const sets = getSetsSafe(workout);
  const out: NormSet[] = [];

  for (let i = 0; i < sets.length; i++) {
    const s: any = sets[i];
    const exercise = String(s?.exercise_title ?? "").trim();
    if (!exercise) continue;

    const tIdRaw = s?.exercise_template_id ?? s?.exerciseTemplateId ?? s?.exercise_template ?? null;
    const templateId = tIdRaw ? String(tIdRaw).trim() : null;

    const idxRaw = s?.set_index ?? s?.setIndex ?? s?.set ?? s?.index;
    const idx = typeof idxRaw === "number" && isFinite(idxRaw) ? idxRaw : i + 1;

    const w = typeof s?.weight_kg === "number" ? s.weight_kg : typeof s?.weightKg === "number" ? s.weightKg : null;
    const r = typeof s?.reps === "number" ? s.reps : typeof s?.rep_count === "number" ? s.rep_count : null;

    const v = (typeof w === "number" ? w : 0) * (typeof r === "number" ? r : 0);

    out.push({
      exercise,
      templateId: templateId || null,
      idx,
      w: typeof w === "number" ? w : null,
      r: typeof r === "number" ? r : null,
      v,
    });
  }

  // stable order: by exercise then set index
  out.sort((a, b) => {
    if (a.exercise < b.exercise) return -1;
    if (a.exercise > b.exercise) return 1;
    return a.idx - b.idx;
  });

  return out;
}

function groupByExercise(sets: NormSet[]) {
  const map = new Map<string, NormSet[]>();
  for (const s of sets) {
    const arr = map.get(s.exercise) ?? [];
    arr.push(s);
    map.set(s.exercise, arr);
  }
  for (const [k, arr] of map) {
    arr.sort((a, b) => a.idx - b.idx);
    map.set(k, arr);
  }
  return map;
}

type SetRow = {
  key: string;
  idx: number;
  last?: NormSet;
  prev?: NormSet;
  deltaW: number;
  deltaR: number;
  deltaV: number;
};

type ExerciseBlock = {
  exercise: string;
  templateId: string | null;
  rows: SetRow[];
  lastCount: number;
  prevCount: number;
  lastVol: number;
  prevVol: number;
};

function buildExerciseBlocks(lastWorkout: any, prevWorkout: any): ExerciseBlock[] {
  const lastSets = groupByExercise(normSets(lastWorkout));
  const prevSets = groupByExercise(normSets(prevWorkout));

  const exercises = new Set<string>([...lastSets.keys(), ...prevSets.keys()]);
  const blocks: ExerciseBlock[] = [];

  for (const exercise of Array.from(exercises).sort((a, b) => a.localeCompare(b))) {
    const lArr = lastSets.get(exercise) ?? [];
    const pArr = prevSets.get(exercise) ?? [];

    const templateId =
      lArr.find((x) => x.templateId)?.templateId ??
      pArr.find((x) => x.templateId)?.templateId ??
      null;

    const idxs = new Set<number>([...lArr.map((x) => x.idx), ...pArr.map((x) => x.idx)]);
    const idxList = Array.from(idxs).sort((a, b) => a - b);

    const lBy = new Map<number, NormSet>();
    const pBy = new Map<number, NormSet>();
    for (const s of lArr) lBy.set(s.idx, s);
    for (const s of pArr) pBy.set(s.idx, s);

    const rows: SetRow[] = idxList.map((idx) => {
      const last = lBy.get(idx);
      const prev = pBy.get(idx);

      const lw = last?.w ?? 0;
      const pw = prev?.w ?? 0;
      const lr = last?.r ?? 0;
      const pr = prev?.r ?? 0;
      const lv = last?.v ?? 0;
      const pv = prev?.v ?? 0;

      return {
        key: `${exercise}-${idx}`,
        idx,
        last,
        prev,
        deltaW: lw - pw,
        deltaR: lr - pr,
        deltaV: lv - pv,
      };
    });

    const lastVol = lArr.reduce((acc, s) => acc + (s.v || 0), 0);
    const prevVol = pArr.reduce((acc, s) => acc + (s.v || 0), 0);

    blocks.push({
      exercise,
      templateId,
      rows,
      lastCount: lArr.length,
      prevCount: pArr.length,
      lastVol,
      prevVol,
    });
  }

  return blocks;
}

function orderBlocks(blocks: ExerciseBlock[], order: string[]) {
  const pos = new Map<string, number>();
  order.forEach((id, i) => pos.set(id, i));

  return [...blocks].sort((a, b) => {
    const ai = a.templateId ? pos.get(a.templateId) : undefined;
    const bi = b.templateId ? pos.get(b.templateId) : undefined;

    const aHas = typeof ai === "number";
    const bHas = typeof bi === "number";

    if (aHas && bHas) return (ai as number) - (bi as number);
    if (aHas && !bHas) return -1;
    if (!aHas && bHas) return 1;

    // fallback: alpha
    return a.exercise.localeCompare(b.exercise);
  });
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
  return (
    <span className={cls}>
      {sign}
      {Math.round(v * 100) / 100}
      {suffix}
    </span>
  );
}

function SetCell({ w, r, variant }: { w?: number | null; r?: number | null; variant: "last" | "prev" }) {
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
    queryKey: ["workouts", true],
    queryFn: async () => (await listWorkouts({ includeIgnored: true })) as Workout[],
    initialData: [],
  });

  const workouts = listQ.data ?? [];

  // 3) Trova recentOther e prevOlder
  const recentSameTypeLight = useMemo(() => {
    if (!target) return null;
    const tTitle = titleOf(target);
    const same = workouts.filter((w) => titleOf(w) === tTitle);
    const idx = same.findIndex((w) => w.id === target.id);

    const recentOther = same.find((w) => w.id !== target.id) ?? null;
    const prevOlder = idx >= 0 ? (same[idx + 1] ?? null) : null;

    return { recentOther, prevOlder };
  }, [workouts, target]);

  const recentOtherLight = recentSameTypeLight?.recentOther ?? null;
  const prevOlderLight = recentSameTypeLight?.prevOlder ?? null;

  // 4) Dettagli: recentOther + prevOlder
  const recentQ = useQuery<WorkoutDetail, Error>({
    queryKey: ["workout-detail", recentOtherLight?.id],
    queryFn: () => getWorkoutDetail(recentOtherLight!.id),
    enabled: !!recentOtherLight?.id,
  });

  const prevQ = useQuery<WorkoutDetail, Error>({
    queryKey: ["workout-detail", prevOlderLight?.id],
    queryFn: () => getWorkoutDetail(prevOlderLight!.id),
    enabled: !!prevOlderLight?.id,
  });

  const recent = recentQ.data ?? null;
  const prevOlder = prevQ.data ?? null;

  // 5) Confronti raw
  const rawBlocksTargetVsPrev = useMemo(() => {
    if (!target || !prevOlder) return [] as ExerciseBlock[];
    return buildExerciseBlocks(target, prevOlder);
  }, [target, prevOlder]);

  const rawBlocksRecentVsTarget = useMemo(() => {
    if (!recent || !target) return [] as ExerciseBlock[];
    return buildExerciseBlocks(recent, target);
  }, [recent, target]);

  /** =========================
   *  ORDER UI STATE
   *  ========================= */
  const [exerciseOrder, setExerciseOrder] = useState<string[]>(() => PRESET_ORDER.map((x) => x.id));
  const [selectedExerciseId, setSelectedExerciseId] = useState<string>("");

  // quando i blocks cambiano, se selected è vuoto prova a selezionare il primo disponibile
  useEffect(() => {
    if (selectedExerciseId) return;

    const ids = Array.from(
      new Set(
        [...rawBlocksTargetVsPrev, ...rawBlocksRecentVsTarget]
          .map((b) => b.templateId)
          .filter((x): x is string => !!x)
      )
    );

    if (ids.length) setSelectedExerciseId(ids[0]);
  }, [rawBlocksTargetVsPrev, rawBlocksRecentVsTarget, selectedExerciseId]);

  const presetIds = useMemo(() => PRESET_ORDER.map((x) => x.id), []);

  function applyPreset() {
    setExerciseOrder(presetIds);
    // seleziona il primo del preset, se esiste
    if (presetIds.length) setSelectedExerciseId(presetIds[0]);
  }

  function moveSelected(dir: "up" | "down") {
    const id = selectedExerciseId;
    if (!id) return;

    setExerciseOrder((prev) => {
      const arr = [...prev];
      const idx = arr.indexOf(id);
      if (idx < 0) return arr;

      const swapWith = dir === "up" ? idx - 1 : idx + 1;
      if (swapWith < 0 || swapWith >= arr.length) return arr;

      const tmp = arr[swapWith];
      arr[swapWith] = arr[idx];
      arr[idx] = tmp;
      return arr;
    });
  }

  const blocksTargetVsPrev = useMemo(() => {
    return orderBlocks(rawBlocksTargetVsPrev, exerciseOrder);
  }, [rawBlocksTargetVsPrev, exerciseOrder]);

  const blocksRecentVsTarget = useMemo(() => {
    return orderBlocks(rawBlocksRecentVsTarget, exerciseOrder);
  }, [rawBlocksRecentVsTarget, exerciseOrder]);

  const targetVol = target ? workoutTotalVolumeKg({ ...(target as any), sets: getSetsSafe(target) }) : 0;
  const prevOlderVol = prevOlder ? workoutTotalVolumeKg({ ...(prevOlder as any), sets: getSetsSafe(prevOlder) }) : 0;
  const recentVol = recent ? workoutTotalVolumeKg({ ...(recent as any), sets: getSetsSafe(recent) }) : 0;

  if (targetQ.isLoading) return <div className="card p-6">Carico workout…</div>;
  if (targetQ.isError) return <div className="card p-6 text-rose-300">Errore: {targetQ.error.message}</div>;
  if (!target) return <div className="card p-6">Workout non trovato.</div>;

  const dropdownItems = PRESET_ORDER;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm text-zinc-400">
            <Link className="hover:underline" to="/workouts">
              ← Allenamenti
            </Link>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight mt-1">{titleOf(target)}</h1>
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

      {/* ORDER CONTROLS */}
      <section className="card p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-sm text-zinc-400">Ordine esercizi</div>
            <div className="text-xs text-zinc-500 mt-1">
              Questo ordine viene usato in entrambe le tabelle (confronti). Modifica con Su/Giù oppure applica preset.
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
            <select
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-white/20"
              value={selectedExerciseId}
              onChange={(e) => setSelectedExerciseId(e.target.value)}
            >
              {dropdownItems.map((it) => (
                <option key={it.id} value={it.id}>
                  {it.name}
                </option>
              ))}
            </select>

            <div className="flex gap-2">
              <button className="btn" onClick={() => moveSelected("up")} disabled={!selectedExerciseId}>
                ↑ Su
              </button>
              <button className="btn" onClick={() => moveSelected("down")} disabled={!selectedExerciseId}>
                ↓ Giù
              </button>
              <button className="btn btn-primary" onClick={applyPreset}>
                Ordine preset
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Confronto 1: Questo vs precedente */}
      <section className="card p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm text-zinc-400">Confronto</div>
            <div className="font-semibold mt-1">Questo workout VS precedente</div>

            {prevOlderLight ? (
              <div className="text-sm text-zinc-500 mt-2">
                Precedente: <span className="text-zinc-300">{fmtDate(prevOlderLight.date)}</span>
              </div>
            ) : (
              <div className="text-sm text-zinc-500 mt-2">Non esiste un workout precedente dello stesso tipo da confrontare.</div>
            )}
          </div>

          {prevOlder && (
            <div className="text-right">
              <div className="text-xs text-zinc-400">Delta volume</div>
              <div className="text-sm mt-1">
                <Delta v={targetVol - prevOlderVol} suffix=" kg" />
              </div>
            </div>
          )}
        </div>

        {!prevOlderLight ? null : prevQ.isLoading ? (
          <div className="mt-6 text-zinc-500">Carico il workout precedente…</div>
        ) : prevQ.isError ? (
          <div className="mt-6 text-rose-300">Errore: {prevQ.error.message}</div>
        ) : blocksTargetVsPrev.length === 0 ? (
          <div className="mt-6 text-zinc-500">Nessun dato per confronto (sets vuoti o titoli esercizi mancanti).</div>
        ) : (
          <div className="mt-5 space-y-4">
            {blocksTargetVsPrev.map((b) => (
              <div key={`${b.exercise}-${b.templateId ?? "na"}`} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold">{b.exercise}</div>
                    <div className="text-xs text-zinc-400 mt-1">
                      Volume questo: {Math.round(b.lastVol).toLocaleString()} • Precedente: {Math.round(b.prevVol).toLocaleString()}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="pill bg-emerald-500/15 border border-emerald-400/25">questo: {b.lastCount} sets</span>
                    <span className="pill bg-white/5 border border-white/10">precedente: {b.prevCount} sets</span>
                  </div>
                </div>

                <div className="mt-3 overflow-auto">
                  <table className="w-full text-sm">
                    <thead className="text-zinc-400">
                      <tr className="border-b border-white/10">
                        <th className="text-left py-3 pr-3">Set</th>
                        <th className="text-right py-3 px-3">Questo</th>
                        <th className="text-right py-3 px-3">Precedente</th>
                        <th className="text-right py-3 px-3">Δ kg</th>
                        <th className="text-right py-3 px-3">Δ reps</th>
                        <th className="text-right py-3 pl-3">Δ volume</th>
                      </tr>
                    </thead>
                    <tbody>
                      {b.rows.map((r) => (
                        <tr key={r.key} className="border-b border-white/5 hover:bg-white/5">
                          <td className="py-3 pr-3">
                            <div className="font-medium">#{r.idx}</div>
                            <div className="text-xs text-zinc-500">
                              questo vol: {Math.round(r.last?.v ?? 0).toLocaleString()} • prec:{" "}
                              {Math.round(r.prev?.v ?? 0).toLocaleString()}
                            </div>
                          </td>

                          <td className="py-3 px-3 text-right">
                            <SetCell variant="last" w={r.last?.w ?? null} r={r.last?.r ?? null} />
                          </td>

                          <td className="py-3 px-3 text-right">
                            <SetCell variant="prev" w={r.prev?.w ?? null} r={r.prev?.r ?? null} />
                          </td>

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
              </div>
            ))}
          </div>
        )}
      </section>
      <div className="h-6">
      </div>
      {/* Confronto 2: Most recent stesso tipo vs questo */}
      <section className="card p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm text-zinc-400">Confronto con ultimo</div>
            <div className="font-semibold mt-1">Workout più recente VS Questo Workout</div>
            {!recentOtherLight && <div className="text-sm text-zinc-500 mt-2">Non esiste un altro workout dello stesso tipo da confrontare.</div>}
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

        {!recentOtherLight ? null : recentQ.isLoading ? (
          <div className="mt-6 text-zinc-500">Carico il workout più recente…</div>
        ) : recentQ.isError ? (
          <div className="mt-6 text-rose-300">Errore: {recentQ.error.message}</div>
        ) : blocksRecentVsTarget.length === 0 ? (
          <div className="mt-6 text-zinc-500">Nessun dato per confronto (sets vuoti o titoli esercizi mancanti).</div>
        ) : (
          <div className="mt-5 space-y-4">
            {blocksRecentVsTarget.map((b) => (
              <div key={`${b.exercise}-${b.templateId ?? "na"}`} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold">{b.exercise}</div>
                    <div className="text-xs text-zinc-400 mt-1">
                      Volume recent: {Math.round(b.lastVol).toLocaleString()} • Questo: {Math.round(b.prevVol).toLocaleString()}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="pill bg-emerald-500/15 border border-emerald-400/25">recent: {b.lastCount} sets</span>
                    <span className="pill bg-white/5 border border-white/10">questo: {b.prevCount} sets</span>
                  </div>
                </div>

                <div className="mt-3 overflow-auto">
                  <table className="w-full text-sm">
                    <thead className="text-zinc-400">
                      <tr className="border-b border-white/10">
                        <th className="text-left py-3 pr-3">Set</th>
                        <th className="text-right py-3 px-3">Most recent</th>
                        <th className="text-right py-3 px-3">Questo</th>
                        <th className="text-right py-3 px-3">Δ kg</th>
                        <th className="text-right py-3 px-3">Δ reps</th>
                        <th className="text-right py-3 pl-3">Δ volume</th>
                      </tr>
                    </thead>
                    <tbody>
                      {b.rows.map((r) => (
                        <tr key={r.key} className="border-b border-white/5 hover:bg-white/5">
                          <td className="py-3 pr-3">
                            <div className="font-medium">#{r.idx}</div>
                            <div className="text-xs text-zinc-500">
                              recent vol: {Math.round(r.last?.v ?? 0).toLocaleString()} • questo:{" "}
                              {Math.round(r.prev?.v ?? 0).toLocaleString()}
                            </div>
                          </td>

                          <td className="py-3 px-3 text-right">
                            <SetCell variant="last" w={r.last?.w ?? null} r={r.last?.r ?? null} />
                          </td>

                          <td className="py-3 px-3 text-right">
                            <SetCell variant="prev" w={r.prev?.w ?? null} r={r.prev?.r ?? null} />
                          </td>

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
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export default WorkoutDetailPage;