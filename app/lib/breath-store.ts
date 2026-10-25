import { useSyncExternalStore } from "react";
import { isBreathPattern, type BreathPatternKey } from "~/lib/breath";

/**
 * Breathing choices, kept on this device, and what kind of session the timer is
 * running right now. The timer engine stays a plain timer; this sits beside it.
 */
export type BreathPrefs = {
  /** Guide shown while settling in and for the first minutes of a sit. */
  guide: BreathPatternKey | "off";
  /** Pattern for a standalone breathing practice. */
  pattern: BreathPatternKey;
  minutes: 1 | 3 | 5;
};

export type SessionMode =
  | { kind: "sit"; guide: BreathPatternKey | null; settleMs: number }
  | { kind: "breathe"; pattern: BreathPatternKey };

export const BREATHE_LENGTHS = [1, 3, 5] as const;
/** How long the guide keeps going once the sit itself has begun. */
export const GUIDE_INTO_SIT_MS = 2 * 60_000;

const KEY = "dharmaradio:breath:v1";
const DEFAULT_PREFS: BreathPrefs = { guide: "calm", pattern: "calm", minutes: 3 };

let prefs = DEFAULT_PREFS;
let mode: SessionMode = { kind: "sit", guide: null, settleMs: 0 };
let hydrated = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((fn) => fn());

function hydrate() {
  if (hydrated || typeof localStorage === "undefined") return;
  hydrated = true;
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "null") as Partial<BreathPrefs> | null;
    if (raw && typeof raw === "object")
      prefs = {
        guide: raw.guide === "off" || isBreathPattern(raw.guide) ? raw.guide : DEFAULT_PREFS.guide,
        pattern: isBreathPattern(raw.pattern) ? raw.pattern : DEFAULT_PREFS.pattern,
        minutes: raw.minutes === 1 || raw.minutes === 3 || raw.minutes === 5 ? raw.minutes : DEFAULT_PREFS.minutes,
      };
  } catch {
    /* Unavailable or corrupt storage keeps defaults. */
  }
}

const subscribe = (fn: () => void) => {
  listeners.add(fn);
  if (!hydrated) {
    hydrate();
    // Settle any component that rendered with defaults during hydration.
    queueMicrotask(emit);
  }
  return () => {
    listeners.delete(fn);
  };
};

export function updateBreathPrefs(next: Partial<BreathPrefs>) {
  hydrate();
  prefs = { ...prefs, ...next };
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    /* Storage optional. */
  }
  emit();
}

export function setSessionMode(next: SessionMode) {
  mode = next;
  emit();
}

export function useBreathPrefs() {
  return useSyncExternalStore(subscribe, () => prefs, () => DEFAULT_PREFS);
}

export function useSessionMode() {
  return useSyncExternalStore(subscribe, () => mode, () => mode);
}
