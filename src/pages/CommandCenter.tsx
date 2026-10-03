import CensusCharts from "@/components/CensusCharts";
import { api } from "@/convex/_generated/api";
import { changeRows, formatCensusValue, type CensusIndicator } from "@/lib/census";
import { useQuery } from "convex/react";
import { motion } from "framer-motion";
import { Megaphone } from "lucide-react";
import { Link } from "react-router";

/**
 * The four indicators promoted to the top of the dashboard.
 *
 * They are pulled out of the same table the charts further down the page are
 * drawn from, so a card and its chart can never disagree. The previous four
 * cards carried invented traffic, heat-island, canopy and EV figures that no
 * chart in this dashboard was built on.
 */
const KPI_KEYS = ["population", "households", "literacy", "urban"] as const;

/** Sub-label under each headline value, for the context the number lacks. */
const KPI_NOTES: Record<(typeof KPI_KEYS)[number], string> = {
  population: "people · census 2011",
  households: "4.8 people per household",
  literacy: "aged 7 and above",
  urban: "live in a statutory town",
};

/** Decade movement colours, matching the change chart in CensusCharts. */
const DIRECTION_COLOUR = {
  up: "#10B981",
  down: "#F43F5E",
  flat: "#64748B",
} as const;

const DIRECTION_CHIP = {
  up: "bg-[#10B981] text-[#04110C]",
  down: "bg-[#F43F5E] text-black",
  flat: "bg-[#64748B] text-white",
} as const;

/** Bar colours for the 2001 / 2011 pair, matching the radar legend. */
const Y2001 = "#06B6D4";
const Y2011 = "#10B981";

/** Unit suffix worth printing next to a value. */
const unitSuffix = (unit: string) => (unit === "%" ? "%" : "");

/**
 * Same builder the change chart uses, so the badge on each card is literally
 * the bar height drawn below it.
 */
const CHANGE_BY_KEY = new Map(changeRows().map((row) => [row.key, row]));

const KPIS = KPI_KEYS.map((key) => {
  const row = CHANGE_BY_KEY.get(key);
  if (!row) throw new Error(`Unknown census indicator: ${key}`);
  const suffix = unitSuffix(row.unit);
  return {
    key,
    row,
    title: row.label,
    note: KPI_NOTES[key],
    value: `${formatCensusValue(row.y2011, row.unit)}${suffix}`,
    baseline: `${formatCensusValue(row.y2001, row.unit)}${suffix}`,
    badge: `${row.changePct >= 0 ? "+" : ""}${row.changePct.toFixed(1)}% in decade`,
    // A rate moves in points, not percent — "9.2%" would read as a relative
    // change and understate it, so rates print as points.
    absolute:
      row.unit === "%"
        ? `${row.absolute >= 0 ? "+" : ""}${row.absolute.toFixed(2)} pts`
        : `${row.absolute >= 0 ? "+" : ""}${formatCensusValue(row.absolute, row.unit)} more`,
    colour: DIRECTION_COLOUR[row.direction],
    chip: DIRECTION_CHIP[row.direction],
  };
});

/** Category colours for the live community feed on the dashboard. */
const TAG_COLORS: Record<string, string> = {
  "Heat/Shade": "#F43F5E",
  "Bike Lane": "#06B6D4",
  "Transit Hub": "#FBBF24",
  "Tree Planting": "#10B981",
};

/**
 * The 2001 and 2011 figures as two bars on the indicator's own natural domain
 * — the same scale the "Profile Shape" radar below uses. This replaces an
 * invented 16-point sparkline with the only two data points the card actually
 * has, and makes the gap between them the real decadal gap.
 */
function DecadeBars({ row, colour }: { row: CensusIndicator; colour: string }) {
  const [low, high] = row.domain;
  const span = high - low || 1;
  const bar = (value: number) => Math.max(2, ((value - low) / span) * 26);
  const h2001 = bar(row.y2001);
  const h2011 = bar(row.y2011);
  const baseline = 32;
  const top2001 = baseline - h2001;
  const top2011 = baseline - h2011;

  return (
    <svg
      viewBox="0 0 96 44"
      className="h-11 w-20 shrink-0 sm:w-24"
      role="img"
      aria-label={`${row.label}: ${formatCensusValue(row.y2001, row.unit)} in 2001, ${formatCensusValue(row.y2011, row.unit)} in 2011`}
    >
      <line
        x1="6"
        y1={baseline}
        x2="90"
        y2={baseline}
        stroke="var(--nb-ink)"
        strokeWidth="2"
      />
      {/*
        A decade is a small move on most of these natural ranges — the urban
        share shifts by about a pixel. The connector is drawn behind the bars
        so only the gap between them shows the line, which keeps the direction
        of travel readable even where the two heights look identical.
      */}
      <line
        x1="37"
        y1={top2001}
        x2="65"
        y2={top2011}
        stroke={colour}
        strokeWidth="3"
        strokeLinecap="square"
      />
      <rect x="26" y={top2001} width="22" height={h2001} fill={Y2001} />
      <rect x="54" y={top2011} width="22" height={h2011} fill={Y2011} />
      <text
        x="37"
        y="42"
        textAnchor="middle"
        fontSize="8"
        fontWeight="900"
        fill="#64748B"
      >
        01
      </text>
      <text
        x="65"
        y="42"
        textAnchor="middle"
        fontSize="8"
        fontWeight="900"
        fill="#64748B"
      >
        11
      </text>
    </svg>
  );
}

