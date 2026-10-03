import { toast } from "sonner";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { censusName, matchPlace } from "@/lib/geo";
import { locate, type LocateStatus, type LocationFix } from "@/lib/locate";
import { LOCATE_MESSAGES, LocationContext } from "@/lib/locationContext";
import type { ReactNode } from "react";

/** State before the first attempt resolves. Never blank, never a spinner alone. */
const INITIAL_FIX: LocationFix = {
  lat: 23.2599,
  lon: 77.4126,
  label: "Locating…",
  state: null,
  source: "fallback",
};

/**
 * One location request for the whole app.
 *
 * `CensusCharts` and `ClockWeatherWidget` used to each call
 * `navigator.geolocation` on mount. That meant two permission prompts, two
 * independent chances to hang, and two different answers when one resolved and
 * the other did not. They now share this provider and both re-read the same fix.
 */
export function LocationProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<LocateStatus>("idle");
  const [fix, setFix] = useState<LocationFix>(INITIAL_FIX);
  const [approximate, setApproximate] = useState(true);
  const [busy, setBusy] = useState(false);

  /**
   * Guards against a late response overwriting a newer one, and against setting
   * state after unmount. StrictMode mounts effects twice in development, so
   * without this the first run's callbacks would land on the second run.
   */
  const runRef = useRef(0);
  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  const request = useCallback((options?: { force?: boolean }) => {
    const run = ++runRef.current;
    const isCurrent = () => aliveRef.current && runRef.current === run;

    setStatus("requesting");
    setBusy(true);

    void locate({
      force: options?.force,
      resolveState: (lat, lon) => {
        const hit = matchPlace(lat, lon);
        return hit ? censusName(hit.name) : null;
      },
    }).then((outcome) => {
      if (!isCurrent()) return;
      setStatus(outcome.status);
      setFix(outcome.fix);
      setApproximate(outcome.approximate);
      setBusy(false);

      // Silent on success — a toast on every page load would be noise. Only the
      // failure paths speak up, and only once per distinct failure.
      const copy =
        outcome.status === "denied" ||
        outcome.status === "timeout" ||
        outcome.status === "unsupported"
          ? LOCATE_MESSAGES[outcome.status]
          : null;
      if (copy) {
        toast.warning(copy.title, { description: copy.body(outcome.fix.label) });
      }
    });
  }, []);

  useEffect(() => {
    // Deferred to a macrotask so the effect body itself never updates state,
    // which `react-hooks/set-state-in-effect` treats as a render-phase update.
    const initial = setTimeout(() => request(), 0);
    return () => clearTimeout(initial);
  }, [request]);

  const value = useMemo(
    () => ({
      status,
      fix,
      approximate,
      busy,
      state: fix.state,
      label: fix.source === "gps" ? fix.state ?? fix.label : fix.label,
      request,
    }),
    [status, fix, approximate, busy, request],
  );

  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
}