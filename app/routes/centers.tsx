import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { useLoaderData, useSearchParams } from "react-router";
import { SearchX } from "lucide-react";
import { formatCount } from "~/lib/format";
import { CenterRow } from "~/components/collection-cards";
import { EmptyState, PageHeader, Pagination, SearchField, SortTabs } from "~/components/ui/primitives";
import { eq, like, sql } from "drizzle-orm";
import { db } from "~/db/client.server";
import { centers, talks } from "~/db/schema";
import { totalCountField, withPagination } from "~/utils/pagination.server";
import { getRequestParams } from "~/utils/request-params";
import { withOrdering } from "~/utils/with-ordering";
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

export const meta: MetaFunction = () => {
  return [
    { title: "Meditation Centers - Dharma Radio" },
    {
      name: "description",
      content:
        "Explore dharma talks from meditation centers and Buddhist communities around the world",
    },
    { property: "og:title", content: "Meditation Centers - Dharma Radio" },
    {
      property: "og:description",
      content:
        "Explore dharma talks from meditation centers and Buddhist communities around the world",
    },
  ];
};

export async function loader({ request, context }: LoaderFunctionArgs) {
  return withCachedJson(
    context.cloudflare.env.DB_QUERY_CACHE,
    `centers:${request.url}`,
    900,
    async () => {
      const { searchQuery, page, sort, hasSearch } = getRequestParams(request, {
        field: "talks",
        order: "desc",
      });

      const database = db(context.cloudflare.env.DB);

      const query = database
        .select({
          id: centers.id,
          name: centers.name,
          slug: centers.slug,
          description: centers.description,
          talksCount: sql<number>`count(distinct ${talks.id})`.as(
            "talks_count",
          ),
          teachersCount: sql<number>`count(distinct ${talks.teacherId})`.as(
            "teachers_count",
          ),
          retreatsCount: sql<number>`count(distinct ${talks.retreatId})`.as(
            "retreats_count",
          ),
          ...totalCountField,
        })
        .from(centers)
        .leftJoin(talks, eq(talks.centerId, centers.id))
        .where(hasSearch ? like(centers.name, `%${searchQuery}%`) : undefined)
        .groupBy(centers.id)
        .orderBy(
          withOrdering({
            field: sort.field,
            order: sort.order,
            config: {
              talks: { column: sql`talks_count` },
              teachers: { column: sql`teachers_count` },
              retreats: { column: sql`retreats_count` },
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

export default function Centers() {
  const { items, pagination } = useLoaderData<typeof loader>();
  const [params] = useSearchParams();
  const q = params.get("q") ?? "";

  return (
    <div className="animate-rise">
      <PageHeader
        breadcrumbs={[{ label: "Listen", to: "/listen" }, { label: "Centers", to: "/centers" }]}
        title={q ? <>Centers matching “{q}”</> : "Where the talks were given"}
        description={`${formatCount(pagination.total, "meditation center")} and sanghas.`}
      >
        <SearchField placeholder="Find a center" defaultValue={q} className="max-w-xl" />
      </PageHeader>

      <div className="sticky top-[var(--bar-h)] z-20 -mx-5 mb-4 border-b border-line bg-paper/90 px-5 py-2 backdrop-blur-md sm:-mx-8 sm:px-8 lg:-mx-12 lg:px-12">
        <SortTabs
          current={params.get("sort") ?? "talks"}
          order={params.get("order") ?? "desc"}
          options={[
            { field: "talks", label: "Most talks" },
            { field: "teachers", label: "Most teachers" },
            { field: "retreats", label: "Most retreats" },
          ]}
        />
      </div>

      {items.length ? (
        <ul className="grid grid-cols-1 gap-x-10 sm:grid-cols-2">
          {items.map((center) => (
            <li key={center.id} className="min-w-0 border-b border-line">
              <CenterRow center={center} />
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState icon={<SearchX size={20} />} title="No centers found">
          Try the town or the name of the sangha.
        </EmptyState>
      )}

      <Pagination current={pagination.current} pages={pagination.pages} />
    </div>
  );
}
