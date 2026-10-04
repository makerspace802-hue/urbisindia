import { useSyncExternalStore } from "react";
import { fetchWeather, type LiveWeather } from "@/lib/weather";

/**
 * One weather reading for the whole page.
 *
 * The header status bar and the draggable clock widget both show a
 * temperature. When each owned its own fetch they could differ — one reading
 * going stale while the other refreshed — and a page that reports two
 * temperatures is worse than one that reports none. So the reading lives here,
 * behind `useSyncExternalStore`, and both surfaces subscribe to it. Exactly one
 * request goes out per location.
 *
 * A module-level store rather than a context because there is no tree to
 * provide through: `AppHeader` and `ClockWeatherWidget` are siblings, and
 * threading a provider between them would change `AppLayout`'s shape for no
 * gain.
 */

let reading: LiveWeather | null = null;
let pending = false;
let inFlight: AbortController | null = null;
let lastQuery = "";

const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Stable primitives, which is what `useSyncExternalStore` requires. */
function getReading(): LiveWeather | null {
  return reading;
}

function getPending(): boolean {
  return pending;
}

/**
 * Fetch for a point, skipping anything already in flight for the same one.
 *
 * The abort controller means a fix that changes mid-request does not leave a
 * late response from the old point to overwrite the new one — which is the
 * same bug the shared location fix was introduced to stop.
 */
export async function loadWeather(lat: number, lon: number): Promise<void> {
  const query = `${lat.toFixed(3)},${lon.toFixed(3)}`;
  if (pending && query === lastQuery) return;

  inFlight?.abort();
  const controller = new AbortController();
  inFlight = controller;
  lastQuery = query;
  pending = true;
  emit();

  try {
    const next = await fetchWeather(lat, lon, controller.signal);
    if (controller.signal.aborted) return;
    reading = next;
  } catch {
    // A failed refresh keeps the last good reading on screen. Blanking it would
    // make a transient network blip look like the weather changed.
    if (controller.signal.aborted) return;
  } finally {
    if (inFlight === controller) {
      inFlight = null;
      pending = false;
      emit();
    }
  }
}

export interface WeatherState {
  live: LiveWeather | null;
  busy: boolean;
}

export function useWeather(): WeatherState {
  const live = useSyncExternalStore(subscribe, getReading, () => null);
  const busy = useSyncExternalStore(subscribe, getPending, () => false);
  return { live, busy };
}