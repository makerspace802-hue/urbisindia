import ProjectionChart from "@/components/ProjectionChart";
import Quiz from "@/components/Quiz";
import { useLocation } from "@/lib/locationContext";
import { basePopulation } from "@/lib/projection";
import { useCallback, useMemo, useState } from "react";

/**
 * Quiz result: the resident's answers, then an outlook for the state they are
 * actually in.
 *
 * The scenario sliders that used to sit here drove a canopy/toll/misting model
 * whose temperature and savings outputs were not Census quantities. They are
 * gone; the projection now reads the located state's observed decadal growth rate
 * from Census 2011 Table A-2 and extrapolates it, clearly labelled as an
 * extrapolation.
 */
export default function QuizPage() {
  const { state, busy } = useLocation();
  const [complete, setComplete] = useState(false);

  /**
   * The carbon section scales the visitor's footprint to a population. It used to
   * come from a third-party city lookup with hand-entered fallbacks; it now
   * comes from the located state's Census 2011 figure, so the whole page reads
   * from the same tables. Falls back to the national total when the visitor is
   * outside India.
   */
  const population = useMemo(() => basePopulation(state), [state]);

  // Must stay referentially stable or the quiz's completion effect re-fires.
  const handleComplete = useCallback(() => setComplete(true), []);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-8">
      <Quiz population={population} onComplete={handleComplete} />

      {complete && (
        <div className="mx-auto mt-10 max-w-4xl">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <h2 className="text-xl font-black uppercase tracking-tight text-[var(--nb-text)] md:text-2xl">
              Your Outlook
            </h2>
            <span className="nb-chip bg-[var(--nb-surface-2)] text-[var(--nb-text-muted)]">
              {busy ? "Locating…" : (state ?? "India")}
            </span>
          </div>

          <ProjectionChart state={state} />
        </div>
      )}
    </div>
  );
}