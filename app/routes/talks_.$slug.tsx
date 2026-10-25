import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { useLoaderData, Link } from "react-router";
import { and, desc, eq, ne, sql } from "drizzle-orm";
import { ListPlus, Share } from "lucide-react";
import { db } from "~/db/client.server";
import { talks, teachers, retreats, centers } from "~/db/schema";
import { useAudio } from "~/contexts/audio-context";
import { useLibrary } from "~/contexts/library-context";
import { useUI } from "~/contexts/ui-context";
import { fromNestedRow, toPlayerTalk, type TalkListItem } from "~/lib/talk";
import { formatCount, formatDate, formatDuration, formatRemaining } from "~/lib/format";
import { LikeButton, SaveButton, TalkList } from "~/components/talk-row";
import { Avatar, Section, SectionLink, buttonClass } from "~/components/ui/primitives";
import { PlayGlyph } from "~/components/play-glyph";
import { cn } from "~/lib/cn";
import { cacheHeader } from "pretty-cache-header";
import { withCachedJson } from "~/lib/cache.server";

const cacheHeaders = {
  "Cache-Control": cacheHeader({
    maxAge: "3day",
    sMaxage: "1month",
    staleWhileRevalidate: "1year",
  }),
};

export const headers = () => cacheHeaders;

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  if (!data?.talk) {
    return [{ title: "Talk Not Found" }];
  }

  const { talk } = data;
  const teacherName = talk.teacher?.name;
  const title = `${talk.title}${teacherName ? ` — ${teacherName}` : ""} | Dharma Radio`;

  return [
    { title },
    {
      name: "description",
      content: talk.description || `Listen to ${talk.title} by ${teacherName}`,
    },
    { property: "og:title", content: title },
    {
      property: "og:description",
      content: talk.description || `Listen to ${talk.title} by ${teacherName}`,
    },
  ];
};

export async function loader({ params, context }: LoaderFunctionArgs) {
  const { slug } = params;

  if (!slug) {
    throw new Error("Talk slug is required");
  }

  return withCachedJson(
    context.cloudflare.env.DB_QUERY_CACHE,
    `talk:v2:${slug}`,
    900,
    async () => {
      const database = db(context.cloudflare.env.DB);

      // Get talk with basic relations
      const talk = await database.query.talks.findFirst({
        where: eq(talks.slug, slug),
      });

      if (!talk) {
        throw new Response("Not Found", { status: 404 });
      }

      // Get teacher with counts
      const teacherQuery = database
        .select({
          id: teachers.id,
          name: teachers.name,
          slug: teachers.slug,
          description: teachers.description,
          profileImageUrl: teachers.profileImageUrl,
          talksCount: sql<number>`count(distinct ${talks.id})`.as("talks_count"),
          retreatsCount:
            sql<number>`count(distinct case when ${talks.retreatId} is not null then ${talks.retreatId} end)`.as(
              "retreats_count",
            ),
          centersCount:
            sql<number>`count(distinct case when ${talks.centerId} is not null then ${talks.centerId} end)`.as(
              "centers_count",
            ),
        })
        .from(teachers)
        .leftJoin(talks, eq(talks.teacherId, teachers.id))
        .where(eq(teachers.id, talk.teacherId))
        .groupBy(teachers.id);

      // Get retreat with counts
      const retreatQuery = database
        .select({
          id: retreats.id,
          title: retreats.title,
          slug: retreats.slug,
          description: retreats.description,
          talksCount: sql<number>`count(distinct ${talks.id})`.as("talks_count"),
          teachersCount: sql<number>`count(distinct ${talks.teacherId})`.as(
            "teachers_count",
          ),
        })
        .from(retreats)
        .leftJoin(talks, eq(talks.retreatId, retreats.id))
        .where(talk.retreatId ? eq(retreats.id, talk.retreatId) : undefined)
        .groupBy(retreats.id);

      // Get center with counts
      const centerQuery = database
        .select({
          id: centers.id,
          name: centers.name,
          slug: centers.slug,
          description: centers.description,
          talksCount: sql<number>`count(distinct ${talks.id})`.as("talks_count"),
          teachersCount: sql<number>`count(distinct ${talks.teacherId})`.as(
            "teachers_count",
          ),
          retreatsCount: sql<number>`count(distinct ${talks.retreatId})`.as(
            "retreats_count",
          ),
        })
        .from(centers)
        .leftJoin(talks, eq(talks.centerId, centers.id))
        .where(talk.centerId ? eq(centers.id, talk.centerId) : undefined)
        .groupBy(centers.id);

      const relatedSelect = {
        id: talks.id,
        title: talks.title,
        slug: talks.slug,
        duration: talks.duration,
        audioUrl: talks.audioUrl,
        publicationDate: talks.publicationDate,
        teacher: {
          name: teachers.name,
          slug: teachers.slug,
          profileImageUrl: teachers.profileImageUrl,
        },
        center: { name: centers.name, slug: centers.slug },
        retreat: { title: retreats.title, slug: retreats.slug },
      };

      const relatedQuery = (where: ReturnType<typeof eq>) =>
        database
          .select(relatedSelect)
          .from(talks)
          .leftJoin(teachers, eq(talks.teacherId, teachers.id))
          .leftJoin(centers, eq(talks.centerId, centers.id))
          .leftJoin(retreats, eq(talks.retreatId, retreats.id))
          .where(and(where, ne(talks.id, talk.id)))
          .orderBy(desc(talks.publicationDate))
          .limit(6);

      const [[teacher], [retreat], [center], fromRetreat, fromTeacher] =
        await Promise.all([
          teacherQuery,
          talk.retreatId ? retreatQuery : Promise.resolve([]),
          talk.centerId ? centerQuery : Promise.resolve([]),
          talk.retreatId
            ? relatedQuery(eq(talks.retreatId, talk.retreatId))
            : Promise.resolve([]),
          relatedQuery(eq(talks.teacherId, talk.teacherId)),
        ]);

      return {
        talk: {
          ...talk,
          teacher,
          retreat,
          center,
        },
        fromRetreat,
        fromTeacher,
      };
    },
  );
}

