import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown, Volume2 } from "lucide-react";
import {
  useTimer,
  type BellSound,
  type TimerSettings,
} from "~/contexts/timer-context";
import {
  BREATH_PATTERNS,
  BREATH_PATTERN_KEYS,
  type BreathPatternKey,
} from "~/lib/breath";
import {
  BREATHE_LENGTHS,
  setSessionMode,
  updateBreathPrefs,
  useBreathPrefs,
} from "~/lib/breath-store";
import { minutesInWords } from "~/lib/format";
import { Segmented, Switch, buttonClass } from "~/components/ui/primitives";
import { cn } from "~/lib/cn";

export const MIN_MINUTES = 1;
export const MAX_MINUTES = 90;
const PRESETS = [5, 10, 20, 30, 45, 60];

/** Starting a sit or a breathing practice; both must run inside the tap that asked. */
export function useSessionStarters() {
  const timer = useTimer();
  const prefs = useBreathPrefs();
  return {
    sit() {
      setSessionMode({
        kind: "sit",
        guide: prefs.guide === "off" ? null : prefs.guide,
        settleMs: timer.settings.settleSeconds * 1000,
      });
      timer.start();
    },
    breathe(minutes: number, pattern: BreathPatternKey) {
      setSessionMode({ kind: "breathe", pattern });
      timer.start({
        minutes,
        settleSeconds: 0,
        intervalMinutes: 0,
        startStrikes: 1,
        endStrikes: 1,
      });
    },
  };
}

export type SitMode = "sit" | "breathe";

const BELLS: { value: BellSound; label: string; hint: string }[] = [
  { value: "bowl", label: "Singing bowl", hint: "Warm, long" },
  { value: "bell", label: "Temple bell", hint: "Low, wide" },
  { value: "wood", label: "Wood block", hint: "Short, dry" },
];

/**
 * The sitting instrument. The length of the sit is the hero; one Begin below it.
 * Beside it, the few choices a sit has: the bell, and what happens during the sit.
 * Rarely changed settings wait behind "More".
 */
export function SitInstrument({
  mode,
  onModeChange,
  className,
}: {
  mode: SitMode;
  onModeChange: (mode: SitMode) => void;
  className?: string;
}) {
  const timer = useTimer();
  const { settings } = timer;
  const prefs = useBreathPrefs();
  const start = useSessionStarters();

  return (
    <section
      aria-label="Meditation timer"
      className={cn(
        "grid overflow-hidden rounded-2xl bg-paper-raised shadow-soft ring-1 ring-inset ring-line lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]",
        className,
      )}
    >
      <div className="flex flex-col items-center justify-center gap-5 p-5 sm:p-8 lg:border-r lg:border-line">
        <Segmented
          label="Practice"
          value={mode}
          onChange={onModeChange}
          options={[
            { value: "sit", label: "Silent sit" },
            { value: "breathe", label: "Just breathe" },
          ]}
        />

        {mode === "sit" ? (
          <>
            <Dial value={settings.minutes} onChange={(minutes) => timer.updateSettings({ minutes })} className="mx-auto" />
            <div role="group" aria-label="Quick lengths" className="flex flex-wrap justify-center gap-1 sm:gap-1.5">
              {PRESETS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => timer.updateSettings({ minutes: m })}
                  aria-pressed={settings.minutes === m}
                  aria-label={minutesInWords(m)}
                  className={cn(
                    "press h-9 min-w-11 rounded-full px-2.5 text-[0.8125rem] tabular-nums ring-1 ring-inset sm:min-w-12",
                    settings.minutes === m
                      ? "bg-ink text-paper ring-ink"
                      : "text-ink-soft ring-line hover:bg-paper-sunken hover:text-ink",
                  )}
                >
                  {m}
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <BreathSun />
            <Segmented
              label="Length"
              value={String(prefs.minutes)}
              onChange={(v) => updateBreathPrefs({ minutes: Number(v) as 1 | 3 | 5 })}
              options={BREATHE_LENGTHS.map((m) => ({ value: String(m), label: `${m} min` }))}
            />
          </>
        )}

        <div className="mt-1 flex w-full max-w-sm flex-col items-center gap-2">
          <button
            type="button"
            onClick={() => (mode === "sit" ? start.sit() : start.breathe(prefs.minutes, prefs.pattern))}
            className={cn(buttonClass("primary"), "h-14 w-full text-[0.9375rem]")}
          >
            Begin
          </button>
          <EndsAt
            minutes={mode === "sit" ? settings.minutes : prefs.minutes}
            settleSeconds={mode === "sit" ? settings.settleSeconds : 0}
          />
        </div>
      </div>

      <div className="border-t border-line p-5 sm:p-8 lg:border-t-0">
        {mode === "sit" ? <SitSettings /> : <BreathePatterns />}
      </div>
    </section>
  );
}

