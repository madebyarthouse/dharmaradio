import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { Link, useLoaderData } from "react-router";
import { cacheHeader } from "pretty-cache-header";
import { count, desc, eq, sql } from "drizzle-orm";
import { db } from "~/db/client.server";
import { centers, retreats, talks, teachers } from "~/db/schema";
import { withCachedJson } from "~/lib/cache.server";
import { GUIDED_LENGTHS } from "~/lib/guided";
import { fromNestedRow } from "~/lib/talk";
import { varied } from "~/lib/home";
import { formatCount } from "~/lib/format";
import { ArrowRight } from "lucide-react";
import { RetreatTicket, TalkTile, TeacherTile } from "~/components/collection-cards";
import { PageHeader, SearchField, Section, SectionLink, Shelf } from "~/components/ui/primitives";
import { cn } from "~/lib/cn";

export const meta: MetaFunction = () => [
  { title: "Listen: dharma talks and guided meditations, Dharma Radio" },
  {
    name: "description",
    content:
      "Guided meditations by length, and dharma talks from teachers, retreats and meditation centers around the world.",
  },
];

export const headers = () => ({
  "Cache-Control": cacheHeader({ maxAge: "15min", sMaxage: "3hours", staleWhileRevalidate: "1day" }),
});

export async function loader({ context }: LoaderFunctionArgs) {
  const env = context.cloudflare.env;
  return withCachedJson(env.DB_QUERY_CACHE, "listen:v2", 3600, async () => {
    const database = db(env.DB);
    const [[talkStats], [teacherStats], [retreatStats], [centerStats]] = await Promise.all([
      database.select({ count: count() }).from(talks),
      database.select({ count: count() }).from(teachers),
      database.select({ count: count() }).from(retreats),
      database.select({ count: count() }).from(centers),
    ]);

    const [recent, topTeachers, recentRetreats] = await Promise.all([
      database
        .select({
          id: talks.id,
          title: talks.title,
          slug: talks.slug,
          duration: talks.duration,
          audioUrl: talks.audioUrl,
          publicationDate: talks.publicationDate,
          teacher: { name: teachers.name, slug: teachers.slug, profileImageUrl: teachers.profileImageUrl },
          center: { name: centers.name, slug: centers.slug },
          retreat: { title: retreats.title, slug: retreats.slug },
        })
        .from(talks)
        .leftJoin(teachers, eq(talks.teacherId, teachers.id))
        .leftJoin(centers, eq(talks.centerId, centers.id))
        .leftJoin(retreats, eq(talks.retreatId, retreats.id))
        .orderBy(desc(talks.publicationDate))
        .limit(48),
      database
        .select({
          slug: teachers.slug,
          name: teachers.name,
          profileImageUrl: teachers.profileImageUrl,
          talksCount: sql<number>`count(${talks.id})`.as("talks_count"),
        })
        .from(teachers)
        .innerJoin(talks, eq(talks.teacherId, teachers.id))
        .groupBy(teachers.id)
        .orderBy(sql`talks_count desc`)
        .limit(14),
      database
        .select({
          slug: retreats.slug,
          title: retreats.title,
          talksCount: sql<number>`count(${talks.id})`.as("talks_count"),
          teachersCount: sql<number>`count(distinct ${talks.teacherId})`.as("teachers_count"),
          // Stored in seconds; cards take milliseconds.
          firstDate: sql<number>`min(${talks.publicationDate}) * 1000`.as("first_date"),
          latest: sql<number>`max(${talks.publicationDate}) * 1000`.as("latest"),
        })
        .from(retreats)
        .innerJoin(talks, eq(talks.retreatId, retreats.id))
        .groupBy(retreats.id)
        .orderBy(sql`latest desc`)
        .limit(8),
    ]);

    return {
      stats: {
        talks: talkStats?.count ?? 0,
        teachers: teacherStats?.count ?? 0,
        retreats: retreatStats?.count ?? 0,
        centers: centerStats?.count ?? 0,
      },
      recent: varied(recent.map(fromNestedRow), 10),
      topTeachers,
      recentRetreats,
    };
  });
}

/** Topics that hold hundreds of talks each in the archive; each opens a search. */
const INTENTIONS = [
  { label: "Loving-kindness", q: "metta" },
  { label: "Breath", q: "breath" },
  { label: "Compassion", q: "compassion" },
  { label: "Equanimity", q: "equanimity" },
  { label: "The body", q: "body" },
  { label: "Joy", q: "joy" },
  { label: "Forgiveness", q: "forgiveness" },
  { label: "Death and dying", q: "death" },
];

