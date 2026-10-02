import { NbSlider, NbSwitch } from "@/components/NbControls";
import ProjectionChart from "@/components/ProjectionChart";
import { useAuth } from "@/hooks/use-auth";
import { useCityPopulation } from "@/hooks/use-city-population";
import { motion } from "framer-motion";
import { useMemo, useState, type ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

/* ------------------------------------------------------------------ data */

const DISTRICT_DATA = [
  { district: "Downtown Core", temp: 38.4, shade: 18 },
  { district: "Financial District", temp: 37.1, shade: 22 },
  { district: "Industrial Zone 4", temp: 41.0, shade: 12 },
  { district: "North Suburban Hub", temp: 34.6, shade: 34 },
  { district: "West Tech Corridor", temp: 33.9, shade: 38 },
  { district: "Harbor District", temp: 36.2, shade: 26 },
];

const MODAL_DATA = [
  { hour: "06", bus: 420, micro: 180, ice: 980 },
  { hour: "08", bus: 860, micro: 640, ice: 2150 },
  { hour: "10", bus: 640, micro: 520, ice: 1740 },
  { hour: "12", bus: 710, micro: 610, ice: 1820 },
  { hour: "14", bus: 690, micro: 640, ice: 1760 },
  { hour: "16", bus: 820, micro: 700, ice: 1980 },
  { hour: "18", bus: 940, micro: 760, ice: 2260 },
  { hour: "20", bus: 560, micro: 380, ice: 1320 },
];

const SHADE_DATA = [
  { name: "Natural Forest", value: 34, color: "#10B981" },
  { name: "Green Roofs", value: 14, color: "#06B6D4" },
  { name: "Smart Shade Canopies", value: 12, color: "#FBBF24" },
  { name: "Unshaded Asphalt", value: 40, color: "#F43F5E" },
];

const AXIS_TICK = { fill: "#94A3B8", fontSize: 10, fontWeight: 700 } as const;
const AXIS_LINE = { stroke: "#000000", strokeWidth: 2 } as const;

/* ---------------------------------------------------------------- shared */

interface TooltipEntry {
  name?: string | number;
  value?: ReactNode;
  color?: string;
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: ReactNode;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="border-2 border-black bg-[#0B0F17] px-3 py-2 shadow-[4px_4px_0_0_#000]">
      {label !== undefined && (
        <p className="text-[10px] font-black uppercase tracking-widest text-[#94A3B8]">
          {label}
        </p>
      )}
      {payload.map((entry, index) => (
        <p
          key={`${String(entry.name)}-${index}`}
          className="mt-1 text-xs font-bold text-[#E2E8F0]"
        >
          <span
            className="mr-1.5 inline-block size-2.5 border border-black align-[-1px]"
            style={{ background: entry.color }}
          />
          {entry.name}:{" "}
          <span className="font-black tabular-nums text-[#F8FAFC]">
            {entry.value}
          </span>
        </p>
      ))}
    </div>
  );
}

