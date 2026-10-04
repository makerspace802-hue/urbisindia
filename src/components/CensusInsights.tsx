import { ChartPanel, LegendSwatch } from "@/components/ChartKit";
import { useLocation } from "@/lib/locationContext";
import {
  densityScatter,
  growthLeague,
  indiaDecadalRatePercent,
  literacyScatter,
  sexRatioShift,
} from "@/lib/censusInsights";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";

/**
 * Cross-state comparisons drawn from the Census tables.
 *
 * These exist because the pages above them already answer other questions, and
 * repeating those answers in a different chart shape helps nobody. The dashboard
 * covers each state against the passage of time and India as a whole;
 * `StateTrends` covers one state against India. What was missing is "how do the
 * 35 states compare with EACH OTHER" — so every panel here compares states on a
 * dimension nothing else plots.
 *
 *   - the growth league table    : who gained most, in percentage terms
 *   - the sex-ratio shift        : who gained, and who lost, on gender balance
 *   - density against urban share: where people actually concentrate
 *   - literacy against urban share: whether urbanisation tracks schooling
 *
 * Every value is read from the generated tables. Nothing is modelled.
 */

const AXIS_TICK = { fill: "#64748B", fontSize: 10, fontWeight: 700 } as const;
const AXIS_LINE = { stroke: "#0B0F17", strokeWidth: 2 } as const;
const GAIN = "#10B981";
const LOSS = "#F43F5E";
const INDIA = "#06B6D4";
const MARK = "#FBBF24";

/**
 * Height that fits all 35 states as a legible one-line label.
 *
 * These league tables plot one bar per state, and Recharts silently drops
 * category ticks whose band is narrower than the text it has to draw. The old
 * fixed `420px` gave each of 35 rows a 12px band against a 10px font plus an
 * 8px tick margin — 18px needed — so Recharts thinned the axis. Madhya Pradesh,
 * the row that matters most because it is the visitor's own state, lost its
 * label while keeping its bar. 22px per row clears the requirement, and
 * `interval={0}` stops Recharts thinning the list behind our back.
 */
const STATE_ROWS = 35;
const ROW_HEIGHT = 22;
const STATE_CHART_HEIGHT = STATE_ROWS * ROW_HEIGHT;

/**
 * Width for the longest state name, "Andaman & Nicobar Islands".
 *
 * At 10px bold the longest label needs ~163px including its tick margin, so the
 * old `128` silently truncated it — a state in the league table with no readable
 * name against its bar.
 */
const AXIS_NAME_WIDTH = 184;

/**
 * Themed tooltip for the sex-ratio league table, which also carries the two
 * endpoint ratios so the shift can be read without cross-referencing.
 */
function SexRatioTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{
    value?: number;
    payload?: { sexRatio2001: number; sexRatio2011: number };
  }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const value = Number(payload[0]?.value ?? 0);
  const row = payload[0]?.payload;
  return (
    <div className="border-2 border-[var(--nb-ink)] bg-[var(--nb-surface-2)] px-3 py-2 shadow-[4px_4px_0_0_var(--nb-ink)]">
      <p className="text-[10px] font-black uppercase tracking-widest text-[var(--nb-text)]">
        {label}
      </p>
      <p className="mt-1 text-xs font-bold text-[var(--nb-text-2)]">
        Shift :{" "}
        <span className="font-black tabular-nums">
          {value > 0 ? `+${value}` : `${value}`}
        </span>
      </p>
      {row && (
        <p className="text-[10px] font-bold tabular-nums text-[var(--nb-text-muted)]">
          {row.sexRatio2001} → {row.sexRatio2011} females per 1,000 males
        </p>
      )}
    </div>
  );
}

/**
 * Themed tooltip for the two league tables.
 *
 * Recharts' built-in tooltip hard-codes a white background with a mid-grey
 * label, which is unreadable here and ignored the theme entirely — the state
 * name in the growth tooltip came out pale grey on white. This matches
 * `DotTooltip` below so all four panels read the same way.
 */
function BarTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value?: number }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const value = Number(payload[0]?.value ?? 0);
  return (
    <div className="border-2 border-[var(--nb-ink)] bg-[var(--nb-surface-2)] px-3 py-2 shadow-[4px_4px_0_0_var(--nb-ink)]">
      <p className="text-[10px] font-black uppercase tracking-widest text-[var(--nb-text)]">
        {label}
      </p>
      <p className="mt-1 text-xs font-bold text-[var(--nb-text-2)]">
        Growth :{" "}
        <span className="font-black tabular-nums">
          {value >= 0 ? `+${value.toFixed(2)}%` : `${value.toFixed(2)}%`}
        </span>
      </p>
    </div>
  );
}

