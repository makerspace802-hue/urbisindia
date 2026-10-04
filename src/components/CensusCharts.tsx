import { RetroMarquee, RetroSwitcher } from "@/components/Retro";
import { LocationPulse } from "@/components/LocationPulse";
import { PLACE_FALLBACK } from "@/lib/geo";
import { heatFill } from "@/lib/heatScale";
import { useLocation } from "@/lib/locationContext";
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
import { useState } from "react";

/*
 * Bar and inline-figure colours.
 *
 * These were literals. As *fills* that was fine, but the same values were also
 * printed as text in the summary paragraphs and the card footers, where
 * #FBBF24 measures 1.67:1 on the white card and is effectively invisible.
 * They are now theme tokens: neon on the navy panel, a legible dark step on
 * white. Same hues, both modes readable.
 */
const GAIN = "var(--nb-gain)";
const LOSS = "var(--nb-loss)";
const NEUTRAL = "var(--nb-text-dim)";

type View = "decadal" | "place" | "people" | "commute";

const VIEWS: { id: View; label: string }[] = [
  { id: "decadal", label: "Every Census" },
  { id: "place", label: "Where We Live" },
  { id: "people", label: "Who We Are" },
  { id: "commute", label: "Getting To Work" },
];

type GeoState = "requesting" | "located" | "denied" | "unavailable";

/**
 * Diverging scale, not a good/bad one: green is "more", red is "less".
 * Nothing here claims a shrinking population is a bad outcome — only that it
 * moved one way.
 *
 * The scale itself lives in `lib/heatScale.ts`, where it can be checked against
 * the WCAG contrast rules by running it. It was previously an alpha wash under
 * hard-coded white text, which put figures at 1.42:1 in light mode.
 */
function tone(value: number | null, max: number) {
  return heatFill(value, max);
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
  const fill = tone(value, max);
  return (
    <div
      title={label}
      className={`${fill.className} flex h-7 items-center justify-center border text-[11px] font-black tabular-nums`}
      style={{
        borderColor: highlight ? "var(--nb-warn)" : "var(--nb-line)",
        borderWidth: highlight ? 2 : 1,
      }}
    >
      {text}
    </div>
  );
}

