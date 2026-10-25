import { useEffect, useState } from "react";
import { Link } from "react-router";
import * as Dialog from "@radix-ui/react-dialog";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  ChevronDown,
  ListMusic,
  Moon,
  SkipBack,
  SkipForward,
  Volume1,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { useAudio, type PlayerTalk } from "~/contexts/audio-context";
import { useUI } from "~/contexts/ui-context";
import { formatClock } from "~/lib/format";
import { cn } from "~/lib/cn";
import { Avatar } from "~/components/ui/primitives";
import { PlayGlyph } from "~/components/play-glyph";
import { LikeButton, SaveButton, menuContentClass, menuItemClass } from "~/components/talk-row";

const RATES = [0.8, 1, 1.15, 1.25, 1.5, 1.75, 2];
const SLEEP_MINUTES = [5, 10, 15, 30, 45, 60];

/** Bottom player: compact bar on mobile, full transport on desktop. */
export function PlayerBar() {
  const audio = useAudio();
  const ui = useUI();
  const talk = audio.currentTalk;
  if (!talk) return null;

  const ratio = audio.duration > 0 ? audio.currentTime / audio.duration : 0;

  return (
    <>
      <div className="relative border-t border-line bg-paper-raised/95 backdrop-blur-md">
        {/* Mobile: thin progress line on top of the bar */}
        <div className="absolute inset-x-0 top-0 h-0.5 bg-line lg:hidden">
          <div className="h-full bg-accent" style={{ width: `${ratio * 100}%` }} />
        </div>

        <div className="flex h-16 items-center gap-3 px-3 lg:grid lg:h-20 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)_minmax(0,1fr)] lg:gap-6 lg:px-5">
          <button
            type="button"
            onClick={() => ui.setNowPlayingOpen(true)}
            className="flex min-w-0 flex-1 items-center gap-3 text-left"
            aria-label="Open now playing"
          >
            <Artwork talk={talk} size={44} />
            <span className="min-w-0">
              <span className="block truncate font-serif text-[0.975rem] leading-tight">
                {talk.title}
              </span>
              <span className="block truncate text-xs text-ink-faint">
                {talk.teacher ?? "Dharma talk"}
              </span>
            </span>
          </button>

          {/* Mobile controls */}
          <div className="flex items-center lg:hidden">
            <button
              type="button"
              onClick={() => audio.seekBy(-15)}
              aria-label="Back 15 seconds"
              className="inline-flex size-10 items-center justify-center rounded-full text-ink-soft active:scale-90"
            >
              <SkipGlyph direction="back" />
            </button>
            <PlayPauseButton size="sm" />
          </div>

          {/* Desktop transport */}
          <div className="hidden flex-col items-center gap-1 lg:flex">
            <Transport size="sm" />
            <Scrubber className="w-full max-w-xl" compact />
          </div>

          <div className="hidden items-center justify-end gap-1 lg:flex">
            <SaveButton talkId={talk.id} />
            <RateMenu />
            <SleepMenu />
            <button
              type="button"
              onClick={() => ui.setNowPlayingOpen(true)}
              aria-label="Queue"
              className="inline-flex size-10 items-center justify-center rounded-full text-ink-faint hover:bg-paper-sunken hover:text-ink"
            >
              <ListMusic size={18} />
            </button>
            {audio.canControlVolume ? <VolumeControl /> : null}
          </div>
        </div>
      </div>
      <NowPlayingSheet />
    </>
  );
}

function Artwork({ talk, size }: { talk: PlayerTalk; size: number }) {
  return (
    <span className="relative shrink-0">
      <Avatar
        src={talk.artworkUrl}
        name={talk.teacher ?? talk.title}
        size={size}
        className="rounded-xl"
      />
    </span>
  );
}

function PlayPauseButton({ size }: { size: "sm" | "lg" }) {
  const { isPlaying, isBuffering, togglePlay } = useAudio();
  return (
    <button
      type="button"
      onClick={togglePlay}
      aria-label={isPlaying ? "Pause" : "Play"}
      className={cn(
        "relative inline-flex items-center justify-center rounded-full bg-ink text-paper transition-transform duration-150 active:scale-95",
        size === "sm" ? "size-11" : "size-[4.5rem]",
      )}
    >
      {isBuffering ? (
        <span
          aria-hidden
          className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-accent"
        />
      ) : null}
      <PlayGlyph playing={isPlaying} size={size === "sm" ? 16 : 26} />
    </button>
  );
}

