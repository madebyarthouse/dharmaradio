import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  useSyncExternalStore,
} from "react";
import { usePostHog } from "posthog-js/react";
import { trackPlausibleEvent } from "~/utils/plausible";
import { usePractice } from "~/contexts/practice-context";
import { isGuidedTitle } from "~/lib/guided";
import { timerOwnsMedia, subscribeTimerMedia } from "~/lib/timer-media";
import { useLibrary } from "~/contexts/library-context";

export type PlayerTalk = {
  id: number;
  title: string;
  slug?: string;
  teacher: string | null;
  duration: number;
  audioUrl: string;
  artworkUrl?: string | null;
  teacherSlug?: string | null;
  centerName?: string | null;
  centerSlug?: string | null;
  retreatTitle?: string | null;
  retreatSlug?: string | null;
};
type LegacyTalk = Omit<PlayerTalk, "id"> & { id: number | string };
export type SleepTimer = { endsAt: number } | { endOfTalk: true } | null;
export type AudioContextType = {
  currentTalk: PlayerTalk | null;
  isPlaying: boolean;
  isBuffering: boolean;
  progress: number;
  currentTime: number;
  duration: number;
  volume: number;
  canControlVolume: boolean;
  playbackRate: number;
  setPlaybackRate(rate: number): void;
  playTalk(talk: LegacyTalk): void;
  playNow(talk: PlayerTalk, context?: PlayerTalk[]): void;
  pauseTalk(): void;
  togglePlay(): void;
  seek(time: number): void;
  seekBy(deltaSec: number): void;
  setVolume(volume: number): void;
  playNext(): void;
  playPrevious(): void;
  queue: PlayerTalk[];
  addToQueue(talk: PlayerTalk): void;
  playNextInQueue(talk: PlayerTalk): void;
  removeFromQueue(id: number): void;
  clearQueue(): void;
  sleepTimer: SleepTimer;
  setSleepTimer(value: { minutes: number } | { endOfTalk: true } | null): void;
  /**
   * The playing element, for observing only (the visualizer mirrors its time).
   * Never route it into Web Audio: that is irreversible and can stop background playback on iOS.
   */
  getMediaElement(): HTMLAudioElement | null;
  /** @deprecated Use playNow(talk, context) and queue. */
  playlist: PlayerTalk[];
  /** @deprecated Sets playback context, preserving an already active queue. */
  setPlaylist(talks: LegacyTalk[]): void;
};
const AudioContext = createContext<AudioContextType | null>(null);
const STORAGE_KEY = "dharmaradio:player:v1";
const finite = (value: number, fallback = 0) =>
  Number.isFinite(value) ? value : fallback;
const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, finite(v, min)));
function normalize(talk: LegacyTalk): PlayerTalk | null {
  const id = Number(talk?.id);
  return Number.isSafeInteger(id) &&
    id > 0 &&
    typeof talk.title === "string" &&
    typeof talk.audioUrl === "string"
    ? { ...talk, id, duration: Math.max(0, finite(talk.duration)) }
    : null;
}
const normalizeList = (talks: LegacyTalk[]) =>
  talks.map(normalize).filter((t): t is PlayerTalk => t !== null);
