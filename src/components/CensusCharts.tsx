import {
  CENSUS_ESTIMATED,
  CENSUS_INDICATORS,
  censusDelta,
  changeRows,
  directionOf,
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
  Cell,
  LabelList,
  Legend,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const AXIS_TICK = { fill: "#64748B", fontSize: 10, fontWeight: 700 } as const;
const AXIS_LINE = { stroke: "#0B0F17", strokeWidth: 2 } as const;
const Y2001 = "#06B6D4";
const Y2011 = "#10B981";
const UP = "#10B981";
const DOWN = "#F43F5E";
const FLAT = "#64748B";

const DIRECTION_COLOUR: Record<string, string> = {
  up: UP,
  down: DOWN,
  flat: FLAT,
};

type ChangeRow = ReturnType<typeof changeRows>[number];
type RadarRow = ReturnType<typeof normalisedIndicators>[number];

/**
 * Y-axis tick for the change chart: the indicator name with its real 2001 and
 * 2011 figures underneath.
 *
 * A horizontal chart has room for the full label and the raw values, which is
 * the whole reason this view replaced the rotated vertical one.
 */
const CHANGE_ROWS = changeRows();
const CHANGE_BY_LABEL = new Map(CHANGE_ROWS.map((r) => [r.short, r]));

function ChangeTick({
  x,
  y,
  payload,
}: {
  x?: number;
  y?: number;
  payload?: { value?: string };
}) {
  const row = CHANGE_BY_LABEL.get(payload?.value ?? "");
  if (!row || x === undefined || y === undefined) return null;
  return (
    <g transform={`translate(${x},${y})`}>
      <text
        x={-10}
        y={-3}
        textAnchor="end"
        fill="var(--nb-text)"
        fontSize={11}
        fontWeight={900}
      >
        {row.label}
      </text>
      <text x={-10} y={11} textAnchor="end" fill="var(--nb-text-dim)" fontSize={9} fontWeight={700}>
        {formatCensusValue(row.y2001, row.unit)} → {formatCensusValue(row.y2011, row.unit)}
      </text>
    </g>
  );
}


export default function CensusCharts() {
  const [view, setView] = useState<"change" | "radar">("change");

  const change = useMemo(() => changeRows(), []);
  const radar = useMemo(() => normalisedIndicators(), []);

  const radarData = radar.map((row) => ({
    indicator: row.short,
    full: row.label,
    "2001": Math.round(row.y2001),
    "2011": Math.round(row.y2011),
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
            ["change", "What Changed"],
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
          {view === "change" ? (
            <>
              <span className="size-2" style={{ background: UP }} /> Increased
              <span className="ml-2 size-2" style={{ background: DOWN }} /> Decreased
              <span className="ml-2 size-2" style={{ background: FLAT }} /> Unchanged
            </>
          ) : (
            <>
              <span className="size-2" style={{ background: Y2001 }} /> 2001
              <span className="ml-2 size-2" style={{ background: Y2011 }} /> 2011
            </>
          )}
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
            {view === "change"
              ? "India 2001 → 2011: How Far Each Indicator Moved"
              : "India 2001 → 2011: Profile Shape"}
          </h2>
          <p className="mt-1.5 text-[11px] font-bold leading-relaxed text-[var(--nb-text-muted)]">
            {view === "change"
              ? "Ten indicators spanning population, literacy, urbanisation, sex ratio, density, households and social group shares. Each bar is the percentage change from 2001, which lets indicators with completely different units share one axis. The real 2001 and 2011 figures sit under each label."
              : "Each axis is scaled to the natural range of that measure (a literacy rate against 0-100%, a sex ratio against 700-1100), so both decades land at their true relative position and the outline shows where India actually stood."}
          </p>
        </div>

        <div className="p-3 md:p-4">
          {view === "change" ? (
            <div className="h-[460px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={change}
                  layout="vertical"
                  margin={{ top: 8, right: 56, bottom: 4, left: 8 }}
                  barCategoryGap={8}
                >
                  <CartesianGrid stroke="rgba(100,116,139,0.35)" horizontal={false} />
                  <XAxis
                    type="number"
                    tick={AXIS_TICK}
                    tickLine={false}
                    axisLine={AXIS_LINE}
                    tickFormatter={(v: number) => `${v > 0 ? "+" : ""}${v}%`}
                  />
                  <YAxis
                    type="category"
                    dataKey="short"
                    width={168}
                    tickLine={false}
                    axisLine={AXIS_LINE}
                    tick={<ChangeTick />}
                    interval={0}
                  />
                  <ReferenceLine x={0} stroke="#0B0F17" strokeWidth={2} />
                  <Tooltip
                    cursor={{ fill: "rgba(100,116,139,0.18)" }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const row = payload[0].payload as ChangeRow;
                      return (
                        <div className="border-2 border-[var(--nb-ink)] bg-[var(--nb-surface-2)] px-3 py-2">
                          <p className="text-[10px] font-black uppercase tracking-widest text-[var(--nb-text-muted)]">
                            {row.label}
                          </p>
                          <p className="mt-1 text-xs font-bold text-[var(--nb-text-2)]">
                            2001:{" "}
                            <span className="font-black tabular-nums text-[var(--nb-text)]">
                              {formatCensusValue(row.y2001, row.unit)}
                            </span>
                          </p>
                          <p className="text-xs font-bold text-[var(--nb-text-2)]">
                            2011:{" "}
                            <span className="font-black tabular-nums text-[var(--nb-text)]">
                              {formatCensusValue(row.y2011, row.unit)}
                            </span>
                          </p>
                          <p
                            className="mt-1 text-xs font-black tabular-nums"
                            style={{ color: DIRECTION_COLOUR[row.direction] }}
                          >
                            {row.changePct >= 0 ? "+" : ""}
                            {row.changePct.toFixed(1)}% ·{" "}
                            {row.direction === "up"
                              ? "increased"
                              : row.direction === "down"
                                ? "decreased"
                                : "unchanged"}
                          </p>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="changePct" name="Change vs 2001" radius={0} maxBarSize={26}>
                    {change.map((row) => (
                      <Cell
                        key={row.key}
                        fill={DIRECTION_COLOUR[row.direction]}
                        stroke="#0B0F17"
                        strokeWidth={1.5}
                      />
                    ))}
                    <LabelList
                      dataKey="changePct"
                      position="right"
                      formatter={(v: number) =>
                        `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`
                      }
                      style={{
                        fill: "var(--nb-text)",
                        fontSize: 10,
                        fontWeight: 900,
                      }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-[440px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData} outerRadius="70%">
                  <PolarGrid stroke="rgba(100,116,139,0.35)" />
                  <PolarAngleAxis
                    dataKey="indicator"
                    tick={{ fill: "var(--nb-text-muted)", fontSize: 10, fontWeight: 800 }}
                  />
                  {/* Coarse ticks only: a tick per 10 units stacked up into an
                      unreadable blob in the middle of the polygon. */}
                  <PolarRadiusAxis
                    domain={[0, 100]}
                    angle={90}
                    tickCount={5}
                    tick={{ fill: "var(--nb-text-dim)", fontSize: 9, fontWeight: 700 }}
                    axisLine={false}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const row = payload[0].payload as RadarRow & { full: string };
                      return (
                        <div className="border-2 border-[var(--nb-ink)] bg-[var(--nb-surface-2)] px-3 py-2">
                          <p className="text-[10px] font-black uppercase tracking-widest text-[var(--nb-text-muted)]">
                            {row.full}
                          </p>
                          <p className="mt-1 text-xs font-bold text-[var(--nb-text-2)]">
                            2001:{" "}
                            <span className="font-black tabular-nums" style={{ color: Y2001 }}>
                              {formatCensusValue(row.raw2001, row.unit)}
                            </span>
                          </p>
                          <p className="text-xs font-bold text-[var(--nb-text-2)]">
                            2011:{" "}
                            <span className="font-black tabular-nums" style={{ color: Y2011 }}>
                              {formatCensusValue(row.raw2011, row.unit)}
                            </span>
                          </p>
                          <p className="mt-1 text-[10px] font-bold text-[var(--nb-text-dim)]">
                            Scaled to {row.domain[0]}–{row.domain[1]}
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
                    name="2001"
                    dataKey="2001"
                    stroke={Y2001}
                    strokeWidth={3}
                    fill={Y2001}
                    fillOpacity={0.22}
                    dot={{ r: 2, fill: Y2001, strokeWidth: 0 }}
                  />
                  <Radar
                    name="2011"
                    dataKey="2011"
                    stroke={Y2011}
                    strokeWidth={3}
                    fill={Y2011}
                    fillOpacity={0.22}
                    dot={{ r: 2, fill: Y2011, strokeWidth: 0 }}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          )}

          {view === "change" && (
            <p className="border-t-2 border-[var(--nb-ink)] bg-[var(--nb-surface-2)] px-4 py-2.5 text-[10px] font-bold leading-relaxed text-[var(--nb-text-dim)]">
              Bars show <span className="font-black text-[var(--nb-text-2)]">relative change from the 2001 level</span>,
              which is what lets ten different units share one axis. Read them
              alongside the real figures printed under each label: a small
              share such as Scheduled Tribe moves from 1.1% to 0.8%, a fall of
              only 0.3 points, but it is 27% of a small base and so draws a long
              bar.
            </p>
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
            const direction = directionOf(
              delta.absolute,
              row.unit === "%" ? 0.05 : 0,
            );
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
                      direction === "up"
                        ? "bg-[#10B981] text-[#04110C]"
                        : direction === "down"
                          ? "bg-[#F43F5E] text-black"
                          : "bg-[#64748B] text-black",
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
