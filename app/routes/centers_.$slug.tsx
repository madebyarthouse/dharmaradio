import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { useLoaderData, useSearchParams } from "react-router";
import { fromFlatRow } from "~/lib/talk";
import { formatCount } from "~/lib/format";
import { TalkList } from "~/components/talk-row";
import { RetreatTicket, TeacherTile } from "~/components/collection-cards";
import { Breadcrumbs, ListBar, MetaList, Pagination, Shelf, SortTabs, titleClass } from "~/components/ui/primitives";
import { MapPin } from "lucide-react";
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
    `center:v2:${slug}:${request.url}`,
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
          talksCount: sql<number>`count(distinct ${talks.id})`.as("talks_count"),
          // Stored in seconds; cards take milliseconds.
          firstDate: sql<number>`min(${talks.publicationDate}) * 1000`.as("first_date"),
          lastDate: sql<number>`max(${talks.publicationDate}) * 1000`.as("last_date"),
        })
        .from(retreats)
        .innerJoin(talks, eq(talks.retreatId, retreats.id))
        .where(eq(talks.centerId, center.id))
        .groupBy(retreats.id)
        .orderBy(sql`last_date desc`);

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
      <header className="relative pb-8 pt-7 md:pt-12">
        <Breadcrumbs
          items={[
            { label: "Listen", to: "/listen" },
            { label: "Centers", to: "/centers" },
            { label: center.name, to: `/centers/${center.slug}` },
          ]}
        />
        <div className="relative">
          <span className="mb-5 flex size-14 items-center justify-center rounded-xl bg-paper-sunken text-accent-ink ring-1 ring-inset ring-line">
            <MapPin size={24} strokeWidth={1.6} aria-hidden />
          </span>
          <h1 className={titleClass + " max-w-3xl"}>{center.name}</h1>
          <MetaList
            className="mt-4"
            items={[
              formatCount(pagination.total, "talk"),
              formatCount(teacherList.length, "teacher"),
              formatCount(retreatList.length, "retreat"),
            ]}
          />
          {center.description ? (
            <p className="mt-6 max-w-[65ch] whitespace-pre-line text-pretty text-sm leading-relaxed text-ink-soft md:text-[0.9375rem]">
              {center.description}
            </p>
          ) : null}
        </div>
      </header>

      {teacherList.length ? (
        <Shelf title="Teachers" label={`Teachers at ${center.name}`}>
          {[...teacherList]
            .sort((a, b) => Number(b.talksCount) - Number(a.talksCount))
            .map((teacher) => (
              <TeacherTile key={teacher.id} teacher={teacher} />
            ))}
        </Shelf>
      ) : null}

      {retreatList.length ? (
        <Shelf title="Retreats" label={`Retreats at ${center.name}`}>
          {retreatList.map((retreat) => (
            <RetreatTicket key={retreat.id} retreat={retreat} />
          ))}
        </Shelf>
      ) : null}

      <section className="py-6 md:py-8">
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
        <TalkList talks={talkItems} />
        <Pagination current={pagination.current} pages={pagination.pages} />
      </section>
    </div>
  );
}
