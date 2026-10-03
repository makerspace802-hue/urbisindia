import { Cloud, CloudFog, CloudLightning, CloudRain, CloudSnow, CloudSun, Sun } from "lucide-react";

/**
 * Live weather for the floating widget.
 *
 * Open-Meteo is used because it needs no API key and no account, which matters
 * for a deployment that is published as-is: there is no secret to leak and
 * nothing for the owner to configure before the widget works.
 *
 * The previous version shipped four hardcoded temperatures (37°, 33°, 28°,
 * 24°) chosen by hand, so the widget reported a number that belonged to
 * nobody. Everything here is read from the live response instead.
 */

export type Condition =
  | "clear"
  | "partly"
  | "cloudy"
  | "fog"
  | "rain"
  | "snow"
  | "storm";

export const CONDITION: Record<
  Condition,
  { label: string; detail: string; Icon: typeof Sun }
> = {
  clear: { label: "Clear", detail: "Sky clear", Icon: Sun },
  partly: { label: "Partly Cloudy", detail: "Broken cloud", Icon: CloudSun },
  cloudy: { label: "Overcast", detail: "Full cloud cover", Icon: Cloud },
  fog: { label: "Fog", detail: "Low visibility", Icon: CloudFog },
  rain: { label: "Rain", detail: "Wet conditions", Icon: CloudRain },
  snow: { label: "Snow", detail: "Snowfall", Icon: CloudSnow },
  storm: { label: "Thunderstorm", detail: "Lightning activity", Icon: CloudLightning },
};

export const ORDER: Condition[] = [
  "clear",
  "partly",
  "cloudy",
  "fog",
  "rain",
  "snow",
  "storm",
];

/** WMO 4677 weather codes as published by Open-Meteo. */
export function conditionFromCode(code: number): Condition {
  if (code === 0 || code === 1) return "clear";
  if (code === 2) return "partly";
  if (code === 3) return "cloudy";
  if (code === 45 || code === 48) return "fog";
  if (code >= 51 && code <= 57) return "rain";
  if (code >= 61 && code <= 67) return "rain";
  if (code >= 71 && code <= 77) return "snow";
  if (code >= 80 && code <= 82) return "rain";
  if (code === 85 || code === 86) return "snow";
  if (code >= 95) return "storm";
  return "cloudy";
}

export interface LiveWeather {
  tempC: number;
  humidity: number;
  windKph: number;
  condition: Condition;
  isDay: boolean;
  observedAt: string;
}

/**
 * Used when geolocation is unavailable or refused, so the widget still shows a
 * real place's weather rather than an invented one. Bhopal — the school's city.
 */
export const FALLBACK_POINT = { lat: 23.2599, lon: 77.4126, label: "Bhopal" };

const ENDPOINT = "https://api.open-meteo.com/v1/forecast";

export async function fetchWeather(
  lat: number,
  lon: number,
  signal?: AbortSignal,
): Promise<LiveWeather> {
  const params = new URLSearchParams({
    latitude: lat.toFixed(4),
    longitude: lon.toFixed(4),
    current: "temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,is_day",
    timezone: "auto",
  });

  const response = await fetch(`${ENDPOINT}?${params.toString()}`, { signal });
  if (!response.ok) {
    throw new Error(`Weather service responded ${response.status}`);
  }

  const body = (await response.json()) as {
    current?: {
      temperature_2m?: number;
      relative_humidity_2m?: number;
      weather_code?: number;
      wind_speed_10m?: number;
      is_day?: number;
      time?: string;
    };
  };

  const current = body.current;
  if (!current || typeof current.temperature_2m !== "number") {
    throw new Error("Weather service returned no current reading");
  }

  return {
    tempC: current.temperature_2m,
    humidity: current.relative_humidity_2m ?? 0,
    windKph: current.wind_speed_10m ?? 0,
    condition: conditionFromCode(current.weather_code ?? 3),
    isDay: (current.is_day ?? 1) === 1,
    observedAt: current.time ?? "",
  };
}

/** Human-readable detail line built from whichever readings came back. */
export function detailFor(w: LiveWeather): string {
  const bits: string[] = [CONDITION[w.condition].detail];
  if (w.humidity > 0) bits.push(`Humidity ${Math.round(w.humidity)}%`);
  if (w.windKph > 0) bits.push(`Wind ${Math.round(w.windKph)} km/h`);
  return bits.join(" · ");
}