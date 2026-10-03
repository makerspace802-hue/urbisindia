import {
  COMMUTE,
  COMMUTE_BANDS,
  DECADAL_LABELS,
  INDIA_2011,
  INDIA_SOCIAL,
  INDIA_SPATIAL,
  STATE_DECADAL,
} from "@/lib/censusData";
import { motion } from "framer-motion";
import { useState } from "react";

const GAIN = "#10B981";
const LOSS = "#F43F5E";
const NEUTRAL = "#64748B";

type View = "decadal" | "place" | "people" | "commute";

const VIEWS: { id: View; label: string; source: string }[] = [
  { id: "decadal", label: "Every Census", source: "Table A-2 · data-1.csv" },
  { id: "place", label: "Where We Live", source: "Table A-1 · data-2.csv" },
  { id: "people", label: "Who We Are", source: "Census Abstract · data-4.csv" },
  { id: "commute", label: "Getting To Work", source: "Table B-28 · data-3.csv" },
];

/**
 * Colour for a signed magnitude.
 *
 * A diverging scale rather than a good/bad one: green is "more", red is
 * "less", and nothing here claims that a shrinking population or a shorter
 * commute is a bad outcome — only that it moved one way.
 */
function tone(value: number | null, max: number) {
  if (value === null) return NEUTRAL;
  if (value === 0) return NEUTRAL;
  const strength = Math.min(1, Math.abs(value) / max);
  const alpha = 0.22 + strength * 0.78;
  return value > 0 ? `rgba(16,185,129,${alpha})` : `rgba(244,63,94,${alpha})`;
}

function Cell({
  value,
  max,
  label,
  signed = true,
}: {
  value: number | null;
  max: number;
  label: string;
  signed?: boolean;
}) {
  const text =
    value === null
      ? "–"
      : signed
        ? `${value > 0 ? "+" : ""}${value.toFixed(1)}`
        : value >= 1_000_000
          ? `${(value / 1_000_000).toFixed(1)}M`
          : value >= 1_000
            ? `${(value / 1_000).toFixed(0)}K`
            : String(value);
  return (
    <div
      title={label}
      className="flex h-7 items-center justify-center border border-[var(--nb-ink)] text-[9px] font-black tabular-nums text-white"
      style={{ backgroundColor: tone(value, max) }}
    >
      {text}
    </div>
  );
}

function Legend() {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t-2 border-[var(--nb-ink)] pt-2.5 text-[10px] font-black uppercase tracking-wide">
      <span className="flex items-center gap-1.5">
        <span className="inline-block h-3 w-3" style={{ backgroundColor: GAIN }} />
        gain
      </span>
      <span className="flex items-center gap-1.5">
        <span className="inline-block h-3 w-3" style={{ backgroundColor: LOSS }} />
        loss
      </span>
      <span className="flex items-center gap-1.5">
        <span className="inline-block h-3 w-3" style={{ backgroundColor: NEUTRAL }} />
        no figure / not applicable
      </span>
      <span className="text-[var(--nb-text-dim)]">darker = larger</span>
    </div>
  );
}

/**
 * Every state across every decadal.
 *
 * The previous version ranked states on 2001->2011 alone, where only Nagaland
 * declined and the chart could not show a loss at all. Spanning the full series
 * surfaces 23 declining state-decades across 20 of the 35 units.
 */