function isIosDevice() {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

export function AudioProvider({ children }: { children: React.ReactNode }) {
  const posthog = usePostHog();
  const library = useLibrary();
  const practice = usePractice();
  const practiceRef = useRef(practice);
  practiceRef.current = practice;
  const timerMedia = useSyncExternalStore(subscribeTimerMedia, timerOwnsMedia, () => false);
  const guidedPlayback = useRef({ startedAt: 0, logged: false });
  const libraryRef = useRef(library);
  libraryRef.current = library;
  const audioRef = useRef<HTMLAudioElement>(null);
  const [currentTalk, setCurrentTalk] = useState<PlayerTalk | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(0.8);
  const [canControlVolume, setCanControlVolume] = useState(true);
  const [playbackRate, setRate] = useState(1);
  const [queue, setQueue] = useState<PlayerTalk[]>([]);
  const [context, setContext] = useState<PlayerTalk[]>([]);
  const [sleepTimer, setTimer] = useState<SleepTimer>(null);
  const state = useRef({
    talk: null as PlayerTalk | null,
    queue: [] as PlayerTalk[],
    context: [] as PlayerTalk[],
    history: [] as PlayerTalk[],
    volume: 0.8,
    rate: 1,
    timer: null as SleepTimer,
  });
  const ready = useRef(false);
  const pendingSeek = useRef<number | null>(null);
  const positionRef = useRef(0);
  const playRequest = useRef(0);
  const lastSaved = useRef(0);

  const updateQueue = useCallback((next: PlayerTalk[]) => {
    state.current.queue = next;
    setQueue(next);
  }, []);
  const updateContext = useCallback((next: PlayerTalk[]) => {
    state.current.context = next;
    setContext(next);
  }, []);
  const persist = useCallback(() => {
    if (!ready.current) return;
    const s = state.current;
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          talk: s.talk,
          queue: s.queue,
          context: s.context,
          position:
            pendingSeek.current ??
            audioRef.current?.currentTime ??
            positionRef.current,
          rate: s.rate,
          volume: s.volume,
        }),
      );
    } catch {
      /* Storage may be disabled or full. */
    }
  }, []);
  const report = useCallback((completed = false) => {
    const audio = audioRef.current,
      talk = state.current.talk;
    if (!audio || !talk) return;
    libraryRef.current?.reportProgress(talk.id, {
      positionSec: pendingSeek.current ?? finite(audio.currentTime),
      durationSec:
        Number.isFinite(audio.duration) && audio.duration > 0
          ? audio.duration
          : talk.duration || null,
      completed: completed || audio.ended,
    });
    if ((completed || audio.ended) && !guidedPlayback.current.logged && isGuidedTitle(talk.title)) {
      const durationSec = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : talk.duration;
      if (durationSec >= 60) {
        guidedPlayback.current.logged = true;
        practiceRef.current.log({ kind: "guided", talkId: talk.id, talkTitle: talk.title,
          durationSec: Math.floor(durationSec), startedAt: guidedPlayback.current.startedAt || Date.now() - durationSec * 1000 });
      }
    }
    // Pauses, seeks while paused and completions should reach the server now, not on the next throttle tick.
    if (completed || audio.paused)
      window.dispatchEvent(new Event("dharmaradio:flush-progress"));
  }, []);
  const cancelFade = useCallback(() => {
    if (audioRef.current && !isIosDevice())
      audioRef.current.volume = state.current.volume;
  }, []);
  const track = useCallback(
    (event: string, extra: Record<string, unknown> = {}) => {
      const t = state.current.talk;
      if (t)
        posthog?.capture(event, {
          talk_id: t.id,
          talk_title: t.title,
          teacher_name: t.teacher,
          teacher_slug: t.teacherSlug,
          center_name: t.centerName,
          center_slug: t.centerSlug,
          retreat_title: t.retreatTitle,
          retreat_slug: t.retreatSlug,
          duration: t.duration,
          ...extra,
        });
    },
    [posthog],
  );
  const startPlayback = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !state.current.talk) return;
    cancelFade();
    if (audio.ended || !guidedPlayback.current.startedAt)
      guidedPlayback.current = { startedAt: Date.now(), logged: false };
    const request = ++playRequest.current;
    setIsBuffering(true);
    // Invoke synchronously in the user gesture, including on iOS.
    void audio
      .play()
      .then(() => {
        if (request !== playRequest.current) return;
        setIsPlaying(!audio.paused);
        setIsBuffering(false);
        const t = state.current.talk;
        if (t) {
          trackPlausibleEvent({
            event: "play",
            url: window.location.href,
            props: { talk_id: t.title },
          });
          track("talk_played", { audio_url: t.audioUrl });
        }
      })
      .catch((error: unknown) => {
        if (request !== playRequest.current) return;
        setIsPlaying(false);
        setIsBuffering(false);
        console.warn("Playback could not start", error);
      });
  }, [cancelFade, track]);
  const loadTalk = useCallback(
    (talk: PlayerTalk, autoplay: boolean, position?: number) => {
      const audio = audioRef.current;
      if (!audio) return;
      if (
        state.current.talk?.id !== talk.id ||
        position !== undefined ||
        audio.ended
      ) {
        report();
        cancelFade();
        ++playRequest.current;
        audio.pause();
        guidedPlayback.current = { startedAt: 0, logged: false };
        state.current.talk = talk;
        setCurrentTalk(talk);
        const saved = libraryRef.current?.progress.get(talk.id);
        const resume =
          position ?? (saved && !saved.completed ? saved.positionSec : 0);
        pendingSeek.current = clamp(
          resume,
          0,
          talk.duration > 0 ? talk.duration : Number.MAX_SAFE_INTEGER,
        );
        positionRef.current = pendingSeek.current;
        setCurrentTime(pendingSeek.current);
        setDuration(talk.duration);
        audio.src = talk.audioUrl;
        audio.playbackRate = state.current.rate;
        audio.load();
      }
      persist();
      if (autoplay) startPlayback();
    },
    [report, cancelFade, persist, startPlayback],
  );
  const playNow = useCallback(
    (input: PlayerTalk, list?: PlayerTalk[]) => {
      const talk = normalize(input);
      if (!talk) return;
      const s = state.current;
      if (s.talk && s.talk.id !== talk.id) s.history.push(s.talk);
      if (list) {
        const normalized = normalizeList(list);
        updateContext(normalized);
        const index = normalized.findIndex((t) => t.id === talk.id);
        updateQueue(index < 0 ? [] : normalized.slice(index + 1));
      } else if (s.talk?.id !== talk.id) {
        // Playing a queue item must preserve edits to the rest of the queue.
        updateQueue(s.queue.filter((t) => t.id !== talk.id));
      }
      loadTalk(talk, true);
    },
    [loadTalk, updateContext, updateQueue],
  );
  const playTalk = useCallback(
    (input: LegacyTalk) => {
      const t = normalize(input);
      if (t) {
        const s = state.current;
        const legacyContext =
          s.talk?.id !== t.id && s.context.some((item) => item.id === t.id)
            ? s.context
            : undefined;
        playNow(t, legacyContext);
      }
    },
    [playNow],
  );
  const pauseTalk = useCallback(() => {
    ++playRequest.current;
    audioRef.current?.pause();
    setIsPlaying(false);
    setIsBuffering(false);
    cancelFade();
    report();
    persist();
    track("talk_paused", {
      current_time: audioRef.current?.currentTime,
      progress_percent:
        audioRef.current &&
        Number.isFinite(audioRef.current.duration) &&
        audioRef.current.duration > 0
          ? (audioRef.current.currentTime / audioRef.current.duration) * 100
          : 0,
    });
  }, [cancelFade, report, persist, track]);
  const seek = useCallback(
    (time: number) => {
      const audio = audioRef.current;
      if (!audio || !state.current.talk) return;
      const previous = audio.currentTime;
      const max = Number.isFinite(audio.duration)
        ? audio.duration
        : state.current.talk.duration || Number.MAX_SAFE_INTEGER;
      const next = clamp(time, 0, max);
      if (audio.readyState >= 1) {
        audio.currentTime = next;
        pendingSeek.current = null;
      } else pendingSeek.current = next;
      positionRef.current = next;
      setCurrentTime(next);
      report();
      persist();
      if (Math.abs(next - previous) > 5)
        track("talk_seeked", {
          from_time: previous,
          to_time: next,
          seek_direction: next > previous ? "forward" : "backward",
          seek_amount: Math.abs(next - previous),
        });
    },
    [report, persist, track],
  );
  const seekBy = useCallback(
    (delta: number) =>
      seek(
        (pendingSeek.current ?? audioRef.current?.currentTime ?? 0) +
          finite(delta),
      ),
    [seek],
  );
  const playNext = useCallback(() => {
    const next = state.current.queue[0];
    if (!next) return;
    if (state.current.talk) state.current.history.push(state.current.talk);
    updateQueue(state.current.queue.slice(1));
    loadTalk(next, true);
  }, [loadTalk, updateQueue]);
  const playPrevious = useCallback(() => {
    const s = state.current;
    const index = s.context.findIndex((t) => t.id === s.talk?.id);
    const previous =
      s.history.pop() ?? (index > 0 ? s.context[index - 1] : undefined);
    if (!previous) {
      seek(0);
      return;
    }
    updateQueue(
      [...(s.talk ? [s.talk] : []), ...s.queue].filter(
        (t) => t.id !== previous.id,
      ),
    );
    loadTalk(previous, true);
  }, [loadTalk, seek, updateQueue]);
  const setVolume = useCallback(
    (value: number) => {
      if (isIosDevice()) return;
      cancelFade();
      const next = clamp(value, 0, 1);
      state.current.volume = next;
      if (audioRef.current) audioRef.current.volume = next;
      setVolumeState(next);
      persist();
    },
    [cancelFade, persist],
  );
  const setPlaybackRate = useCallback(
    (value: number) => {
      const rate = clamp(value, 0.5, 3);
      state.current.rate = rate;
      setRate(rate);
      if (audioRef.current) audioRef.current.playbackRate = rate;
      persist();
    },
    [persist],
  );
  const setSleepTimer = useCallback(
    (value: { minutes: number } | { endOfTalk: true } | null) => {
      cancelFade();
      const next =
        value && "minutes" in value
          ? { endsAt: Date.now() + clamp(value.minutes, 0, 1440) * 60000 }
          : value;
      state.current.timer = next;
      setTimer(next);
    },
    [cancelFade],
  );
  const addToQueue = useCallback(
    (input: PlayerTalk) => {
      const t = normalize(input);
      if (t) {
        updateQueue([...state.current.queue, t]);
        persist();
      }
    },
    [updateQueue, persist],
  );
  const playNextInQueue = useCallback(
    (input: PlayerTalk) => {
      const t = normalize(input);
      if (t) {
        updateQueue([t, ...state.current.queue.filter((x) => x.id !== t.id)]);
        persist();
      }
    },
    [updateQueue, persist],
  );
  const removeFromQueue = useCallback(
    (id: number) => {
      updateQueue(state.current.queue.filter((t) => t.id !== id));
      persist();
    },
    [updateQueue, persist],
  );
  const clearQueue = useCallback(() => {
    updateQueue([]);
    persist();
  }, [updateQueue, persist]);
  const setPlaylist = useCallback(
    (list: LegacyTalk[]) => {
      const next = normalizeList(list);
      updateContext(next);
      // Legacy route effects must not replace a queue simply by browsing another page.
      if (!state.current.talk) updateQueue(next);
      persist();
    },
    [updateContext, updateQueue, persist],
  );

  useEffect(() => {
    setCanControlVolume(!isIosDevice());
    const audio = audioRef.current;
    if (!audio) return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        state.current.volume = clamp(saved.volume ?? 0.8, 0, 1);
        setVolumeState(state.current.volume);
        state.current.rate = clamp(saved.rate ?? 1, 0.5, 3);
        setRate(state.current.rate);
        updateQueue(
          Array.isArray(saved.queue) ? normalizeList(saved.queue) : [],
        );
        updateContext(
          Array.isArray(saved.context) ? normalizeList(saved.context) : [],
        );
        const talk = saved.talk && normalize(saved.talk);
        if (talk) loadTalk(talk, false, Math.max(0, finite(saved.position)));
      }
    } catch {
      /* Corrupt or inaccessible storage must not prevent playback. */
    }
    if (!isIosDevice()) audio.volume = state.current.volume;
    audio.playbackRate = state.current.rate;
    ready.current = true;
    return () => {
      positionRef.current = pendingSeek.current ?? finite(audio.currentTime);
      persist();
      // This ref is a mutable promise generation counter, not a DOM node.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      ++playRequest.current;
      audio.pause();
      ready.current = false;
    };
    // Restore once per mount. All mutable engine data lives in state.current.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const timeupdate = () => {
      positionRef.current = pendingSeek.current ?? finite(audio.currentTime);
      setCurrentTime(positionRef.current);
      if (Date.now() - lastSaved.current >= 5000) {
        lastSaved.current = Date.now();
        report();
        persist();
      }
    };
    const metadata = () => {
      const d = Number.isFinite(audio.duration)
        ? audio.duration
        : (state.current.talk?.duration ?? 0);
      setDuration(d);
      if (pendingSeek.current !== null && audio.readyState >= 1) {
        audio.currentTime = clamp(
          pendingSeek.current,
          0,
          d || Number.MAX_SAFE_INTEGER,
        );
        pendingSeek.current = null;
      }
      timeupdate();
    };
    const ended = () => {
      report(true);
      persist();
      track("talk_completed");
      setIsPlaying(false);
      setIsBuffering(false);
      if (state.current.timer) {
        // A timed fade that overlaps the end of a talk must never auto-advance.
        const timer = state.current.timer;
        if (
          "endOfTalk" in timer ||
          ("endsAt" in timer && timer.endsAt <= Date.now() + 2000)
        ) {
          setSleepTimer(null);
          return;
        }
      }
      playNext();
    };
    const playing = () => {
      setIsPlaying(true);
      setIsBuffering(false);
    };
    const pause = () => {
      setIsPlaying(false);
      setIsBuffering(false);
      report();
      persist();
    };
    const waiting = () => {
      if (!audio.paused) setIsBuffering(true);
    };
    const canplay = () => setIsBuffering(false);
    const error = () => {
      ++playRequest.current;
      setIsPlaying(false);
      setIsBuffering(false);
      report();
      persist();
    };
    const save = () => {
      report();
      persist();
    };
    const visibility = () => {
      if (document.visibilityState === "hidden") save();
    };
    const events = {
      timeupdate,
      loadedmetadata: metadata,
      durationchange: metadata,
      ended,
      playing,
      pause,
      waiting,
      stalled: waiting,
      canplay,
      error,
    };
    for (const [name, handler] of Object.entries(events))
      audio.addEventListener(name, handler);
    window.addEventListener("pagehide", save);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      for (const [name, handler] of Object.entries(events))
        audio.removeEventListener(name, handler);
      window.removeEventListener("pagehide", save);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [report, persist, playNext, setSleepTimer, track]);

  useEffect(() => {
    const tick = () => {
      const audio = audioRef.current,
        timer = state.current.timer;
      if (!audio || !timer) return;
      const remaining =
        "endsAt" in timer
          ? (timer.endsAt - Date.now()) / 1000
          : (audio.duration - audio.currentTime) / audio.playbackRate;
      if ("endsAt" in timer && remaining <= 0) {
        pauseTalk();
        setSleepTimer(null);
        return;
      }
      if (audio.paused) return;
      // End-of-talk timers are cleared by `ended`, which also blocks advance.
      if (Number.isFinite(remaining) && remaining <= 2) {
        if (!isIosDevice())
          audio.volume = state.current.volume * clamp(remaining / 2, 0, 1);
      } else if (!isIosDevice()) audio.volume = state.current.volume;
    };
    const interval = setInterval(tick, 100);
    return () => {
      clearInterval(interval);
      cancelFade();
    };
  }, [pauseTalk, setSleepTimer, cancelFade]);

  useEffect(() => {
    if (timerMedia || !("mediaSession" in navigator)) return;
    const session = navigator.mediaSession;
    if (currentTalk && typeof MediaMetadata !== "undefined")
      session.metadata = new MediaMetadata({
        title: currentTalk.title,
        artist: currentTalk.teacher ?? "Dharma Radio",
        album: currentTalk.retreatTitle ?? "Dharma Radio",
        artwork: currentTalk.artworkUrl
          ? [{ src: currentTalk.artworkUrl }]
          : [
              {
                src: "/icons/icon-512.png",
                sizes: "512x512",
                type: "image/png",
              },
            ],
      });
    session.playbackState = isPlaying
      ? "playing"
      : currentTalk
        ? "paused"
        : "none";
    const handlers: Partial<
      Record<MediaSessionAction, MediaSessionActionHandler>
    > = {
      play: startPlayback,
      pause: pauseTalk,
      seekbackward: (d) => seekBy(-(d.seekOffset ?? 15)),
      seekforward: (d) => seekBy(d.seekOffset ?? 30),
      previoustrack: playPrevious,
      nexttrack: playNext,
      seekto: (d) => {
        if (d.seekTime !== undefined) seek(d.seekTime);
      },
    };
    for (const [action, handler] of Object.entries(handlers)) {
      try {
        session.setActionHandler(action as MediaSessionAction, handler);
      } catch {
        /* Partial implementation. */
      }
    }
    return () => {
      if (timerOwnsMedia()) return;
      for (const action of Object.keys(handlers)) {
        try {
          session.setActionHandler(action as MediaSessionAction, null);
        } catch {
          /* Unsupported action. */
        }
      }
    };
  }, [
    timerMedia,
    currentTalk,
    isPlaying,
    startPlayback,
    pauseTalk,
    seekBy,
    seek,
    playPrevious,
    playNext,
  ]);
  useEffect(() => {
    if (
      timerMedia || !("mediaSession" in navigator) ||
      !navigator.mediaSession.setPositionState
    )
      return;
    try {
      if (duration > 0)
        navigator.mediaSession.setPositionState({
          duration,
          playbackRate,
          position: clamp(currentTime, 0, duration),
        });
    } catch {
      /* Safari may reject position before metadata is ready. */
    }
  }, [currentTime, duration, playbackRate, timerMedia]);

  const getMediaElement = useCallback(() => audioRef.current, []);
  const togglePlay = useCallback(() => {
    if (audioRef.current?.paused) startPlayback();
    else pauseTalk();
  }, [startPlayback, pauseTalk]);
  // Deprecated list reflects the current context for the original Player's buttons.
  const playlist = currentTalk
    ? [...state.current.history, currentTalk, ...queue]
    : context;
  return (
    <AudioContext.Provider
      value={{
        currentTalk,
        isPlaying,
        isBuffering,
        currentTime,
        duration,
        progress:
          duration > 0 ? clamp((currentTime / duration) * 100, 0, 100) : 0,
        volume,
        canControlVolume,
        playbackRate,
        setPlaybackRate,
        playTalk,
        playNow,
        pauseTalk,
        togglePlay,
        seek,
        seekBy,
        setVolume,
        playNext,
        playPrevious,
        queue,
        addToQueue,
        playNextInQueue,
        removeFromQueue,
        clearQueue,
        playlist,
        setPlaylist,
        sleepTimer,
        setSleepTimer,
        getMediaElement,
      }}
    >
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio ref={audioRef} preload="metadata" />
      {children}
    </AudioContext.Provider>
  );
}

export function useAudio() {
  const context = useContext(AudioContext);
  if (!context)
    throw new Error("useAudio must be used within an AudioProvider");
  return context;
}
