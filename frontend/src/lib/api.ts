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
  return POST<{ ok: boolean }>(`/ignored/${workoutId}`);
}

export async function getWorkout(workoutId: string): Promise<Workout> {
  const r = await fetch(`${import.meta.env.VITE_API_URL}/api/workouts/${workoutId}`);
  if (!r.ok) throw new Error(`getWorkout failed: ${r.status}`);
  return r.json();
}

import type { ExerciseCatalogRow, ExerciseUpdateIn } from "./types";


export async function listExercises(): Promise<ExerciseCatalogRow[]> {
  const res = await fetch(`${API_BASE}/exercises`);
  if (!res.ok) throw new Error(`GET /exercises failed (${res.status})`);
  return (await res.json()) as ExerciseCatalogRow[];
}

export async function updateExercise(exerciseId: number, payload: ExerciseUpdateIn): Promise<ExerciseCatalogRow> {
  const res = await fetch(`${API_BASE}/exercises/${exerciseId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`PATCH /exercises/${exerciseId} failed (${res.status})`);
  return (await res.json()) as ExerciseCatalogRow;
}

import type { AnalysisSummary } from "./types";


export async function getAnalysisSummary(params: { from: string; to: string }): Promise<AnalysisSummary> {
  const qs = new URLSearchParams({ from: params.from, to: params.to });
  const res = await fetch(`${API_BASE}/analysis/summary?${qs.toString()}`);
  if (!res.ok) throw new Error(`GET /analysis/summary failed (${res.status})`);
  return (await res.json()) as AnalysisSummary;
}


export async function getExerciseProgress(params: {
  templateId: string;
  from: string;
  to: string;
}) {
  const { templateId, from, to } = params;
  const res = await fetch(
    `${API_BASE}/exercises/${encodeURIComponent(templateId)}/progress?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
  );
  if (!res.ok) throw new Error(`GET /exercises/${templateId}/progress failed (${res.status})`);
  return res.json();
}