import { motion } from "framer-motion";
import { X } from "lucide-react";
import L from "leaflet";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type MapMode = "traffic" | "thermal";

interface MarkerDatum {
  id: "A" | "B" | "C";
  lat: number;
  lng: number;
  label: string;
  place: string;
  color: string;
  metrics: { label: string; value: string }[];
}

const MARKERS: MarkerDatum[] = [
  {
    id: "A",
    lat: 42.3558,
    lng: -71.0606,
    label: "Traffic Sensor",
    place: "Downtown Crossing",
    color: "#06B6D4",
    metrics: [
      { label: "Live Vehicle Count", value: "1,284 / hr" },
      { label: "Average Speed", value: "24 km/h" },
      { label: "EV Bike Lane Occupancy", value: "78%" },
    ],
  },
  {
    id: "B",
    lat: 42.3486,
    lng: -71.0431,
    label: "Heat Sink Zone",
    place: "Sector 7 Industrial",
    color: "#F43F5E",
    metrics: [
      { label: "Surface Temp", value: "41°C" },
      { label: "Tree Density", value: "12%" },
      { label: "Nearest Shade Refuge Station", value: "Civic Garage Shelter — 340 m" },
    ],
  },
  {
    id: "C",
    lat: 42.3519,
    lng: -71.0578,
    label: "Cooling & Mobility Hub",
    place: "Metro Station East",
    color: "#10B981",
    metrics: [
      { label: "Available E-Bikes", value: "46 / 60 docks" },
      { label: "Misting Station Status", value: "Active — 3 Zones" },
      { label: "Solar Shade Output", value: "12.4 kW" },
    ],
  },
];

interface Corridor {
  name: string;
  status: string;
  color: string;
  points: [number, number][];
}

const CORRIDORS: Corridor[] = [
  {
    name: "Expressway 21",
    status: "Clear",
    color: "#10B981",
    points: [
      [42.372, -71.0605],
      [42.3605, -71.058],
      [42.348, -71.0555],
      [42.338, -71.0535],
    ],
  },
  {
    name: "Downtown Arterial",
    status: "Moderate",
    color: "#06B6D4",
    points: [
      [42.3605, -71.0705],
      [42.3585, -71.0605],
      [42.3565, -71.0505],
      [42.3545, -71.0405],
    ],
  },
  {
    name: "Harbor Route",
    status: "Congested",
    color: "#F43F5E",
    points: [
      [42.352, -71.0505],
      [42.3485, -71.044],
      [42.345, -71.0365],
      [42.347, -71.0285],
    ],
  },
  {
    name: "North Transit Spine",
    status: "Clear",
    color: "#10B981",
    points: [
      [42.3705, -71.075],
      [42.3685, -71.063],
      [42.3655, -71.0505],
      [42.3665, -71.0385],
    ],
  },
  {
    name: "West Connector",
    status: "Moderate",
    color: "#06B6D4",
    points: [
      [42.3555, -71.084],
      [42.3535, -71.072],
      [42.3525, -71.062],
    ],
  },
];

const HEAT_ZONES = [
  { name: "Sector 7 Industrial", temp: "41°C", lat: 42.3486, lng: -71.0431, radius: 520 },
  { name: "Harbor Asphalt Flat", temp: "39.6°C", lat: 42.3468, lng: -71.0318, radius: 420 },
  { name: "Transit Plaza 4", temp: "39°C", lat: 42.3601, lng: -71.0588, radius: 320 },
];

const CANOPY_ZONES = [
  { name: "Common Green Canopy", pct: "46%", lat: 42.3545, lng: -71.0662, radius: 430 },
  { name: "North Suburban Belt", pct: "38%", lat: 42.3685, lng: -71.0648, radius: 400 },
];

function markerHtml(marker: MarkerDatum) {
  return `<div style="width:28px;height:28px;background:${marker.color};border:2px solid #000;box-shadow:3px 3px 0 0 #000;color:#04110C;font-size:13px;font-weight:900;display:flex;align-items:center;justify-content:center;cursor:pointer;">${marker.id}</div>`;
}

function LegendRow({ color, label }: { color: string; label: string }) {
  return (
    <span className="nb-chip bg-[#1E293B] text-[#E2E8F0]">
      <span
        className="size-2.5 border-2 border-black"
        style={{ background: color }}
      />
      {label}
    </span>
  );
}

