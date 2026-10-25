export type BreathPatternKey = "calm" | "box" | "478";
export type BreathPhaseKind = "in" | "hold" | "out" | "rest";
type Phase = { kind: BreathPhaseKind; sec: number };

export const BREATH_PATTERNS: Record<
  BreathPatternKey,
  { label: string; summary: string; phases: Phase[] }
> = {
  calm: {
    label: "Calm",
    summary: "In for 4, out for 6",
    phases: [
      { kind: "in", sec: 4 },
      { kind: "out", sec: 6 },
    ],
  },
  box: {
    label: "Box",
    summary: "In, hold, out, hold, 4 each",
    phases: [
      { kind: "in", sec: 4 },
      { kind: "hold", sec: 4 },
      { kind: "out", sec: 4 },
      { kind: "rest", sec: 4 },
    ],
  },
  "478": {
    label: "4-7-8",
    summary: "In for 4, hold for 7, out for 8",
    phases: [
      { kind: "in", sec: 4 },
      { kind: "hold", sec: 7 },
      { kind: "out", sec: 8 },
    ],
  },
};

// Integer-like keys ("478") would sort first in Object.keys, so the order is spelled out.
export const BREATH_PATTERN_KEYS: BreathPatternKey[] = ["calm", "box", "478"];

export const PHASE_LABEL: Record<BreathPhaseKind, string> = {
  in: "Breathe in",
  hold: "Hold",
  out: "Breathe out",
  rest: "Hold",
};

export function isBreathPattern(value: unknown): value is BreathPatternKey {
  return typeof value === "string" && value in BREATH_PATTERNS;
}

export type BreathState = {
  kind: BreathPhaseKind;
  /** 0..1 through the current phase. */
  progress: number;
  /** Whole seconds left in the phase, counting down to 1. */
  count: number;
  /** 0 (empty) .. 1 (full), eased, for drawing. */
  fullness: number;
};

const ease = (t: number) => (1 - Math.cos(Math.PI * Math.min(1, Math.max(0, t)))) / 2;

/** Where in the breath cycle a given number of milliseconds falls. */
export function breathAt(pattern: BreathPatternKey, elapsedMs: number): BreathState {
  const { phases } = BREATH_PATTERNS[pattern];
  const cycle = phases.reduce((n, p) => n + p.sec * 1000, 0);
  let at = ((Math.max(0, elapsedMs) % cycle) + cycle) % cycle;
  for (const phase of phases) {
    const ms = phase.sec * 1000;
    if (at < ms) {
      const progress = at / ms;
      const fullness =
        phase.kind === "in" ? ease(progress) : phase.kind === "out" ? 1 - ease(progress) : phase.kind === "hold" ? 1 : 0;
      return { kind: phase.kind, progress, count: Math.max(1, Math.ceil((ms - at) / 1000)), fullness };
    }
    at -= ms;
  }
  return { kind: "in", progress: 0, count: phases[0].sec, fullness: 0 };
}
