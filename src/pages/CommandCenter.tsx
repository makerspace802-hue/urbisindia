import CensusCharts from "@/components/CensusCharts";
import DashboardCustomiser from "@/components/DashboardCustomiser";
import { Reveal, SlotValue } from "@/components/Retro";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
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
import {
  METRIC_CATALOGUE,
  metricDef,
  readMetric,
  type MetricReading,
} from "@/lib/dashboardPreferences";
import { useQuery } from "convex/react";
import { motion, useReducedMotion } from "framer-motion";
import { SlidersHorizontal } from "lucide-react";
import { useState } from "react";

/** Compact population formatting for the card values. */
const compact = (v: number) =>
  v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : v.toLocaleString("en-IN");

/** Shared spring for the dashboard's entry animations. */
const SPRING = { type: "spring" as const, stiffness: 300, damping: 25 };

/**
 * Badge fills.
 *
 * These stay literal on purpose — they are solid chips carrying near-black
 * text, not text on a card, and a chip background has no contrast
 * requirement of its own. What matters is that the badge never becomes a
 * *foreground* colour elsewhere, which is what the accent tokens are for.
 */
const TONES = {
  cyan: "bg-[#06B6D4] text-[#03151A]",
  green: "bg-[#10B981] text-[#04110C]",
  amber: "bg-[#FBBF24] text-[#1A1400]",
  slate: "bg-[#64748B] text-white",
} as const;

/**
 * Card entry.
 *
 * One shared definition so the two grids cannot drift: same 0.08s step, same
 * 20px rise, same spring. `staggerChildren` is what produces the sequence —
 * each child is given its own delay by the parent rather than each computing
 * `index * 0.08` here.
 */
const GRID = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};

const CARD_ENTRY = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: SPRING },
};

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
    accent: "var(--nb-cool)",
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
    accent: "var(--nb-gain)",
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
    accent: "var(--nb-warn)",
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
    accent: "var(--nb-cool)",
  },
];



/**
 * The whole 1901-2011 series as one line, with this card's census year marked.
 *
 * All four cards share the same curve, so they read as four views of one
 * century rather than four unrelated statistics — which is the difference
 * between a card about 2011 and a card about where 2011 sits in 110 years.
 *
 * The line draws itself with `stroke-dashoffset`. `pathLength={1}` normalises
 * the geometry, so the dash is set to a single unit and animating the offset
 * from 1 to 0 draws the whole polyline without ever measuring it — the
 * alternative is reading `getTotalLength()` in an effect, which would mean a
 * layout read on every card on every render. The endpoint marker pops in over
 * the last 0.3s of that draw.
 */
