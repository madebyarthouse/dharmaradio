import { Link } from "react-router";
import { Avatar } from "~/components/ui/primitives";
import { formatCount } from "~/lib/format";
import { cn } from "~/lib/cn";

export function TeacherTile({
  teacher,
  className,
}: {
  teacher: { slug: string; name: string; profileImageUrl: string | null; talksCount?: number | null };
  className?: string;
}) {
  return (
    <Link
      to={`/teachers/${teacher.slug}`}
      className={cn("group flex w-28 shrink-0 flex-col items-center text-center sm:w-32", className)}
    >
      <Avatar
        src={teacher.profileImageUrl}
        name={teacher.name}
        size={96}
        className="transition-transform duration-300 ease-calm group-hover:scale-[1.03]"
      />
      <span className="mt-3 line-clamp-2 text-sm leading-snug">{teacher.name}</span>
      {teacher.talksCount != null ? (
        <span className="mt-0.5 text-xs text-ink-faint">{formatCount(teacher.talksCount, "talk")}</span>
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
      className="group -mx-3 flex items-center gap-4 rounded-2xl px-3 py-3 transition-colors hover:bg-paper-sunken/70"
    >
      <Avatar src={teacher.profileImageUrl} name={teacher.name} size={56} />
      <span className="min-w-0 flex-1">
        <span className="block font-serif text-lg leading-snug">{teacher.name}</span>
        <span className="mt-0.5 block text-[0.8125rem] text-ink-faint">
          {teacher.talksCount != null ? formatCount(teacher.talksCount, "talk") : null}
          {teacher.retreatsCount ? ` · ${formatCount(teacher.retreatsCount, "retreat")}` : null}
        </span>
        {teacher.description ? (
          <span className="mt-1 line-clamp-1 text-sm text-ink-soft">{teacher.description}</span>
        ) : null}
      </span>
    </Link>
  );
}

/** Retreats and centers have no imagery, so they get a typographic card with a dusk wash. */
export function CollectionCard({
  to,
  title,
  description,
  meta,
  italic,
}: {
  to: string;
  title: string;
  description?: string | null;
  meta: string;
  italic?: boolean;
}) {
  return (
    <Link
      to={to}
      className="group relative flex min-h-36 flex-col justify-between overflow-hidden rounded-3xl border border-line bg-paper-raised p-5 transition-[transform,box-shadow] duration-300 ease-calm hover:-translate-y-0.5 hover:shadow-soft"
    >
      <span
        aria-hidden
        className="pointer-events-none absolute -right-10 -top-10 size-36 rounded-full bg-accent-wash opacity-50 transition-opacity group-hover:opacity-90"
      />
      <span className="relative">
        <span className={cn("line-clamp-3 font-serif text-xl leading-snug tracking-tight", italic && "italic")}>
          {title}
        </span>
        {description ? (
          <span className="mt-2 line-clamp-2 text-sm text-ink-soft">{description}</span>
        ) : null}
      </span>
      <span className="relative mt-4 text-xs text-ink-faint">{meta}</span>
    </Link>
  );
}
