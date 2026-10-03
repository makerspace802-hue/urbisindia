import { STATE_GROWTH } from "@/lib/censusData";
import { motion } from "framer-motion";
import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const AXIS_TICK = { fill: "#64748B", fontSize: 10, fontWeight: 700 } as const;
const AXIS_LINE = { stroke: "#0B0F17", strokeWidth: 2 } as const;
const UP = "#10B981";
const DOWN = "#F43F5E";
const GRID = "#1E293B";

const compact = (v: number) =>
  v >= 1_000_000
    ? `${(v / 1_000_000).toFixed(v >= 10_000_000 ? 0 : 1)}M`
    : v >= 1_000
      ? `${(v / 1_000).toFixed(0)}K`
      : v.toLocaleString("en-IN");

type Row = (typeof STATE_GROWTH)[number];
type View = "rate" | "absolute";

/**
 * Category tick: the state's name over its actual 2001 and 2011 counts.
 *
 * Showing the raw pair next to every bar is what stops the two views from
 * being read as competing stories — a state high on one is low on the other,
 * and the reason is visible without leaving the chart.
 */
function RowTick({
  x,
  y,
  payload,
}: {
  x?: number;
  y?: number;
  payload?: { value: string };
}) {
  const row = STATE_GROWTH.find((r) => r.name === payload?.value);
  if (!row) return null;
  return (
    <g transform={`translate(${x},${y})`}>
      <text
        x={-8}
        y={0}
        dy={-2}
        textAnchor="end"
        fill="#E2E8F0"
        fontSize="11"
        fontWeight="900"
      >
        {row.name}
      </text>
      <text
        x={-8}
        y={0}
        dy={11}
        textAnchor="end"
        fill="#64748B"
        fontSize="9"
        fontWeight="700"
      >
        {compact(row.population2001)} → {compact(row.population2011)}
      </text>
    </g>
  );
}

function Tip({
  active,
  payload,
  view,
}: {
  active?: boolean;
  payload?: { payload: Row }[];
  view: View;
}) {
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;
  return (
    <div className="nb-panel p-3 text-xs">
      <p className="font-black uppercase tracking-wide text-[var(--nb-text)]">
        {row.name}
      </p>
      <p className="mt-1.5 tabular-nums text-[var(--nb-text-2)]">
        2001 · {row.population2001.toLocaleString("en-IN")}
      </p>
      <p className="tabular-nums text-[var(--nb-text-2)]">
        2011 · {row.population2011.toLocaleString("en-IN")}
      </p>
      <p
        className="mt-1.5 font-black tabular-nums"
        style={{ color: row.percentChange >= 0 ? UP : DOWN }}
      >
        {view === "rate"
          ? `${row.percentChange >= 0 ? "+" : ""}${row.percentChange.toFixed(2)}%`
          : `${row.absoluteChange >= 0 ? "+" : ""}${row.absoluteChange.toLocaleString("en-IN")}`}
      </p>
    </div>
  );
}

export default function CensusCharts() {
  const [view, setView] = useState<View>("rate");

  // Both views rank the same 35 units, so switching never reorders the axis and
  // the eye can compare position rather than re-learn the chart.
  const data = [...STATE_GROWTH].sort((a, b) =>
    view === "rate"
      ? b.percentChange - a.percentChange
      : b.absoluteChange - a.absoluteChange,
  );

  const key = view === "rate" ? "percentChange" : "absoluteChange";
  const height = data.length * 24 + 60;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-0">
          {(
            [
              ["rate", "Fastest Growth"],
              ["absolute", "Largest Gains"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setView(id)}
              className={`nb-btn text-xs ${
                view === id
                  ? "bg-[#10B981] text-[#04110C]"
                  : "bg-[var(--nb-surface-2)] text-[var(--nb-text-2)]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <span className="nb-chip bg-[var(--nb-surface-2)] text-[var(--nb-text-muted)]">
          Census 2001 → 2011 · {STATE_GROWTH.length} states &amp; UTs
        </span>
      </div>

      <motion.div
        key={view}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="nb-panel p-4"
      >
        <ResponsiveContainer width="100%" height={height}>
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 8, right: 76, bottom: 8, left: 8 }}
          >
            <CartesianGrid
              horizontal={false}
              stroke={GRID}
              strokeDasharray="2 4"
            />
            <XAxis
              type="number"
              tick={AXIS_TICK}
              tickLine={false}
              axisLine={AXIS_LINE}
              tickFormatter={
                view === "rate"
                  ? (v: number) => `${v.toFixed(0)}%`
                  : (v: number) => compact(v)
              }
            />
            <YAxis
              type="category"
              dataKey="name"
              tick={<RowTick />}
              tickLine={false}
              axisLine={false}
              width={168}
              interval={0}
            />
            <Tooltip
              cursor={{ fill: "rgba(148,163,184,0.08)" }}
              content={<Tip view={view} />}
            />
            <Bar dataKey={key} isAnimationActive={false}>
              {data.map((row) => (
                <Cell
                  key={row.name}
                  fill={row.percentChange >= 0 ? UP : DOWN}
                />
              ))}
              <LabelList
                dataKey={key}
                position="right"
                offset={8}
                fill="#E2E8F0"
                fontSize={10}
                fontWeight={900}
                formatter={(v: number) =>
                  view === "rate"
                    ? `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`
                    : compact(v)
                }
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>

        <p className="mt-3 border-t-2 border-[var(--nb-ink)] pt-2.5 text-[11px] font-bold leading-relaxed text-[var(--nb-text-dim)]">
          {view === "rate" ? (
            <>
              Decadal percentage growth, ranked. The top of this list is small
              union territories — Dadra &amp; Nagar Haveli and Daman &amp; Diu
              both doubled their population off a tiny base.{" "}
              <span className="text-[#F43F5E]">Nagaland was the only unit to
              shrink (&minus;0.58%).</span>
            </>
          ) : (
            <>
              Absolute population added, ranked. This is a different set of
              states from the percentage view: Uttar Pradesh added more people
              than almost anyone else on this chart added households times
              over. Rank by percentage and you rank by size of nothing.
            </>
          )}{" "}
          Source: Census of India 2011, Table A-2 (decadal variation in
          population since 1901), read from{" "}
          <code className="text-[var(--nb-text-2)]">data/data-1.csv</code>.
        </p>
      </motion.div>
    </div>
  );
}