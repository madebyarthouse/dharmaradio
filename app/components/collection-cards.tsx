import { Link } from "react-router";
import { MapPin } from "lucide-react";
import { useAudio } from "~/contexts/audio-context";
import { Avatar } from "~/components/ui/primitives";
import { TalkArt } from "~/components/artwork";
import { PlayGlyph } from "~/components/play-glyph";
import { dateParts, formatCount, formatDate, formatDateRange, formatDuration } from "~/lib/format";
import { toPlayerTalk, type TalkListItem } from "~/lib/talk";
import { cn } from "~/lib/cn";

/*
 * Shape tells you what a thing is:
 *   talks     square, album-like artwork
 *   teachers  round portraits
 *   retreats  a ticket, led by its dates
 *   centers   a place: a pin, a name, how much was recorded there
 */

/** A talk as an album tile. The artwork plays; the title opens the talk. */
export function TalkTile({
  talk,
  context,
  lead = false,
  className,
}: {
  talk: TalkListItem;
  context?: TalkListItem[];
  /** The first item on a shelf is drawn larger. */
  lead?: boolean;
  className?: string;
}) {
  const { currentTalk, isPlaying, togglePlay, playNow } = useAudio();
  const isCurrent = currentTalk?.id === talk.id;
  const play = () =>
    isCurrent ? togglePlay() : playNow(toPlayerTalk(talk), context?.map(toPlayerTalk));

  return (
    <article className={cn("group relative", lead ? "w-60 sm:w-72" : "w-40 sm:w-44", className)}>
      <div className="relative">
        <TalkArt
          src={talk.teacher?.profileImageUrl}
          seed={talk.teacher?.slug ?? talk.id}
          name={talk.teacher?.name ?? talk.title}
          className={cn(
            "transition-[scale] duration-300 ease-out group-hover:scale-[1.015]",
            lead ? "[--art-radius:0.75rem]" : "[--art-radius:0.5rem]",
          )}
        />
        <button
          type="button"
          onClick={play}
          aria-label={isCurrent && isPlaying ? `Pause ${talk.title}` : `Play ${talk.title}`}
          className={cn(
            "press absolute bottom-2.5 right-2.5 inline-flex items-center justify-center rounded-full bg-paper-raised/95 text-ink shadow-soft backdrop-blur hover:bg-paper-raised",
            lead ? "size-12" : "size-10",
            isCurrent && "bg-accent text-on-accent hover:bg-accent",
          )}
        >
          <PlayGlyph playing={isCurrent && isPlaying} size={lead ? 16 : 14} />
        </button>
      </div>
      <Link
        to={`/talks/${talk.slug}`}
        className={cn(
          "mt-3 line-clamp-2 font-serif leading-snug tracking-[-0.005em] hover:text-accent-ink",
          lead ? "text-[1.3125rem]" : "text-[1.0625rem]",
        )}
      >
        {talk.title}
      </Link>
      {talk.teacher ? <p className="mt-1 truncate text-[0.8125rem] text-ink-soft">{talk.teacher.name}</p> : null}
      <p className="mt-0.5 text-xs tabular-nums text-ink-faint">
        {formatDuration(talk.duration)}
        {lead && talk.publicationDate ? <span className="ml-3">{formatDate(talk.publicationDate)}</span> : null}
      </p>
    </article>
  );
}

export function TeacherTile({
  teacher,
  size = 96,
  className,
}: {
  teacher: { slug: string; name: string; profileImageUrl: string | null; talksCount?: number | null };
  size?: number;
  className?: string;
}) {
  return (
    <Link
      to={`/teachers/${teacher.slug}`}
      className={cn("group flex shrink-0 flex-col items-center text-center", className)}
      style={{ width: Math.max(size + 16, 112) }}
    >
      <Avatar
        src={teacher.profileImageUrl}
        name={teacher.name}
        size={size}
        className="transition-[scale] duration-300 ease-out group-hover:scale-[1.03]"
      />
      <span className="mt-3 line-clamp-2 font-serif text-[1rem] leading-snug group-hover:text-accent-ink">
        {teacher.name}
      </span>
      {teacher.talksCount != null ? (
        <span className="mt-0.5 text-xs tabular-nums text-ink-faint">{formatCount(Number(teacher.talksCount), "talk")}</span>
      ) : null}
    </Link>
  );
}

