import { MapPin } from "lucide-react";

/**
 * Pulsing location pin — the "we are asking the browser" state.
 *
 * Every animation here is `transform` or `opacity` only, so the whole thing runs
 * on the compositor and never triggers layout. The radar rings expand from a
 * fixed centre with `transform: scale()`, which is why they are square boxes with
 * rounded corners rather than circles growing in width.
 *
 * The motion is disabled under `prefers-reduced-motion` by the `.nb-radar-ring`
 * rule in `index.css`; here we only keep the pin itself readable.
 */
export function LocationPulse({ size = 14 }: { size?: number }) {
  return (
    <span
      className="relative inline-flex shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <span className="nb-radar-ring absolute inset-0 rounded-full border-2 border-[var(--nb-ring)]" />
      <span
        className="nb-radar-ring absolute inset-0 rounded-full border-2 border-[var(--nb-ring)]"
        style={{ animationDelay: "600ms" }}
      />
      <MapPin className="relative size-full text-[var(--nb-ring)]" strokeWidth={3} />
    </span>
  );
}