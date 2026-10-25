import { TimerBells, type BellSound } from "~/lib/timer-bells";
export type { BellSound } from "~/lib/timer-bells";
export type TimerSettings = {
  minutes: number;
  intervalMinutes: number;
  settleSeconds: 0 | 10 | 30 | 60;
  bell: BellSound;
  startStrikes: 1 | 2 | 3;
  endStrikes: 1 | 2 | 3;
  volume: number;
};
export type TimerPhase =
  | "idle"
  | "settling"
  | "sitting"
  | "paused"
  | "complete";
export type TimerSnapshot = {
  phase: TimerPhase;
  totalMs: number;
  elapsedMs: number;
  remainingMs: number;
  settleRemainingMs: number;
  nextBellInMs: number | null;
};
export type TimerResult = {
  durationSec: number;
  completed: boolean;
  startedAt: number;
};
export const DEFAULT_TIMER_SETTINGS: TimerSettings = {
  minutes: 20,
  intervalMinutes: 0,
  settleSeconds: 10,
  bell: "bowl",
  startStrikes: 1,
  endStrikes: 3,
  volume: 0.8,
};
const KEY = "dharmaradio:timer:v1";
const clamp = (n: number, min: number, max: number) =>
  Math.max(min, Math.min(max, n));
export function normalizeSettings(
  p: Partial<TimerSettings>,
  base = DEFAULT_TIMER_SETTINGS,
): TimerSettings {
  return {
    minutes: Number.isFinite(p.minutes)
      ? clamp(Math.round(p.minutes!), 1, 180)
      : base.minutes,
    intervalMinutes: Number.isFinite(p.intervalMinutes)
      ? clamp(Math.round(p.intervalMinutes!), 0, 180)
      : base.intervalMinutes,
    settleSeconds: [0, 10, 30, 60].includes(p.settleSeconds!)
      ? p.settleSeconds!
      : base.settleSeconds,
    bell: ["bowl", "bell", "wood"].includes(p.bell!) ? p.bell! : base.bell,
    startStrikes: [1, 2, 3].includes(p.startStrikes!)
      ? p.startStrikes!
      : base.startStrikes,
    endStrikes: [1, 2, 3].includes(p.endStrikes!)
      ? p.endStrikes!
      : base.endStrikes,
    volume: Number.isFinite(p.volume) ? clamp(p.volume!, 0, 1) : base.volume,
  };
}
type State = {
  settings: TimerSettings;
  phase: TimerPhase;
  result: TimerResult | null;
};
const initialClock: TimerSnapshot = {
  phase: "idle",
  totalMs: 1200000,
  elapsedMs: 0,
  remainingMs: 1200000,
  settleRemainingMs: 0,
  nextBellInMs: null,
};

