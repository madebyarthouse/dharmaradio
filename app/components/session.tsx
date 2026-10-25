import { useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router";
import { Eye, EyeOff } from "lucide-react";
import { useTimer, useTimerClock } from "~/contexts/timer-context";
import { usePractice } from "~/contexts/practice-context";
import { dayKey, minutesByDay, summarize } from "~/lib/practice";
import { BREATH_PATTERNS } from "~/lib/breath";
import { GUIDE_INTO_SIT_MS, useSessionMode, type SessionMode } from "~/lib/breath-store";
import { formatClock, minutesInWords } from "~/lib/format";
import { BreathCue, BreathSun } from "~/components/breath-guide";
import { buttonClass } from "~/components/ui/primitives";
import { cn } from "~/lib/cn";

const HIDE_TIME_KEY = "dharmaradio:hide-time";
const capitalize = (text: string) => text.replace(/^./, (c) => c.toUpperCase());

/** The sit itself: always night, one ring of light filling as the time passes. */
export function SessionScreen() {
  const timer = useTimer();
  if (timer.phase === "idle") return null;
  return <Session />;
}

function Session() {
  const timer = useTimer();
  const clock = useTimerClock();
  const mode = useSessionMode();
  const root = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const primary = useRef<HTMLButtonElement>(null);
  const [hideTime, setHideTime] = useState(false);
  const [resting, setResting] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [guideSkipped, setGuideSkipped] = useState(false);

  const complete = timer.phase === "complete";
  const paused = clock.phase === "paused";
  const settling = clock.phase === "settling" || (paused && clock.settleRemainingMs > 0);
  // The closing bells ring on after the time is up; the sit ends with the last one.
  const closing = clock.phase === "sitting" && clock.remainingMs === 0;
  const breathe = mode.kind === "breathe";

  useEffect(() => {
    setHideTime(localStorage.getItem(HIDE_TIME_KEY) === "1");
    primary.current?.focus({ preventScroll: true });
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    // Everything behind the night is out of reach until the sit is over.
    const behind = [...document.body.children].filter(
      (el): el is HTMLElement => el instanceof HTMLElement && !el.contains(root.current) && !el.inert,
    );
    behind.forEach((el) => (el.inert = true));
    return () => {
      document.body.style.overflow = overflow;
      behind.forEach((el) => (el.inert = false));
    };
  }, []);

  useEffect(() => {
    if (complete) primary.current?.focus({ preventScroll: true });
  }, [complete]);

  // The controls step back while you sit; any movement brings them back.
  useEffect(() => {
    if (complete || paused || confirmEnd) {
      setResting(false);
      return;
    }
    let id = window.setTimeout(() => setResting(true), 4000);
    const wake = () => {
      setResting(false);
      window.clearTimeout(id);
      id = window.setTimeout(() => setResting(true), 4000);
    };
    window.addEventListener("pointermove", wake);
    window.addEventListener("pointerdown", wake);
    window.addEventListener("keydown", wake);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener("pointermove", wake);
      window.removeEventListener("pointerdown", wake);
      window.removeEventListener("keydown", wake);
    };
  }, [complete, paused, confirmEnd]);

  useEffect(() => {
    if (!confirmEnd) return;
    const id = window.setTimeout(() => setConfirmEnd(false), 5000);
    return () => window.clearTimeout(id);
  }, [confirmEnd]);

  // Escape steps back: out of the end question first, otherwise into a pause.
  const pause = timer.pause;
  useEffect(() => {
    if (complete || closing) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      if (confirmEnd) setConfirmEnd(false);
      else if (!paused) pause();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [complete, closing, confirmEnd, paused, pause]);

  const toggleTime = () => {
    setHideTime((hidden) => {
      try {
        localStorage.setItem(HIDE_TIME_KEY, hidden ? "0" : "1");
      } catch {
        /* Storage optional. */
      }
      return !hidden;
    });
  };

  // How far into the breath we are: settling counts, and the sit carries on from it.
  const settleMs = mode.kind === "sit" ? mode.settleMs : 0;
  const breathElapsed = settling
    ? Math.max(0, settleMs - clock.settleRemainingMs)
    : settleMs + clock.elapsedMs;
  const pattern = mode.kind === "breathe" ? mode.pattern : mode.guide;
  const guiding =
    !!pattern &&
    !complete &&
    !closing &&
    (breathe || (!guideSkipped && breathElapsed < settleMs + GUIDE_INTO_SIT_MS));
  const progress = clock.totalMs > 0 ? Math.min(1, clock.elapsedMs / clock.totalMs) : 0;
  const showTime = breathe || !hideTime;
  const status = paused
    ? "Paused"
    : settling
      ? `The bell rings in ${formatClock(clock.settleRemainingMs / 1000 + 0.999)}`
      : closing
        ? "The closing bells"
        : guiding && showTime
          ? `${formatClock(clock.remainingMs / 1000)} left`
          : null;

  return (
    <div
      ref={root}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="night night-sky fixed inset-0 z-[60] flex animate-fade flex-col overflow-y-auto text-ink"
    >
      <div className="pt-safe relative flex h-16 shrink-0 items-center justify-between px-5 sm:px-8">
        <p className="text-[0.8125rem] text-ink-faint">
          {complete ? "" : <SessionLabel mode={mode} totalMs={clock.totalMs} />}
        </p>
        {!complete && !breathe ? (
          <button
            type="button"
            onClick={toggleTime}
            aria-pressed={hideTime}
            className={cn(
              "inline-flex h-10 items-center gap-2 rounded-full px-3 text-[0.8125rem] text-ink-faint transition-[color,opacity] duration-500 hover:text-ink focus-visible:opacity-100",
              resting && "opacity-0",
            )}
          >
            {hideTime ? <Eye size={18} /> : <EyeOff size={18} />}
            {hideTime ? "Show time" : "Hide time"}
          </button>
        ) : null}
      </div>

      <div className="relative flex flex-1 flex-col items-center justify-center px-5 pb-10 pt-4">
        {complete ? (
          <Complete titleId={titleId} primary={primary} mode={mode} onDone={timer.dismiss} />
        ) : (
          <>
            <h2 id={titleId} className="sr-only">
              {breathe ? "Breathing" : settling ? "Settling in" : paused ? "Paused" : "Sitting"}
            </h2>
            <Ring progress={settling || !showTime ? 0 : progress}>
              <div
                className={cn(
                  "absolute inset-[9%] flex flex-col items-center transition-opacity duration-1000",
                  guiding ? "opacity-100" : "pointer-events-none opacity-0",
                )}
              >
                {pattern ? (
                  <>
                    <BreathSun
                      pattern={pattern}
                      elapsedMs={breathElapsed}
                      running={!paused && guiding}
                      className="-mt-[6%] w-full"
                    />
                    <BreathCue pattern={pattern} elapsedMs={breathElapsed} className="-mt-[30%]" />
                  </>
                ) : null}
              </div>
              <div
                aria-hidden={guiding}
                className={cn(
                  "absolute inset-0 flex flex-col items-center justify-center transition-opacity duration-1000",
                  guiding ? "opacity-0" : "opacity-100",
                )}
              >
                {settling ? (
                  <>
                    <span className="font-serif text-[2.25rem] tracking-[-0.02em]">Settle in</span>
                    <span className="mt-2 text-sm tabular-nums text-ink-faint">
                      {formatClock(clock.settleRemainingMs / 1000 + 0.999)}
                    </span>
                  </>
                ) : closing ? (
                  <span className="font-serif text-[2.25rem] tracking-[-0.02em]">Rest here</span>
                ) : showTime ? (
                  <>
                    <span className="font-serif text-[4.5rem] leading-none tracking-tight tabular-nums sm:text-[5.25rem]">
                      {formatClock(clock.remainingMs / 1000)}
                    </span>
                    <span className="mt-3 text-sm tabular-nums text-ink-faint">
                      {paused
                        ? "Paused"
                        : clock.nextBellInMs != null && clock.nextBellInMs < clock.remainingMs
                          ? `Next bell in ${Math.ceil(clock.nextBellInMs / 60_000)} min`
                          : "left"}
                    </span>
                  </>
                ) : paused ? (
                  <span className="font-serif text-[2.25rem] tracking-[-0.02em]">Paused</span>
                ) : null}
              </div>
            </Ring>

            <p aria-live="polite" className="mt-6 h-5 text-sm tabular-nums text-ink-faint">
              {guiding || settling || closing ? status : null}
            </p>

            <div
              className={cn(
                "mt-8 flex min-h-[3.25rem] items-center gap-2 transition-opacity duration-500",
                resting && "opacity-0 focus-within:opacity-100",
              )}
            >
              {closing ? null : confirmEnd ? (
                <>
                  <span className="mr-2 text-[0.8125rem] text-ink-soft">
                    {breathe ? "End now?" : "End the sit now?"}
                  </span>
                  <button
                    type="button"
                    onClick={() => setConfirmEnd(false)}
                    className={cn(buttonClass("ghost"), "h-12 px-5 text-[0.8125rem]")}
                  >
                    Keep going
                  </button>
                  <button
                    type="button"
                    onClick={timer.end}
                    // eslint-disable-next-line jsx-a11y/no-autofocus
                    autoFocus
                    className={cn(buttonClass("secondary"), "h-12 px-5 text-[0.8125rem]")}
                  >
                    End
                  </button>
                </>
              ) : (
                <>
                  <button
                    ref={primary}
                    type="button"
                    onClick={paused ? timer.resume : timer.pause}
                    className={cn(buttonClass("secondary"), "h-12 min-w-32 text-[0.8125rem]")}
                  >
                    {paused ? "Resume" : "Pause"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmEnd(true)}
                    className={cn(buttonClass("ghost"), "h-12 min-w-24 text-[0.8125rem]")}
                  >
                    End
                  </button>
                </>
              )}
            </div>
            {/* Always takes its room, so nothing shifts when the guide hands over. */}
            <div className="mt-3 h-10">
              {guiding && !breathe && !settling ? (
                <button
                  type="button"
                  onClick={() => setGuideSkipped(true)}
                  className={cn(
                    "h-10 rounded-full px-3 text-sm text-ink-faint transition-[color,opacity] duration-500 hover:text-ink focus-visible:opacity-100",
                    resting && "opacity-0",
                  )}
                >
                  Sit without the guide
                </button>
              ) : null}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function SessionLabel({ mode, totalMs }: { mode: SessionMode; totalMs: number }) {
  const minutes = Math.round(totalMs / 60_000);
  if (mode.kind === "breathe")
    return (
      <>
        {BREATH_PATTERNS[mode.pattern].label} breathing, {minutesInWords(minutes)}
      </>
    );
  return <>{capitalize(minutesInWords(minutes))}</>;
}

function Complete({
  titleId,
  primary,
  mode,
  onDone,
}: {
  titleId: string;
  primary: React.RefObject<HTMLButtonElement | null>;
  mode: SessionMode;
  onDone: () => void;
}) {
  const timer = useTimer();
  const practice = usePractice();
  const result = timer.result;
  const seconds = result?.durationSec ?? 0;
  const minutes = Math.floor(seconds / 60);
  const counted = seconds >= 60;
  const week = summarize(practice.sessions);
  const today = Math.round(minutesByDay(practice.sessions).get(dayKey(Date.now())) ?? 0);
  const words = capitalize(minutesInWords(minutes));

  const title = !counted
    ? mode.kind === "breathe"
      ? "A few breaths."
      : "A short sit."
    : mode.kind === "breathe"
      ? `${words} of breathing.`
      : `${words}, sat.`;

  return (
    <div className="flex w-full max-w-md animate-rise flex-col items-center text-center">
      <Ring progress={counted ? 1 : seconds / 60} small>
        <span className="font-serif text-[3.75rem] leading-none tracking-tight tabular-nums">
          {counted ? minutes : seconds}
        </span>
        <span className="mt-2 text-sm text-ink-faint">
          {counted ? (minutes === 1 ? "minute" : "minutes") : seconds === 1 ? "second" : "seconds"}
        </span>
      </Ring>
      <h2 id={titleId} className="mt-8 text-balance font-serif text-[2.25rem] leading-tight tracking-tight">
        {title}
      </h2>
      {counted ? (
        <dl className="mt-8 grid w-full grid-cols-3 border-y border-line">
          {[
            { label: "Today", value: today, unit: "min" },
            { label: "Last 7 days", value: Math.round(week.last7Minutes), unit: "min" },
            { label: "This week", value: week.daysThisWeek, unit: week.daysThisWeek === 1 ? "day" : "days" },
          ].map((figure, i) => (
            <div key={figure.label} className={cn("flex flex-col-reverse py-4", i > 0 && "border-l border-line")}>
              <dt className="mt-1 text-[0.8125rem] text-ink-faint">{figure.label}</dt>
              <dd className="font-serif text-[1.75rem] leading-none tabular-nums">
                {figure.value.toLocaleString("en-US")}
                <span className="ml-1 font-mono text-xs text-ink-faint">{figure.unit}</span>
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="mt-3 text-ink-soft">Under a minute is not added to your practice.</p>
      )}
      <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
        <button ref={primary} type="button" onClick={onDone} className={cn(buttonClass("primary"), "h-12 min-w-32 px-6")}>
          Done
        </button>
        <Link to="/practice" onClick={onDone} className={cn(buttonClass("ghost"), "h-12 px-5")}>
          See your practice
        </Link>
      </div>
    </div>
  );
}

const RING = 320;
const RING_R = 152;
const CIRC = 2 * Math.PI * RING_R;

/** A thin ring of light that fills clockwise from twelve as the sit passes. */
function Ring({
  progress,
  small,
  children,
}: {
  progress: number;
  small?: boolean;
  children: React.ReactNode;
}) {
  const glowId = useId();
  return (
    <div
      className={cn(
        "relative aspect-square",
        small ? "w-[min(56vw,13rem,32dvh)]" : "w-[min(80vw,22rem,52dvh)]",
      )}
    >
      <svg viewBox={`0 0 ${RING} ${RING}`} aria-hidden className="absolute inset-0 size-full -rotate-90">
        <defs>
          <filter id={glowId} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="5" />
          </filter>
        </defs>
        <circle cx={RING / 2} cy={RING / 2} r={RING_R} fill="none" stroke="var(--line-strong)" strokeWidth={1} />
        {progress > 0 ? (
          <>
            <circle
              cx={RING / 2}
              cy={RING / 2}
              r={RING_R}
              fill="none"
              stroke="var(--accent)"
              strokeWidth={6}
              strokeLinecap="round"
              strokeDasharray={`${CIRC * progress} ${CIRC}`}
              opacity={0.45}
              filter={`url(#${glowId})`}
            />
            <circle
              cx={RING / 2}
              cy={RING / 2}
              r={RING_R}
              fill="none"
              stroke="var(--accent)"
              strokeWidth={2}
              strokeLinecap="round"
              strokeDasharray={`${CIRC * progress} ${CIRC}`}
            />
          </>
        ) : null}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  );
}
