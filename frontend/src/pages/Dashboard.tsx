import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { StatCard } from "../ui/StatCard";

// Fallback base URL (dev + electron). You can override with VITE_API_BASE
const API_BASE = (import.meta as any).env?.VITE_API_BASE || "http://127.0.0.1:8000/api";

type DashboardSummary = {
  year: number;
  workouts_count: number;
  training_days: number;
  total_volume_kg: number;
  unique_exercises: number;
  pr_count: number;
  volume_by_month: number[];
  workouts_by_month: number[];
};

type WorkoutLite = {
  id: string;
  title: string;
  date: string;
  duration_seconds?: number | null;
  ignored: boolean;
  type_id?: number | null;
};

const MONTHS_IT = [
  "gen",
  "feb",
  "mar",
  "apr",
  "mag",
  "giu",
  "lug",
  "ago",
  "set",
  "ott",
  "nov",
  "dic",
];

function apiUrl(path: string) {
  return `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
}

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(apiUrl(path));
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return (await res.json()) as T;
}

function fmtHours(totalSeconds: number) {
  const h = totalSeconds / 3600;
  // "7" instead of "7.0"
  const rounded = Math.round(h * 10) / 10;
  return Number.isInteger(rounded) ? String(Math.trunc(rounded)) : String(rounded);
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function dayKey(d: Date) {
  // YYYY-MM-DD
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays(d: Date, days: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

function getIntensity(seconds: number) {
  // 0..3
  // < 1h: 1
  // 1h..1h25: 2
  // >= 1h25: 3
  if (!seconds || seconds <= 0) return 0;
  if (seconds < 3600) return 1;
  if (seconds < 5100) return 2; // 1h25m
  return 3;
}

function HeatLegend() {
  return (
    <div className="flex items-center gap-2 text-xs text-zinc-500">
      <span>meno</span>
      <span className="heat heat-0" />
      <span className="heat heat-1" />
      <span className="heat heat-2" />
      <span className="heat heat-3" />
      <span>più</span>
    </div>
  );
}

export function Dashboard() {
  const now = new Date();
  const defaultYear = now.getFullYear();
  const [year, setYear] = useState<number>(defaultYear);

  // Years dropdown: take available years from workouts (including ignored)
  const yearsQ = useQuery({
    queryKey: ["workouts-years"],
    queryFn: () => fetchJson<WorkoutLite[]>("/workouts?includeIgnored=true"),
    staleTime: 60_000,
  });

  const availableYears = useMemo(() => {
    const rows = yearsQ.data ?? [];
    const ys = new Set<number>();
    for (const w of rows) {
      const d = new Date(w.date);
      if (!isNaN(d.getTime())) ys.add(d.getFullYear());
    }
    // fallback: show current year at least
    if (ys.size === 0) ys.add(defaultYear);
    return Array.from(ys).sort((a, b) => b - a);
  }, [yearsQ.data, defaultYear]);

  // Summary cards + bar data
  const summaryQ = useQuery({
    queryKey: ["dashboard-summary", year],
    queryFn: () => fetchJson<DashboardSummary>(`/dashboard/summary?year=${year}`),
  });

  // Workouts list for pie + heatmap (non ignored)
  const workoutsQ = useQuery({
    queryKey: ["dashboard-workouts", year],
    queryFn: () => fetchJson<WorkoutLite[]>(`/workouts?year=${year}`),
  });

  const summary = summaryQ.data;
  const workouts = workoutsQ.data ?? [];

  const totalHours = useMemo(() => {
    const sec = workouts.reduce((acc, w) => acc + (w.duration_seconds || 0), 0);
    return fmtHours(sec);
  }, [workouts]);

  const workoutsByMonth = useMemo(() => {
    const src = summary?.workouts_by_month ?? new Array(12).fill(0);
    return MONTHS_IT.map((m, i) => ({ month: m, workouts: src[i] ?? 0 }));
  }, [summary]);

  const typesPie = useMemo(() => {
    // type = title (Allenamento A/B/...) and ignore ignored by API already
    const map = new Map<string, number>();
    for (const w of workouts) {
      const k = (w.title || "Workout").trim() || "Workout";
      map.set(k, (map.get(k) || 0) + 1);
    }
    const rows = Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
    return rows;
  }, [workouts]);

  const heat = useMemo(() => {
    const start = new Date(year, 0, 1);
    const end = new Date(year + 1, 0, 1);

    // Aggregate max duration per day (if multiple workouts same day)
    const byDay = new Map<string, number>();
    for (const w of workouts) {
      const d = new Date(w.date);
      if (isNaN(d.getTime())) continue;
      const key = dayKey(d);
      const sec = w.duration_seconds || 0;
      byDay.set(key, Math.max(byDay.get(key) || 0, sec));
    }

    // GitHub style grid: weeks columns, 7 rows (Mon..Sun)
    // Align grid to Monday before Jan 1
    const jan1 = startOfDay(start);
    const dow = (jan1.getDay() + 6) % 7; // Monday=0
    const gridStart = addDays(jan1, -dow);

    const days: { date: Date; key: string; intensity: number; inYear: boolean }[] = [];
    for (let d = gridStart; d < end; d = addDays(d, 1)) {
      const key = dayKey(d);
      const inYear = d.getFullYear() === year;
      const sec = byDay.get(key) || 0;
      days.push({ date: d, key, intensity: inYear ? getIntensity(sec) : 0, inYear });
    }

    const weeks: typeof days[] = [];
    for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));

    // Month labels positioned by first week index of each month
    const monthAtWeek: { label: string; weekIndex: number }[] = [];
    for (let m = 0; m < 12; m++) {
      const first = new Date(year, m, 1);
      const diffDays = Math.round((startOfDay(first).getTime() - gridStart.getTime()) / 86400000);
      const weekIndex = Math.floor(diffDays / 7);
      monthAtWeek.push({ label: MONTHS_IT[m].toUpperCase(), weekIndex });
    }

    return { weeks, monthAtWeek };
  }, [workouts, year]);

  const loading = summaryQ.isLoading || workoutsQ.isLoading;
  const error = (summaryQ.error as Error | undefined) || (workoutsQ.error as Error | undefined);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="text-sm text-zinc-400">Dashboard</div>
          <h1 className="text-2xl font-semibold tracking-tight">{year}</h1>
          {error && (
            <div className="text-sm text-rose-300 mt-2">Errore: {error.message}</div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="btn inline-flex items-center gap-2">
            <span className="text-zinc-400">Anno</span>
            <select
              className="bg-transparent outline-none"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
            >
              {availableYears.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {loading && <div className="card p-6">Loading…</div>}

      {!loading && summary && (
        <>
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard title="Allenamenti" value={summary.workouts_count} icon="🏋️" subtitle="YTD" />
            <StatCard title="Totale ore" value={totalHours} icon="🗓️" subtitle="YTD" />
            <StatCard
              title="Volume totale (kg)"
              value={Math.round(summary.total_volume_kg).toLocaleString()}
              icon="📦"
              subtitle="Somma (peso × reps)"
            />
            <StatCard title="Esercizi unici" value={summary.unique_exercises} icon="🧩" subtitle="YTD" />
          </section>

          <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="card p-5 lg:col-span-2">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-zinc-400">Numero di allenamenti per mese</div>
                  <div className="font-semibold">Workout per mese</div>
                </div>
                <span className="pill">#</span>
              </div>

              <div className="mt-4 h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={workoutsByMonth} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <XAxis dataKey="month" tick={{ fill: "#A1A1AA", fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "#A1A1AA", fontSize: 12 }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{
                        background: "rgba(24,24,27,.95)",
                        border: "1px solid rgba(255,255,255,.1)",
                        borderRadius: 12,
                        color: "#fff",
                      }}
                      labelStyle={{ color: "#fff" }}
                      itemStyle={{ color: "#fff" }}
                      cursor={{ fill: "rgba(255,255,255,.04)" }}
                    />
                    <Bar dataKey="workouts" radius={[10, 10, 10, 10]} fill="#2563EB" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="card p-5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-zinc-400">Tipologia di allenamento</div>
                  <div className="font-semibold">Distribuzione (no ignored)</div>
                </div>
                <span className="pill">%</span>
              </div>

              <div className="mt-4 h-64">
                {typesPie.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-zinc-500">Nessun dato</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={typesPie}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={55}
                        outerRadius={88}
                        paddingAngle={2}
                        stroke="none"
                        strokeWidth={0}
                      >
                        {typesPie.map((_, idx) => (
                          <Cell
                            key={idx}
                            stroke="none"
                            strokeWidth={0}
                            // A few nice, consistent hues. (recharts needs explicit colors)
                            fill={[
                              "#2563EB",
                              "#7C3AED",
                              "#F59E0B",
                              "#10B981",
                              "#EF4444",
                              "#06B6D4",
                            ][idx % 6]}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          background: "rgba(24,24,27,.95)",
                          border: "1px solid rgba(255,255,255,.1)",
                          borderRadius: 12,
                          color: "#fff",
                        }}
                        labelStyle={{ color: "#fff" }}
                        itemStyle={{ color: "#fff" }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* tiny legend */}
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-zinc-400">
                {typesPie.slice(0, 6).map((t, idx) => (
                  <div key={t.name} className="flex items-center gap-2 min-w-0">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded"
                      style={{ background: ["#2563EB", "#7C3AED", "#F59E0B", "#10B981", "#EF4444", "#06B6D4"][idx % 6] }}
                    />
                    <span className="truncate">{t.name}</span>
                    <span className="ml-auto text-zinc-500">{t.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="card p-5">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-zinc-400">Calendario allenamenti</div>
                <div className="font-semibold">Heatmap annuale (intensità = durata)</div>
              </div>
              <HeatLegend />
            </div>

            <div className="mt-4 overflow-x-auto">
              <div className="min-w-[980px]">
                {/* month labels */}
                <div className="relative" style={{ paddingLeft: 48, height: 16 }}>
                  {heat.monthAtWeek.map((m) => (
                    <div
                      key={m.label}
                      className="absolute text-xs text-zinc-500"
                      style={{ left: 48 + m.weekIndex * 16.4, top: 0 }}
                    >
                      {m.label}
                    </div>
                  ))}
                </div>

                <div className="flex gap-1">
                  {/* week day labels */}
                  <div className="w-12 pr-2 text-xs text-zinc-500 leading-[14px]">
                    <div className="h-[14px]" />
                    <div className="h-[28px]">Mon</div>
                    <div className="h-[28px]">Wed</div>
                    <div className="h-[28px]">Fri</div>
                  </div>

                  <div className="flex gap-1">
                    {heat.weeks.map((week, wi) => (
                      <div key={wi} className="flex flex-col gap-1">
                        {week.map((d) => (
                          <div
                            key={d.key}
                            title={d.inYear ? d.key : ""}
                            className={`heat heat-${clamp(d.intensity, 0, 3)}`}
                          />
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <style>{`
              .heat{height:12px;width:12px;border-radius:3px;border:1px solid rgba(255,255,255,.06)}
              .heat-0{background:rgba(255,255,255,.04)}
              .heat-1{background:rgba(59,130,246,.25)}
              .heat-2{background:rgba(59,130,246,.55)}
              .heat-3{background:rgba(59,130,246,.95)}
            `}</style>
          </section>
        </>
      )}
    </div>
  );
}