function CenturySpark({ year, accent }: { year: number; accent: string }) {
  const n = INDIA_DECADAL.length;
  const max = Math.max(...INDIA_DECADAL.map((p) => p.population));
  const x = (i: number) => 6 + (i / (n - 1)) * 84;
  const y = (v: number) => 34 - (v / max) * 26;
  const index = INDIA_DECADAL.findIndex((p) => p.year === year);
  const point = INDIA_DECADAL[index];
  const previous = INDIA_DECADAL[index - 1];
  const reduced = useReducedMotion();
  const draw = reduced
    ? { initial: false as const, animate: { strokeDashoffset: 0 } }
    : {
        initial: { strokeDashoffset: 1 },
        animate: { strokeDashoffset: 0 },
        transition: { duration: 1.2, ease: "easeOut" as const },
      };
  const pop = reduced
    ? { initial: false as const, animate: { scale: 1, opacity: 1 } }
    : {
        initial: { scale: 0, opacity: 0 },
        animate: { scale: 1, opacity: 1 },
        transition: { duration: 0.3, delay: 0.95, ease: "easeOut" as const },
      };

  return (
    <svg
      viewBox="0 0 96 40"
      className="h-10 w-20 shrink-0 sm:w-24"
      role="img"
      aria-label={`India population ${FIRST_CENSUS_YEAR} to ${LAST_CENSUS_YEAR}, marking ${year}`}
    >
      <line x1="6" y1="34" x2="90" y2="34" stroke="var(--nb-line)" strokeWidth="2" />
      <motion.polyline
        pathLength={1}
        strokeDasharray="1"
        strokeDashoffset={0}
        {...draw}
        points={INDIA_DECADAL.map(
          (p, i) => `${x(i).toFixed(2)},${y(p.population).toFixed(2)}`,
        ).join(" ")}
        fill="none"
        stroke="var(--nb-line)"
        strokeWidth="2"
        strokeLinejoin="miter"
      />
      {previous && (
        <motion.polyline
          pathLength={1}
          strokeDasharray="1"
          strokeDashoffset={0}
          {...draw}
          points={`${x(index - 1).toFixed(2)},${y(previous.population).toFixed(2)} ${x(index).toFixed(2)},${y(point.population).toFixed(2)}`}
          fill="none"
          stroke={accent}
          strokeWidth="3"
          strokeLinecap="square"
        />
      )}
      <motion.rect
        {...pop}
        // `fill-box` makes the transform origin resolve against the marker's
        // own box, so it scales out of itself rather than the SVG's corner.
        style={{ transformBox: "fill-box", transformOrigin: "center" }}
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

  /**
   * Personalisation.
   *
   * `prefs.state` is null until the resident picks one, and until then the
   * cards are aimed at the state the account chose. Every figure comes from
   * `readMetric`, which returns null for a metric the tables do not hold — that
   * card is dropped rather than shown as a zero.
   */
  const { isAuthenticated } = useAuth();
  const profile = useQuery(api.profile.myProfile);
  const prefs = useQuery(api.dashboard.myDashboard);
  const [customising, setCustomising] = useState(false);

  /**
   * Personalisation is for accounts only.
   *
   * A signed-out visitor sees the four India-wide cards and nothing else — no
   * Customise button and no personalised readings. Earlier this let someone
   * browse a layout they could never save, which read as broken: the controls
   * appeared, changed the page, and then reverted on reload. Since a layout
   * only means anything when it is attached to an account, the whole feature
   * is now behind sign-in rather than half-available.
   */
  const targetState = isAuthenticated ? (prefs?.state ?? null) : null;
  const readings: Array<{
    id: string;
    def: (typeof METRIC_CATALOGUE)[number];
    reading: MetricReading;
  }> = isAuthenticated
    ? (prefs?.metrics ?? [])
        .map((id) => {
          if (!targetState) return null;
          const def = metricDef(id);
          const reading = readMetric(targetState, id);
          return def && reading ? { id, def, reading } : null;
        })
        .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
    : [];

  

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-black uppercase tracking-tight text-[var(--nb-text)] md:text-3xl">
          Dashboard
        </h1>
        <span className="nb-chip bg-[var(--nb-surface-2)] text-[var(--nb-text-muted)]">{today}</span>
        {isAuthenticated && (
          <button
            type="button"
            onClick={() => setCustomising((value) => !value)}
            aria-expanded={customising}
            className="nb-btn bg-[#06B6D4] text-[#03151A]"
          >
            <SlidersHorizontal className="size-4" strokeWidth={3} />
            Customise
          </button>
        )}
      </div>

      {isAuthenticated && customising && (
        <DashboardCustomiser
          onClose={() => setCustomising(false)}
          signedIn={isAuthenticated}
          signedInEmail={profile?.email ?? ""}
        />
      )}

      {/* Personalised readings for the chosen state */}
      {readings.length > 0 && (
        <section className="mt-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="nb-title text-sm md:text-base">
              {targetState} — Your Figures
            </h2>
            <span className="nb-chip bg-[#FBBF24] text-[#1A1400]">
              Census Of India · {LAST_CENSUS_YEAR}
            </span>
          </div>
          <motion.div
            variants={GRID}
            initial="hidden"
            animate="show"
            className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
          >
            {readings.map((entry) => (
              <motion.article
                key={entry.id}
                variants={CARD_ENTRY}
                className="nb-panel nb-card-lift p-4"
              >
                <h3 className="text-[11px] font-black uppercase leading-snug tracking-widest text-[var(--nb-text-muted)]">
                  {entry.def.title}
                </h3>
                <SlotValue
                  value={entry.reading.value}
                  className="mt-3 block text-3xl font-black leading-none tabular-nums text-[var(--nb-text)]"
                />
                <p className="mt-1.5 text-[11px] font-bold uppercase tracking-wide text-[var(--nb-text-dim)]">
                  {entry.reading.note}
                </p>
                <p className="mt-3 border-t-2 border-[var(--nb-ink)] pt-2 text-[10px] font-black uppercase tracking-wide text-[var(--nb-text-dim)]">
                  {entry.def.unit}
                </p>
              </motion.article>
            ))}
          </motion.div>
        </section>
      )}

      {/* Century baseline — every figure below is read from the uploaded CSVs */}
      {prefs?.showNational !== false && (
      <>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <h2 className="nb-title text-sm md:text-base">
          A Century Of Census
        </h2>
        <span className="nb-chip bg-[var(--nb-surface-2)] text-[var(--nb-text-muted)]">
          Census Of India · {FIRST_CENSUS_YEAR} → {LAST_CENSUS_YEAR}
        </span>
      </div>

      <Reveal>
        <motion.div
          variants={GRID}
          initial="hidden"
          animate="show"
          className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
        >
        {CARDS.map((card) => (
          <motion.article
            key={card.key}
            variants={CARD_ENTRY}
            className="nb-panel nb-card-lift p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-[11px] font-black uppercase leading-snug tracking-widest text-[var(--nb-text-muted)]">
                {card.title}
              </h2>
              <span
                className={`nb-chip nb-neon-tag whitespace-normal text-right ${TONES[card.tone]}`}
              >
                {card.badge}
              </span>
            </div>
            <div className="mt-4 flex items-end justify-between gap-3">
              <div>
                <SlotValue
                  value={card.value}
                  className="block text-3xl font-black leading-none tabular-nums text-[var(--nb-text)]"
                />
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
        </motion.div>
      </Reveal>
      </>
      )}

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
