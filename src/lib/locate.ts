/**
 * Where the visitor is, and how we found out.
 *
 * This is the single source of truth for location on the site. The browser
 * Geolocation API is unreliable as a *first* source: it silently refuses in an
 * iframe without `allow="geolocation"`, times out on a weak fix, and returns
 * nothing at all on a desktop browser that never saw a permission prompt. Two
 * components used to call `navigator.geolocation` independently, which meant two
 * permission prompts and two chances for one of them to hang. They now share
 * one request through `LocationProvider`.
 *
 * The chain is deliberately: cached fix -> GPS -> IP lookup -> configured city.
 * Every step produces a usable answer, so no screen is ever blank or stuck on a
 * spinner, and `status` always says which step answered.
 */

/** The six states the UI renders. */
export type LocateStatus =
  | "idle"
  | "requesting"
  | "success"
  | "denied"
  | "unsupported"
  | "timeout";

/** How a fix was obtained. Determines how much the label should be trusted. */
export type LocateSource = "gps" | "cache" | "ip" | "fallback";

export interface LocationFix {
  lat: number;
  lon: number;
  /** Short human label, e.g. "Bhopal" or "Bhopal, Madhya Pradesh". */
  label: string;
  /**
   * Census state name when the fix falls inside India and a box contains it,
   * otherwise null. This is the value the Census charts filter on.
   */
  state: string | null;
  source: LocateSource;
}

export interface LocateOutcome {
  status: LocateStatus;
  fix: LocationFix;
  /**
   * True when the answer came from something weaker than the visitor actually
   * asking for — the IP fallback or the default city. The UI warns in this case
   * rather than silently showing the wrong state as if it were a GPS reading.
   */
  approximate: boolean;
}

/**
 * The configured default.
 *
 * Used when geolocation is unsupported, refused, times out, AND the IP lookup
 * fails. Bhopal because that is the app's home city and the weather widget has
 * always fallen back to it — changing it would silently repoint the whole site.
 * Change it here to move the default for every screen at once.
 */
export const FALLBACK_PLACE = {
  lat: 23.2599,
  lon: 77.4126,
  label: "Bhopal",
  state: "Madhya Pradesh",
} as const;

/**
 * How long a fix stays good enough to skip the prompt.
 *
 * Six hours: long enough that someone who reloads through the afternoon is not
 * asked again, short enough that a visitor who actually flies to another city is
 * not stuck on last night's coordinates. `request({ force: true })` bypasses it.
 */
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const CACHE_KEY = "urbis.location.v1";

/** Long enough for a cold fix, short enough that a hung radio is not waited on. */
const GPS_TIMEOUT_MS = 10_000;
const IP_TIMEOUT_MS = 5_000;

function inRange(lat: number, lon: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;
}

/** Narrows an untrusted value pair to usable coordinates. */
function isFiniteCoord(lat: unknown, lon: unknown): lat is number {
  return (
    typeof lat === "number" &&
    typeof lon === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lon) <= 180
  );
}

const FALLBACK_FIX: LocationFix = {
  lat: FALLBACK_PLACE.lat,
  lon: FALLBACK_PLACE.lon,
  label: FALLBACK_PLACE.label,
  state: FALLBACK_PLACE.state,
  source: "fallback",
};

/**
 * Read the cached fix, ignoring anything malformed or stale.
 *
 * Storage can be disabled outright (Safari private mode, a blocked third-party
 * context), so every access is wrapped. A corrupt entry is cleared rather than
 * left to fail on every later read.
 */
export function readCache(now = Date.now()): LocationFix | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      lat?: unknown;
      lon?: unknown;
      label?: unknown;
      state?: unknown;
      at?: unknown;
    };
    if (typeof parsed.lat !== "number" || typeof parsed.lon !== "number") {
      window.localStorage.removeItem(CACHE_KEY);
      return null;
    }
    if (!inRange(parsed.lat, parsed.lon)) {
      window.localStorage.removeItem(CACHE_KEY);
      return null;
    }
    if (typeof parsed.at !== "number" || now - parsed.at > CACHE_TTL_MS) return null;
    return {
      lat: parsed.lat,
      lon: parsed.lon,
      label: typeof parsed.label === "string" ? parsed.label : FALLBACK_PLACE.label,
      state: typeof parsed.state === "string" ? parsed.state : null,
      source: "cache",
    };
  } catch {
    // Malformed JSON, or storage blocked outright. Drop the entry so it is not
    // re-parsed on every read for the rest of the session.
    try {
      window.localStorage.removeItem(CACHE_KEY);
    } catch {
      // Storage unavailable; nothing further to do.
    }
    return null;
  }
}

export function writeCache(fix: LocationFix, now = Date.now()): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({
        lat: fix.lat,
        lon: fix.lon,
        label: fix.label,
        state: fix.state,
        at: now,
      }),
    );
  } catch {
    // Storage full or blocked. The cache is an optimisation, not a requirement.
  }
}

/**
 * `getCurrentPosition` has no abort of its own, so the wait is raced.
 *
 * A rejection is re-thrown rather than folded into the timeout result. Folding
 * them together loses the error code, which is the only way to tell a refusal
 * (code 1) from a failed fix (code 2) or a timeout (code 3) — and reporting a
 * refusal as a timeout tells the visitor the wrong thing about their own
 * browser settings.
 */
