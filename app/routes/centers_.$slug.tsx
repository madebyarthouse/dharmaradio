import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { useLoaderData, useSearchParams } from "react-router";
import { fromFlatRow } from "~/lib/talk";
import { formatCount } from "~/lib/format";
import { TalkList } from "~/components/talk-row";
import { CollectionCard, TeacherTile } from "~/components/collection-cards";
import { Pagination, Section, SortTabs } from "~/components/ui/primitives";
import { eq, sql } from "drizzle-orm";
import { db } from "~/db/client.server";
import { centers, retreats, talks, teachers } from "~/db/schema";
import { totalCountField, withPagination } from "~/utils/pagination.server";
import { withOrdering } from "~/utils/with-ordering";
import { getRequestParams } from "~/utils/request-params";
import { cacheHeader } from "pretty-cache-header";
import { withCachedJson } from "~/lib/cache.server";

const cacheHeaders = {
  "Cache-Control": cacheHeader({
    maxAge: "6hours",
    sMaxage: "24hours",
    staleWhileRevalidate: "1week",
  }),
};

export const headers = () => cacheHeaders;

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  if (!data?.center) {
    return [{ title: "Center Not Found" }];
  }

  const { center } = data;
  return [
    { title: `${center.name} - Dharma Radio` },
    { name: "description", content: center.description },
    { property: "og:title", content: `${center.name} - Dharma Radio` },
    { property: "og:description", content: center.description },
  ];
};

export async function loader({ params, request, context }: LoaderFunctionArgs) {
  const { slug } = params;

  if (!slug) {
    throw new Error("Center slug is required");
  }

  return withCachedJson(
    context.cloudflare.env.DB_QUERY_CACHE,
    `center:${slug}:${request.url}`,
    900,
    async () => {
      const { page, sort } = getRequestParams(request, {
        field: "date",
        order: "desc",
      });

      const database = db(context.cloudflare.env.DB);

      const center = await database.query.centers.findFirst({
        where: eq(centers.slug, slug),
      });

      if (!center) {
        throw new Response("Not Found", { status: 404 });
      }

      // Get talks
      const talksQuery = database
        .select({
          id: talks.id,
          slug: talks.slug,
          title: talks.title,
          audioUrl: talks.audioUrl,
          duration: talks.duration,
          publicationDate: talks.publicationDate,
          teacherName: teachers.name,
          teacherSlug: teachers.slug,
          teacherProfileImageUrl: teachers.profileImageUrl,
          retreatTitle: retreats.title,
          retreatSlug: retreats.slug,
          ...totalCountField,
        })
        .from(talks)
        .where(eq(talks.centerId, center.id))
        .leftJoin(teachers, eq(teachers.id, talks.teacherId))
        .leftJoin(retreats, eq(retreats.id, talks.retreatId))
        .orderBy(
          withOrdering({
            field: sort.field,
            order: sort.order,
            config: {
              date: { column: talks.publicationDate },
              title: { column: talks.title },
              duration: { column: talks.duration },
            },
          }),
        );

      // Get teachers
      const teachersQuery = database
        .select({
          id: teachers.id,
          name: teachers.name,
          slug: teachers.slug,
          description: teachers.description,
          profileImageUrl: teachers.profileImageUrl,
          talksCount: sql<number>`count(distinct ${talks.id})`.as("talks_count"),
        })
        .from(teachers)
        .innerJoin(talks, eq(talks.teacherId, teachers.id))
        .where(eq(talks.centerId, center.id))
        .groupBy(teachers.id);

      // Get retreats
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
        .where(eq(talks.centerId, center.id))
        .groupBy(retreats.id);

      const [paginatedTalks, teachersData, retreatsData] = await Promise.all([
        withPagination({
          query: talksQuery.$dynamic(),
          params: { page, perPage: 50 },
        }),
        teachersQuery,
        retreatsQuery,
      ]);

      return {
        center,
        ...paginatedTalks,
        teachers: teachersData,
        retreats: retreatsData,
      };
    },
  );
}

export default function CenterDetail() {
  const { center, items, pagination, teachers: teacherList, retreats: retreatList } =
    useLoaderData<typeof loader>();
  const [params] = useSearchParams();
  const talkItems = items.map((row) => fromFlatRow(row, { center: { name: center.name, slug: center.slug } }));

  return (
    <div className="animate-rise">
      <header className="relative -mx-5 overflow-hidden px-5 pb-8 pt-10 sm:-mx-8 sm:px-8 md:pt-16 lg:-mx-12 lg:px-12">
        <div aria-hidden className="dusk-glow absolute inset-0" />
        <div className="relative">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-accent-ink">Center</p>
          <h1 className="mt-3 max-w-3xl text-balance font-serif text-4xl leading-[1.05] tracking-tight md:text-6xl">
            {center.name}
          </h1>
          <p className="mt-4 text-sm text-ink-soft">
            {formatCount(pagination.total, "talk")} · {formatCount(teacherList.length, "teacher")} ·{" "}
            {formatCount(retreatList.length, "retreat")}
          </p>
          {center.description ? (
            <p className="mt-6 max-w-2xl whitespace-pre-line text-pretty font-serif text-lg leading-relaxed text-ink-soft">
              {center.description}
            </p>
          ) : null}
        </div>
      </header>

      {teacherList.length ? (
        <Section title="Teachers">
          <div className="-mx-5 flex gap-4 overflow-x-auto px-5 pb-2 scrollbar-none sm:-mx-8 sm:px-8 lg:-mx-12 lg:px-12">
            {[...teacherList]
              .sort((a, b) => Number(b.talksCount) - Number(a.talksCount))
              .map((teacher) => (
                <TeacherTile key={teacher.id} teacher={teacher} />
              ))}
          </div>
        </Section>
      ) : null}

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

      <section className="py-6 md:py-8">
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
        <TalkList talks={talkItems} />
        <Pagination current={pagination.current} pages={pagination.pages} />
      </section>
    </div>
  );
}
