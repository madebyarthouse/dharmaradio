import { Link } from "react-router";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  Bookmark,
  Check,
  Heart,
  ListEnd,
  ListPlus,
  ListStart,
  MoreHorizontal,
  Share,
  UserRound,
} from "lucide-react";
import { useAudio } from "~/contexts/audio-context";
import { useLibrary } from "~/contexts/library-context";
import { useUI } from "~/contexts/ui-context";
import { formatDate, formatDuration, formatRemaining } from "~/lib/format";
import { toPlayerTalk, type TalkListItem } from "~/lib/talk";
import { cn } from "~/lib/cn";
import { TalkArt } from "~/components/artwork";
import { PlayGlyph } from "~/components/play-glyph";

export function TalkList({
  talks,
  showTeacher = true,
  numbered = false,
  className,
}: {
  talks: TalkListItem[];
  showTeacher?: boolean;
  numbered?: boolean;
  className?: string;
}) {
  return (
    <ol className={cn("divide-y divide-line", className)}>
      {talks.map((talk, index) => (
        <li key={talk.id}>
          <TalkRow
            talk={talk}
            context={talks}
            showTeacher={showTeacher}
            index={numbered ? index + 1 : undefined}
          />
        </li>
      ))}
    </ol>
  );
}

export function TalkRow({
  talk,
  context,
  showTeacher = true,
  index,
  trailing,
}: {
  talk: TalkListItem;
  /** The list this row lives in; becomes the queue when played from here. */
  context?: TalkListItem[];
  showTeacher?: boolean;
  index?: number;
  trailing?: React.ReactNode;
}) {
  const { currentTalk, isPlaying, togglePlay, playNow } = useAudio();
  const library = useLibrary();
  const isCurrent = currentTalk?.id === talk.id;
  const progress = library.progress.get(talk.id);
  const ratio =
    progress && !progress.completed && talk.duration > 0
      ? Math.min(1, progress.positionSec / talk.duration)
      : 0;

  const handlePlay = () => {
    if (isCurrent) {
      togglePlay();
      return;
    }
    playNow(toPlayerTalk(talk), context?.map(toPlayerTalk));
  };

  const meta: React.ReactNode[] = [];
  if (showTeacher && talk.teacher) {
    meta.push(
      <Link
        key="teacher"
        to={`/teachers/${talk.teacher.slug}`}
        className="relative z-10 text-ink-soft hover:text-ink"
      >
        {talk.teacher.name}
      </Link>,
    );
  }
  if (talk.publicationDate)
    meta.push(
      <span key="date" className="tabular-nums">
        {formatDate(talk.publicationDate)}
      </span>,
    );
  meta.push(
    <span key="duration" className="tabular-nums">
      {progress?.completed ? (
        <span className="inline-flex items-center gap-1 text-accent-ink">
          <Check size={12} strokeWidth={2.5} /> Played
        </span>
      ) : ratio > 0 ? (
        <span className="text-accent-ink">
          {formatRemaining(progress!.positionSec, talk.duration)}
        </span>
      ) : (
        formatDuration(talk.duration)
      )}
    </span>,
  );

  return (
    <div
      className={cn(
        "group relative -mx-3 flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors md:gap-4",
        "hover:bg-paper-sunken/70",
        isCurrent && "bg-accent-wash hover:bg-accent-wash",
      )}
    >
      {index != null ? (
        <span className="hidden w-6 shrink-0 text-right text-xs tabular-nums text-ink-faint sm:block">{index}</span>
      ) : null}

      <button
        type="button"
        onClick={handlePlay}
        aria-label={isCurrent && isPlaying ? `Pause ${talk.title}` : `Play ${talk.title}`}
        className={cn("press relative z-10 shrink-0", showTeacher ? "rounded-md" : "rounded-full")}
      >
        {!showTeacher ? (
          <span
            className={cn(
              "flex size-11 items-center justify-center rounded-full ring-1 ring-inset transition-colors",
              isCurrent ? "bg-accent text-on-accent ring-accent" : "text-ink ring-line-strong group-hover:ring-ink-faint",
            )}
          >
            <PlayGlyph playing={isCurrent && isPlaying} size={15} />
          </span>
        ) : (
        <span className="relative block">
          <TalkArt
            src={talk.teacher?.profileImageUrl}
            seed={talk.teacher?.slug ?? talk.id}
            name={talk.teacher?.name ?? talk.title}
            size={52}
            className="[--art-radius:0.375rem]"
          />
          <span
            className={cn(
              "absolute inset-0 flex items-center justify-center rounded-md bg-ink/40 text-paper transition-opacity duration-150",
              isCurrent ? "opacity-100" : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100",
            )}
          >
            <PlayGlyph playing={isCurrent && isPlaying} size={18} />
          </span>
        </span>
        )}
      </button>

      <div className="min-w-0 flex-1">
        <Link
          to={`/talks/${talk.slug}`}
          className="line-clamp-2 font-serif text-[1.0625rem] leading-snug tracking-[-0.005em] text-ink after:absolute after:inset-0 after:content-['']"
        >
          {talk.title}
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-0.5 text-xs text-ink-faint">{meta}</div>
        {ratio > 0 ? (
          <div className="mt-2 h-[3px] w-full max-w-48 overflow-hidden rounded-full bg-line">
            <div className="h-full rounded-full bg-accent" style={{ width: `${ratio * 100}%` }} />
          </div>
        ) : null}
      </div>

      <div className="relative z-10 flex shrink-0 items-center">
        {trailing}
        <SaveButton talkId={talk.id} className="hidden sm:inline-flex" />
        <TalkMenu talk={talk} />
      </div>
    </div>
  );
}

