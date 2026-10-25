import { useCallback, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Link } from "react-router";
import * as Dialog from "@radix-ui/react-dialog";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  ChevronDown,
  ListMusic,
  ListPlus,
  Maximize2,
  Moon,
  PanelRightClose,
  SkipBack,
  SkipForward,
  SquareArrowOutUpRight,
  Volume1,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { useAudio, type PlayerTalk } from "~/contexts/audio-context";
import { useLibrary } from "~/contexts/library-context";
import { useUI } from "~/contexts/ui-context";
import { formatClock, formatDuration } from "~/lib/format";
import type { TalkListItem } from "~/lib/talk";
import { cn } from "~/lib/cn";
import { TalkArt } from "~/components/artwork";
import { PlayGlyph } from "~/components/play-glyph";
import { Visualizer } from "~/components/visualizer";
import { LikeButton, SaveButton, menuContentClass, menuItemClass } from "~/components/talk-row";

const RATES = [0.8, 1, 1.15, 1.25, 1.5, 1.75, 2];
const SLEEP_MINUTES = [5, 10, 15, 30, 45, 60];

const iconButton =
  "press inline-flex size-10 items-center justify-center rounded-full text-ink-soft hover:bg-paper-sunken hover:text-ink disabled:opacity-30";

/**
 * Opening and closing the full player. Pointer-initiated changes morph the docked
 * artwork into the full one (View Transitions); keyboard-initiated and reduced-motion
 * changes are instant.
 */
function usePlayerOpen() {
  const ui = useUI();
  return useCallback(
    (open: boolean, animate = true) => {
      const doc = document as Document & {
        startViewTransition?: (cb: () => void) => { finished: Promise<void> };
      };
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (!animate || reduce || !doc.startViewTransition) {
        ui.setNowPlayingOpen(open);
        return;
      }
      const root = document.documentElement;
      root.classList.toggle("np-closing", !open);
      // The view transition animates the sheet; its own CSS entrance must not run too.
      root.classList.add("np-vt");
      const transition = doc.startViewTransition(() => flushSync(() => ui.setNowPlayingOpen(open)));
      void transition.finished.finally(() => root.classList.remove("np-closing", "np-vt"));
    },
    [ui],
  );
}

function toListItem(talk: PlayerTalk): TalkListItem {
  return {
    id: talk.id,
    slug: talk.slug ?? "",
    title: talk.title,
    duration: talk.duration,
    audioUrl: talk.audioUrl,
    publicationDate: null,
    teacher:
      talk.teacher && talk.teacherSlug
        ? { name: talk.teacher, slug: talk.teacherSlug, profileImageUrl: talk.artworkUrl ?? null }
        : null,
    center: talk.centerName && talk.centerSlug ? { name: talk.centerName, slug: talk.centerSlug } : null,
    retreat: talk.retreatTitle && talk.retreatSlug ? { title: talk.retreatTitle, slug: talk.retreatSlug } : null,
  };
}