/** A small sun rising and setting over a horizon: the breathing practice's picture. */
function BreathSun() {
  return (
    <div aria-hidden className="relative my-3 size-52 overflow-hidden sm:size-60">
      <div className="sun-halo absolute inset-0 opacity-60" />
      <div className="absolute inset-x-0 top-0 h-[62%] overflow-hidden">
        <div className="sun absolute left-[28%] top-[42%] aspect-square w-[44%] animate-dawn rounded-full" />
      </div>
      <div className="absolute inset-x-6 top-[62%] h-px bg-line-strong" />
    </div>
  );
}

function SettingsGroup({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="[&+&]:mt-7">
      <div className="mb-1 flex items-center justify-between gap-3">
        <h3 id={id} className="font-serif text-[1.25rem] leading-tight">
          {title}
        </h3>
        {action}
      </div>
      {children}
    </section>
  );
}

/** A choice that is either off or set to a value: a switch, and the value once on. */
function ToggleRow({
  title,
  hint,
  on,
  onToggle,
  children,
}: {
  title: string;
  hint: string;
  on: boolean;
  onToggle: (on: boolean) => void;
  children: React.ReactNode;
}) {
  const id = useId();
  return (
    <div className="border-b border-line py-4 last:border-b-0">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p id={id} className="text-[0.875rem] text-ink">
            {title}
          </p>
          <p className="mt-0.5 text-xs leading-5 text-ink-faint">{hint}</p>
        </div>
        <Switch checked={on} onChange={onToggle} labelledBy={id} />
      </div>
      {on ? <div className="mt-3 animate-fade">{children}</div> : null}
    </div>
  );
}

