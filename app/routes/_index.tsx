import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { Link, useLoaderData } from "react-router";
import { cacheHeader } from "pretty-cache-header";
import { count, desc, eq, sql } from "drizzle-orm";
import { useEffect, useState } from "react";
import { db } from "~/db/client.server";
import { centers, retreats, talks, teachers } from "~/db/schema";
import { withCachedJson } from "~/lib/cache.server";
import { useAudio } from "~/contexts/audio-context";
import { useLibrary } from "~/contexts/library-context";
import { useLibraryTalks } from "~/hooks/use-library-talks";
import { fromNestedRow, type TalkListItem } from "~/lib/talk";
import { formatCount, formatRemaining } from "~/lib/format";
import { TalkList } from "~/components/talk-row";
import { CollectionCard, TeacherTile } from "~/components/collection-cards";
import { SearchField, Section, SectionLink } from "~/components/ui/primitives";
import { PlayGlyph } from "~/components/play-glyph";

export const meta: MetaFunction = () => [
  { title: "Dharma Radio — Dharma talks to listen to, anywhere" },
  {
    name: "description",
    content:
      "A calm listening app for tens of thousands of dharma talks from teachers, retreats and meditation centers around the world.",
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
  const env = context.cloudflare.env;
  return withCachedJson(env.DB_QUERY_CACHE, "home:v2", 3600, async () => {
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
        .limit(8),
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
          description: retreats.description,
          talksCount: sql<number>`count(${talks.id})`.as("talks_count"),
          latest: sql<number>`max(${talks.publicationDate})`.as("latest"),
        })
        .from(retreats)
        .innerJoin(talks, eq(talks.retreatId, retreats.id))
        .groupBy(retreats.id)
        .orderBy(sql`latest desc`)
        .limit(4),
    ]);

    return {
      stats: {
        talks: talkStats?.count ?? 0,
        teachers: teacherStats?.count ?? 0,
        retreats: retreatStats?.count ?? 0,
        centers: centerStats?.count ?? 0,
      },
      recent: recent.map(fromNestedRow),
      topTeachers,
      recentRetreats,
    };
  });
}

export default function Home() {
  const { stats, recent, topTeachers, recentRetreats } = useLoaderData<typeof loader>();

  return (
    <div className="animate-rise">
      <header className="relative -mx-5 overflow-hidden px-5 pb-10 pt-10 sm:-mx-8 sm:px-8 md:pt-16 lg:-mx-12 lg:px-12">
        <div aria-hidden className="dusk-glow absolute inset-0" />
        <div className="relative">
          <Greeting />
          <h1 className="mt-3 max-w-3xl text-balance font-serif text-[2.6rem] leading-[1.02] tracking-tight md:text-7xl">
            Sit down. <em className="text-accent-ink">Listen in.</em>
          </h1>
          <p className="mt-4 max-w-xl text-pretty text-ink-soft md:text-lg">
            {formatCount(stats.talks, "talk")} from {formatCount(stats.teachers, "teacher")}, gathered from
            retreats and sanghas around the world.
          </p>
          <SearchField action="/talks" placeholder="Search talks or teachers" className="mt-7 max-w-xl" />
        </div>
      </header>

      <ContinueListening />

      <Section title="Newest talks" action={<SectionLink to="/talks">All talks</SectionLink>}>
        <TalkList talks={recent} />
      </Section>

      <Section title="Teachers" action={<SectionLink to="/teachers">All teachers</SectionLink>}>
        <div className="-mx-5 flex gap-4 overflow-x-auto px-5 pb-2 scrollbar-none sm:-mx-8 sm:px-8 lg:-mx-12 lg:px-12">
          {topTeachers.map((teacher) => (
            <TeacherTile key={teacher.slug} teacher={teacher} />
          ))}
        </div>
      </Section>

      <Section title="Recent retreats" action={<SectionLink to="/retreats">All retreats</SectionLink>}>
        <div className="grid gap-3 sm:grid-cols-2">
          {recentRetreats.map((retreat) => (
            <CollectionCard
              key={retreat.slug}
              to={`/retreats/${retreat.slug}`}
              title={retreat.title}
              description={retreat.description}
              meta={formatCount(retreat.talksCount, "talk")}
              italic
            />
          ))}
        </div>
      </Section>

      <Section title="Explore">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            { to: "/talks", label: "Talks", n: stats.talks },
            { to: "/teachers", label: "Teachers", n: stats.teachers },
            { to: "/retreats", label: "Retreats", n: stats.retreats },
            { to: "/centers", label: "Centers", n: stats.centers },
          ].map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="rounded-3xl border border-line p-5 transition-colors hover:bg-paper-raised"
            >
              <span className="block font-serif text-3xl tabular-nums tracking-tight">
                {item.n.toLocaleString("en-US")}
              </span>
              <span className="mt-1 block text-sm text-ink-soft">{item.label}</span>
            </Link>
          ))}
        </div>
      </Section>
    </div>
  );
}

function Greeting() {
  // Pages are edge-cached for everyone, so the time of day is resolved on the client.
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    const hour = new Date().getHours();
    setText(
      hour < 5 ? "Late night" : hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening",
    );
  }, []);
  return (
    <p className="h-4 text-xs font-medium uppercase tracking-[0.16em] text-accent-ink">{text}</p>
  );
}

function ContinueListening() {
  const library = useLibrary();
  const audio = useAudio();
  const state = useLibraryTalks("in-progress");

  if (library.user) {
    if (state.status !== "ready" || state.talks.length === 0) return null;
    const talks: TalkListItem[] = state.talks.slice(0, 4);
    return (
      <Section
        title="Continue listening"
        action={<SectionLink to="/library/in-progress">See all</SectionLink>}
      >
        <TalkList talks={talks} />
      </Section>
    );
  }

  // Signed out: the restored player talk is the only thing we know about.
  const talk = audio.currentTalk;
  if (!talk || audio.isPlaying || audio.currentTime < 30) return null;
  return (
    <Section title="Pick up where you left off">
      <button
        type="button"
        onClick={audio.togglePlay}
        className="flex w-full items-center gap-4 rounded-3xl border border-line bg-paper-raised p-4 text-left shadow-soft transition-transform active:scale-[0.99]"
      >
        <span className="flex size-12 items-center justify-center rounded-full bg-accent text-on-accent">
          <PlayGlyph playing={false} size={18} />
        </span>
        <span className="min-w-0">
          <span className="block truncate font-serif text-lg">{talk.title}</span>
          <span className="block text-sm text-ink-faint">
            {talk.teacher} · {formatRemaining(audio.currentTime, audio.duration || talk.duration)}
          </span>
        </span>
      </button>
    </Section>
  );
}
