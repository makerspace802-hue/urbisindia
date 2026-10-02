import ProjectionChart from "@/components/ProjectionChart";
import Quiz from "@/components/Quiz";
import { useAuth } from "@/hooks/use-auth";
import { useCityPopulation } from "@/hooks/use-city-population";
import { useCallback, useState } from "react";

/**
 * Personal analytics: the resident's footprint, the numerical impact of that
 * footprint on their city, and the 10-year outlook underneath it.
 */
export default function QuizPage() {
  const { user } = useAuth();
  const city = user?.city?.trim() || "Bhopal";
  const { population, estimated } = useCityPopulation(city);

  // Scenario controls that drive the outlook below.
  const [canopy, setCanopy] = useState(12);
  const [toll, setToll] = useState(4);
  const [misting, setMisting] = useState(true);
  const [complete, setComplete] = useState(false);

  // Must stay referentially stable or the quiz's completion effect re-fires.
  const handleComplete = useCallback(() => setComplete(true), []);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-8">
      <Quiz population={population} onComplete={handleComplete} />

      {complete && (
        <div className="mx-auto mt-10 max-w-4xl">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <h2 className="text-xl font-black uppercase tracking-tight text-[var(--nb-text)] md:text-2xl">
              10-Year City Outlook
            </h2>
            <span className="nb-chip bg-[var(--nb-surface-2)] text-[#06B6D4]">
              {city}
              {estimated ? " · estimated population" : ""}
            </span>
          </div>

          {/* Scenario controls */}
          <div className="nb-panel mb-4 grid grid-cols-1 gap-5 p-4 md:grid-cols-3">
            <label className="block">
              <span className="mb-2 block text-[11px] font-black uppercase tracking-widest text-[var(--nb-text-muted)]">
                Canopy target
              </span>
              <input
                type="range"
                min={0}
                max={35}
                value={canopy}
                onChange={(event) => setCanopy(Number(event.target.value))}
                className="w-full accent-[#10B981]"
                aria-label="Canopy target"
              />
              <span className="mt-1 block text-xs font-black tabular-nums text-[var(--nb-text)]">
                +{canopy}%
              </span>
            </label>

            <label className="block">
              <span className="mb-2 block text-[11px] font-black uppercase tracking-widest text-[var(--nb-text-muted)]">
                Congestion toll
              </span>
              <input
                type="range"
                min={0}
                max={15}
                value={toll}
                onChange={(event) => setToll(Number(event.target.value))}
                className="w-full accent-[#06B6D4]"
                aria-label="Congestion toll"
              />
              <span className="mt-1 block text-xs font-black tabular-nums text-[var(--nb-text)]">
                ${toll}
              </span>
            </label>

            <label className="flex items-center justify-between gap-3 md:flex-col md:items-start md:justify-start">
              <span className="text-[11px] font-black uppercase tracking-widest text-[var(--nb-text-muted)]">
                Heat misting on
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={misting}
                onClick={() => setMisting((value) => !value)}
                className={[
                  "relative h-7 w-14 shrink-0 border-2 border-[var(--nb-ink)] shadow-[3px_3px_0_0_var(--nb-ink)]",
                  misting ? "bg-[#10B981]" : "bg-[var(--nb-surface-2)]",
                ].join(" ")}
              >
                <span
                  className={[
                    "absolute top-0.5 size-5 border-2 border-[var(--nb-ink)] bg-[#F8FAFC] transition-all",
                    misting ? "left-[calc(100%-1.375rem)]" : "left-0.5",
                  ].join(" ")}
                />
              </button>
            </label>
          </div>

          <ProjectionChart
            canopy={canopy}
            toll={toll}
            misting={misting}
            population={population}
            city={city}
          />
        </div>
      )}
    </div>
  );
}