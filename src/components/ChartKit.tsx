import type { ReactNode } from "react";

/**
 * Shared chart chrome for the neobrutalist recharts panels.
 *
 * These lived inside `pages/Analytics.tsx`, which made them unreachable from any
 * other view. They are pulled out here so every chart in the app gets an
 * identical panel, axis and tooltip rather than each page inventing its own.
 */

export const AXIS_TICK = { fill: "#64748B", fontSize: 10, fontWeight: 700 } as const;
export const AXIS_LINE = { stroke: "#0B0F17", strokeWidth: 2 } as const;

export interface TooltipEntry {
  name?: string | number;
  value?: ReactNode;
  color?: string;
}

export function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: ReactNode;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="border-2 border-[var(--nb-ink)] bg-[var(--nb-surface-2)] px-3 py-2 shadow-[4px_4px_0_0_var(--nb-ink)]">
      {label !== undefined && (
        <p className="text-[10px] font-black uppercase tracking-widest text-[var(--nb-text-muted)]">
          {label}
        </p>
      )}
      {payload.map((entry, index) => (
        <p
          key={`${String(entry.name)}-${index}`}
          className="mt-1 text-xs font-bold text-[var(--nb-text-2)]"
        >
          <span
            className="mr-1.5 inline-block size-2.5 border border-[var(--nb-ink)] align-[-1px]"
            style={{ background: entry.color }}
          />
          {entry.name}:{" "}
          <span className="font-black tabular-nums text-[var(--nb-text)]">
            {entry.value}
          </span>
        </p>
      ))}
    </div>
  );
}

export function LegendSwatch({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wide text-[var(--nb-text-2)]">
      <span className="size-3 border-2 border-[var(--nb-ink)]" style={{ background: color }} />
      {label}
    </span>
  );
}

export function ChartPanel({
  title,
  legend,
  children,
  className = "",
}: {
  title: string;
  legend?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`nb-panel min-w-0 ${className}`}>
      <div className="nb-subpanel border-b-2 border-[var(--nb-ink)] p-4">
        <h2 className="nb-title text-xs leading-snug md:text-sm">{title}</h2>
        {legend && <div className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1.5">{legend}</div>}
      </div>
      <div className="p-3 md:p-4">{children}</div>
    </section>
  );
}

/** Compact stat block used across the trend cards. */
export function StatCard({
  label,
  value,
  sub,
  tone = "plain",
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "plain" | "good" | "bad";
}) {
  const toneClass =
    tone === "good"
      ? "bg-[#10B981] text-[#04110C]"
      : tone === "bad"
        ? "bg-[#F43F5E] text-[#FFF0F3]"
        : "bg-[var(--nb-surface-2)] text-[var(--nb-text-2)]";
  return (
    <div className={`border-2 border-[var(--nb-ink)] p-3 shadow-[4px_4px_0_0_var(--nb-ink)] ${toneClass}`}>
      <p className="text-[9px] font-black uppercase tracking-widest opacity-80">{label}</p>
      <p className="mt-1.5 text-xl font-black leading-none tabular-nums md:text-2xl">{value}</p>
      {sub && <p className="mt-1.5 text-[10px] font-bold opacity-75">{sub}</p>}
    </div>
  );
}