function SkipGlyph({ direction, seconds = 15 }: { direction: "back" | "forward"; seconds?: number }) {
  return (
    <span className="relative inline-flex size-7 items-center justify-center">
      <svg viewBox="0 0 24 24" width="26" height="26" fill="none" aria-hidden>
        <path
          d={
            direction === "back"
              ? "M4.5 12a7.5 7.5 0 1 0 2.2-5.3M4.5 4v3.5H8"
              : "M19.5 12a7.5 7.5 0 1 1-2.2-5.3M19.5 4v3.5H16"
          }
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center pt-px text-[0.5625rem] font-semibold tabular-nums">
        {seconds}
      </span>
    </span>
  );
}

function Transport({ size }: { size: "sm" | "lg" }) {
  const audio = useAudio();
  const big = size === "lg";
  const iconBtn = cn(
    "inline-flex items-center justify-center rounded-full text-ink-soft transition-[color,transform] hover:text-ink active:scale-90 disabled:opacity-30",
    big ? "size-14" : "size-10",
  );
  const hasNext = audio.queue.length > 0;

  return (
    <div className={cn("flex items-center", big ? "gap-3" : "gap-1")}>
      <button type="button" onClick={audio.playPrevious} aria-label="Previous" className={iconBtn}>
        <SkipBack size={big ? 22 : 17} fill="currentColor" />
      </button>
      <button type="button" onClick={() => audio.seekBy(-15)} aria-label="Back 15 seconds" className={iconBtn}>
        <SkipGlyph direction="back" />
      </button>
      <PlayPauseButton size={size} />
      <button type="button" onClick={() => audio.seekBy(30)} aria-label="Forward 30 seconds" className={iconBtn}>
        <SkipGlyph direction="forward" seconds={30} />
      </button>
      <button
        type="button"
        onClick={audio.playNext}
        disabled={!hasNext}
        aria-label="Next"
        className={iconBtn}
      >
        <SkipForward size={big ? 22 : 17} fill="currentColor" />
      </button>
    </div>
  );
}

function Scrubber({ className, compact }: { className?: string; compact?: boolean }) {
  const { currentTime, duration, seek } = useAudio();
  const [dragValue, setDragValue] = useState<number | null>(null);
  const max = duration > 0 ? duration : 1;
  const value = dragValue ?? currentTime;
  const ratio = Math.min(1, value / max);

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <span className="w-12 text-right text-xs tabular-nums text-ink-faint">{formatClock(value)}</span>
      <div className="group relative flex h-5 flex-1 items-center">
        <div className={cn("w-full overflow-hidden rounded-full bg-line", compact ? "h-1" : "h-1.5")}>
          <div className="h-full rounded-full bg-ink" style={{ width: `${ratio * 100}%` }} />
        </div>
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink shadow-soft transition-opacity",
            compact && dragValue == null ? "opacity-0 group-hover:opacity-100" : "opacity-100",
          )}
          style={{ left: `${ratio * 100}%` }}
        />
        <input
          type="range"
          min={0}
          max={max}
          step={1}
          value={value}
          aria-label="Seek"
          aria-valuetext={`${formatClock(value)} of ${formatClock(duration)}`}
          onChange={(e) => setDragValue(Number(e.target.value))}
          onPointerUp={() => {
            if (dragValue != null) seek(dragValue);
            setDragValue(null);
          }}
          onKeyUp={() => {
            if (dragValue != null) seek(dragValue);
            setDragValue(null);
          }}
          className="absolute inset-0 w-full cursor-pointer opacity-0"
        />
      </div>
      <span className="w-12 text-xs tabular-nums text-ink-faint">
        -{formatClock(Math.max(0, duration - value))}
      </span>
    </div>
  );
}