/**
 * Dual-mode city digital twin: traffic corridors vs thermal/canopy overlay,
 * with three clickable sensor markers that open a metric modal.
 */
export function CityMap() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const overlaysRef = useRef<L.LayerGroup | null>(null);
  const [mode, setMode] = useState<MapMode>("traffic");
  const [selected, setSelected] = useState<MarkerDatum | null>(null);
  const [liveCount, setLiveCount] = useState(1284);

  // Base map + markers (runs once; guarded for StrictMode double-invoke).
  useEffect(() => {
    if (mapRef.current || !containerRef.current) return;

    const map = L.map(containerRef.current, {
      center: [42.3565, -71.0545],
      zoom: 13,
      scrollWheelZoom: false,
      attributionControl: true,
    });

    L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
      {
        subdomains: "abcd",
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap &copy; CARTO",
      },
    ).addTo(map);

    overlaysRef.current = L.layerGroup().addTo(map);

    MARKERS.forEach((marker) => {
      L.marker([marker.lat, marker.lng], {
        icon: L.divIcon({
          className: "urbis-marker-icon",
          html: markerHtml(marker),
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        }),
        title: `${marker.label} — ${marker.place}`,
        keyboard: true,
      })
        .on("click", () => setSelected(marker))
        .addTo(overlaysRef.current!);
    });

    mapRef.current = map;

    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
      map.remove();
      mapRef.current = null;
      overlaysRef.current = null;
    };
  }, []);

  // Swap overlay layers when the view mode changes.
  useEffect(() => {
    const group = overlaysRef.current;
    if (!group) return;
    group.clearLayers();

    if (mode === "traffic") {
      CORRIDORS.forEach((corridor) => {
        L.polyline(corridor.points, {
          color: "#000000",
          weight: 11,
          opacity: 0.9,
          lineJoin: "miter",
          lineCap: "square",
        }).addTo(group);
        L.polyline(corridor.points, {
          color: corridor.color,
          weight: 6,
          opacity: 0.95,
          lineJoin: "miter",
          lineCap: "square",
        })
          .bindTooltip(`${corridor.name} — ${corridor.status}`, {
            className: "urbis-tooltip",
            sticky: true,
            direction: "top",
          })
          .addTo(group);
      });
    } else {
      HEAT_ZONES.forEach((zone) => {
        L.circle([zone.lat, zone.lng], {
          radius: zone.radius,
          color: "#000000",
          weight: 2,
          fillColor: "#F43F5E",
          fillOpacity: 0.3,
        })
          .bindTooltip(`${zone.name} — ${zone.temp}`, {
            className: "urbis-tooltip",
            sticky: true,
          })
          .addTo(group);
        L.circle([zone.lat, zone.lng], {
          radius: zone.radius * 0.5,
          color: "#000000",
          weight: 2,
          fillColor: "#FBBF24",
          fillOpacity: 0.35,
        }).addTo(group);
      });
      CANOPY_ZONES.forEach((zone) => {
        L.circle([zone.lat, zone.lng], {
          radius: zone.radius,
          color: "#000000",
          weight: 2,
          fillColor: "#10B981",
          fillOpacity: 0.32,
        })
          .bindTooltip(`${zone.name} — ${zone.pct} shade`, {
            className: "urbis-tooltip",
            sticky: true,
          })
          .addTo(group);
      });
    }
  }, [mode]);

  // Live vehicle count ticks while the traffic sensor modal is open.
  useEffect(() => {
    if (selected?.id !== "A") return;
    const id = setInterval(() => {
      setLiveCount((count) =>
        Math.min(1420, Math.max(1140, count + Math.round((Math.random() - 0.5) * 60))),
      );
    }, 1600);
    return () => clearInterval(id);
  }, [selected?.id]);

  // Escape closes the modal.
  useEffect(() => {
    if (!selected) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelected(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selected]);

  return (
    <section className="nb-panel">
      {/* Panel header: title + view toggle */}
      <div className="flex flex-wrap items-center gap-3 border-b-2 border-black bg-[#111827] p-3 md:p-4">
        <h2 className="nb-title text-sm md:text-base">City Digital Twin</h2>
        <div className="ml-auto flex flex-wrap items-center gap-2 md:gap-3">
          <span className="hidden text-[11px] font-black uppercase tracking-widest text-[#94A3B8] sm:inline">
            Switch View:
          </span>
          <div className="flex border-2 border-black bg-[#0B0F17] shadow-[3px_3px_0_0_#000]">
            {(
              [
                { id: "traffic" as MapMode, label: "🚗 Traffic & Transit Corridors", color: "#06B6D4" },
                { id: "thermal" as MapMode, label: "🌡️ Thermal & Tree Canopy Overlay", color: "#FBBF24" },
              ]
            ).map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setMode(option.id)}
                aria-pressed={mode === option.id}
                className="relative px-3 py-2 text-left text-[11px] font-black uppercase tracking-wide transition-colors md:text-xs"
              >
                {mode === option.id && (
                  <motion.span
                    layoutId="urbis-map-mode"
                    className="absolute inset-0"
                    style={{ background: option.color }}
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                  />
                )}
                <span
                  className={
                    mode === option.id ? "relative text-black" : "relative text-[#94A3B8]"
                  }
                >
                  {option.label}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Map canvas */}
      <div
        className="relative z-0"
        style={{
          backgroundColor: "#0B0F17",
          backgroundImage:
            "linear-gradient(#1E293B55 1px, transparent 1px), linear-gradient(90deg, #1E293B55 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      >
        <div
          ref={containerRef}
          className="h-[380px] w-full sm:h-[460px] lg:h-[540px]"
        />

        {/* Legend overlay */}
        <div className="pointer-events-none absolute bottom-6 left-3 z-[1000] flex flex-col items-start gap-1.5">
          {mode === "traffic" ? (
            <>
              <LegendRow color="#10B981" label="Clear Flow" />
              <LegendRow color="#06B6D4" label="Moderate" />
              <LegendRow color="#F43F5E" label="Congested" />
            </>
          ) : (
            <>
              <LegendRow color="#FBBF24" label="Peak Surface" />
              <LegendRow color="#F43F5E" label="Heat Sink Zone" />
              <LegendRow color="#10B981" label="Tree Canopy" />
            </>
          )}
        </div>
      </div>

      {/* Marker modal */}
      {selected &&
        createPortal(
        <div
          className="fixed inset-0 z-[1200] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`${selected.label} — ${selected.place}`}
        >
          <button
            type="button"
            aria-label="Close"
            className="absolute inset-0 h-full w-full cursor-default bg-black/75"
            onClick={() => setSelected(null)}
          />
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.15 }}
            className="nb-panel relative w-full max-w-md"
          >
            <div
              className="flex items-center gap-3 border-b-2 border-black p-4"
              style={{ background: selected.color }}
            >
              <span className="flex size-9 shrink-0 items-center justify-center border-2 border-black bg-[#F8FAFC] text-sm font-black text-black">
                {selected.id}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-black uppercase tracking-wide text-black">
                  {selected.label}
                </p>
                <p className="truncate text-xs font-bold text-black/70">
                  {selected.place}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                aria-label="Close"
                className="ml-auto flex size-8 shrink-0 items-center justify-center border-2 border-black bg-[#F8FAFC] text-black transition-transform hover:scale-105"
              >
                <X className="size-4" strokeWidth={3} />
              </button>
            </div>

            <dl className="p-4">
              {selected.metrics.map((metric, index) => (
                <div
                  key={metric.label}
                  className={[
                    "flex items-center justify-between gap-4 py-2.5",
                    index > 0 ? "border-t-2 border-black" : "",
                  ].join(" ")}
                >
                  <dt className="text-xs font-bold uppercase tracking-wide text-[#94A3B8]">
                    {metric.label}
                  </dt>
                  <dd className="text-right text-sm font-black tabular-nums text-[#F8FAFC]">
                    {metric.label === "Live Vehicle Count"
                      ? `${liveCount.toLocaleString()} / hr`
                      : metric.value}
                  </dd>
                </div>
              ))}
            </dl>

            <div className="flex items-center justify-between gap-3 border-t-2 border-black bg-[#111827] px-4 py-3">
              <span className="nb-chip bg-[#10B981] text-[#04110C]">
                <span className="size-2 animate-pulse bg-[#04110C]" />
                Sensor Feed Live
              </span>
              <span className="text-[10px] font-black uppercase tracking-widest text-[#64748B]">
                Node {selected.id}-{selected.place.replace(/\s+/g, "").slice(0, 6).toUpperCase()}
              </span>
            </div>
          </motion.div>
        </div>,
          document.body,
        )}
    </section>
  );
}
