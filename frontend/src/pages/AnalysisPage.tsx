import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getAnalysisSummary } from "../lib/api";
import type { AnalysisSummary } from "../lib/types";
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
  Legend,
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

function clamp01(x: number) {
  return Math.max(0, Math.min(1, x));
}

function levelColor(count: number, max: number) {
  if (max <= 0) return "rgba(59,130,246,0.08)";
  const t = clamp01(count / max);
  // 4 livelli “github-ish”
  if (t === 0) return "rgba(255,255,255,0.06)";
  if (t < 0.34) return "rgba(59,130,246,0.18)";
  if (t < 0.67) return "rgba(59,130,246,0.35)";
  return "rgba(59,130,246,0.55)";
}

// mappa macro-zone => lista muscoli che “contano” per quella zona
const ZONES: Array<{
  key: string;
  label: string;
  muscles: string[];
}> = [
  { key: "petto", label: "Petto", muscles: ["petto"] },
  { key: "schiena", label: "Schiena", muscles: ["schiena"] },
  { key: "spalle", label: "Spalle", muscles: ["spalle"] },
  { key: "braccia", label: "Braccia", muscles: ["bicipiti", "tricipiti", "avambracci"] },
  { key: "addome", label: "Addome", muscles: ["addome"] },
  { key: "gambe", label: "Gambe", muscles: ["quadricipiti", "femorali", "glutei", "polpacci"] },
];

function zoneCount(muscleCounts: Record<string, number>, muscles: string[]) {
  let s = 0;
  for (const m of muscles) s += muscleCounts[m] ?? 0;
  return s;
}

