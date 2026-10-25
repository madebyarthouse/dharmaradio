import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useAudio } from "~/contexts/audio-context";
import { usePractice } from "~/contexts/practice-context";
import { TimerEngine } from "~/lib/timer-engine";
import { setTimerMediaOwner } from "~/lib/timer-media";
export type {
  BellSound,
  TimerSettings,
  TimerPhase,
  TimerSnapshot,
} from "~/lib/timer-engine";
const TimerContext = createContext<TimerEngine | null>(null);

export function TimerProvider({ children }: { children: ReactNode }) {
  const [engine] = useState(() => new TimerEngine());
  const { pauseTalk } = useAudio();
  const { log } = usePractice();
  const callbacks = useRef({ pauseTalk, log });
  callbacks.current = { pauseTalk, log };
  useEffect(() => {
    engine.onStart = () => callbacks.current.pauseTalk();
    engine.onFinish = (result) =>
      callbacks.current.log({ ...result, kind: "timer" });
    engine.hydrate();
    const interval = setInterval(engine.tick, 250);
    let wakeLock: WakeLockSentinel | null = null;
    let requestingWake = false;
    let mounted = true;
    const running = () =>
      ["settling", "sitting"].includes(engine.getState().phase);
    const wake = async () => {
      if (
        !mounted ||
        !running() ||
        document.visibilityState !== "visible" ||
        !("wakeLock" in navigator) ||
        wakeLock ||
        requestingWake
      )
        return;
      requestingWake = true;
      try {
        const lock = await navigator.wakeLock.request("screen");
        if (!mounted || !running()) {
          await lock.release();
          return;
        }
        wakeLock = lock;
        lock.addEventListener("release", () => {
          if (wakeLock === lock) wakeLock = null;
        });
      } catch {
        /* Power saving, permissions, unsupported platform. */
      } finally {
        requestingWake = false;
      }
    };
    const actions: Partial<
      Record<MediaSessionAction, MediaSessionActionHandler>
    > = {
      play: engine.resume,
      pause: engine.pause,
      stop: engine.end,
      seekbackward: () => undefined,
      seekforward: () => undefined,
      seekto: () => undefined,
      previoustrack: () => undefined,
      nexttrack: () => undefined,
    };
    let mediaOwned = false;
    const clearMedia = () => {
      if (!mediaOwned || !("mediaSession" in navigator)) return;
      for (const action of Object.keys(actions)) {
        try {
          navigator.mediaSession.setActionHandler(
            action as MediaSessionAction,
            null,
          );
        } catch {
          /* Partial support. */
        }
      }
      navigator.mediaSession.metadata = null;
      navigator.mediaSession.playbackState = "none";
    };
    const media = () => {
      const phase = engine.getState().phase;
      const owned = ["settling", "sitting", "paused"].includes(phase);
      if (!owned) clearMedia();
      mediaOwned = owned;
      setTimerMediaOwner(owned);
      if (running()) void wake();
      else {
        void wakeLock?.release().catch(() => undefined);
        wakeLock = null;
      }
      if (!("mediaSession" in navigator)) return;
      if (!owned) return;
      if (typeof MediaMetadata !== "undefined")
        navigator.mediaSession.metadata = new MediaMetadata({
          title: `Sitting, ${Math.round(engine.getTotalMs() / 60000)} min`,
          artist: "Dharma Radio",
        });
      navigator.mediaSession.playbackState =
        phase === "paused" ? "paused" : "playing";
      try {
        navigator.mediaSession.setPositionState?.();
      } catch {
        /* Partial support. */
      }
      for (const [action, handler] of Object.entries(actions)) {
        try {
          navigator.mediaSession.setActionHandler(
            action as MediaSessionAction,
            handler,
          );
        } catch {
          /* Partial support. */
        }
      }
    };
    const visibility = () => {
      if (document.visibilityState === "visible") {
        engine.recoverAudio();
        void wake();
      } else engine.tick();
    };
    const unsubscribe = engine.subscribe(media);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      mounted = false;
      clearInterval(interval);
      unsubscribe();
      document.removeEventListener("visibilitychange", visibility);
      void wakeLock?.release().catch(() => undefined);
      engine.dispose();
      clearMedia();
      setTimerMediaOwner(false);
    };
  }, [engine]);
  return (
    <TimerContext.Provider value={engine}>{children}</TimerContext.Provider>
  );
}
function useEngine() {
  const engine = useContext(TimerContext);
  if (!engine)
    throw new Error("Timer hooks must be used within a TimerProvider");
  return engine;
}
export function useTimer() {
  const engine = useEngine();
  const state = useSyncExternalStore(
    engine.subscribe,
    engine.getState,
    engine.getState,
  );
  return {
    ...state,
    updateSettings: engine.updateSettings,
    start: engine.start,
    pause: engine.pause,
    resume: engine.resume,
    end: engine.end,
    dismiss: engine.dismiss,
    previewBell: engine.previewBell,
  };
}
export function useTimerClock() {
  const engine = useEngine();
  return useSyncExternalStore(
    engine.subscribeClock,
    engine.getClock,
    engine.getServerClock,
  );
}