function SitSettings() {
  const timer = useTimer();
  const { settings, updateSettings } = timer;
  const prefs = useBreathPrefs();
  const [more, setMore] = useState(false);
  const moreId = useId();
  // Turning a choice back on returns to what it was before.
  const last = useRef({ interval: 10, settle: 30 as TimerSettings["settleSeconds"], guide: "calm" as BreathPatternKey });
  if (settings.intervalMinutes) last.current.interval = settings.intervalMinutes;
  if (settings.settleSeconds) last.current.settle = settings.settleSeconds;
  if (prefs.guide !== "off") last.current.guide = prefs.guide;

  return (
    <>
      <SettingsGroup
        title="Bell"
        action={
          <button
            type="button"
            onClick={() => timer.previewBell()}
            className="press inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[0.8125rem] text-ink-soft hover:bg-paper-sunken hover:text-ink"
          >
            <Volume2 size={15} aria-hidden /> Hear it
          </button>
        }
      >
        <BellPicker
          value={settings.bell}
          onChange={(bell) => {
            updateSettings({ bell });
            timer.previewBell(bell);
          }}
        />
        <div className="mt-3 flex items-center gap-3">
          <span className="w-16 text-xs text-ink-faint">Volume</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={settings.volume}
            aria-label="Bell volume"
            aria-valuetext={`${Math.round(settings.volume * 100)} percent`}
            onChange={(e) => updateSettings({ volume: Number(e.currentTarget.value) })}
            onPointerUp={() => timer.previewBell()}
            onKeyUp={(e) => e.key.startsWith("Arrow") && timer.previewBell()}
            className="h-1 flex-1 cursor-pointer accent-[var(--accent)]"
          />
          <span className="w-10 text-right text-xs tabular-nums text-ink-faint">{Math.round(settings.volume * 100)}%</span>
        </div>
      </SettingsGroup>

      <SettingsGroup title="During the sit">
        <ToggleRow
          title="Interval bell"
          hint={settings.intervalMinutes ? `A soft strike every ${minutesInWords(settings.intervalMinutes)}` : "Quiet between the opening and closing bells"}
          on={settings.intervalMinutes > 0}
          onToggle={(on) => updateSettings({ intervalMinutes: on ? last.current.interval : 0 })}
        >
          <Segmented
            label="Interval"
            value={String(settings.intervalMinutes)}
            onChange={(v) => updateSettings({ intervalMinutes: Number(v) })}
            options={[5, 10, 15, 20].map((m) => ({ value: String(m), label: `${m} min` }))}
          />
        </ToggleRow>
        <ToggleRow
          title="Settle in"
          hint="A quiet lead-in before the first bell"
          on={settings.settleSeconds > 0}
          onToggle={(on) => updateSettings({ settleSeconds: on ? last.current.settle : 0 })}
        >
          <Segmented
            label="Settle in"
            value={String(settings.settleSeconds)}
            onChange={(v) => updateSettings({ settleSeconds: Number(v) as TimerSettings["settleSeconds"] })}
            options={[
              { value: "10", label: "10 s" },
              { value: "30", label: "30 s" },
              { value: "60", label: "1 min" },
            ]}
          />
        </ToggleRow>
        <ToggleRow
          title="Breath guide"
          hint="Paces the breath while you settle and for the first two minutes"
          on={prefs.guide !== "off"}
          onToggle={(on) => updateBreathPrefs({ guide: on ? last.current.guide : "off" })}
        >
          <Segmented
            label="Breathing pattern"
            value={prefs.guide === "off" ? last.current.guide : prefs.guide}
            onChange={(guide) => updateBreathPrefs({ guide })}
            options={BREATH_PATTERN_KEYS.map((key) => ({
              value: key,
              label: BREATH_PATTERNS[key].label,
              title: BREATH_PATTERNS[key].summary,
            }))}
          />
          {prefs.guide !== "off" ? (
            <p className="mt-2 text-xs text-ink-faint">{BREATH_PATTERNS[prefs.guide].summary}</p>
          ) : null}
        </ToggleRow>
      </SettingsGroup>

      <button
        type="button"
        aria-expanded={more}
        aria-controls={moreId}
        onClick={() => setMore((v) => !v)}
        className="press mt-4 inline-flex h-9 items-center gap-1.5 rounded-full pr-2 text-[0.8125rem] text-ink-faint hover:text-ink"
      >
        More settings
        <ChevronDown size={15} className={cn("transition-transform duration-200 ease-out", more && "rotate-180")} />
      </button>
      <div id={moreId} hidden={!more}>
        <div className="grid gap-3 pt-2 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <span aria-hidden className="text-xs text-ink-faint">Opening bells</span>
            <Segmented
              label="Opening bells"
              value={String(settings.startStrikes)}
              onChange={(v) => updateSettings({ startStrikes: Number(v) as 1 | 2 | 3 })}
              className="w-full"
              options={[
                { value: "1", label: "One" },
                { value: "2", label: "Two" },
                { value: "3", label: "Three" },
              ]}
            />
          </div>
          <div className="flex flex-col gap-2">
            <span aria-hidden className="text-xs text-ink-faint">Closing bells</span>
            <Segmented
              label="Closing bells"
              value={String(settings.endStrikes)}
              onChange={(v) => updateSettings({ endStrikes: Number(v) as 1 | 2 | 3 })}
              className="w-full"
              options={[
                { value: "1", label: "One" },
                { value: "2", label: "Two" },
                { value: "3", label: "Three" },
              ]}
            />
          </div>
        </div>
      </div>
    </>
  );
}

/** Three bells as tiles: choosing one plays it. */
function BellPicker({ value, onChange }: { value: BellSound; onChange: (bell: BellSound) => void }) {
  const name = useId();
  return (
    <div role="radiogroup" aria-label="Bell sound" className="mt-2 grid grid-cols-3 gap-2">
      {BELLS.map((bell) => {
        const checked = value === bell.value;
        return (
          <label key={bell.value} className="press relative block cursor-pointer rounded-xl">
            <input
              type="radio"
              name={name}
              value={bell.value}
              checked={checked}
              onChange={() => onChange(bell.value)}
              className="peer absolute inset-0 cursor-pointer appearance-none rounded-xl opacity-0"
            />
            <span
              className={cn(
                "pointer-events-none flex h-full flex-col gap-2 rounded-xl p-3 ring-1 ring-inset transition-[background-color,box-shadow] duration-150",
                "peer-focus-visible:shadow-[0_0_0_2px_var(--paper),0_0_0_4px_var(--accent)]",
                checked ? "bg-accent-wash ring-accent" : "ring-line peer-hover:bg-paper-sunken",
              )}
            >
              <BellWave sound={bell.value} active={checked} />
              <span className="text-[0.8125rem] leading-tight text-ink">{bell.label}</span>
              <span className="text-[0.6875rem] text-ink-faint">{bell.hint}</span>
            </span>
          </label>
        );
      })}
    </div>
  );
}