/** The docked player: what's playing, play, skip and progress. Everything else is one tap away. */
export function PlayerBar() {
  const audio = useAudio();
  const ui = useUI();
  const setOpen = usePlayerOpen();
  const talk = audio.currentTalk;
  if (!talk) return null;

  const ratio = audio.duration > 0 ? audio.currentTime / audio.duration : 0;
  // Keyboard clicks have detail 0: open without the morph.
  const open = (event: React.MouseEvent) => setOpen(true, event.detail !== 0);

  return (
    <>
      <div className="pointer-events-none mx-auto w-full max-w-shell px-2 pb-2 sm:px-8 md:pb-4 lg:px-12">
        <div className="pointer-events-auto relative overflow-hidden rounded-2xl bg-paper-raised/95 shadow-soft ring-1 ring-inset ring-line backdrop-blur-md">
          {/* Compact screens: a thin progress line along the top edge. */}
          <div aria-hidden className="absolute inset-x-0 top-0 h-[2px] bg-line lg:hidden">
            <div className="h-full bg-accent" style={{ width: `${ratio * 100}%` }} />
          </div>

          <div className="flex h-16 items-center gap-2 pl-2 pr-1.5 lg:grid lg:h-[4.5rem] lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_minmax(0,1fr)] lg:gap-6 lg:pl-3 lg:pr-3">
            <button
              type="button"
              onClick={open}
              className="press flex min-w-0 flex-1 items-center gap-3 rounded-xl p-1 text-left"
              aria-label={`Open player: ${talk.title}`}
            >
              <TalkArt
                src={talk.artworkUrl}
                seed={talk.teacherSlug ?? talk.id}
                name={talk.teacher ?? talk.title}
                size={44}
                className="[--art-radius:0.375rem]"
                style={ui.nowPlayingOpen ? undefined : { viewTransitionName: "np-art" }}
              />
              <span className="min-w-0">
                <span className="block truncate font-serif text-[1rem] leading-tight">{talk.title}</span>
                <span className="mt-0.5 block truncate text-xs text-ink-faint">{talk.teacher ?? "Dharma talk"}</span>
              </span>
            </button>

            {/* Compact: back 15 and play. */}
            <div className="flex items-center lg:hidden">
              <button type="button" onClick={() => audio.seekBy(-15)} aria-label="Back 15 seconds" className={iconButton}>
                <SkipGlyph direction="back" />
              </button>
              <PlayPauseButton size="sm" />
            </div>

            {/* Wide: skip, play, skip over the scrubber. */}
            <div className="hidden flex-col items-center gap-0.5 lg:flex">
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => audio.seekBy(-15)} aria-label="Back 15 seconds" className={iconButton}>
                  <SkipGlyph direction="back" />
                </button>
                <PlayPauseButton size="sm" />
                <button type="button" onClick={() => audio.seekBy(30)} aria-label="Forward 30 seconds" className={iconButton}>
                  <SkipGlyph direction="forward" seconds={30} />
                </button>
              </div>
              <Scrubber className="w-full max-w-lg" compact />
            </div>

            <div className="hidden items-center justify-end gap-1 lg:flex">
              <SleepIndicator />
              <SaveButton talkId={talk.id} />
              <button type="button" onClick={open} aria-label="Open full player" className={iconButton}>
                <Maximize2 size={17} />
              </button>
            </div>
          </div>
        </div>
      </div>
      <FullPlayer />
    </>
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
        "press relative inline-flex items-center justify-center rounded-full",
        size === "sm" ? "size-11 bg-ink text-paper" : "size-[4.5rem] bg-accent text-on-accent",
      )}
    >
      {isBuffering ? (
        <span
          aria-hidden
          className={cn(
            "absolute inset-0 animate-spin rounded-full border-2 border-transparent",
            size === "sm" ? "border-t-accent" : "border-t-on-accent",
          )}
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
          d={direction === "back" ? "M4.5 12a7.5 7.5 0 1 0 2.2-5.3M4.5 4v3.5H8" : "M19.5 12a7.5 7.5 0 1 1-2.2-5.3M19.5 4v3.5H16"}
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

function Scrubber({ className, compact }: { className?: string; compact?: boolean }) {
  const { currentTime, duration, seek } = useAudio();
  const [dragValue, setDragValue] = useState<number | null>(null);
  const max = duration > 0 ? duration : 1;
  const value = dragValue ?? currentTime;
  const ratio = Math.min(1, value / max);

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <span className="w-12 text-right text-[0.6875rem] tabular-nums text-ink-faint">{formatClock(value)}</span>
      <div className="group relative flex h-5 flex-1 items-center">
        <div className={cn("w-full overflow-hidden rounded-full bg-line-strong", compact ? "h-[3px]" : "h-1")}>
          <div className={cn("h-full rounded-full", compact ? "bg-ink" : "bg-accent")} style={{ width: `${ratio * 100}%` }} />
        </div>
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full shadow-soft transition-opacity duration-150",
            compact ? "bg-ink" : "bg-accent",
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
      <span className="w-12 text-[0.6875rem] tabular-nums text-ink-faint">-{formatClock(Math.max(0, duration - value))}</span>
    </div>
  );
}

const pillClass =
  "press inline-flex h-10 min-w-10 items-center justify-center gap-1.5 rounded-full px-3 text-[0.8125rem] tabular-nums ring-1 ring-inset ring-line hover:bg-paper-sunken";

function RateMenu() {
  const { playbackRate, setPlaybackRate } = useAudio();
  return (
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger
        aria-label={`Playback speed, ${playbackRate} times`}
        className={cn(pillClass, playbackRate !== 1 ? "text-accent-ink" : "text-ink-soft")}
      >
        {playbackRate}×
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content side="top" align="center" sideOffset={8} className={cn(menuContentClass, "night min-w-36")}>
          <DropdownMenu.Label className="px-3 py-1.5 text-xs text-ink-faint">Speed</DropdownMenu.Label>
          <DropdownMenu.RadioGroup value={String(playbackRate)} onValueChange={(v) => setPlaybackRate(Number(v))}>
            {RATES.map((rate) => (
              <DropdownMenu.RadioItem
                key={rate}
                value={String(rate)}
                className={cn(menuItemClass, "justify-between tabular-nums data-[state=checked]:text-accent-ink")}
              >
                {rate}×
                <DropdownMenu.ItemIndicator>
                  <span aria-hidden className="block size-1.5 rounded-full bg-accent" />
                </DropdownMenu.ItemIndicator>
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

/** Only shown on the docked bar while a sleep timer is running. */
function SleepIndicator() {
  const countdown = useSleepCountdown();
  if (!countdown) return null;
  return (
    <span className="mr-1 inline-flex items-center gap-1.5 text-xs tabular-nums text-accent-ink" aria-label={`Sleep timer: ${countdown}`}>
      <Moon size={14} fill="currentColor" aria-hidden />
      {countdown}
    </span>
  );
}

function SleepMenu() {
  const { sleepTimer, setSleepTimer } = useAudio();
  const countdown = useSleepCountdown();
  return (
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger
        aria-label={countdown ? `Sleep timer: ${countdown}` : "Sleep timer"}
        className={cn(pillClass, sleepTimer ? "text-accent-ink" : "text-ink-soft")}
      >
        <Moon size={16} fill={sleepTimer ? "currentColor" : "none"} />
        {countdown ? <span className="text-xs">{countdown}</span> : null}
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content side="top" align="center" sideOffset={8} className={cn(menuContentClass, "night min-w-44")}>
          <DropdownMenu.Label className="px-3 py-1.5 text-xs text-ink-faint">Sleep timer</DropdownMenu.Label>
          {SLEEP_MINUTES.map((minutes) => (
            <DropdownMenu.Item key={minutes} className={menuItemClass} onSelect={() => setSleepTimer({ minutes })}>
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
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => setVolume(volume === 0 ? 0.8 : 0)}
        aria-label={volume === 0 ? "Unmute" : "Mute"}
        className={iconButton}
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
        aria-valuetext={`${Math.round(volume * 100)} percent`}
        className="h-1 w-24 cursor-pointer accent-[var(--accent)]"
      />
    </div>
  );
}

/**
 * The full player: the talk, a light that listens to it, every control, and the
 * queue beside it (a sheet on phones). Esc, the close button or a swipe down close it.
 */
function FullPlayer() {
  const audio = useAudio();
  const ui = useUI();
  const library = useLibrary();
  const setOpen = usePlayerOpen();
  const talk = audio.currentTalk;
  const [queueOpen, setQueueOpen] = useState(false);
  const [wide, setWide] = useState(false);
  const sheet = useRef<HTMLDivElement>(null);
  const drag = useRef<{ y: number; dy: number } | null>(null);

  useEffect(() => {
    const query = window.matchMedia("(min-width: 64rem)");
    const update = () => setWide(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  // The queue opens beside the player on wide screens; on phones it waits to be asked for.
  useEffect(() => {
    if (ui.nowPlayingOpen) setQueueOpen(wide);
  }, [ui.nowPlayingOpen, wide]);

  if (!talk) return null;
  const navigateAway = () => ui.setNowPlayingOpen(false);

  // Swipe down from the top bar to close, on touch screens.
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === "mouse" || (e.target as HTMLElement).closest("button,a")) return;
    drag.current = { y: e.clientY, dy: 0 };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current || !sheet.current) return;
    drag.current.dy = Math.max(0, e.clientY - drag.current.y);
    sheet.current.style.transition = "none";
    sheet.current.style.translate = `0 ${drag.current.dy}px`;
  };
  const onPointerUp = () => {
    const el = sheet.current;
    const dy = drag.current?.dy ?? 0;
    drag.current = null;
    if (!el) return;
    el.style.transition = "translate 240ms var(--ease-drawer)";
    if (dy > 110) {
      el.style.translate = "0 100%";
      window.setTimeout(() => {
        ui.setNowPlayingOpen(false);
        el.style.translate = "";
        el.style.transition = "";
      }, 200);
    } else el.style.translate = "";
  };

  return (
    <Dialog.Root open={ui.nowPlayingOpen} onOpenChange={(open) => setOpen(open)}>
      <Dialog.Portal>
        <Dialog.Content
          ref={sheet}
          aria-describedby={undefined}
          onEscapeKeyDown={(e) => {
            // Keyboard-initiated: close without animating.
            e.preventDefault();
            ui.setNowPlayingOpen(false);
          }}
          data-np-sheet=""
          style={{ viewTransitionName: "np-sheet" }}
          className="night fixed inset-0 z-50 flex flex-col bg-paper text-ink outline-none data-[state=open]:animate-[sheet-up_300ms_var(--ease-drawer)]"
        >
          <div
            className="pt-safe flex touch-none items-center justify-between gap-3 px-3 py-2 sm:px-6"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            <Dialog.Close aria-label="Close player" className={iconButton}>
              <ChevronDown size={22} />
            </Dialog.Close>
            <span aria-hidden className="h-1 w-10 rounded-full bg-line-strong sm:hidden" />
            <Dialog.Title className="sr-only">Now playing</Dialog.Title>
            <button
              type="button"
              onClick={() => setQueueOpen((v) => !v)}
              aria-pressed={queueOpen}
              aria-label={queueOpen ? "Hide queue" : "Show queue"}
              className={cn(iconButton, queueOpen && "bg-paper-sunken text-ink")}
            >
              <ListMusic size={19} />
            </button>
          </div>

          <div className="relative flex min-h-0 flex-1">
            <div className="flex min-h-0 flex-1 flex-col items-center overflow-y-auto px-6 pb-safe scrollbar-none">
              <div className="flex w-full max-w-xl flex-1 flex-col items-center justify-center py-4">
                {/* The stage: a light that listens, behind the artwork. */}
                <div className="relative aspect-square w-[min(72vw,40vh,22rem)]">
                  <Visualizer
                    talkId={talk.id}
                    playing={audio.isPlaying}
                    getMediaElement={audio.getMediaElement}
                    className="absolute -inset-[45%] size-[190%]"
                  />
                  <TalkArt
                    src={talk.artworkUrl}
                    seed={talk.teacherSlug ?? talk.id}
                    name={talk.teacher ?? talk.title}
                    className="absolute inset-[18%] !w-auto shadow-soft [--art-radius:0.75rem]"
                    style={ui.nowPlayingOpen ? { viewTransitionName: "np-art" } : undefined}
                  />
                </div>

                <div className="mt-6 w-full text-center">
                  <h2 className="text-balance font-serif text-[1.625rem] leading-tight tracking-[-0.01em] md:text-[2rem]">
                    {talk.slug ? (
                      <Link to={`/talks/${talk.slug}`} onClick={navigateAway} className="hover:text-accent-ink">
                        {talk.title}
                      </Link>
                    ) : (
                      talk.title
                    )}
                  </h2>
                  <p className="mt-2 text-[0.8125rem] text-ink-soft">
                    {talk.teacherSlug ? (
                      <Link to={`/teachers/${talk.teacherSlug}`} onClick={navigateAway} className="hover:text-ink">
                        {talk.teacher}
                      </Link>
                    ) : (
                      talk.teacher
                    )}
                  </p>
                  {talk.retreatTitle && talk.retreatSlug ? (
                    <p className="mt-1 truncate text-xs text-ink-faint">
                      <Link to={`/retreats/${talk.retreatSlug}`} onClick={navigateAway} className="hover:text-ink">
                        {talk.retreatTitle}
                      </Link>
                    </p>
                  ) : null}
                </div>

                <Scrubber className="mt-6 w-full" />

                <div className="mt-3 flex items-center gap-2 sm:gap-4">
                  <button type="button" onClick={audio.playPrevious} aria-label="Previous" className={cn(iconButton, "size-12")}>
                    <SkipBack size={20} fill="currentColor" />
                  </button>
                  <button type="button" onClick={() => audio.seekBy(-15)} aria-label="Back 15 seconds" className={cn(iconButton, "size-12")}>
                    <SkipGlyph direction="back" />
                  </button>
                  <PlayPauseButton size="lg" />
                  <button type="button" onClick={() => audio.seekBy(30)} aria-label="Forward 30 seconds" className={cn(iconButton, "size-12")}>
                    <SkipGlyph direction="forward" seconds={30} />
                  </button>
                  <button
                    type="button"
                    onClick={audio.playNext}
                    disabled={audio.queue.length === 0}
                    aria-label="Next"
                    className={cn(iconButton, "size-12")}
                  >
                    <SkipForward size={20} fill="currentColor" />
                  </button>
                </div>

                <div className="mt-5 flex flex-wrap items-center justify-center gap-1.5">
                  <RateMenu />
                  <SleepMenu />
                  <SaveButton talkId={talk.id} className="ring-1 ring-inset ring-line" />
                  <LikeButton talkId={talk.id} className="ring-1 ring-inset ring-line" />
                  <button
                    type="button"
                    onClick={() => (library.user ? ui.openAddToPlaylist(toListItem(talk)) : library.requestSignIn())}
                    aria-label="Add to playlist"
                    className={cn(iconButton, "ring-1 ring-inset ring-line")}
                  >
                    <ListPlus size={18} />
                  </button>
                  {talk.slug ? (
                    <Link
                      to={`/talks/${talk.slug}`}
                      onClick={navigateAway}
                      aria-label="Open the talk's page"
                      className={cn(iconButton, "ring-1 ring-inset ring-line")}
                    >
                      <SquareArrowOutUpRight size={17} />
                    </Link>
                  ) : null}
                </div>
                {audio.canControlVolume ? (
                  <div className="mt-4 hidden md:block">
                    <VolumeControl />
                  </div>
                ) : null}
              </div>
            </div>

            {queueOpen ? (
              <QueuePane
                onClose={() => setQueueOpen(false)}
                onNavigate={navigateAway}
                className={cn(
                  "lg:static lg:w-[22rem] lg:border-l lg:border-line lg:bg-transparent lg:shadow-none",
                  "absolute inset-x-0 bottom-0 z-10 max-h-[72%] rounded-t-2xl bg-paper-raised shadow-soft lg:max-h-none lg:rounded-none",
                  "animate-[sheet-up_260ms_var(--ease-drawer)] lg:animate-[sheet-in_220ms_var(--ease-out)]",
                )}
              />
            ) : null}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function QueuePane({ onClose, onNavigate, className }: { onClose: () => void; onNavigate: () => void; className?: string }) {
  const audio = useAudio();
  const total = audio.queue.reduce((sum, t) => sum + (t.duration || 0), 0);

  return (
    <section aria-label="Queue" className={cn("flex min-h-0 flex-col", className)}>
      <div className="flex items-center justify-between gap-3 px-5 pb-2 pt-4">
        <div>
          <h3 className="font-serif text-[1.25rem] leading-tight">Up next</h3>
          {audio.queue.length ? (
            <p className="text-xs tabular-nums text-ink-faint">
              {audio.queue.length} {audio.queue.length === 1 ? "talk" : "talks"}, {formatDuration(total)}
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-1">
          {audio.queue.length ? (
            <button type="button" onClick={audio.clearQueue} className="press h-8 rounded-full px-3 text-xs text-ink-faint hover:bg-paper-sunken hover:text-ink">
              Clear
            </button>
          ) : null}
          <button type="button" onClick={onClose} aria-label="Hide queue" className={iconButton}>
            <PanelRightClose size={18} className="hidden lg:block" />
            <X size={18} className="lg:hidden" />
          </button>
        </div>
      </div>
      {audio.queue.length === 0 ? (
        <p className="px-5 pb-8 pt-2 text-[0.8125rem] leading-relaxed text-ink-faint">
          Nothing queued. Use “Play next” on any talk to line it up.
        </p>
      ) : (
        <ol className="min-h-0 flex-1 overflow-y-auto px-3 pb-6 scrollbar-none">
          {audio.queue.map((item) => (
            <li key={item.id} className="group flex items-center gap-1 rounded-xl hover:bg-paper-sunken/70">
              <button
                type="button"
                onClick={() => audio.playNow(item, audio.queue)}
                className="press flex min-w-0 flex-1 items-center gap-3 rounded-xl p-2 text-left"
                aria-label={`Play ${item.title}`}
              >
                <TalkArt
                  src={item.artworkUrl}
                  seed={item.teacherSlug ?? item.id}
                  name={item.teacher ?? item.title}
                  size={40}
                  className="[--art-radius:0.3rem]"
                />
                <span className="min-w-0">
                  <span className="block truncate font-serif text-[0.975rem] leading-snug">{item.title}</span>
                  <span className="block truncate text-xs text-ink-faint">
                    {item.teacher}
                    {item.duration ? <span className="ml-2 tabular-nums">{formatDuration(item.duration)}</span> : null}
                  </span>
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
                className="press mr-1 inline-flex size-8 items-center justify-center rounded-full text-ink-faint hover:bg-paper-sunken hover:text-ink"
              >
                <X size={15} />
              </button>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