function LegendSwatch({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wide text-[#CBD5E1]">
      <span className="size-3 border-2 border-black" style={{ background: color }} />
      {label}
    </span>
  );
}

function ChartPanel({
  title,
  legend,
  children,
  className = "",
}: {
  title: string;
  legend?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`nb-panel min-w-0 ${className}`}>
      <div className="border-b-2 border-black bg-[#111827] p-4">
        <h2 className="nb-title text-xs leading-snug md:text-sm">{title}</h2>
        {legend && <div className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1.5">{legend}</div>}
      </div>
      <div className="p-3 md:p-4">{children}</div>
    </section>
  );
}

/* ------------------------------------------------------------------ page */

export default function Analytics() {
  const { user } = useAuth();
  const city = user?.city?.trim() || "Mumbai";
  const { population, estimated } = useCityPopulation(city);

  const [canopy, setCanopy] = useState(12);
  const [toll, setToll] = useState(4);
  const [misting, setMisting] = useState(true);

  const readouts = useMemo(() => {
    const tempDrop = canopy * 0.1 + (misting ? 0.5 : 0) + toll * 0.015;
    const modalShift = canopy * 1.3 + toll * 1.6;
    const savings = canopy * 0.25 + toll * 0.15 + (misting ? 0.6 : 0);
    return {
      tempDrop: `-${tempDrop.toFixed(1)} °C`,
      modalShift: `+${Math.round(modalShift)}%`,
      savings: `$${savings.toFixed(1)} Million / yr`,
    };
  }, [canopy, toll, misting]);

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 md:px-6 md:py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-black uppercase tracking-tight text-[#F8FAFC] md:text-3xl">
          Urban Analytics
        </h1>
        <span className="nb-chip bg-[#1E293B] text-[#94A3B8]">
          Scenario Engine · Q3 2026
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Chart 1 */}
        <ChartPanel
          title="Urban Heat Island vs. Tree Canopy Density Across Districts"
          className="lg:col-span-2"
          legend={
            <>
              <LegendSwatch color="#F43F5E" label="Peak Surface Temp °C" />
              <LegendSwatch color="#10B981" label="Shade Coverage %" />
            </>
          }
        >
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={DISTRICT_DATA} margin={{ top: 8, right: 8, bottom: 4, left: 0 }}>
                <CartesianGrid stroke="#334155" vertical={false} />
                <XAxis
                  dataKey="district"
                  tick={AXIS_TICK}
                  tickLine={false}
                  axisLine={AXIS_LINE}
                  angle={-22}
                  height={66}
                  interval={0}
                  tickMargin={6}
                />
                <YAxis
                  yAxisId="temp"
                  domain={[30, 44]}
                  tick={AXIS_TICK}
                  tickLine={false}
                  axisLine={AXIS_LINE}
                  width={34}
                />
                <YAxis
                  yAxisId="shade"
                  orientation="right"
                  domain={[0, 50]}
                  tick={AXIS_TICK}
                  tickLine={false}
                  axisLine={AXIS_LINE}
                  width={30}
                />
                <Tooltip
                  cursor={{ stroke: "#000000", strokeWidth: 2 }}
                  content={(props) => <ChartTooltip {...props} />}
                />
                <Line
                  yAxisId="temp"
                  type="monotone"
                  dataKey="temp"
                  name="Peak Surface Temp °C"
                  stroke="#F43F5E"
                  strokeWidth={3}
                  dot={{ r: 4, fill: "#F43F5E", stroke: "#000000", strokeWidth: 2 }}
                  activeDot={{ r: 6, fill: "#F43F5E", stroke: "#000000", strokeWidth: 2 }}
                />
                <Line
                  yAxisId="shade"
                  type="monotone"
                  dataKey="shade"
                  name="Shade Coverage %"
                  stroke="#10B981"
                  strokeWidth={3}
                  strokeDasharray="8 4"
                  dot={{ r: 4, fill: "#10B981", stroke: "#000000", strokeWidth: 2 }}
                  activeDot={{ r: 6, fill: "#10B981", stroke: "#000000", strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </ChartPanel>

        {/* Chart 2 */}
        <ChartPanel
          title="Commuter Modal & Carbon Displacement"
          legend={
            <>
              <LegendSwatch color="#06B6D4" label="Public Bus" />
              <LegendSwatch color="#10B981" label="Micro-Mobility / Bikes" />
              <LegendSwatch color="#F43F5E" label="Private ICE Vehicles" />
            </>
          }
        >
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={MODAL_DATA} margin={{ top: 8, right: 8, bottom: 4, left: 0 }}>
                <CartesianGrid stroke="#334155" vertical={false} />
                <XAxis
                  dataKey="hour"
                  tick={AXIS_TICK}
                  tickLine={false}
                  axisLine={AXIS_LINE}
                  tickMargin={6}
                />
                <YAxis tick={AXIS_TICK} tickLine={false} axisLine={AXIS_LINE} width={44} />
                <Tooltip
                  cursor={{ fill: "#0B0F17", fillOpacity: 0.5 }}
                  content={(props) => <ChartTooltip {...props} />}
                />
                <Bar
                  dataKey="bus"
                  name="Public Bus"
                  stackId="split"
                  fill="#06B6D4"
                  stroke="#000000"
                  strokeWidth={1.5}
                  maxBarSize={52}
                />
                <Bar
                  dataKey="micro"
                  name="Micro-Mobility / Bikes"
                  stackId="split"
                  fill="#10B981"
                  stroke="#000000"
                  strokeWidth={1.5}
                  maxBarSize={52}
                />
                <Bar
                  dataKey="ice"
                  name="Private ICE Vehicles"
                  stackId="split"
                  fill="#F43F5E"
                  stroke="#000000"
                  strokeWidth={1.5}
                  maxBarSize={52}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartPanel>

        {/* Chart 3 */}
        <ChartPanel title="Shade Infrastructure Distribution">
          <div className="grid items-center gap-4 md:grid-cols-[1fr_minmax(180px,220px)]">
            <div className="relative h-[240px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={SHADE_DATA}
                    dataKey="value"
                    nameKey="name"
                    innerRadius="58%"
                    outerRadius="86%"
                    paddingAngle={2}
                    stroke="#000000"
                    strokeWidth={2}
                    isAnimationActive
                  >
                    {SHADE_DATA.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={(props) => <ChartTooltip {...props} />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-black leading-none text-[#F8FAFC]">
                  100%
                </span>
                <span className="mt-1 text-[9px] font-black uppercase tracking-widest text-[#94A3B8]">
                  Surface Split
                </span>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              {SHADE_DATA.map((entry, index) => (
                <div
                  key={entry.name}
                  className={[
                    "flex items-center gap-2",
                    index > 0 ? "border-t-2 border-black pt-2" : "",
                  ].join(" ")}
                >
                  <span
                    className="size-3.5 shrink-0 border-2 border-black"
                    style={{ background: entry.color }}
                  />
                  <span className="text-xs font-bold text-[#CBD5E1]">
                    {entry.name}
                  </span>
                  <span className="ml-auto text-xs font-black tabular-nums text-[#F8FAFC]">
                    {entry.value}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </ChartPanel>
      </div>

      {/* What-If Simulator */}
      <motion.section
        initial={{ opacity: 0, y: 14 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.3 }}
        className="nb-panel"
      >
        <div className="flex flex-wrap items-center gap-3 border-b-2 border-black bg-[#111827] p-4">
          <h2 className="nb-title text-sm md:text-base">
            🎛️ Dynamic Climate &amp; Mobility Simulator
          </h2>
          <span className="nb-chip ml-auto bg-[#1E293B] text-[#FBBF24]">
            <span className="size-2 animate-pulse bg-[#FBBF24]" />
            Live Model
          </span>
        </div>

        <div className="grid gap-8 p-4 md:p-6 lg:grid-cols-2">
          {/* Controls */}
          <div className="flex flex-col gap-7">
            <div>
              <NbSlider
                label="Urban Tree Canopy Target"
                value={canopy}
                min={0}
                max={35}
                fill="#10B981"
                displayValue={`+${canopy}%`}
                onChange={setCanopy}
              />
              <p className="mt-1.5 text-center text-[10px] font-black uppercase tracking-widest text-[#64748B]">
                Range +0% to +35%
              </p>
            </div>

            <div>
              <NbSlider
                label="Dynamic Congestion Toll"
                value={toll}
                min={0}
                max={15}
                fill="#06B6D4"
                displayValue={`$${toll}`}
                onChange={setToll}
              />
              <p className="mt-1.5 text-center text-[10px] font-black uppercase tracking-widest text-[#64748B]">
                Range $0 to $15
              </p>
            </div>

            <div className="border-t-2 border-black pt-5">
              <NbSwitch
                label="Automated Emergency Heat Misting System"
                checked={misting}
                onChange={setMisting}
              />
            </div>
          </div>

          {/* Live readouts */}
          <div className="flex flex-col justify-center gap-4">
            <div className="border-2 border-black bg-[#06B6D4] p-4 shadow-[5px_5px_0_0_#000]">
              <p className="text-[10px] font-black uppercase tracking-widest text-[#03151A]">
                Estimated Microclimate Temp Drop
              </p>
              <p className="mt-2 text-3xl font-black leading-none tabular-nums text-black md:text-4xl">
                {readouts.tempDrop}
              </p>
            </div>
            <div className="border-2 border-black bg-[#10B981] p-4 shadow-[5px_5px_0_0_#000]">
              <p className="text-[10px] font-black uppercase tracking-widest text-[#04110C]">
                Commuter Modal Shift to Micro-Mobility
              </p>
              <p className="mt-2 text-3xl font-black leading-none tabular-nums text-black md:text-4xl">
                {readouts.modalShift}
              </p>
            </div>
            <div className="border-2 border-black bg-[#FBBF24] p-4 shadow-[5px_5px_0_0_#000]">
              <p className="text-[10px] font-black uppercase tracking-widest text-black/70">
                Annual Municipal Health &amp; Energy Savings
              </p>
              <p className="mt-2 text-3xl font-black leading-none tabular-nums text-black md:text-4xl">
                {readouts.savings}
              </p>
            </div>
          </div>
        </div>
      </motion.section>

      {/* 10-year projection derived from the simulator controls above */}
      <ProjectionChart
        canopy={canopy}
        toll={toll}
        misting={misting}
        population={population}
        city={city}
      />

      {estimated && population > 0 && (
        <p className="text-center text-[10px] font-black uppercase tracking-widest text-[#64748B]">
          Population for {city} is an offline estimate
        </p>
      )}
    </div>
  );
}