/** Tooltip shared by the two scatter panels. */
function DotTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: { name: string; x: number; y: number; yours?: boolean } }>;
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return (
    <div className="border-2 border-[var(--nb-ink)] bg-[var(--nb-surface-2)] px-3 py-2 shadow-[4px_4px_0_0_var(--nb-ink)]">
      <p className="text-[10px] font-black uppercase tracking-widest text-[var(--nb-text)]">
        {point.name}
        {point.yours ? " · your state" : ""}
      </p>
      <p className="mt-1 text-xs font-bold text-[var(--nb-text-2)]">
        x <span className="font-black tabular-nums">{point.x}</span>
      </p>
      <p className="text-xs font-bold text-[var(--nb-text-2)]">
        y <span className="font-black tabular-nums">{point.y}</span>
      </p>
    </div>
  );
}

export function CensusInsights() {
  const { state } = useLocation();
  const yours = state ?? null;

  const indiaGrowth = indiaDecadalRatePercent();
  // Computed directly rather than memoised: each call walks 35 rows and sorts
  // them, which costs far less than the reconciliation a memo cache demands,
  // and these only recompute when the located state changes.
  const ranked = growthLeague(yours);
  const sexRanked = sexRatioShift(yours);
  const density = densityScatter(yours);
  const literacy = literacyScatter(yours);

  // Rendered as an overlaid series so the caption is literally true.
  const densityMark = density.filter((p) => p.yours);
  const literacyMark = literacy.filter((p) => p.yours);

  // City-states and tiny UTs span two orders of magnitude, so the density axis
  // is logarithmic.
  const densityTicks = [50, 100, 250, 500, 1000, 2000, 4000];

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <ChartPanel
        title="Growth league table — every state, 2001 to 2011"
        legend={
          <>
            <LegendSwatch color={GAIN} label="Faster than India" />
            <LegendSwatch color={LOSS} label="Slower than India" />
            <LegendSwatch color={MARK} label="Your state" />
          </>
        }
      >
        <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-[var(--nb-text-dim)]">
          Decadal percentage growth. India grew {indiaGrowth.toFixed(2)}%.
        </p>
        <div style={{ height: STATE_CHART_HEIGHT }} className="w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={ranked} layout="vertical" margin={{ top: 4, right: 32, bottom: 4, left: 4 }}>
              <CartesianGrid stroke="rgba(100,116,139,0.35)" horizontal={false} />
              <XAxis
                type="number"
                tick={AXIS_TICK}
                tickLine={false}
                axisLine={AXIS_LINE}
                tickFormatter={(v: number) => `${v}%`}
              />
              <YAxis
                type="category"
                dataKey="name"
                tick={AXIS_TICK}
                tickLine={false}
                axisLine={AXIS_LINE}
                width={AXIS_NAME_WIDTH}
                interval={0}
              />
              <ReferenceLine x={indiaGrowth} stroke="var(--nb-ink)" strokeWidth={2} strokeDasharray="6 4" />
              <Tooltip content={<BarTooltip />} cursor={{ fill: "rgba(11,15,23,0.08)" }} />
              <Bar dataKey="percentChange" stroke="var(--nb-ink)" strokeWidth={1.5}>
                {ranked.map((row) => (
                  <Cell
                    key={row.name}
                    fill={row.yours ? MARK : row.percentChange >= indiaGrowth ? GAIN : LOSS}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartPanel>

      <ChartPanel
        title="Sex ratio shift — females per 1,000 males, 2001 to 2011"
        legend={
          <>
            <LegendSwatch color={GAIN} label="Improved" />
            <LegendSwatch color={LOSS} label="Worsened" />
            <LegendSwatch color={MARK} label="Your state" />
          </>
        }
      >
        <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-[var(--nb-text-dim)]">
          Change in the ratio across the decade. A bar below the line means the
          state lost ground on gender balance.
        </p>
        <div style={{ height: STATE_CHART_HEIGHT }} className="w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={sexRanked} layout="vertical" margin={{ top: 4, right: 32, bottom: 4, left: 4 }}>
              <CartesianGrid stroke="rgba(100,116,139,0.35)" horizontal={false} />
              <XAxis
                type="number"
                tick={AXIS_TICK}
                tickLine={false}
                axisLine={AXIS_LINE}
                tickFormatter={(v: number) => (v > 0 ? `+${v}` : `${v}`)}
              />
              <YAxis
                type="category"
                dataKey="name"
                tick={AXIS_TICK}
                tickLine={false}
                axisLine={AXIS_LINE}
                width={AXIS_NAME_WIDTH}
                interval={0}
              />
              <ReferenceLine x={0} stroke="var(--nb-ink)" strokeWidth={2} />
              <Tooltip
                cursor={{ fill: "rgba(11,15,23,0.08)" }}
                content={<SexRatioTooltip />}
              />
              <Bar dataKey="sexShift" stroke="var(--nb-ink)" strokeWidth={1.5}>
                {sexRanked.map((row) => (
                  <Cell key={row.name} fill={row.yours ? MARK : row.sexShift >= 0 ? GAIN : LOSS} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartPanel>

      <ChartPanel
        title="Density against urban share — where people concentrate"
        legend={
          <>
            <LegendSwatch color={INDIA} label="Each dot is a state" />
            <LegendSwatch color={MARK} label="Your state" />
          </>
        }
      >
        <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-[var(--nb-text-dim)]">
          People per square kilometre against the share living in towns. The axis
          is logarithmic because Delhi and Puducherry sit an order of magnitude
          above Lakshadweep.
        </p>
        <div className="h-[320px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 8, right: 16, bottom: 20, left: 4 }}>
              <CartesianGrid stroke="rgba(100,116,139,0.35)" />
              <XAxis
                type="number"
                dataKey="x"
                name="Density"
                tick={AXIS_TICK}
                tickLine={false}
                axisLine={AXIS_LINE}
                ticks={densityTicks}
                scale="log"
                domain={[40, 6000]}
                tickFormatter={numTick}
                label={{
                  value: "People per km² (log)",
                  position: "insideBottom",
                  offset: -12,
                  fill: "#64748B",
                  fontSize: 10,
                  fontWeight: 800,
                }}
              />
              <YAxis
                type="number"
                dataKey="y"
                name="Urban share"
                tick={AXIS_TICK}
                tickLine={false}
                axisLine={AXIS_LINE}
                width={40}
                unit="%"
              />
              <ZAxis range={[70, 70]} />
              <Tooltip content={<DotTooltip />} cursor={{ strokeDasharray: "4 4" }} />
              <Scatter data={density} fill={INDIA} fillOpacity={0.85} />
              {densityMark.length > 0 && <Scatter data={densityMark} fill={MARK} />}
            </ScatterChart>
          </ResponsiveContainer>
        </div>
        <HighlightNote yours={yours} />
      </ChartPanel>

      <ChartPanel
        title="Literacy against urban share"
        legend={
          <>
            <LegendSwatch color={GAIN} label="Each dot is a state" />
            <LegendSwatch color={MARK} label="Your state" />
          </>
        }
      >
        <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-[var(--nb-text-dim)]">
          Literacy rate, ages 7 and above, against the urban share. A tight band
          means the two move together across the country.
        </p>
        <div className="h-[320px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 8, right: 16, bottom: 20, left: 4 }}>
              <CartesianGrid stroke="rgba(100,116,139,0.35)" />
              <XAxis
                type="number"
                dataKey="x"
                name="Literacy"
                tick={AXIS_TICK}
                tickLine={false}
                axisLine={AXIS_LINE}
                unit="%"
                domain={[40, 100]}
              />
              <YAxis
                type="number"
                dataKey="y"
                name="Urban share"
                tick={AXIS_TICK}
                tickLine={false}
                axisLine={AXIS_LINE}
                width={40}
                unit="%"
              />
              <ZAxis range={[70, 70]} />
              <Tooltip content={<DotTooltip />} cursor={{ strokeDasharray: "4 4" }} />
              <Scatter data={literacy} fill={GAIN} fillOpacity={0.85} />
              {literacyMark.length > 0 && <Scatter data={literacyMark} fill={MARK} />}
            </ScatterChart>
          </ResponsiveContainer>
        </div>
        <HighlightNote yours={yours} />
      </ChartPanel>
    </div>
  );
}

/** Caption for the scatter panels, matching what is actually drawn. */
function HighlightNote({ yours }: { yours: string | null }) {
  return (
    <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-[var(--nb-text-dim)]">
      {yours ? `${yours} is the amber dot.` : "Pick a state above to highlight it here."}
    </p>
  );
}

/** Keeps the logarithmic axis readable: 50, 100, 250 … */
function numTick(value: number) {
  return value >= 1000 ? `${value / 1000}k` : String(value);
}