function BodyMap({
  counts,
}: {
  counts: Record<string, number>;
}) {
  const zoneVals = useMemo(() => {
    const arr = ZONES.map((z) => ({ ...z, value: zoneCount(counts, z.muscles) }));
    const max = Math.max(0, ...arr.map((x) => x.value));
    return { arr, max };
  }, [counts]);

  // SVG “schematico” (macro-zone) ma molto leggibile e bello in UI
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm text-zinc-400">Heatmap muscolare</div>
          <div className="font-semibold mt-1">Distribuzione (macro-zone)</div>
          <div className="text-xs text-zinc-500 mt-1">
            Intensità = quante volte quel distretto compare negli allenamenti del range
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-zinc-400">
          <span>meno</span>
          {[0, 1, 2, 3].map((i) => (
            <span
              key={i}
              className="inline-block w-4 h-4 rounded-md border border-white/10"
              style={{
                background:
                  i === 0
                    ? "rgba(255,255,255,0.06)"
                    : i === 1
                    ? "rgba(59,130,246,0.18)"
                    : i === 2
                    ? "rgba(59,130,246,0.35)"
                    : "rgba(59,130,246,0.55)",
              }}
            />
          ))}
          <span>più</span>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 lg:grid-cols-2 gap-5 items-center">
        <div className="flex justify-center">
          <svg width="320" height="360" viewBox="0 0 320 360">
            {/* silhouette base */}
            <defs>
              <filter id="soft" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="10" stdDeviation="10" floodColor="rgba(0,0,0,0.45)" />
              </filter>
            </defs>

            {/* body */}
            <g filter="url(#soft)">
              <rect x="120" y="55" width="80" height="95" rx="32" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.08)" />
              <rect x="132" y="20" width="56" height="45" rx="22" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.08)" />
              <rect x="118" y="145" width="84" height="95" rx="28" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.08)" />
              <rect x="98" y="235" width="124" height="105" rx="34" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.08)" />

              {/* arms */}
              <rect x="70" y="70" width="45" height="170" rx="22" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.08)" />
              <rect x="205" y="70" width="45" height="170" rx="22" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.08)" />
            </g>

            {/* ZONE OVERLAYS */}
            {(() => {
              const { arr, max } = zoneVals;
              const get = (k: string) => arr.find(x => x.key === k)?.value ?? 0;

              const chest = get("petto");
              const back = get("schiena");
              const shoulders = get("spalle");
              const arms = get("braccia");
              const abs = get("addome");
              const legs = get("gambe");

              return (
                <g>
                  {/* Petto */}
                  <rect x="126" y="72" width="68" height="55" rx="20"
                    fill={levelColor(chest, max)}
                  />
                  {/* Schiena (lo rappresento sulla stessa figura, macro) */}
                  <rect x="126" y="128" width="68" height="35" rx="16"
                    fill={levelColor(back, max)}
                  />
                  {/* Spalle */}
                  <rect x="112" y="60" width="34" height="28" rx="14"
                    fill={levelColor(shoulders, max)}
                  />
                  <rect x="174" y="60" width="34" height="28" rx="14"
                    fill={levelColor(shoulders, max)}
                  />

                  {/* Braccia */}
                  <rect x="74" y="92" width="37" height="120" rx="18"
                    fill={levelColor(arms, max)}
                  />
                  <rect x="209" y="92" width="37" height="120" rx="18"
                    fill={levelColor(arms, max)}
                  />

                  {/* Addome */}
                  <rect x="128" y="168" width="64" height="55" rx="18"
                    fill={levelColor(abs, max)}
                  />

                  {/* Gambe */}
                  <rect x="110" y="246" width="46" height="95" rx="22"
                    fill={levelColor(legs, max)}
                  />
                  <rect x="164" y="246" width="46" height="95" rx="22"
                    fill={levelColor(legs, max)}
                  />
                </g>
              );
            })()}
          </svg>
        </div>

        <div className="space-y-3">
          {zoneVals.arr.map((z) => (
            <div key={z.key} className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center justify-between">
                <div className="font-semibold">{z.label}</div>
                <div className="pill bg-white/5 border border-white/10">
                  {z.value}
                </div>
              </div>

              <div className="mt-3 h-2 rounded-full bg-white/5 overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: zoneVals.max ? `${Math.round((z.value / zoneVals.max) * 100)}%` : "0%",
                    background: "rgba(59,130,246,0.55)",
                  }}
                />
              </div>

              <div className="text-xs text-zinc-500 mt-2">
                Muscoli: <span className="text-zinc-300">{z.muscles.join(", ")}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function RadarPanel({ summary }: { summary: AnalysisSummary }) {
  const data = useMemo(() => {
    const keys = ["schiena", "petto", "addome", "spalle", "braccia", "gambe"];
    return keys.map((k) => ({
      area: k[0].toUpperCase() + k.slice(1),
      attuale: summary.radar.attuale[k] ?? 0,
      precedente: summary.radar.precedente[k] ?? 0,
    }));
  }, [summary]);

  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm text-zinc-400">Radar</div>
          <div className="font-semibold mt-1">Attuale vs Precedente</div>
          <div className="text-xs text-zinc-500 mt-1">
            Range attuale: <span className="text-zinc-300">{summary.from}</span> →{" "}
            <span className="text-zinc-300">{summary.to}</span>{" "}
            • precedente: <span className="text-zinc-300">{summary.previous_from}</span> →{" "}
            <span className="text-zinc-300">{summary.previous_to}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="pill bg-white/5 border border-white/10">
            workouts: <span className="text-zinc-200">{summary.meta?.workouts_attuale ?? "—"}</span>
          </span>
          <span className="pill bg-white/5 border border-white/10">
            prev: <span className="text-zinc-200">{summary.meta?.workouts_precedente ?? "—"}</span>
          </span>
        </div>
      </div>

      <div className="mt-4 h-[340px]">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={data}>
            <PolarGrid stroke="rgba(255,255,255,0.10)" />
            <PolarAngleAxis dataKey="area" tick={{ fill: "rgba(255,255,255,0.55)", fontSize: 14 }} />
            <Radar
              name="Attuale"
              dataKey="attuale"
              stroke="rgba(59,130,246,0.9)"
              fill="rgba(59,130,246,0.35)"
              strokeWidth={2}
            />
            <Radar
              name="Precedente"
              dataKey="precedente"
              stroke="rgba(255,255,255,0.55)"
              fill="rgba(255,255,255,0.15)"
              strokeWidth={2}
            />
            <Legend />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default function AnalysisPage() {
  const [preset, setPreset] = useState<Preset>("90d");
  const [customFrom, setCustomFrom] = useState<string | null>(null);
  const [customTo, setCustomTo] = useState<string | null>(null);

  const range = useMemo(() => {
    if (customFrom && customTo) return { from: customFrom, to: customTo };
    return rangeFromPreset(preset);
  }, [preset, customFrom, customTo]);

  const q = useQuery<AnalysisSummary, Error>({
    queryKey: ["analysis-summary", range.from, range.to],
    queryFn: () => getAnalysisSummary(range),
  });

  const summary = q.data;

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <div className="text-sm text-zinc-400">Insights</div>
          <h1 className="text-2xl font-semibold tracking-tight mt-1">Analisi</h1>
          <div className="text-sm text-zinc-500 mt-1">
            Range: <span className="text-zinc-300">{range.from}</span> →{" "}
            <span className="text-zinc-300">{range.to}</span>
          </div>
        </div>

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

      {q.isLoading && <div className="card p-6">Carico analisi…</div>}
      {q.isError && <div className="card p-6 text-rose-300">Errore: {q.error.message}</div>}

      {summary && (
        <>
          <BodyMap counts={summary.muscle_counts ?? {}} />
          <RadarPanel summary={summary} />
        </>
      )}
    </div>
  );
}