function RateMenu({ large }: { large?: boolean }) {
  const { playbackRate, setPlaybackRate } = useAudio();
  return (
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger
        aria-label="Playback speed"
        className={cn(
          "inline-flex h-10 min-w-10 items-center justify-center rounded-full px-2 text-sm tabular-nums transition-colors hover:bg-paper-sunken",
          playbackRate !== 1 ? "text-accent-ink" : "text-ink-faint hover:text-ink",
          large && "h-11 border border-line px-4",
        )}
      >
        {playbackRate}×
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content side="top" align="center" sideOffset={8} className={cn(menuContentClass, "min-w-36")}>
          <DropdownMenu.Label className="px-3 py-1.5 text-xs text-ink-faint">Speed</DropdownMenu.Label>
          <DropdownMenu.RadioGroup
            value={String(playbackRate)}
            onValueChange={(v) => setPlaybackRate(Number(v))}
          >
            {RATES.map((rate) => (
              <DropdownMenu.RadioItem
                key={rate}
                value={String(rate)}
                className={cn(menuItemClass, "justify-between tabular-nums data-[state=checked]:text-accent-ink")}
              >
                {rate}×
                <DropdownMenu.ItemIndicator>•</DropdownMenu.ItemIndicator>
              </DropdownMenu.RadioItem>
            ))}
          </DropdownMenu.RadioGroup>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function useSleepCountdown() {
  const { sleepTimer } = useAudio();
  const endsAt = sleepTimer && "endsAt" in sleepTimer ? sleepTimer.endsAt : null;
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!endsAt) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [endsAt]);

  if (!sleepTimer) return null;
  if ("endOfTalk" in sleepTimer) return "End of talk";
  return formatClock(Math.max(0, (sleepTimer.endsAt - now) / 1000));
}

function SleepMenu({ large }: { large?: boolean }) {
  const { sleepTimer, setSleepTimer } = useAudio();
  const countdown = useSleepCountdown();
  return (
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger
        aria-label={countdown ? `Sleep timer: ${countdown}` : "Sleep timer"}
        className={cn(
          "inline-flex h-10 min-w-10 items-center justify-center gap-1.5 rounded-full px-2 text-sm tabular-nums transition-colors hover:bg-paper-sunken",
          sleepTimer ? "text-accent-ink" : "text-ink-faint hover:text-ink",
          large && "h-11 border border-line px-4",
        )}
      >
        <Moon size={17} fill={sleepTimer ? "currentColor" : "none"} />
        {countdown && (large || "endsAt" in (sleepTimer ?? {})) ? <span className="text-xs">{countdown}</span> : null}
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content side="top" align="center" sideOffset={8} className={cn(menuContentClass, "min-w-44")}>
          <DropdownMenu.Label className="px-3 py-1.5 text-xs text-ink-faint">Sleep timer</DropdownMenu.Label>
          {SLEEP_MINUTES.map((minutes) => (
            <DropdownMenu.Item
              key={minutes}
              className={menuItemClass}
              onSelect={() => setSleepTimer({ minutes })}
            >
              {minutes} minutes
            </DropdownMenu.Item>
          ))}
          <DropdownMenu.Item className={menuItemClass} onSelect={() => setSleepTimer({ endOfTalk: true })}>
            End of talk
          </DropdownMenu.Item>
          {sleepTimer ? (
            <>
              <DropdownMenu.Separator className="my-1 h-px bg-line" />
              <DropdownMenu.Item className={menuItemClass} onSelect={() => setSleepTimer(null)}>
                Turn off
              </DropdownMenu.Item>
            </>
          ) : null}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function VolumeControl() {
  const { volume, setVolume } = useAudio();
  const Icon = volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => setVolume(volume === 0 ? 0.8 : 0)}
        aria-label={volume === 0 ? "Unmute" : "Mute"}
        className="inline-flex size-10 items-center justify-center rounded-full text-ink-faint hover:bg-paper-sunken hover:text-ink"
      >
        <Icon size={18} />
      </button>
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={volume}
        onChange={(e) => setVolume(Number(e.target.value))}
        aria-label="Volume"
        className="h-1 w-20 cursor-pointer accent-[var(--ink)]"
      />
    </div>
  );
}

