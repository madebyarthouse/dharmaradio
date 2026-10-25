import { useEffect, useRef, useSyncExternalStore } from "react";
import { BREATH_PATTERNS, breathAt, PHASE_LABEL, type BreathPatternKey } from "~/lib/breath";
import { cn } from "~/lib/cn";

const reducedQuery = "(prefers-reduced-motion: reduce)";
function subscribeReduced(fn: () => void) {
  const query = window.matchMedia(reducedQuery);
  query.addEventListener("change", fn);
  return () => query.removeEventListener("change", fn);
}
export function usePrefersReducedMotion() {
  return useSyncExternalStore(
    subscribeReduced,
    () => window.matchMedia(reducedQuery).matches,
    () => false,
  );
}

/* Geometry, as fractions of the square: the horizon, and the sun's diameter. */
const HORIZON = 0.6;
const SUN = 0.34;
/** Sun centre offset from the horizon, in sun diameters: risen (full) to set (empty). */
const RISEN = -0.66;
const SET = 0.2;

function draw(
  fullness: number,
  sun: HTMLElement | null,
  halo: HTMLElement | null,
  glint: HTMLElement | null,
) {
  const offset = SET + (RISEN - SET) * fullness;
  if (sun) sun.style.transform = `translateY(${offset * 100}%) scale(${0.9 + 0.1 * fullness})`;
  // The halo is larger than the sun, so the same travel is a smaller share of its box.
  if (halo) {
    halo.style.transform = `translateY(${((offset * SUN) / 0.96) * 100}%) scale(${0.78 + 0.3 * fullness})`;
    halo.style.opacity = String(0.3 + 0.7 * fullness);
  }
  if (glint) glint.style.opacity = String(0.15 + 0.55 * fullness);
}

/**
 * A low sun on a horizon that rises as you breathe in and sinks as you breathe out.
 * Driven from the timer's clock so it pauses with the sit; still under reduced motion.
 */
export function BreathSun({
  pattern,
  elapsedMs,
  running,
  className,
}: {
  pattern: BreathPatternKey;
  elapsedMs: number;
  running: boolean;
  className?: string;
}) {
  const reduced = usePrefersReducedMotion();
  const sun = useRef<HTMLDivElement>(null);
  const halo = useRef<HTMLDivElement>(null);
  const glint = useRef<HTMLDivElement>(null);
  const anchor = useRef({ elapsed: elapsedMs, at: 0, running, shown: elapsedMs });

  useEffect(() => {
    anchor.current = { ...anchor.current, elapsed: elapsedMs, running, at: performance.now() };
  }, [elapsedMs, running]);

  useEffect(() => {
    if (reduced) {
      draw(0.6, sun.current, halo.current, glint.current);
      return;
    }
    let frame = 0;
    const loop = (now: number) => {
      frame = requestAnimationFrame(loop);
      const a = anchor.current;
      // The clock ticks four times a second; glide between ticks, never backwards.
      let at = a.elapsed + (a.running ? Math.min(400, now - a.at) : 0);
      if (at < a.shown && a.shown - at < 500) at = a.shown;
      a.shown = at;
      draw(breathAt(pattern, at).fullness, sun.current, halo.current, glint.current);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [pattern, reduced]);

  return (
    <div aria-hidden className={cn("relative aspect-square select-none", className)}>
      <div
        ref={halo}
        className="sun-halo absolute left-[2%] size-[96%] will-change-transform"
        style={{ top: `${(HORIZON - 0.48) * 100}%` }}
      />
      {/* The sun sets behind the horizon, so it is clipped there. */}
      <div className="absolute inset-x-0 top-0 overflow-hidden" style={{ height: `${HORIZON * 100}%` }}>
        <div
          ref={sun}
          className="sun absolute aspect-square rounded-full will-change-transform"
          style={{
            width: `${SUN * 100}%`,
            left: `${((1 - SUN) / 2) * 100}%`,
            top: `${((HORIZON - SUN / 2) / HORIZON) * 100}%`,
          }}
        />
      </div>
      <div
        className="absolute inset-x-[6%] h-px bg-[linear-gradient(to_right,transparent,var(--line-strong)_25%,var(--line-strong)_75%,transparent)]"
        style={{ top: `${HORIZON * 100}%` }}
      />
      {/* Light on water below the horizon. */}
      <div
        ref={glint}
        className="sun-halo absolute left-[30%] h-[7%] w-[40%] rounded-full blur-md"
        style={{ top: `${(HORIZON + 0.03) * 100}%` }}
      />
    </div>
  );
}

/** The words that go with the sun: what to do now, and for how many more counts. */
export function BreathCue({
  pattern,
  elapsedMs,
  className,
}: {
  pattern: BreathPatternKey;
  elapsedMs: number;
  className?: string;
}) {
  const reduced = usePrefersReducedMotion();
  const state = breathAt(pattern, elapsedMs);
  return (
    <div className={cn("flex flex-col items-center", className)}>
      <p className="font-serif text-[1.75rem] leading-none tracking-[-0.02em] md:text-[2rem]">
        {PHASE_LABEL[state.kind]}
      </p>
      <p className="mt-2 text-sm tabular-nums text-ink-faint">{state.count}</p>
      {reduced ? (
        // No movement: a quiet bar that fills with the breath, in whole counts.
        <span className="mt-3 block h-0.5 w-24 overflow-hidden rounded-full bg-line-strong">
          <span
            className="block h-full origin-left bg-accent"
            style={{ transform: `scaleX(${Math.round(state.fullness * 4) / 4})` }}
          />
        </span>
      ) : null}
      <span className="sr-only">{BREATH_PATTERNS[pattern].summary}</span>
    </div>
  );
}
