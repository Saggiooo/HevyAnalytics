import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getExerciseProgress } from "../lib/api";
import type { ExerciseProgress } from "../lib/types";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";

function iso(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}
function startOfYear(d: Date) {
  return new Date(d.getFullYear(), 0, 1);
}
type Preset = "30d" | "90d" | "ytd" | "365d";
function rangeFromPreset(p: Preset) {
  const now = new Date();
  const to = iso(now);
  if (p === "ytd") return { from: iso(startOfYear(now)), to };
  const days = p === "30d" ? 30 : p === "90d" ? 90 : 365;
  const fromDate = new Date(now);
  fromDate.setDate(fromDate.getDate() - (days - 1));
  return { from: iso(fromDate), to };
}
function fmtShort(isoStr?: string | null) {
  if (!isoStr) return "—";
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("it-IT", { month: "short", day: "2-digit" });
}
function fmtFull(isoStr?: string | null) {
  if (!isoStr) return "—";
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("it-IT", { year: "numeric", month: "short", day: "2-digit" });
}

function Pill({ children }: { children: any }) {
  return <span className="pill bg-white/5 border border-white/10">{children}</span>;
}

function KpiCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card p-4 relative overflow-hidden">
      <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-blue-500/10 blur-2xl" />
      <div className="text-xs text-zinc-400">{label}</div>
      <div className="text-2xl font-semibold mt-1">{value}</div>
      {sub && <div className="text-xs text-zinc-500 mt-1">{sub}</div>}
    </div>
  );
}

export default function ExerciseDetailPage() {
  const { templateId } = useParams<{ templateId: string }>();
  const id = templateId || "";

  const [preset, setPreset] = useState<Preset>("90d");
  const [customFrom, setCustomFrom] = useState<string | null>(null);
  const [customTo, setCustomTo] = useState<string | null>(null);

  const range = useMemo(() => {
    if (customFrom && customTo) return { from: customFrom, to: customTo };
    return rangeFromPreset(preset);
  }, [preset, customFrom, customTo]);

  const q = useQuery<ExerciseProgress, Error>({
    queryKey: ["exercise-progress", id, range.from, range.to],
    queryFn: () => getExerciseProgress({ templateId: id, from: range.from, to: range.to }),
    enabled: !!id,
  });

  const data = useMemo(() => {
    const s = q.data?.series ?? [];
    // per grafico: scarto null weight
    return s
      .filter((x) => typeof x.weight_kg === "number")
      .map((x) => ({
        date: x.date,
        label: fmtShort(x.date),
        kg: x.weight_kg as number,
        reps: x.reps ?? null,
      }));
  }, [q.data]);

  const last = data.length ? data[data.length - 1] : null;
  const first = data.length ? data[0] : null;
  const delta = last && first ? (last.kg - first.kg) : 0;

  if (!id) return <div className="card p-6">Template id mancante.</div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <div className="text-sm text-zinc-400">
            <Link className="hover:underline" to="/exercises">← Esercizi</Link>
          </div>

          <h1 className="text-2xl font-semibold tracking-tight mt-1">
            {q.data?.exercise_title ?? "Esercizio"}
          </h1>

          <div className="text-sm text-zinc-500 mt-1 flex flex-wrap items-center gap-2">
            <Pill>ID: <span className="text-zinc-200">{id}</span></Pill>
            <span>Range:</span>
            <span className="text-zinc-300">{range.from}</span>
            <span>→</span>
            <span className="text-zinc-300">{range.to}</span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <select
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm"
            value={preset}
            onChange={(e) => {
              setPreset(e.target.value as Preset);
              setCustomFrom(null);
              setCustomTo(null);
            }}
          >
            <option value="30d">Ultimi 30 giorni</option>
            <option value="90d">Ultimi 90 giorni</option>
            <option value="ytd">YTD</option>
            <option value="365d">Ultimi 365 giorni</option>
          </select>

          <input
            type="date"
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm"
            value={customFrom ?? ""}
            onChange={(e) => setCustomFrom(e.target.value || null)}
          />
          <input
            type="date"
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm"
            value={customTo ?? ""}
            onChange={(e) => setCustomTo(e.target.value || null)}
          />

          <button
            className="btn"
            onClick={() => {
              setCustomFrom(null);
              setCustomTo(null);
            }}
            title="Reset"
          >
            Reset
          </button>
        </div>
      </div>

      {q.isLoading && <div className="card p-6">Carico progresso…</div>}
      {q.isError && <div className="card p-6 text-rose-300">Errore: {q.error.message}</div>}

      {q.data && (
        <>
          {/* KPI */}
          <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard
              label="Allenamenti con esercizio"
              value={`${q.data.summary.workouts_count}`}
              sub="quanti workout lo contengono nel range"
            />
            <KpiCard
              label="Serie totali"
              value={`${q.data.summary.total_sets}`}
              sub="tutte le serie nel range"
            />
            <KpiCard
              label="Ultimo valore"
              value={last ? `${Math.round(last.kg * 100) / 100} kg` : "—"}
              sub={last ? `(${fmtFull(last.date)})` : "nessun dato peso"}
            />
            <KpiCard
              label="Variazione range"
              value={data.length >= 2 ? `${delta > 0 ? "+" : ""}${Math.round(delta * 100) / 100} kg` : "—"}
              sub={data.length >= 2 ? `${fmtFull(first?.date)} → ${fmtFull(last?.date)}` : "serve almeno 2 punti"}
            />
          </section>

          {/* Chart */}
          <section className="card p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm text-zinc-400">Progress</div>
                <div className="font-semibold mt-1">Kg nel tempo</div>
                <div className="text-xs text-zinc-500 mt-1">
                  Nota: per ogni workout prendo <span className="text-zinc-300">solo l’ultima serie</span> di questo esercizio (set_index più alto).
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Pill>Punti: <span className="text-zinc-200">{data.length}</span></Pill>
              </div>
            </div>

            {data.length === 0 ? (
              <div className="mt-6 text-zinc-500">Nessun dato peso nel range selezionato.</div>
            ) : (
              <div className="mt-4 h-[360px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data} margin={{ top: 10, right: 12, bottom: 10, left: 0 }}>
                    <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={{ fill: "rgba(255,255,255,0.55)", fontSize: 12 }}
                      axisLine={{ stroke: "rgba(255,255,255,0.12)" }}
                      tickLine={{ stroke: "rgba(255,255,255,0.12)" }}
                    />
                    <YAxis
                      tick={{ fill: "rgba(255,255,255,0.55)", fontSize: 12 }}
                      axisLine={{ stroke: "rgba(255,255,255,0.12)" }}
                      tickLine={{ stroke: "rgba(255,255,255,0.12)" }}
                      width={40}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "rgba(24,24,27,0.92)",
                        border: "1px solid rgba(255,255,255,0.12)",
                        borderRadius: 14,
                        color: "rgba(255,255,255,0.85)",
                      }}
                      labelFormatter={(label, payload) => {
                        const p = payload?.[0]?.payload as any;
                        return p?.date ? fmtFull(p.date) : label;
                      }}
                      formatter={(val: any, name: any, item: any) => {
                        const reps = item?.payload?.reps;
                        if (typeof reps === "number") return [`${val} kg  ×  ${reps}`, "Ultima serie"];
                        return [`${val} kg`, "Ultima serie"];
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="kg"
                      stroke="rgba(59,130,246,0.95)"
                      strokeWidth={3}
                      dot={{ r: 3 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}