import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

// --- Types (tolleranti: il backend può avere nomi campi leggermente diversi)
export type RecordRow = {
  exercise_title?: string;
  exercise?: string;
  title?: string;

  max_weight_kg?: number;
  weight_kg?: number;
  best_weight_kg?: number;
  value?: number;

  reps?: number;
  best_reps?: number;

  workout_id?: string;
  workout_title?: string;
  workout_date?: string; // ISO
  date?: string; // ISO
};

function fmtKg(v: number) {
  // evita 40.0000001
  const r = Math.round(v * 100) / 100;
  return r % 1 === 0 ? `${r.toFixed(0)} kg` : `${r} kg`;
}

function fmtDate(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("it-IT", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

function pickTitle(r: RecordRow) {
  return (
    r.exercise_title ||
    r.exercise ||
    r.title ||
    "Esercizio"
  );
}

function pickWeight(r: RecordRow) {
  const v =
    r.max_weight_kg ??
    r.best_weight_kg ??
    r.weight_kg ??
    r.value ??
    0;
  return typeof v === "number" ? v : 0;
}

function pickReps(r: RecordRow) {
  const v = r.reps ?? r.best_reps ?? 0;
  return typeof v === "number" ? v : 0;
}

async function fetchRecords(year?: number): Promise<RecordRow[]> {
  const base = (import.meta as any).env?.VITE_API_BASE || "http://127.0.0.1:8000/api";
  const url = new URL(`${base}/records`);
  if (year) url.searchParams.set("year", String(year));

  const res = await fetch(url.toString(), {
    headers: { "Accept": "application/json" },
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} ${res.statusText}${txt ? ` – ${txt}` : ""}`);
  }

  const data = await res.json();

  // Backend può restituire lista diretta oppure {records:[...]}
  if (Array.isArray(data)) return data as RecordRow[];
  if (data && Array.isArray(data.records)) return data.records as RecordRow[];
  return [];
}

function KgRepsCell({ kg, reps }: { kg: number; reps: number }) {
  return (
    <div className="inline-flex items-center justify-end gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
      <div className="text-base font-semibold tracking-tight leading-none">{fmtKg(kg)}</div>
      <div className="text-xs text-zinc-400 leading-none">×</div>
      <div className="text-lg font-semibold leading-none">{reps}</div>
      <div className="text-xs text-zinc-400 leading-none">rep</div>
    </div>
  );
}

export function RecordPage() {
  const nowYear = new Date().getFullYear();
  const [year, setYear] = useState<number | "all">("all");
  const [q, setQ] = useState("");
  const [hideZero, setHideZero] = useState(true);

  const years = useMemo(() => {
    const out: Array<number | "all"> = ["all"];
    for (let y = nowYear; y >= nowYear - 6; y--) out.push(y);
    return out;
  }, [nowYear]);

  const recordsQ = useQuery<RecordRow[], Error>({
    queryKey: ["records", year],
    queryFn: () => fetchRecords(year === "all" ? undefined : year),
    staleTime: 60_000,
  });

  const rows = useMemo(() => {
    const raw = recordsQ.data ?? [];

    const filtered = raw
      .map((r) => ({
        ...r,
        __title: pickTitle(r),
        __kg: pickWeight(r),
        __reps: pickReps(r),
        __date: r.workout_date || r.date,
      }))
      .filter((r) => (hideZero ? r.__kg > 0 : true))
      .filter((r) => (q.trim() ? r.__title.toLowerCase().includes(q.trim().toLowerCase()) : true));

    // Ordina: kg desc, poi reps desc, poi alfabetico
    filtered.sort((a, b) => {
      if (b.__kg !== a.__kg) return b.__kg - a.__kg;
      if (b.__reps !== a.__reps) return b.__reps - a.__reps;
      return a.__title.localeCompare(b.__title);
    });

    return filtered;
  }, [recordsQ.data, q, hideZero]);

  const total = rows.length;

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <div className="text-sm text-zinc-400">Record</div>
          <h1 className="text-2xl font-semibold tracking-tight">Max kg per esercizio</h1>
          <div className="text-sm text-zinc-500 mt-1">
            Solo la serie col <span className="text-zinc-200">peso più alto</span> (non quella con più reps). 💪
          </div>
          {recordsQ.isError && (
            <div className="text-sm text-rose-300 mt-2">
              Errore: {(recordsQ.error as Error).message}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap justify-end">
          <div className="pill">Esercizi: {total}</div>

          <select
            className="btn"
            value={year}
            onChange={(e) => setYear(e.target.value === "all" ? "all" : Number(e.target.value))}
            title="Anno"
          >
            {years.map((y) => (
              <option key={String(y)} value={String(y)}>
                {y === "all" ? "Tutti" : y}
              </option>
            ))}
          </select>

          <button
            className={`btn ${hideZero ? "bg-white/10" : ""}`}
            onClick={() => setHideZero((v) => !v)}
            title="Nascondi esercizi con 0 kg"
          >
            {hideZero ? "Zero: OFF" : "Zero: ON"}
          </button>
        </div>
      </div>

      <section className="card p-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="text-sm text-zinc-400">Lista</div>
            <div className="font-semibold">PR per esercizio</div>
          </div>

          <div className="flex items-center gap-2">
            <input
              className="btn !px-3 !py-2 w-64 max-w-full"
              placeholder="Cerca esercizio…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
        </div>

        {recordsQ.isLoading ? (
          <div className="mt-6 text-zinc-500">Carico record…</div>
        ) : (
          <div className="mt-4 overflow-auto">
            <table className="w-full text-sm">
              <thead className="text-zinc-400">
                <tr className="border-b border-white/10">
                  <th className="text-left py-3 pr-3">Esercizio</th>
                  <th className="text-right py-3 px-3">Record</th>
                  <th className="text-right py-3 pl-3">Quando</th>
                </tr>
              </thead>

              <tbody>
                {rows.map((r, i) => {
                  const title = r.__title as string;
                  const kg = r.__kg as number;
                  const reps = r.__reps as number;
                  const date = r.__date as string | undefined;

                  return (
                    <tr key={`${title}-${i}`} className="border-b border-white/5 hover:bg-white/5">
                      <td className="py-3 pr-3">
                        <div className="min-w-0">
                          <div className="font-medium truncate">{title}</div>
                          <div className="text-xs text-zinc-500 truncate">
                            {r.workout_title ? `in “${r.workout_title}”` : ""}
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-3 text-right">
                        <KgRepsCell kg={kg} reps={reps} />
                      </td>

                      <td className="py-3 pl-3 text-right text-zinc-400 whitespace-nowrap">
                        {fmtDate(date)}
                      </td>
                    </tr>
                  );
                })}

                {rows.length === 0 && !recordsQ.isLoading && (
                  <tr>
                    <td colSpan={3} className="py-8 text-center text-zinc-500">
                      Nessun record trovato. Prova a cambiare anno o ricerca.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-4 text-xs text-zinc-500">
          Nota: se hai più serie allo stesso peso massimo, mostriamo quella con più reps (giusto per non litigare col destino).
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="card p-5 lg:col-span-2">
          <div className="text-sm text-zinc-400">Tip</div>
          <div className="font-semibold">Vuoi farla ancora più “spacca”?</div>
          <ul className="mt-3 space-y-2 text-sm text-zinc-500">
            <li>• Aggiungiamo un toggle “solo bilanciere / manubri / macchine” se nel backend hai i template id.</li>
            <li>• Mini sparkline per ogni esercizio (progressione ultimi N workout) usando /workouts/id.</li>
            <li>• Badge “PR nuovo” se il record è nei 30 giorni.</li>
          </ul>
        </div>

        <div className="card p-5">
          <div className="text-sm text-zinc-400">Stato</div>
          <div className="font-semibold">API</div>
          <div className="mt-3 space-y-2">
            <div className="pill">Endpoint: /api/records</div>
            <div className="pill">Anno: {year}</div>
            <div className="pill">Filtro: {q.trim() ? `“${q.trim()}”` : "—"}</div>
          </div>
        </div>
      </section>
    </div>
  );
}

export default RecordPage;