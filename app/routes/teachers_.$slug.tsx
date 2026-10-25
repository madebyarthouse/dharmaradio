import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { Link, useLoaderData, useSearchParams } from "react-router";
import { ExternalLink, HandHeart, MapPin } from "lucide-react";
import { useState } from "react";
import { useAudio } from "~/contexts/audio-context";
import { fromFlatRow, toPlayerTalk } from "~/lib/talk";
import { formatCount } from "~/lib/format";
import { TalkList } from "~/components/talk-row";
import { RetreatTicket } from "~/components/collection-cards";
import { Avatar, Breadcrumbs, ListBar, MetaList, Pagination, Section, Shelf, SortTabs, buttonClass, titleClass } from "~/components/ui/primitives";
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
    { title: `${teacher.name}, dharma talks | Dharma Radio` },
    { name: "description", content: teacher.description },
    {
      property: "og:title",
      content: `${teacher.name}, dharma talks | Dharma Radio`,
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
    `teacher:v2:${slug}:${request.url}`,
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
          talksCount: sql<number>`count(distinct ${talks.id})`.as("talks_count"),
          // Stored in seconds; cards take milliseconds.
          firstDate: sql<number>`min(${talks.publicationDate}) * 1000`.as("first_date"),
          lastDate: sql<number>`max(${talks.publicationDate}) * 1000`.as("last_date"),
        })
        .from(retreats)
        .innerJoin(talks, eq(talks.retreatId, retreats.id))
        .where(eq(talks.teacherId, teacher.id))
        .groupBy(retreats.id)
        .orderBy(sql`last_date desc`);

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
      <header className="relative pb-8 pt-7 md:pt-12">
        <Breadcrumbs
          items={[
            { label: "Listen", to: "/listen" },
            { label: "Teachers", to: "/teachers" },
            { label: teacher.name, to: `/teachers/${teacher.slug}` },
          ]}
        />
        <div className="relative flex flex-col gap-6 md:flex-row md:items-end md:gap-8">
          <Avatar src={teacher.profileImageUrl} name={teacher.name} size={168} className="shadow-soft" />
          <div className="min-w-0">
            <h1 className={titleClass}>{teacher.name}</h1>
            <MetaList
              className="mt-3"
              items={[
                formatCount(Number(teacher.talksCount), "talk"),
                Number(teacher.retreatsCount) ? formatCount(Number(teacher.retreatsCount), "retreat") : null,
                Number(teacher.centersCount) ? formatCount(Number(teacher.centersCount), "center") : null,
              ]}
            />
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
                "whitespace-pre-line text-pretty text-sm leading-relaxed text-ink-soft md:text-[0.9375rem]",
                longBio && !expanded && "line-clamp-4",
              )}
            >
              {teacher.description}
            </p>
            {longBio ? (
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="mt-2 text-[0.8125rem] text-accent-ink underline decoration-transparent underline-offset-4 hover:decoration-current"
              >
                {expanded ? "Show less" : "Read more"}
              </button>
            ) : null}
          </div>
        ) : null}
      </header>

      {retreatList.length ? (
        <Shelf title="Retreats" label={`Retreats with ${teacher.name}`}>
          {retreatList.map((retreat) => (
            <RetreatTicket key={retreat.id} retreat={retreat} />
          ))}
        </Shelf>
      ) : null}

      <section id="talks" className="scroll-mt-16 py-6 md:py-8">
        <ListBar>
          <h2 className="font-serif text-[1.5rem] leading-tight tracking-[-0.01em]">Talks</h2>
          <SortTabs
            current={params.get("sort") ?? "date"}
            order={params.get("order") ?? "desc"}
            options={[
              { field: "date", label: "Newest" },
              { field: "title", label: "Title", defaultOrder: "asc" },
              { field: "duration", label: "Length" },
            ]}
          />
        </ListBar>
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
                  className="press inline-flex h-10 items-center gap-2 rounded-full px-4 text-[0.8125rem] ring-1 ring-inset ring-line hover:bg-paper-sunken"
                >
                  <MapPin size={14} className="text-ink-faint" aria-hidden />
                  {center.name}
                  <span className="text-xs tabular-nums text-ink-faint">{Number(center.talksCount)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
    </div>
  );
}
