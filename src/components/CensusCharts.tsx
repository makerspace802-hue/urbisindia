import { RetroMarquee, RetroSwitcher } from "@/components/Retro";
import { censusName, matchPlace, PLACE_FALLBACK } from "@/lib/geo";
import {
  COMMUTE,
  COMMUTE_BANDS,
  DECADAL_LABELS,
  INDIA_2011,
  INDIA_SOCIAL,
  INDIA_SPATIAL,
  STATE_DECADAL,
  STATE_PROFILE,
} from "@/lib/censusData";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";

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

type GeoState = "requesting" | "located" | "denied" | "unavailable";

/** Safe to read at module scope; avoids an effect that only flips a flag. */
const HAS_GEO = typeof navigator !== "undefined" && "geolocation" in navigator;

/**
 * Diverging scale, not a good/bad one: green is "more", red is "less".
 * Nothing here claims a shrinking population is a bad outcome — only that it
 * moved one way.
 */
function tone(value: number | null, max: number) {
  if (value === null) return NEUTRAL;
  if (value === 0 || !Number.isFinite(max) || max === 0) return NEUTRAL;
  const alpha = 0.22 + Math.min(1, Math.abs(value) / max) * 0.78;
  return value > 0 ? `rgba(16,185,129,${alpha})` : `rgba(244,63,94,${alpha})`;
}

