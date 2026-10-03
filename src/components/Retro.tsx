import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  type ReactNode,
} from "react";

/* ==========================================================================
   Block slide & swap
   ========================================================================== */

export interface SwitcherOption<T extends string> {
  id: T;
  label: string;
}

/**
 * Tab rail whose active block slides across in discrete steps.
 *
 * The highlight's width and offset are written straight to the element as CSS
 * custom properties rather than held in state. That keeps the measurement out of
 * React's render path and out of an effect that would set state synchronously.
 */
export function RetroSwitcher<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: ReadonlyArray<SwitcherOption<T>>;
  value: T;
  onChange: (id: T) => void;
  label: string;
}) {
  const railRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const position = useCallback(() => {
    const index = options.findIndex((o) => o.id === value);
    const button = buttonRefs.current[index];
    const rail = railRef.current;
    if (!button || !rail) return;
    const from = rail.getBoundingClientRect();
    const to = button.getBoundingClientRect();
    const highlight = rail.firstElementChild as HTMLElement | null;
    if (!highlight) return;
    highlight.style.setProperty("--nb-tab-w", `${to.width}px`);
    highlight.style.setProperty("--nb-tab-x", `${to.left - from.left}px`);
  }, [options, value]);

  // Layout effect so the block is in place before the first paint.
  useLayoutEffect(position, [position]);

  // Re-measure when the rail's own width changes, e.g. the view wraps to a new
  // column on resize.
  useEffect(() => {
    window.addEventListener("resize", position);
    return () => window.removeEventListener("resize", position);
  }, [position]);

  return (
    <div ref={railRef} className="nb-tab-rail" role="tablist" aria-label={label}>
      <span className="nb-tab-highlight" aria-hidden="true" />
      {options.map((option, i) => (
        <button
          key={option.id}
          ref={(node) => {
            buttonRefs.current[i] = node;
          }}
          type="button"
          role="tab"
          aria-selected={option.id === value}
          onClick={() => onChange(option.id)}
          className="nb-tab"
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/* ==========================================================================
   Status marquee
   ========================================================================== */

/**
 * Continuous ticker.
 *
 * The message list is rendered twice and the track slides by exactly -50%, so
 * the second copy is already where the first started when the loop restarts —
 * there is no seam and no jump.
 */
export function RetroMarquee({
  items,
  intervalSeconds = 30,
}: {
  items: readonly string[];
  intervalSeconds?: number;
}) {
  if (items.length === 0) return null;
  return (
    <div className="nb-marquee py-1.5">
      <div
        className="nb-marquee__track"
        style={{ animationDuration: `${intervalSeconds}s` }}
      >
        {[0, 1].map((copy) => (
          <span key={copy} className="flex shrink-0" aria-hidden={copy === 1}>
            {items.map((item, i) => (
              <span
                key={`${copy}-${i}`}
                className="px-4 text-[10px] font-black uppercase tracking-widest text-[var(--nb-text-2)]"
              >
                {item}
              </span>
            ))}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ==========================================================================
   Slot-machine value flip
   ========================================================================== */

/**
 * Replays the vertical flip whenever the value changes.
 *
 * The animation is driven by the key on the inner span rather than by
 * re-mounting through state: changing the key gives React a new element, which
 * restarts the CSS animation on its own.
 */
export function SlotValue({
  value,
  className,
}: {
  value: string;
  className?: string;
}) {
  return (
    <span className="nb-slot">
      <span key={value} className={`nb-slot__inner ${className ?? ""}`}>
        {value}
      </span>
    </span>
  );
}

/* ==========================================================================
   Scroll reveal
   ========================================================================== */

/**
 * Adds `is-visible` once the element scrolls into view.
 *
 * The observer disconnects after the first trigger — the reveal plays on entry,
 * not every time the element re-enters, which is what stops a long dashboard
 * page from flickering as the user scrolls back up.
 */
export function useReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (typeof IntersectionObserver === "undefined") {
      node.classList.add("is-visible");
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add("is-visible");
          observer.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -8% 0px" },
    );
    node.classList.add("nb-rise");
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return ref;
}

/** Wraps children in a block that eases up the first time it is scrolled to. */
export function Reveal({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useReveal<HTMLDivElement>();
  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}