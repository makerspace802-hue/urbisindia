import { useEffect, useState } from "react";

const NINJA_CITY_KEY = "y56RbUguGsDIbztSFCb72yz5QLKzt65eEEDKmDOQ";

/** Offline fallbacks so the impact math still has a sane city scale. */
const FALLBACK_POPULATION: Record<string, number> = {
  mumbai: 21_297_000,
  delhi: 32_940_000,
  bengaluru: 13_608_000,
  "new york": 8_258_000,
  london: 8_961_000,
  paris: 2_138_000,
  tokyo: 14_000_000,
  berlin: 3_664_000,
  sydney: 5_450_000,
  singapore: 5_920_000,
};

const DEFAULT_POPULATION = 1_000_000;

interface PopulationResult {
  population: number;
  city: string;
  /** True when the live lookup failed and a built-in figure was used. */
  estimated: boolean;
}

/**
 * Resolves a city's population from the Ninja City API. Falls back to a small
 * built-in table (then a round default) so the dashboard never renders a
 * zero-population city scale.
 */
export function useCityPopulation(city: string): PopulationResult {
  const trimmed = city.trim();
  const [result, setResult] = useState<PopulationResult>({
    population: 0,
    city: trimmed,
    estimated: true,
  });

  useEffect(() => {
    if (!trimmed) return;

    let cancelled = false;

    const fallback = () => {
      if (cancelled) return;
      const key = trimmed.toLowerCase();
      setResult({
        population: FALLBACK_POPULATION[key] ?? DEFAULT_POPULATION,
        city: trimmed,
        estimated: true,
      });
    };

    const run = async () => {
      try {
        const response = await fetch(
          `https://ninjacity.net/api/population?city=${encodeURIComponent(trimmed)}`,
          {
            headers: { "X-Api-Key": NINJA_CITY_KEY },
          },
        );
        if (!response.ok) throw new Error(`status ${response.status}`);

        const payload = await response.json();
        const population = Number(
          payload?.population ?? payload?.data?.population ?? payload?.result?.population,
        );
        if (!Number.isFinite(population) || population <= 0) throw new Error("bad payload");

        if (!cancelled) {
          setResult({ population, city: trimmed, estimated: false });
        }
      } catch {
        fallback();
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [trimmed]);

  if (!trimmed) {
    return { population: 0, city, estimated: true };
  }
  return result;
}