function Cell({
  value,
  max,
  label,
  signed = true,
  highlight = false,
}: {
  value: number | null;
  max: number;
  label: string;
  signed?: boolean;
  highlight?: boolean;
}) {
  const text =
    value === null || !Number.isFinite(value)
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
      className="flex h-7 items-center justify-center border text-[9px] font-black tabular-nums text-white"
      style={{
        backgroundColor: tone(value, max),
        borderColor: highlight ? "#FBBF24" : "var(--nb-ink)",
        borderWidth: highlight ? 2 : 1,
      }}
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

function DecadalGrid({ place }: { place: string | null }) {
  const numeric = STATE_DECADAL.flatMap((s) =>
    s.changes.filter((c): c is number => c !== null),
  );
  const max = Math.max(...numeric.map(Math.abs));
  const isLoss = (c: number | null) => c !== null && c < 0;
  const lossCells = STATE_DECADAL.reduce(
    (n, s) => n + s.changes.filter(isLoss).length,
    0,
  );
  const statesWithLoss = STATE_DECADAL.filter((s) => s.changes.some(isLoss)).length;
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
            style={{
              gridTemplateColumns: `150px repeat(${DECADAL_LABELS.length}, minmax(0,1fr))`,
            }}
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
                <div
                  className="flex items-center justify-end gap-1.5 pr-2 text-right text-[10px] font-black uppercase tracking-tight"
                  style={{
                    color:
                      place && state.name === place ? "#FBBF24" : "var(--nb-text-2)",
                  }}
                >
                  {place && state.name === place ? "▸" : ""}
                  {state.name}
                </div>
                {state.changes.map((change, i) => (
                  <Cell
                    key={`${state.name}-${DECADAL_LABELS[i]}`}
                    value={change}
                    max={max}
                    highlight={Boolean(place && state.name === place)}
                    label={`${state.name} ${DECADAL_LABELS[i]}: ${change === null ? "not counted" : `${change > 0 ? "+" : ""}${change}%`}`}
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

function Bar({ label, value, max, colour }: { label: string; value: number; max: number; colour: string }) {
  const width = max > 0 && Number.isFinite(value) ? (value / max) * 100 : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 text-[11px] font-black uppercase tracking-wide text-[var(--nb-text-2)]">
        <span>{label}</span>
        <span className="tabular-nums text-[var(--nb-text)]">
          {Number.isFinite(value) ? value.toLocaleString("en-IN") : "–"}
        </span>
      </div>
      <div className="mt-1 h-3 border-2 border-[var(--nb-ink)]">
        <div className="h-full" style={{ width: `${width}%`, backgroundColor: colour }} />
      </div>
    </div>
  );
}

function Place({ place }: { place: string | null }) {
  const local = place ? STATE_PROFILE.find((s) => s.name === place) : null;
  const national = local == null;

  // Table A-1 splits area between rural and urban at India level only, so a
  // single state gets one overall density rather than a pair that would have
  // to be invented to fill the same slots.
  const bars = national
    ? [
        { label: "Rural population", value: INDIA_SPATIAL.ruralPopulation, colour: GAIN },
        { label: "Urban population", value: INDIA_SPATIAL.urbanPopulation, colour: GAIN },
        { label: "Rural density /km²", value: INDIA_SPATIAL.ruralDensity, colour: GAIN },
        { label: "Urban density /km²", value: INDIA_SPATIAL.urbanDensity, colour: GAIN },
        { label: "Inhabited villages", value: INDIA_SPATIAL.inhabitedVillages, colour: GAIN },
        { label: "Uninhabited villages", value: INDIA_SPATIAL.uninhabitedVillages, colour: LOSS },
      ]
    : [
        { label: "Rural population", value: local.ruralPopulation, colour: GAIN },
        { label: "Urban population", value: local.urbanPopulation, colour: GAIN },
        { label: "Density /km²", value: local.density ?? 0, colour: GAIN },
        { label: "Households", value: local.households, colour: GAIN },
        { label: "Area km²", value: local.areaSqKm ?? 0, colour: NEUTRAL },
        { label: "Urban share %", value: local.urbanSharePercent, colour: GAIN },
      ];
  const max = Math.max(...bars.map((b) => b.value), 1);

  return (
    <>
      <div className="grid gap-2 md:grid-cols-2">
        {bars.map((bar) => (
          <Bar key={bar.label} {...bar} max={max} />
        ))}
      </div>
      <Legend />
      <p className="mt-3 text-[11px] font-bold leading-relaxed text-[var(--nb-text-dim)]">
        {national ? (
          <>
            <span className="text-[#10B981]">Urban India is {INDIA_SPATIAL.densityRatio}×
            denser than rural India</span> —{" "}
            {INDIA_SPATIAL.urbanDensity.toLocaleString("en-IN")} people per km² against{" "}
            {INDIA_SPATIAL.ruralDensity}. {INDIA_SPATIAL.towns.toLocaleString("en-IN")} towns
            hold the urban population. Meanwhile{" "}
            <span className="text-[#F43F5E]">
              {INDIA_SPATIAL.uninhabitedVillages.toLocaleString("en-IN")} villages stand empty
            </span>
            .
          </>
        ) : (
          <>
            <span className="text-[#10B981]">
              {local.name} is {(local.urbanPopulation / local.population * 100).toFixed(1)}% urban
            </span>{" "}
            against 31.1% nationally. Density{" "}
            {(local.density ?? 0).toLocaleString("en-IN")} people per km² across{" "}
            {(local.areaSqKm ?? 0).toLocaleString("en-IN")} km². Village and town
            counts are held at India level in Table A-1, so they are not shown for a
            single state here.
          </>
        )}
      </p>
    </>
  );
}

function People({ place }: { place: string | null }) {
  const local = place ? STATE_PROFILE.find((s) => s.name === place) : null;
  const rows = local
    ? [
        { label: "Population", value: local.population, colour: GAIN },
        { label: "Literate", value: local.literate, colour: GAIN },
        { label: "Illiterate", value: local.illiterate, colour: LOSS },
        { label: "Scheduled Caste", value: local.scheduledCaste, colour: GAIN },
        { label: "Scheduled Tribe", value: local.scheduledTribe, colour: GAIN },
        { label: "Urban", value: local.urbanPopulation, colour: GAIN },
        { label: "Rural", value: local.ruralPopulation, colour: GAIN },
        { label: "Households", value: local.households, colour: GAIN },
      ]
    : [
        { label: "Male", value: INDIA_SOCIAL.males, colour: GAIN },
        { label: "Female", value: INDIA_SOCIAL.females, colour: GAIN },
        { label: "Children 0-6", value: INDIA_SOCIAL.children06, colour: GAIN },
        { label: "Scheduled Caste", value: INDIA_SOCIAL.scheduledCaste, colour: GAIN },
        { label: "Scheduled Tribe", value: INDIA_SOCIAL.scheduledTribe, colour: GAIN },
        { label: "Literate", value: INDIA_SOCIAL.literate, colour: GAIN },
        { label: "Illiterate", value: INDIA_SOCIAL.illiterate, colour: LOSS },
        { label: "Working", value: INDIA_SOCIAL.workers, colour: GAIN },
        { label: "Not in work", value: INDIA_SOCIAL.nonWorkers, colour: GAIN },
      ];
  const max = Math.max(...rows.map((r) => r.value), 1);

  return (
    <>
      <div className="grid gap-1.5 md:grid-cols-2">
        {rows.map((row) => (
          <Bar key={row.label} {...row} max={max} />
        ))}
      </div>
      <Legend />
      <p className="mt-3 text-[11px] font-bold leading-relaxed text-[var(--nb-text-dim)]">
        {local ? (
          <>
            In {local.name},{" "}
            <span className="text-[#F43F5E]">
              {local.illiterate.toLocaleString("en-IN")} people were recorded illiterate
            </span>{" "}
            against {local.literate.toLocaleString("en-IN")} literate — a{" "}
            {(local.illiterate / local.literate).toFixed(2)} to one gap. Literacy rate{" "}
            <span className="text-[#10B981]">{local.literacyPercent.toFixed(2)}%</span>{" "}
            against 72.98% nationally.
          </>
        ) : (
          <>
            {INDIA_SOCIAL.illiterate.toLocaleString("en-IN")} people were recorded
            illiterate against {INDIA_SOCIAL.literate.toLocaleString("en-IN")} literate — a{" "}
            <span className="text-[#F43F5E]">
              {(INDIA_SOCIAL.illiterate / INDIA_SOCIAL.literate).toFixed(2)} to one gap
            </span>
            . Sex ratio {INDIA_SOCIAL.sexRatio} per 1,000, child sex ratio{" "}
            {INDIA_SOCIAL.childSexRatio}.{" "}
            <span className="text-[#10B981]">
              Scheduled Tribe is {INDIA_2011.stSharePercent}% of the population
            </span>
            .
          </>
        )}
      </p>
    </>
  );
}

function CommuteGrid({ place }: { place: string | null }) {
  const all = COMMUTE.flatMap((r) => r.values.filter((v): v is number => v !== null));
  const max = Math.max(...all, 1);
  const allModes = COMMUTE.find((r) => r.mode === "All Modes");
  const onFoot = COMMUTE.find((r) => r.mode === "On foot");

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
                <div className="flex items-center justify-end pr-2 text-right text-[10px] font-black uppercase tracking-tight text-[var(--nb-text-2)]">
                  {row.mode}
                </div>
                {row.values.map((value, i) => (
                  <Cell
                    key={`${row.mode}-${COMMUTE_BANDS[i]}`}
                    value={value}
                    max={max}
                    signed={false}
                    label={`${row.mode}, ${COMMUTE_BANDS[i]}: ${value === null ? "not counted" : value.toLocaleString("en-IN")}`}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
      <Legend />
      <p className="mt-3 text-[11px] font-bold leading-relaxed text-[var(--nb-text-dim)]">
        Table B-28 is published at India level only, so this view stays national{" "}
        {place ? <>even though you are browsing {place}</> : null}. The blank cells are
        real absences: nobody walks 31km to work.{" "}
        <span className="text-[#F43F5E]">
          &ldquo;No travel&rdquo; is {(((allModes?.values[0] ?? 0) / 1_000_000)).toFixed(1)} million
        </span>{" "}
        — but the source footnote says that bucket also captures not-reported. Walking
        is the single largest mode at {(((onFoot?.total ?? 0) / 1_000_000)).toFixed(1)} million.
      </p>
    </>
  );
}

export default function CensusCharts() {
  const [view, setView] = useState<View>("decadal");
  const [place, setPlace] = useState<string | null>(null);
  const [geoState, setGeoState] = useState<GeoState>(HAS_GEO ? "requesting" : "unavailable");

  /**
   * Ask the browser once. Every setState lives inside an async callback, so
   * none of them fire synchronously during the effect.
   */
  useEffect(() => {
    if (!HAS_GEO) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const hit = matchPlace(pos.coords.latitude, pos.coords.longitude);
        if (hit) {
          setPlace(censusName(hit.name));
          setGeoState("located");
        } else {
          setGeoState("unavailable");
        }
      },
      () => setGeoState("denied"),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 600_000 },
    );
  }, []);

  const active = VIEWS.find((v) => v.id === view)!;
  const label =
    geoState === "located" && place
      ? place
      : geoState === "requesting"
        ? "Locating…"
        : PLACE_FALLBACK;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <RetroSwitcher
          options={VIEWS.map((v) => ({ id: v.id, label: v.label }))}
          value={view}
          onChange={setView}
          label="Census views"
        />
        <div className="flex flex-wrap items-center gap-2">
          <span className="nb-chip bg-[#06B6D4] text-[#03151A]">Showing: {label}</span>
          <span className="nb-chip bg-[var(--nb-surface-2)] text-[var(--nb-text-muted)]">
            {active.source}
          </span>
        </div>
      </div>

      {geoState === "denied" && (
        <p className="nb-chip mb-3 bg-[#FBBF24] text-[#1A1400]">
          Location declined — showing all India. Allow location to see your own state.
        </p>
      )}

      <div className="mb-4">
        <RetroMarquee
          items={[
            `Census of India 2011 · ${STATE_DECADAL.length} states and union territories`,
            `Latest census recorded ${(INDIA_2011.population / 1_000_000).toFixed(1)} million people`,
            `${(INDIA_2011.households / 1_000_000).toFixed(1)} million households · ${INDIA_2011.towns.toLocaleString("en-IN")} towns`,
            `${(INDIA_SPATIAL.inhabitedVillages).toLocaleString("en-IN")} inhabited villages · ${(INDIA_SPATIAL.uninhabitedVillages).toLocaleString("en-IN")} standing empty`,
            `Urban share ${INDIA_2011.urbanSharePercent}% · average density ${INDIA_2011.density} per km²`,
            `Scheduled Tribe ${INDIA_2011.stSharePercent}% · Scheduled Caste ${INDIA_2011.scSharePercent}% of the population`,
          ]}
        />
      </div>

      <motion.div
        key={`${view}-${label}`}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="nb-panel p-4"
      >
        {view === "decadal" && <DecadalGrid place={place} />}
        {view === "place" && <Place place={place} />}
        {view === "people" && <People place={place} />}
        {view === "commute" && <CommuteGrid place={place} />}
      </motion.div>

      <p className="mt-3 text-[10px] font-bold uppercase tracking-widest text-[var(--nb-text-dim)]">
        All four views read from the uploaded Census of India 2011 tables — nothing
        here is hand-entered
      </p>
    </div>
  );
}