export function TeacherRow({
  teacher,
}: {
  teacher: {
    slug: string;
    name: string;
    profileImageUrl: string | null;
    description?: string | null;
    talksCount?: number | null;
    retreatsCount?: number | null;
  };
}) {
  return (
    <Link
      to={`/teachers/${teacher.slug}`}
      className="group -mx-3 flex items-center gap-4 rounded-xl px-3 py-3 transition-colors hover:bg-paper-sunken/70"
    >
      <Avatar src={teacher.profileImageUrl} name={teacher.name} size={56} />
      <span className="min-w-0 flex-1">
        <span className="block font-serif text-[1.1875rem] leading-snug">{teacher.name}</span>
        <span className="mt-0.5 block text-xs tabular-nums text-ink-faint">
          {teacher.talksCount != null ? formatCount(Number(teacher.talksCount), "talk") : null}
          {teacher.retreatsCount ? `, ${formatCount(Number(teacher.retreatsCount), "retreat")}` : null}
        </span>
        {teacher.description ? (
          <span className="mt-1 line-clamp-1 text-[0.8125rem] text-ink-soft">{teacher.description}</span>
        ) : null}
      </span>
    </Link>
  );
}

export type RetreatSummary = {
  slug: string;
  title: string;
  talksCount?: number | null;
  teachersCount?: number | null;
  firstDate?: number | string | Date | null;
  lastDate?: number | string | Date | null;
};

/**
 * A retreat as a ticket: a calendar stub with the first day, a perforation,
 * then the title and the full date range.
 */
export function RetreatTicket({
  retreat,
  lead = false,
  className,
}: {
  retreat: RetreatSummary;
  lead?: boolean;
  className?: string;
}) {
  const start = dateParts(retreat.firstDate);
  const range = formatDateRange(retreat.firstDate, retreat.lastDate);
  const meta = [
    retreat.talksCount != null ? formatCount(Number(retreat.talksCount), "talk") : null,
    retreat.teachersCount ? formatCount(Number(retreat.teachersCount), "teacher") : null,
  ].filter(Boolean);

  return (
    <Link
      to={`/retreats/${retreat.slug}`}
      className={cn(
        "group relative flex overflow-hidden rounded-xl bg-paper-raised ring-1 ring-inset ring-line transition-[translate,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-soft",
        lead ? "min-h-44 w-[22rem] sm:w-[26rem]" : "min-h-40 w-[18rem] sm:w-[20rem]",
        className,
      )}
    >
      <span
        className={cn(
          "flex shrink-0 flex-col items-center justify-center border-r border-dashed border-line-strong bg-accent-wash text-accent-ink",
          lead ? "w-24" : "w-20",
        )}
      >
        {start ? (
          <>
            <span className="text-xs">{start.month}</span>
            <span className={cn("font-serif leading-none tabular-nums text-ink", lead ? "text-[2.75rem]" : "text-[2.25rem]")}>
              {start.day}
            </span>
            <span className="mt-1 text-xs tabular-nums">{start.year}</span>
          </>
        ) : (
          <span className="text-xs">Retreat</span>
        )}
      </span>
      <span className="flex min-w-0 flex-1 flex-col justify-between gap-3 p-4">
        <span>
          {range ? <span className="block text-xs tabular-nums text-ink-soft">{range}</span> : null}
          <span
            className={cn(
              "mt-1.5 line-clamp-3 font-serif leading-snug tracking-[-0.005em] group-hover:text-accent-ink",
              lead ? "text-[1.375rem]" : "text-[1.125rem]",
            )}
          >
            {retreat.title}
          </span>
        </span>
        {meta.length ? <span className="text-xs tabular-nums text-ink-faint">{meta.join(", ")}</span> : null}
      </span>
    </Link>
  );
}

export type CenterSummary = {
  slug: string;
  name: string;
  talksCount?: number | null;
  teachersCount?: number | null;
  description?: string | null;
};

/** A center as a place: a pin, the name, and what was recorded there. */
export function CenterRow({ center, className }: { center: CenterSummary; className?: string }) {
  return (
    <Link
      to={`/centers/${center.slug}`}
      className={cn(
        "group -mx-3 flex items-center gap-3.5 rounded-xl px-3 py-3 transition-colors hover:bg-paper-sunken/70",
        className,
      )}
    >
      <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-paper-sunken text-ink-soft transition-colors group-hover:text-accent-ink">
        <MapPin size={18} strokeWidth={1.75} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-serif text-[1.125rem] leading-snug">{center.name}</span>
        <span className="block text-xs tabular-nums text-ink-faint">
          {[
            center.talksCount != null ? formatCount(Number(center.talksCount), "talk") : null,
            center.teachersCount ? formatCount(Number(center.teachersCount), "teacher") : null,
          ]
            .filter(Boolean)
            .join(", ")}
        </span>
        {center.description ? (
          <span className="mt-1 line-clamp-1 text-[0.8125rem] text-ink-soft">{center.description}</span>
        ) : null}
      </span>
    </Link>
  );
}
