import { AXIS_LINE, AXIS_TICK, ChartPanel, ChartTooltip, LegendSwatch, StatCard } from "@/components/ChartKit";
import { LocationPulse } from "@/components/LocationPulse";
import { useLocation } from "@/lib/locationContext";
import { allStateNames, stateTrendModel } from "@/lib/stateTrends";
import { INDIA_2011, INDIA_DECADAL } from "@/lib/censusData";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useMemo, useState } from "react";

/**
 * Census trends for the state the visitor is actually in.
 *
 * The dashboard's centennial chart puts all 35 states side by side. This is the
 * same underlying series resolved to one row, so the question the dashboard
 * cannot answer — "how is *my* state doing?" — has an answer.
 *
 * Two readings of "the past 10 years" are served, because the tables support
 * both and neither is wrong:
 *
 *  - the full 1901-2011 decadal curve, which is what the dashboard shows for
 *    every state, and
 *  - the single most recent decade, 2001 to 2011, broken out into cards and
 *    compared against the national figure.
 *
 * Every number here is read from the generated Census tables. Nothing is
 * estimated, modelled or interpolated.
 */

const GAIN = "#10B981";
const NATIONAL = "#06B6D4";

const num = (value: number) => value.toLocaleString("en-IN");
const pct = (value: number) => `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
const compact = (value: number) =>
  value >= 1_000_000 ? `${(value / 1_000_000).toFixed(2)}M` : `${(value / 1000).toFixed(0)}K`;

export function StateTrends() {
  const { state, status, busy, approximate, request } = useLocation();

  /**
   * A manual override. Needed because geolocation is frequently unavailable or
   * approximate — without this the whole page would be dead for those visitors.
   */
  const [override, setOverride] = useState<string | null>(null);
  const selected = override ?? state;

  const located = status === "success" && !override;

  const model = useMemo(() => stateTrendModel(selected), [selected]);

  const nationalDecade = INDIA_DECADAL[INDIA_DECADAL.length - 1];

  return (
    <section className="nb-panel">
      <div className="nb-subpanel flex flex-wrap items-center gap-3 border-b-2 border-[var(--nb-ink)] p-4">
        <h2 className="nb-title text-sm md:text-base">Your State, Decade by Decade</h2>

        <span
          className={`nb-chip ${
            busy ? "bg-[#FBBF24] text-[#1A1400]" : "bg-[#06B6D4] text-[#03151A]"
          }`}
        >
          {busy && <LocationPulse size={11} />}
          {model ? model.name : status === "success" ? "Outside India" : "Locating…"}
        </span>

        {!located && !busy && (
          <button
            type="button"
            onClick={() => request({ force: true })}
            className="nb-chip bg-[var(--nb-surface)] text-[var(--nb-text-2)]"
          >
            Retry with my location
          </button>
        )}
      </div>

      <div className="p-4">
        {/* The manual picker, always available so this view is never dead. */}
        <label className="mb-4 flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-[var(--nb-text-muted)]">
            {located ? "Located automatically" : "Or choose a state"}
          </span>
          <select
            className="nb-field max-w-xs"
            value={selected ?? ""}
            onChange={(event) => setOverride(event.target.value || null)}
          >
            <option value="">All India</option>
            {allStateNames().map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          {override && (
            <button
              type="button"
              onClick={() => setOverride(null)}
              className="nb-chip bg-[var(--nb-surface)] text-[var(--nb-text-2)]"
            >
              Use my location
            </button>
          )}
        </label>

        {approximate && located && (
          <p className="mb-4 text-[10px] font-bold uppercase tracking-wide text-[var(--nb-text-dim)]">
            Approximate location — from your network, not GPS
          </p>
        )}

        {!model ? (
          <p className="border-2 border-[var(--nb-ink)] bg-[var(--nb-surface-2)] p-4 text-sm font-bold text-[var(--nb-text-muted)]">
            {status === "success"
              ? "Your location resolves outside India, so there is no Census row to show. Pick a state above."
              : "Pick a state above to see its Census trends while we work out where you are."}
          </p>
        ) : (
          <div className="space-y-5">
            {/* Headline figures. */}
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatCard
                label="Population 2011"
                value={compact(model.growth.population2011)}
                sub={num(model.growth.population2011)}
              />
              <StatCard
                label="Rank by population"
                value={`${model.populationRank} / ${model.stateCount}`}
                sub="among states & union territories"
              />
              <StatCard
                label="Density"
                value={
                  model.profile.density === null ? "n/a" : `${num(model.profile.density)}`
                }
                sub={`India ${num(INDIA_2011.density)} per km²`}
              />
              <StatCard
                label="Area"
                value={
                  model.profile.areaSqKm === null
                    ? "n/a"
                    : `${num(model.profile.areaSqKm)}`
                }
                sub="square kilometres"
              />
            </div>

            {/* The century curve, same series as the dashboard but one row. */}
            <ChartPanel
              title="Decadal Population Growth — this state against India"
              legend={
                <>
                  <LegendSwatch color={GAIN} label="State growth %" />
                  <LegendSwatch color={NATIONAL} label="India growth %" />
                </>
              }
            >
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={model.series}
                    margin={{ top: 8, right: 8, bottom: 4, left: 0 }}
                  >
                    <CartesianGrid stroke="rgba(100,116,139,0.35)" vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={AXIS_TICK}
                      tickLine={false}
                      axisLine={AXIS_LINE}
                      interval={0}
                      angle={-30}
                      height={62}
                      textAnchor="end"
                      tickMargin={4}
                    />
                    <YAxis
                      tick={AXIS_TICK}
                      tickLine={false}
                      axisLine={AXIS_LINE}
                      width={46}
                      tickFormatter={(v: number) => `${v}%`}
                    />
                    <Tooltip
                      cursor={{ stroke: "var(--nb-ink)", strokeWidth: 2 }}
                      content={(props) => (
                        <ChartTooltip
                          {...props}
                          payload={props.payload?.map((entry) => ({
                            name: entry.name,
                            value:
                              typeof entry.value === "number"
                                ? pct(entry.value)
                                : "no census this decade",
                            color: entry.color,
                          }))}
                        />
                      )}
                    />
                    <ReferenceLine
                      y={0}
                      stroke="var(--nb-ink)"
                      strokeWidth={2}
                    />
                    <Line
                      type="monotone"
                      dataKey="india"
                      name="India"
                      stroke={NATIONAL}
                      strokeWidth={2}
                      strokeDasharray="8 4"
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="state"
                      name={model.name}
                      stroke={GAIN}
                      strokeWidth={3}
                      // Gaps stay gaps: a state that did not exist in 1901 has no
                      // figure, and bridging the gap would invent a line.
                      connectNulls={false}
                      dot={{ r: 4, fill: GAIN, stroke: "#000000", strokeWidth: 2 }}
                      activeDot={{ r: 6, fill: GAIN, stroke: "#000000", strokeWidth: 2 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <p className="mt-2 text-[10px] font-bold uppercase tracking-wide text-[var(--nb-text-dim)]">
                Series starts {model.fromYear} — the first census this unit appears in.
                Gaps are censuses it was not enumerated in.
              </p>
            </ChartPanel>

            {/* The literal "past 10 years": the most recent census decade. */}
            <div>
              <h3 className="nb-title mb-2.5 text-xs md:text-sm">
                The last census decade — 2001 to 2011
              </h3>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <StatCard
                  label="People added"
                  value={`+${compact(model.growth.absoluteChange)}`}
                  sub={num(model.growth.absoluteChange)}
                  tone={model.growth.absoluteChange >= 0 ? "good" : "bad"}
                />
                <StatCard
                  label="Growth vs India"
                  value={pct(model.growth.percentChange)}
                  sub={`India ${pct(nationalDecade.percentChange ?? 0)}`}
                  tone={
                    model.growth.percentChange >= (nationalDecade.percentChange ?? 0)
                      ? "good"
                      : "bad"
                  }
                />
                <StatCard
                  label="Growth rank"
                  value={`${model.growthRank} / ${model.stateCount}`}
                  sub="fastest growing first"
                />
                <StatCard
                  label="Sex ratio 2011"
                  value={num(model.growth.sexRatio2011)}
                  sub={`${model.growth.sexRatio2011 - model.growth.sexRatio2001 >= 0 ? "+" : ""}${(
                    model.growth.sexRatio2011 - model.growth.sexRatio2001
                  ).toFixed(1)} vs 2001 · females per 1,000 males`}
                />
              </div>
            </div>

            {/* 2011 profile against the national figure. */}
            <ChartPanel title="Census 2011 profile, against India">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard
                  label="Urban share"
                  value={`${model.profile.urbanSharePercent}%`}
                  sub={`India ${INDIA_2011.urbanSharePercent}%`}
                />
                <StatCard
                  label="Literacy"
                  value={`${model.profile.literacyPercent}%`}
                  sub="aged 7 and above"
                />
                <StatCard
                  label="Households"
                  value={compact(model.profile.households)}
                  sub={num(model.profile.households)}
                />
                <StatCard
                  label={`Population in ${model.fromYear}`}
                  value={
                    model.populationAtStart === null ? "n/a" : compact(model.populationAtStart)
                  }
                  sub={
                    model.populationAtStart === null
                      ? "census gap — chain incomplete"
                      : `${model.growth.percentChange >= 0 ? "up " : "down "}since ${model.fromYear}`
                  }
                />
              </div>
            </ChartPanel>
          </div>
        )}
      </div>
    </section>
  );
}