export default function TalkDetail() {
  const { talk, fromRetreat, fromTeacher } = useLoaderData<typeof loader>();
  const audio = useAudio();
  const library = useLibrary();
  const ui = useUI();

  const item: TalkListItem = {
    id: talk.id,
    slug: talk.slug,
    title: talk.title,
    duration: talk.duration,
    audioUrl: talk.audioUrl,
    publicationDate: talk.publicationDate,
    teacher: talk.teacher
      ? { name: talk.teacher.name, slug: talk.teacher.slug, profileImageUrl: talk.teacher.profileImageUrl }
      : null,
    center: talk.center ? { name: talk.center.name, slug: talk.center.slug } : null,
    retreat: talk.retreat ? { title: talk.retreat.title, slug: talk.retreat.slug } : null,
  };
  const retreatTalks = fromRetreat.map(fromNestedRow);
  const teacherTalks = fromTeacher.map(fromNestedRow);

  const isCurrent = audio.currentTalk?.id === talk.id;
  const playing = isCurrent && audio.isPlaying;
  const progress = library.progress.get(talk.id);
  const resumable = progress && !progress.completed && progress.positionSec > 30;

  const play = () => {
    if (isCurrent) return audio.togglePlay();
    // Queue continues with the rest of the retreat, else more from the teacher.
    const next = retreatTalks.length ? retreatTalks : teacherTalks;
    audio.playNow(toPlayerTalk(item), [item, ...next].map(toPlayerTalk));
  };

  const share = async () => {
    const url = window.location.href;
    if (navigator.share) await navigator.share({ title: talk.title, url }).catch(() => {});
    else {
      await navigator.clipboard.writeText(url);
      ui.toast("Link copied");
    }
  };

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "PodcastEpisode",
    name: talk.title,
    description: talk.description ?? undefined,
    datePublished: new Date(talk.publicationDate).toISOString(),
    timeRequired: `PT${Math.round(talk.duration / 60)}M`,
    associatedMedia: { "@type": "MediaObject", contentUrl: talk.audioUrl },
    author: talk.teacher ? { "@type": "Person", name: talk.teacher.name } : undefined,
  };

  return (
    <article className="animate-rise">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <header className="relative -mx-5 overflow-hidden px-5 pb-8 pt-8 sm:-mx-8 sm:px-8 md:pt-14 lg:-mx-12 lg:px-12">
        <div aria-hidden className="dusk-glow absolute inset-0" />
        <div className="relative">
          <nav aria-label="Breadcrumb" className="mb-5 flex flex-wrap items-center gap-x-2 text-sm text-ink-faint">
            <Link to="/talks" className="hover:text-ink">Talks</Link>
            {talk.retreat ? (
              <>
                <span aria-hidden>/</span>
                <Link to={`/retreats/${talk.retreat.slug}`} className="line-clamp-1 italic hover:text-ink">
                  {talk.retreat.title}
                </Link>
              </>
            ) : null}
          </nav>

          <h1 className="max-w-3xl text-balance font-serif text-4xl leading-[1.05] tracking-tight md:text-6xl">
            {talk.title}
          </h1>

          {talk.teacher ? (
            <Link to={`/teachers/${talk.teacher.slug}`} className="group mt-6 inline-flex items-center gap-3">
              <Avatar src={talk.teacher.profileImageUrl} name={talk.teacher.name} size={44} />
              <span>
                <span className="block font-medium group-hover:underline decoration-line-strong underline-offset-4">
                  {talk.teacher.name}
                </span>
                <span className="block text-sm text-ink-faint">
                  {formatDate(talk.publicationDate)}
                  {talk.center ? ` · ${talk.center.name}` : ""}
                </span>
              </span>
            </Link>
          ) : null}

          <div className="mt-8 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={play}
              className={cn(buttonClass("primary"), "h-14 gap-3 pl-2 pr-6 text-base")}
            >
              <span className="flex size-10 items-center justify-center rounded-full bg-accent text-on-accent">
                <PlayGlyph playing={playing} size={16} />
              </span>
              {playing
                ? "Pause"
                : isCurrent
                  ? "Resume"
                  : resumable
                    ? `Resume · ${formatRemaining(progress.positionSec, talk.duration)}`
                    : `Play · ${formatDuration(talk.duration)}`}
            </button>
            <SaveButton talkId={talk.id} className="size-12 border border-line" />
            <LikeButton talkId={talk.id} className="size-12 border border-line" />
            <button
              type="button"
              onClick={() => (library.user ? ui.openAddToPlaylist(item) : library.requestSignIn())}
              aria-label="Add to playlist"
              className="inline-flex size-12 items-center justify-center rounded-full border border-line text-ink-faint hover:bg-paper-sunken hover:text-ink"
            >
              <ListPlus size={18} />
            </button>
            <button
              type="button"
              onClick={() => void share()}
              aria-label="Share"
              className="inline-flex size-12 items-center justify-center rounded-full border border-line text-ink-faint hover:bg-paper-sunken hover:text-ink"
            >
              <Share size={18} />
            </button>
          </div>
        </div>
      </header>

      {talk.description ? (
        <section className="max-w-2xl border-t border-line py-8">
          <p className="whitespace-pre-line text-pretty font-serif text-lg leading-relaxed text-ink-soft md:text-xl">
            {talk.description}
          </p>
        </section>
      ) : null}

      {talk.retreat && retreatTalks.length ? (
        <Section
          title={<>From <em>{talk.retreat.title}</em></>}
          action={<SectionLink to={`/retreats/${talk.retreat.slug}`}>{formatCount(Number(talk.retreat.talksCount), "talk")}</SectionLink>}
        >
          <TalkList talks={retreatTalks} />
        </Section>
      ) : null}

      {talk.teacher && teacherTalks.length ? (
        <Section
          title={`More from ${talk.teacher.name}`}
          action={<SectionLink to={`/teachers/${talk.teacher.slug}`}>{formatCount(Number(talk.teacher.talksCount), "talk")}</SectionLink>}
        >
          <TalkList talks={teacherTalks} showTeacher={false} />
        </Section>
      ) : null}

      {talk.center ? (
        <section className="border-t border-line py-8">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-ink-faint">Recorded at</p>
          <Link to={`/centers/${talk.center.slug}`} className="mt-2 inline-block font-serif text-2xl hover:underline decoration-line-strong underline-offset-4">
            {talk.center.name}
          </Link>
          <p className="mt-1 text-sm text-ink-faint">
            {formatCount(Number(talk.center.talksCount), "talk")} · {formatCount(Number(talk.center.teachersCount), "teacher")}
          </p>
        </section>
      ) : null}
    </article>
  );
}
