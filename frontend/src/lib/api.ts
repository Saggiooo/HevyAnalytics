const API_BASE = import.meta.env.VITE_API_BASE ?? "http://127.0.0.1:8000";

async function handleRes(res: Response) {
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(txt || res.statusText);
  }
  return res.json();
}

/** Generic GET */
export function GET<T>(path: string): Promise<T> {
  return fetch(`${API_BASE}${path}`).then(handleRes);
}

/** Generic POST */
export function POST<T>(path: string, body?: any): Promise<T> {
  return fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: body ? JSON.stringify(body) : undefined,
  }).then(handleRes);
}

import type { Workout, WorkoutType } from "./types";


/** Workouts */
export function listWorkouts(params: { typeId?: number; includeIgnored?: boolean } = {}) {
  const q = new URLSearchParams();
  if (params.typeId) q.set("type_id", String(params.typeId));
  if (params.includeIgnored) q.set("includeIgnored", "true");
  return GET<Workout[]>(`/api/workouts?${q.toString()}`);
}

export function getWorkoutTypes() {
  return GET<WorkoutType[]>(`/api/workout-types`);
}

export function assignWorkoutType(workoutId: string, typeId: number | null) {
  return POST<{ ok: boolean }>(`/api/workout-types/assign`, {
    workout_id: workoutId,
    type_id: typeId,
  });
}

export function toggleIgnore(workoutId: string) {
  return POST<{ ok: boolean }>(`/api/ignored/${workoutId}`);
}
