import type { LoaderFunctionArgs } from "@remix-run/cloudflare";
import { useLoaderData } from "@remix-run/react";
import { eq, like, sql } from "drizzle-orm";
import { CenterCard } from "~/components/center-card";
import { db } from "~/db/client.server";
import { centers, talks } from "~/db/schema";
import { totalCountField, withPagination } from "~/utils/pagination.server";
import { getRequestParams } from "~/utils/request-params";
import { withOrdering } from "~/utils/with-ordering";
import { FilterableList } from "~/components/ui/filterable-list";
import { AnimatedList } from "~/components/ui/animated-list";
import { cacheHeader } from "pretty-cache-header";
import type { MetaFunction } from "@remix-run/cloudflare";

export const headers = {
  "Cache-Control": cacheHeader({
    maxAge: "6hours",
    sMaxage: "24hours",
    staleWhileRevalidate: "1week",
  }),
};

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
      talksCount: sql<number>`count(distinct ${talks.id})`.as("talks_count"),
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
    params: { page, perPage: 30 },
  });
}

export default function Centers() {
  const { items: centers, pagination } = useLoaderData<typeof loader>();

  const sortOptions = [
    { label: "Talks", value: "talks" },
    { label: "Teachers", value: "teachers" },
    { label: "Retreats", value: "retreats" },
  ];

  return (
    <FilterableList
      title="Meditation Centers"
      totalItems={pagination.total}
      itemName="center"
      sortOptions={sortOptions}
      defaultSort="talks"
      currentPage={pagination.current}
      totalPages={pagination.pages}
    >
      <AnimatedList className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {centers.map((center) => (
          <CenterCard key={center.slug} {...center} />
        ))}
      </AnimatedList>
    </FilterableList>
  );
}
