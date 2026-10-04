import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import {
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "framer-motion";
import { formatFigure, parseFigure } from "@/lib/countUp";

/**
 * Shared spring.
 *
 * The dashboard's entry animations, the value roll-up and the header underline
 * all run on these numbers, so one interrupted animation always resumes with
 * the same physics as any other.
 */
const SPRING = { type: "spring" as const, stiffness: 300, damping: 25 };

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
 * Card reading with a roll-up.
 *
 * A numeric value counts from zero to its target on a spring the first time it
 * appears, and keeps its source formatting throughout — `1,210.9M` counts up as
 * "0.0M" … "1,210.9M" rather than as a bare number that reformats halfway
 * through. Anything that is not a figure (a bare year, an em dash) renders
 * verbatim, because a roll-up has nothing to count.
 *
 * The vertical flip is kept: the key on the inner span restarts the CSS
 * animation on its own, so a reading that changes after mount still arrives
 * the way the rest of the panel does.
 */
export function SlotValue({
  value,
  className,
}: {
  value: string;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const figure = useMemo(() => parseFigure(value), [value]);

  const count = useMotionValue(0);
  const text = useTransform(count, (latest) => formatFigure(figure, latest));

  useEffect(() => {
    const controls = animate(
      count,
      figure.value,
      reduced ? { duration: 0 } : SPRING,
    );
    return () => controls.stop();
  }, [count, figure.value, reduced]);

  return (
    <span className="nb-slot">
      <span key={value} className={`nb-slot__inner ${className ?? ""}`}>
        {figure.numeric ? <motion.span>{text}</motion.span> : value}
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