/** Each bell drawn as its decay: long and slow, wide, or short. */
function BellWave({ sound, active }: { sound: BellSound; active: boolean }) {
  const decay = sound === "bowl" ? 0.035 : sound === "bell" ? 0.06 : 0.22;
  const freq = sound === "bowl" ? 0.55 : sound === "bell" ? 0.38 : 0.9;
  const points = Array.from({ length: 61 }, (_, i) => {
    const amp = Math.exp(-decay * i) * 9;
    return `${i * 1.2},${12 - amp * Math.sin(i * freq)}`;
  }).join(" ");
  return (
    <svg viewBox="0 0 72 24" className="h-6 w-full" aria-hidden>
      <polyline
        points={points}
        fill="none"
        stroke={active ? "var(--accent)" : "var(--ink-faint)"}
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function BreathePatterns() {
  const prefs = useBreathPrefs();
  const name = useId();
  return (
    <SettingsGroup title="Pattern">
      <div role="radiogroup" aria-label="Breathing pattern" className="mt-2 flex flex-col">
        {BREATH_PATTERN_KEYS.map((key) => {
          const checked = prefs.pattern === key;
          return (
            <label
              key={key}
              className="relative grid cursor-pointer grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 border-b border-line py-4 last:border-b-0"
            >
              <input
                type="radio"
                name={name}
                value={key}
                checked={checked}
                onChange={() => updateBreathPrefs({ pattern: key })}
                className="row-span-2 size-5 shrink-0 cursor-pointer appearance-none rounded-full ring-1 ring-inset ring-line-strong transition-shadow checked:shadow-[inset_0_0_0_5px_var(--accent)] checked:ring-accent focus-visible:shadow-[0_0_0_2px_var(--paper),0_0_0_4px_var(--accent)]"
              />
              <span className="text-[0.875rem] text-ink">{BREATH_PATTERNS[key].label}</span>
              <span className="text-xs text-ink-faint">{BREATH_PATTERNS[key].summary}</span>
            </label>
          );
        })}
      </div>
      <p className="mt-4 text-xs leading-5 text-ink-faint">
        A few minutes of paced breathing, to arrive before a sit or in place of one.
      </p>
    </SettingsGroup>
  );
}

function EndsAt({ minutes, settleSeconds }: { minutes: number; settleSeconds: number }) {
  // Clock time only exists on the client; the page itself is cached for everyone.
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(id);
  }, []);

  if (now === null) return <span className="h-5 text-xs text-ink-faint" />;
  const end = new Date(now + minutes * 60_000 + settleSeconds * 1000);
  return (
    <span className="h-5 text-xs tabular-nums text-ink-faint">
      Ends at {end.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
    </span>
  );
}

/* ---------- The dial ---------- */

const SIZE = 280;
const C = SIZE / 2;
const R = 110;
const SWEEP = 135; // degrees either side of twelve o'clock

function polar(deg: number, r = R) {
  const rad = (deg * Math.PI) / 180;
  return { x: C + r * Math.sin(rad), y: C - r * Math.cos(rad) };
}

function arc(from: number, to: number, r = R) {
  const a = polar(from, r);
  const b = polar(to, r);
  const large = to - from > 180 ? 1 : 0;
  return `M ${a.x} ${a.y} A ${r} ${r} 0 ${large} 1 ${b.x} ${b.y}`;
}

const toAngle = (v: number) =>
  -SWEEP +
  ((Math.min(v, MAX_MINUTES) - MIN_MINUTES) / (MAX_MINUTES - MIN_MINUTES)) *
    SWEEP *
    2;

const clamp = (v: number) =>
  Math.min(MAX_MINUTES, Math.max(MIN_MINUTES, Math.round(v)));

/** Drag round the arc, or use the arrow keys: one minute a step, five with Page keys. */
export function Dial({
  value,
  onChange,
  className,
}: {
  value: number;
  onChange: (minutes: number) => void;
  className?: string;
}) {
  const ref = useRef<SVGSVGElement>(null);
  const dragging = useRef(false);
  const last = useRef(value);
  const glowId = useId();
  const shadowId = useId();

  useEffect(() => {
    last.current = value;
  }, [value]);

  const fromPointer = (event: React.PointerEvent, starting = false) => {
    const box = ref.current?.getBoundingClientRect();
    if (!box) return false;
    const scale = box.width / SIZE;
    const x = event.clientX - box.left - box.width / 2;
    const y = event.clientY - box.top - box.height / 2;
    // Only the ring itself is a handle; the figure in the middle is not.
    if (starting && Math.hypot(x, y) < R * scale * 0.62) return false;
    let deg = (Math.atan2(x, -y) * 180) / Math.PI;
    // In the gap at six o'clock, hold whichever end we came from.
    if (deg > SWEEP || deg < -SWEEP)
      deg = last.current > (MIN_MINUTES + MAX_MINUTES) / 2 ? SWEEP : -SWEEP;
    const next = clamp(
      MIN_MINUTES + ((deg + SWEEP) / (SWEEP * 2)) * (MAX_MINUTES - MIN_MINUTES),
    );
    if (next !== last.current) {
      last.current = next;
      onChange(next);
    }
    return true;
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    const step: Record<string, number> = {
      ArrowUp: 1,
      ArrowRight: 1,
      ArrowDown: -1,
      ArrowLeft: -1,
      PageUp: 5,
      PageDown: -5,
    };
    if (event.key in step) onChange(clamp(value + step[event.key]));
    else if (event.key === "Home") onChange(MIN_MINUTES);
    else if (event.key === "End") onChange(MAX_MINUTES);
    else return;
    event.preventDefault();
  };

  const angle = toAngle(value);
  const handle = polar(angle);
  const ticks = Array.from({ length: MAX_MINUTES / 5 + 1 }, (_, i) =>
    Math.max(MIN_MINUTES, i * 5),
  );

  return (
    <div
      className={cn(
        "relative aspect-square w-full max-w-[16rem] select-none sm:max-w-[17.5rem]",
        className,
      )}
    >
      {/* A low glow behind the figure, the same dusk as the page headers. */}
      <div
        aria-hidden
        className="sun-halo absolute inset-[22%] rounded-full opacity-50"
      />
      <svg
        ref={ref}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        role="slider"
        tabIndex={0}
        aria-label="Length of the sit, in minutes"
        aria-valuemin={MIN_MINUTES}
        aria-valuemax={MAX_MINUTES}
        aria-valuenow={value}
        aria-valuetext={minutesInWords(value)}
        onKeyDown={onKeyDown}
        onPointerDown={(e) => {
          if (!fromPointer(e, true)) return;
          dragging.current = true;
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (dragging.current) fromPointer(e);
        }}
        onPointerUp={() => (dragging.current = false)}
        onPointerCancel={() => (dragging.current = false)}
        className="relative size-full touch-none overflow-visible rounded-full"
      >
        <defs>
          <filter id={glowId} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="5" />
          </filter>
          <filter id={shadowId} x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow
              dx="0"
              dy="1.5"
              stdDeviation="2.5"
              floodColor="var(--ink)"
              floodOpacity="0.22"
            />
          </filter>
        </defs>

        {/* Minute marks outside the track: every five, longer every fifteen. */}
        {ticks.map((m) => {
          const major = m % 15 === 0;
          const a = polar(toAngle(m), R + 17);
          const b = polar(toAngle(m), R + (major ? 26 : 21));
          return (
            <line
              key={m}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke={m <= value ? "var(--ink-faint)" : "var(--line-strong)"}
              strokeWidth={major ? 1.5 : 1}
              strokeLinecap="round"
            />
          );
        })}

        <path
          d={arc(-SWEEP, SWEEP)}
          fill="none"
          stroke="var(--paper-sunken)"
          strokeWidth={10}
          strokeLinecap="round"
        />
        <path
          d={arc(-SWEEP, angle)}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={10}
          strokeLinecap="round"
          opacity={0.45}
          filter={`url(#${glowId})`}
        />
        <path
          d={arc(-SWEEP, angle)}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={10}
          strokeLinecap="round"
        />

        <g
          transform={`translate(${handle.x} ${handle.y})`}
          filter={`url(#${shadowId})`}
        >
          <circle
            r={14}
            fill="var(--paper-raised)"
            stroke="var(--line-strong)"
            strokeWidth={1}
          />
          <circle r={3.5} fill="var(--accent)" />
        </g>
      </svg>

      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-serif text-[4.5rem] leading-none tracking-[-0.03em] tabular-nums sm:text-[5rem]">
          {value}
        </span>
        <span className="mt-1 text-xs text-ink-faint">
          {value === 1 ? "minute" : "minutes"}
        </span>
      </div>
    </div>
  );
}
