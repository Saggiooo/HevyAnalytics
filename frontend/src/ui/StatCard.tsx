import type { ReactNode } from "react";


export function StatCard({
  title,
  value,
  subtitle,
  icon,
}: {
  title: string;
  value: ReactNode;
  subtitle?: string;
  icon?: string;
}) {
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm text-zinc-400">{title}</div>
          <div className="kpi mt-1">{value}</div>
          {subtitle && <div className="text-xs text-zinc-500 mt-1">{subtitle}</div>}
        </div>
        {icon && (
          <div className="h-10 w-10 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
            <span className="text-lg">{icon}</span>
          </div>
        )}
      </div>
    </div>
  );
}
