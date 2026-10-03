import { useSettings } from "@/components/SettingsProvider";
import {
  CONDITION,
  detailFor,
  fetchWeather,
  type LiveWeather,
} from "@/lib/weather";
import { useLocation } from "@/lib/locationContext";
import { RefreshCw, Wind, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";

const POS_KEY = "urbis.widgetPos";

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
  const [live, setLive] = useState<LiveWeather | null>(null);
  const [busy, setBusy] = useState(false);
  const dragRef = useRef<{ dx: number; dy: number; moved: boolean } | null>(null);

  /**
   * The shared fix.
   *
   * This widget used to call `navigator.geolocation` itself, so it prompted
   * separately from the Census charts below it and could show one city's weather
   * while the page claimed another. It now reads the same fix, and refetches
   * automatically when that fix changes.
   */
  const { fix, label: place } = useLocation();

  /**
   * Weather is read, never chosen.
   *
   * The point comes from the provider, which always resolves to somewhere real —
   * GPS, the cached fix, an IP lookup, or the configured default city. The
   * manual condition picker that used to sit here let the displayed state
   * disagree with the world, so it is gone.
   */
  const load = useCallback(async (lat: number, lon: number) => {
    setBusy(true);
    try {
      const reading = await fetchWeather(lat, lon);
      setLive(reading);
    } catch {
      // Leave the last good reading on screen rather than blanking the widget.
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    // The first fetch is deferred to a macrotask so the effect body itself never
    // updates state. Calling `load()` directly would set `busy` synchronously
    // during the effect, which cascades an extra render before anything is known.
    const initial = setTimeout(() => void load(fix.lat, fix.lon), 0);
    const id = setInterval(() => void load(fix.lat, fix.lon), 15 * 60_000);
    return () => {
      clearTimeout(initial);
      clearInterval(id);
    };
  }, [load, fix.lat, fix.lon]);

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

  const condition = live?.condition ?? null;
  const weather = CONDITION[condition ?? "partly"];
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
          {live ? `${Math.round(live.tempC)}°C` : busy ? "…" : "--°C"}
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
              {live ? detailFor(live) : busy ? "Reading…" : "No reading yet"}
            </p>

            <div className="mt-3 flex items-center justify-between gap-2 border-t-2 border-[var(--nb-ink)] pt-3">
              <span className="text-[10px] font-black uppercase tracking-widest text-[var(--nb-text-muted)]">
                Live · {place}
              </span>
              <button
                type="button"
                onClick={() => void load(fix.lat, fix.lon)}
                disabled={busy}
                aria-label="Refresh weather"
                className="nb-chip bg-[var(--nb-surface-2)] text-[var(--nb-text-2)] disabled:opacity-50"
              >
                <RefreshCw className={`size-3 ${busy ? "animate-spin" : ""}`} strokeWidth={3} />
                Refresh
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