function DecadalGrid() {
  const max = Math.max(
    ...STATE_DECADAL.flatMap((s) => s.changes.filter((c): c is number => c !== null).map(Math.abs)),
  );

  // Derived rather than written into the copy, so the sentence under the chart
  // cannot drift away from the squares above it.
  const isLoss = (c: number | null) => c !== null && c < 0;
  const lossCells = STATE_DECADAL.reduce(
    (n, s) => n + s.changes.filter(isLoss).length,
    0,
  );
  const statesWithLoss = STATE_DECADAL.filter((s) =>
    s.changes.some(isLoss),
  ).length;
  const collapsed = STATE_DECADAL.filter((s) => isLoss(s.changes[1])).length;
  const worst = STATE_DECADAL.flatMap((s) =>
    s.changes.map((c, i) => ({ c, i, name: s.name })),
  )
    .filter((r) => r.c !== null)
    .sort((a, b) => (a.c as number) - (b.c as number))[0];

  return (
    <>
      <div className="overflow-x-auto">
        <div className="min-w-[760px]">
          <div
            className="grid gap-1"
            style={{ gridTemplateColumns: `150px repeat(${DECADAL_LABELS.length}, minmax(0,1fr))` }}
          >
            <div />
            {DECADAL_LABELS.map((label) => (
              <div
                key={label}
                className="pb-1 text-center text-[9px] font-black uppercase tracking-tight text-[var(--nb-text-muted)]"
              >
                {label}
              </div>
            ))}
            {STATE_DECADAL.map((state) => (
              <div key={state.name} className="contents">
                <div className="flex items-center pr-2 text-right text-[10px] font-black uppercase tracking-tight text-[var(--nb-text-2)]">
                  {state.name}
                </div>
                {state.changes.map((change, i) => (
                  <Cell
                    key={`${state.name}-${DECADAL_LABELS[i]}`}
                    value={change}
                    max={max}
                    label={`${state.name} ${DECADAL_LABELS[i]}: ${change === null ? "no figure" : `${change > 0 ? "+" : ""}${change}%`}`}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
      <Legend />
      <p className="mt-3 text-[11px] font-bold leading-relaxed text-[var(--nb-text-dim)]">
        {statesWithLoss} of {STATE_DECADAL.length} states lost population in at
        least one decade — {lossCells} losses in total.{" "}
        <span className="text-[#F43F5E]">
          1911-21 was catastrophic, with {collapsed} states falling
        </span>{" "}
        and {worst.name} down {Math.abs(worst.c as number).toFixed(1)}% in{" "}
        {DECADAL_LABELS[worst.i]}. The last decade was the gentlest on record:
        only Nagaland shrank. Blank squares are censuses a unit was not counted
        in, not missing data.
      </p>
    </>
  );
}

function Place() {
  const s = INDIA_SPATIAL;
  const bars = [
    { label: "Rural population", value: s.ruralPopulation, colour: GAIN },
    { label: "Urban population", value: s.urbanPopulation, colour: GAIN },
    { label: "Rural density /km²", value: s.ruralDensity, colour: GAIN },
    { label: "Urban density /km²", value: s.urbanDensity, colour: GAIN },
    { label: "Inhabited villages", value: s.inhabitedVillages, colour: GAIN },
    { label: "Uninhabited villages", value: s.uninhabitedVillages, colour: LOSS },
  ];
  const max = Math.max(...bars.map((b) => b.value));

  return (
    <>
      <div className="grid gap-2 md:grid-cols-2">
        {bars.map((bar) => (
          <div key={bar.label}>
            <div className="flex items-baseline justify-between gap-2 text-[11px] font-black uppercase tracking-wide text-[var(--nb-text-2)]">
              <span>{bar.label}</span>
              <span className="tabular-nums text-[var(--nb-text)]">
                {bar.value.toLocaleString("en-IN")}
              </span>
            </div>
            <div className="mt-1 h-3 border-2 border-[var(--nb-ink)]">
              <div
                className="h-full"
                style={{
                  width: `${(bar.value / max) * 100}%`,
                  backgroundColor: bar.colour,
                }}
              />
            </div>
          </div>
        ))}
      </div>
      <Legend />
      <p className="mt-3 text-[11px] font-bold leading-relaxed text-[var(--nb-text-dim)]">
        <span className="text-[#10B981]">Urban India is {s.densityRatio}× denser
        than rural India</span> — {s.urbanDensity.toLocaleString("en-IN")} people
        per km² against {s.ruralDensity}. {s.towns.toLocaleString("en-IN")} towns
        hold the urban population, spread across only{" "}
        {Math.round(s.urbanAreaSqKm).toLocaleString("en-IN")} km². Meanwhile{" "}
        <span className="text-[#F43F5E]">
          {s.uninhabitedVillages.toLocaleString("en-IN")} villages stand empty
        </span>
        .
      </p>
    </>
  );
}

function People() {
  const p = INDIA_SOCIAL;
  const rows = [
    { label: "Male", value: p.males },
    { label: "Female", value: p.females },
    { label: "Children 0-6", value: p.children06 },
    { label: "Scheduled Caste", value: p.scheduledCaste },
    { label: "Scheduled Tribe", value: p.scheduledTribe },
    { label: "Literate", value: p.literate },
    { label: "Illiterate", value: p.illiterate },
    { label: "Working", value: p.workers },
    { label: "Not in work", value: p.nonWorkers },
  ];
  const max = Math.max(...rows.map((r) => r.value));

  return (
    <>
      <div className="grid gap-1.5 md:grid-cols-2">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center gap-2">
            <span className="w-28 shrink-0 text-[10px] font-black uppercase tracking-tight text-[var(--nb-text-2)]">
              {row.label}
            </span>
            <div className="h-5 flex-1 border-2 border-[var(--nb-ink)]">
              <div
                className="h-full"
                style={{
                  width: `${(row.value / max) * 100}%`,
                  backgroundColor: GAIN,
                }}
              />
            </div>
            <span className="w-16 shrink-0 text-right text-[10px] font-black tabular-nums text-[var(--nb-text)]">
              {row.value.toLocaleString("en-IN")}
            </span>
          </div>
        ))}
      </div>
      <Legend />
      <p className="mt-3 text-[11px] font-bold leading-relaxed text-[var(--nb-text-dim)]">
        {" "}
        {p.illiterate.toLocaleString("en-IN")} people were recorded illiterate
        against {p.literate.toLocaleString("en-IN")} literate — a{" "}
        <span className="text-[#F43F5E]">
          {(p.illiterate / p.literate).toFixed(2)} to one gap
        </span>
        . Sex ratio {p.sexRatio} per 1,000, child sex ratio{" "}
        {p.childSexRatio}.{" "}
        <span className="text-[#10B981]">
          Scheduled Tribe is {INDIA_2011.stSharePercent}% of the population
        </span>
        .
      </p>
    </>
  );
}

function CommuteGrid() {
  const max = Math.max(...COMMUTE.flatMap((r) => r.values.filter((v): v is number => v !== null)));
  const allModes = COMMUTE.find((r) => r.mode === "All Modes");

  return (
    <>
      <div className="overflow-x-auto">
        <div className="min-w-[720px]">
          <div
            className="grid gap-1"
            style={{ gridTemplateColumns: `170px repeat(${COMMUTE_BANDS.length}, minmax(0,1fr))` }}
          >
            <div />
            {COMMUTE_BANDS.map((band) => (
              <div
                key={band}
                className="pb-1 text-center text-[9px] font-black uppercase tracking-tight text-[var(--nb-text-muted)]"
              >
                {band}
              </div>
            ))}
            {COMMUTE.map((row) => (
              <div key={row.mode} className="contents">
                <div className="flex items-center pr-2 text-right text-[10px] font-black uppercase tracking-tight text-[var(--nb-text-2)]">
                  {row.mode}
                </div>
                {row.values.map((value, i) => (
                  <Cell
                    key={`${row.mode}-${COMMUTE_BANDS[i]}`}
                    value={value}
                    max={max}
                    signed={false}
                    label={`${row.mode}, ${COMMUTE_BANDS[i]}: ${value === null ? "no figure" : value.toLocaleString("en-IN")}`}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
      <Legend />
      <p className="mt-3 text-[11px] font-bold leading-relaxed text-[var(--nb-text-dim)]">
        The black cells are real absences: nobody walks 31km to work and nobody
        cycles it by train.{" "}
        <span className="text-[#F43F5E]">
          &ldquo;No travel&rdquo; is {((allModes?.values[0] ?? 0) / 1_000_000).toFixed(1)} million
        </span>{" "}
        — but the source footnote says that bucket also captures not-reported,
        so it is kept separate rather than counted as a commute. Walking is the
        single largest mode at{" "}
        {(((COMMUTE.find((r) => r.mode === "On foot")?.total ?? 0) / 1_000_000)).toFixed(1)}{" "}
        million.
      </p>
    </>
  );
}

export default function CensusCharts() {
  const [view, setView] = useState<View>("decadal");
  const active = VIEWS.find((v) => v.id === view)!;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-0">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => setView(v.id)}
              className={`nb-btn text-xs ${
                view === v.id
                  ? "bg-[#10B981] text-[#04110C]"
                  : "bg-[var(--nb-surface-2)] text-[var(--nb-text-2)]"
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
        <span className="nb-chip bg-[var(--nb-surface-2)] text-[var(--nb-text-muted)]">
          {active.source}
        </span>
      </div>

      <motion.div
        key={view}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="nb-panel p-4"
      >
        {view === "decadal" && <DecadalGrid />}
        {view === "place" && <Place />}
        {view === "people" && <People />}
        {view === "commute" && <CommuteGrid />}
      </motion.div>

      <p className="mt-3 text-[10px] font-bold uppercase tracking-widest text-[var(--nb-text-dim)]">
        All four views read from the uploaded Census of India 2011 tables —
        nothing here is hand-entered
      </p>
    </div>
  );
}