import { api } from "@/convex/_generated/api";
import {
  buildProjectionPoints,
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
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const AXIS_TICK = { fill: "#64748B", fontSize: 10, fontWeight: 700 } as const;
const AXIS_LINE = { stroke: "#0B0F17", strokeWidth: 2 } as const;

export default function ProjectionChart(input: ProjectionInput) {
  const save = useMutation(api.projections.saveProjection);
  const points = useMemo(() => buildProjectionPoints(input), [input]);
  const final = points[points.length - 1];

  const handleSave = async () => {
    await save({
      city: input.city,
      population: input.population,
      canopyBonus: input.canopy,
      toll: input.toll,
      misting: input.misting,
      points: points.map((point) => ({
        year: point.year,
        tempDrop: point.tempDrop,
        modalShift: point.modalShift,
        savings: point.savings,
      })),
    });
  };

  return (
    <section className="nb-panel">
      <div className="nb-subpanel flex flex-wrap items-center gap-3 border-b-2 border-[var(--nb-ink)] p-4">
        <h2 className="nb-title text-sm md:text-base">10-Year City Outlook</h2>
        <span className="nb-chip bg-[var(--nb-surface-2)] text-[#06B6D4]">
          {input.city} · {input.population.toLocaleString()} residents
        </span>
        <button
          type="button"
          onClick={handleSave}
          className="nb-btn ml-auto bg-[#FBBF24] px-3 py-1.5 text-black"
        >
          <Save className="size-3.5" strokeWidth={3} />
          Save Scenario
        </button>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.3 }}
        className="p-4"
      >
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={points}
              margin={{ top: 8, right: 8, bottom: 4, left: 0 }}
            >
              <CartesianGrid stroke="rgba(100,116,139,0.35)" vertical={false} />
              <XAxis
                dataKey="label"
                tick={AXIS_TICK}
                tickLine={false}
                axisLine={AXIS_LINE}
              />
              <YAxis
                yAxisId="temp"
                tick={AXIS_TICK}
                tickLine={false}
                axisLine={AXIS_LINE}
                width={40}
              />
              <YAxis
                yAxisId="modal"
                orientation="right"
                tick={AXIS_TICK}
                tickLine={false}
                axisLine={AXIS_LINE}
                width={44}
              />
              <Tooltip
                cursor={{ stroke: "#0B0F17", strokeWidth: 2 }}
                contentStyle={{
                  background: "#0B0F17",
                  border: "2px solid #0B0F17",
                  borderRadius: 0,
                  fontWeight: 700,
                }}
                labelStyle={{
                  color: "#94A3B8",
                  fontSize: 10,
                  fontWeight: 900,
                }}
              />
              <Legend
                wrapperStyle={{
                  fontSize: 10,
                  fontWeight: 900,
                  textTransform: "uppercase",
                }}
              />
              <Line
                yAxisId="temp"
                type="monotone"
                dataKey="tempDrop"
                name="Temp drop (°C)"
                stroke="#06B6D4"
                strokeWidth={3}
                dot={{ r: 3, fill: "#06B6D4", stroke: "#0B0F17", strokeWidth: 2 }}
              />
              <Line
                yAxisId="modal"
                type="monotone"
                dataKey="modalShift"
                name="Modal shift (%)"
                stroke="#10B981"
                strokeWidth={3}
                strokeDasharray="8 4"
                dot={{ r: 3, fill: "#10B981", stroke: "#0B0F17", strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="border-2 border-[var(--nb-ink)] bg-[#06B6D4] p-3 text-black shadow-[4px_4px_0_0_var(--nb-ink)]">
            <p className="text-[10px] font-black uppercase tracking-widest opacity-70">
              Microclimate by {final.year}
            </p>
            <p className="mt-1 text-2xl font-black leading-none tabular-nums">
              -{final.tempDrop.toFixed(1)} °C
            </p>
          </div>
          <div className="border-2 border-[var(--nb-ink)] bg-[#10B981] p-3 text-[#04110C] shadow-[4px_4px_0_0_var(--nb-ink)]">
            <p className="text-[10px] font-black uppercase tracking-widest opacity-70">
              Commuters shifted
            </p>
            <p className="mt-1 text-2xl font-black leading-none tabular-nums">
              +{final.modalShift.toFixed(0)}%
            </p>
          </div>
          <div className="border-2 border-[var(--nb-ink)] bg-[#FBBF24] p-3 text-black shadow-[4px_4px_0_0_var(--nb-ink)]">
            <p className="text-[10px] font-black uppercase tracking-widest opacity-70">
              Annual city savings
            </p>
            <p className="mt-1 text-2xl font-black leading-none tabular-nums">
              ${final.savings.toFixed(1)}M
            </p>
          </div>
        </div>
      </motion.div>
    </section>
  );
}