export default function CommandCenter() {
  const today = new Date().toLocaleDateString("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  const allIssues = useQuery(api.admin.listIssues);
  const recent = (allIssues ?? []).slice(0, 4);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-black uppercase tracking-tight text-[var(--nb-text)] md:text-3xl">
          Dashboard
        </h1>
        <span className="nb-chip bg-[var(--nb-surface-2)] text-[var(--nb-text-muted)]">{today}</span>
      </div>

      {/* Census baseline — the same table the charts further down are drawn from */}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <h2 className="nb-title text-sm md:text-base">
          Census Baseline
        </h2>
        <span className="nb-chip bg-[var(--nb-surface-2)] text-[var(--nb-text-muted)]">
          Census Of India · 2001 → 2011
        </span>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {KPIS.map((kpi, index) => (
          <motion.article
            key={kpi.key}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: index * 0.05 }}
            className="nb-panel p-4 transition-transform duration-150 hover:scale-[1.01]"
          >
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-[11px] font-black uppercase leading-snug tracking-widest text-[var(--nb-text-muted)]">
                {kpi.title}
              </h2>
              <span
                className={`nb-chip whitespace-normal text-right ${kpi.chip}`}
              >
                {kpi.badge}
              </span>
            </div>
            <div className="mt-4 flex items-end justify-between gap-3">
              <div>
                <p className="text-3xl font-black leading-none tabular-nums text-[var(--nb-text)]">
                  {kpi.value}
                </p>
                <p className="mt-1.5 text-[11px] font-bold uppercase tracking-wide text-[var(--nb-text-dim)]">
                  {kpi.note}
                </p>
              </div>
              <DecadeBars row={kpi.row} colour={kpi.colour} />
            </div>
            <div className="mt-4 flex items-center justify-between gap-2 border-t-2 border-[var(--nb-ink)] pt-2.5">
              <span className="text-xs font-black tabular-nums text-[var(--nb-text-dim)]">
                2001 · {kpi.baseline}
              </span>
              <span
                className="whitespace-nowrap text-xs font-black tabular-nums"
                style={{ color: kpi.colour }}
              >
                {kpi.absolute}
              </span>
            </div>
          </motion.article>
        ))}
      </div>

      {/* Live citizen feed — real submissions only, no placeholder rows */}
      <section className="mt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="nb-title text-sm md:text-base">
            Latest From The Community
          </h2>
          <Link
            to="/report"
            className="nb-chip bg-[var(--nb-surface-2)] text-[var(--nb-text-2)]"
          >
            File An Issue
          </Link>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
          {recent.length === 0 ? (
            <div className="nb-panel flex flex-col items-center gap-3 border-2 border-dashed p-8 text-center md:col-span-2">
              <Megaphone
                className="size-7 text-[var(--nb-text-dim)]"
                strokeWidth={2.5}
              />
              <p className="text-sm font-black uppercase tracking-wide text-[var(--nb-text)]">
                No citizen reports yet
              </p>
              <p className="max-w-sm text-xs font-bold leading-relaxed text-[var(--nb-text-muted)]">
                Nothing has been filed so far. Once residents start reporting
                issues they will appear here live.
              </p>
              <Link
                to="/report"
                className="nb-btn bg-[#10B981] text-[#04110C]"
              >
                File The First Report
              </Link>
            </div>
          ) : (
            recent.map((issue) => (
              <motion.article
                key={issue.ticket}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.25 }}
                className="nb-panel p-4 transition-transform duration-150 hover:scale-[1.01]"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="nb-chip bg-[var(--nb-surface-2)] text-[var(--nb-text)]">
                    {issue.ticket}
                  </span>
                  <span
                    className="nb-chip"
                    style={{
                      background: TAG_COLORS[issue.tag] ?? "#94A3B8",
                      color: "#000000",
                    }}
                  >
                    {issue.tag}
                  </span>
                  <span
                    className="nb-chip ml-auto"
                    style={{
                      background:
                        issue.status === "Resolved" ? "#10B981" : "#FBBF24",
                      color: "#000000",
                    }}
                  >
                    {issue.status}
                  </span>
                </div>
                <p className="mt-3 text-sm font-semibold leading-relaxed text-[var(--nb-text-2)]">
                  {issue.description}
                </p>
                <p className="mt-3 border-t-2 border-[var(--nb-ink)] pt-2 text-[10px] font-black uppercase tracking-widest text-[var(--nb-text-dim)]">
                  {issue.district} · {issue.upvotes} upvotes
                </p>
              </motion.article>
            ))
          )}
        </div>
      </section>

      {/* Census decade view, replacing the retired digital-twin map */}
      <section className="mt-8">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="nb-title text-sm md:text-base">
            India Between 2001 And 2011
          </h2>
          <span className="nb-chip bg-[var(--nb-surface-2)] text-[var(--nb-text-muted)]">
            Census Of India
          </span>
        </div>
        <CensusCharts />
      </section>

    </div>
  );
}