function Legend() {
  // The swatches show the real ends of the ramp rather than one flat brand
  // colour, so the legend actually describes what the cells look like.
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t-2 border-[var(--nb-ink)] pt-2.5 text-[10px] font-black uppercase tracking-wide">
      <span className="flex items-center gap-1.5">
        <span
          className="inline-block h-3 w-3 border border-[var(--nb-line)]"
          style={{ backgroundColor: GAIN }}
        />
        gain
      </span>
      <span className="flex items-center gap-1.5">
        <span
          className="inline-block h-3 w-3 border border-[var(--nb-line)]"
          style={{ backgroundColor: LOSS }}
        />
        loss
      </span>
      <span className="flex items-center gap-1.5">
        <span
          className="inline-block h-3 w-3 border border-[var(--nb-line)]"
          style={{ backgroundColor: NEUTRAL }}
        />
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
      <div className="-mx-1 overflow-x-auto px-1">
        <div className="min-w-[560px]">
          <div
            className="grid gap-1"
            style={{
              gridTemplateColumns: `minmax(104px, 150px) repeat(${DECADAL_LABELS.length}, minmax(44px, 1fr))`,
            }}
          >
            <div />
            {DECADAL_LABELS.map((label) => (
              <div
                key={label}
                className="bg-[var(--nb-table-head)] py-0.5 text-center text-[9px] font-black uppercase tracking-tight text-[var(--nb-text-muted)]"
              >
                {label}
              </div>
            ))}
            {STATE_DECADAL.map((state) => (
              <div key={state.name} className="contents">
                {/*
                  Sticky on purpose: the grid is wider than a phone, so without
                  this the decade headings scroll away and every cell becomes an
                  anonymous number. Pinning the name keeps each figure attached to
                  its state while the decades scroll under it.
                */}
                <div
                  className="sticky left-0 z-10 flex items-center justify-end gap-1.5 bg-[var(--nb-table-row)] pr-2 text-right text-[10px] font-black uppercase tracking-tight"
                  style={{
                    color:
                      place && state.name === place
                        ? "var(--nb-warn)"
                        : "var(--nb-text-2)",
                    boxShadow: "2px 0 0 0 var(--nb-ink)",
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
      {/* Only shown where the grid genuinely overflows. */}
      <p className="mt-2 text-[10px] font-black uppercase tracking-wide text-[var(--nb-text-dim)] sm:hidden">
        Swipe the table sideways for the later censuses →
      </p>
      <p className="mt-3 text-[11px] font-bold leading-relaxed text-[var(--nb-text-dim)]">
        {statesWithLoss} of {STATE_DECADAL.length} states lost population in at
        least one decade — {lossCells} losses in total.{" "}
        <span className="text-[var(--nb-loss)]">
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
            <span className="text-[var(--nb-gain)]">Urban India is {INDIA_SPATIAL.densityRatio}×
            denser than rural India</span> —{" "}
            {INDIA_SPATIAL.urbanDensity.toLocaleString("en-IN")} people per km² against{" "}
            {INDIA_SPATIAL.ruralDensity}. {INDIA_SPATIAL.towns.toLocaleString("en-IN")} towns
            hold the urban population. Meanwhile{" "}
            <span className="text-[var(--nb-loss)]">
              {INDIA_SPATIAL.uninhabitedVillages.toLocaleString("en-IN")} villages stand empty
            </span>
            .
          </>
        ) : (
          <>
            <span className="text-[var(--nb-gain)]">
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
            <span className="text-[var(--nb-loss)]">
              {local.illiterate.toLocaleString("en-IN")} people were recorded illiterate
            </span>{" "}
            against {local.literate.toLocaleString("en-IN")} literate — a{" "}
            {(local.illiterate / local.literate).toFixed(2)} to one gap. Literacy rate{" "}
            <span className="text-[var(--nb-gain)]">{local.literacyPercent.toFixed(2)}%</span>{" "}
            against 72.98% nationally.
          </>
        ) : (
          <>
            {INDIA_SOCIAL.illiterate.toLocaleString("en-IN")} people were recorded
            illiterate against {INDIA_SOCIAL.literate.toLocaleString("en-IN")} literate — a{" "}
            <span className="text-[var(--nb-loss)]">
              {(INDIA_SOCIAL.illiterate / INDIA_SOCIAL.literate).toFixed(2)} to one gap
            </span>
            . Sex ratio {INDIA_SOCIAL.sexRatio} per 1,000, child sex ratio{" "}
            {INDIA_SOCIAL.childSexRatio}.{" "}
            <span className="text-[var(--nb-gain)]">
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
      <div className="-mx-1 overflow-x-auto px-1">
        <div className="min-w-[560px]">
          <div
            className="grid gap-1"
            style={{ gridTemplateColumns: `minmax(96px, 170px) repeat(${COMMUTE_BANDS.length}, minmax(44px, 1fr))` }}
          >
            <div />
            {COMMUTE_BANDS.map((band) => (
              <div
                key={band}
                className="bg-[var(--nb-table-head)] py-0.5 text-center text-[9px] font-black uppercase tracking-tight text-[var(--nb-text-muted)]"
              >
                {band}
              </div>
            ))}
            {COMMUTE.map((row) => (
              <div key={row.mode} className="contents">
                {/* Sticky for the same reason as the decadal grid: the mode name
                    has to stay with its numbers on a narrow screen. */}
                <div
                  className="sticky left-0 z-10 flex items-center justify-end bg-[var(--nb-table-row)] pr-2 text-right text-[10px] font-black uppercase tracking-tight text-[var(--nb-text-2)]"
                  style={{ boxShadow: "2px 0 0 0 var(--nb-ink)" }}
                >
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
      {/* Only shown where the grid genuinely overflows. A phone user otherwise
          has no cue that the table continues sideways. */}
      <p className="mt-2 text-[10px] font-black uppercase tracking-wide text-[var(--nb-text-dim)] sm:hidden">
        Swipe the table sideways for the remaining distance bands →
      </p>
      <p className="mt-3 text-[11px] font-bold leading-relaxed text-[var(--nb-text-dim)]">
        Table B-28 is published at India level only, so this view stays national{" "}
        {place ? <>even though you are browsing {place}</> : null}. The blank cells are
        real absences: nobody walks 31km to work.{" "}
        <span className="text-[var(--nb-loss)]">
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

  /**
   * Location comes from the shared provider rather than a private request, so
   * this chart and the clock widget ask the browser once between them.
   */
  const { status, state: place, busy, approximate, request } = useLocation();
  const geoState: GeoState =
    status === "success"
      ? "located"
      : status === "requesting"
        ? "requesting"
        : status === "denied"
          ? "denied"
          : "unavailable";

  const label =
    geoState === "located" && place
      ? place
      : geoState === "requesting"
        ? "Locating…"
        : place ?? PLACE_FALLBACK;

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
          <span className="nb-chip bg-[#06B6D4] text-[#03151A]">
            {busy && <LocationPulse size={12} />}
            Showing: {label}
          </span>
        </div>
      </div>

      {/*
        Always mounted. The banner collapses by animating `max-height` back to
        zero rather than unmounting, which is the only way a height transition
        has something to run against — and it stops the controls above jumping
        a whole row when a fix finally lands.

        The row is deliberately one line and scrolls sideways if it does not
        fit. The alternative, wrapping, pushes the total height past the 40px
        the transition targets and the banner clips its own retry button.
      */}
      <div
        className={`nb-banner ${geoState === "located" ? "" : "mb-3"}`}
        data-collapsed={geoState === "located" ? "true" : "false"}
      >
        <div className="flex items-center gap-2 overflow-x-auto">
          <p className="nb-chip shrink-0 bg-[#FBBF24] text-[#1A1400]">
            {geoState === "denied" || geoState === "unavailable"
              ? `Location unavailable — showing ${place ? place.toLowerCase() : "all India"}.`
              : "Locating you…"}
          </p>
          {approximate && geoState !== "requesting" && (
            <p className="nb-chip shrink-0 bg-[var(--nb-surface-2)] text-[var(--nb-text-muted)]">
              Approximate — from your network, not GPS
            </p>
          )}
          <button
            type="button"
            onClick={() => request({ force: true })}
            disabled={busy}
            className="nb-chip nb-shimmer nb-press shrink-0 bg-[var(--nb-surface-2)] text-[var(--nb-text-2)] disabled:opacity-50"
          >
            Retry with my location
          </button>
        </div>
      </div>

      <div className="mb-4">
        {/*
          The stats strip. On a desktop this is a ticker, which is fine because
          there is room. On a phone the same markup became one line ~2000px wide
          that scrolled off both edges with no way to read it — the exact thing
          that made the mobile layout feel broken. Below `sm` the items wrap into
          a static grid instead, so every figure is actually readable, and the
          ticker only takes over where there is room for it.
        */}
        <div className="hidden sm:block">
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
        <dl className="grid grid-cols-1 gap-2 sm:hidden">
          {[
            `Census of India 2011 · ${STATE_DECADAL.length} states and union territories`,
            `Latest census recorded ${(INDIA_2011.population / 1_000_000).toFixed(1)} million people`,
            `${(INDIA_2011.households / 1_000_000).toFixed(1)} million households · ${INDIA_2011.towns.toLocaleString("en-IN")} towns`,
            `${INDIA_SPATIAL.inhabitedVillages.toLocaleString("en-IN")} inhabited villages · ${INDIA_SPATIAL.uninhabitedVillages.toLocaleString("en-IN")} standing empty`,
            `Urban share ${INDIA_2011.urbanSharePercent}% · average density ${INDIA_2011.density} per km²`,
            `Scheduled Tribe ${INDIA_2011.stSharePercent}% · Scheduled Caste ${INDIA_2011.scSharePercent}% of the population`,
          ].map((item) => (
            <div
              key={item}
              className="border-2 border-[var(--nb-ink)] bg-[var(--nb-surface-2)] px-2.5 py-2 text-[10px] font-black uppercase leading-relaxed tracking-wide text-[var(--nb-text-2)]"
            >
              {item}
            </div>
          ))}
        </dl>
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