/** Timestamp state machine; only clock subscribers receive the 250ms ticks. */
export class TimerEngine {
  private state: State = {
    settings: { ...DEFAULT_TIMER_SETTINGS },
    phase: "idle",
    result: null,
  };
  private clock = initialClock;
  private listeners = new Set<() => void>();
  private clockListeners = new Set<() => void>();
  private active = { ...DEFAULT_TIMER_SETTINGS };
  private segmentAt = 0;
  private elapsed = 0;
  private settleLeft = 0;
  private sittingAt = 0;
  private audioScheduledAt: number | null = null;
  private wallScheduledAt = 0;
  private pendingEndNotice = false;
  private pausedPhase: "settling" | "sitting" = "sitting";
  readonly bells = new TimerBells();
  onFinish: (result: TimerResult) => void = () => undefined;
  onStart: () => void = () => undefined;
  getState = () => this.state;
  getServerClock = () => initialClock;
  getClock = () => this.clock;
  getTotalMs = () =>
    (this.state.phase === "idle"
      ? this.state.settings.minutes
      : this.active.minutes) * 60000;
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };
  subscribeClock = (fn: () => void) => {
    this.clockListeners.add(fn);
    return () => {
      this.clockListeners.delete(fn);
    };
  };
  private publish(p: Partial<State>) {
    this.state = { ...this.state, ...p };
    for (const fn of this.listeners) fn();
  }
  hydrate = () => {
    try {
      const raw: unknown = JSON.parse(localStorage.getItem(KEY) ?? "null");
      if (raw && typeof raw === "object")
        this.publish({ settings: normalizeSettings(raw) });
    } catch {
      /* Unavailable/corrupt storage keeps defaults. */
    }
    this.tick();
  };
  updateSettings = (p: Partial<TimerSettings>) => {
    const settings = normalizeSettings(p, this.state.settings);
    this.publish({ settings });
    try {
      localStorage.setItem(KEY, JSON.stringify(settings));
    } catch {
      /* Storage optional. */
    }
    this.tick();
  };
  start = (overrides: Partial<TimerSettings> = {}) => {
    this.bells.cancel();
    this.pendingEndNotice = false;
    this.bells.keepAlive(); // Must run synchronously within the user gesture.
    this.onStart();
    this.active = normalizeSettings(overrides, this.state.settings);
    this.elapsed = 0;
    this.settleLeft = this.active.settleSeconds * 1000;
    this.segmentAt = Date.now();
    this.sittingAt = this.segmentAt + this.settleLeft;
    this.publish({
      phase: this.settleLeft ? "settling" : "sitting",
      result: null,
    });
    this.schedule(true);
    this.tick();
  };
  private schedule(includeStart: boolean) {
    this.audioScheduledAt = this.bells.getAudioTime();
    this.wallScheduledAt = Date.now();
    const s = this.active;
    const delay = this.state.phase === "settling" ? this.settleLeft / 1000 : 0;
    const left = (s.minutes * 60000 - this.elapsed) / 1000;
    if (includeStart)
      for (let i = 0; i < s.startStrikes; i++)
        this.bells.strike(s.bell, s.volume, delay + i * 4);
    if (s.intervalMinutes > 0) {
      const interval = s.intervalMinutes * 60;
      for (
        let at = (Math.floor(this.elapsed / 1000 / interval) + 1) * interval;
        at < s.minutes * 60;
        at += interval
      )
        this.bells.strike(
          s.bell,
          s.volume * 0.5,
          delay + at - this.elapsed / 1000,
        );
    }
    for (let i = 0; i < s.endStrikes; i++) {
      const at = delay + left + i * 4;
      if (at >= 0) this.bells.strike(s.bell, s.volume, at);
    }
  }
  /** AudioContext time can freeze independently of wall time on iOS. Never replay
   * a backlog of interval bells after foregrounding a suspended context. */
  recoverAudio = () => {
    const wasRunning = ["settling", "sitting"].includes(this.state.phase);
    const drifted = this.audioDrifted();
    this.tick();
    if (!wasRunning) {
      if (this.state.phase === "complete" && this.pendingEndNotice) {
        this.bells.unlock();
        this.bells.strike(this.active.bell, this.active.volume * 0.5);
        this.pendingEndNotice = false;
      }
      return;
    }
    if (drifted) {
      this.bells.cancel();
      this.bells.unlock();
      if (this.state.phase === "complete") {
        this.bells.strike(this.active.bell, this.active.volume * 0.5);
        this.pendingEndNotice = false;
        return;
      }
      if (this.state.phase === "sitting")
        this.elapsed += Math.max(0, Date.now() - this.segmentAt);
      this.settleLeft = this.clock.settleRemainingMs;
      this.segmentAt = Date.now();
      this.schedule(this.state.phase === "settling");
    }
    if (["settling", "sitting"].includes(this.state.phase))
      this.bells.keepAlive();
  };
  private audioDrifted() {
    const audioNow = this.bells.getAudioTime();
    return (
      audioNow !== null &&
      this.audioScheduledAt !== null &&
      Math.abs(
        (Date.now() - this.wallScheduledAt) / 1000 -
          (audioNow - this.audioScheduledAt),
      ) > 1
    );
  }
  tick = () => {
    const now = Date.now();
    let phase = this.state.phase;
    const delta = Math.max(0, now - this.segmentAt);
    if (phase === "settling" && delta >= this.settleLeft) {
      this.segmentAt += this.settleLeft;
      this.settleLeft = 0;
      phase = "sitting";
      this.publish({ phase });
    }
    const totalMs =
      (phase === "idle" ? this.state.settings.minutes : this.active.minutes) *
      60000;
    const elapsedMs = clamp(
      this.elapsed +
        (phase === "sitting" ? Math.max(0, now - this.segmentAt) : 0),
      0,
      totalMs,
    );
    if (
      phase === "sitting" &&
      this.elapsed + now - this.segmentAt >=
        totalMs + (this.active.endStrikes - 1) * 4000
    ) {
      this.finish(totalMs, true);
      return;
    }
    const interval = this.active.intervalMinutes * 60000;
    const nextAt =
      interval > 0
        ? (Math.floor(elapsedMs / interval) + 1) * interval
        : totalMs;
    const settleRemainingMs =
      phase === "settling"
        ? Math.max(0, this.settleLeft - delta)
        : phase === "paused" && this.pausedPhase === "settling"
          ? this.settleLeft
          : 0;
    this.clock = {
      phase,
      totalMs,
      elapsedMs,
      remainingMs: totalMs - elapsedMs,
      settleRemainingMs,
      nextBellInMs:
        phase === "settling"
          ? settleRemainingMs
          : phase === "sitting" && elapsedMs < totalMs
            ? Math.min(nextAt, totalMs) - elapsedMs
            : null,
    };
    for (const fn of this.clockListeners) fn();
  };
  pause = () => {
    this.tick();
    const phase = this.state.phase;
    if (phase !== "settling" && phase !== "sitting") return;
    // Once the end sequence starts, let its scheduled strikes finish.
    if (phase === "sitting" && this.clock.remainingMs === 0) return;
    this.pausedPhase = phase;
    this.elapsed = this.clock.elapsedMs;
    this.settleLeft = this.clock.settleRemainingMs;
    this.bells.cancel();
    this.bells.stopKeepAlive();
    this.publish({ phase: "paused" });
    this.tick();
  };
  resume = () => {
    if (this.state.phase !== "paused") return;
    this.bells.keepAlive();
    this.onStart();
    this.segmentAt = Date.now();
    if (this.pausedPhase === "settling")
      this.sittingAt = this.segmentAt + this.settleLeft;
    this.publish({ phase: this.pausedPhase });
    this.schedule(this.pausedPhase === "settling");
    this.tick();
  };
  private finish(elapsedMs: number, completed: boolean) {
    if (completed && this.audioDrifted()) {
      this.bells.cancel();
      this.pendingEndNotice = true;
    }
    this.elapsed = elapsedMs;
    this.bells.stopKeepAlive();
    const result = {
      durationSec: Math.floor(elapsedMs / 1000),
      completed,
      startedAt: this.sittingAt,
    };
    this.publish({ phase: "complete", result });
    this.tick();
    this.onFinish(result);
  }
  end = () => {
    this.tick();
    if (!["settling", "sitting", "paused"].includes(this.state.phase)) return;
    const elapsed = this.clock.elapsedMs;
    this.bells.cancel();
    this.bells.unlock();
    this.bells.strike(this.active.bell, this.active.volume * 0.5);
    this.finish(elapsed, false);
  };
  dismiss = () => {
    if (!["complete", "paused"].includes(this.state.phase)) return;
    this.bells.cancel();
    this.bells.stopKeepAlive();
    this.elapsed = 0;
    this.settleLeft = 0;
    this.publish({ phase: "idle", result: null });
    this.tick();
  };
  previewBell = (sound?: BellSound) => {
    this.bells.unlock();
    this.bells.strike(
      sound ?? this.state.settings.bell,
      this.state.settings.volume,
    );
  };
  dispose = () => {
    this.bells.dispose();
  };
}
