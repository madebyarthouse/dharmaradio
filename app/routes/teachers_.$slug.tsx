import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { Link, useLoaderData, useSearchParams } from "react-router";
import { ExternalLink, HandHeart } from "lucide-react";
import { useState } from "react";
import { useAudio } from "~/contexts/audio-context";
import { fromFlatRow, toPlayerTalk } from "~/lib/talk";
import { formatCount } from "~/lib/format";
import { TalkList } from "~/components/talk-row";
import { CollectionCard } from "~/components/collection-cards";
import { Avatar, Pagination, Section, SortTabs, buttonClass } from "~/components/ui/primitives";
import { PlayGlyph } from "~/components/play-glyph";
import { cn } from "~/lib/cn";
import { eq, sql } from "drizzle-orm";
import { db } from "~/db/client.server";
import { teachers, talks, centers, retreats } from "~/db/schema";
import { totalCountField, withPagination } from "~/utils/pagination.server";
import { getRequestParams } from "~/utils/request-params";
import { withOrdering } from "~/utils/with-ordering";
import { cacheHeader } from "pretty-cache-header";
import { withCachedJson } from "~/lib/cache.server";

const cacheHeaders = {
  "Cache-Control": cacheHeader({
    maxAge: "1day",
    sMaxage: "7days",
    staleWhileRevalidate: "1month",
  }),
};

export const headers = () => cacheHeaders;

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  if (!data?.teacher) {
    return [{ title: "Teacher Not Found" }];
  }

  const { teacher } = data;
  return [
    { title: `${teacher.name} — Dharma talks | Dharma Radio` },
    { name: "description", content: teacher.description },
    {
      property: "og:title",
      content: `${teacher.name} — Dharma talks | Dharma Radio`,
    },
    { property: "og:description", content: teacher.description },
  ];
};

export async function loader({ params, request, context }: LoaderFunctionArgs) {
  const { slug } = params;

  if (!slug) {
    throw new Error("Teacher slug is required");
  }

  return withCachedJson(
    context.cloudflare.env.DB_QUERY_CACHE,
    `teacher:${slug}:${request.url}`,
    900,
    async () => {
      const { page, sort } = getRequestParams(request, {
        field: "date",
        order: "desc",
      });

      const database = db(context.cloudflare.env.DB);

      const teacherQuery = database
        .select({
          id: teachers.id,
          name: teachers.name,
          slug: teachers.slug,
          description: teachers.description,
          profileImageUrl: teachers.profileImageUrl,
          websiteUrl: teachers.websiteUrl,
          donationUrl: teachers.donationUrl,
          talksCount: sql<number>`count(distinct ${talks.id})`.as("talks_count"),
          retreatsCount: sql<number>`count(distinct ${talks.retreatId})`.as(
            "retreats_count",
          ),
          centersCount: sql<number>`count(distinct ${talks.centerId})`.as(
            "centers_count",
          ),
        })
        .from(teachers)
        .leftJoin(talks, eq(talks.teacherId, teachers.id))
        .where(eq(teachers.slug, slug))
        .groupBy(teachers.id);

      const [teacher] = await teacherQuery.execute();

      if (!teacher) {
        throw new Response("Not Found", { status: 404 });
      }

      const talksQuery = database
        .select({
          id: talks.id,
          slug: talks.slug,
          title: talks.title,
          duration: talks.duration,
          audioUrl: talks.audioUrl,
          publicationDate: talks.publicationDate,
          centerName: centers.name,
          centerSlug: centers.slug,
          retreatTitle: retreats.title,
          retreatSlug: retreats.slug,
          ...totalCountField,
        })
        .from(talks)
        .leftJoin(centers, eq(talks.centerId, centers.id))
        .leftJoin(retreats, eq(talks.retreatId, retreats.id))
        .where(eq(talks.teacherId, teacher.id))
        .orderBy(
          withOrdering({
            field: sort.field,
            order: sort.order,
            config: {
              title: { column: talks.title },
              duration: { column: talks.duration },
              date: { column: talks.publicationDate },
            },
          }),
        );

      const retreatsQuery = database
        .select({
          id: retreats.id,
          title: retreats.title,
          slug: retreats.slug,
          description: retreats.description,
          talksCount: sql<number>`count(distinct ${talks.id})`.as("talks_count"),
        })
        .from(retreats)
        .innerJoin(talks, eq(talks.retreatId, retreats.id))
        .where(eq(talks.teacherId, teacher.id))
        .groupBy(retreats.id);

      const centersQuery = database
        .select({
          id: centers.id,
          name: centers.name,
          slug: centers.slug,
          description: centers.description,
          talksCount: sql<number>`count(distinct ${talks.id})`.as("talks_count"),
        })
        .from(centers)
        .innerJoin(talks, eq(talks.centerId, centers.id))
        .where(eq(talks.teacherId, teacher.id))
        .groupBy(centers.id);

      const [paginatedTalks, retreatsData, centersData] = await Promise.all([
        withPagination({
          query: talksQuery.$dynamic(),
          params: { page, perPage: 50 },
        }),
        retreatsQuery,
        centersQuery,
      ]);

      return {
        teacher,
        ...paginatedTalks,
        retreats: retreatsData,
        centers: centersData,
      };
    },
  );
}