function withTimeout<T>(work: Promise<T>, ms: number): Promise<T | null> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => resolve(null), ms);
    work.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/**
 * Error code 1 is an explicit refusal; 3 is a timeout. Code 2 ("position
 * unavailable") usually means the radio could not get a fix in time, which is
 * worth retrying rather than reporting to the visitor as a denial they did not
 * make — it maps to the same user-facing message as a timeout.
 */
function statusForGeolocationError(code: number): LocateStatus {
  if (code === 3) return "timeout";
  if (code === 2) return "timeout";
  return "denied";
}

async function requestGps(): Promise<{
  status: LocateStatus;
  fix?: { lat: number; lon: number };
}> {
  if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
    return { status: "unsupported" };
  }
  // Present-but-throwing happens when geolocation is blocked by policy, so the
  // feature test alone is not enough to promise the call will work.
  try {
    const reading = new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        resolve,
        (error) => reject(error),
        {
          enableHighAccuracy: false,
          timeout: GPS_TIMEOUT_MS,
          // Reuse a fix the browser already holds instead of waking the radio.
          maximumAge: 15 * 60_000,
        },
      );
    });

    const position = await withTimeout(reading, GPS_TIMEOUT_MS + 500);
    if (!position) return { status: "timeout" };

    const { latitude, longitude } = position.coords;
    if (!isFiniteCoord(latitude, longitude)) return { status: "timeout" };
    return { status: "success", fix: { lat: latitude, lon: longitude } };
  } catch (error) {
    const code = (error as GeolocationPositionError | undefined)?.code;
    return { status: typeof code === "number" ? statusForGeolocationError(code) : "denied" };
  }
}

/**
 * Coarse location from the visitor's IP.
 *
 * ipapi.co rather than ip-api.com: ip-api.com serves the free tier over plain
 * HTTP only, and an HTTP request from an HTTPS page is blocked as mixed
 * content, so it fails exactly when it is most needed. ipapi.co is HTTPS and
 * keyless, but it does rate-limit — a 429 comes back as a JSON error body, not
 * an HTTP error, so the body is checked rather than just `res.ok`.
 *
 * It resolves to the ISP's exit node, not the visitor: someone on a corporate
 * VPN can land in another city. Every result from here is flagged approximate.
 */
async function requestIp(): Promise<{ lat: number; lon: number; label: string } | null> {
  try {
    const request = fetch("https://ipapi.co/json/").then(
      async (res) => {
        const body = (await res.json()) as Record<string, unknown>;
        // Rate limits and failures arrive as a 200-with-an-error or a non-2xx.
        if (!res.ok || body.error) return null;
        const lat = Number(body.latitude);
        const lon = Number(body.longitude);
        if (!isFiniteCoord(lat, lon)) return null;
        const place = [body.city, body.region]
          .filter((part): part is string => typeof part === "string" && part.length > 0)
          .join(", ");
        return { lat, lon, label: place || "Approximate location" };
      },
    );
    return await withTimeout(request, IP_TIMEOUT_MS);
  } catch {
    return null;
  }
}

export interface LocateOptions {
  /**
   * Skip the cache and ask the browser again. Wired to the retry button, so a
   * visitor who was denied once and has since allowed the permission is not
   * stuck on the cached approximate answer.
   */
  force?: boolean;
  /** Attaches the Census state name, for the charts. */
  resolveState?: (lat: number, lon: number) => string | null;
}

/**
 * Resolve a fix, degrading rather than failing.
 *
 * Never rejects and never returns null: the configured default city is the last
 * link, so a caller can always render something real.
 */
export async function locate(options: LocateOptions = {}): Promise<LocateOutcome> {
  const { force = false, resolveState } = options;

  if (!force) {
    const cached = readCache();
    // A cache hit is not "approximate": the cache only ever holds real GPS
    // fixes (the IP fallback is deliberately never written), so replaying one
    // is exactly as accurate as the original. Flagging it otherwise would show
    // the visitor a "not GPS" warning about their own precise location.
    if (cached) return { status: "success", fix: cached, approximate: false };
  }

  const gps = await requestGps();

  if (gps.status === "success" && gps.fix) {
    const fix: LocationFix = {
      lat: gps.fix.lat,
      lon: gps.fix.lon,
      label: "Your location",
      state: resolveState?.(gps.fix.lat, gps.fix.lon) ?? null,
      source: "gps",
    };
    writeCache(fix);
    return { status: "success", fix, approximate: false };
  }

  // GPS said no. An approximate answer beats a dead screen, but the returned
  // status still reports the real reason so the UI can explain itself.
  const viaIp = await requestIp();
  if (viaIp) {
    const fix: LocationFix = {
      lat: viaIp.lat,
      lon: viaIp.lon,
      label: viaIp.label,
      state: resolveState?.(viaIp.lat, viaIp.lon) ?? null,
      source: "ip",
    };
    // Deliberately NOT cached, despite the coordinates being real. The IP
    // fallback resolves to the network's exit node rather than the visitor —
    // on a corporate VPN or hotel network that can be another city entirely.
    // Caching it would pin that guess for the next six hours.
    return { status: gps.status, fix, approximate: true };
  }

  return {
    status: gps.status,
    fix: { ...FALLBACK_FIX, state: resolveState?.(FALLBACK_FIX.lat, FALLBACK_FIX.lon) ?? FALLBACK_PLACE.state },
    approximate: true,
  };
}