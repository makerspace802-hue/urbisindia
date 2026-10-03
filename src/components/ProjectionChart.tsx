import { api } from "@/convex/_generated/api";
import {
  buildProjectionPoints,
  INDIA_DECADE_RATE,
  observedDecadalRate,
  type ProjectionInput,
} from "@/lib/projection";
import { useMutation } from "convex/react";
import { motion } from "framer-motion";
import { Save } from "lucide-react";
import { useMemo } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

/**
 * "If the last decade simply continued" — a transparent extrapolation of the
 * state's own Census growth rate.
 *
 * This replaced a chart of canopy/toll/misting sliders driving a temperature
 * drop and an annual saving, which were not Census quantities and were labelled
 * a live model. The projection shown now is arithmetic on a published figure:
 * the observed 2001-2011 rate, carried forward. It is an extrapolation, and says
 * so on the panel.
 */

const AXIS_TICK = { fill: "#64748B", fontSize: 10, fontWeight: 700 } as const;
const AXIS_LINE = { stroke: "#0B0F17", strokeWidth: 2 } as const;

export default function ProjectionChart(input: ProjectionInput) {
  const save = useMutation(api.projections.saveProjection);
  const points = useMemo(() => buildProjectionPoints(input), [input]);
  const final = points[points.length - 1];
  const rate = observedDecadalRate(input.state);
  const label = input.state ?? "India (whole country)";
  const scope = input.state ? "your state" : "India";

  const handleSave = async () => {
    await save({
      state: input.state ?? "India",
      population: points[0].population,
      observedRatePercent: rate * 100,
      points: points.map((point) => ({
        year: point.year,
        population: point.population,
        india: point.india,
        multiple: point.multiple,
      })),
    });
  };

  return (
    <section className="nb-panel">
      <div className="nb-subpanel flex flex-wrap items-center gap-3 border-b-2 border-[var(--nb-ink)] p-4">
        <h2 className="nb-title text-sm md:text-base">Two Decades On</h2>
        <span className="nb-chip bg-[#06B6D4] text-[#03151A]">{label}</span>
        <span className="nb-chip bg-[#FBBF24] text-[#1A1400]">
          Observed rate {(rate * 100).toFixed(2)}% / decade
        </span>
        <button
          type="button"
          onClick={handleSave}
          className="nb-btn ml-auto bg-[var(--nb-surface-2)] px-3 py-1.5 text-[var(--nb-text-2)]"
        >
          <Save className="size-3.5" strokeWidth={3} />
          Save
        </button>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.3 }}
        className="p-4"
      >
        <p className="mb-3 border-2 border-[var(--nb-ink)] bg-[#FBBF24] px-3 py-2 text-[11px] font-bold text-[#1A1400]">
          <strong>Extrapolation, not a Census figure.</strong> The Census of India
          ends in 2011. These lines apply {scope}&rsquo;s measured 2001&ndash;2011
          growth rate of {(rate * 100).toFixed(2)}% per decade and assume nothing
          changes. India&rsquo;s own rate of {(INDIA_DECADE_RATE * 100).toFixed(2)}%
          is shown for comparison. Growth has slowed every decade this century, so
          the later points are very likely overstated.
        </p>

        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={points} margin={{ top: 8, right: 8, bottom: 4, left: 0 }}>
              <CartesianGrid stroke="rgba(100,116,139,0.35)" vertical={false} />
              <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={AXIS_LINE} />
              <YAxis
                tick={AXIS_TICK}
                tickLine={false}
                axisLine={AXIS_LINE}
                width={56}
                tickFormatter={(v: number) => `${(v / 1_000_000).toFixed(0)}M`}
              />
              <ReferenceLine y={points[0].population} stroke="var(--nb-ink)" strokeWidth={2} strokeDasharray="6 4" />
              <Tooltip
                cursor={{ stroke: "var(--nb-ink)", strokeWidth: 2 }}
                contentStyle={{
                  background: "var(--nb-surface-2)",
                  border: "2px solid var(--nb-ink)",
                  borderRadius: 0,
                  fontWeight: 700,
                }}
                labelStyle={{ fontSize: 10, fontWeight: 900 }}
                formatter={(v: number, name: string) => [
                  (v as number).toLocaleString("en-IN"),
                  name,
                ]}
              />
              <Legend
                wrapperStyle={{
                  fontSize: 10,
                  fontWeight: 900,
                  textTransform: "uppercase",
                }}
              />
              <Line
                type="monotone"
                dataKey="india"
                name="India (projected)"
                stroke="#06B6D4"
                strokeWidth={3}
                strokeDasharray="8 4"
                dot={{ r: 4, fill: "#06B6D4", stroke: "#0B0F17", strokeWidth: 2 }}
              />
              <Line
                type="monotone"
                dataKey="population"
                name={label}
                stroke="#10B981"
                strokeWidth={3}
                dot={{ r: 4, fill: "#10B981", stroke: "#0B0F17", strokeWidth: 2 }}
                activeDot={{ r: 7, fill: "#10B981", stroke: "#0B0F17", strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="border-2 border-[var(--nb-ink)] bg-[#10B981] p-3 text-[#04110C] shadow-[4px_4px_0_0_var(--nb-ink)]">
            <p className="text-[10px] font-black uppercase tracking-widest opacity-70">
              {label} by {final.year}
            </p>
            <p className="mt-1 text-2xl font-black leading-none tabular-nums">
              {(final.population / 1_000_000).toFixed(1)}M
            </p>
          </div>
          <div className="border-2 border-[var(--nb-ink)] bg-[#06B6D4] p-3 text-black shadow-[4px_4px_0_0_var(--nb-ink)]">
            <p className="text-[10px] font-black uppercase tracking-widest opacity-70">
              India by {final.year}
            </p>
            <p className="mt-1 text-2xl font-black leading-none tabular-nums">
              {(final.india / 1_000_000).toFixed(0)}M
            </p>
          </div>
          <div className="border-2 border-[var(--nb-ink)] bg-[var(--nb-surface-2)] p-3 text-[var(--nb-text-2)] shadow-[4px_4px_0_0_var(--nb-ink)]">
            <p className="text-[10px] font-black uppercase tracking-widest opacity-70">
              Growth since 2011
            </p>
            <p className="mt-1 text-2xl font-black leading-none tabular-nums">
              ×{final.multiple.toFixed(2)}
            </p>
          </div>
        </div>
      </motion.div>
    </section>
  );
}