export default function TeacherDetail() {
  const { teacher, items, pagination, retreats: retreatList, centers: centerList } =
    useLoaderData<typeof loader>();
  const [params] = useSearchParams();
  const audio = useAudio();
  const [expanded, setExpanded] = useState(false);

  const teacherRef = { name: teacher.name, slug: teacher.slug, profileImageUrl: teacher.profileImageUrl };
  const talkItems = items.map((row) => fromFlatRow(row, { teacher: teacherRef }));
  const longBio = (teacher.description?.length ?? 0) > 320;

  const playAll = () => {
    const [first] = talkItems;
    if (first) audio.playNow(toPlayerTalk(first), talkItems.map(toPlayerTalk));
  };

  return (
    <div className="animate-rise">
      <header className="relative -mx-5 overflow-hidden px-5 pb-8 pt-10 sm:-mx-8 sm:px-8 md:pt-16 lg:-mx-12 lg:px-12">
        <div aria-hidden className="dusk-glow absolute inset-0" />
        <div className="relative flex flex-col gap-6 md:flex-row md:items-end md:gap-8">
          <Avatar
            src={teacher.profileImageUrl}
            name={teacher.name}
            size={144}
            className="shadow-soft ring-4 ring-paper"
          />
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-accent-ink">Teacher</p>
            <h1 className="mt-2 text-balance font-serif text-4xl leading-[1.05] tracking-tight md:text-6xl">
              {teacher.name}
            </h1>
            <p className="mt-3 text-sm text-ink-soft">
              {formatCount(Number(teacher.talksCount), "talk")}
              {Number(teacher.retreatsCount) ? ` · ${formatCount(Number(teacher.retreatsCount), "retreat")}` : ""}
              {Number(teacher.centersCount) ? ` · ${formatCount(Number(teacher.centersCount), "center")}` : ""}
            </p>
          </div>
        </div>

        <div className="relative mt-7 flex flex-wrap gap-2">
          <button type="button" onClick={playAll} className={cn(buttonClass("primary"), "pl-2 pr-5")}>
            <span className="flex size-8 items-center justify-center rounded-full bg-accent text-on-accent">
              <PlayGlyph playing={false} size={13} />
            </span>
            Play {params.get("sort") ? "these" : "latest"}
          </button>
          {teacher.donationUrl ? (
            <a href={teacher.donationUrl} target="_blank" rel="noreferrer" className={buttonClass("secondary")}>
              <HandHeart size={16} /> Offer dana
            </a>
          ) : null}
          {teacher.websiteUrl ? (
            <a href={teacher.websiteUrl} target="_blank" rel="noreferrer" className={buttonClass("ghost")}>
              Website <ExternalLink size={14} />
            </a>
          ) : null}
        </div>

        {teacher.description ? (
          <div className="relative mt-8 max-w-2xl">
            <p
              className={cn(
                "whitespace-pre-line text-pretty font-serif text-lg leading-relaxed text-ink-soft",
                longBio && !expanded && "line-clamp-4",
              )}
            >
              {teacher.description}
            </p>
            {longBio ? (
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="mt-2 text-sm font-medium text-accent-ink hover:underline"
              >
                {expanded ? "Show less" : "Read more"}
              </button>
            ) : null}
          </div>
        ) : null}
      </header>

      {retreatList.length ? (
        <Section title="Retreats">
          <div className="-mx-5 flex snap-x scroll-px-5 gap-3 overflow-x-auto px-5 pb-2 scrollbar-none sm:scroll-px-8 lg:scroll-px-12 sm:-mx-8 sm:px-8 lg:-mx-12 lg:px-12">
            {retreatList.map((retreat) => (
              <div key={retreat.id} className="w-72 shrink-0 snap-start">
                <CollectionCard
                  to={`/retreats/${retreat.slug}`}
                  title={retreat.title}
                  meta={formatCount(Number(retreat.talksCount), "talk")}
                  italic
                />
              </div>
            ))}
          </div>
        </Section>
      ) : null}

      <section id="talks" className="scroll-mt-16 py-6 md:py-8">
        <div className="sticky top-14 z-20 -mx-5 mb-2 flex items-center justify-between gap-4 border-b border-line bg-paper/90 px-5 py-2 backdrop-blur-md sm:-mx-8 sm:px-8 lg:top-0 lg:-mx-12 lg:px-12">
          <h2 className="font-serif text-2xl tracking-tight">Talks</h2>
          <SortTabs
            current={params.get("sort") ?? "date"}
            order={params.get("order") ?? "desc"}
            options={[
              { field: "date", label: "Newest" },
              { field: "title", label: "Title", defaultOrder: "asc" },
              { field: "duration", label: "Length" },
            ]}
          />
        </div>
        <TalkList talks={talkItems} showTeacher={false} />
        <Pagination current={pagination.current} pages={pagination.pages} />
      </section>

      {centerList.length ? (
        <Section title="Teaches at">
          <ul className="flex flex-wrap gap-2">
            {centerList.map((center) => (
              <li key={center.id}>
                <Link
                  to={`/centers/${center.slug}`}
                  className="inline-flex h-10 items-center gap-2 rounded-full border border-line px-4 text-sm hover:bg-paper-raised"
                >
                  {center.name}
                  <span className="text-ink-faint">{Number(center.talksCount)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
    </div>
  );
}
