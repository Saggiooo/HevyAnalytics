const API_BASE = import.meta.env.VITE_API_BASE ?? "http://127.0.0.1:8000/api";

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

// src/lib/api.ts
import type { DashboardSummary } from "./types";

export async function getDashboardSummary(year?: number): Promise<DashboardSummary> {
  const qs = year ? `?year=${year}` : "";
  return GET(`/dashboard${qs}`) as Promise<DashboardSummary>;
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
export function listWorkouts(params?: {
  year?: number;
  typeId?: number;
  includeIgnored?: boolean;
}) {
  const qs = new URLSearchParams();
  if (params?.year) qs.set("year", String(params.year));
  if (params?.typeId) qs.set("typeId", String(params.typeId));
  if (params?.includeIgnored) qs.set("includeIgnored", "true");

  const query = qs.toString();
  return GET(`/workouts${query ? `?${query}` : ""}`);
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

export async function getWorkout(workoutId: string): Promise<Workout> {
  const r = await fetch(`${import.meta.env.VITE_API_URL}/api/workouts/${workoutId}`);
  if (!r.ok) throw new Error(`getWorkout failed: ${r.status}`);
  return r.json();
}


