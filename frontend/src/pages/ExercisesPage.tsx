import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { listExercises, updateExercise } from "../lib/api";
import type { ExerciseCatalogRow } from "../lib/types";

const MUSCLES_PRESET = [
  "petto","schiena","spalle","bicipiti","tricipiti", "quadricipiti",
  "femorali","glutei","addome","polpacci","avambracci","cardio",
];

const EQUIPMENT_PRESET = [
  "bilanciere","manubri","cavi","macchina","smith",
  "banda","corpo libero","panca","kettlebell",
];

function pillCls(kind: "muscle" | "equip") {
  return kind === "muscle"
    ? "bg-emerald-500/12 border-emerald-400/25 text-emerald-200"
    : "bg-sky-500/12 border-sky-400/25 text-sky-200";
}

function cleanList(arr: string[]) {
  return Array.from(new Set(arr.map((x) => x.trim().toLowerCase()).filter(Boolean)));
}

/** MultiSelect semplice: dropdown con checkbox */
function MultiSelect({
  label,
  options,
  value,
  onChange,
  kind,
}: {
  label: string;
  options: string[];
  value: string[];
  onChange: (next: string[]) => void;
  kind: "muscle" | "equip";
}) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const [pos, setPos] = useState<{ left: number; top: number; width: number } | null>(null);

  useEffect(() => {
    if (!open) return;

    const compute = () => {
      const el = btnRef.current;
      if (!el) return;

      const r = el.getBoundingClientRect();

      // Keep the dropdown attached to the button but never outside the viewport.
      const padding = 12;
      const menuMaxH = 240; // should match max-h-[240px]
      const gap = 8;

      // Give the menu a sensible minimum width so it doesn't look cramped,
      // and clamp it within the viewport.
      const menuW = Math.min(Math.max(r.width, 320), window.innerWidth - padding * 2);

      // Clamp horizontal position so the menu never overflows the viewport.
      let left = r.left;
      left = Math.min(left, window.innerWidth - menuW - padding);
      left = Math.max(padding, left);

      // Prefer opening below; if not enough space, open above.
      const belowTop = r.bottom + gap;
      const belowFits = belowTop + menuMaxH + 56 /* footer */ <= window.innerHeight - padding;

      let top = belowTop;
      if (!belowFits) {
        top = Math.max(padding, r.top - gap - (menuMaxH + 56));
      }

      setPos({ left, top, width: menuW });
    };

    compute();
    window.addEventListener("resize", compute);
    // scroll anywhere (including nested containers)
    window.addEventListener("scroll", compute, true);

    return () => {
      window.removeEventListener("resize", compute);
      window.removeEventListener("scroll", compute, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };

    const onDown = (e: MouseEvent) => {
      const target = e.target as Node | null;
      const btn = btnRef.current;
      if (!btn || !target) return;
      // If click is outside the button AND outside the dropdown (which is portaled),
      // close it. The dropdown root will have data-ms-root.
      const dropdownRoot = document.querySelector('[data-ms-root="true"]');
      const clickedInDropdown = dropdownRoot ? dropdownRoot.contains(target) : false;
      const clickedInButton = btn.contains(target);

      if (!clickedInDropdown && !clickedInButton) setOpen(false);
    };

    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onDown, true);

    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onDown, true);
    };
  }, [open]);

  const selected = value ?? [];

  const toggle = (opt: string) => {
    const v = opt.trim().toLowerCase();
    const has = selected.includes(v);
    const next = has ? selected.filter((x) => x !== v) : [...selected, v];
    onChange(cleanList(next));
  };

  const remove = (opt: string) => onChange(selected.filter((x) => x !== opt));

  return (
    <div className="relative">
      <div className="text-xs text-zinc-400 mb-2">{label}</div>

      <button
        type="button"
        ref={btnRef}
        className="w-full flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 hover:bg-white/10 transition"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((s) => !s);
        }}
      >
        <div className="flex flex-wrap gap-2 items-center">
          {selected.length === 0 ? (
            <span className="text-zinc-500 text-sm">Nessuno</span>
          ) : (
            selected.slice(0, 3).map((x) => (
              <span key={x} className={`pill border ${pillCls(kind)}`}>
                {x}
                <span
                  className="ml-2 text-zinc-300 hover:text-white cursor-pointer"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    remove(x);
                  }}
                  title="Rimuovi"
                >
                  ×
                </span>
              </span>
            ))
          )}
          {selected.length > 3 && <span className="text-xs text-zinc-500">+{selected.length - 3}</span>}
        </div>

        <span className="text-zinc-400">▾</span>
      </button>

      {open && pos &&
        createPortal(
          <div
            data-ms-root="true"
            className="fixed z-[2147483647] rounded-2xl border border-white/10 bg-zinc-950/95 backdrop-blur p-2 shadow-xl"
            style={{ left: pos.left, top: pos.top, width: pos.width }}
          >
            <div className="max-h-[240px] overflow-auto">
              {options.map((opt) => {
                const v = opt.trim().toLowerCase();
                const checked = selected.includes(v);
                return (
                  <label
                    key={opt}
                    className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/5 cursor-pointer"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                  >
                    <input
                      type="checkbox"
                      className="accent-emerald-500"
                      checked={checked}
                      onChange={() => toggle(opt)}
                    />
                    <span className="text-sm text-zinc-200">{opt}</span>
                  </label>
                );
              })}
            </div>

            <div className="mt-2 flex items-center justify-between px-2">
              <button
                type="button"
                className="text-xs text-zinc-400 hover:text-white"
                onClick={() => onChange([])}
              >
                Svuota
              </button>
              <button type="button" className="btn" onClick={() => setOpen(false)}>
                Chiudi
              </button>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}

export default function ExercisesPage() {
  const qc = useQueryClient();

  const [q, setQ] = useState("");
  const [muscleFilter, setMuscleFilter] = useState<string>("tutti");
  const [equipFilter, setEquipFilter] = useState<string>("tutti");

  const exQ = useQuery<ExerciseCatalogRow[], Error>({
    queryKey: ["exercises"],
    queryFn: () => listExercises(),
    initialData: [],
  });

  const mut = useMutation({
    mutationFn: ({ id, patch }: { id: number; patch: { muscles?: string[]; equipment?: string[] } }) =>
      updateExercise(id, patch),
    onSuccess: (updated) => {
      // aggiorna cache in-place (instant UI)
      qc.setQueryData<ExerciseCatalogRow[]>(["exercises"], (old) => {
        const arr = old ?? [];
        return arr.map((x) => (x.id === updated.id ? updated : x));
      });
    },
  });

  const rows = exQ.data ?? [];

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();

    return rows.filter((e) => {
      const titleOk = !qq || e.exercise_title.toLowerCase().includes(qq);
      const muscleOk =
        muscleFilter === "tutti" || (e.muscles ?? []).includes(muscleFilter);
      const equipOk =
        equipFilter === "tutti" || (e.equipment ?? []).includes(equipFilter);
      return titleOk && muscleOk && equipOk;
    });
  }, [rows, q, muscleFilter, equipFilter]);

  const stats = useMemo(() => {
    const assignedM = rows.filter((x) => (x.muscles ?? []).length > 0).length;
    const assignedE = rows.filter((x) => (x.equipment ?? []).length > 0).length;
    return { total: rows.length, assignedM, assignedE };
  }, [rows]);

  if (exQ.isLoading) return <div className="card p-6">Carico esercizi…</div>;
  if (exQ.isError) return <div className="card p-6 text-rose-300">Errore: {exQ.error.message}</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <div className="text-sm text-zinc-400">Catalogo</div>
          <h1 className="text-2xl font-semibold tracking-tight mt-1">Esercizi</h1>
          <div className="text-sm text-zinc-500 mt-1">
            Totali: <span className="text-zinc-300">{stats.total}</span> • Muscoli assegnati:{" "}
            <span className="text-zinc-300">{stats.assignedM}</span> • Equipment assegnati:{" "}
            <span className="text-zinc-300">{stats.assignedE}</span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <input
            className="w-full sm:w-72 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-white/20"
            placeholder="Cerca esercizio…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />

          <select
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm"
            value={muscleFilter}
            onChange={(e) => setMuscleFilter(e.target.value)}
          >
            <option value="tutti">Muscoli: Tutti</option>
            {MUSCLES_PRESET.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>

          <select
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm"
            value={equipFilter}
            onChange={(e) => setEquipFilter(e.target.value)}
          >
            <option value="tutti">Equipment: Tutti</option>
            {EQUIPMENT_PRESET.map((e) => (
              <option key={e} value={e}>{e}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-3">
        {filtered.map((ex) => (
          ex.exercise_template_id ? (
            <Link
              key={ex.id}
              to={`/exercises/${encodeURIComponent(ex.exercise_template_id)}`}
              className="card p-4 block hover:bg-white/5 transition"
            >
              <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="font-semibold truncate">{ex.exercise_title}</div>
                    {ex.exercise_template_id && (
                      <span className="pill bg-white/5 border border-white/10 text-zinc-300">
                        {ex.exercise_template_id}
                      </span>
                    )}
                  </div>

                  <div className="mt-2 flex flex-wrap gap-2">
                    {(ex.muscles ?? []).map((m) => (
                      <span key={m} className={`pill border ${pillCls("muscle")}`}>{m}</span>
                    ))}
                    {(ex.equipment ?? []).map((eq) => (
                      <span key={eq} className={`pill border ${pillCls("equip")}`}>{eq}</span>
                    ))}
                    {(ex.muscles?.length ?? 0) === 0 && (ex.equipment?.length ?? 0) === 0 && (
                      <span className="text-xs text-zinc-500">Ancora vuoto: assegnagli muscoli/equipment 👇</span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full lg:max-w-xl">
                  <MultiSelect
                    label="Muscoli"
                    options={MUSCLES_PRESET}
                    value={ex.muscles ?? []}
                    onChange={(next) => mut.mutate({ id: ex.id, patch: { muscles: next } })}
                    kind="muscle"
                  />
                  <MultiSelect
                    label="Equipment"
                    options={EQUIPMENT_PRESET}
                    value={ex.equipment ?? []}
                    onChange={(next) => mut.mutate({ id: ex.id, patch: { equipment: next } })}
                    kind="equip"
                  />
                </div>
              </div>

              {mut.isPending && (
                <div className="mt-3 text-xs text-zinc-500">Salvo…</div>
              )}
            </Link>
          ) : (
            <div key={ex.id} className="card p-4">
              <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="font-semibold truncate">{ex.exercise_title}</div>
                  </div>

                  <div className="mt-2 flex flex-wrap gap-2">
                    {(ex.muscles ?? []).map((m) => (
                      <span key={m} className={`pill border ${pillCls("muscle")}`}>{m}</span>
                    ))}
                    {(ex.equipment ?? []).map((eq) => (
                      <span key={eq} className={`pill border ${pillCls("equip")}`}>{eq}</span>
                    ))}
                    {(ex.muscles?.length ?? 0) === 0 && (ex.equipment?.length ?? 0) === 0 && (
                      <span className="text-xs text-zinc-500">Ancora vuoto: assegnagli muscoli/equipment 👇</span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full lg:max-w-xl">
                  <MultiSelect
                    label="Muscoli"
                    options={MUSCLES_PRESET}
                    value={ex.muscles ?? []}
                    onChange={(next) => mut.mutate({ id: ex.id, patch: { muscles: next } })}
                    kind="muscle"
                  />
                  <MultiSelect
                    label="Equipment"
                    options={EQUIPMENT_PRESET}
                    value={ex.equipment ?? []}
                    onChange={(next) => mut.mutate({ id: ex.id, patch: { equipment: next } })}
                    kind="equip"
                  />
                </div>
              </div>

              {mut.isPending && (
                <div className="mt-3 text-xs text-zinc-500">Salvo…</div>
              )}
            </div>
          )
        ))}

        {filtered.length === 0 && (
          <div className="card p-6 text-zinc-500">Nessun esercizio trovato.</div>
        )}
      </div>
    </div>
  );
}