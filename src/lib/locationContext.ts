/**
 * Location context — types and the hook, kept apart from the provider
 * component.
 *
 * Split deliberately: a module that exports both a component and a hook trips
 * `react-refresh/only-export-components`, which is why the provider itself lives
 * in `components/LocationProvider.tsx`.
 */

import { createContext, useContext } from "react";
import type { LocateStatus, LocationFix } from "@/lib/locate";

export interface LocationContextValue {
  /** Which stage of the chain answered. */
  status: LocateStatus;
  /** Always populated — never null, so no screen renders blank. */
  fix: LocationFix;
  /** True when the answer is an IP guess or the default city, not a GPS fix. */
  approximate: boolean;
  /** A request is in flight right now. */
  busy: boolean;
  /** Census state name, or null when the fix is outside the mapped states. */
  state: string | null;
  /** Short label for chips and toasts. */
  label: string;
  /**
   * Ask again. `force` skips the cache, which is what the retry button needs
   * after the visitor has changed their browser's permission setting.
   */
  request: (options?: { force?: boolean }) => void;
}

export const LocationContext = createContext<LocationContextValue | null>(null);

/** The shared fix. Throws if used outside the provider, which is a wiring bug. */
export function useLocation(): LocationContextValue {
  const value = useContext(LocationContext);
  if (!value) {
    throw new Error("useLocation must be used inside <LocationProvider>");
  }
  return value;
}

/** Copy shown in a toast for each way location can fail. */
export const LOCATE_MESSAGES: Record<
  Exclude<LocateStatus, "idle" | "requesting" | "success">,
  { title: string; body: (label: string) => string }
> = {
  denied: {
    title: "Location blocked",
    body: (label) =>
      `Your browser is withholding location access, so URBIS is using ${label} instead. Allow location in your browser's site settings to see your own state.`,
  },
  timeout: {
    title: "Location timed out",
    body: (label) =>
      `The location request did not come back in time, so URBIS is using ${label} instead.`,
  },
  unsupported: {
    title: "Location unavailable",
    body: (label) =>
      `This browser does not offer location access, so URBIS is using ${label} instead.`,
  },
};