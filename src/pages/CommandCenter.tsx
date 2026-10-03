import CensusCharts from "@/components/CensusCharts";
import { api } from "@/convex/_generated/api";
import {
  CENTURY_MULTIPLE,
  FIRST_CENSUS_YEAR,
  INDIA_DECADAL,
  INDIA_2011,
  LAST_CENSUS_YEAR,
  LATEST_DECADAL,
  OPENING_CENSUS,
  PEAK_DECADAL,
} from "@/lib/censusData";
import { useQuery } from "convex/react";
import { motion } from "framer-motion";
import { Megaphone } from "lucide-react";
import { Link } from "react-router";

/** Compact population formatting for the card values. */
const compact = (v: number) =>
  v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : v.toLocaleString("en-IN");

const TONES = {
  cyan: "bg-[#06B6D4] text-[#03151A]",
  green: "bg-[#10B981] text-[#04110C]",
  amber: "bg-[#FBBF24] text-[#1A1400]",
  slate: "bg-[#64748B] text-white",
} as const;

interface Card {
  key: string;
  title: string;
  value: string;
  note: string;
  badge: string;
  tone: keyof typeof TONES;
  /** Census year this card is about — the point marked on the century line. */
  year: number;
  footLeft: string;
  footRight: string;
  accent: string;
}

/**
 * Four readings taken from across the whole series rather than four numbers
 * off its last column.
 *
 * Every figure is read from `censusData.ts`, which is generated from
 * `data/data-1.csv`, so nothing here is typed by hand. The previous four
 * cards sat entirely on 2011 and shared nothing with the century of data the
 * dashboard now carries.
 */
const CARDS: Card[] = [
  {
    key: "opening",
    title: "India at the first census",
    value: compact(OPENING_CENSUS.population),
    note: "people · census of record",
    badge: String(OPENING_CENSUS.year),
    tone: "slate",
    year: OPENING_CENSUS.year,
    footLeft: "opens the series",
    footRight: `${CENTURY_MULTIPLE}× by ${LAST_CENSUS_YEAR}`,
    accent: "#06B6D4",
  },
  {
    key: "closing",
    title: "India at the latest census",
    value: compact(INDIA_2011.population),
    note: "people · census of record",
    badge: String(LAST_CENSUS_YEAR),
    tone: "green",
    year: LAST_CENSUS_YEAR,
    footLeft: `${compact(OPENING_CENSUS.population)} in ${FIRST_CENSUS_YEAR}`,
    footRight: `${CENTURY_MULTIPLE}× the century start`,
    accent: "#10B981",
  },
  {
    key: "peak",
    title: "Fastest decade on record",
    value: `+${PEAK_DECADAL.percentChange.toFixed(2)}%`,
    note: `${PEAK_DECADAL.from} → ${PEAK_DECADAL.to}`,
    badge: "PEAK RATE",
    tone: "amber",
    year: PEAK_DECADAL.to,
    footLeft: `+${compact(PEAK_DECADAL.absoluteChange)} people`,
    footRight: "never repeated",
    accent: "#FBBF24",
  },
  {
    key: "latest",
    title: "Slowest growth in 50 years",
    value: `+${LATEST_DECADAL.percentChange.toFixed(2)}%`,
    note: `${LATEST_DECADAL.from} → ${LATEST_DECADAL.to}`,
    badge: "COOLING",
    tone: "cyan",
    year: LATEST_DECADAL.to,
    footLeft: `+${compact(LATEST_DECADAL.absoluteChange)} people`,
    footRight: "2nd largest ever",
    accent: "#06B6D4",
  },
];

/** Category colours for the live community feed on the dashboard. */
const TAG_COLORS: Record<string, string> = {
  "Heat/Shade": "#F43F5E",
  "Bike Lane": "#06B6D4",
  "Transit Hub": "#FBBF24",
  "Tree Planting": "#10B981",
};

/**
 * The whole 1901-2011 series as one line, with this card's census year marked.
 *
 * All four cards share the same curve, so they read as four views of one
 * century rather than four unrelated statistics — which is the difference
 * between a card about 2011 and a card about where 2011 sits in 110 years.
 */
function CenturySpark({ year, accent }: { year: number; accent: string }) {
  const n = INDIA_DECADAL.length;
  const max = Math.max(...INDIA_DECADAL.map((p) => p.population));
  const x = (i: number) => 6 + (i / (n - 1)) * 84;
  const y = (v: number) => 34 - (v / max) * 26;
  const index = INDIA_DECADAL.findIndex((p) => p.year === year);
  const point = INDIA_DECADAL[index];
  const previous = INDIA_DECADAL[index - 1];

  return (
    <svg
      viewBox="0 0 96 40"
      className="h-10 w-20 shrink-0 sm:w-24"
      role="img"
      aria-label={`India population ${FIRST_CENSUS_YEAR} to ${LAST_CENSUS_YEAR}, marking ${year}`}
    >
      <line x1="6" y1="34" x2="90" y2="34" stroke="var(--nb-ink)" strokeWidth="2" />
      <polyline
        points={INDIA_DECADAL.map(
          (p, i) => `${x(i).toFixed(2)},${y(p.population).toFixed(2)}`,
        ).join(" ")}
        fill="none"
        stroke="#334155"
        strokeWidth="2"
        strokeLinejoin="miter"
      />
      {previous && (
        <polyline
          points={`${x(index - 1).toFixed(2)},${y(previous.population).toFixed(2)} ${x(index).toFixed(2)},${y(point.population).toFixed(2)}`}
          fill="none"
          stroke={accent}
          strokeWidth="3"
          strokeLinecap="square"
        />
      )}
      <rect
        x={x(index) - 3}
        y={y(point.population) - 3}
        width="6"
        height="6"
        fill={accent}
      />
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

      {/* Century baseline — every figure below is read from the uploaded CSVs */}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <h2 className="nb-title text-sm md:text-base">
          A Century Of Census
        </h2>
        <span className="nb-chip bg-[var(--nb-surface-2)] text-[var(--nb-text-muted)]">
          Census Of India · {FIRST_CENSUS_YEAR} → {LAST_CENSUS_YEAR}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {CARDS.map((card, index) => (
          <motion.article
            key={card.key}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: index * 0.05 }}
            className="nb-panel p-4 transition-transform duration-150 hover:scale-[1.01]"
          >
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-[11px] font-black uppercase leading-snug tracking-widest text-[var(--nb-text-muted)]">
                {card.title}
              </h2>
              <span
                className={`nb-chip whitespace-normal text-right ${TONES[card.tone]}`}
              >
                {card.badge}
              </span>
            </div>
            <div className="mt-4 flex items-end justify-between gap-3">
              <div>
                <p className="text-3xl font-black leading-none tabular-nums text-[var(--nb-text)]">
                  {card.value}
                </p>
                <p className="mt-1.5 text-[11px] font-bold uppercase tracking-wide text-[var(--nb-text-dim)]">
                  {card.note}
                </p>
              </div>
              <CenturySpark year={card.year} accent={card.accent} />
            </div>
            <div className="mt-4 flex items-center justify-between gap-2 border-t-2 border-[var(--nb-ink)] pt-2.5">
              <span className="text-[11px] font-black uppercase tracking-wide text-[var(--nb-text-dim)]">
                {card.footLeft}
              </span>
              <span
                className="whitespace-nowrap text-xs font-black tabular-nums"
                style={{ color: card.accent }}
              >
                {card.footRight}
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
            India Across The Census Tables
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
