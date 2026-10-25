import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { useLoaderData, useSearchParams } from "react-router";
import { SearchX } from "lucide-react";
import { formatCount } from "~/lib/format";
import { CollectionCard } from "~/components/collection-cards";
import { EmptyState, PageHeader, Pagination, SearchField, SortTabs } from "~/components/ui/primitives";
import { db } from "~/db/client.server";
import { retreats, talks } from "~/db/schema";
import { totalCountField, withPagination } from "~/utils/pagination.server";
import { eq, like, sql } from "drizzle-orm";
import { cacheHeader } from "pretty-cache-header";
import { withCachedJson } from "~/lib/cache.server";
import { withOrdering } from "~/utils/with-ordering";
import { getRequestParams } from "~/utils/request-params";

const cacheHeaders = {
  "Cache-Control": cacheHeader({
    maxAge: "6hours",
    sMaxage: "24hours",
    staleWhileRevalidate: "1week",
  }),
};

export const headers = () => cacheHeaders;

export const meta: MetaFunction = () => {
  return [
    { title: "Meditation Retreats - Dharma Radio" },
    {
      name: "description",
      content:
        "Browse meditation retreats and listen to retreat talks from teachers around the world",
    },
    { property: "og:title", content: "Meditation Retreats - Dharma Radio" },
    {
      property: "og:description",
      content:
        "Browse meditation retreats and listen to retreat talks from teachers around the world",
    },
  ];
};

export async function loader({ request, context }: LoaderFunctionArgs) {
  return withCachedJson(
    context.cloudflare.env.DB_QUERY_CACHE,
    `retreats:${request.url}`,
    900,
    async () => {
      const { searchQuery, page, sort, hasSearch } = getRequestParams(request, {
        field: "talks",
        order: "desc",
      });

      const database = db(context.cloudflare.env.DB);

      const query = database
        .select({
          id: retreats.id,
          slug: retreats.slug,
          title: retreats.title,
          description: retreats.description,
          talksCount: sql<number>`count(distinct ${talks.id})`.as(
            "talks_count",
          ),
          teachersCount: sql<number>`count(distinct ${talks.teacherId})`.as(
            "teachers_count",
          ),
          ...totalCountField,
        })
        .from(retreats)
        .leftJoin(talks, eq(talks.retreatId, retreats.id))
        .where(hasSearch ? like(retreats.title, `%${searchQuery}%`) : undefined)
        .groupBy(retreats.id)
        .orderBy(
          withOrdering({
            field: sort.field,
            order: sort.order,
            config: {
              talks: { column: sql`talks_count` },
              teachers: { column: sql`teachers_count` },
              title: { column: retreats.title },
            },
          }),
        );

      return withPagination({
        query: query.$dynamic(),
        params: { page, perPage: 25 },
      });
    },
  );
}

export default function Retreats() {
  const { items, pagination } = useLoaderData<typeof loader>();
  const [params] = useSearchParams();
  const q = params.get("q") ?? "";

  return (
    <div className="animate-rise">
      <PageHeader
        eyebrow="Retreats"
        title={q ? <>Retreats matching “{q}”</> : "Days of practice, recorded"}
        description={`${formatCount(pagination.total, "retreat")}. Listen through a whole retreat, talk by talk.`}
      >
        <SearchField placeholder="Find a retreat" defaultValue={q} className="max-w-xl" />
      </PageHeader>

      <div className="sticky top-14 z-20 -mx-5 mb-4 border-b border-line bg-paper/90 px-5 py-2 backdrop-blur-md sm:-mx-8 sm:px-8 lg:top-0 lg:-mx-12 lg:px-12">
        <SortTabs
          current={params.get("sort") ?? "talks"}
          order={params.get("order") ?? "desc"}
          options={[
            { field: "talks", label: "Most talks" },
            { field: "teachers", label: "Most teachers" },
            { field: "title", label: "Title", defaultOrder: "asc" },
          ]}
        />
      </div>

      {items.length ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((retreat) => (
            <CollectionCard
              key={retreat.id}
              to={`/retreats/${retreat.slug}`}
              title={retreat.title}
              description={retreat.description}
              meta={`${formatCount(Number(retreat.talksCount), "talk")} · ${formatCount(Number(retreat.teachersCount), "teacher")}`}
              italic
            />
          ))}
        </div>
      ) : (
        <EmptyState icon={<SearchX size={20} />} title="No retreats found">
          Try a place, a season, or a single word from the title.
        </EmptyState>
      )}

      <Pagination current={pagination.current} pages={pagination.pages} />
    </div>
  );
}
