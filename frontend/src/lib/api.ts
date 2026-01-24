const API_BASE = "http://localhost:8000/api"

export type DashboardSummary = {
  year: number
  workouts_count: number
  training_days: number
  total_volume_kg: number
  unique_exercises: number
  pr_count: number
  volume_by_month: number[]
  workouts_by_month: number[]
}

export type Workout = {
  id: string
  title: string
  date: string | null
  duration_seconds: number | null
  ignored: boolean
  type_id: number | null
}

export async function getDashboardSummary(year: number): Promise<DashboardSummary> {
  const r = await fetch(`${API_BASE}/dashboard/summary?year=${year}`)
  if (!r.ok) throw new Error(await r.text())
  return r.json()
}

export async function listWorkouts(params: {
  year?: number
  includeIgnored?: boolean
}): Promise<Workout[]> {
  const q = new URLSearchParams()
  if (params.year) q.set("year", String(params.year))
  if (params.includeIgnored) q.set("includeIgnored", "true")
  const r = await fetch(`${API_BASE}/workouts?${q.toString()}`)
  if (!r.ok) throw new Error(await r.text())
  return r.json()
}

export async function toggleIgnored(workoutId: string) {
  const r = await fetch(`${API_BASE}/ignored/${workoutId}`, { method: "POST" })
  if (!r.ok) throw new Error(await r.text())
  return r.json()
}
