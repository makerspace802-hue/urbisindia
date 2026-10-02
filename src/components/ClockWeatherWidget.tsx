import { useSettings } from "@/components/SettingsProvider";
import { Cloud, CloudRain, CloudSun, Sun, Wind, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

const POS_KEY = "urbis.widgetPos";

type Condition = "clear" | "partly" | "cloudy" | "rain";

const CONDITION: Record<
  Condition,
  { label: string; temp: number; detail: string; Icon: typeof Sun }
> = {
  clear: { label: "Clear", temp: 37, detail: "Low humidity · UV index 9", Icon: Sun },
  partly: { label: "Partly Cloudy", temp: 33, detail: "Breezy · UV index 6", Icon: CloudSun },
  cloudy: { label: "Overcast", temp: 28, detail: "Humid · Light haze", Icon: Cloud },
  rain: { label: "Rain", temp: 24, detail: "Steady rain · Wet roads", Icon: CloudRain },
};

const ORDER: Condition[] = ["clear", "partly", "cloudy", "rain"];

function readPosition() {
  if (typeof window === "undefined") return { x: 16, y: 96 };
  try {
    const stored = window.localStorage.getItem(POS_KEY);
    if (!stored) return { x: 16, y: 96 };
    const parsed = JSON.parse(stored) as { x?: number; y?: number };
    return {
      x: typeof parsed.x === "number" ? parsed.x : 16,
      y: typeof parsed.y === "number" ? parsed.y : 96,
    };
  } catch {
    return { x: 16, y: 96 };
  }
}

/** Round analog face with hour/minute hands driven by the current time. */
function AnalogClock({ time }: { time: Date }) {
  const seconds = time.getSeconds();
  const minutes = time.getMinutes() + seconds / 60;
  const hours = (time.getHours() % 12) + minutes / 60;

  return (
    <svg viewBox="0 0 100 100" className="size-full" aria-hidden="true">
      <circle cx="50" cy="50" r="46" fill="var(--nb-surface)" stroke="var(--nb-ink)" strokeWidth="4" />
      {Array.from({ length: 12 }).map((_, i) => (
        <rect
          key={i}
          x="48.5"
          y="8"
          width="3"
          height="9"
          fill="var(--nb-ink)"
          transform={`rotate(${i * 30} 50 50)`}
        />
      ))}
      <rect
        x="47.5"
        y="26"
        width="5"
        height="28"
        fill="var(--nb-ink)"
        transform={`rotate(${hours * 30} 50 50)`}
      />
      <rect
        x="48.5"
        y="16"
        width="3"
        height="38"
        fill="#06B6D4"
        transform={`rotate(${minutes * 6} 50 50)`}
      />
      <rect
        x="49"
        y="12"
        width="2"
        height="42"
        fill="#F43F5E"
        transform={`rotate(${seconds * 6} 50 50)`}
      />
      <circle cx="50" cy="50" r="4" fill="var(--nb-ink)" />
    </svg>
  );
}

export default function ClockWeatherWidget() {
  const { clockMode } = useSettings();
  const [now, setNow] = useState(() => new Date());
  const [expanded, setExpanded] = useState(false);
  const [pos, setPos] = useState(readPosition);
  const [condition, setCondition] = useState<Condition>("clear");
  const dragRef = useRef<{ dx: number; dy: number; moved: boolean } | null>(null);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    window.localStorage.setItem(POS_KEY, JSON.stringify(pos));
  }, [pos]);

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    (event.target as HTMLElement).setPointerCapture?.(event.pointerId);
    dragRef.current = {
      dx: event.clientX - pos.x,
      dy: event.clientY - pos.y,
      moved: false,
    };
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    drag.moved = true;
    const maxX = window.innerWidth - 180;
    const maxY = window.innerHeight - 120;
    setPos({
      x: Math.min(Math.max(0, event.clientX - drag.dx), maxX),
      y: Math.min(Math.max(0, event.clientY - drag.dy), maxY),
    });
  };

  const onPointerUp = () => {
    // A tap (no movement) toggles the weather panel instead of dragging.
    if (dragRef.current && !dragRef.current.moved) setExpanded((v) => !v);
    dragRef.current = null;
  };

  const weather = CONDITION[condition];
  const { Icon } = weather;
  const time = now.toLocaleTimeString("en-GB", { hour12: false });
  const date = now.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });

  return (
    <div
      className="fixed z-[70] touch-none select-none"
      style={{ left: pos.x, top: pos.y }}
    >
      <div
        role="button"
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setExpanded((v) => !v);
          }
        }}
        aria-label="Clock and weather. Tap to expand."
        className="nb-panel flex cursor-grab items-center gap-2 px-2 py-1.5 active:cursor-grabbing"
      >
        {clockMode === "analog" ? (
          <div className="size-11">
            <AnalogClock time={now} />
          </div>
        ) : (
          <span className="px-1 text-lg font-black leading-none tabular-nums text-[var(--nb-text)]">
            {time}
          </span>
        )}

        <span className="text-[10px] font-black uppercase leading-tight tracking-widest text-[var(--nb-text-dim)]">
          {date}
        </span>

        <span className="nb-chip bg-[#FBBF24] text-black">
          <Icon className="size-3.5" strokeWidth={3} />
          {weather.temp}°C
        </span>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="nb-panel mt-2 w-64 p-4"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-[var(--nb-text-muted)]">
                  Bhopal, Madhya Pradesh
                </p>
                <p className="mt-1 text-2xl font-black leading-none text-[var(--nb-text)]">
                  {weather.label}
                </p>
              </div>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setExpanded(false);
                }}
                aria-label="Close weather"
                className="flex size-6 items-center justify-center border-2 border-[var(--nb-ink)] bg-[var(--nb-surface-2)] text-[var(--nb-text-2)]"
              >
                <X className="size-3.5" strokeWidth={3} />
              </button>
            </div>

            {/* Weather graphic */}
            <div className="relative mt-4 flex h-28 items-center justify-center border-2 border-[var(--nb-ink)] bg-[var(--nb-surface-2)]">
              <div className="absolute inset-0 flex items-center justify-center gap-1.5">
                {[0, 1, 2, 3, 4].map((i) => (
                  <span
                    key={i}
                    className="size-1.5 bg-[var(--nb-text-dim)]"
                    style={{ marginTop: `${(i % 2) * 6}px` }}
                  />
                ))}
              </div>
              <Icon
                className="relative size-16"
                strokeWidth={2.25}
                style={{ color: condition === "rain" ? "#06B6D4" : "#FBBF24" }}
              />
              {condition === "rain" && (
                <div className="absolute bottom-3 flex gap-1.5">
                  {[0, 1, 2].map((i) => (
                    <span key={i} className="h-3 w-0.5 bg-[#06B6D4]" />
                  ))}
                </div>
              )}
            </div>

            <p className="mt-3 flex items-center gap-2 text-xs font-bold text-[var(--nb-text-muted)]">
              <Wind className="size-3.5" strokeWidth={3} />
              {weather.detail}
            </p>

            <div className="mt-3 flex flex-wrap gap-1.5 border-t-2 border-[var(--nb-ink)] pt-3">
              {ORDER.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setCondition(option)}
                  aria-pressed={condition === option}
                  className={[
                    "nb-chip",
                    condition === option
                      ? "bg-[#10B981] text-[#04110C]"
                      : "bg-[var(--nb-surface-2)] text-[var(--nb-text-muted)]",
                  ].join(" ")}
                >
                  {CONDITION[option].label}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
