import {
  CENSUS_ESTIMATED,
  CENSUS_INDICATORS,
  censusDelta,
  formatCensusValue,
  normalisedIndicators,
} from "@/lib/census";
import { AlertTriangle, Info } from "lucide-react";
import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const AXIS_TICK = { fill: "#64748B", fontSize: 10, fontWeight: 700 } as const;
const AXIS_LINE = { stroke: "#0B0F17", strokeWidth: 2 } as const;
const Y2001 = "#06B6D4";
const Y2011 = "#10B981";

/**
 * Index every indicator to its 2001 value so wildly different units
 * (population counts against percentages) can share one comparison chart.
 */
function indexedRows() {
  return CENSUS_INDICATORS.map((row) => ({
    label: row.label.length > 18 ? `${row.label.slice(0, 17)}…` : row.label,
    full: row.label,
    unit: row.unit,
    // 2001 is the baseline, so it is always 100.
    y2001: 100,
    y2011: Math.round((row.y2011 / row.y2001) * 1000) / 10,
    raw2001: row.y2001,
    raw2011: row.y2011,
  }));
}

export default function CensusCharts() {
  const [view, setView] = useState<"indexed" | "radar">("indexed");

  const indexed = useMemo(() => indexedRows(), []);
  const radar = useMemo(() => normalisedIndicators(), []);

  const radarData = radar.map((row) => ({
    indicator:
      row.label.length > 16 ? `${row.label.slice(0, 15)}…` : row.label,
    full: row.label,
    "2001 (indexed)": Math.round(row.y2001),
    "2011 (indexed)": Math.round(row.y2011),
  }));

  return (
    <div className="flex flex-col gap-4">
      {/* Provenance banner — stated before any numbers are shown. */}
      <div className="nb-panel flex flex-wrap items-start gap-3 border-l-[8px] border-l-[#06B6D4] p-4">
        <Info className="mt-0.5 size-4 shrink-0 text-[#06B6D4]" strokeWidth={3} />
        <p className="text-xs font-bold leading-relaxed text-[var(--nb-text-2)]">
          <span className="font-black uppercase tracking-wide text-[var(--nb-text)]">
            Source: Census of India 2001 &amp; 2011
            {" "}
          </span>
          (Office of the Registrar General &amp; Census Commissioner). Figures
          are published Census headlines, rounded for display. The below-poverty
          line row is an{" "}
          <span className="font-black text-[#F43F5E]">ESTIMATE</span> from the
          NSS household surveys, not a Census figure — the Census collected no
          income data.
        </p>
      </div>

      {/* Control */}
      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            ["indexed", "Indexed Comparison"],
            ["radar", "Profile Shape"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setView(key)}
            aria-pressed={view === key}
            className={[
              "nb-chip px-3 py-1.5 transition-colors",
              view === key
                ? "bg-[#10B981] text-[#04110C]"
                : "bg-[var(--nb-surface-2)] text-[var(--nb-text-2)]",
            ].join(" ")}
          >
            {label}
          </button>
        ))}
        <span className="nb-chip ml-auto bg-[var(--nb-surface-2)] text-[var(--nb-text-muted)]">
          <span className="size-2" style={{ background: Y2001 }} /> 2001
          <span className="ml-2 size-2" style={{ background: Y2011 }} /> 2011
        </span>
      </div>

      {/* Main chart */}
      <motion.section
        key={view}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="nb-panel"
      >
        <div className="nb-subpanel border-b-2 border-[var(--nb-ink)] p-4">
          <h2 className="nb-title text-sm">
            {view === "indexed"
              ? "India 2001 → 2011: Every Indicator Indexed To 2001 = 100"
              : "India 2001 → 2011: Shape Of The Decade"}
          </h2>
          <p className="mt-1.5 text-[11px] font-bold leading-relaxed text-[var(--nb-text-muted)]">
            {view === "indexed"
              ? "Ten indicators spanning population, literacy, urbanisation, sex ratio, density, households and social group shares. Indexing to 2001 = 100 makes them directly comparable despite different units."
              : "Each axis is scaled to its own range, so this shows which areas moved and by how much relative to their own starting point."}
          </p>
        </div>

        <div className="p-3 md:p-4">
          {view === "indexed" ? (
            <div className="h-[380px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={indexed}
                  margin={{ top: 8, right: 8, bottom: 4, left: 0 }}
                >
                  <CartesianGrid stroke="rgba(100,116,139,0.35)" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={AXIS_TICK}
                    tickLine={false}
                    axisLine={AXIS_LINE}
                    angle={-38}
                    height={110}
                    interval={0}
                    tickMargin={6}
                  />
                  <YAxis
                    tick={AXIS_TICK}
                    tickLine={false}
                    axisLine={AXIS_LINE}
                    width={40}
                    domain={[0, "auto"]}
                  />
                  <Tooltip
                    cursor={{ fill: "rgba(11,15,23,0.4)" }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const row = payload[0].payload as (typeof indexed)[number];
                      return (
                        <div className="border-2 border-[var(--nb-ink)] bg-[var(--nb-surface-2)] px-3 py-2">
                          <p className="text-[10px] font-black uppercase tracking-widest text-[var(--nb-text-muted)]">
                            {row.full}
                          </p>
                          <p className="mt-1 text-xs font-bold text-[var(--nb-text-2)]">
                            2001:{" "}
                            <span className="font-black tabular-nums text-[var(--nb-text)]">
                              {formatCensusValue(row.raw2001, row.unit)}
                            </span>
                          </p>
                          <p className="text-xs font-bold text-[var(--nb-text-2)]">
                            2011:{" "}
                            <span className="font-black tabular-nums text-[var(--nb-text)]">
                              {formatCensusValue(row.raw2011, row.unit)}
                            </span>
                          </p>
                          <p className="mt-1 text-xs font-black tabular-nums text-[#10B981]">
                            {row.y2011 >= 100 ? "+" : ""}
                            {(row.y2011 - 100).toFixed(1)}% vs 2001
                          </p>
                        </div>
                      );
                    }}
                  />
                  <Legend
                    wrapperStyle={{
                      fontSize: 10,
                      fontWeight: 900,
                      textTransform: "uppercase",
                    }}
                  />
                  <Bar
                    dataKey="y2001"
                    name="2001 (index)"
                    fill={Y2001}
                    stroke="#0B0F17"
                    strokeWidth={1.5}
                    maxBarSize={26}
                  />
                  <Bar
                    dataKey="y2011"
                    name="2011 (index)"
                    fill={Y2011}
                    stroke="#0B0F17"
                    strokeWidth={1.5}
                    maxBarSize={26}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-[400px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData} outerRadius="72%">
                  <PolarGrid stroke="rgba(100,116,139,0.35)" />
                  <PolarAngleAxis
                    dataKey="indicator"
                    tick={{ fill: "#64748B", fontSize: 9, fontWeight: 700 }}
                  />
                  <PolarRadiusAxis domain={[0, 100]} tick={AXIS_TICK} />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const row = payload[0].payload as (typeof radarData)[number];
                      return (
                        <div className="border-2 border-[var(--nb-ink)] bg-[var(--nb-surface-2)] px-3 py-2">
                          <p className="text-[10px] font-black uppercase tracking-widest text-[var(--nb-text-muted)]">
                            {row.full}
                          </p>
                          <p className="mt-1 text-xs font-black text-[#06B6D4]">
                            2001: {row["2001 (indexed)"]}
                          </p>
                          <p className="text-xs font-black text-[#10B981]">
                            2011: {row["2011 (indexed)"]}
                          </p>
                        </div>
                      );
                    }}
                  />
                  <Legend
                    wrapperStyle={{
                      fontSize: 10,
                      fontWeight: 900,
                      textTransform: "uppercase",
                    }}
                  />
                  <Radar
                    name="2001 (indexed)"
                    dataKey="2001 (indexed)"
                    stroke={Y2001}
                    strokeWidth={3}
                    fill={Y2001}
                    fillOpacity={0.28}
                  />
                  <Radar
                    name="2011 (indexed)"
                    dataKey="2011 (indexed)"
                    stroke={Y2011}
                    strokeWidth={3}
                    fill={Y2011}
                    fillOpacity={0.28}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </motion.section>

      {/* Delta table */}
      <section className="nb-panel">
        <div className="nb-subpanel border-b-2 border-[var(--nb-ink)] p-4">
          <h2 className="nb-title text-sm">Decadal Change, Indicator By Indicator</h2>
        </div>
        <div className="flex flex-col gap-2 p-3 md:p-4">
          {[...CENSUS_INDICATORS, ...CENSUS_ESTIMATED].map((row, index) => {
            const delta = censusDelta(row);
            const improved = row.key === "childsexratio" || row.key === "st" ? delta.absolute < 0 : delta.absolute > 0;
            return (
              <motion.div
                key={row.key}
                initial={{ opacity: 0, x: -8 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-30px" }}
                transition={{ duration: 0.2, delay: index * 0.03 }}
                className="flex flex-wrap items-center gap-x-3 gap-y-2 border-2 border-[var(--nb-ink)] bg-[var(--nb-surface-2)] px-3 py-2.5"
              >
                <span className="text-xs font-black uppercase tracking-wide text-[var(--nb-text)]">
                  {row.label}
                </span>

                {row.estimated && (
                  <span className="nb-chip bg-[#F43F5E] text-black">
                    <AlertTriangle className="size-3" strokeWidth={3} />
                    Estimate
                  </span>
                )}

                <span className="ml-auto flex items-center gap-2 text-xs font-bold tabular-nums text-[var(--nb-text-muted)]">
                  <span>{formatCensusValue(row.y2001, row.unit)}</span>
                  <span className="text-[var(--nb-text-dim)]">→</span>
                  <span className="font-black text-[var(--nb-text)]">
                    {formatCensusValue(row.y2011, row.unit)}
                  </span>
                  <span
                    className={[
                      "nb-chip",
                      improved
                        ? "bg-[#10B981] text-[#04110C]"
                        : "bg-[#F43F5E] text-black",
                    ].join(" ")}
                  >
                    {delta.absolute > 0 ? "+" : ""}
                    {delta.absolute.toFixed(row.unit === "%" ? 1 : 0)}
                    {row.unit === "%" ? " pts" : ""}
                  </span>
                </span>

                <p className="w-full text-[10px] font-bold leading-relaxed text-[var(--nb-text-dim)]">
                  {row.note}
                </p>
              </motion.div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
