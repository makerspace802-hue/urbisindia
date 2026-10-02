import { CityMap } from "@/components/CityMap";
import { motion } from "framer-motion";

interface Kpi {
  title: string;
  value: string;
  note?: string;
  change: string;
  changeClass: string;
  badge: string;
  badgeClass: string;
  spark: number[];
  sparkColor: string;
}

const KPIS: Kpi[] = [
  {
    title: "Traffic Congestion Index",
    value: "32%",
    change: "↓ 14% vs avg",
    changeClass: "text-[#10B981]",
    badge: "Low Flow Risk",
    badgeClass: "bg-[#06B6D4] text-[#03151A]",
    spark: [48, 46, 47, 44, 43, 44, 41, 39, 40, 37, 36, 34, 35, 33, 32, 32],
    sparkColor: "#06B6D4",
  },
  {
    title: "Heat Island Peak Temp",
    value: "38.4°C",
    change: "↑ 2.1°C concrete zones",
    changeClass: "text-[#F43F5E]",
    badge: "Thermal Advisory Zone 3",
    badgeClass: "bg-[#F43F5E] text-black",
    spark: [33.2, 33.6, 34.1, 34, 34.8, 35.4, 35.9, 36.4, 36.2, 37, 37.4, 37.8, 38.1, 38, 38.3, 38.4],
    sparkColor: "#F43F5E",
  },
  {
    title: "Urban Canopy Index",
    value: "28.5%",
    change: "+1.2% target YTD",
    changeClass: "text-[#10B981]",
    badge: "142k Trees Active",
    badgeClass: "bg-[#10B981] text-[#04110C]",
    spark: [26.9, 27, 27.1, 27.3, 27.4, 27.5, 27.7, 27.8, 27.9, 28, 28.1, 28.2, 28.3, 28.4, 28.4, 28.5],
    sparkColor: "#10B981",
  },
  {
    title: "EV & Micro-Mobility Share",
    value: "44.8%",
    note: "of daily trips",
    change: "↑ 6.4% vs Q1",
    changeClass: "text-[#10B981]",
    badge: "High Adoption",
    badgeClass: "bg-[#10B981] text-[#04110C]",
    spark: [38.4, 38.9, 39.6, 40.1, 40, 40.9, 41.4, 41.9, 42.3, 42.1, 42.9, 43.4, 43.8, 44.2, 44.5, 44.8],
    sparkColor: "#10B981",
  },
];

const ALERTS = [
  {
    type: "Alert",
    typeClass: "bg-[#F43F5E] text-black",
    time: "2 min ago",
    text: "Dynamic Shade Canopies deployed at Sector 4 Bus Hub due to 39°C surface heat.",
  },
  {
    type: "Traffic",
    typeClass: "bg-[#06B6D4] text-[#03151A]",
    time: "8 min ago",
    text: "Autonomous Bus Lane priority activated along Expressway 21; congestion cleared by 18%.",
  },
];

function Sparkline({ data, color }: { data: number[]; color: string }) {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const points = data
    .map((value, index) => {
      const x = (index / (data.length - 1)) * 100;
      const y = 30 - ((value - min) / range) * 26;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");

  return (
    <svg
      viewBox="0 0 100 32"
      preserveAspectRatio="none"
      className="h-9 w-24 shrink-0 sm:w-28"
      aria-hidden="true"
    >
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="3"
        strokeLinecap="square"
        strokeLinejoin="miter"
        vectorEffect="non-scaling-stroke"
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

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-black uppercase tracking-tight text-[#F8FAFC] md:text-3xl">
          Dashboard
        </h1>
        <span className="nb-chip bg-[#1E293B] text-[#94A3B8]">{today}</span>
      </div>

      {/* KPI grid */}
      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {KPIS.map((kpi, index) => (
          <motion.article
            key={kpi.title}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: index * 0.05 }}
            className="nb-panel p-4 transition-transform duration-150 hover:scale-[1.01]"
          >
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-[11px] font-black uppercase leading-snug tracking-widest text-[#94A3B8]">
                {kpi.title}
              </h2>
              <span
                className={`nb-chip whitespace-normal text-right ${kpi.badgeClass}`}
              >
                {kpi.badge}
              </span>
            </div>
            <div className="mt-4 flex items-end justify-between gap-3">
              <div>
                <p className="text-4xl font-black leading-none tabular-nums text-[#F8FAFC]">
                  {kpi.value}
                </p>
                {kpi.note && (
                  <p className="mt-1.5 text-[11px] font-bold uppercase tracking-wide text-[#64748B]">
                    {kpi.note}
                  </p>
                )}
              </div>
              <Sparkline data={kpi.spark} color={kpi.sparkColor} />
            </div>
            <div className="mt-4 border-t-2 border-black pt-2.5">
              <span
                className={`text-xs font-black tabular-nums ${kpi.changeClass}`}
              >
                {kpi.change}
              </span>
            </div>
          </motion.article>
        ))}
      </div>

      {/* Dual-mode digital twin */}
      <div className="mt-6">
        <CityMap />
      </div>

      {/* Live alert ticker */}
      <section className="mt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="nb-title text-sm md:text-base">Live Alert Ticker</h2>
          <span className="nb-chip bg-[#1E293B] text-[#10B981]">
            <span className="size-2 animate-pulse bg-[#10B981]" />
            2 Active
          </span>
        </div>
        <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
          {ALERTS.map((alert, index) => (
            <motion.article
              key={alert.type}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.25, delay: index * 0.06 }}
              className="nb-panel p-4 transition-transform duration-150 hover:scale-[1.01]"
            >
              <div className="flex items-center gap-2">
                <span className={`nb-chip ${alert.typeClass}`}>{alert.type}</span>
                <span className="ml-auto text-[10px] font-black uppercase tracking-widest text-[#64748B]">
                  {alert.time}
                </span>
              </div>
              <p className="mt-3 text-sm font-semibold leading-relaxed text-[#CBD5E1]">
                {alert.text}
              </p>
            </motion.article>
          ))}
        </div>
      </section>
    </div>
  );
}