function NowPlayingSheet() {
  const audio = useAudio();
  const ui = useUI();
  const talk = audio.currentTalk;
  if (!talk) return null;

  const close = () => ui.setNowPlayingOpen(false);

  return (
    <Dialog.Root open={ui.nowPlayingOpen} onOpenChange={ui.setNowPlayingOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/30 backdrop-blur-[2px] data-[state=open]:animate-[fade_200ms]" />
        <Dialog.Content
          aria-describedby={undefined}
          className={cn(
            "fixed z-50 flex flex-col overflow-hidden bg-paper outline-none",
            "inset-0 data-[state=open]:animate-[sheet-up_380ms_var(--ease-calm)]",
            "lg:inset-y-3 lg:left-auto lg:right-3 lg:w-[26rem] lg:rounded-3xl lg:border lg:border-line lg:shadow-soft lg:data-[state=open]:animate-[sheet-in_320ms_var(--ease-calm)]",
          )}
        >
          <div aria-hidden className="dusk-glow absolute inset-x-0 top-0 h-96" />

          <div className="pt-safe relative flex items-center justify-between px-4 py-3">
            <Dialog.Close
              aria-label="Close"
              className="inline-flex size-10 items-center justify-center rounded-full text-ink-soft hover:bg-paper-sunken"
            >
              <ChevronDown size={22} className="lg:hidden" />
              <X size={20} className="hidden lg:block" />
            </Dialog.Close>
            <Dialog.Title className="text-xs font-medium uppercase tracking-[0.16em] text-ink-faint">
              Now playing
            </Dialog.Title>
            <span className="size-10" />
          </div>

          <div className="relative flex-1 overflow-y-auto px-6 pb-safe scrollbar-none">
            <div className="mx-auto flex max-w-sm flex-col items-center pt-4 text-center">
              <div className="relative">
                <span
                  aria-hidden
                  className={cn(
                    "absolute -inset-5 rounded-full bg-accent-wash",
                    audio.isPlaying && "animate-breathe",
                  )}
                />
                <Avatar
                  src={talk.artworkUrl}
                  name={talk.teacher ?? talk.title}
                  size={208}
                  className="relative shadow-soft ring-4 ring-paper"
                />
              </div>

              <h2 className="mt-10 text-balance font-serif text-2xl leading-tight tracking-tight">
                {talk.slug ? (
                  <Link to={`/talks/${talk.slug}`} onClick={close} className="hover:underline decoration-line-strong underline-offset-4">
                    {talk.title}
                  </Link>
                ) : (
                  talk.title
                )}
              </h2>
              <p className="mt-2 text-sm text-ink-soft">
                {talk.teacherSlug ? (
                  <Link to={`/teachers/${talk.teacherSlug}`} onClick={close} className="hover:text-ink">
                    {talk.teacher}
                  </Link>
                ) : (
                  talk.teacher
                )}
                {talk.retreatTitle && talk.retreatSlug ? (
                  <>
                    <span className="mx-1.5 text-ink-faint">·</span>
                    <Link to={`/retreats/${talk.retreatSlug}`} onClick={close} className="italic hover:text-ink">
                      {talk.retreatTitle}
                    </Link>
                  </>
                ) : null}
              </p>

              <Scrubber className="mt-8 w-full" />
              <div className="mt-4">
                <Transport size="lg" />
              </div>
              <div className="mt-6 flex items-center gap-2">
                <RateMenu large />
                <SleepMenu large />
                <SaveButton talkId={talk.id} className="border border-line" />
                <LikeButton talkId={talk.id} className="border border-line" />
              </div>
            </div>

            <QueueList onNavigate={close} />
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function QueueList({ onNavigate }: { onNavigate: () => void }) {
  const audio = useAudio();
  if (audio.queue.length === 0) {
    return (
      <p className="mx-auto mt-12 max-w-sm border-t border-line pb-10 pt-6 text-center text-sm text-ink-faint">
        Nothing queued. Use “Play next” on any talk to line it up.
      </p>
    );
  }

  return (
    <section className="mx-auto mt-12 max-w-sm border-t border-line pb-10 pt-5">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-serif text-lg">Up next</h3>
        <button type="button" onClick={audio.clearQueue} className="text-xs text-ink-faint hover:text-ink">
          Clear
        </button>
      </div>
      <ol>
        {audio.queue.map((item) => (
          <li key={item.id} className="group flex items-center gap-3 py-2">
            <button
              type="button"
              onClick={() => audio.playNow(item, audio.queue)}
              className="flex min-w-0 flex-1 items-center gap-3 text-left"
            >
              <Avatar src={item.artworkUrl} name={item.teacher ?? item.title} size={36} className="rounded-lg" />
              <span className="min-w-0">
                <span className="block truncate text-sm">{item.title}</span>
                <span className="block truncate text-xs text-ink-faint">{item.teacher}</span>
              </span>
            </button>
            {item.slug ? (
              <Link to={`/talks/${item.slug}`} onClick={onNavigate} className="sr-only focus:not-sr-only">
                Details
              </Link>
            ) : null}
            <button
              type="button"
              onClick={() => audio.removeFromQueue(item.id)}
              aria-label={`Remove ${item.title} from queue`}
              className="inline-flex size-8 items-center justify-center rounded-full text-ink-faint hover:bg-paper-sunken hover:text-ink"
            >
              <X size={15} />
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}