export function SaveButton({ talkId, className }: { talkId: number; className?: string }) {
  const library = useLibrary();
  const saved = library.isSaved(talkId);
  return (
    <button
      type="button"
      onClick={() => void library.toggleSaved(talkId)}
      aria-pressed={saved}
      aria-label={saved ? "Remove from saved" : "Save for later"}
      className={cn(
        "press inline-flex size-10 items-center justify-center rounded-full hover:bg-paper-sunken",
        saved ? "text-accent-ink" : "text-ink-faint hover:text-ink",
        className,
      )}
    >
      <Bookmark size={18} fill={saved ? "currentColor" : "none"} />
    </button>
  );
}

export function LikeButton({ talkId, className, size = 18 }: { talkId: number; className?: string; size?: number }) {
  const library = useLibrary();
  const liked = library.isLiked(talkId);
  return (
    <button
      type="button"
      onClick={() => void library.toggleLiked(talkId)}
      aria-pressed={liked}
      aria-label={liked ? "Unlike" : "Like"}
      className={cn(
        "press inline-flex size-10 items-center justify-center rounded-full hover:bg-paper-sunken",
        liked ? "text-accent-ink" : "text-ink-faint hover:text-ink",
        className,
      )}
    >
      <Heart size={size} fill={liked ? "currentColor" : "none"} />
    </button>
  );
}

export function TalkMenu({ talk, align = "end" }: { talk: TalkListItem; align?: "start" | "end" }) {
  const { addToQueue, playNextInQueue } = useAudio();
  const library = useLibrary();
  const ui = useUI();
  const saved = library.isSaved(talk.id);
  const liked = library.isLiked(talk.id);

  const share = async () => {
    const url = new URL(`/talks/${talk.slug}`, window.location.origin).toString();
    if (navigator.share) {
      await navigator.share({ title: talk.title, url }).catch(() => {});
    } else {
      await navigator.clipboard.writeText(url);
      ui.toast("Link copied");
    }
  };

  return (
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger
        aria-label={`More actions for ${talk.title}`}
        className="press inline-flex size-10 items-center justify-center rounded-full text-ink-faint hover:bg-paper-sunken hover:text-ink data-[state=open]:bg-paper-sunken data-[state=open]:text-ink"
      >
        <MoreHorizontal size={18} />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align={align} sideOffset={6} className={menuContentClass}>
          <MenuItem icon={<ListStart size={16} />} onSelect={() => playNextInQueue(toPlayerTalk(talk))}>
            Play next
          </MenuItem>
          <MenuItem icon={<ListEnd size={16} />} onSelect={() => addToQueue(toPlayerTalk(talk))}>
            Add to queue
          </MenuItem>
          <DropdownMenu.Separator className="my-1 h-px bg-line" />
          <MenuItem
            icon={<Bookmark size={16} fill={saved ? "currentColor" : "none"} />}
            onSelect={() => void library.toggleSaved(talk.id)}
          >
            {saved ? "Remove from saved" : "Save for later"}
          </MenuItem>
          <MenuItem
            icon={<Heart size={16} fill={liked ? "currentColor" : "none"} />}
            onSelect={() => void library.toggleLiked(talk.id)}
          >
            {liked ? "Unlike" : "Like"}
          </MenuItem>
          <MenuItem icon={<ListPlus size={16} />} onSelect={() => (library.user ? ui.openAddToPlaylist(talk) : library.requestSignIn())}>
            Add to playlist…
          </MenuItem>
          <DropdownMenu.Separator className="my-1 h-px bg-line" />
          {talk.teacher ? (
            <DropdownMenu.Item asChild className={menuItemClass}>
              <Link to={`/teachers/${talk.teacher.slug}`}>
                <UserRound size={16} /> {talk.teacher.name}
              </Link>
            </DropdownMenu.Item>
          ) : null}
          <MenuItem icon={<Share size={16} />} onSelect={() => void share()}>
            Share
          </MenuItem>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

export const menuContentClass =
  "z-50 min-w-56 origin-[var(--radix-dropdown-menu-content-transform-origin)] rounded-xl border border-line bg-paper-raised p-1.5 text-[0.8125rem] text-ink shadow-soft data-[state=open]:animate-pop";

export const menuItemClass =
  "flex h-10 cursor-default select-none items-center gap-3 rounded-lg px-3 outline-none data-[highlighted]:bg-paper-sunken [&_svg]:text-ink-soft";

function MenuItem({
  icon,
  children,
  onSelect,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
  onSelect: () => void;
}) {
  return (
    <DropdownMenu.Item className={menuItemClass} onSelect={onSelect}>
      {icon}
      {children}
    </DropdownMenu.Item>
  );
}
