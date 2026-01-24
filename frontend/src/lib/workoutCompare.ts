import type { Workout, WorkoutSet } from "./types";

function norm(s: string) {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

export function setVolumeKg(s: WorkoutSet) {
  const w = s.weight_kg ?? 0;
  const r = s.reps ?? 0;
  return w > 0 && r > 0 ? w * r : 0;
}

export function workoutTotalVolumeKg(w: Workout) {
  const sets = Array.isArray(w.sets) ? w.sets : [];
  return sets.reduce((acc, s) => acc + setVolumeKg(s), 0);
}


export function bestSet(sets: WorkoutSet[]) {
  // “best” = max weight, tie-break max reps, tie-break max volume
  return sets.reduce((best, s) => {
    if (!best) return s;
    const bw = best.weight_kg ?? 0, sw = s.weight_kg ?? 0;
    const br = best.reps ?? 0, sr = s.reps ?? 0;
    const bv = setVolumeKg(best), sv = setVolumeKg(s);
    if (sw !== bw) return sw > bw ? s : best;
    if (sr !== br) return sr > br ? s : best;
    return sv > bv ? s : best;
  }, null as WorkoutSet | null);
}

export type ExerciseRow = {
  key: string; // template_id or normalized title
  title: string;

  last?: { bestW: number; bestR: number; volume: number };
  prev?: { bestW: number; bestR: number; volume: number };

  deltaW: number;
  deltaR: number;
  deltaV: number;
};

function groupByExercise(sets: WorkoutSet[]) {
  const map = new Map<string, WorkoutSet[]>();
  for (const s of sets) {
    const key = (s.exercise_template_id && String(s.exercise_template_id)) || norm(s.exercise_title);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(s);
  }
  return map;
}

export function compareWorkouts(last: Workout | null, prev: Workout | null): ExerciseRow[] {
  const lastMap = groupByExercise(last?.sets ?? []);
  const prevMap = groupByExercise(prev?.sets ?? []);

  const allKeys = new Set<string>([...lastMap.keys(), ...prevMap.keys()]);
  const rows: ExerciseRow[] = [];

  for (const key of allKeys) {
    const lsets = lastMap.get(key) ?? [];
    const psets = prevMap.get(key) ?? [];

    const lBest = bestSet(lsets);
    const pBest = bestSet(psets);

    const lastVol = lsets.reduce((a, s) => a + setVolumeKg(s), 0);
    const prevVol = psets.reduce((a, s) => a + setVolumeKg(s), 0);

    const title = lsets[0]?.exercise_title || psets[0]?.exercise_title || key;

    const lw = lBest?.weight_kg ?? 0;
    const lr = lBest?.reps ?? 0;
    const pw = pBest?.weight_kg ?? 0;
    const pr = pBest?.reps ?? 0;

    rows.push({
      key,
      title,
      last: last ? { bestW: lw, bestR: lr, volume: lastVol } : undefined,
      prev: prev ? { bestW: pw, bestR: pr, volume: prevVol } : undefined,
      deltaW: lw - pw,
      deltaR: lr - pr,
      deltaV: lastVol - prevVol,
    });
  }

  // ordina: prima chi ha deltaV alto, poi titolo
  rows.sort((a, b) => (b.deltaV - a.deltaV) || a.title.localeCompare(b.title));
  return rows;
}