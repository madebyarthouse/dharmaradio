import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { Link, useLoaderData } from "react-router";
import { cacheHeader } from "pretty-cache-header";
import { getHome } from "~/lib/home.server";
import { useLibrary } from "~/contexts/library-context";
import { useLibraryTalks } from "~/hooks/use-library-talks";
import { Shelf, SectionLink, buttonClass, titleClass } from "~/components/ui/primitives";
import { CenterRow, RetreatTicket, TalkTile, TeacherTile } from "~/components/collection-cards";
import { TalkList } from "~/components/talk-row";
import { SitGlyph } from "~/components/shell";
import { cn } from "~/lib/cn";

export const meta: MetaFunction = () => [
  { title: "Dharma Radio: free dharma talks and a meditation timer" },
  {
    name: "description",
    content:
      "Listen to thousands of free dharma talks and guided meditations from dharmaseed.org, and sit with a simple meditation timer.",
  },
];

export const headers = () => ({
  "Cache-Control": cacheHeader({
    maxAge: "15min",
    sMaxage: "3hours",
    staleWhileRevalidate: "1day",
  }),
});

export async function loader({ context }: LoaderFunctionArgs) {
  return getHome(context.cloudflare.env);
}

function chunk<T>(items: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export default function Home() {
  const { stats, latest, retreats, teachers, centers } = useLoaderData<typeof loader>();
  const [leadTeacher, ...otherTeachers] = teachers;

  return (
    <div className="animate-rise">
      <section className="pb-4 pt-8 md:pb-6 md:pt-16">
        <h1 className={cn(titleClass, "max-w-[18ch] md:text-[4rem]")}>Dharma talks to listen to, and a timer to sit with.</h1>
        <p className="mt-5 max-w-[62ch] text-pretty text-sm leading-relaxed text-ink-soft md:text-[0.9375rem]">
          Dharma Radio is a quiet way into the free archive of{" "}
          <a href="https://dharmaseed.org" target="_blank" rel="noreferrer" className="text-ink underline decoration-line-strong underline-offset-4 hover:decoration-accent">
            dharmaseed.org
          </a>
          : {stats.talks.toLocaleString("en-US")} talks and guided meditations from {stats.teachers.toLocaleString("en-US")}{" "}
          teachers, recorded on retreats and in meditation halls. Beside it, a simple meditation timer with bells.
        </p>
        <div className="mt-7 flex flex-wrap items-center gap-2.5">
          <Link to="/sit" className={cn(buttonClass("primary"), "h-12 pl-4 pr-6 text-[0.875rem]")}>
            <SitGlyph size={20} strokeWidth={1.75} className="text-accent" />
            Sit now
          </Link>
          <AccountCta />
        </div>
      </section>

      <Shelf title="Latest talks" label="Latest talks" action={<SectionLink to="/talks">See all</SectionLink>}>
        {latest.map((talk, i) => (
          <TalkTile key={talk.id} talk={talk} context={latest} lead={i === 0} />
        ))}
      </Shelf>

      <Shelf title="Recent retreats" label="Recent retreats" action={<SectionLink to="/retreats">See all</SectionLink>}>
        {retreats.map((retreat, i) => (
          <RetreatTicket key={retreat.slug} retreat={retreat} lead={i === 0} />
        ))}
      </Shelf>

      {leadTeacher ? (
        <Shelf
          title="Teachers"
          label="Teachers, a different handful each day"
          action={<SectionLink to="/teachers">See all</SectionLink>}
          listClassName="gap-2"
        >
          <TeacherTile teacher={leadTeacher} size={176} className="pr-4 pt-6" />
          {chunk(otherTeachers, 2).map((pair) => (
            <div key={pair[0].slug} className="grid grid-rows-[10rem_10rem] gap-1">
              {pair.map((teacher) => (
                <TeacherTile key={teacher.slug} teacher={teacher} size={80} />
              ))}
            </div>
          ))}
        </Shelf>
      ) : null}

      {centers.length ? (
        <Shelf title="Centers" label="Meditation centers" action={<SectionLink to="/centers">See all</SectionLink>} listClassName="gap-8">
          {chunk(centers, 3).map((column) => (
            <div key={column[0].slug} className="flex w-72 flex-col">
              {column.map((center) => (
                <CenterRow key={center.slug} center={center} />
              ))}
            </div>
          ))}
        </Shelf>
      ) : null}

      <ContinueListening />
    </div>
  );
}

/** Signed out: an invitation to keep a library. Signed in: the way to it. Space is held either way. */
function AccountCta() {
  const library = useLibrary();
  const loading = library.status === "loading";
  return library.user ? (
    <Link to="/practice" className={cn(buttonClass("secondary"), "h-12 px-6 text-[0.875rem]")}>
      Your practice
    </Link>
  ) : (
    <Link
      to="/sign-in?next=/practice"
      className={cn(buttonClass("secondary"), "h-12 px-6 text-[0.875rem] transition-opacity", loading && "opacity-0")}
      tabIndex={loading ? -1 : undefined}
    >
      Create an account or sign in
    </Link>
  );
}

function ContinueListening() {
  const library = useLibrary();
  const state = useLibraryTalks("in-progress");
  if (!library.user || state.status !== "ready" || state.talks.length === 0) return null;
  return (
    <section className="animate-fade py-6 md:py-8">
      <div className="mb-3 flex items-baseline justify-between gap-4">
        <h2 className="font-serif text-[1.5rem] leading-tight tracking-[-0.01em] md:text-[1.75rem]">Continue listening</h2>
        <SectionLink to="/library/in-progress">See all</SectionLink>
      </div>
      <TalkList talks={state.talks.slice(0, 3)} />
    </section>
  );
}