export default function Listen() {
  const { stats, recent, topTeachers, recentRetreats } = useLoaderData<typeof loader>();

  const ways = [
    { to: "/teachers", label: "Teachers", n: stats.teachers },
    { to: "/retreats", label: "Retreats", n: stats.retreats },
    { to: "/centers", label: "Centers", n: stats.centers },
    { to: "/talks", label: "Every talk", n: stats.talks },
  ];

  return (
    <div className="animate-rise">
      <PageHeader
        title="Listen"
        description={`${formatCount(stats.talks, "talk")} from ${formatCount(stats.teachers, "teacher")}, recorded on retreats and in meditation halls.`}
      >
        <SearchField action="/talks" placeholder="Search talks or teachers" className="max-w-xl" />
      </PageHeader>

      <Section title="Guided meditations" action={<SectionLink to="/talks?kind=guided">All guided</SectionLink>}>
        <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
          {GUIDED_LENGTHS.map((length, i) => (
            <li key={length.key} className="stagger" style={{ "--i": i } as React.CSSProperties}>
              <Link
                to={`/talks?kind=guided&length=${length.key}`}
                className="press group flex h-full flex-col justify-between gap-6 rounded-xl bg-paper-raised p-4 ring-1 ring-inset ring-line hover:bg-paper-sunken"
              >
                <span>
                  <span className="block font-serif text-[2.25rem] leading-none tracking-[-0.02em] tabular-nums group-hover:text-accent-ink">
                    {length.key === "60" ? "60+" : length.key}
                  </span>
                  <span className="mt-1.5 block text-xs text-ink-faint">
                    {length.key === "60" ? "An hour or more" : `About ${length.key} minutes`}
                  </span>
                </span>
                {/* The bar is the length, drawn to scale against an hour. */}
                <span aria-hidden className="block h-[3px] w-full overflow-hidden rounded-full bg-line">
                  <span className="block h-full rounded-full bg-accent" style={{ width: `${(Math.min(60, Number(length.key)) / 60) * 100}%` }} />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Section>

      <Shelf title="Newest talks" label="Newest talks" action={<SectionLink to="/talks">All talks</SectionLink>}>
        {recent.map((talk, i) => (
          <TalkTile key={talk.id} talk={talk} context={recent} lead={i === 0} />
        ))}
      </Shelf>

      <Shelf title="Teachers" label="Teachers with the most talks" action={<SectionLink to="/teachers">All teachers</SectionLink>}>
        {topTeachers.map((teacher) => (
          <TeacherTile key={teacher.slug} teacher={teacher} />
        ))}
      </Shelf>

      <Shelf title="Recent retreats" label="Recent retreats" action={<SectionLink to="/retreats">All retreats</SectionLink>}>
        {recentRetreats.map((retreat, i) => (
          <RetreatTicket key={retreat.slug} retreat={{ ...retreat, lastDate: retreat.latest }} lead={i === 0} />
        ))}
      </Shelf>

      <Section title="Listen by intention">
        <ul className="grid grid-cols-1 border-t border-line sm:grid-cols-2 sm:gap-x-8 lg:grid-cols-4">
          {INTENTIONS.map((topic) => (
            <li key={topic.q} className="border-b border-line">
              <Link
                to={`/talks?q=${encodeURIComponent(topic.q)}`}
                className="group flex h-14 items-center justify-between font-serif text-[1.25rem] tracking-[-0.01em] transition-colors hover:text-accent-ink"
              >
                {topic.label}
                <ArrowRight
                  size={16}
                  className="text-ink-faint opacity-0 transition-[opacity,translate] duration-200 ease-out group-hover:translate-x-0.5 group-hover:opacity-100"
                />
              </Link>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Find your way in">
        <div className="grid grid-cols-2 border-t border-line md:grid-cols-4">
          {ways.map((way, i) => (
            <Link
              key={way.to}
              to={way.to}
              className={cn(
                "flex flex-col-reverse py-5 transition-colors hover:text-accent-ink",
                i % 2 === 1 && "border-l border-line pl-5",
                i >= 2 && "border-t border-line md:border-t-0",
                i === 2 && "md:border-l md:pl-5",
              )}
            >
              <span className="mt-1 text-xs text-ink-faint">{way.label}</span>
              <span className="font-serif text-[2.25rem] leading-none tracking-[-0.02em] tabular-nums">
                {way.n.toLocaleString("en-US")}
              </span>
            </Link>
          ))}
        </div>
      </Section>
    </div>
  );
}
